import { apiClient } from './client';
import type {
  Vehicle,
  PaginatedVehicles,
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleStatus,
} from '@/types/vehicle.types';

export async function getVehiclesList(
  page: number,
  limit: number,
  search?: string,
  status?: VehicleStatus,
): Promise<PaginatedVehicles> {
  const params: Record<string, string | number> = { page, limit };
  if (search) params.search = search;
  if (status) params.status = status;

  const res = await apiClient.get<{ success: true; data: PaginatedVehicles }>(
    '/vehicles',
    { params },
  );
  return res.data.data;
}

export async function getVehicle(id: number): Promise<Vehicle> {
  const res = await apiClient.get<{ success: true; data: Vehicle }>(
    `/vehicles/${id}`,
  );
  return res.data.data;
}

export async function createVehicle(dto: CreateVehicleDto): Promise<Vehicle> {
  const res = await apiClient.post<{ success: true; data: Vehicle }>(
    '/vehicles',
    dto,
  );
  return res.data.data;
}

export async function updateVehicle(
  id: number,
  dto: UpdateVehicleDto,
): Promise<Vehicle> {
  const res = await apiClient.put<{ success: true; data: Vehicle }>(
    `/vehicles/${id}`,
    dto,
  );
  return res.data.data;
}

export async function deleteVehicle(id: number): Promise<void> {
  await apiClient.delete(`/vehicles/${id}`);
}
