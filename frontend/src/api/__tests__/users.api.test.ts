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
  getUsersList,
  getUser,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from '@/api/users.api';
import type { User } from '@/types/user.types';

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockPut = vi.mocked(apiClient.put);
const mockDelete = vi.mocked(apiClient.delete);

const testUser: User = {
  id: 1,
  email: 'admin@tms.ro',
  name: 'Admin User',
  role: 'ADMIN',
  isActive: true,
  isSystemAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('users.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUsersList() calls GET /users with pagination params', async () => {
    const paginated = { items: [testUser], total: 1, page: 1, limit: 20, totalPages: 1 };
    mockGet.mockResolvedValue({ data: { success: true, data: paginated } });

    const result = await getUsersList(1, 20, 'Admin');

    expect(result).toEqual(paginated);
    expect(mockGet).toHaveBeenCalledWith('/users', {
      params: { page: 1, limit: 20, search: 'Admin' },
    });
  });

  it('getUser() calls GET /users/:id', async () => {
    mockGet.mockResolvedValue({ data: { success: true, data: testUser } });

    const result = await getUser(1);

    expect(result).toEqual(testUser);
    expect(mockGet).toHaveBeenCalledWith('/users/1');
  });

  it('createUser() calls POST /users', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: testUser } });

    const dto = { email: 'new@tms.ro', name: 'New User', password: 'pass123', role: 'DISPATCHER' as const };
    const result = await createUser(dto);

    expect(result).toEqual(testUser);
    expect(mockPost).toHaveBeenCalledWith('/users', dto);
  });

  it('updateUser() calls PUT /users/:id', async () => {
    const updated = { ...testUser, name: 'Updated Name' };
    mockPut.mockResolvedValue({ data: { success: true, data: updated } });

    const result = await updateUser(1, { name: 'Updated Name' });

    expect(result).toEqual(updated);
    expect(mockPut).toHaveBeenCalledWith('/users/1', { name: 'Updated Name' });
  });

  it('resetUserPassword() calls POST /users/:id/reset-password', async () => {
    mockPost.mockResolvedValue({ data: { success: true, data: testUser } });

    const result = await resetUserPassword(1, 'newPassword123');

    expect(result).toEqual(testUser);
    expect(mockPost).toHaveBeenCalledWith('/users/1/reset-password', {
      newPassword: 'newPassword123',
    });
  });

  it('deleteUser() calls DELETE /users/:id', async () => {
    mockDelete.mockResolvedValue({});

    await deleteUser(1);

    expect(mockDelete).toHaveBeenCalledWith('/users/1');
  });
});
