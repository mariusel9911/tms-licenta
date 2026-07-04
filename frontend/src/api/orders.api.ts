import { apiClient } from './client';
import type {
  Order,
  PaginatedOrders,
  CreateOrderDto,
  UpdateOrderDto,
  OrderFilters,
  OrderStatus,
} from '@/types/order.types';

export async function getOrdersList(
  page: number,
  limit: number,
  filters?: OrderFilters,
): Promise<PaginatedOrders> {
  const params: Record<string, string | number | boolean> = { page, limit };
  if (filters?.search) params.search = filters.search;
  if (filters?.status) params.status = filters.status;
  if (filters?.clientId) params.clientId = filters.clientId;
  if (filters?.transporterId) params.transporterId = filters.transporterId;
  if (filters?.vehicleId) params.vehicleId = filters.vehicleId;
  if (filters?.archived) params.archived = filters.archived;
  if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters?.dateTo) params.dateTo = filters.dateTo;
  if (filters?.sortBy) params.sortBy = filters.sortBy;
  if (filters?.sortOrder) params.sortOrder = filters.sortOrder;

  const res = await apiClient.get<{ success: true; data: PaginatedOrders }>(
    '/orders',
    { params },
  );
  return res.data.data;
}

export async function getOrder(id: number): Promise<Order> {
  const res = await apiClient.get<{ success: true; data: Order }>(`/orders/${id}`);
  return res.data.data;
}

export async function createOrder(dto: CreateOrderDto): Promise<Order> {
  const res = await apiClient.post<{ success: true; data: Order }>('/orders', dto);
  return res.data.data;
}

export async function updateOrder(id: number, dto: UpdateOrderDto): Promise<Order> {
  const res = await apiClient.put<{ success: true; data: Order }>(`/orders/${id}`, dto);
  return res.data.data;
}

export async function duplicateOrder(id: number): Promise<Order> {
  const res = await apiClient.post<{ success: true; data: Order }>(
    `/orders/${id}/duplicate`,
  );
  return res.data.data;
}

export async function deleteOrder(id: number): Promise<void> {
  await apiClient.delete(`/orders/${id}`);
}

export async function patchOrderStatus(id: number, status: OrderStatus): Promise<Order> {
  const res = await apiClient.patch<{ success: true; data: Order }>(
    `/orders/${id}/status`,
    { status },
  );
  return res.data.data;
}

export async function sendOrder(id: number): Promise<Order> {
  const res = await apiClient.post<{ success: true; data: Order }>(`/orders/${id}/send`);
  return res.data.data;
}

export async function exportOrdersCsv(filters?: OrderFilters): Promise<Blob> {
  const params: Record<string, string | number | boolean> = {};
  if (filters?.search) params.search = filters.search;
  if (filters?.status) params.status = filters.status;
  if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters?.dateTo) params.dateTo = filters.dateTo;
  const res = await apiClient.get<Blob>('/orders/export/csv', {
    params,
    responseType: 'blob',
  });
  return res.data;
}

export async function previewOrderPdf(dto: CreateOrderDto): Promise<Blob> {
  const res = await apiClient.post<Blob>('/orders/preview-pdf', dto, {
    responseType: 'blob',
  });
  return res.data;
}

export async function downloadOrderPdf(id: number): Promise<Blob> {
  const res = await apiClient.get<Blob>(`/orders/${id}/pdf`, {
    responseType: 'blob',
  });
  return res.data;
}

export async function archiveOldOrders(): Promise<{ archived: number }> {
  const res = await apiClient.post<{ success: true; data: { archived: number } }>('/orders/archive');
  return res.data.data;
}
