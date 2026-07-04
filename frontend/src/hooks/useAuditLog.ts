import { useMutation, useQuery } from '@tanstack/react-query';
import {
  listAuditFiles,
  listAuditEntries,
  downloadAuditFile,
  listBackupCompatAll,
  type AuditEntriesParams,
} from '@/api/audit.api';

export function useAuditFiles() {
  return useQuery({
    queryKey: ['audit', 'files'],
    queryFn:  listAuditFiles,
    staleTime: 30_000,
  });
}

export function useAuditEntries(params: AuditEntriesParams) {
  return useQuery({
    queryKey: ['audit', 'entries', params],
    queryFn:  () => listAuditEntries(params),
    staleTime: 10_000,
  });
}

export function useDownloadAuditLog() {
  return useMutation({ mutationFn: (date: string) => downloadAuditFile(date) });
}

export function useBackupCompatAll() {
  return useQuery({
    queryKey:  ['backup', 'compat-all'],
    queryFn:   listBackupCompatAll,
    staleTime: 60_000,
  });
}

export function useAuditTodayCount() {
  return useQuery({
    queryKey:        ['audit', 'today-count'],
    queryFn:         () => listAuditEntries({ page: 1, pageSize: 1 }),
    staleTime:       30_000,
    refetchInterval: 60_000,
    select:          (data) => data.total,
  });
}
