import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/__tests__/helpers/render';
import { buildPartner } from '@/__tests__/helpers/factories';

vi.mock('@/api/partners.api', () => ({
  getPartnersList: vi.fn(),
  getPartner: vi.fn(),
  createPartner: vi.fn(),
  updatePartner: vi.fn(),
  deletePartner: vi.fn(),
  viesLookupApi: vi.fn(),
}));

import {
  getPartnersList,
  getPartner,
  createPartner,
  updatePartner,
  deletePartner,
  viesLookupApi,
} from '@/api/partners.api';
import {
  usePartnersList,
  usePartner,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner,
  useViesLookup,
} from '../usePartners';

const mockGetPartnersList = vi.mocked(getPartnersList);
const mockGetPartner = vi.mocked(getPartner);
const mockCreatePartner = vi.mocked(createPartner);
const mockUpdatePartner = vi.mocked(updatePartner);
const mockDeletePartner = vi.mocked(deletePartner);
const mockViesLookupApi = vi.mocked(viesLookupApi);

const partner = buildPartner();
const paginatedData = { items: [partner], total: 1, page: 1, limit: 20, totalPages: 1 };

describe('usePartnersList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches paginated partner list', async () => {
    mockGetPartnersList.mockResolvedValue(paginatedData);

    const { result } = renderHookWithProviders(() => usePartnersList(1, 20));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(paginatedData);
    expect(mockGetPartnersList).toHaveBeenCalledWith(1, 20, undefined, undefined);
  });

  it('passes search and partnerType params', async () => {
    mockGetPartnersList.mockResolvedValue(paginatedData);

    const { result } = renderHookWithProviders(() =>
      usePartnersList(1, 20, 'Test', 'CLIENT'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetPartnersList).toHaveBeenCalledWith(1, 20, 'Test', 'CLIENT');
  });
});

describe('usePartner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches a single partner when id > 0', async () => {
    mockGetPartner.mockResolvedValue(partner);

    const { result } = renderHookWithProviders(() => usePartner(1));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(partner);
    expect(mockGetPartner).toHaveBeenCalledWith(1);
  });

  it('does not fetch when id <= 0', async () => {
    const { result } = renderHookWithProviders(() => usePartner(0));

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.status).toBe('pending');
    expect(mockGetPartner).not.toHaveBeenCalled();
  });
});

describe('useCreatePartner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls createPartner API and invalidates partners cache', async () => {
    mockCreatePartner.mockResolvedValue(partner);

    const { result, queryClient } = renderHookWithProviders(() => useCreatePartner());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({
        name: 'Test Partner SRL',
        fiscalCode: 'RO12345678',
        country: 'Romania',
        addressLine1: 'Str. Test 1',
        phone: '+40712345678',
        email: 'partner@test.ro',
        contactPerson: 'Ion Popescu',
        partnerType: 'CLIENT',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreatePartner).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['partners'] });
  });
});

describe('useUpdatePartner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updatePartner API and invalidates partners cache', async () => {
    mockUpdatePartner.mockResolvedValue(partner);

    const { result, queryClient } = renderHookWithProviders(() => useUpdatePartner());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ id: 1, dto: { name: 'Updated Name' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdatePartner).toHaveBeenCalledWith(1, { name: 'Updated Name' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['partners'] });
  });
});

describe('useDeletePartner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls deletePartner API and invalidates partners cache', async () => {
    mockDeletePartner.mockResolvedValue(undefined);

    const { result, queryClient } = renderHookWithProviders(() => useDeletePartner());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate(1);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeletePartner).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['partners'] });
  });
});

describe('useViesLookup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls viesLookupApi with the VAT number', async () => {
    const viesResult = { name: 'Test Company', address: 'Some Address', country: 'Romania' };
    mockViesLookupApi.mockResolvedValue(viesResult);

    const { result } = renderHookWithProviders(() => useViesLookup());

    await act(async () => {
      result.current.mutate('RO12345678');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockViesLookupApi).toHaveBeenCalledWith('RO12345678');
    expect(result.current.data).toEqual(viesResult);
  });
});
