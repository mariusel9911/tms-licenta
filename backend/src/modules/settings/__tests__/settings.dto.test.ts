import { describe, it, expect } from 'vitest';
import { UpdateSettingsDto } from '../settings.dto.js';

describe('UpdateSettingsDto', () => {
  it('accepts an empty object — all fields are optional', () => {
    const result = UpdateSettingsDto.safeParse({});
    expect(result.success).toBe(true);
  });

  it('parses a valid full settings payload', () => {
    const result = UpdateSettingsDto.safeParse({
      companyName: 'Test SRL',
      companyVatCode: 'RO12345678',
      companyEmail: 'contact@test.ro',
      companyPhone: '+40712345678',
      defaultVatPercent: 19,
      orderNumberStart: 100,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpEnabled: true,
    });
    expect(result.success).toBe(true);
    expect(result.data?.defaultVatPercent).toBe(19);
    expect(result.data?.orderNumberStart).toBe(100);
  });

  it('rejects defaultVatPercent below 0', () => {
    const result = UpdateSettingsDto.safeParse({ defaultVatPercent: -1 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('defaultVatPercent');
  });

  it('rejects defaultVatPercent above 100', () => {
    const result = UpdateSettingsDto.safeParse({ defaultVatPercent: 101 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('defaultVatPercent');
  });

  it('rejects orderNumberStart below 1', () => {
    const result = UpdateSettingsDto.safeParse({ orderNumberStart: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('orderNumberStart');
  });

  it('rejects smtpPort above 65535', () => {
    const result = UpdateSettingsDto.safeParse({ smtpPort: 65536 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('smtpPort');
  });

  it('rejects autoArchiveTime with invalid hours (25:00)', () => {
    const result = UpdateSettingsDto.safeParse({ autoArchiveTime: '25:00' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('autoArchiveTime');
  });

  it('rejects autoArchiveTime with invalid minutes (:99)', () => {
    const result = UpdateSettingsDto.safeParse({ autoArchiveTime: '23:99' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('autoArchiveTime');
  });

  it('accepts valid autoArchiveTime (02:30)', () => {
    const result = UpdateSettingsDto.safeParse({ autoArchiveTime: '02:30' });
    expect(result.success).toBe(true);
  });

  it('rejects autoArchiveFrequency with invalid value', () => {
    const result = UpdateSettingsDto.safeParse({ autoArchiveFrequency: 'HOURLY' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('autoArchiveFrequency');
  });

  it('rejects autoBackupTime with invalid hours (25:00)', () => {
    const result = UpdateSettingsDto.safeParse({ autoBackupTime: '25:99' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('autoBackupTime');
  });
});
