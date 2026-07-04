import { z } from 'zod';

export const CreateUserDto = z.object({
  email: z.email('Invalid email'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter and one number'),
  role: z.enum(['ADMIN', 'DISPATCHER'] as const).default('DISPATCHER'),
});

export type CreateUserDtoType = z.infer<typeof CreateUserDto>;

export const UpdateUserDto = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'DISPATCHER'] as const).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateUserDtoType = z.infer<typeof UpdateUserDto>;

export const ResetPasswordDto = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters').regex(/(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter and one number'),
});

export type ResetPasswordDtoType = z.infer<typeof ResetPasswordDto>;

export const FindAllUsersDto = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  search: z.string().optional(),
});

export type FindAllUsersDtoType = z.infer<typeof FindAllUsersDto>;