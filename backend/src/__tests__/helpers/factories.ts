/**
 * Test data factories — produce realistic mock objects shaped like Prisma model returns.
 * Each factory accepts optional overrides so tests can customise specific fields.
 *
 * Decimal fields: Prisma returns Decimal objects; for mocked unit tests we use plain
 * string representations (e.g., "100.00") which is the common serialised form.
 * Cast with `as unknown as Model` where needed.
 */

import type { User, Partner, Vehicle, Order, ActivityLog, AppSettings } from '../../generated/client.js';
import { UserRole, PartnerType, VehicleStatus, OrderStatus } from '../../generated/client.js';

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'test@tms.ro',
    passwordHash: '$2a$12$hashedpassword',
    name: 'Test User',
    role: UserRole.ADMIN,
    isActive: true,
    totpSecret: null,
    totpEnabled: false,
    emailOtpEnabled: false,
    currentChallenge: null,
    loginFailures: 0,
    lockedUntil: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildDispatcher(overrides: Partial<User> = {}): User {
  return buildUser({ id: 2, email: 'dispatcher@tms.ro', name: 'Dispatcher', role: UserRole.DISPATCHER, ...overrides });
}

// ---------------------------------------------------------------------------
// Partner
// ---------------------------------------------------------------------------

export function buildPartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: 1,
    partnerType: PartnerType.CLIENT,
    fiscalCode: 'RO12345678',
    registrationNumber: 'J01/123/2020',
    name: 'Test Partner SRL',
    addressLine1: 'Str. Test 1',
    addressLine2: null,
    city: 'Timisoara',
    zipCode: '300001',
    country: 'Romania',
    phone: '+40712345678',
    email: 'partner@test.ro',
    contactPerson: 'Ion Popescu',
    pricePerKm: null as unknown as Partner['pricePerKm'],
    paymentTermDays: 30,
    delegateName: null,
    poReference: null,
    specialConditions: null,
    additionalHeader: null,
    bankName: null,
    iban: null,
    receiveAllSms: false,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function buildTransporter(overrides: Partial<Partner> = {}): Partner {
  return buildPartner({
    id: 2,
    partnerType: PartnerType.TRANSPORTER,
    name: 'Transport SRL',
    email: 'transport@test.ro',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Vehicle
// ---------------------------------------------------------------------------

export function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    licensePlate: 'TM01ABC',
    vin: 'WBA12345678901234',
    make: 'Mercedes',
    model: 'Actros',
    yearOfManufacture: 2020,
    emissionsStandard: 'Euro 6',
    axles: 3,
    category: 'TIR',
    fuelType: null,
    lengthCm: null as unknown as Vehicle['lengthCm'],
    widthCm: null as unknown as Vehicle['widthCm'],
    heightCm: null as unknown as Vehicle['heightCm'],
    maxLoadingCapacityKg: null as unknown as Vehicle['maxLoadingCapacityKg'],
    tankCapacityLitres: null as unknown as Vehicle['tankCapacityLitres'],
    consumptionPer100km: null as unknown as Vehicle['consumptionPer100km'],
    consumptionRecording: null,
    ratePerKm: null as unknown as Vehicle['ratePerKm'],
    partnerId: null,
    status: VehicleStatus.AVAILABLE,
    notes: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    orderNumber: 'BGR1',
    orderSeries: 'BGR',
    clientOrderReference: null,
    transporterReference: null,
    intermediaryPartnerRef: null,
    clientId: 1,
    transporterId: null,
    vehicleId: null,
    createdById: 1,
    driverName: null,
    contactName: null,
    pickupAddress: 'Str. Pickup 1, Timisoara',
    pickupCountry: 'Romania',
    pickupDateBegin: new Date('2026-02-01T08:00:00Z'),
    pickupDateEnd: null,
    deliveryAddress: 'Str. Delivery 1, Bucuresti',
    deliveryCountry: 'Romania',
    deliveryDateBegin: new Date('2026-02-02T08:00:00Z'),
    deliveryDateEnd: null,
    distanceKm: null as unknown as Order['distanceKm'],
    transporterPrice: null as unknown as Order['transporterPrice'],
    transporterCurrency: 'EUR',
    clientPrice: null as unknown as Order['clientPrice'],
    clientCurrency: 'EUR',
    cargoQuantity: null,
    cargoDescription: null,
    cargoLengthCm: null as unknown as Order['cargoLengthCm'],
    cargoWidthCm: null as unknown as Order['cargoWidthCm'],
    cargoHeightCm: null as unknown as Order['cargoHeightCm'],
    cargoWeightKg: null as unknown as Order['cargoWeightKg'],
    cargoItemsJson: null,
    additionalPickupsJson: null,
    additionalDeliveriesJson: null,
    status: OrderStatus.DRAFT,
    notes: null,
    internalNotes: null,
    documentDate: new Date('2026-01-01T00:00:00Z'),
    isSent: false,
    sentAt: null,
    applyStamp: false,
    finalizedAt: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ActivityLog
// ---------------------------------------------------------------------------

export function buildActivityLog(overrides: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: 1,
    orderId: 1,
    userId: 1,
    action: 'created order',
    details: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AppSettings
// ---------------------------------------------------------------------------

export function buildAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    id: 1,
    companyName: 'Test Company SRL',
    companyVatCode: 'RO12345678',
    companyRegNumber: 'J35/123/2020',
    companyAddress: 'Str. Test 1',
    companyCity: 'Timisoara',
    companyCounty: 'Timis',
    companyIban: '',
    companyBank: '',
    companySwift: '',
    companyLogoPath: null,
    companyStampPath: null,
    companyPhone: '+40712345678',
    companyEmail: 'contact@company.ro',
    termsAndConditions: '',
    smartbillEmail: '',
    smartbillApiToken: '',
    smartbillSeriesName: '',
    smartbillVatCode: '',
    defaultVatPercent: null as unknown as AppSettings['defaultVatPercent'],
    defaultCurrency: 'EUR',
    defaultPaymentDays: 30,
    orderNumberStart: 1,
    smtpEmail: '',
    smtpPassword: '',
    smtpHost: '',
    smtpPort: 587,
    smtpEnabled: false,
    smtpSecure: false,
    autoArchiveEnabled: true,
    autoArchiveAfterMonths: 3,
    autoArchiveFrequency: 'DAILY',
    autoArchiveDay: null,
    autoArchiveTime: '02:00',
    ordersVersion: 0,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
