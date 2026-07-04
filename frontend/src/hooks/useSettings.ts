import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings, uploadLogo, deleteLogo, uploadStamp, deleteStamp, getMaintenanceStatus, getSystemInfo } from '@/api/settings.api';
import type { SettingsUpdatePayload } from '@/api/settings.api';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes — settings change rarely
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: SettingsUpdatePayload) => updateSettings(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadLogo(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useDeleteLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteLogo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useUploadStamp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadStamp(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useDeleteStamp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteStamp(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useMaintenanceStatus() {
  return useQuery({
    queryKey: ['maintenance-status'],
    queryFn: getMaintenanceStatus,
    // Only poll when maintenance is active so users get redirected promptly.
    // When maintenance is off there is no value in repeated API calls.
    refetchInterval: (query) => (query.state.data?.enabled ? 30_000 : false),
    refetchIntervalInBackground: false,
  });
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ['system-info'],
    queryFn: getSystemInfo,
    refetchInterval: 60_000, // Auto-refresh every 60s
  });
}
