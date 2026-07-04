import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/__tests__/helpers/render';

vi.mock('@/api/auth.api', () => ({
  getMfaStatusApi: vi.fn(),
  setupMfaApi: vi.fn(),
  confirmMfaApi: vi.fn(),
  disableMfaApi: vi.fn(),
  loginApi: vi.fn(),
  verifyMfaApi: vi.fn(),
  getRecoveryCodeCountApi: vi.fn(),
  regenerateRecoveryCodesApi: vi.fn(),
  listPasskeysApi: vi.fn(),
  removePasskeyApi: vi.fn(),
  renamePasskeyApi: vi.fn(),
  requestEmailOtpApi: vi.fn(),
}));

import {
  getMfaStatusApi,
  setupMfaApi,
  confirmMfaApi,
  disableMfaApi,
  getRecoveryCodeCountApi,
  regenerateRecoveryCodesApi,
  listPasskeysApi,
  removePasskeyApi,
  renamePasskeyApi,
  requestEmailOtpApi,
} from '@/api/auth.api';
import {
  useMfaStatus,
  useSetupMfa,
  useConfirmMfa,
  useDisableMfa,
  useRecoveryCodeCount,
  useRegenerateRecoveryCodes,
  usePasskeys,
  useRemovePasskey,
  useRenamePasskey,
  useRequestEmailOtp,
} from '../useAuth';

const mockGetMfaStatusApi = vi.mocked(getMfaStatusApi);
const mockSetupMfaApi = vi.mocked(setupMfaApi);
const mockConfirmMfaApi = vi.mocked(confirmMfaApi);
const mockDisableMfaApi = vi.mocked(disableMfaApi);
const mockGetRecoveryCodeCountApi = vi.mocked(getRecoveryCodeCountApi);
const mockListPasskeysApi = vi.mocked(listPasskeysApi);
const mockRemovePasskeyApi = vi.mocked(removePasskeyApi);
const mockRenamePasskeyApi = vi.mocked(renamePasskeyApi);
const mockRegenerateRecoveryCodesApi = vi.mocked(regenerateRecoveryCodesApi);
const mockRequestEmailOtpApi = vi.mocked(requestEmailOtpApi);

describe('useMfaStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches MFA status', async () => {
    mockGetMfaStatusApi.mockResolvedValue({ totpEnabled: false, emailOtpEnabled: false });

    const { result } = renderHookWithProviders(() => useMfaStatus());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ totpEnabled: false, emailOtpEnabled: false });
    expect(mockGetMfaStatusApi).toHaveBeenCalledTimes(1);
  });

  it('returns totpEnabled: true when MFA is enabled', async () => {
    mockGetMfaStatusApi.mockResolvedValue({ totpEnabled: true, emailOtpEnabled: false });

    const { result } = renderHookWithProviders(() => useMfaStatus());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ totpEnabled: true, emailOtpEnabled: false });
  });

  it('exposes error on fetch failure', async () => {
    mockGetMfaStatusApi.mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHookWithProviders(() => useMfaStatus());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useSetupMfa', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls setupMfaApi with password and returns QR data', async () => {
    const mfaSetupData = { qrCodeDataUrl: 'data:image/png;base64,MOCK' };
    mockSetupMfaApi.mockResolvedValue(mfaSetupData);

    const { result } = renderHookWithProviders(() => useSetupMfa());

    await act(async () => {
      result.current.mutate('password123');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSetupMfaApi).toHaveBeenCalledWith('password123');
    expect(result.current.data).toEqual(mfaSetupData);
  });

  it('does not invalidate any cache (no onSuccess handler)', async () => {
    mockSetupMfaApi.mockResolvedValue({ qrCodeDataUrl: 'data:image/png;base64,MOCK' });

    const { result, queryClient } = renderHookWithProviders(() => useSetupMfa());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate('password123');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe('useConfirmMfa', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls confirmMfaApi with TOTP code and invalidates mfa-status + recovery-code-count', async () => {
    const codes = ['AAAA-BBBB-CCCC'];
    mockConfirmMfaApi.mockResolvedValue({ recoveryCodes: codes });

    const { result, queryClient } = renderHookWithProviders(() => useConfirmMfa());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate('123456');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockConfirmMfaApi).toHaveBeenCalledWith('123456');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'mfa-status'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'recovery-code-count'] });
  });
});

describe('useDisableMfa', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls disableMfaApi with password and invalidates mfa-status cache', async () => {
    mockDisableMfaApi.mockResolvedValue(undefined);

    const { result, queryClient } = renderHookWithProviders(() => useDisableMfa());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate('password123');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDisableMfaApi).toHaveBeenCalledWith('password123');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'mfa-status'] });
  });
});

describe('useRecoveryCodeCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches remaining recovery code count', async () => {
    mockGetRecoveryCodeCountApi.mockResolvedValue({ remaining: 8 });

    const { result } = renderHookWithProviders(() => useRecoveryCodeCount());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ remaining: 8 });
    expect(mockGetRecoveryCodeCountApi).toHaveBeenCalledTimes(1);
  });
});

describe('useRegenerateRecoveryCodes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls regenerateRecoveryCodesApi and invalidates recovery-code-count on success', async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `CODE-${i}`);
    mockRegenerateRecoveryCodesApi.mockResolvedValue({ recoveryCodes: codes });

    const { result, queryClient } = renderHookWithProviders(() => useRegenerateRecoveryCodes());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate('password123');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRegenerateRecoveryCodesApi).toHaveBeenCalledWith('password123');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'recovery-code-count'] });
  });
});

describe('usePasskeys', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches passkey list', async () => {
    const passkeys = [{ id: 'pk-1', deviceName: 'My Key', createdAt: '2026-01-01T00:00:00Z' }];
    mockListPasskeysApi.mockResolvedValue(passkeys);

    const { result } = renderHookWithProviders(() => usePasskeys());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(passkeys);
    expect(mockListPasskeysApi).toHaveBeenCalledTimes(1);
  });
});

describe('useRemovePasskey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls removePasskeyApi and invalidates passkeys cache on success', async () => {
    mockRemovePasskeyApi.mockResolvedValue(undefined);

    const { result, queryClient } = renderHookWithProviders(() => useRemovePasskey());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate('pk-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRemovePasskeyApi).toHaveBeenCalledWith('pk-1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'passkeys'] });
  });
});

describe('useRenamePasskey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls renamePasskeyApi and invalidates passkeys cache on success', async () => {
    const updated = { id: 'pk-1', deviceName: 'New Name', createdAt: '2026-01-01T00:00:00Z' };
    mockRenamePasskeyApi.mockResolvedValue(updated);

    const { result, queryClient } = renderHookWithProviders(() => useRenamePasskey());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ id: 'pk-1', deviceName: 'New Name' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRenamePasskeyApi).toHaveBeenCalledWith('pk-1', 'New Name');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'passkeys'] });
  });
});

describe('useRequestEmailOtp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls requestEmailOtpApi with mfaToken and returns expiresAt', async () => {
    const expiresAt = '2026-03-12T12:10:00.000Z';
    mockRequestEmailOtpApi.mockResolvedValue({ expiresAt });

    const { result } = renderHookWithProviders(() => useRequestEmailOtp());

    await act(async () => {
      result.current.mutate('mfa-pending-token');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRequestEmailOtpApi).toHaveBeenCalledWith('mfa-pending-token');
    expect(result.current.data).toEqual({ expiresAt });
  });
});
