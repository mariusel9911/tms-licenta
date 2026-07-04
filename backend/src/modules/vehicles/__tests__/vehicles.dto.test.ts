import { describe, it, expect } from 'vitest';
import { CreateVehicleDto, UpdateVehicleDto, FindAllVehiclesDto } from '../vehicles.dto.js';

describe('CreateVehicleDto', () => {
  it('parses with only licensePlate (required field)', () => {
    const result = CreateVehicleDto.safeParse({ licensePlate: 'TM01ABC' });
    expect(result.success).toBe(true);
  });

  it('rejects empty licensePlate', () => {
    const result = CreateVehicleDto.safeParse({ licensePlate: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('licensePlate');
  });

  it('rejects missing licensePlate', () => {
    const result = CreateVehicleDto.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('licensePlate');
  });

  it('rejects invalid fuelType enum value', () => {
    const result = CreateVehicleDto.safeParse({ licensePlate: 'TM01ABC', fuelType: 'NUCLEAR' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('fuelType');
  });

  it('rejects invalid status enum value', () => {
    const result = CreateVehicleDto.safeParse({ licensePlate: 'TM01ABC', status: 'FLYING' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('status');
  });

  it('rejects invalid consumptionRecording enum value', () => {
    const result = CreateVehicleDto.safeParse({ licensePlate: 'TM01ABC', consumptionRecording: 'GPS' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid optional fields', () => {
    const result = CreateVehicleDto.safeParse({
      licensePlate: 'TM01ABC',
      vin: 'WBA1234567890',
      make: 'Mercedes',
      model: 'Actros',
      yearOfManufacture: 2020,
      emissionsStandard: 'Euro 6',
      axles: 3,
      category: 'TIR',
      fuelType: 'DIESEL',
      status: 'AVAILABLE',
      partnerId: 1,
      notes: 'Some notes',
    });
    expect(result.success).toBe(true);
  });
});

describe('UpdateVehicleDto', () => {
  it('allows empty object — all fields optional', () => {
    const result = UpdateVehicleDto.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with just status', () => {
    const result = UpdateVehicleDto.safeParse({ status: 'MAINTENANCE' });
    expect(result.success).toBe(true);
  });
});

describe('FindAllVehiclesDto', () => {
  it('applies defaults for missing page and limit', () => {
    const result = FindAllVehiclesDto.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(1);
    expect(result.data?.limit).toBe(20);
  });

  it('coerces string page and limit to numbers', () => {
    const result = FindAllVehiclesDto.safeParse({ page: '2', limit: '50' });
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(2);
  });

  it('rejects invalid status filter', () => {
    const result = FindAllVehiclesDto.safeParse({ status: 'PARKED' });
    expect(result.success).toBe(false);
  });

  it('accepts valid status filter', () => {
    const result = FindAllVehiclesDto.safeParse({ status: 'ON_ROUTE' });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe('ON_ROUTE');
  });
});
