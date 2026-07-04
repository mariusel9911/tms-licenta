import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/__tests__/helpers/render';
import type { AppSettings } from '@/types/settings.types';

vi.mock('@/api/settings.api', () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  uploadLogo: vi.fn(),
  deleteLogo: vi.fn(),
  uploadStamp: vi.fn(),
  deleteStamp: vi.fn(),
}));

import { getSettings, updateSettings, uploadLogo, deleteLogo, uploadStamp, deleteStamp } from '@/api/settings.api';
import {
  useSettings,
  useUpdateSettings,
  useUploadLogo,
  useDeleteLogo,
  useUploadStamp,
  useDeleteStamp,
} from '../useSettings';

const mockGetSettings = vi.mocked(getSettings);
const mockUpdateSettings = vi.mocked(updateSettings);
const mockUploadLogo = vi.mocked(uploadLogo);
const mockDeleteLogo = vi.mocked(deleteLogo);
const mockUploadStamp = vi.mocked(uploadStamp);
const mockDeleteStamp = vi.mocked(deleteStamp);

const settings: AppSettings = {
  id: 1,
  companyName: 'Test Company SRL',
  companyVatCode: 'RO12345678',
  companyRegNumber: 'J01/123/2020',
  companyAddress: 'Str. Test 1',
  companyCity: 'Timisoara',
  companyCounty: 'Timis',
  companyIban: 'RO49AAAA1B31007593840000',
  companyBank: 'Test Bank',
  companySwift: 'TESTROBU',
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
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('useSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches app settings', async () => {
    mockGetSettings.mockResolvedValue(settings);

    const { result } = renderHookWithProviders(() => useSettings());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(settings);
    expect(mockGetSettings).toHaveBeenCalledTimes(1);
  });

  it('exposes error on fetch failure', async () => {
    mockGetSettings.mockRejectedValue(new Error('Network error'));

    const { result } = renderHookWithProviders(() => useSettings());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useUpdateSettings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateSettings API and invalidates settings cache', async () => {
    mockUpdateSettings.mockResolvedValue(settings);

    const { result, queryClient } = renderHookWithProviders(() => useUpdateSettings());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ companyName: 'Updated Company' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ companyName: 'Updated Company' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['settings'] });
  });
});

describe('useUploadLogo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls uploadLogo API with File and invalidates settings cache', async () => {
    const updatedSettings = { ...settings, companyLogoPath: 'uploads/logos/company-logo.png' };
    mockUploadLogo.mockResolvedValue(updatedSettings);

    const { result, queryClient } = renderHookWithProviders(() => useUploadLogo());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const file = new File(['content'], 'logo.png', { type: 'image/png' });

    await act(async () => {
      result.current.mutate(file);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUploadLogo).toHaveBeenCalledWith(file);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['settings'] });
  });
});

describe('useDeleteLogo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls deleteLogo API and invalidates settings cache', async () => {
    const updatedSettings = { ...settings, companyLogoPath: null };
    mockDeleteLogo.mockResolvedValue(updatedSettings);

    const { result, queryClient } = renderHookWithProviders(() => useDeleteLogo());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteLogo).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['settings'] });
  });
});

describe('useUploadStamp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls uploadStamp API with File and invalidates settings cache', async () => {
    const updatedSettings = { ...settings, companyStampPath: 'uploads/stamps/company-stamp.png' };
    mockUploadStamp.mockResolvedValue(updatedSettings);

    const { result, queryClient } = renderHookWithProviders(() => useUploadStamp());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const file = new File(['content'], 'stamp.png', { type: 'image/png' });

    await act(async () => {
      result.current.mutate(file);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUploadStamp).toHaveBeenCalledWith(file);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['settings'] });
  });
});

describe('useDeleteStamp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls deleteStamp API and invalidates settings cache', async () => {
    const updatedSettings = { ...settings, companyStampPath: null };
    mockDeleteStamp.mockResolvedValue(updatedSettings);

    const { result, queryClient } = renderHookWithProviders(() => useDeleteStamp());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteStamp).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['settings'] });
  });
});
