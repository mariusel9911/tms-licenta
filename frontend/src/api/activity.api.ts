import { apiClient } from './client';

export interface ActivityLogEntry {
  id: number;
  orderId: number;
  userId: number | null;
  action: string;
  details: string | null;
  createdAt: string;
  user: { id: number; name: string } | null;
}

export async function getOrderActivity(orderId: number): Promise<ActivityLogEntry[]> {
  const res = await apiClient.get<{ success: true; data: ActivityLogEntry[] }>(
    `/orders/${orderId}/activity`,
  );
  return res.data.data;
}
