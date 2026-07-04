import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/__tests__/helpers/render';
import { buildOrder } from '@/__tests__/helpers/factories';
import type { CreateOrderDto } from '@/types/order.types';

vi.mock('@/api/orders.api', () => ({
  getOrdersList: vi.fn(),
  getOrder: vi.fn(),
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  duplicateOrder: vi.fn(),
  deleteOrder: vi.fn(),
  patchOrderStatus: vi.fn(),
  sendOrder: vi.fn(),
  previewOrderPdf: vi.fn(),
}));

import {
  getOrdersList,
  getOrder,
  createOrder,
  updateOrder,
  duplicateOrder,
  deleteOrder,
  patchOrderStatus,
  sendOrder,
  previewOrderPdf,
} from '@/api/orders.api';
import {
  useOrdersList,
  useOrder,
  useCreateOrder,
  useUpdateOrder,
  useDuplicateOrder,
  useDeleteOrder,
  usePatchOrderStatus,
  useSendOrder,
  usePreviewOrderPdf,
} from '../useOrders';

const mockGetOrdersList = vi.mocked(getOrdersList);
const mockGetOrder = vi.mocked(getOrder);
const mockCreateOrder = vi.mocked(createOrder);
const mockUpdateOrder = vi.mocked(updateOrder);
const mockDuplicateOrder = vi.mocked(duplicateOrder);
const mockDeleteOrder = vi.mocked(deleteOrder);
const mockPatchOrderStatus = vi.mocked(patchOrderStatus);
const mockSendOrder = vi.mocked(sendOrder);
const mockPreviewOrderPdf = vi.mocked(previewOrderPdf);

const order = buildOrder();
const paginatedData = { items: [order], total: 1, page: 1, limit: 20, totalPages: 1 };
const minimalDto: CreateOrderDto = { clientId: 1 };

describe('useOrdersList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches paginated order list', async () => {
    mockGetOrdersList.mockResolvedValue(paginatedData);

    const { result } = renderHookWithProviders(() => useOrdersList(1, 20));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(paginatedData);
    expect(mockGetOrdersList).toHaveBeenCalledWith(1, 20, undefined);
  });

  it('passes filters to the API', async () => {
    mockGetOrdersList.mockResolvedValue(paginatedData);

    const filters = { search: 'BGR1', status: 'DRAFT' as const };
    const { result } = renderHookWithProviders(() => useOrdersList(1, 20, filters));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetOrdersList).toHaveBeenCalledWith(1, 20, filters);
  });
});

describe('useOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches a single order when id > 0', async () => {
    mockGetOrder.mockResolvedValue(order);

    const { result } = renderHookWithProviders(() => useOrder(1));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(order);
    expect(mockGetOrder).toHaveBeenCalledWith(1);
  });

  it('does not fetch when id <= 0', async () => {
    const { result } = renderHookWithProviders(() => useOrder(0));

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.status).toBe('pending');
    expect(mockGetOrder).not.toHaveBeenCalled();
  });

  it('does not fetch when id is negative', async () => {
    const { result } = renderHookWithProviders(() => useOrder(-5));

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.status).toBe('pending');
    expect(mockGetOrder).not.toHaveBeenCalled();
  });
});

describe('useCreateOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls createOrder API and invalidates orders cache', async () => {
    mockCreateOrder.mockResolvedValue(order);

    const { result, queryClient } = renderHookWithProviders(() => useCreateOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate(minimalDto);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreateOrder).toHaveBeenCalledWith(minimalDto);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
  });
});

describe('useUpdateOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateOrder API and invalidates orders + activity caches', async () => {
    mockUpdateOrder.mockResolvedValue(order);

    const { result, queryClient } = renderHookWithProviders(() => useUpdateOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ id: 1, dto: { notes: 'Updated notes' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdateOrder).toHaveBeenCalledWith(1, { notes: 'Updated notes' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity', 1] });
  });
});

describe('useDuplicateOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls duplicateOrder API and invalidates orders cache', async () => {
    const duplicated = buildOrder({ id: 2, orderNumber: 'BGR2' });
    mockDuplicateOrder.mockResolvedValue(duplicated);

    const { result, queryClient } = renderHookWithProviders(() => useDuplicateOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate(1);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDuplicateOrder).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
  });
});

describe('useDeleteOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls deleteOrder API and invalidates orders cache', async () => {
    mockDeleteOrder.mockResolvedValue(undefined);

    const { result, queryClient } = renderHookWithProviders(() => useDeleteOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate(1);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteOrder).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
  });
});

describe('usePatchOrderStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls patchOrderStatus API and invalidates orders + activity caches', async () => {
    mockPatchOrderStatus.mockResolvedValue(order);

    const { result, queryClient } = renderHookWithProviders(() => usePatchOrderStatus());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ id: 1, status: 'CONFIRMED' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPatchOrderStatus).toHaveBeenCalledWith(1, 'CONFIRMED');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity', 1] });
  });
});

describe('useSendOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls sendOrder API and invalidates orders + activity caches', async () => {
    mockSendOrder.mockResolvedValue(buildOrder());

    const { result, queryClient } = renderHookWithProviders(() => useSendOrder());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate(42);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockSendOrder).toHaveBeenCalledWith(42);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['activity', 42] });
  });
});

describe('usePreviewOrderPdf', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let windowOpenSpy: ReturnType<typeof vi.spyOn>;
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on URL methods (don't replace the whole URL object — that breaks React internals)
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    // Spy on setTimeout to assert 10s cleanup without needing fake timers
    setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    windowOpenSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('calls previewOrderPdf and opens the blob URL in a new tab', async () => {
    const blob = new Blob(['PDF content'], { type: 'application/pdf' });
    mockPreviewOrderPdf.mockResolvedValue(blob);

    const { result } = renderHookWithProviders(() => usePreviewOrderPdf());

    await act(async () => {
      result.current.mutate(minimalDto);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPreviewOrderPdf).toHaveBeenCalledWith(minimalDto);
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(windowOpenSpy).toHaveBeenCalledWith('blob:mock-url', '_blank');
  });

  it('schedules revokeObjectURL cleanup after 10 seconds', async () => {
    const blob = new Blob(['PDF content'], { type: 'application/pdf' });
    mockPreviewOrderPdf.mockResolvedValue(blob);

    const { result } = renderHookWithProviders(() => usePreviewOrderPdf());

    await act(async () => {
      result.current.mutate(minimalDto);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Verify that setTimeout was called with 10000ms (the cleanup delay)
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
  });
});
