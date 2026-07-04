import { apiClient } from './client';
import type {
  Partner,
  PaginatedPartners,
  CreatePartnerDto,
  UpdatePartnerDto,
  ViesResult,
  PartnerType,
} from '@/types/partner.types';

export async function getPartnersList(
  page: number,
  limit: number,
  search?: string,
  partnerType?: PartnerType,
): Promise<PaginatedPartners> {
  const params: Record<string, string | number> = { page, limit };
  if (search) params.search = search;
  if (partnerType) params.partnerType = partnerType;

  const res = await apiClient.get<{ success: true; data: PaginatedPartners }>(
    '/partners',
    { params },
  );
  return res.data.data;
}

export async function getPartner(id: number): Promise<Partner> {
  const res = await apiClient.get<{ success: true; data: Partner }>(
    `/partners/${id}`,
  );
  return res.data.data;
}

export async function createPartner(dto: CreatePartnerDto): Promise<Partner> {
  const res = await apiClient.post<{ success: true; data: Partner }>(
    '/partners',
    dto,
  );
  return res.data.data;
}

export async function updatePartner(
  id: number,
  dto: UpdatePartnerDto,
): Promise<Partner> {
  const res = await apiClient.put<{ success: true; data: Partner }>(
    `/partners/${id}`,
    dto,
  );
  return res.data.data;
}

export async function deletePartner(id: number): Promise<void> {
  await apiClient.delete(`/partners/${id}`);
}

export async function viesLookupApi(vat: string): Promise<ViesResult | null> {
  const res = await apiClient.get<
    { success: true; data: ViesResult } | { success: false; error: string }
  >('/partners/vies', { params: { vat } });

  if (!res.data.success) {
    return null;
  }

  return (res.data as { success: true; data: ViesResult }).data;
}
