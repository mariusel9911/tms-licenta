import { OrderStatus, VehicleStatus } from '../../generated/client.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { paginate, buildPaginationMeta } from '../../utils/pagination.util.js';
import { activityService } from '../activity/activity.service.js';
import { settingsService } from '../settings/settings.service.js';
import { mailerService } from '../../config/mailer.service.js';
import { generateOrderNumber } from './order-number.util.js';
import { generateCharteringAgreementPdf } from './order-pdf.service.js';
import { incrementOrdersVersion } from '../ai/ai.service.js';
import type { CreateOrderDtoType, UpdateOrderDtoType, FindAllOrdersDtoType } from './orders.dto.js';

/** Allowed order status transitions. */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]:       [OrderStatus.CONFIRMED, OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]:   [OrderStatus.IN_PROGRESS, OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.DRAFT],
  [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]:   [],
  [OrderStatus.CANCELLED]:   [],
};

function validateStatusTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(`Cannot transition from ${from} to ${to}`);
  }
}

/**
 * Dispatch gate — validates that an order can move to IN_PROGRESS.
 * Checks: vehicle assigned + not MAINTENANCE/INACTIVE, transporter assigned,
 * dates present, pickup + delivery addresses present.
 */
async function validateDispatchGate(order: {
  id: number;
  vehicleId: number | null;
  transporterId: number | null;
  pickupDateBegin: Date | null;
  pickupDateEnd: Date | null;
  deliveryDateBegin: Date | null;
  deliveryDateEnd: Date | null;
  pickupAddress: string | null;
  deliveryAddress: string | null;
}): Promise<void> {
  if (!order.vehicleId) {
    throw new Error('Cannot start route — no vehicle assigned to this order');
  }
  if (!order.transporterId) {
    throw new Error('Cannot start route — no transporter assigned to this order');
  }
  if (!order.pickupDateBegin || !order.deliveryDateBegin) {
    throw new Error('Cannot start route — pickup and delivery dates are required');
  }
  if (!order.pickupAddress?.trim() || !order.deliveryAddress?.trim()) {
    throw new Error('Cannot start route — pickup and delivery addresses are required');
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: order.vehicleId },
    select: { licensePlate: true, status: true },
  });
  if (!vehicle) {
    throw new Error('Cannot start route — assigned vehicle no longer exists');
  }
  if (
    vehicle.status === VehicleStatus.MAINTENANCE ||
    vehicle.status === VehicleStatus.INACTIVE
  ) {
    const statusLabel = vehicle.status === VehicleStatus.MAINTENANCE
      ? 'currently in maintenance'
      : 'inactive';
    throw new Error(`Cannot start route — vehicle ${vehicle.licensePlate} is ${statusLabel}`);
  }
}

/** Zero-out seconds & milliseconds — transport dates only need minute precision. */
function toMinutePrecision(val: string | Date | null | undefined): Date | null | undefined {
  if (val === null || val === undefined) return val;
  const d = val instanceof Date ? new Date(val.getTime()) : new Date(val);
  d.setSeconds(0, 0);
  return d;
}

const ORDER_INCLUDE = {
  client: { select: { id: true, name: true, country: true } },
  transporter: { select: { id: true, name: true } },
  vehicle: { select: { id: true, licensePlate: true, status: true } },
};

/**
 * Fetches an order with relations and builds a PDF-ready DTO + names object.
 * Shared by markAsSent() and generateSavedOrderPdf().
 */
async function buildPdfDtoFromOrder(id: number) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      client: { select: { name: true } },
      transporter: {
        select: { name: true, fiscalCode: true, addressLine1: true, phone: true, email: true },
      },
      vehicle: { select: { licensePlate: true } },
    },
  });

  if (!order) throw new Error('Order not found');

  const settings = await settingsService.get();

  const pdfDto = {
    clientId: order.clientId,
    orderSeries: order.orderSeries,
    orderNumber: order.orderNumber,
    clientOrderReference: order.clientOrderReference ?? undefined,
    transporterReference: order.transporterReference ?? undefined,
    intermediaryPartnerRef: order.intermediaryPartnerRef ?? undefined,
    transporterId: order.transporterId ?? undefined,
    vehicleId: order.vehicleId ?? undefined,
    driverName: order.driverName ?? undefined,
    contactName: order.contactName ?? undefined,
    pickupAddress: order.pickupAddress ?? undefined,
    pickupCountry: order.pickupCountry ?? undefined,
    pickupDateBegin: order.pickupDateBegin ? order.pickupDateBegin.toISOString() : undefined,
    pickupDateEnd: order.pickupDateEnd ? order.pickupDateEnd.toISOString() : undefined,
    deliveryAddress: order.deliveryAddress ?? undefined,
    deliveryCountry: order.deliveryCountry ?? undefined,
    deliveryDateBegin: order.deliveryDateBegin ? order.deliveryDateBegin.toISOString() : undefined,
    deliveryDateEnd: order.deliveryDateEnd ? order.deliveryDateEnd.toISOString() : undefined,
    distanceKm: order.distanceKm ? Number(order.distanceKm) : undefined,
    transporterPrice: order.transporterPrice ? Number(order.transporterPrice) : undefined,
    transporterCurrency: order.transporterCurrency ?? undefined,
    clientPrice: order.clientPrice ? Number(order.clientPrice) : undefined,
    clientCurrency: order.clientCurrency ?? undefined,
    cargoQuantity: order.cargoQuantity ?? undefined,
    cargoDescription: order.cargoDescription ?? undefined,
    cargoLengthCm: order.cargoLengthCm ? Number(order.cargoLengthCm) : undefined,
    cargoWidthCm: order.cargoWidthCm ? Number(order.cargoWidthCm) : undefined,
    cargoHeightCm: order.cargoHeightCm ? Number(order.cargoHeightCm) : undefined,
    cargoWeightKg: order.cargoWeightKg ? Number(order.cargoWeightKg) : undefined,
    cargoItems: (() => {
      if (!order.cargoItemsJson) return undefined;
      try {
        const parsed: unknown = JSON.parse(order.cargoItemsJson);
        if (!Array.isArray(parsed)) return undefined;
        return parsed as Array<{ qty?: number; description?: string; lengthCm?: number; widthCm?: number; heightCm?: number; weightKg?: number }>;
      } catch {
        logger.error({ orderId: order.id }, 'Failed to parse cargoItemsJson');
        return undefined;
      }
    })(),
    additionalPickups: (() => {
      if (!order.additionalPickupsJson) return undefined;
      try {
        const parsed: unknown = JSON.parse(order.additionalPickupsJson);
        if (!Array.isArray(parsed)) return undefined;
        return parsed as Array<{ address?: string; country?: string; dateBegin?: string }>;
      } catch {
        logger.error({ orderId: order.id }, 'Failed to parse additionalPickupsJson');
        return undefined;
      }
    })(),
    additionalDeliveries: (() => {
      if (!order.additionalDeliveriesJson) return undefined;
      try {
        const parsed: unknown = JSON.parse(order.additionalDeliveriesJson);
        if (!Array.isArray(parsed)) return undefined;
        return parsed as Array<{ address?: string; country?: string; dateBegin?: string }>;
      } catch {
        logger.error({ orderId: order.id }, 'Failed to parse additionalDeliveriesJson');
        return undefined;
      }
    })(),
    status: order.status,
    notes: order.notes ?? undefined,
    // internalNotes intentionally excluded — must never reach the PDF
    documentDate: order.documentDate ? order.documentDate.toISOString() : undefined,
    applyStamp: order.applyStamp,
  };

  const names = {
    clientName: order.client.name,
    transporterName: order.transporter?.name ?? null,
    transporterFiscalCode: order.transporter?.fiscalCode ?? null,
    transporterAddress: order.transporter?.addressLine1 ?? null,
    transporterPhone: order.transporter?.phone ?? null,
    transporterEmail: order.transporter?.email ?? null,
    vehiclePlate: order.vehicle?.licensePlate ?? null,
    driverName: order.driverName ?? null,
    contactName: order.contactName ?? null,
  };

  return { pdfDto, settings, names, order };
}

export const ordersService = {
  async findAll(dto: FindAllOrdersDtoType) {
    const { page, limit, search, status, clientId, transporterId, vehicleId, archived, dateFrom, dateTo, sortBy, sortOrder } = dto;
    const { skip, take } = paginate(page, limit);

    // Status filter: explicit status param → use it; otherwise no restriction
    const statusFilter: OrderStatus | undefined = status ? (status as OrderStatus) : undefined;

    const dateFilter =
      dateFrom || dateTo
        ? {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        }
        : undefined;

    const where = {
      archivedAt: archived === true ? { not: null } : null,
      ...(statusFilter !== undefined && { status: statusFilter }),
      ...(clientId && { clientId }),
      ...(transporterId && { transporterId }),
      ...(vehicleId && { vehicleId }),
      ...(dateFilter && { documentDate: dateFilter }),
      ...(search && {
        OR: [
          { orderNumber: { contains: search, mode: 'insensitive' as const } },
          { driverName: { contains: search, mode: 'insensitive' as const } },
          { clientOrderReference: { contains: search, mode: 'insensitive' as const } },
          { pickupAddress: { contains: search, mode: 'insensitive' as const } },
          { deliveryAddress: { contains: search, mode: 'insensitive' as const } },
          { pickupCountry: { contains: search, mode: 'insensitive' as const } },
          { deliveryCountry: { contains: search, mode: 'insensitive' as const } },
          { client: { name: { contains: search, mode: 'insensitive' as const } } },
          { transporter: { name: { contains: search, mode: 'insensitive' as const } } },
          { vehicle: { licensePlate: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    // Relation sort keys need nested Prisma syntax — map dot-notation to nested objects
    const dir = sortOrder ?? 'asc';
    const RELATION_SORT: Record<string, object> = {
      'client.name':      { client:      { name: dir } },
      'transporter.name': { transporter: { name: dir } },
    };
    const orderBy = sortBy
      ? (RELATION_SORT[sortBy] ?? { [sortBy]: dir })
      : { createdAt: 'desc' as const };

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy,
        include: ORDER_INCLUDE,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      items,
      ...buildPaginationMeta(total, page, limit),
    };
  },

  async archiveOldOrders(): Promise<{ archived: number }> {
    const settings = await settingsService.get();
    const months = settings.autoArchiveAfterMonths;

    if (months < 3) {
      throw new Error('Invalid archive window: minimum 3 months required');
    }

    let total = 0;
    let affected: number;

    do {
      affected = await prisma.$executeRaw`
        UPDATE orders
        SET "archivedAt" = NOW()
        WHERE id IN (
          SELECT id FROM orders
          WHERE "archivedAt" IS NULL
            AND status IN ('COMPLETED', 'CANCELLED')
            AND "finalizedAt" < NOW() - (${months} * INTERVAL '1 month')
          LIMIT 1000
        )
      `;
      total += affected;
    } while (affected > 0);

    await incrementOrdersVersion();
    logger.info({ archived: total }, 'archiveOldOrders: complete');
    return { archived: total };
  },

  async findOne(id: number) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        ...ORDER_INCLUDE,
        activityLogs: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  },

  async create(dto: CreateOrderDtoType, userId: number) {
    const series = dto.orderSeries ?? 'BGR';
    const settings = await settingsService.get();

    const order = await prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tx as typeof prisma, series, settings.orderNumberStart);

      return tx.order.create({
        data: {
          orderNumber,
          orderSeries: series,
          clientId: dto.clientId,
          transporterId: dto.transporterId,
          vehicleId: dto.vehicleId,
          driverName: dto.driverName,
          contactName: dto.contactName,
          clientOrderReference: dto.clientOrderReference,
          transporterReference: dto.transporterReference,
          intermediaryPartnerRef: dto.intermediaryPartnerRef,
          pickupAddress: dto.pickupAddress,
          pickupCountry: dto.pickupCountry,
          pickupDateBegin: toMinutePrecision(dto.pickupDateBegin),
          pickupDateEnd: toMinutePrecision(dto.pickupDateEnd),
          deliveryAddress: dto.deliveryAddress,
          deliveryCountry: dto.deliveryCountry,
          deliveryDateBegin: toMinutePrecision(dto.deliveryDateBegin),
          deliveryDateEnd: toMinutePrecision(dto.deliveryDateEnd),
          distanceKm: dto.distanceKm,
          transporterPrice: dto.transporterPrice,
          transporterCurrency: dto.transporterCurrency,
          clientPrice: dto.clientPrice,
          clientCurrency: dto.clientCurrency,
          cargoQuantity: dto.cargoQuantity,
          cargoDescription: dto.cargoDescription,
          cargoLengthCm: dto.cargoLengthCm,
          cargoWidthCm: dto.cargoWidthCm,
          cargoHeightCm: dto.cargoHeightCm,
          cargoWeightKg: dto.cargoWeightKg,
          cargoItemsJson: dto.cargoItems ? JSON.stringify(dto.cargoItems) : undefined,
          additionalPickupsJson: dto.additionalPickups ? JSON.stringify(dto.additionalPickups) : undefined,
          additionalDeliveriesJson: dto.additionalDeliveries ? JSON.stringify(dto.additionalDeliveries) : undefined,
          status: (dto.status as OrderStatus | undefined) ?? OrderStatus.DRAFT,
          notes: dto.notes,
          internalNotes: dto.internalNotes,
          documentDate: dto.documentDate ? toMinutePrecision(dto.documentDate)! : undefined,
          applyStamp: dto.applyStamp ?? false,
          createdById: userId,
        },
        include: ORDER_INCLUDE,
      });
    });

    await activityService.log(order.id, userId, `created order ${order.orderNumber}`);
    await incrementOrdersVersion();

    return order;
  },

  async update(id: number, dto: UpdateOrderDtoType, userId: number) {
    const existing = await ordersService.findOne(id);

    if (existing.archivedAt !== null) {
      throw new Error('Cannot edit an archived order');
    }

    const newStatus = dto.status as OrderStatus | undefined;
    const oldStatus = existing.status;

    // --- Status transition validation ---
    if (newStatus && newStatus !== oldStatus) {
      validateStatusTransition(oldStatus, newStatus);
    }

    // Build the effective order state (merge dto changes onto existing) for dispatch gate
    const effectiveVehicleId = dto.vehicleId !== undefined ? dto.vehicleId : existing.vehicleId;
    const effectiveTransporterId = dto.transporterId !== undefined ? dto.transporterId : existing.transporterId;
    const effectivePickupDateBegin = dto.pickupDateBegin !== undefined
      ? (dto.pickupDateBegin ? toMinutePrecision(dto.pickupDateBegin)! : null)
      : existing.pickupDateBegin;
    const effectiveDeliveryDateEnd = dto.deliveryDateEnd !== undefined
      ? (dto.deliveryDateEnd ? toMinutePrecision(dto.deliveryDateEnd)! : null)
      : existing.deliveryDateEnd;
    const effectivePickupDateEnd = dto.pickupDateEnd !== undefined
      ? (dto.pickupDateEnd ? toMinutePrecision(dto.pickupDateEnd)! : null)
      : existing.pickupDateEnd;
    const effectiveDeliveryDateBegin = dto.deliveryDateBegin !== undefined
      ? (dto.deliveryDateBegin ? toMinutePrecision(dto.deliveryDateBegin)! : null)
      : existing.deliveryDateBegin;
    const effectivePickupAddress = dto.pickupAddress !== undefined ? dto.pickupAddress : existing.pickupAddress;
    const effectiveDeliveryAddress = dto.deliveryAddress !== undefined ? dto.deliveryAddress : existing.deliveryAddress;

    // --- Dispatch gate: all transitions to IN_PROGRESS ---
    if (newStatus === OrderStatus.IN_PROGRESS) {
      await validateDispatchGate({
        id,
        vehicleId: effectiveVehicleId,
        transporterId: effectiveTransporterId,
        pickupDateBegin: effectivePickupDateBegin,
        pickupDateEnd: effectivePickupDateEnd,
        deliveryDateBegin: effectiveDeliveryDateBegin,
        deliveryDateEnd: effectiveDeliveryDateEnd,
        pickupAddress: effectivePickupAddress,
        deliveryAddress: effectiveDeliveryAddress,
      });
    }

    // --- Vehicle swap while IN_PROGRESS: validate new vehicle ---
    const isVehicleSwap = oldStatus === OrderStatus.IN_PROGRESS
      && dto.vehicleId !== undefined
      && dto.vehicleId !== existing.vehicleId
      && (!newStatus || newStatus === OrderStatus.IN_PROGRESS);

    if (isVehicleSwap && dto.vehicleId) {
      const newVehicle = await prisma.vehicle.findUnique({
        where: { id: dto.vehicleId },
        select: { licensePlate: true, status: true },
      });
      if (!newVehicle) {
        throw new Error('Cannot swap — new vehicle does not exist');
      }
      if (newVehicle.status !== VehicleStatus.AVAILABLE) {
        throw new Error(`Cannot swap — vehicle ${newVehicle.licensePlate} is not available`);
      }
    }

    // --- Atomic update: order + vehicle status sync ---
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: {
          ...(dto.clientId !== undefined && { clientId: dto.clientId }),
          ...(dto.transporterId !== undefined && { transporterId: dto.transporterId }),
          ...(dto.vehicleId !== undefined && { vehicleId: dto.vehicleId }),
          ...(dto.driverName !== undefined && { driverName: dto.driverName }),
          ...(dto.orderSeries !== undefined && { orderSeries: dto.orderSeries }),
          ...(dto.clientOrderReference !== undefined && { clientOrderReference: dto.clientOrderReference }),
          ...(dto.transporterReference !== undefined && { transporterReference: dto.transporterReference }),
          ...(dto.intermediaryPartnerRef !== undefined && { intermediaryPartnerRef: dto.intermediaryPartnerRef }),
          ...(dto.pickupAddress !== undefined && { pickupAddress: dto.pickupAddress }),
          ...(dto.pickupCountry !== undefined && { pickupCountry: dto.pickupCountry }),
          ...(dto.pickupDateBegin !== undefined && { pickupDateBegin: toMinutePrecision(dto.pickupDateBegin) }),
          ...(dto.pickupDateEnd !== undefined && { pickupDateEnd: toMinutePrecision(dto.pickupDateEnd) }),
          ...(dto.deliveryAddress !== undefined && { deliveryAddress: dto.deliveryAddress }),
          ...(dto.deliveryCountry !== undefined && { deliveryCountry: dto.deliveryCountry }),
          ...(dto.deliveryDateBegin !== undefined && { deliveryDateBegin: toMinutePrecision(dto.deliveryDateBegin) }),
          ...(dto.deliveryDateEnd !== undefined && { deliveryDateEnd: toMinutePrecision(dto.deliveryDateEnd) }),
          ...(dto.distanceKm !== undefined && { distanceKm: dto.distanceKm }),
          ...(dto.transporterPrice !== undefined && { transporterPrice: dto.transporterPrice }),
          ...(dto.transporterCurrency !== undefined && { transporterCurrency: dto.transporterCurrency }),
          ...(dto.clientPrice !== undefined && { clientPrice: dto.clientPrice }),
          ...(dto.clientCurrency !== undefined && { clientCurrency: dto.clientCurrency }),
          ...(dto.contactName !== undefined && { contactName: dto.contactName }),
          ...(dto.cargoQuantity !== undefined && { cargoQuantity: dto.cargoQuantity }),
          ...(dto.cargoDescription !== undefined && { cargoDescription: dto.cargoDescription }),
          ...(dto.cargoLengthCm !== undefined && { cargoLengthCm: dto.cargoLengthCm }),
          ...(dto.cargoWidthCm !== undefined && { cargoWidthCm: dto.cargoWidthCm }),
          ...(dto.cargoHeightCm !== undefined && { cargoHeightCm: dto.cargoHeightCm }),
          ...(dto.cargoWeightKg !== undefined && { cargoWeightKg: dto.cargoWeightKg }),
          ...(dto.cargoItems !== undefined && { cargoItemsJson: JSON.stringify(dto.cargoItems) }),
          ...(dto.additionalPickups !== undefined && { additionalPickupsJson: JSON.stringify(dto.additionalPickups) }),
          ...(dto.additionalDeliveries !== undefined && { additionalDeliveriesJson: JSON.stringify(dto.additionalDeliveries) }),
          ...(newStatus !== undefined && { status: newStatus }),
          ...((newStatus === OrderStatus.COMPLETED || newStatus === OrderStatus.CANCELLED) && {
            finalizedAt: new Date(),
          }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
          ...(dto.documentDate !== undefined && { documentDate: dto.documentDate ? toMinutePrecision(dto.documentDate)! : undefined }),
          ...(dto.applyStamp !== undefined && { applyStamp: dto.applyStamp }),
        },
        include: ORDER_INCLUDE,
      });

      // --- Auto-sync vehicle status ---
      if (newStatus && newStatus !== oldStatus) {
        // Dispatching → set vehicle ON_ROUTE
        if (newStatus === OrderStatus.IN_PROGRESS && effectiveVehicleId) {
          await tx.vehicle.update({
            where: { id: effectiveVehicleId },
            data: { status: VehicleStatus.ON_ROUTE },
          });
        }

        // Completed or cancelled from IN_PROGRESS → release vehicle only if no other active orders
        if (
          oldStatus === OrderStatus.IN_PROGRESS
          && (newStatus === OrderStatus.COMPLETED || newStatus === OrderStatus.CANCELLED)
          && existing.vehicleId
        ) {
          const activeCount = await tx.order.count({
            where: {
              vehicleId: existing.vehicleId,
              status: OrderStatus.IN_PROGRESS,
              id: { not: existing.id },
            },
          });
          if (activeCount === 0) {
            await tx.vehicle.update({
              where: { id: existing.vehicleId },
              data: { status: VehicleStatus.AVAILABLE },
            });
          }
        }
      }

      // Vehicle swap while IN_PROGRESS → release old (if no other active orders), claim new
      if (isVehicleSwap) {
        if (existing.vehicleId) {
          const otherActive = await tx.order.count({
            where: {
              vehicleId: existing.vehicleId,
              status: OrderStatus.IN_PROGRESS,
              id: { not: existing.id },
            },
          });
          if (otherActive === 0) {
            await tx.vehicle.update({
              where: { id: existing.vehicleId },
              data: { status: VehicleStatus.AVAILABLE },
            });
          }
        }
        if (dto.vehicleId) {
          await tx.vehicle.update({
            where: { id: dto.vehicleId },
            data: { status: VehicleStatus.ON_ROUTE },
          });
        }
      }

      return order;
    });

    if (newStatus && newStatus !== oldStatus) {
      await activityService.log(
        id,
        userId,
        `changed status of order ${existing.orderNumber} from ${oldStatus} to ${newStatus}`,
      );
    }

    // Log each changed field (13.M — Comprehensive Activity Log)
    const normalizeForLog = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'string') {
        // Only parse strings that look like ISO datetimes — prevents year-like numbers
        // (e.g. "1200") being treated as year 1200 AD by new Date()
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
          const d = new Date(val);
          return isNaN(d.getTime()) ? val : d.toISOString();
        }
        return val;
      }
      if (typeof val === 'number') return String(val);
      // Prisma Decimal and other objects: delegate to their toString()
      return String(val);
    };

    type ExistingOrder = typeof existing;
    const fieldsToLog: Array<{ key: keyof ExistingOrder; label: string }> = [
      { key: 'driverName', label: 'driver name' },
      { key: 'transporterPrice', label: 'transporter price' },
      { key: 'clientPrice', label: 'client price' },
      { key: 'distanceKm', label: 'distance' },
      { key: 'pickupAddress', label: 'pickup address' },
      { key: 'deliveryAddress', label: 'delivery address' },
      { key: 'pickupDateBegin', label: 'pickup date' },
      { key: 'deliveryDateBegin', label: 'delivery date' },
      { key: 'notes', label: 'notes' },
      { key: 'internalNotes', label: 'internal notes' },
    ];

    for (const { key, label } of fieldsToLog) {
      const oldVal = existing[key];
      const newVal = (dto as Record<string, unknown>)[key as string];
      if (newVal !== undefined && normalizeForLog(newVal) !== normalizeForLog(oldVal)) {
        await activityService.log(
          id,
          userId,
          `updated ${label}`,
          JSON.stringify({ field: label, oldValue: normalizeForLog(oldVal), newValue: normalizeForLog(newVal) }),
        );
      }
    }

    // Log additional address stop changes — count diff when count changes, address diff when content changes
    const logAddressStopDiff = async (
      label: string,
      oldJson: string | null,
      newStops: Array<{ address?: string; country?: string; dateBegin?: string }>,
    ) => {
      const newJson = JSON.stringify(newStops);
      if ((oldJson ?? '[]') === newJson) return;
      type Stop = { address?: string; country?: string; dateBegin?: string };
      const parseStops = (json: string): Stop[] => {
        try { return JSON.parse(json) as Stop[]; } catch { return []; }
      };
      const oldStops = parseStops(oldJson ?? '[]');
      const oldCount = oldStops.length;
      const newCount = newStops.length;
      if (oldCount !== newCount) {
        await activityService.log(
          id, userId, `updated ${label}`,
          JSON.stringify({ field: label, oldValue: `${oldCount} stop(s)`, newValue: `${newCount} stop(s)` }),
        );
        return;
      }
      // Same count — find first stop where address changed and log old → new
      for (let idx = 0; idx < newCount; idx++) {
        const oldAddr = oldStops[idx]?.address ?? '';
        const newAddr = newStops[idx]?.address ?? '';
        if (oldAddr !== newAddr) {
          await activityService.log(
            id, userId, `updated ${label}`,
            JSON.stringify({ field: label, oldValue: oldAddr || '—', newValue: newAddr || '—' }),
          );
          return;
        }
      }
      // Content changed but not the address text (e.g. country or date) — log without diff
      await activityService.log(id, userId, `updated ${label}`, undefined);
    };

    if (dto.additionalPickups !== undefined) {
      await logAddressStopDiff('additional pickups', existing.additionalPickupsJson, dto.additionalPickups);
    }
    if (dto.additionalDeliveries !== undefined) {
      await logAddressStopDiff('additional deliveries', existing.additionalDeliveriesJson, dto.additionalDeliveries);
    }

    // Log cargo items changes
    if (dto.cargoItems !== undefined) {
      const oldCargoJson = existing.cargoItemsJson ?? '[]';
      const newCargoJson = JSON.stringify(dto.cargoItems);
      if (oldCargoJson !== newCargoJson) {
        const parseCount = (json: string) => {
          try { return (JSON.parse(json) as unknown[]).length; } catch { return 0; }
        };
        const oldCount = parseCount(oldCargoJson);
        const newCount = parseCount(newCargoJson);
        await activityService.log(
          id,
          userId,
          `updated cargo items`,
          JSON.stringify({ field: 'cargo items', oldValue: `${oldCount} row(s)`, newValue: `${newCount} row(s)` }),
        );
      }
    }

    // Log relation changes by resolved name/plate (not raw ID)
    const relationChanges = [
      { label: 'client',      oldName: existing.client?.name,         newName: updatedOrder.client?.name },
      { label: 'transporter', oldName: existing.transporter?.name,     newName: updatedOrder.transporter?.name },
      { label: 'vehicle',     oldName: existing.vehicle?.licensePlate, newName: updatedOrder.vehicle?.licensePlate },
    ];
    for (const { label, oldName, newName } of relationChanges) {
      if ((oldName ?? '') !== (newName ?? '')) {
        await activityService.log(
          id,
          userId,
          `updated ${label}`,
          JSON.stringify({ field: label, oldValue: oldName ?? '', newValue: newName ?? '' }),
        );
      }
    }

    await incrementOrdersVersion();
    return updatedOrder;
  },

  async duplicate(id: number, userId: number) {
    const source = await ordersService.findOne(id);
    const series = source.orderSeries ?? 'BGR';

    const newOrder = await prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tx as typeof prisma, series);

      return tx.order.create({
        data: {
          orderNumber,
          orderSeries: series,
          clientId: source.clientId,
          transporterId: source.transporterId,
          // vehicle and driver are cleared on duplicate
          vehicleId: null,
          driverName: null,
          contactName: source.contactName,
          clientOrderReference: source.clientOrderReference,
          transporterReference: source.transporterReference,
          intermediaryPartnerRef: source.intermediaryPartnerRef,
          pickupAddress: source.pickupAddress,
          pickupCountry: source.pickupCountry,
          pickupDateBegin: toMinutePrecision(source.pickupDateBegin),
          pickupDateEnd: toMinutePrecision(source.pickupDateEnd),
          deliveryAddress: source.deliveryAddress,
          deliveryCountry: source.deliveryCountry,
          deliveryDateBegin: toMinutePrecision(source.deliveryDateBegin),
          deliveryDateEnd: toMinutePrecision(source.deliveryDateEnd),
          distanceKm: source.distanceKm,
          transporterPrice: source.transporterPrice,
          transporterCurrency: source.transporterCurrency,
          clientPrice: source.clientPrice,
          clientCurrency: source.clientCurrency,
          cargoQuantity: source.cargoQuantity,
          cargoDescription: source.cargoDescription,
          cargoLengthCm: source.cargoLengthCm,
          cargoWidthCm: source.cargoWidthCm,
          cargoHeightCm: source.cargoHeightCm,
          cargoWeightKg: source.cargoWeightKg,
          cargoItemsJson: source.cargoItemsJson,
          additionalPickupsJson: source.additionalPickupsJson,
          additionalDeliveriesJson: source.additionalDeliveriesJson,
          status: OrderStatus.DRAFT,
          notes: source.notes,
          internalNotes: source.internalNotes,
          createdById: userId,
        },
        include: ORDER_INCLUDE,
      });
    });

    await activityService.log(
      newOrder.id,
      userId,
      `duplicated from order ${source.orderNumber}`,
    );
    await incrementOrdersVersion();

    return newOrder;
  },

  async generatePreviewPdf(dto: CreateOrderDtoType) {
    const [settings, clientPartner, transporterPartner, vehicle] = await Promise.all([
      settingsService.get(),
      prisma.partner.findUnique({ where: { id: dto.clientId }, select: { name: true } }),
      dto.transporterId
        ? prisma.partner.findUnique({
          where: { id: dto.transporterId },
          select: { name: true, fiscalCode: true, addressLine1: true, phone: true, email: true },
        })
        : Promise.resolve(null),
      dto.vehicleId
        ? prisma.vehicle.findUnique({ where: { id: dto.vehicleId }, select: { licensePlate: true } })
        : Promise.resolve(null),
    ]);

    return generateCharteringAgreementPdf(dto, settings, {
      clientName: clientPartner?.name ?? 'Unknown Client',
      transporterName: transporterPartner?.name ?? null,
      transporterFiscalCode: transporterPartner?.fiscalCode ?? null,
      transporterAddress: transporterPartner?.addressLine1 ?? null,
      transporterPhone: transporterPartner?.phone ?? null,
      transporterEmail: transporterPartner?.email ?? null,
      vehiclePlate: vehicle?.licensePlate ?? null,
      driverName: dto.driverName ?? null,
      contactName: dto.contactName ?? null,
    });
  },

  async markAsSent(id: number, userId: number) {
    const { pdfDto, settings, names, order } = await buildPdfDtoFromOrder(id);

    if (!order.transporter?.email) throw new Error('Transporter has no email address');

    const pdfBuffer = await generateCharteringAgreementPdf(pdfDto, settings, names);

    await mailerService.sendOrderEmail(order.transporter.email, order.orderNumber, pdfBuffer, {
      vehiclePlate: names.vehiclePlate,
      driverName: names.driverName,
    });

    const updated = await prisma.order.update({
      where: { id },
      data: { isSent: true, sentAt: new Date() },
      include: ORDER_INCLUDE,
    });

    // MED-E: strip newlines/control chars from email to prevent log injection
    const safeEmail = order.transporter.email.replace(/[\r\n\t]/g, '');
    await activityService.log(
      id,
      userId,
      `sent order ${order.orderNumber} to ${order.transporter.name} (${safeEmail})`,
    );

    return updated;
  },

  async generateSavedOrderPdf(id: number) {
    const { pdfDto, settings, names, order } = await buildPdfDtoFromOrder(id);
    const pdfBuffer = await generateCharteringAgreementPdf(pdfDto, settings, names);
    return { pdfBuffer, orderNumber: order.orderNumber };
  },

  async remove(id: number) {
    const order = await prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new Error('Order not found');
    }

    // Block deletion of active orders — they must reach a final state first
    if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.IN_PROGRESS) {
      throw new Error('Order must be cancelled or completed before it can be deleted.');
    }

    // Hard delete — ActivityLog entries cascade automatically
    const deleted = await prisma.order.delete({ where: { id } });
    await incrementOrdersVersion();
    return deleted;
  },
};
