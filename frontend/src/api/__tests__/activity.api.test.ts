import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/api/client';
import { getOrderActivity } from '@/api/activity.api';
import type { ActivityLogEntry } from '@/api/activity.api';

const mockGet = vi.mocked(apiClient.get);

const entry: ActivityLogEntry = {
  id: 1,
  orderId: 10,
  userId: 1,
  action: 'created order',
  details: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  user: { id: 1, name: 'Admin User' },
};

describe('activity.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getOrderActivity() calls GET /orders/:orderId/activity and returns entries', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: [entry] } });

    const result = await getOrderActivity(10);

    expect(result).toEqual([entry]);
    expect(mockGet).toHaveBeenCalledWith('/orders/10/activity');
  });
});
