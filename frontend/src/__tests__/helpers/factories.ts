/**
 * Frontend test data factories.
 * Uses frontend types (from src/types/) NOT Prisma types.
 * Decimal fields are strings (as received from the JSON API).
 */

import type { Partner } from '@/types/partner.types';
import type { Vehicle } from '@/types/vehicle.types';
import type { Order, OrderPartnerRef, OrderVehicleRef } from '@/types/order.types';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface TestAuthUser {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'DISPATCHER';
  isSystemAdmin: boolean;
}

export function buildAuthUser(overrides: Partial<TestAuthUser> = {}): TestAuthUser {
  return {
    id: 1,
    email: 'admin@tms.ro',
    name: 'Admin User',
    role: 'ADMIN',
    isSystemAdmin: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Partner
// ---------------------------------------------------------------------------

export function buildPartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: 1,
    partnerType: 'CLIENT',
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
    pricePerKm: null,
    paymentTermDays: 30,
    delegateName: null,
    poReference: null,
    specialConditions: null,
    additionalHeader: null,
    bankName: null,
    iban: null,
    receiveAllSms: false,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildTransporter(overrides: Partial<Partner> = {}): Partner {
  return buildPartner({
    id: 2,
    partnerType: 'TRANSPORTER',
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
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    maxLoadingCapacityKg: null,
    tankCapacityLitres: null,
    consumptionPer100km: null,
    consumptionRecording: null,
    ratePerKm: null,
    partnerId: null,
    partner: null,
    status: 'AVAILABLE',
    notes: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
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
    client: { id: 1, name: 'Test Partner SRL', country: 'Romania' } satisfies OrderPartnerRef,
    transporterId: null,
    transporter: null,
    vehicleId: null,
    vehicle: null satisfies OrderVehicleRef | null,
    createdById: 1,
    driverName: null,
    contactName: null,
    pickupAddress: 'Str. Pickup 1, Timisoara',
    pickupCountry: 'Romania',
    pickupDateBegin: '2026-02-01T08:00:00.000Z',
    pickupDateEnd: null,
    deliveryAddress: 'Str. Delivery 1, Bucuresti',
    deliveryCountry: 'Romania',
    deliveryDateBegin: '2026-02-02T08:00:00.000Z',
    deliveryDateEnd: null,
    distanceKm: null,
    transporterPrice: null,
    transporterCurrency: 'EUR',
    clientPrice: null,
    clientCurrency: 'EUR',
    cargoQuantity: null,
    cargoDescription: null,
    cargoLengthCm: null,
    cargoWidthCm: null,
    cargoHeightCm: null,
    cargoWeightKg: null,
    cargoItemsJson: null,
    additionalPickupsJson: null,
    additionalDeliveriesJson: null,
    internalNotes: null,
    status: 'DRAFT',
    notes: null,
    documentDate: '2026-01-01T00:00:00.000Z',
    isSent: false,
    sentAt: null,
    applyStamp: false,
    finalizedAt: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
