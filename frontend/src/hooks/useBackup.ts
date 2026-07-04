import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listBackups, createBackup, dryRunRestore, restoreBackup, deleteBackup, downloadBackup, uploadBackup } from '@/api/backup.api';

export function useBackupList() {
  return useQuery({
    queryKey: ['backups'],
    queryFn:  listBackups,
    staleTime: 30_000, // 30 seconds
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (destination: 'local' | 'remote' | 'both' = 'both') => createBackup(destination),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['backups'] });
      qc.invalidateQueries({ queryKey: ['backup', 'compat-all'] });
    },
  });
}

export function useDryRunRestore() {
  return useMutation({
    mutationFn: (filename: string) => dryRunRestore(filename),
  });
}

export function useRestoreBackup() {
  return useMutation({
    mutationFn: ({ filename, force = false }: { filename: string; force?: boolean }) =>
      restoreBackup(filename, force),
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => deleteBackup(filename),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['backups'] });
      qc.invalidateQueries({ queryKey: ['backup', 'compat-all'] });
    },
  });
}

export function useDownloadBackup() {
  return useMutation({
    mutationFn: (filename: string) => downloadBackup(filename),
  });
}

export function useUploadBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadBackup(file),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['backups'] });
      qc.invalidateQueries({ queryKey: ['backup', 'compat-all'] });
    },
  });
}
