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
  getVehiclesList,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from '@/api/vehicles.api';
import { buildVehicle } from '@/__tests__/helpers/factories';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const vehicle = buildVehicle();

describe('vehicles.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getVehiclesList() calls GET /vehicles with pagination params', async () => {
    const paginated = { items: [vehicle], total: 1, page: 1, limit: 20, totalPages: 1 };
    mockGet.mockResolvedValue({ data: { success: true, data: paginated } });

    const result = await getVehiclesList(1, 20, 'TM01', 'AVAILABLE');

    expect(result).toEqual(paginated);
    expect(mockGet).toHaveBeenCalledWith('/vehicles', {
      params: { page: 1, limit: 20, search: 'TM01', status: 'AVAILABLE' },
    });
  });

  it('getVehicle() calls GET /vehicles/:id', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: vehicle } });

    const result = await getVehicle(1);

    expect(result).toEqual(vehicle);
    expect(mockGet).toHaveBeenCalledWith('/vehicles/1');
  });

  it('createVehicle() calls POST /vehicles', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: vehicle } });

    const dto = { licensePlate: 'TM01ABC', status: 'AVAILABLE' as const };
    const result = await createVehicle(dto);

    expect(result).toEqual(vehicle);
    expect(mockPost).toHaveBeenCalledWith('/vehicles', dto);
  });

  it('updateVehicle() calls PUT /vehicles/:id', async () => {
    const updated = buildVehicle({ status: 'ON_ROUTE' });
    mockPut.mockResolvedValue({ data: { success: true, data: updated } });

    const result = await updateVehicle(1, { status: 'ON_ROUTE' });

    expect(result).toEqual(updated);
    expect(mockPut).toHaveBeenCalledWith('/vehicles/1', { status: 'ON_ROUTE' });
  });

  it('deleteVehicle() calls DELETE /vehicles/:id', async () => {
    mockDelete.mockResolvedValue({});

    await deleteVehicle(1);

    expect(mockDelete).toHaveBeenCalledWith('/vehicles/1');
  });
});
