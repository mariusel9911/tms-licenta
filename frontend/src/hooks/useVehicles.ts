import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getVehiclesList,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
} from '@/api/vehicles.api';
import type { CreateVehicleDto, UpdateVehicleDto, VehicleStatus } from '@/types/vehicle.types';

export function useVehiclesList(
  page: number,
  limit: number,
  search?: string,
  status?: VehicleStatus,
) {
  return useQuery({
    queryKey: ['vehicles', page, limit, search ?? '', status ?? ''],
    queryFn: () => getVehiclesList(page, limit, search, status),
  });
}

export function useVehicle(id: number) {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: () => getVehicle(id),
    enabled: id > 0,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateVehicleDto) => createVehicle(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateVehicleDto }) =>
      updateVehicle(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}
