import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';

import { prismaMock } from '../../../__tests__/helpers/prisma-mock.js';

vi.mock('../../../config/database', () => ({
  prisma: prismaMock,
}));

import { vehiclesService } from '../vehicles.service.js';
import { buildVehicle } from '../../../__tests__/helpers/factories.js';
import { VehicleStatus } from '../../../generated/client.js';

beforeEach(() => {
  mockReset(prismaMock);
});

// Vehicles include a partner relation — extend base vehicle with null partner for convenience
const vehicleWithPartner = (overrides = {}) => ({
  ...buildVehicle(overrides),
  partner: null,
});

// ---------------------------------------------------------------------------
// findAll()
// ---------------------------------------------------------------------------

describe('vehiclesService.findAll()', () => {
  it('returns paginated list of active vehicles', async () => {
    const vehicles = [vehicleWithPartner({ id: 1 }), vehicleWithPartner({ id: 2, licensePlate: 'B22BBB' })];
    prismaMock.vehicle.findMany.mockResolvedValue(vehicles as never);
    prismaMock.vehicle.count.mockResolvedValue(2);

    const result = await vehiclesService.findAll(1, 20);

    expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, skip: 0, take: 20 }),
    );
    expect(result.items).toEqual(vehicles);
    expect(result.total).toBe(2);
  });

  it('applies search filter across licensePlate, make and model', async () => {
    prismaMock.vehicle.findMany.mockResolvedValue([]);
    prismaMock.vehicle.count.mockResolvedValue(0);

    await vehiclesService.findAll(1, 20, 'Mercedes');

    expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { licensePlate: { contains: 'Mercedes', mode: 'insensitive' } },
            { make: { contains: 'Mercedes', mode: 'insensitive' } },
            { model: { contains: 'Mercedes', mode: 'insensitive' } },
          ]),
        }),
      }),
    );
  });

  it('applies status filter when provided', async () => {
    prismaMock.vehicle.findMany.mockResolvedValue([]);
    prismaMock.vehicle.count.mockResolvedValue(0);

    await vehiclesService.findAll(1, 20, undefined, VehicleStatus.ON_ROUTE);

    expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: VehicleStatus.ON_ROUTE }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// findOne()
// ---------------------------------------------------------------------------

describe('vehiclesService.findOne()', () => {
  it('returns the vehicle when found', async () => {
    const vehicle = vehicleWithPartner();
    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle as never);

    const result = await vehiclesService.findOne(1);

    expect(result).toEqual(vehicle);
    expect(prismaMock.vehicle.findFirst).toHaveBeenCalledWith({
      where: { id: 1, isActive: true },
      include: { partner: { select: { id: true, name: true } } },
    });
  });

  it('throws "Vehicle not found" when vehicle does not exist', async () => {
    prismaMock.vehicle.findFirst.mockResolvedValue(null);

    await expect(vehiclesService.findOne(999)).rejects.toThrow('Vehicle not found');
  });
});

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

describe('vehiclesService.create()', () => {
  it('creates a new vehicle successfully', async () => {
    const vehicle = vehicleWithPartner();
    prismaMock.vehicle.findUnique.mockResolvedValue(null);
    prismaMock.vehicle.create.mockResolvedValue(vehicle as never);

    const result = await vehiclesService.create({
      licensePlate: 'TM01ABC',
      vin: 'WBA12345678901234',
      make: 'Mercedes',
      model: 'Actros',
      yearOfManufacture: 2020,
      emissionsStandard: 'Euro 6',
      axles: 3,
      category: 'TIR',
      status: VehicleStatus.AVAILABLE,
    });

    expect(prismaMock.vehicle.create).toHaveBeenCalled();
    expect(result).toEqual(vehicle);
  });

  it('throws when active vehicle with same licensePlate exists', async () => {
    const existing = buildVehicle({ isActive: true });
    prismaMock.vehicle.findUnique.mockResolvedValue(existing);

    await expect(
      vehiclesService.create({ licensePlate: 'TM01ABC', make: 'Volvo', model: 'FH', status: VehicleStatus.AVAILABLE }),
    ).rejects.toThrow('A vehicle with this license plate already exists');
  });

  it('frees licensePlate from soft-deleted vehicle and creates new one', async () => {
    const deleted = buildVehicle({ isActive: false, licensePlate: 'TM01ABC' });
    const created = vehicleWithPartner({ id: 2 });
    // First findUnique: licensePlate check (returns deleted). Second: VIN check (returns null).
    prismaMock.vehicle.findUnique
      .mockResolvedValueOnce(deleted)
      .mockResolvedValueOnce(null);
    prismaMock.vehicle.update.mockResolvedValue({ ...deleted, licensePlate: 'TM01ABC_deleted_1' } as never);
    prismaMock.vehicle.create.mockResolvedValue(created as never);

    const result = await vehiclesService.create({
      licensePlate: 'TM01ABC',
      vin: 'WBA12345678901234',
      make: 'Mercedes',
      model: 'Actros',
      status: VehicleStatus.AVAILABLE,
    });

    expect(prismaMock.vehicle.update).toHaveBeenCalledWith({
      where: { id: deleted.id },
      data: { licensePlate: `TM01ABC_deleted_${deleted.id}` },
    });
    expect(result).toEqual(created);
  });

  it('throws when active vehicle with same VIN exists', async () => {
    // First findUnique: licensePlate check returns null. Second: VIN check returns active vehicle.
    const existingVin = buildVehicle({ id: 5, vin: 'WBA12345678901234', isActive: true });
    prismaMock.vehicle.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingVin);

    await expect(
      vehiclesService.create({
        licensePlate: 'NEWPLATE',
        vin: 'WBA12345678901234',
        make: 'Mercedes',
        model: 'Actros',
        status: VehicleStatus.AVAILABLE,
      }),
    ).rejects.toThrow('A vehicle with this VIN already exists');
  });

  it('frees VIN slot from soft-deleted vehicle and creates new one', async () => {
    const deletedVin = buildVehicle({ id: 5, vin: 'WBA12345678901234', isActive: false });
    const created = vehicleWithPartner({ id: 6 });
    // First findUnique: licensePlate check (null). Second: VIN check (soft-deleted).
    prismaMock.vehicle.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(deletedVin);
    prismaMock.vehicle.update.mockResolvedValue({ ...deletedVin, vin: null } as never);
    prismaMock.vehicle.create.mockResolvedValue(created as never);

    const result = await vehiclesService.create({
      licensePlate: 'NEWPLATE',
      vin: 'WBA12345678901234',
      make: 'Mercedes',
      model: 'Actros',
      status: VehicleStatus.AVAILABLE,
    });

    expect(prismaMock.vehicle.update).toHaveBeenCalledWith({
      where: { id: deletedVin.id },
      data: { vin: null },
    });
    expect(result).toEqual(created);
  });
});

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

describe('vehiclesService.update()', () => {
  it('updates vehicle successfully', async () => {
    const vehicle = vehicleWithPartner();
    const updated = vehicleWithPartner({ make: 'Volvo' });
    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle as never);
    prismaMock.vehicle.findUnique.mockResolvedValue(null);
    prismaMock.vehicle.update.mockResolvedValue(updated as never);

    const result = await vehiclesService.update(1, { licensePlate: 'TM01ABC', make: 'Volvo' });

    expect(prismaMock.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
    expect(result).toEqual(updated);
  });

  it('throws when updating to a licensePlate belonging to another active vehicle', async () => {
    const vehicle = vehicleWithPartner({ id: 1 });
    const conflict = buildVehicle({ id: 2, licensePlate: 'B22BBB', isActive: true });
    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle as never);
    prismaMock.vehicle.findUnique.mockResolvedValue(conflict);

    await expect(
      vehiclesService.update(1, { licensePlate: 'B22BBB' }),
    ).rejects.toThrow('A vehicle with this license plate already exists');
  });

  it('throws when updating to a VIN belonging to another active vehicle', async () => {
    const vehicle = vehicleWithPartner({ id: 1 });
    const conflictVin = buildVehicle({ id: 3, vin: 'CONFLICTVIN1234567', isActive: true });
    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle as never);
    // dto has no licensePlate → only ONE findUnique call (VIN check)
    prismaMock.vehicle.findUnique.mockResolvedValueOnce(conflictVin);

    await expect(
      vehiclesService.update(1, { vin: 'CONFLICTVIN1234567' }),
    ).rejects.toThrow('A vehicle with this VIN already exists');
  });
});

// ---------------------------------------------------------------------------
// remove()
// ---------------------------------------------------------------------------

describe('vehiclesService.remove()', () => {
  it('renames licensePlate to {plate}_deleted_{id} and nulls VIN on soft delete', async () => {
    const vehicle = vehicleWithPartner({ id: 1, licensePlate: 'TM01ABC', vin: 'WBA12345678901234' });
    const deactivated = vehicleWithPartner({ id: 1, isActive: false, licensePlate: 'TM01ABC_deleted_1', vin: null });
    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle as never);
    prismaMock.vehicle.update.mockResolvedValue(deactivated as never);

    const result = await vehiclesService.remove(1);

    expect(prismaMock.vehicle.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isActive: false,
        licensePlate: 'TM01ABC_deleted_1',
        vin: null,
      },
    });
    expect(result.isActive).toBe(false);
  });
});
