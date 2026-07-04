import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/__tests__/helpers/render';

vi.mock('@/api/activity.api', () => ({
  getOrderActivity: vi.fn(),
}));

import { getOrderActivity } from '@/api/activity.api';
import { useOrderActivity } from '../useActivity';

const mockGetOrderActivity = vi.mocked(getOrderActivity);

const activityEntries = [
  {
    id: 1,
    orderId: 42,
    userId: 1,
    action: 'created order',
    details: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    user: { id: 1, name: 'Admin User' },
  },
];

describe('useOrderActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches activity when orderId > 0', async () => {
    mockGetOrderActivity.mockResolvedValue(activityEntries);

    const { result } = renderHookWithProviders(() => useOrderActivity(42));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(activityEntries);
    expect(mockGetOrderActivity).toHaveBeenCalledWith(42);
  });

  it('does not fetch when orderId <= 0', async () => {
    const { result } = renderHookWithProviders(() => useOrderActivity(0));

    // Give time for any potential fetch
    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.status).toBe('pending');
    expect(mockGetOrderActivity).not.toHaveBeenCalled();
  });

  it('does not fetch when orderId is negative', async () => {
    const { result } = renderHookWithProviders(() => useOrderActivity(-1));

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.status).toBe('pending');
    expect(mockGetOrderActivity).not.toHaveBeenCalled();
  });

  it('exposes error when fetch fails', async () => {
    mockGetOrderActivity.mockRejectedValue(new Error('Network error'));

    const { result } = renderHookWithProviders(() => useOrderActivity(42));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
