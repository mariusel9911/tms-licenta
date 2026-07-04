export type UserRole = 'ADMIN' | 'DISPATCHER';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  isSystemAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedUsers {
  items: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateUserDto {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserDto {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}