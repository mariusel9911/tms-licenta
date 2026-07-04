import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUsersList,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from '@/api/users.api';
import type { CreateUserDto, UpdateUserDto } from '@/types/user.types';

export function useUsersList(page: number, limit: number, search?: string) {
  return useQuery({
    queryKey: ['users', page, limit, search ?? ''],
    queryFn: () => getUsersList(page, limit, search),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateUserDto) => createUser(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: UpdateUserDto }) => updateUser(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      resetUserPassword(id, newPassword),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
