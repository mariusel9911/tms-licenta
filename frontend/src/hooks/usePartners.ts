import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPartnersList,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
  viesLookupApi,
} from '@/api/partners.api';
import type { CreatePartnerDto, UpdatePartnerDto, PartnerType } from '@/types/partner.types';

export function usePartnersList(
  page: number,
  limit: number,
  search?: string,
  partnerType?: PartnerType,
) {
  return useQuery({
    queryKey: ['partners', page, limit, search ?? '', partnerType ?? ''],
    queryFn: () => getPartnersList(page, limit, search, partnerType),
  });
}

export function usePartner(id: number) {
  return useQuery({
    queryKey: ['partners', id],
    queryFn: () => getPartner(id),
    enabled: id > 0,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreatePartnerDto) => createPartner(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdatePartnerDto }) =>
      updatePartner(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });
}

export function useDeletePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePartner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
  });
}

export function useViesLookup() {
  return useMutation({
    mutationFn: (vat: string) => viesLookupApi(vat),
  });
}
