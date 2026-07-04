import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import { OrderStatus, VehicleStatus } from '../../../generated/client.js';

// Import shared mock first so it is initialized before the vi.mock factory is called
import { prismaMock } from '../../../__tests__/helpers/prisma-mock.js';

vi.mock('../../../config/database', () => ({
  prisma: prismaMock,
}));

vi.mock('../../activity/activity.service', () => ({
  activityService: {
    log: vi.fn(),
    findByOrder: vi.fn(),
  },
}));

vi.mock('../../settings/settings.service', () => ({
  settingsService: {
    get: vi.fn(),
    update: vi.fn(),
    updateLogoPath: vi.fn(),
  },
}));

vi.mock('../../../config/mailer.service', () => ({
  mailerService: {
    sendOrderEmail: vi.fn(),
  },
}));

vi.mock('../order-number.util', () => ({
  generateOrderNumber: vi.fn(),
}));

vi.mock('../order-pdf.service', () => ({
  generateCharteringAgreementPdf: vi.fn(),
}));

import { ordersService } from '../orders.service.js';
import { buildOrder, buildPartner, buildVehicle, buildAppSettings } from '../../../__tests__/helpers/factories.js';
import { activityService } from '../../activity/activity.service.js';
import { settingsService } from '../../settings/settings.service.js';
import { mailerService } from '../../../config/mailer.service.js';
import { generateOrderNumber } from '../order-number.util.js';
import { generateCharteringAgreementPdf } from '../order-pdf.service.js';

// Typed mock accessors
const activityLogMock = activityService as unknown as { log: ReturnType<typeof vi.fn> };
const settingsGetMock = settingsService as unknown as { get: ReturnType<typeof vi.fn> };
const mailerMock = mailerService as unknown as { sendOrderEmail: ReturnType<typeof vi.fn> };
const generateOrderNumberMock = generateOrderNumber as unknown as ReturnType<typeof vi.fn>;
const generatePdfMock = generateCharteringAgreementPdf as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

/** Order shaped like findOne() return (includes relations + activityLogs) */
function buildOrderFull(overrides: Partial<ReturnType<typeof buildOrder>> = {}) {
  return {
    ...buildOrder(overrides),
    client: { id: 1, name: 'Test Client SRL', country: 'Romania' },
    transporter: { id: 2, name: 'Transport SRL' },
    vehicle: { id: 1, licensePlate: 'TM01ABC' },
    activityLogs: [],
  };
}

/** Order shaped like markAsSent() findUnique return (inline includes) */
function buildOrderForSend(overrides: Partial<ReturnType<typeof buildOrder>> = {}) {
  return {
    ...buildOrder({ transporterId: 2, vehicleId: 1, ...overrides }),
    client: { name: 'Test Client SRL' },
    transporter: {
      name: 'Transport SRL',
      fiscalCode: 'RO99999999',
      addressLine1: 'Str. Transport 1',
      phone: '+40799999999',
      email: 'transport@test.ro',
    },
    vehicle: { licensePlate: 'TM01ABC' },
  };
}

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// findAll()
// ---------------------------------------------------------------------------

describe('ordersService.findAll()', () => {
  it('returns paginated items with default createdAt desc sort, archivedAt null', async () => {
    const orders = [buildOrderFull({ id: 1 }), buildOrderFull({ id: 2 })];
    prismaMock.order.findMany.mockResolvedValue(orders as never);
    prismaMock.order.count.mockResolvedValue(2);

    const result = await ordersService.findAll({ page: 1, limit: 20, archived: false });

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        where: expect.objectContaining({
          archivedAt: null,
        }),
      }),
    );
    expect(result.items).toEqual(orders);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('applies search filter across multiple text fields', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.count.mockResolvedValue(0);

    await ordersService.findAll({ page: 1, limit: 20, archived: false, search: 'test' });

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { orderNumber: { contains: 'test', mode: 'insensitive' } },
            { driverName: { contains: 'test', mode: 'insensitive' } },
            { client: { name: { contains: 'test', mode: 'insensitive' } } },
          ]),
        }),
      }),
    );
  });

  it('applies explicit status filter', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.count.mockResolvedValue(0);

    await ordersService.findAll({ page: 1, limit: 20, archived: false, status: OrderStatus.CONFIRMED });

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: OrderStatus.CONFIRMED }),
      }),
    );
  });

  it('shows archived orders with archivedAt: { not: null } and no status restriction when archived=true', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.count.mockResolvedValue(0);

    await ordersService.findAll({ page: 1, limit: 20, archived: true });

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: { not: null } }),
      }),
    );
    // No status filter in archive mode
    const callArg = prismaMock.order.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(callArg.where).not.toHaveProperty('status');
  });

  it('applies date range filter on documentDate', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.count.mockResolvedValue(0);

    await ordersService.findAll({
      page: 1,
      limit: 20,
      archived: false,
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documentDate: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-12-31'),
          },
        }),
      }),
    );
  });

  it('maps client.name sort key to nested Prisma syntax', async () => {
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.count.mockResolvedValue(0);

    await ordersService.findAll({ page: 1, limit: 20, archived: false, sortBy: 'client.name', sortOrder: 'asc' });

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { client: { name: 'asc' } },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// archiveOldOrders()
// ---------------------------------------------------------------------------

describe('ordersService.archiveOldOrders()', () => {
  beforeEach(() => {
    settingsGetMock.get.mockResolvedValue(buildAppSettings({ autoArchiveAfterMonths: 3 }));
  });

  it('runs batched $executeRaw and returns total archived count', async () => {
    // First batch: 5 rows; second batch: 0 → loop ends
    prismaMock.$executeRaw.mockResolvedValueOnce(5).mockResolvedValueOnce(0);

    const result = await ordersService.archiveOldOrders();

    expect(result).toEqual({ archived: 5 });
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2);
  });

  it('returns archived: 0 when no orders qualify', async () => {
    prismaMock.$executeRaw.mockResolvedValueOnce(0);

    const result = await ordersService.archiveOldOrders();

    expect(result).toEqual({ archived: 0 });
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('M37: throws when autoArchiveAfterMonths is less than 3', async () => {
    settingsGetMock.get.mockResolvedValue(buildAppSettings({ autoArchiveAfterMonths: 2 }));
    await expect(ordersService.archiveOldOrders())
      .rejects.toThrow('Invalid archive window: minimum 3 months required');
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// findOne()
// ---------------------------------------------------------------------------

describe('ordersService.findOne()', () => {
  it('returns order with relations when found', async () => {
    const order = buildOrderFull();
    prismaMock.order.findUnique.mockResolvedValue(order as never);

    const result = await ordersService.findOne(1);

    expect(prismaMock.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
    expect(result).toEqual(order);
  });

  it('throws "Order not found" when order does not exist', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(ordersService.findOne(999)).rejects.toThrow('Order not found');
  });
});

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

describe('ordersService.create()', () => {
  it('generates order number inside transaction and logs activity', async () => {
    const settings = buildAppSettings({ orderNumberStart: 5 });
    settingsGetMock.get.mockResolvedValue(settings);
    generateOrderNumberMock.mockResolvedValue('BGR5');

    const createdOrder = buildOrderFull({ id: 10, orderNumber: 'BGR5' });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.order.create.mockResolvedValue(createdOrder as never);

    const result = await ordersService.create({ clientId: 1, orderSeries: 'BGR' }, 1);

    expect(settingsGetMock.get).toHaveBeenCalled();
    expect(generateOrderNumberMock).toHaveBeenCalledWith(prismaMock, 'BGR', 5);
    expect(prismaMock.order.create).toHaveBeenCalled();
    expect(activityLogMock.log).toHaveBeenCalledWith(10, 1, 'created order BGR5');
    expect(result).toEqual(createdOrder);
  });
});

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

describe('ordersService.update()', () => {
  beforeEach(() => {
    // update() wraps order.update in a $transaction — execute the callback with prismaMock as tx
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
  });

  it('logs status change when status differs from existing', async () => {
    const existing = buildOrderFull({ status: OrderStatus.DRAFT });
    const updated = { ...existing, status: OrderStatus.CONFIRMED };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(updated as never);

    await ordersService.update(1, { status: OrderStatus.CONFIRMED }, 1);

    expect(activityLogMock.log).toHaveBeenCalledWith(
      1,
      1,
      expect.stringContaining('changed status of order'),
    );
  });

  it('does NOT log status change when status is the same', async () => {
    const existing = buildOrderFull({ status: OrderStatus.DRAFT });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(existing as never);

    await ordersService.update(1, { status: OrderStatus.DRAFT }, 1);

    const statusCalls = activityLogMock.log.mock.calls.filter((c: unknown[]) =>
      typeof c[2] === 'string' && c[2].includes('changed status'),
    );
    expect(statusCalls).toHaveLength(0);
  });

  it('logs driverName field change with old and new values', async () => {
    const existing = buildOrderFull({ driverName: 'Old Driver' });
    const updated = { ...existing, driverName: 'New Driver' };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(updated as never);

    await ordersService.update(1, { driverName: 'New Driver' }, 1);

    expect(activityLogMock.log).toHaveBeenCalledWith(
      1,
      1,
      'updated driver name',
      JSON.stringify({ field: 'driver name', oldValue: 'Old Driver', newValue: 'New Driver' }),
    );
  });

  it('does NOT log date field change when ISO date value is unchanged', async () => {
    const isoDate = '2026-02-01T08:00:00.000Z';
    const existing = buildOrderFull({ pickupDateBegin: new Date(isoDate) });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(existing as never);

    await ordersService.update(1, { pickupDateBegin: isoDate }, 1);

    // Should NOT have logged 'updated pickup date'
    const dateChangeCalls = activityLogMock.log.mock.calls.filter((c: unknown[]) =>
      typeof c[2] === 'string' && c[2] === 'updated pickup date',
    );
    expect(dateChangeCalls).toHaveLength(0);
  });

  it('logs relation change when client name differs', async () => {
    const existing = {
      ...buildOrderFull(),
      client: { id: 1, name: 'Old Client SRL', country: 'Romania' },
    };
    const updated = {
      ...existing,
      client: { id: 3, name: 'New Client SRL', country: 'Romania' },
    };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(updated as never);

    await ordersService.update(1, { clientId: 3 }, 1);

    expect(activityLogMock.log).toHaveBeenCalledWith(
      1,
      1,
      'updated client',
      JSON.stringify({ field: 'client', oldValue: 'Old Client SRL', newValue: 'New Client SRL' }),
    );
  });

  // -------------------------------------------------------------------------
  // M37 — Archive immutability + terminal state lock + finalizedAt
  // -------------------------------------------------------------------------

  it('M37: throws when trying to update an archived order', async () => {
    const existing = buildOrderFull({ archivedAt: new Date() });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    await expect(ordersService.update(1, { driverName: 'Test' }, 1))
      .rejects.toThrow('Cannot edit an archived order');
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it('M37: throws when transitioning out of COMPLETED status', async () => {
    const existing = buildOrderFull({ status: OrderStatus.COMPLETED, archivedAt: null });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    await expect(ordersService.update(1, { status: OrderStatus.DRAFT }, 1))
      .rejects.toThrow(/Cannot transition from COMPLETED/);
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it('M37: throws when transitioning out of CANCELLED status', async () => {
    const existing = buildOrderFull({ status: OrderStatus.CANCELLED, archivedAt: null });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    await expect(ordersService.update(1, { status: OrderStatus.CONFIRMED }, 1))
      .rejects.toThrow(/Cannot transition from CANCELLED/);
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it('M37: sets finalizedAt when transitioning to COMPLETED', async () => {
    const existing = buildOrderFull({ status: OrderStatus.IN_PROGRESS, vehicleId: 10, archivedAt: null });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue({ ...existing, status: OrderStatus.COMPLETED } as never);
    prismaMock.order.count.mockResolvedValue(0);
    await ordersService.update(1, { status: OrderStatus.COMPLETED }, 1);
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ finalizedAt: expect.any(Date) }) }),
    );
  });

  it('M37: sets finalizedAt when transitioning to CANCELLED', async () => {
    const existing = buildOrderFull({ status: OrderStatus.IN_PROGRESS, vehicleId: 10, archivedAt: null });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue({ ...existing, status: OrderStatus.CANCELLED } as never);
    prismaMock.order.count.mockResolvedValue(0);
    await ordersService.update(1, { status: OrderStatus.CANCELLED }, 1);
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ finalizedAt: expect.any(Date) }) }),
    );
  });

  it('M37: blocks dispatch when vehicle is INACTIVE', async () => {
    const existing = buildOrderFull({
      status: OrderStatus.CONFIRMED,
      vehicleId: 1,
      transporterId: 2,
      deliveryDateEnd: new Date('2026-02-03T18:00:00Z'),
    });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.vehicle.findUnique.mockResolvedValue({
      licensePlate: 'TM01ABC',
      status: VehicleStatus.INACTIVE,
    } as never);
    await expect(ordersService.update(1, { status: OrderStatus.IN_PROGRESS }, 1)).rejects.toThrow(/inactive/i);
  });

  // -------------------------------------------------------------------------
  // BF-11 — Dispatch gate applies to all →IN_PROGRESS transitions + address check
  // -------------------------------------------------------------------------

  it('BF-11: blocks DRAFT → IN_PROGRESS when addresses are missing', async () => {
    const existing = buildOrderFull({
      status: OrderStatus.DRAFT,
      vehicleId: 1,
      transporterId: 2,
      pickupAddress: null,
      deliveryAddress: null,
    });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    await expect(ordersService.update(1, { status: OrderStatus.IN_PROGRESS }, 1))
      .rejects.toThrow('pickup and delivery addresses are required');
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it('BF-11: blocks DRAFT → IN_PROGRESS when vehicle is not assigned', async () => {
    const existing = buildOrderFull({ status: OrderStatus.DRAFT, vehicleId: null, transporterId: 2 });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    await expect(ordersService.update(1, { status: OrderStatus.IN_PROGRESS }, 1))
      .rejects.toThrow('no vehicle assigned');
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  it('BF-11: blocks CONFIRMED → IN_PROGRESS when addresses are missing', async () => {
    const existing = buildOrderFull({
      status: OrderStatus.CONFIRMED,
      vehicleId: 1,
      transporterId: 2,
      pickupAddress: null,
      deliveryAddress: null,
    });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    await expect(ordersService.update(1, { status: OrderStatus.IN_PROGRESS }, 1))
      .rejects.toThrow('pickup and delivery addresses are required');
    expect(prismaMock.order.update).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // M32 — Multiple Orders per Vehicle
  // -------------------------------------------------------------------------

  it('M32: allows dispatch when vehicle is ON_ROUTE (not just AVAILABLE)', async () => {
    const existing = buildOrderFull({
      status: OrderStatus.CONFIRMED,
      vehicleId: 1,
      transporterId: 2,
      deliveryDateEnd: new Date('2026-02-03T18:00:00Z'),
    });
    const updated = { ...existing, status: OrderStatus.IN_PROGRESS };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.vehicle.findUnique.mockResolvedValue({
      licensePlate: 'TM01ABC',
      status: VehicleStatus.ON_ROUTE,
    } as never);
    prismaMock.order.update.mockResolvedValue(updated as never);

    await expect(ordersService.update(1, { status: OrderStatus.IN_PROGRESS }, 1)).resolves.toBeDefined();
  });

  it('M32: blocks dispatch when vehicle is MAINTENANCE', async () => {
    const existing = buildOrderFull({
      status: OrderStatus.CONFIRMED,
      vehicleId: 1,
      transporterId: 2,
      deliveryDateEnd: new Date('2026-02-03T18:00:00Z'),
    });
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.vehicle.findUnique.mockResolvedValue({
      licensePlate: 'TM01ABC',
      status: VehicleStatus.MAINTENANCE,
    } as never);

    await expect(ordersService.update(1, { status: OrderStatus.IN_PROGRESS }, 1)).rejects.toThrow(
      'currently in maintenance',
    );
  });

  it('M32: vehicle stays ON_ROUTE when another IN_PROGRESS order uses the same vehicle', async () => {
    const existing = buildOrderFull({
      id: 1,
      status: OrderStatus.IN_PROGRESS,
      vehicleId: 10,
    });
    const updated = { ...existing, status: OrderStatus.COMPLETED };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(updated as never);
    prismaMock.order.count.mockResolvedValue(1); // another active order on same vehicle

    await ordersService.update(1, { status: OrderStatus.COMPLETED }, 1);

    expect(prismaMock.vehicle.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: VehicleStatus.AVAILABLE } }),
    );
  });

  it('M32: vehicle goes AVAILABLE when last IN_PROGRESS order on it completes', async () => {
    const existing = buildOrderFull({
      id: 1,
      status: OrderStatus.IN_PROGRESS,
      vehicleId: 10,
    });
    const updated = { ...existing, status: OrderStatus.COMPLETED };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(updated as never);
    prismaMock.order.count.mockResolvedValue(0); // no other active orders

    await ordersService.update(1, { status: OrderStatus.COMPLETED }, 1);

    expect(prismaMock.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: { status: VehicleStatus.AVAILABLE },
      }),
    );
  });

  it('M32: does not release old vehicle on swap when it still has other IN_PROGRESS orders', async () => {
    const existing = buildOrderFull({
      id: 1,
      status: OrderStatus.IN_PROGRESS,
      vehicleId: 10,
    });
    const updated = { ...existing, vehicleId: 20 };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    // new vehicle is AVAILABLE for the swap validation
    prismaMock.vehicle.findUnique.mockResolvedValue({
      licensePlate: 'TM02XYZ',
      status: VehicleStatus.AVAILABLE,
    } as never);
    prismaMock.order.update.mockResolvedValue(updated as never);
    prismaMock.order.count.mockResolvedValue(1); // another active order on old vehicle

    await ordersService.update(1, { vehicleId: 20 }, 1);

    expect(prismaMock.vehicle.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: { status: VehicleStatus.AVAILABLE },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// create() — additional addresses and internalNotes
// ---------------------------------------------------------------------------

describe('ordersService.create() — additional addresses & internalNotes', () => {
  it('serializes additionalPickups and additionalDeliveries to JSON', async () => {
    const settings = buildAppSettings({ orderNumberStart: 1 });
    settingsGetMock.get.mockResolvedValue(settings);
    generateOrderNumberMock.mockResolvedValue('BGR1');

    const createdOrder = buildOrderFull({ id: 1, orderNumber: 'BGR1' });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.order.create.mockResolvedValue(createdOrder as never);

    const pickups = [{ address: 'Loading 2', country: 'Spain' }];
    const deliveries = [{ address: 'Delivery 2', country: 'Germany' }];
    await ordersService.create(
      { clientId: 1, additionalPickups: pickups, additionalDeliveries: deliveries },
      1,
    );

    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          additionalPickupsJson: JSON.stringify(pickups),
          additionalDeliveriesJson: JSON.stringify(deliveries),
        }),
      }),
    );
  });

  it('persists internalNotes on create', async () => {
    const settings = buildAppSettings({ orderNumberStart: 1 });
    settingsGetMock.get.mockResolvedValue(settings);
    generateOrderNumberMock.mockResolvedValue('BGR1');

    const createdOrder = buildOrderFull({ id: 1, orderNumber: 'BGR1' });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.order.create.mockResolvedValue(createdOrder as never);

    await ordersService.create({ clientId: 1, internalNotes: 'Private note' }, 1);

    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ internalNotes: 'Private note' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update() — additional addresses and internalNotes activity logging
// ---------------------------------------------------------------------------

describe('ordersService.update() — additional addresses & internalNotes', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
  });

  it('logs additional-pickups count diff when stops change', async () => {
    const existing = buildOrderFull({ additionalPickupsJson: '[]' });
    const updated = { ...existing };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(updated as never);

    const newPickups = [{ address: 'Stop A' }, { address: 'Stop B' }];
    await ordersService.update(1, { additionalPickups: newPickups }, 1);

    const logCalls = activityLogMock.log.mock.calls as unknown[][];
    const additionalPickupsLog = logCalls.find((c) => (c[2] as string).includes('additional pickups'));
    expect(additionalPickupsLog).toBeDefined();
    expect(additionalPickupsLog![3]).toContain('0 stop(s)');
    expect(additionalPickupsLog![3]).toContain('2 stop(s)');
  });

  it('logs internalNotes change when value differs', async () => {
    const existing = buildOrderFull({ internalNotes: 'old note' });
    const updated = { ...existing, internalNotes: 'new note' };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(updated as never);

    await ordersService.update(1, { internalNotes: 'new note' }, 1);

    const logCalls = activityLogMock.log.mock.calls as unknown[][];
    const notesLog = logCalls.find((c) => (c[2] as string).includes('internal notes'));
    expect(notesLog).toBeDefined();
  });

  it('does NOT change dispatch-gate behaviour when only additional stops change', async () => {
    const existing = buildOrderFull({ status: OrderStatus.DRAFT });
    const updated = { ...existing };
    prismaMock.order.findUnique.mockResolvedValue(existing as never);
    prismaMock.order.update.mockResolvedValue(updated as never);

    // Should not throw — dispatch gate only runs on IN_PROGRESS transition
    await expect(
      ordersService.update(1, { additionalPickups: [{ address: 'X' }] }, 1),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// duplicate()
// ---------------------------------------------------------------------------

describe('ordersService.duplicate()', () => {
  it('clears vehicle and driver, sets DRAFT status, logs activity', async () => {
    const source = buildOrderFull({
      id: 1,
      orderNumber: 'BGR1',
      vehicleId: 5,
      driverName: 'Some Driver',
      status: OrderStatus.CONFIRMED,
    });
    generateOrderNumberMock.mockResolvedValue('BGR2');

    const newOrder = buildOrderFull({ id: 2, orderNumber: 'BGR2', vehicleId: null, driverName: null });
    prismaMock.order.findUnique.mockResolvedValue(source as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.order.create.mockResolvedValue(newOrder as never);

    const result = await ordersService.duplicate(1, 1);

    // vehicleId and driverName must be cleared on the create call
    expect(prismaMock.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vehicleId: null,
          driverName: null,
          status: OrderStatus.DRAFT,
        }),
      }),
    );
    expect(activityLogMock.log).toHaveBeenCalledWith(
      2,
      1,
      expect.stringContaining('duplicated from order BGR1'),
    );
    expect(result).toEqual(newOrder);
  });
});

// ---------------------------------------------------------------------------
// remove()
// ---------------------------------------------------------------------------

describe('ordersService.remove()', () => {
  it('hard-deletes a DRAFT order', async () => {
    const order = buildOrder({ status: OrderStatus.DRAFT });
    prismaMock.order.findUnique.mockResolvedValue(order as never);
    prismaMock.order.delete.mockResolvedValue(order as never);

    await ordersService.remove(1);

    expect(prismaMock.order.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('throws for CONFIRMED/IN_PROGRESS orders (must reach final state)', async () => {
    const order = buildOrder({ status: OrderStatus.CONFIRMED, archivedAt: null });
    prismaMock.order.findUnique.mockResolvedValue(order as never);

    await expect(ordersService.remove(1)).rejects.toThrow(
      'Order must be cancelled or completed before it can be deleted.',
    );
    expect(prismaMock.order.delete).not.toHaveBeenCalled();
  });

  it('hard-deletes a COMPLETED order', async () => {
    const order = buildOrder({ status: OrderStatus.COMPLETED, archivedAt: null });
    prismaMock.order.findUnique.mockResolvedValue(order as never);
    prismaMock.order.delete.mockResolvedValue(order as never);

    await ordersService.remove(1);

    expect(prismaMock.order.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('hard-deletes an archived order', async () => {
    const order = buildOrder({ status: OrderStatus.COMPLETED, archivedAt: new Date() });
    prismaMock.order.findUnique.mockResolvedValue(order as never);
    prismaMock.order.delete.mockResolvedValue(order as never);

    await ordersService.remove(1);

    expect(prismaMock.order.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});

// ---------------------------------------------------------------------------
// markAsSent()
// ---------------------------------------------------------------------------

describe('ordersService.markAsSent()', () => {
  it('throws "Order not found" when order does not exist', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(ordersService.markAsSent(999, 1)).rejects.toThrow('Order not found');
  });

  it('resends order when already sent (overwrites isSent and sentAt)', async () => {
    const order = buildOrderForSend({ id: 1, orderNumber: 'BGR1', isSent: true, sentAt: new Date('2026-01-01') });
    prismaMock.order.findUnique.mockResolvedValue(order as never);

    const settings = buildAppSettings();
    settingsGetMock.get.mockResolvedValue(settings);

    const pdfBuffer = Buffer.from('PDF_CONTENT');
    generatePdfMock.mockResolvedValue(pdfBuffer);
    mailerMock.sendOrderEmail.mockResolvedValue(undefined);

    const sentOrder = { ...buildOrderFull({ id: 1 }), isSent: true };
    prismaMock.order.update.mockResolvedValue(sentOrder as never);

    await ordersService.markAsSent(1, 1);

    expect(mailerMock.sendOrderEmail).toHaveBeenCalledWith('transport@test.ro', 'BGR1', pdfBuffer, {
      vehiclePlate: 'TM01ABC',
      driverName: null,
    });
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ isSent: true }),
      }),
    );
  });

  it('throws "Transporter has no email address" when transporter email is missing', async () => {
    const order = {
      ...buildOrderForSend(),
      transporter: {
        name: 'Transport SRL',
        fiscalCode: null,
        addressLine1: null,
        phone: null,
        email: null,
      },
    };
    prismaMock.order.findUnique.mockResolvedValue(order as never);

    await expect(ordersService.markAsSent(1, 1)).rejects.toThrow(
      'Transporter has no email address',
    );
  });

  it('generates PDF, sends email, marks isSent=true, and logs activity on success', async () => {
    const order = buildOrderForSend({ id: 1, orderNumber: 'BGR1' });
    prismaMock.order.findUnique.mockResolvedValue(order as never);

    const settings = buildAppSettings();
    settingsGetMock.get.mockResolvedValue(settings);

    const pdfBuffer = Buffer.from('PDF_CONTENT');
    generatePdfMock.mockResolvedValue(pdfBuffer);
    mailerMock.sendOrderEmail.mockResolvedValue(undefined);

    const sentOrder = { ...buildOrderFull({ id: 1 }), isSent: true };
    prismaMock.order.update.mockResolvedValue(sentOrder as never);

    await ordersService.markAsSent(1, 1);

    // Verify PDF was generated
    expect(generatePdfMock).toHaveBeenCalled();

    // Verify email was sent to transporter with vehicle/driver meta
    expect(mailerMock.sendOrderEmail).toHaveBeenCalledWith(
      'transport@test.ro',
      'BGR1',
      pdfBuffer,
      { vehiclePlate: 'TM01ABC', driverName: null },
    );

    // Verify isSent + sentAt updated
    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ isSent: true }),
      }),
    );

    // Verify activity log
    expect(activityLogMock.log).toHaveBeenCalledWith(
      1,
      1,
      expect.stringContaining('sent order BGR1'),
    );
  });
});

// ---------------------------------------------------------------------------
// generateSavedOrderPdf()
// ---------------------------------------------------------------------------

describe('ordersService.generateSavedOrderPdf()', () => {
  it('returns PDF buffer and orderNumber for an existing order', async () => {
    const order = buildOrderForSend({ id: 1, orderNumber: 'BGR1' });
    prismaMock.order.findUnique.mockResolvedValue(order as never);

    const settings = buildAppSettings();
    settingsGetMock.get.mockResolvedValue(settings);

    const pdfBuffer = Buffer.from('PDF_CONTENT');
    generatePdfMock.mockResolvedValue(pdfBuffer);

    const result = await ordersService.generateSavedOrderPdf(1);

    expect(result.pdfBuffer).toBe(pdfBuffer);
    expect(result.orderNumber).toBe('BGR1');
    expect(generatePdfMock).toHaveBeenCalled();
  });

  it('throws "Order not found" when order does not exist', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(ordersService.generateSavedOrderPdf(999)).rejects.toThrow('Order not found');
  });
});

// ---------------------------------------------------------------------------
// Additional branch coverage tests
// ---------------------------------------------------------------------------

describe('ordersService.remove() — missing branches', () => {
  it('throws "Order not found" when order does not exist', async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    await expect(ordersService.remove(999)).rejects.toThrow('Order not found');
    expect(prismaMock.order.delete).not.toHaveBeenCalled();
  });
});

describe('ordersService.generatePreviewPdf() — optional fields branch', () => {
  it('resolves null for transporter and vehicle when IDs are omitted', async () => {
    const settings = buildAppSettings();
    settingsGetMock.get.mockResolvedValue(settings);
    // Only clientId set — no transporterId or vehicleId
    prismaMock.partner.findUnique.mockResolvedValue(buildPartner({ name: 'Client SRL' }) as never);
    const pdfBuf = Buffer.from('%PDF-MOCK');
    generatePdfMock.mockResolvedValue(pdfBuf);

    const result = await ordersService.generatePreviewPdf({
      clientId: 1,
      documentDate: new Date(),
    } as never);

    expect(result).toBe(pdfBuf);
    // transporterId and vehicleId were absent → prisma called only once (for client)
    expect(prismaMock.partner.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.vehicle.findUnique).not.toHaveBeenCalled();
  });
});
