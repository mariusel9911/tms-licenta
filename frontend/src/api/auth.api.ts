import axios from 'axios';
import { apiClient } from './client';

interface LoginSuccessResponse {
  token: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: 'ADMIN' | 'DISPATCHER';
    isSystemAdmin: boolean;
  };
}

interface LoginMfaResponse {
  mfaRequired: true;
  mfaToken: string;
  methods: string[];
  maskedEmail: string;
}

export type LoginApiResult = LoginSuccessResponse | LoginMfaResponse;

export interface LoginApiError {
  code: string;
  remainingMin?: number;
}

export async function loginApi(email: string, password: string): Promise<LoginApiResult> {
  try {
    const res = await apiClient.post<{ success: true; data: LoginApiResult }>('/auth/login', {
      email,
      password,
    });
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      const apiErr: LoginApiError = {
        code: err.response.data.error as string,
        remainingMin: err.response.data.remainingMin as number | undefined,
      };
      throw apiErr;
    }
    throw { code: 'unknown' } satisfies LoginApiError;
  }
}

export async function verifyMfaApi(
  mfaToken: string,
  opts: { totpCode?: string; recoveryCode?: string; webauthnResponse?: Record<string, unknown>; emailOtpCode?: string },
): Promise<LoginSuccessResponse> {
  try {
    const res = await apiClient.post<{ success: true; data: LoginSuccessResponse }>(
      '/auth/mfa/verify',
      { mfaToken, ...opts },
    );
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

export async function getMfaStatusApi(): Promise<{ totpEnabled: boolean; emailOtpEnabled: boolean }> {
  const res = await apiClient.get<{ success: true; data: { totpEnabled: boolean; emailOtpEnabled: boolean } }>(
    '/auth/mfa/status',
  );
  return res.data.data;
}

export async function toggleEmailOtpApi(enable: boolean, password?: string): Promise<{ emailOtpEnabled: boolean }> {
  try {
    const res = await apiClient.patch<{ success: true; data: { emailOtpEnabled: boolean } }>(
      '/auth/mfa/email-otp/toggle',
      { enable, password },
    );
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

export async function setupMfaApi(
  password: string,
): Promise<{ qrCodeDataUrl: string }> {
  try {
    const res = await apiClient.post<{
      success: true;
      data: { qrCodeDataUrl: string };
    }>('/auth/mfa/setup', { password });
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

export async function confirmMfaApi(totpCode: string): Promise<{ recoveryCodes: string[] }> {
  try {
    const res = await apiClient.post<{
      success: true;
      data: { recoveryCodes: string[] };
    }>('/auth/mfa/confirm', { totpCode });
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

export async function disableMfaApi(password: string): Promise<void> {
  try {
    await apiClient.post('/auth/mfa/disable', { password });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

export async function getRecoveryCodeCountApi(): Promise<{ remaining: number }> {
  const res = await apiClient.get<{ success: true; data: { remaining: number } }>(
    '/auth/mfa/recovery-codes/count',
  );
  return res.data.data;
}

export async function regenerateRecoveryCodesApi(
  password: string,
): Promise<{ recoveryCodes: string[] }> {
  try {
    const res = await apiClient.post<{
      success: true;
      data: { recoveryCodes: string[] };
    }>('/auth/mfa/recovery-codes/regenerate', { password });
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

// ─── Passkeys / WebAuthn (M20) ────────────────────────────────────────────────

export interface Passkey {
  id: string;
  deviceName: string;
  createdAt: string;
}

export async function getPasskeyRegistrationOptionsApi(): Promise<Record<string, unknown>> {
  const res = await apiClient.get<{ success: true; data: Record<string, unknown> }>(
    '/auth/mfa/passkey/register/options',
  );
  return res.data.data;
}

export async function verifyPasskeyRegistrationApi(
  body: Record<string, unknown>,
  deviceName?: string,
): Promise<Passkey> {
  try {
    const res = await apiClient.post<{ success: true; data: Passkey }>(
      '/auth/mfa/passkey/register/verify',
      { ...body, deviceName },
    );
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

export async function getPasskeyAuthenticationOptionsApi(
  mfaToken: string,
): Promise<Record<string, unknown>> {
  try {
    const res = await apiClient.post<{ success: true; data: Record<string, unknown> }>(
      '/auth/mfa/passkey/authenticate/options',
      { mfaToken },
    );
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

export async function listPasskeysApi(): Promise<Passkey[]> {
  const res = await apiClient.get<{ success: true; data: Passkey[] }>('/auth/mfa/passkeys');
  return res.data.data;
}

export async function removePasskeyApi(id: string): Promise<void> {
  try {
    await apiClient.delete(`/auth/mfa/passkeys/${id}`);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

export async function renamePasskeyApi(id: string, deviceName: string): Promise<Passkey> {
  try {
    const res = await apiClient.patch<{ success: true; data: Passkey }>(
      `/auth/mfa/passkeys/${id}`,
      { deviceName },
    );
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

// ── Usernameless passkey login (no credentials required) ─────────────────────

export async function getPasskeyLoginOptionsApi(): Promise<{
  options: Record<string, unknown>;
  passkeyLoginToken: string;
}> {
  try {
    const res = await apiClient.get<{
      success: true;
      data: { options: Record<string, unknown>; passkeyLoginToken: string };
    }>('/auth/passkey/login/options');
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

export async function verifyPasskeyLoginApi(
  webauthnResponse: Record<string, unknown>,
  passkeyLoginToken: string,
): Promise<LoginSuccessResponse> {
  try {
    const res = await apiClient.post<{ success: true; data: LoginSuccessResponse }>(
      '/auth/passkey/login/verify',
      { webauthnResponse, passkeyLoginToken },
    );
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}

// ── Email OTP (M21) ───────────────────────────────────────────────────────────

export async function requestEmailOtpApi(mfaToken: string): Promise<{ expiresAt: string }> {
  try {
    const res = await apiClient.post<{ success: true; data: { expiresAt: string } }>(
      '/auth/mfa/email-otp/request',
      { mfaToken },
    );
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data?.error) {
      throw new Error(err.response.data.error as string);
    }
    throw new Error('unknown');
  }
}
