import { apiClient } from './client';
import type { AppSettings } from '@/types/settings.types';

// defaultVatPercent is stored as Prisma Decimal (string in JSON) but the form submits a number
export type SettingsUpdatePayload = Partial<
  Omit<AppSettings, 'id' | 'updatedAt' | 'defaultVatPercent'>
> & { defaultVatPercent?: number | string };

export async function getSettings(): Promise<AppSettings> {
  const res = await apiClient.get<{ success: true; data: AppSettings }>('/settings');
  return res.data.data;
}

export async function updateSettings(dto: SettingsUpdatePayload): Promise<AppSettings> {
  const res = await apiClient.put<{ success: true; data: AppSettings }>('/settings', dto);
  return res.data.data;
}

export async function uploadLogo(file: File): Promise<AppSettings> {
  const formData = new FormData();
  formData.append('logo', file);
  const res = await apiClient.post<{ success: true; data: AppSettings }>('/settings/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function deleteLogo(): Promise<AppSettings> {
  const res = await apiClient.delete<{ success: true; data: AppSettings }>('/settings/logo');
  return res.data.data;
}

export async function uploadStamp(file: File): Promise<AppSettings> {
  const formData = new FormData();
  formData.append('stamp', file);
  const res = await apiClient.post<{ success: true; data: AppSettings }>('/settings/stamp', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function deleteStamp(): Promise<AppSettings> {
  const res = await apiClient.delete<{ success: true; data: AppSettings }>('/settings/stamp');
  return res.data.data;
}

export async function testSmtpConnection(): Promise<{ ok: true }> {
  const res = await apiClient.post<{ success: true; data: { ok: true } }>('/settings/smtp/test');
  return res.data.data;
}

// ─── Maintenance Status (public — no auth) ──────────────────────────────────

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
}

export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const res = await apiClient.get<{ success: true; data: MaintenanceStatus }>('/maintenance/status');
  return res.data.data;
}

// ─── System Info (admin only) ───────────────────────────────────────────────

export interface SystemInfo {
  nodeVersion: string;
  uptime: number;
  totalRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  requestsPerMinute: number;
  databaseSizeBytes: number;
  maintenanceEnabled: boolean;
  environment: string;
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const res = await apiClient.get<{ success: true; data: SystemInfo }>('/settings/system-info');
  return res.data.data;
}
