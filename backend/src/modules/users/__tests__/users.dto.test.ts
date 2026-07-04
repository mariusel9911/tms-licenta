import { describe, it, expect } from 'vitest';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto, FindAllUsersDto } from '../users.dto.js';

describe('CreateUserDto', () => {
  it('parses valid user creation data with ADMIN role', () => {
    const result = CreateUserDto.safeParse({
      email: 'user@example.com',
      name: 'Test User',
      password: 'Password1',
      role: 'ADMIN',
    });
    expect(result.success).toBe(true);
    expect(result.data?.role).toBe('ADMIN');
  });

  it('defaults role to DISPATCHER when not provided', () => {
    const result = CreateUserDto.safeParse({
      email: 'user@example.com',
      name: 'Test User',
      password: 'Password1',
    });
    expect(result.success).toBe(true);
    expect(result.data?.role).toBe('DISPATCHER');
  });

  it('rejects invalid email format', () => {
    const result = CreateUserDto.safeParse({
      email: 'not-an-email',
      name: 'Test',
      password: 'Password1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('email');
  });

  it('rejects empty name', () => {
    const result = CreateUserDto.safeParse({
      email: 'user@example.com',
      name: '',
      password: 'Password1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('name');
  });

  it('rejects password shorter than 8 characters', () => {
    const result = CreateUserDto.safeParse({
      email: 'user@example.com',
      name: 'Test',
      password: 'short',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('password');
  });

  it('rejects password of exactly 7 characters', () => {
    const result = CreateUserDto.safeParse({
      email: 'user@example.com',
      name: 'Test',
      password: '1234567',
    });
    expect(result.success).toBe(false);
  });

  it('accepts password of exactly 8 characters meeting policy', () => {
    const result = CreateUserDto.safeParse({
      email: 'user@example.com',
      name: 'Test',
      password: 'Passwo1d',
    });
    expect(result.success).toBe(true);
  });

  it('rejects password without uppercase letter', () => {
    const result = CreateUserDto.safeParse({
      email: 'user@example.com',
      name: 'Test',
      password: 'password1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('password');
  });

  it('rejects password without a number', () => {
    const result = CreateUserDto.safeParse({
      email: 'user@example.com',
      name: 'Test',
      password: 'Password',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('password');
  });

  it('rejects invalid role', () => {
    const result = CreateUserDto.safeParse({
      email: 'user@example.com',
      name: 'Test',
      password: 'Password1',
      role: 'SUPERADMIN',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('role');
  });
});

describe('UpdateUserDto', () => {
  it('allows empty object — all fields optional', () => {
    const result = UpdateUserDto.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts isActive boolean field', () => {
    const result = UpdateUserDto.safeParse({ isActive: false });
    expect(result.success).toBe(true);
    expect(result.data?.isActive).toBe(false);
  });

  it('accepts name update', () => {
    const result = UpdateUserDto.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = UpdateUserDto.safeParse({ role: 'OWNER' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('role');
  });
});

describe('ResetPasswordDto', () => {
  it('parses a valid new password', () => {
    const result = ResetPasswordDto.safeParse({ newPassword: 'Newpassword1' });
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = ResetPasswordDto.safeParse({ newPassword: 'short' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('newPassword');
  });
});

describe('FindAllUsersDto', () => {
  it('applies defaults for page and limit', () => {
    const result = FindAllUsersDto.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(1);
    expect(result.data?.limit).toBe(50);
  });

  it('accepts optional search string', () => {
    const result = FindAllUsersDto.safeParse({ search: 'admin' });
    expect(result.success).toBe(true);
    expect(result.data?.search).toBe('admin');
  });

  it('coerces string page to number', () => {
    const result = FindAllUsersDto.safeParse({ page: '2' });
    expect(result.success).toBe(true);
    expect(result.data?.page).toBe(2);
  });
});
