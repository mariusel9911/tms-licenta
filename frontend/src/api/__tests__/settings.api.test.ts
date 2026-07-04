import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/api/client';
import {
  getSettings,
  updateSettings,
  uploadLogo,
  deleteLogo,
  uploadStamp,
  deleteStamp,
  testSmtpConnection,
} from '@/api/settings.api';
import type { AppSettings } from '@/types/settings.types';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const testSettings: AppSettings = {
  id: 1,
  companyName: 'Test SRL',
  companyVatCode: 'RO12345678',
  companyRegNumber: 'J01/123/2020',
  companyAddress: 'Str. Test 1',
  companyCity: 'Timisoara',
  companyCounty: 'Timis',
  companyIban: 'RO49AAAA1B31007593840000',
  companyBank: 'BCR',
  companySwift: 'RNCBROBU',
  companyLogoPath: null,
  companyStampPath: null,
  companyPhone: '+40712345678',
  companyEmail: 'company@test.ro',
  termsAndConditions: '',
  smartbillEmail: '',
  smartbillApiToken: '',
  smartbillSeriesName: 'BGR',
  smartbillVatCode: '',
  defaultVatPercent: '19',
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
  autoBackupEnabled: true,
  autoBackupRetainCount: 7,
  autoBackupFrequency: 'DAILY',
  autoBackupDay: null,
  autoBackupTime: '03:00',
  autoBackupDestination: 'both' as const,
  aiChatbotEnabled: true,
  aiPredictionEnabled: true,
  maintenanceEnabled: false,
  maintenanceMessage: '',
  rateLimitPerUser: 50,
  rateLimitEnabled: true,
  auditBackupEnabled: true,
  auditAuthEnabled: true,
  auditUserMgmtEnabled: true,
  auditSettingsEnabled: true,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('settings.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSettings() calls GET /settings and returns data', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: testSettings } });

    const result = await getSettings();

    expect(result).toEqual(testSettings);
    expect(mockGet).toHaveBeenCalledWith('/settings');
  });

  it('updateSettings() calls PUT /settings with the payload', async () => {
    const updated = { ...testSettings, companyName: 'Updated SRL' };
    mockPut.mockResolvedValue({ data: { success: true, data: updated } });

    const result = await updateSettings({ companyName: 'Updated SRL' });

    expect(result).toEqual(updated);
    expect(mockPut).toHaveBeenCalledWith('/settings', { companyName: 'Updated SRL' });
  });

  it('uploadLogo() calls POST /settings/logo with FormData', async () => {
    const withLogo = { ...testSettings, companyLogoPath: 'uploads/logos/company-logo.png' };
    mockPost.mockResolvedValue({ data: { success: true, data: withLogo } });

    const file = new File(['png-data'], 'logo.png', { type: 'image/png' });
    const result = await uploadLogo(file);

    expect(result).toEqual(withLogo);
    expect(mockPost).toHaveBeenCalledWith(
      '/settings/logo',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  });

  it('deleteLogo() calls DELETE /settings/logo', async () => {
    const noLogo = { ...testSettings, companyLogoPath: null };
    mockDelete.mockResolvedValue({ data: { success: true, data: noLogo } });

    const result = await deleteLogo();

    expect(result).toEqual(noLogo);
    expect(mockDelete).toHaveBeenCalledWith('/settings/logo');
  });

  it('uploadStamp() calls POST /settings/stamp with FormData', async () => {
    const withStamp = { ...testSettings, companyStampPath: 'uploads/stamps/company-stamp.png' };
    mockPost.mockResolvedValue({ data: { success: true, data: withStamp } });

    const file = new File(['png-data'], 'stamp.png', { type: 'image/png' });
    const result = await uploadStamp(file);

    expect(result).toEqual(withStamp);
    expect(mockPost).toHaveBeenCalledWith(
      '/settings/stamp',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  });

  it('deleteStamp() calls DELETE /settings/stamp', async () => {
    const noStamp = { ...testSettings, companyStampPath: null };
    mockDelete.mockResolvedValue({ data: { success: true, data: noStamp } });

    const result = await deleteStamp();

    expect(result).toEqual(noStamp);
    expect(mockDelete).toHaveBeenCalledWith('/settings/stamp');
  });

  it('testSmtpConnection() calls POST /settings/smtp/test and returns ok', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: { ok: true } } });

    const result = await testSmtpConnection();

    expect(result).toEqual({ ok: true });
    expect(mockPost).toHaveBeenCalledWith('/settings/smtp/test');
  });
});
