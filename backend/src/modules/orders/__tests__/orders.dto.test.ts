import { describe, it, expect } from 'vitest';
import {
  AddressStopSchema,
  CargoItemSchema,
  CreateOrderDto,
  UpdateOrderDto,
  FindAllOrdersDto,
  PatchOrderStatusDto,
} from '../orders.dto.js';

describe('CargoItemSchema', () => {
  it('parses a valid cargo item with all fields', () => {
    const result = CargoItemSchema.safeParse({
      qty: 2,
      description: 'Electronics',
      lengthCm: 120,
      widthCm: 80,
      heightCm: 60,
      weightKg: 500,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty cargo item — all fields optional', () => {
    const result = CargoItemSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects negative weightKg', () => {
    const result = CargoItemSchema.safeParse({ weightKg: -1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('weightKg');
  });
});

describe('CreateOrderDto', () => {
  it('parses with only clientId (minimum required)', () => {
    const result = CreateOrderDto.safeParse({ clientId: 1 });
    expect(result.success).toBe(true);
  });

  it('rejects missing clientId', () => {
    const result = CreateOrderDto.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('clientId');
  });

  it('rejects clientId of 0 (must be positive)', () => {
    const result = CreateOrderDto.safeParse({ clientId: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('clientId');
  });

  it('rejects invalid status enum', () => {
    const result = CreateOrderDto.safeParse({ clientId: 1, status: 'UNKNOWN' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('status');
  });

  it('parses a valid ISO datetime string for pickupDateBegin', () => {
    const result = CreateOrderDto.safeParse({
      clientId: 1,
      pickupDateBegin: '2026-01-01T08:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects date-only string for pickupDateBegin (must include time)', () => {
    const result = CreateOrderDto.safeParse({
      clientId: 1,
      pickupDateBegin: '2026-01-01',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('pickupDateBegin');
  });

  it('accepts cargoItems array', () => {
    const result = CreateOrderDto.safeParse({
      clientId: 1,
      cargoItems: [{ qty: 1, description: 'Pallets', weightKg: 1200 }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional financial fields', () => {
    const result = CreateOrderDto.safeParse({
      clientId: 1,
      transporterPrice: 1500,
      clientPrice: 2000,
      distanceKm: 500,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative transporterPrice', () => {
    const result = CreateOrderDto.safeParse({ clientId: 1, transporterPrice: -100 });
    expect(result.success).toBe(false);
  });

  it('accepts all valid statuses', () => {
    const statuses = ['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    for (const status of statuses) {
      const result = CreateOrderDto.safeParse({ clientId: 1, status });
      expect(result.success).toBe(true);
    }
  });

  it('accepts optional orderNumber for PDF preview', () => {
    const result = CreateOrderDto.safeParse({ clientId: 1, orderNumber: 'BGR315' });
    expect(result.success).toBe(true);
  });
});

describe('UpdateOrderDto', () => {
  it('allows empty partial update', () => {
    const result = UpdateOrderDto.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates clientId must be positive when provided', () => {
    const result = UpdateOrderDto.safeParse({ clientId: -5 });
    expect(result.success).toBe(false);
  });
});

describe('FindAllOrdersDto', () => {
  it('applies defaults for page, limit, and archived', () => {
    const result = FindAllOrdersDto.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(1);
    expect(result.data?.limit).toBe(20);
    expect(result.data?.archived).toBe(false);
  });

  it('coerces string page and limit to numbers', () => {
    const result = FindAllOrdersDto.safeParse({ page: '3', limit: '50' });
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(3);
    expect(result.data?.limit).toBe(50);
  });

  it('coerces string archived to boolean', () => {
    const result = FindAllOrdersDto.safeParse({ archived: 'true' });
    expect(result.success).toBe(true);
    expect(result.data?.archived).toBe(true);
  });

  it('rejects invalid status filter', () => {
    const result = FindAllOrdersDto.safeParse({ status: 'BAD_STATUS' });
    expect(result.success).toBe(false);
  });

  it('accepts sortBy and sortOrder params', () => {
    const result = FindAllOrdersDto.safeParse({ sortBy: 'createdAt', sortOrder: 'desc' });
    expect(result.success).toBe(true);
    expect(result.data?.sortBy).toBe('createdAt');
    expect(result.data?.sortOrder).toBe('desc');
  });

  it('rejects invalid sortOrder', () => {
    const result = FindAllOrdersDto.safeParse({ sortOrder: 'random' });
    expect(result.success).toBe(false);
  });
});

describe('PatchOrderStatusDto', () => {
  it('parses each valid status', () => {
    const statuses = ['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    for (const status of statuses) {
      const result = PatchOrderStatusDto.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    const result = PatchOrderStatusDto.safeParse({ status: 'DELIVERED' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('status');
  });

  it('rejects missing status', () => {
    const result = PatchOrderStatusDto.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('status');
  });
});

describe('AddressStopSchema', () => {
  it('accepts an empty object — all fields optional', () => {
    const result = AddressStopSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a fully populated stop', () => {
    const result = AddressStopSchema.safeParse({
      address: 'Str. Pickup 1, Timisoara',
      country: 'Romania',
      dateBegin: '2026-05-01T08:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects address longer than 500 characters', () => {
    const result = AddressStopSchema.safeParse({ address: 'A'.repeat(501) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('address');
  });

  it('rejects country longer than 100 characters', () => {
    const result = AddressStopSchema.safeParse({ country: 'C'.repeat(101) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('country');
  });

  it('rejects a date-only string for dateBegin (must include time)', () => {
    const result = AddressStopSchema.safeParse({ dateBegin: '2026-05-01' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('dateBegin');
  });
});

describe('CreateOrderDto — additional addresses and internalNotes', () => {
  it('accepts empty additionalPickups array', () => {
    const result = CreateOrderDto.safeParse({ clientId: 1, additionalPickups: [] });
    expect(result.success).toBe(true);
  });

  it('accepts additionalPickups with valid stops', () => {
    const result = CreateOrderDto.safeParse({
      clientId: 1,
      additionalPickups: [
        { address: 'Via Roma 1, Milano', country: 'Italy', dateBegin: '2026-05-02T09:00:00Z' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects additionalPickups with more than 20 entries', () => {
    const stops = Array.from({ length: 21 }, (_, i) => ({ address: `Stop ${i}` }));
    const result = CreateOrderDto.safeParse({ clientId: 1, additionalPickups: stops });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('additionalPickups');
  });

  it('accepts empty additionalDeliveries array', () => {
    const result = CreateOrderDto.safeParse({ clientId: 1, additionalDeliveries: [] });
    expect(result.success).toBe(true);
  });

  it('rejects additionalDeliveries with more than 20 entries', () => {
    const stops = Array.from({ length: 21 }, (_, i) => ({ address: `Stop ${i}` }));
    const result = CreateOrderDto.safeParse({ clientId: 1, additionalDeliveries: stops });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('additionalDeliveries');
  });

  it('accepts internalNotes within 1024 characters', () => {
    const result = CreateOrderDto.safeParse({ clientId: 1, internalNotes: 'Private note' });
    expect(result.success).toBe(true);
  });

  it('rejects internalNotes longer than 1024 characters', () => {
    const result = CreateOrderDto.safeParse({ clientId: 1, internalNotes: 'X'.repeat(1025) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('internalNotes');
  });
});
