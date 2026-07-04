import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHookWithProviders } from '@/__tests__/helpers/render';

vi.mock('@/api/users.api', () => ({
  getUsersList: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  resetUserPassword: vi.fn(),
  deleteUser: vi.fn(),
}));

import {
  getUsersList,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from '@/api/users.api';
import {
  useUsersList,
  useCreateUser,
  useUpdateUser,
  useResetUserPassword,
  useDeleteUser,
} from '../useUsers';

const mockGetUsersList = vi.mocked(getUsersList);
const mockCreateUser = vi.mocked(createUser);
const mockUpdateUser = vi.mocked(updateUser);
const mockResetUserPassword = vi.mocked(resetUserPassword);
const mockDeleteUser = vi.mocked(deleteUser);

const user = {
  id: 1,
  name: 'Admin User',
  email: 'admin@tms.ro',
  role: 'ADMIN' as const,
  isActive: true,
  isSystemAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const paginatedData = { items: [user], total: 1, page: 1, limit: 20, totalPages: 1 };

describe('useUsersList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches paginated user list', async () => {
    mockGetUsersList.mockResolvedValue(paginatedData);

    const { result } = renderHookWithProviders(() => useUsersList(1, 20));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(paginatedData);
    expect(mockGetUsersList).toHaveBeenCalledWith(1, 20, undefined);
  });

  it('passes search param', async () => {
    mockGetUsersList.mockResolvedValue(paginatedData);

    const { result } = renderHookWithProviders(() => useUsersList(1, 20, 'admin'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetUsersList).toHaveBeenCalledWith(1, 20, 'admin');
  });
});

describe('useCreateUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls createUser API and invalidates users cache', async () => {
    mockCreateUser.mockResolvedValue(user);

    const { result, queryClient } = renderHookWithProviders(() => useCreateUser());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({
        name: 'New User',
        email: 'new@tms.ro',
        password: 'password123',
        role: 'DISPATCHER',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockCreateUser).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] });
  });
});

describe('useUpdateUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateUser API and invalidates users cache', async () => {
    mockUpdateUser.mockResolvedValue(user);

    const { result, queryClient } = renderHookWithProviders(() => useUpdateUser());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ id: 1, dto: { name: 'Updated Name' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdateUser).toHaveBeenCalledWith(1, { name: 'Updated Name' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] });
  });
});

describe('useResetUserPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls resetUserPassword API without cache invalidation', async () => {
    mockResetUserPassword.mockResolvedValue(user);

    const { result, queryClient } = renderHookWithProviders(() => useResetUserPassword());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate({ id: 1, newPassword: 'newpassword123' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockResetUserPassword).toHaveBeenCalledWith(1, 'newpassword123');
    // No onSuccess invalidation for this hook
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe('useDeleteUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls deleteUser API and invalidates users cache', async () => {
    mockDeleteUser.mockResolvedValue(undefined);

    const { result, queryClient } = renderHookWithProviders(() => useDeleteUser());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.mutate(1);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockDeleteUser).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] });
  });
});
