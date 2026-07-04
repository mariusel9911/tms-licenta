import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
  downloadOrderPdf as downloadOrderPdfApi,
  archiveOldOrders,
} from '@/api/orders.api';
import type { CreateOrderDto, UpdateOrderDto, OrderFilters, OrderStatus } from '@/types/order.types';

export function useOrdersList(page: number, limit: number, filters?: OrderFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['orders', page, limit, filters],
    queryFn: () => getOrdersList(page, limit, filters),
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => getOrder(id),
    enabled: id > 0,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateOrderDto) => createOrder(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateOrderDto }) =>
      updateOrder(id, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['activity', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
    },
  });
}

export function useDuplicateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => duplicateOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
    },
  });
}

export function usePatchOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      patchOrderStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['activity', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
    },
  });
}

export function useSendOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => sendOrder(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['activity', id] });
    },
  });
}

export function usePreviewOrderPdf() {
  return useMutation({
    mutationFn: (dto: CreateOrderDto) => previewOrderPdf(dto),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up object URL after enough time for the browser to open it
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    },
  });
}

export function useDownloadOrderPdf() {
  return useMutation({
    mutationFn: (id: number) => downloadOrderPdfApi(id),
  });
}

export function useArchiveOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => archiveOldOrders(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['orders'] }); },
  });
}
