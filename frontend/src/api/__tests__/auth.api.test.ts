import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from '@/api/client';
import {
  loginApi,
  verifyMfaApi,
  getMfaStatusApi,
  setupMfaApi,
  confirmMfaApi,
  disableMfaApi,
  getRecoveryCodeCountApi,
  regenerateRecoveryCodesApi,
  getPasskeyRegistrationOptionsApi,
  verifyPasskeyRegistrationApi,
  getPasskeyAuthenticationOptionsApi,
  listPasskeysApi,
  removePasskeyApi,
  renamePasskeyApi,
  getPasskeyLoginOptionsApi,
  verifyPasskeyLoginApi,
  requestEmailOtpApi,
} from '@/api/auth.api';

const mockPost = vi.mocked(apiClient.post);
const mockGet = vi.mocked(apiClient.get);
const mockDelete = vi.mocked(apiClient.delete);
const mockPatch = vi.mocked(apiClient.patch);

const testUser = { id: 1, email: 'admin@tms.ro', name: 'Admin', role: 'ADMIN' as const, isSystemAdmin: false };

function makeAxiosError(message: string, status: number, errorMsg: string) {
  return new axios.AxiosError(message, String(status), undefined, undefined, {
    status,
    data: { error: errorMsg },
    statusText: 'Error',
    headers: {},
    config: {} as never,
  });
}

describe('auth.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loginApi()', () => {
    it('returns token + user on success', async () => {
      const loginData = { token: 'jwt-token', user: testUser };
      mockPost.mockResolvedValue({ data: { success: true, data: loginData } });

      const result = await loginApi('admin@tms.ro', 'password');

      expect(result).toEqual(loginData);
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@tms.ro',
        password: 'password',
      });
    });

    it('returns mfaRequired + mfaToken when MFA is enabled', async () => {
      const mfaData = { mfaRequired: true, mfaToken: 'mfa-token-xyz' };
      mockPost.mockResolvedValue({ data: { success: true, data: mfaData } });

      const result = await loginApi('mfa@test.ro', 'password');

      expect(result).toEqual(mfaData);
    });

    it('throws LoginApiError with backend message on axios error', async () => {
      mockPost.mockRejectedValue(makeAxiosError('Unauthorized', 401, 'Invalid credentials'));

      await expect(loginApi('bad@test.ro', 'wrong')).rejects.toEqual(
        expect.objectContaining({ code: 'Invalid credentials' }),
      );
    });

    it('throws LoginApiError with code "unknown" when no axios error data', async () => {
      mockPost.mockRejectedValue(new Error('Network error'));

      await expect(loginApi('a@b.com', 'pw')).rejects.toEqual(
        expect.objectContaining({ code: 'unknown' }),
      );
    });
  });

  describe('verifyMfaApi()', () => {
    it('returns login response on valid TOTP code', async () => {
      const successData = { token: 'full-token', user: testUser };
      mockPost.mockResolvedValue({ data: { success: true, data: successData } });

      const result = await verifyMfaApi('mfa-pending-token', { totpCode: '123456' });

      expect(result).toEqual(successData);
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/verify', {
        mfaToken: 'mfa-pending-token',
        totpCode: '123456',
      });
    });

    it('returns login response on valid recovery code', async () => {
      const successData = { token: 'full-token', user: testUser };
      mockPost.mockResolvedValue({ data: { success: true, data: successData } });

      const result = await verifyMfaApi('mfa-pending-token', { recoveryCode: 'ABCD-1234-EF56' });

      expect(result).toEqual(successData);
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/verify', {
        mfaToken: 'mfa-pending-token',
        recoveryCode: 'ABCD-1234-EF56',
      });
    });

    it('throws Error on invalid code', async () => {
      mockPost.mockRejectedValue(makeAxiosError('Forbidden', 403, 'recovery_code_invalid'));

      await expect(verifyMfaApi('token', { recoveryCode: 'XXXX-XXXX-XXXX' })).rejects.toThrow('recovery_code_invalid');
    });
  });

  describe('getMfaStatusApi()', () => {
    it('returns totpEnabled status', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: { totpEnabled: true } } });

      const result = await getMfaStatusApi();

      expect(result).toEqual({ totpEnabled: true });
      expect(mockGet).toHaveBeenCalledWith('/auth/mfa/status');
    });
  });

  describe('setupMfaApi()', () => {
    it('returns qrCodeDataUrl on success', async () => {
      const setupData = { qrCodeDataUrl: 'data:image/png;base64,...' };
      mockPost.mockResolvedValue({ data: { success: true, data: setupData } });

      const result = await setupMfaApi('my-password');

      expect(result).toEqual(setupData);
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/setup', { password: 'my-password' });
    });
  });

  describe('confirmMfaApi()', () => {
    it('returns recoveryCodes on success', async () => {
      const codes = ['AAAA-BBBB-CCCC', 'DDDD-EEEE-FFFF'];
      mockPost.mockResolvedValue({ data: { success: true, data: { recoveryCodes: codes } } });

      const result = await confirmMfaApi('123456');

      expect(result).toEqual({ recoveryCodes: codes });
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/confirm', { totpCode: '123456' });
    });
  });

  describe('disableMfaApi()', () => {
    it('resolves without value on success', async () => {
      mockPost.mockResolvedValue({ data: { success: true } });

      await expect(disableMfaApi('my-password')).resolves.toBeUndefined();
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/disable', { password: 'my-password' });
    });
  });

  describe('getRecoveryCodeCountApi()', () => {
    it('returns remaining count', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: { remaining: 8 } } });

      const result = await getRecoveryCodeCountApi();

      expect(result).toEqual({ remaining: 8 });
      expect(mockGet).toHaveBeenCalledWith('/auth/mfa/recovery-codes/count');
    });
  });

  describe('regenerateRecoveryCodesApi()', () => {
    it('returns new recovery codes on success', async () => {
      const codes = Array.from({ length: 10 }, (_, i) => `CODE-${i}`);
      mockPost.mockResolvedValue({ data: { success: true, data: { recoveryCodes: codes } } });

      const result = await regenerateRecoveryCodesApi('my-password');

      expect(result).toEqual({ recoveryCodes: codes });
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/recovery-codes/regenerate', {
        password: 'my-password',
      });
    });

    it('throws error with backend message on wrong password', async () => {
      mockPost.mockRejectedValue(makeAxiosError('Unauthorized', 401, 'wrong_password'));

      await expect(regenerateRecoveryCodesApi('bad')).rejects.toThrow('wrong_password');
    });
  });

  // ─── Passkeys / WebAuthn (M20) ─────────────────────────────────────────────

  const mockPasskey = { id: 'pk-1', deviceName: 'Touch ID', createdAt: '2026-03-12T00:00:00Z' };

  describe('getPasskeyRegistrationOptionsApi()', () => {
    it('returns WebAuthn registration options', async () => {
      const options = { challenge: 'abc123', rp: { name: 'TMS' } };
      mockGet.mockResolvedValue({ data: { success: true, data: options } });

      const result = await getPasskeyRegistrationOptionsApi();

      expect(result).toEqual(options);
      expect(mockGet).toHaveBeenCalledWith('/auth/mfa/passkey/register/options');
    });
  });

  describe('verifyPasskeyRegistrationApi()', () => {
    it('returns created passkey on success', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: mockPasskey } });

      const body = { id: 'cred-id', response: {} };
      const result = await verifyPasskeyRegistrationApi(body, 'Touch ID');

      expect(result).toEqual(mockPasskey);
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/passkey/register/verify', {
        ...body,
        deviceName: 'Touch ID',
      });
    });

    it('omits deviceName when not provided', async () => {
      mockPost.mockResolvedValue({ data: { success: true, data: mockPasskey } });

      const body = { id: 'cred-id', response: {} };
      await verifyPasskeyRegistrationApi(body);

      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/passkey/register/verify', {
        ...body,
        deviceName: undefined,
      });
    });

    it('throws backend error message on failure', async () => {
      mockPost.mockRejectedValue(makeAxiosError('Bad Request', 400, 'registration_failed'));

      await expect(verifyPasskeyRegistrationApi({})).rejects.toThrow('registration_failed');
    });

    it('throws "unknown" for non-Axios errors', async () => {
      mockPost.mockRejectedValue(new Error('network failure'));

      await expect(verifyPasskeyRegistrationApi({})).rejects.toThrow('unknown');
    });
  });

  describe('getPasskeyAuthenticationOptionsApi()', () => {
    it('returns authentication options for given mfaToken', async () => {
      const options = { challenge: 'xyz', allowCredentials: [] };
      mockPost.mockResolvedValue({ data: { success: true, data: options } });

      const result = await getPasskeyAuthenticationOptionsApi('mfa-token-abc');

      expect(result).toEqual(options);
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/passkey/authenticate/options', {
        mfaToken: 'mfa-token-abc',
      });
    });

    it('throws backend error message on failure', async () => {
      mockPost.mockRejectedValue(makeAxiosError('Unauthorized', 401, 'invalid_mfa_token'));

      await expect(getPasskeyAuthenticationOptionsApi('bad-token')).rejects.toThrow(
        'invalid_mfa_token',
      );
    });

    it('throws "unknown" for non-Axios errors', async () => {
      mockPost.mockRejectedValue(new TypeError('fetch failed'));

      await expect(getPasskeyAuthenticationOptionsApi('token')).rejects.toThrow('unknown');
    });
  });

  describe('listPasskeysApi()', () => {
    it('returns array of passkeys', async () => {
      const passkeys = [mockPasskey, { ...mockPasskey, id: 'pk-2', deviceName: 'Windows Hello' }];
      mockGet.mockResolvedValue({ data: { success: true, data: passkeys } });

      const result = await listPasskeysApi();

      expect(result).toEqual(passkeys);
      expect(mockGet).toHaveBeenCalledWith('/auth/mfa/passkeys');
    });

    it('returns empty array when no passkeys registered', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [] } });

      const result = await listPasskeysApi();

      expect(result).toEqual([]);
    });
  });

  describe('removePasskeyApi()', () => {
    it('resolves without value on success', async () => {
      mockDelete.mockResolvedValue({ data: { success: true } });

      await expect(removePasskeyApi('pk-1')).resolves.toBeUndefined();
      expect(mockDelete).toHaveBeenCalledWith('/auth/mfa/passkeys/pk-1');
    });

    it('throws backend error message on failure', async () => {
      mockDelete.mockRejectedValue(makeAxiosError('Not Found', 404, 'passkey_not_found'));

      await expect(removePasskeyApi('bad-id')).rejects.toThrow('passkey_not_found');
    });
  });

  describe('renamePasskeyApi()', () => {
    it('returns updated passkey with new name', async () => {
      const updated = { ...mockPasskey, deviceName: 'YubiKey 5' };
      mockPatch.mockResolvedValue({ data: { success: true, data: updated } });

      const result = await renamePasskeyApi('pk-1', 'YubiKey 5');

      expect(result).toEqual(updated);
      expect(mockPatch).toHaveBeenCalledWith('/auth/mfa/passkeys/pk-1', {
        deviceName: 'YubiKey 5',
      });
    });

    it('throws backend error message on failure', async () => {
      mockPatch.mockRejectedValue(makeAxiosError('Bad Request', 400, 'invalid_device_name'));

      await expect(renamePasskeyApi('pk-1', '')).rejects.toThrow('invalid_device_name');
    });
  });

  describe('getPasskeyLoginOptionsApi()', () => {
    it('returns options and passkeyLoginToken', async () => {
      const payload = {
        options: { challenge: 'abc', allowCredentials: [] },
        passkeyLoginToken: 'tok-uuid-123',
      };
      mockGet.mockResolvedValue({ data: { success: true, data: payload } });

      const result = await getPasskeyLoginOptionsApi();

      expect(result).toEqual(payload);
      expect(mockGet).toHaveBeenCalledWith('/auth/passkey/login/options');
    });

    it('throws backend error message on failure', async () => {
      mockGet.mockRejectedValue(makeAxiosError('Internal Server Error', 500, 'no_passkeys'));

      await expect(getPasskeyLoginOptionsApi()).rejects.toThrow('no_passkeys');
    });
  });

  describe('verifyPasskeyLoginApi()', () => {
    it('returns token + user on successful passkey login', async () => {
      const loginData = { token: 'jwt-token', user: testUser };
      mockPost.mockResolvedValue({ data: { success: true, data: loginData } });

      const webauthnResponse = { id: 'cred-id', response: {}, type: 'public-key' };
      const result = await verifyPasskeyLoginApi(webauthnResponse, 'tok-uuid-123');

      expect(result).toEqual(loginData);
      expect(mockPost).toHaveBeenCalledWith('/auth/passkey/login/verify', {
        webauthnResponse,
        passkeyLoginToken: 'tok-uuid-123',
      });
    });

    it('throws backend error message on invalid credential', async () => {
      mockPost.mockRejectedValue(makeAxiosError('Unauthorized', 401, 'passkey_verify_failed'));

      await expect(verifyPasskeyLoginApi({}, 'bad-token')).rejects.toThrow(
        'passkey_verify_failed',
      );
    });

    it('throws "unknown" for non-Axios errors', async () => {
      mockPost.mockRejectedValue(new Error('connection reset'));

      await expect(verifyPasskeyLoginApi({}, 'token')).rejects.toThrow('unknown');
    });
  });

  // ─── Email OTP (M21) ───────────────────────────────────────────────────────

  describe('requestEmailOtpApi()', () => {
    it('returns expiresAt on success', async () => {
      const expiresAt = '2026-03-12T12:10:00.000Z';
      mockPost.mockResolvedValue({ data: { success: true, data: { expiresAt } } });

      const result = await requestEmailOtpApi('mfa-token-123');

      expect(result).toEqual({ expiresAt });
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/email-otp/request', {
        mfaToken: 'mfa-token-123',
      });
    });

    it('throws backend error message on failure', async () => {
      mockPost.mockRejectedValue(makeAxiosError('Service Unavailable', 503, 'smtp_not_configured'));

      await expect(requestEmailOtpApi('valid-token')).rejects.toThrow('smtp_not_configured');
    });

    it('throws "unknown" for non-Axios errors', async () => {
      mockPost.mockRejectedValue(new Error('dns lookup failed'));

      await expect(requestEmailOtpApi('token')).rejects.toThrow('unknown');
    });
  });

  describe('verifyMfaApi() with emailOtpCode', () => {
    it('sends emailOtpCode to /auth/mfa/verify', async () => {
      const successData = { token: 'full-token', user: testUser };
      mockPost.mockResolvedValue({ data: { success: true, data: successData } });

      const result = await verifyMfaApi('mfa-token', { emailOtpCode: '654321' });

      expect(result).toEqual(successData);
      expect(mockPost).toHaveBeenCalledWith('/auth/mfa/verify', {
        mfaToken: 'mfa-token',
        emailOtpCode: '654321',
      });
    });
  });
});
