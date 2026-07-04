import { apiClient } from './client';
import type { AuditFileInfo, AuditEntriesResponse, AuditCategory, AuditSeverity, BackupCompatibility } from '@/types/audit.types';

export async function listAuditFiles(): Promise<AuditFileInfo[]> {
  const res = await apiClient.get<{ success: true; data: AuditFileInfo[] }>('/audit/files');
  return res.data.data;
}

export interface AuditEntriesParams {
  date?:       string;
  category?:   AuditCategory;
  severity?:   AuditSeverity;
  actorEmail?: string;
  q?:          string;
  page?:       number;
  pageSize?:   number;
}

export async function listAuditEntries(params: AuditEntriesParams = {}): Promise<AuditEntriesResponse> {
  const res = await apiClient.get<{ success: true; data: AuditEntriesResponse }>('/audit/entries', {
    params,
  });
  return res.data.data;
}

export async function downloadAuditFile(date: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const filename = date === today ? 'audit-current.jsonl' : `audit-${date}.jsonl.gz`;
  const res = await apiClient.get<Blob>('/audit/download', {
    params:       { date },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface BackupCompatEntry {
  filename: string;
  compat:   BackupCompatibility | null;
}

export async function listBackupCompatAll(): Promise<BackupCompatEntry[]> {
  const res = await apiClient.get<{ success: true; data: BackupCompatEntry[] }>('/backup/compat');
  return res.data.data;
}
