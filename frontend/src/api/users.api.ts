import { apiClient } from './client';
import type { User, PaginatedUsers, CreateUserDto, UpdateUserDto } from '@/types/user.types';

export async function getUsersList(
  page: number,
  limit: number,
  search?: string,
): Promise<PaginatedUsers> {
  const params: Record<string, string | number> = { page, limit };
  if (search) params.search = search;

  const res = await apiClient.get<{ success: true; data: PaginatedUsers }>(
    '/users',
    { params },
  );
  return res.data.data;
}

export async function getUser(id: number): Promise<User> {
  const res = await apiClient.get<{ success: true; data: User }>(`/users/${id}`);
  return res.data.data;
}

export async function createUser(dto: CreateUserDto): Promise<User> {
  const res = await apiClient.post<{ success: true; data: User }>('/users', dto);
  return res.data.data;
}

export async function updateUser(id: number, dto: UpdateUserDto): Promise<User> {
  const res = await apiClient.put<{ success: true; data: User }>(`/users/${id}`, dto);
  return res.data.data;
}

export async function resetUserPassword(id: number, newPassword: string): Promise<User> {
  const res = await apiClient.post<{ success: true; data: User }>(
    `/users/${id}/reset-password`,
    { newPassword },
  );
  return res.data.data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}