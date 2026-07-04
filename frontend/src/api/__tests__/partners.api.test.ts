import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/api/client';
import {
  getPartnersList,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
  viesLookupApi,
} from '@/api/partners.api';
import { buildPartner } from '@/__tests__/helpers/factories';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const partner = buildPartner();

describe('partners.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getPartnersList() calls GET /partners with pagination params', async () => {
    const paginated = { items: [partner], total: 1, page: 1, limit: 20, totalPages: 1 };
    mockGet.mockResolvedValue({ data: { success: true, data: paginated } });

    const result = await getPartnersList(1, 20, 'Test', 'CLIENT');

    expect(result).toEqual(paginated);
    expect(mockGet).toHaveBeenCalledWith('/partners', {
      params: { page: 1, limit: 20, search: 'Test', partnerType: 'CLIENT' },
    });
  });

  it('getPartner() calls GET /partners/:id', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: partner } });

    const result = await getPartner(1);

    expect(result).toEqual(partner);
    expect(mockGet).toHaveBeenCalledWith('/partners/1');
  });

  it('createPartner() calls POST /partners', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: partner } });

    const dto = {
      partnerType: 'CLIENT' as const,
      fiscalCode: 'RO12345678',
      name: 'Test SRL',
      country: 'Romania',
      addressLine1: 'Str. Test 1',
      phone: '+40712345678',
      email: 'test@test.ro',
      contactPerson: 'Ion',
    };
    const result = await createPartner(dto);

    expect(result).toEqual(partner);
    expect(mockPost).toHaveBeenCalledWith('/partners', dto);
  });

  it('updatePartner() calls PUT /partners/:id', async () => {
    const updated = buildPartner({ name: 'Updated SRL' });
    mockPut.mockResolvedValue({ data: { success: true, data: updated } });

    const result = await updatePartner(1, { name: 'Updated SRL' });

    expect(result).toEqual(updated);
    expect(mockPut).toHaveBeenCalledWith('/partners/1', { name: 'Updated SRL' });
  });

  it('deletePartner() calls DELETE /partners/:id', async () => {
    mockDelete.mockResolvedValue({});

    await deletePartner(1);

    expect(mockDelete).toHaveBeenCalledWith('/partners/1');
  });

  it('viesLookupApi() returns ViesResult on success', async () => {
    const viesData = { name: 'Test SRL', address: 'Str. Test 1, Timisoara' };
    mockGet.mockResolvedValue({ data: { success: true, data: viesData } });

    const result = await viesLookupApi('RO12345678');

    expect(result).toEqual(viesData);
    expect(mockGet).toHaveBeenCalledWith('/partners/vies', {
      params: { vat: 'RO12345678' },
    });
  });
});
