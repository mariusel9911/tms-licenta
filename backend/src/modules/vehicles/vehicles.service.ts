import { VehicleStatus, OrderStatus } from '../../generated/client.js';
import { prisma } from '../../config/database.js';
import { paginate, buildPaginationMeta } from '../../utils/pagination.util.js';
import type { CreateVehicleDtoType, UpdateVehicleDtoType } from './vehicles.dto.js';

/** Check if a vehicle has any active IN_PROGRESS orders. Block deactivation if so. */
async function guardAgainstActiveOrders(vehicleId: number, licensePlate: string): Promise<void> {
  const activeOrder = await prisma.order.findFirst({
    where: { vehicleId, status: OrderStatus.IN_PROGRESS },
    select: { orderNumber: true },
  });
  if (activeOrder) {
    throw new Error(
      `Cannot deactivate vehicle ${licensePlate} — it is currently on route (Order ${activeOrder.orderNumber}). Complete or cancel the order first.`,
    );
  }
}

export const vehiclesService = {
  async findAll(
    page: number,
    limit: number,
    search?: string,
    status?: VehicleStatus,
  ) {
    const { skip, take } = paginate(page, limit);

    const where = {
      isActive: true,
      ...(status && { status }),
      ...(search && {
        OR: [
          { licensePlate: { contains: search, mode: 'insensitive' as const } },
          { make: { contains: search, mode: 'insensitive' as const } },
          { model: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take,
        orderBy: { licensePlate: 'asc' },
        include: {
          partner: { select: { id: true, name: true } },
        },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return {
      items,
      ...buildPaginationMeta(total, page, limit),
    };
  },

  async findOne(id: number) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id, isActive: true },
      include: {
        partner: { select: { id: true, name: true } },
      },
    });

    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    return vehicle;
  },

  async create(dto: CreateVehicleDtoType) {
    const existing = await prisma.vehicle.findUnique({
      where: { licensePlate: dto.licensePlate },
    });
    if (existing) {
      if (!existing.isActive) {
        // Soft-deleted record holds the unique slot — free it so the new vehicle can use it
        await prisma.vehicle.update({
          where: { id: existing.id },
          data: { licensePlate: `${dto.licensePlate}_deleted_${existing.id}` },
        });
      } else {
        throw new Error('A vehicle with this license plate already exists');
      }
    }

    if (dto.vin) {
      const existingVin = await prisma.vehicle.findUnique({
        where: { vin: dto.vin },
      });
      if (existingVin) {
        if (!existingVin.isActive) {
          // Soft-deleted record holds the unique slot — null it out so the new vehicle can use it
          await prisma.vehicle.update({
            where: { id: existingVin.id },
            data: { vin: null },
          });
        } else {
          throw new Error('A vehicle with this VIN already exists');
        }
      }
    }

    return prisma.vehicle.create({
      data: {
        ...dto,
        partnerId: dto.partnerId || undefined, // coerce 0 → undefined (no partner)
      },
      include: {
        partner: { select: { id: true, name: true } },
      },
    });
  },

  async update(id: number, dto: UpdateVehicleDtoType) {
    const vehicle = await vehiclesService.findOne(id);

    // Block setting to INACTIVE if vehicle has IN_PROGRESS orders
    if (dto.status === VehicleStatus.INACTIVE && vehicle.status !== VehicleStatus.INACTIVE) {
      await guardAgainstActiveOrders(id, vehicle.licensePlate);
    }

    if (dto.licensePlate) {
      const existing = await prisma.vehicle.findUnique({
        where: { licensePlate: dto.licensePlate },
      });
      if (existing && existing.id !== id) {
        if (!existing.isActive) {
          await prisma.vehicle.update({
            where: { id: existing.id },
            data: { licensePlate: `${dto.licensePlate}_deleted_${existing.id}` },
          });
        } else {
          throw new Error('A vehicle with this license plate already exists');
        }
      }
    }

    if (dto.vin) {
      const existingVin = await prisma.vehicle.findUnique({
        where: { vin: dto.vin },
      });
      if (existingVin && existingVin.id !== id && existingVin.isActive) {
        throw new Error('A vehicle with this VIN already exists');
      }
    }

    return prisma.vehicle.update({
      where: { id },
      data: { ...dto },
      include: {
        partner: { select: { id: true, name: true } },
      },
    });
  },

  async remove(id: number) {
    const vehicle = await vehiclesService.findOne(id);

    // Block soft-delete if vehicle has IN_PROGRESS orders
    await guardAgainstActiveOrders(id, vehicle.licensePlate);

    return prisma.vehicle.update({
      where: { id },
      data: {
        isActive: false,
        licensePlate: `${vehicle.licensePlate}_deleted_${id}`,
        vin: vehicle.vin ? null : undefined, // free the unique slot
      },
    });
  },
};
