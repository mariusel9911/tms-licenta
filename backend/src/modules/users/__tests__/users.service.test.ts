import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';

import { prismaMock } from '../../../__tests__/helpers/prisma-mock.js';

vi.mock('../../../config/database', () => ({
  prisma: prismaMock,
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

// Mock env so SEED_USER_EMAIL is stable and controllable in tests
vi.mock('../../../config/env', () => ({
  env: {
    SEED_USER_EMAIL: 'admin@tms.ro',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '8h',
    PORT: 3001,
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173',
  },
}));

import bcrypt from 'bcryptjs';
import { usersService } from '../users.service.js';
import { buildUser, buildDispatcher } from '../../../__tests__/helpers/factories.js';
import { UserRole } from '../../../generated/client.js';

const bcryptMock = bcrypt as unknown as { hash: ReturnType<typeof vi.fn> };

// USER_SELECT shape returned by Prisma (subset, no passwordHash)
const userSelect = (u: ReturnType<typeof buildUser>) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// findAll()
// ---------------------------------------------------------------------------

describe('usersService.findAll()', () => {
  it('returns paginated list of users', async () => {
    const users = [userSelect(buildUser()), userSelect(buildDispatcher())];
    prismaMock.user.findMany.mockResolvedValue(users as never);
    prismaMock.user.count.mockResolvedValue(2);

    const result = await usersService.findAll(1, 20);

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(result.items).toEqual(users.map((u) => ({ ...u, isSystemAdmin: false })));
    expect(result.total).toBe(2);
  });

  it('applies search filter across name and email', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);

    await usersService.findAll(1, 20, 'dispatcher');

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: 'dispatcher', mode: 'insensitive' } },
            { email: { contains: 'dispatcher', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

describe('usersService.create()', () => {
  it('creates a new user successfully', async () => {
    const user = buildUser({ email: 'new@tms.ro' });
    prismaMock.user.findUnique.mockResolvedValue(null);
    bcryptMock.hash.mockResolvedValue('hashed-password' as never);
    prismaMock.user.create.mockResolvedValue(userSelect(user) as never);

    const result = await usersService.create({
      email: 'new@tms.ro',
      name: 'New User',
      password: 'Password1!',
      role: UserRole.DISPATCHER,
    });

    expect(bcryptMock.hash).toHaveBeenCalledWith('Password1!', 12);
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'new@tms.ro', passwordHash: 'hashed-password' }),
      }),
    );
    expect(result.email).toBe('new@tms.ro');
  });

  it('throws when email is already taken', async () => {
    prismaMock.user.findUnique.mockResolvedValue(buildUser() as never);

    await expect(
      usersService.create({
        email: 'test@tms.ro',
        name: 'Duplicate',
        password: 'Password1!',
        role: UserRole.DISPATCHER,
      }),
    ).rejects.toThrow('A user with this email already exists');
  });
});

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

describe('usersService.update()', () => {
  it('updates a regular user successfully', async () => {
    const user = buildDispatcher();
    const updated = userSelect(buildDispatcher({ name: 'Updated Name' }));
    prismaMock.user.findUnique.mockResolvedValue(userSelect(user) as never);
    prismaMock.user.update.mockResolvedValue(updated as never);

    const result = await usersService.update(user.id, { name: 'Updated Name' });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: user.id }, data: { name: 'Updated Name' } }),
    );
    expect(result.name).toBe('Updated Name');
  });

  it('throws when trying to update the seed user', async () => {
    const seedUser = buildUser({ email: 'admin@tms.ro' });
    prismaMock.user.findUnique.mockResolvedValue(userSelect(seedUser) as never);

    await expect(usersService.update(seedUser.id, { name: 'Hacked' })).rejects.toThrow(
      'The system admin account cannot be modified',
    );
  });
});

// ---------------------------------------------------------------------------
// resetPassword()
// ---------------------------------------------------------------------------

describe('usersService.resetPassword()', () => {
  it('resets password for a regular user', async () => {
    const user = buildDispatcher();
    prismaMock.user.findUnique.mockResolvedValue(userSelect(user) as never);
    bcryptMock.hash.mockResolvedValue('new-hashed' as never);
    prismaMock.user.update.mockResolvedValue(userSelect(user) as never);

    await usersService.resetPassword(user.id, 'NewPassword1!');

    expect(bcryptMock.hash).toHaveBeenCalledWith('NewPassword1!', 12);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: user.id }, data: { passwordHash: 'new-hashed' } }),
    );
  });

  it('throws when trying to reset the seed user password', async () => {
    const seedUser = buildUser({ email: 'admin@tms.ro' });
    prismaMock.user.findUnique.mockResolvedValue(userSelect(seedUser) as never);

    await expect(usersService.resetPassword(seedUser.id, 'anything')).rejects.toThrow(
      'The system admin account password cannot be reset here',
    );
  });
});

// ---------------------------------------------------------------------------
// remove()
// ---------------------------------------------------------------------------

describe('usersService.remove()', () => {
  it('deactivates a regular user', async () => {
    const user = buildDispatcher({ id: 5 });
    const deactivated = userSelect(buildDispatcher({ id: 5, isActive: false }));
    prismaMock.user.findUnique.mockResolvedValue(userSelect(user) as never);
    prismaMock.user.update.mockResolvedValue(deactivated as never);

    const result = await usersService.remove(5, 1); // requesting user id=1 (admin)

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5 }, data: { isActive: false } }),
    );
    expect(result.isActive).toBe(false);
  });

  it('throws when a user tries to deactivate themselves', async () => {
    await expect(usersService.remove(1, 1)).rejects.toThrow('Cannot deactivate your own account');
  });

  it('throws when trying to deactivate the seed user', async () => {
    const seedUser = buildUser({ id: 1, email: 'admin@tms.ro' });
    prismaMock.user.findUnique.mockResolvedValue(userSelect(seedUser) as never);

    await expect(usersService.remove(1, 99)).rejects.toThrow(
      'The system admin account cannot be deactivated',
    );
  });
});

// ---------------------------------------------------------------------------
// hardDelete()
// ---------------------------------------------------------------------------

describe('usersService.hardDelete()', () => {
  it('nullifies FK refs in a transaction then deletes the user', async () => {
    const user = buildDispatcher({ id: 5 });
    prismaMock.user.findUnique.mockResolvedValue(userSelect(user) as never);
    // Mock the prisma operations so they return Promises (not undefined) when built for $transaction
    prismaMock.order.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.activityLog.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.user.delete.mockResolvedValue(userSelect(user) as never);
    prismaMock.$transaction.mockResolvedValue([] as never);

    await usersService.hardDelete(5, 1);

    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      expect.anything(), // order.updateMany promise
      expect.anything(), // activityLog.updateMany promise
      expect.anything(), // user.delete promise
    ]);
  });

  it('throws when a user tries to delete themselves', async () => {
    await expect(usersService.hardDelete(1, 1)).rejects.toThrow('Cannot delete your own account');
  });

  it('throws when trying to hard-delete the seed user', async () => {
    const seedUser = buildUser({ id: 1, email: 'admin@tms.ro' });
    prismaMock.user.findUnique.mockResolvedValue(userSelect(seedUser) as never);

    await expect(usersService.hardDelete(1, 99)).rejects.toThrow(
      'The system admin account cannot be deleted',
    );
  });
});
