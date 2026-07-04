import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  toggleEmailOtpApi,
  type Passkey,
} from '@/api/auth.api';

export function useMfaStatus() {
  return useQuery({
    queryKey: ['auth', 'mfa-status'],
    queryFn: getMfaStatusApi,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useSetupMfa() {
  return useMutation({
    mutationFn: (password: string) => setupMfaApi(password),
  });
}

export function useConfirmMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (totpCode: string) => confirmMfaApi(totpCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'mfa-status'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'recovery-code-count'] });
    },
  });
}

export function useDisableMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => disableMfaApi(password),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'mfa-status'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'recovery-code-count'] });
    },
  });
}

export function useRecoveryCodeCount() {
  return useQuery({
    queryKey: ['auth', 'recovery-code-count'],
    queryFn: getRecoveryCodeCountApi,
    staleTime: 0, // always refetch on mount so count is accurate after using a recovery code
  });
}

export function useRegenerateRecoveryCodes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => regenerateRecoveryCodesApi(password),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'recovery-code-count'] });
    },
  });
}

// ─── Passkeys / WebAuthn (M20) ────────────────────────────────────────────────

export function usePasskeys() {
  return useQuery({
    queryKey: ['auth', 'passkeys'],
    queryFn: listPasskeysApi,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useRemovePasskey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removePasskeyApi(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'passkeys'] });
    },
  });
}

export function useRenamePasskey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deviceName }: { id: string; deviceName: string }) =>
      renamePasskeyApi(id, deviceName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'passkeys'] });
    },
  });
}

// ─── Email OTP (M21) ──────────────────────────────────────────────────────────

export function useRequestEmailOtp() {
  return useMutation({
    mutationFn: (mfaToken: string) => requestEmailOtpApi(mfaToken),
  });
}

export function useToggleEmailOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ enable, password }: { enable: boolean; password?: string }) =>
      toggleEmailOtpApi(enable, password),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth', 'mfa-status'] });
    },
  });
}

// Re-export Passkey type for components that import from useAuth
export type { Passkey };
