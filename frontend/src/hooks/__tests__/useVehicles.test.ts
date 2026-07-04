import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/__tests__/helpers/render';
import { buildVehicle } from '@/__tests__/helpers/factories';

vi.mock('@/api/vehicles.api', () => ({
  getVehiclesList: vi.fn(),
  getVehicle: vi.fn(),
  createVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  deleteVehicle: vi.fn(),
}));

import {
  getVehiclesList,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from '@/api/vehicles.api';
import {
  useVehiclesList,
  useVehicle,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
} from '../useVehicles';

const mockGetVehiclesList = vi.mocked(getVehiclesList);
const mockGetVehicle = vi.mocked(getVehicle);
const mockCreateVehicle = vi.mocked(createVehicle);
const mockUpdateVehicle = vi.mocked(updateVehicle);
const mockDeleteVehicle = vi.mocked(deleteVehicle);

const vehicle = buildVehicle();
const paginatedData = { items: [vehicle], total: 1, page: 1, limit: 20, totalPages: 1 };

describe('useVehiclesList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches paginated vehicle list', async () => {
    mockGetVehiclesList.mockResolvedValue(paginatedData);

    const { result } = renderHookWithProviders(() => useVehiclesList(1, 20));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(paginatedData);
    expect(mockGetVehiclesList).toHaveBeenCalledWith(1, 20, undefined, undefined);
  });

  it('passes search and status params', async () => {
    mockGetVehiclesList.mockResolvedValue(paginatedData);

    const { result } = renderHookWithProviders(() =>
      useVehiclesList(1, 20, 'TM01', 'AVAILABLE'),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetVehiclesList).toHaveBeenCalledWith(1, 20, 'TM01', 'AVAILABLE');
  });
});

describe('useVehicle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches a single vehicle when id > 0', async () => {
    mockGetVehicle.mockResolvedValue(vehicle);

    const { result } = renderHookWithProviders(() => useVehicle(1));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(vehicle);
    expect(mockGetVehicle).toHaveBeenCalledWith(1);
  });

  it('does not fetch when id <= 0', async () => {
    const { result } = renderHookWithProviders(() => useVehicle(0));

    await new Promise((r) => setTimeout(r, 50));

    expect(result.current.status).toBe('pending');
    expect(mockGetVehicle).not.toHaveBeenCalled();
  });
});

describe('useCreateVehicle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls createVehicle API and invalidates vehicles cache', async () => {
    mockCreateVehicle.mockResolvedValue(vehicle);

    const { result, queryClient } = renderHookWithProviders(() => useCreateVehicle());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ licensePlate: 'TM01ABC', status: 'AVAILABLE' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreateVehicle).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] });
  });
});

describe('useUpdateVehicle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateVehicle API and invalidates vehicles cache', async () => {
    mockUpdateVehicle.mockResolvedValue(vehicle);

    const { result, queryClient } = renderHookWithProviders(() => useUpdateVehicle());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ id: 1, dto: { licensePlate: 'TM02XYZ' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdateVehicle).toHaveBeenCalledWith(1, { licensePlate: 'TM02XYZ' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] });
  });
});

describe('useDeleteVehicle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls deleteVehicle API and invalidates vehicles cache', async () => {
    mockDeleteVehicle.mockResolvedValue(undefined);

    const { result, queryClient } = renderHookWithProviders(() => useDeleteVehicle());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate(1);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteVehicle).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['vehicles'] });
  });
});
