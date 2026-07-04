import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { paginate, buildPaginationMeta } from '../../utils/pagination.util.js';
import { CreateUserDtoType, UpdateUserDtoType } from './users.dto.js';
import { recordAuditEvent, AuditCategory, AuditSeverity } from '../audit/audit.service.js';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UserRow = {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'DISPATCHER';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function withSystemAdminFlag<T extends UserRow>(user: T) {
  return { ...user, isSystemAdmin: user.email === env.SEED_USER_EMAIL };
}

export const usersService = {
  async findAll(page: number, limit: number, search?: string) {
    const { skip, take } = paginate(page, limit);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        select: USER_SELECT,
      }),
      prisma.user.count({ where }),
    ]);

    return { items: items.map(withSystemAdminFlag), ...buildPaginationMeta(total, page, limit) };
  },

  async findOne(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new Error('User not found');
    return withSystemAdminFlag(user);
  },

  async create(dto: CreateUserDtoType) {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new Error('A user with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const created = await prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        passwordHash,
      },
      select: USER_SELECT,
    });

    await recordAuditEvent({
      category: AuditCategory.USER_MANAGEMENT,
      action:   'USER_CREATE',
      actor:    {},
      severity: AuditSeverity.INFO,
      details:  { userId: created.id, email: created.email, role: created.role },
    });

    return withSystemAdminFlag(created);
  },

  async update(id: number, dto: UpdateUserDtoType) {
    const user = await usersService.findOne(id);
    if (user.email === env.SEED_USER_EMAIL) {
      throw new Error('The system admin account cannot be modified');
    }
    const updated = await prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });

    if (dto.role !== undefined && dto.role !== user.role) {
      await recordAuditEvent({
        category: AuditCategory.USER_MANAGEMENT,
        action:   'USER_ROLE_CHANGE',
        actor:    {},
        severity: AuditSeverity.WARN,
        details:  { userId: id, email: user.email, oldRole: user.role, newRole: dto.role },
      });
    }

    return withSystemAdminFlag(updated);
  },

  async resetPassword(id: number, newPassword: string) {
    const user = await usersService.findOne(id);
    if (user.email === env.SEED_USER_EMAIL) {
      throw new Error('The system admin account password cannot be reset here');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: USER_SELECT,
    });
    return withSystemAdminFlag(updated);
  },

  async remove(id: number, requestingUserId: number) {
    if (id === requestingUserId) {
      throw new Error('Cannot deactivate your own account');
    }
    const user = await usersService.findOne(id);
    if (user.email === env.SEED_USER_EMAIL) {
      throw new Error('The system admin account cannot be deactivated');
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: USER_SELECT,
    });

    await recordAuditEvent({
      category: AuditCategory.USER_MANAGEMENT,
      action:   'USER_DEACTIVATE',
      actor:    {},
      severity: AuditSeverity.WARN,
      details:  { userId: id, email: user.email },
    });

    return withSystemAdminFlag(updated);
  },

  async hardDelete(id: number, requestingUserId: number) {
    if (id === requestingUserId) {
      throw new Error('Cannot delete your own account');
    }
    const user = await usersService.findOne(id);
    if (user.email === env.SEED_USER_EMAIL) {
      throw new Error('The system admin account cannot be deleted');
    }
    await prisma.$transaction([
      prisma.order.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      prisma.activityLog.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.user.delete({ where: { id } }),
    ]);

    await recordAuditEvent({
      category: AuditCategory.USER_MANAGEMENT,
      action:   'USER_DELETE',
      actor:    {},
      severity: AuditSeverity.WARN,
      details:  { userId: id, email: user.email },
    });
  },
};
