import { apiClient } from './client';
import type { BackupEntry } from '@/types/backup.types';
import type { RestoreResult } from '@/types/audit.types';

export async function listBackups(): Promise<BackupEntry[]> {
  const res = await apiClient.get<{ success: true; data: BackupEntry[] }>('/backup');
  return res.data.data;
}

export async function createBackup(destination: BackupEntry['storage'] = 'both'): Promise<BackupEntry> {
  const res = await apiClient.post<{ success: true; data: BackupEntry }>('/backup', { destination });
  return res.data.data;
}

export async function dryRunRestore(filename: string): Promise<RestoreResult> {
  const res = await apiClient.post<{ success: true; data: RestoreResult }>('/backup/restore', {
    filename,
    dryRun: true,
  });
  return res.data.data;
}

export async function restoreBackup(filename: string, force = false): Promise<RestoreResult> {
  const res = await apiClient.post<{ success: true; data: RestoreResult }>('/backup/restore', {
    filename,
    dryRun: false,
    force,
  });
  return res.data.data;
}

export async function deleteBackup(filename: string): Promise<void> {
  await apiClient.delete(`/backup/${encodeURIComponent(filename)}`);
}

export async function uploadBackup(file: File): Promise<BackupEntry> {
  const formData = new FormData();
  formData.append('backup', file);
  const res = await apiClient.post<{ success: true; data: BackupEntry }>('/backup/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function downloadBackup(filename: string): Promise<void> {
  const res = await apiClient.get(`/backup/${encodeURIComponent(filename)}/download`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
