import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from '@/api/client';
import {
  getOrdersList,
  getOrder,
  createOrder,
  updateOrder,
  duplicateOrder,
  deleteOrder,
  patchOrderStatus,
  sendOrder,
  exportOrdersCsv,
  previewOrderPdf,
} from '@/api/orders.api';
import type { CreateOrderDto } from '@/types/order.types';
import { buildOrder } from '@/__tests__/helpers/factories';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);
const mockPatch = vi.mocked(apiClient.patch);

const order = buildOrder();

const minimalDto: CreateOrderDto = { clientId: 1 };

describe('orders.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getOrdersList() calls GET /orders with params', async () => {
    const paginatedData = { items: [order], total: 1, page: 1, limit: 20, totalPages: 1 };
    mockGet.mockResolvedValue({ data: { success: true, data: paginatedData } });

    const result = await getOrdersList(1, 20, { search: 'BGR1' });

    expect(result).toEqual(paginatedData);
    expect(mockGet).toHaveBeenCalledWith('/orders', {
      params: expect.objectContaining({ page: 1, limit: 20, search: 'BGR1' }),
    });
  });

  it('getOrder() calls GET /orders/:id', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: order } });

    const result = await getOrder(1);

    expect(result).toEqual(order);
    expect(mockGet).toHaveBeenCalledWith('/orders/1');
  });

  it('createOrder() calls POST /orders', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: order } });

    const result = await createOrder(minimalDto);

    expect(result).toEqual(order);
    expect(mockPost).toHaveBeenCalledWith('/orders', minimalDto);
  });

  it('updateOrder() calls PUT /orders/:id', async () => {
    const updated = buildOrder({ status: 'CONFIRMED' });
    mockPut.mockResolvedValue({ data: { success: true, data: updated } });

    const result = await updateOrder(1, { status: 'CONFIRMED' });

    expect(result).toEqual(updated);
    expect(mockPut).toHaveBeenCalledWith('/orders/1', { status: 'CONFIRMED' });
  });

  it('duplicateOrder() calls POST /orders/:id/duplicate', async () => {
    const duped = buildOrder({ id: 2, orderNumber: 'BGR2', status: 'DRAFT' });
    mockPost.mockResolvedValue({ data: { success: true, data: duped } });

    const result = await duplicateOrder(1);

    expect(result).toEqual(duped);
    expect(mockPost).toHaveBeenCalledWith('/orders/1/duplicate');
  });

  it('deleteOrder() calls DELETE /orders/:id', async () => {
    mockDelete.mockResolvedValue({});

    await deleteOrder(1);

    expect(mockDelete).toHaveBeenCalledWith('/orders/1');
  });

  it('patchOrderStatus() calls PATCH /orders/:id/status', async () => {
    const patched = buildOrder({ status: 'COMPLETED' });
    mockPatch.mockResolvedValue({ data: { success: true, data: patched } });

    const result = await patchOrderStatus(1, 'COMPLETED');

    expect(result).toEqual(patched);
    expect(mockPatch).toHaveBeenCalledWith('/orders/1/status', { status: 'COMPLETED' });
  });

  it('sendOrder() calls POST /orders/:id/send', async () => {
    const sent = buildOrder({ isSent: true, sentAt: '2026-03-01T10:00:00.000Z' });
    mockPost.mockResolvedValue({ data: { success: true, data: sent } });

    const result = await sendOrder(1);

    expect(result).toEqual(sent);
    expect(mockPost).toHaveBeenCalledWith('/orders/1/send');
  });

  it('exportOrdersCsv() returns a Blob from GET /orders/export/csv', async () => {
    const blob = new Blob(['csv-content'], { type: 'text/csv' });
    mockGet.mockResolvedValue({ data: blob });

    const result = await exportOrdersCsv({ search: 'test' });

    expect(result).toBeInstanceOf(Blob);
    expect(mockGet).toHaveBeenCalledWith('/orders/export/csv', {
      params: expect.objectContaining({ search: 'test' }),
      responseType: 'blob',
    });
  });

  it('previewOrderPdf() returns a Blob from POST /orders/preview-pdf', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    mockPost.mockResolvedValue({ data: blob });

    const result = await previewOrderPdf(minimalDto);

    expect(result).toBeInstanceOf(Blob);
    expect(mockPost).toHaveBeenCalledWith('/orders/preview-pdf', minimalDto, {
      responseType: 'blob',
    });
  });
});
