import { describe, it, expect } from 'vitest';
import { CreatePartnerDto, UpdatePartnerDto, FindAllPartnersDto } from '../partners.dto.js';

const validPartner = {
  partnerType: 'CLIENT' as const,
  fiscalCode: 'RO12345678',
  name: 'Test SRL',
  country: 'Romania',
  addressLine1: 'Str. Test 1',
  phone: '+40712345678',
  email: 'test@company.ro',
  contactPerson: 'Ion Popescu',
};

describe('CreatePartnerDto', () => {
  it('parses valid partner with all required fields', () => {
    const result = CreatePartnerDto.safeParse(validPartner);
    expect(result.success).toBe(true);
  });

  it('rejects empty fiscalCode', () => {
    const result = CreatePartnerDto.safeParse({ ...validPartner, fiscalCode: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('fiscalCode');
  });

  it('rejects empty name', () => {
    const result = CreatePartnerDto.safeParse({ ...validPartner, name: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('name');
  });

  it('rejects empty country', () => {
    const result = CreatePartnerDto.safeParse({ ...validPartner, country: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('country');
  });

  it('rejects empty addressLine1', () => {
    const result = CreatePartnerDto.safeParse({ ...validPartner, addressLine1: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('addressLine1');
  });

  it('rejects empty phone', () => {
    const result = CreatePartnerDto.safeParse({ ...validPartner, phone: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('phone');
  });

  it('rejects invalid email format', () => {
    const result = CreatePartnerDto.safeParse({ ...validPartner, email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('email');
  });

  it('rejects empty contactPerson', () => {
    const result = CreatePartnerDto.safeParse({ ...validPartner, contactPerson: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('contactPerson');
  });

  it('accepts optional fields alongside required ones', () => {
    const result = CreatePartnerDto.safeParse({
      ...validPartner,
      registrationNumber: 'J35/1/2020',
      paymentTermDays: 30,
      pricePerKm: 2.5,
      bankName: 'ING',
      iban: 'RO49AAAA1B31007593840000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid partnerType', () => {
    const result = CreatePartnerDto.safeParse({ ...validPartner, partnerType: 'INVALID' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('partnerType');
  });

  it('accepts BOTH as partnerType', () => {
    const result = CreatePartnerDto.safeParse({ ...validPartner, partnerType: 'BOTH' });
    expect(result.success).toBe(true);
  });
});

describe('UpdatePartnerDto', () => {
  it('allows empty object — all fields are optional', () => {
    const result = UpdatePartnerDto.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates email when provided', () => {
    const result = UpdatePartnerDto.safeParse({ email: 'bad-email' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('email');
  });

  it('accepts partial update with just name', () => {
    const result = UpdatePartnerDto.safeParse({ name: 'Updated Name SRL' });
    expect(result.success).toBe(true);
  });
});

describe('FindAllPartnersDto', () => {
  it('applies defaults for missing page and limit', () => {
    const result = FindAllPartnersDto.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(1);
    expect(result.data?.limit).toBe(20);
  });

  it('coerces string page and limit to numbers', () => {
    const result = FindAllPartnersDto.safeParse({ page: '2', limit: '50' });
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(2);
    expect(result.data?.limit).toBe(50);
  });

  it('accepts optional partnerType filter', () => {
    const result = FindAllPartnersDto.safeParse({ partnerType: 'TRANSPORTER' });
    expect(result.success).toBe(true);
    expect(result.data?.partnerType).toBe('TRANSPORTER');
  });

  it('rejects invalid partnerType filter', () => {
    const result = FindAllPartnersDto.safeParse({ partnerType: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });
});
