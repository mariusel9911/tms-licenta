import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ─── Service mock (hoisted before app import) ─────────────────────────────────
vi.mock('../users.service', () => ({
  usersService: {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    resetPassword: vi.fn(),
    remove: vi.fn(),
    hardDelete: vi.fn(),
  },
}));

import { app } from '../../../app.js';
import { usersService } from '../users.service.js';
import { authHeader, createTestToken } from '../../../__tests__/helpers/auth.js';
import { buildUser } from '../../../__tests__/helpers/factories.js';

const mockService = vi.mocked(usersService);

/** Token for the seed user (system admin) — triggers hardDelete() in the controller */
const systemAdminHeader = () =>
  `Bearer ${createTestToken({ email: 'admin@tms.ro', role: 'ADMIN' })}`;

/** Token for a regular ADMIN (not system admin) */
const adminHeader = () =>
  `Bearer ${createTestToken({ id: 2, email: 'regular-admin@tms.ro', role: 'ADMIN' })}`;

/** Token for a DISPATCHER — should be rejected by the ADMIN guard */
const dispatcherHeader = () =>
  `Bearer ${createTestToken({ id: 3, email: 'dispatcher@tms.ro', role: 'DISPATCHER' })}`;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/users ───────────────────────────────────────────────────────────
describe('GET /api/users', () => {
  it('returns user list for ADMIN', async () => {
    mockService.findAll.mockResolvedValue({
      items: [buildUser()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    } as never);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('returns 403 for DISPATCHER role', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', dispatcherHeader());

    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/users/:id ───────────────────────────────────────────────────────
describe('GET /api/users/:id', () => {
  it('returns user when found', async () => {
    const user = buildUser();
    mockService.findOne.mockResolvedValue(user as never);

    const res = await request(app)
      .get('/api/users/1')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });

  it('returns 404 when user not found', async () => {
    mockService.findOne.mockRejectedValue(new Error('User not found'));

    const res = await request(app)
      .get('/api/users/999')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });
});

// ─── POST /api/users ──────────────────────────────────────────────────────────
describe('POST /api/users', () => {
  const validBody = {
    name: 'New User',
    email: 'new@tms.ro',
    password: 'Password123!',
    role: 'DISPATCHER',
  };

  it('creates user and returns 201', async () => {
    const user = buildUser({ name: 'New User', email: 'new@tms.ro' });
    mockService.create.mockResolvedValue(user as never);

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', adminHeader())
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('New User');
  });

  it('returns 400 on Zod validation error (missing email)', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', adminHeader())
      .send({ name: 'No Email', password: 'pass', role: 'DISPATCHER' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 on duplicate email', async () => {
    mockService.create.mockRejectedValue(
      new Error('A user with this email already exists'),
    );

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', adminHeader())
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('email');
  });
});

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────
describe('PUT /api/users/:id', () => {
  it('updates user and returns success', async () => {
    const updated = buildUser({ name: 'Updated Name' });
    mockService.update.mockResolvedValue(updated as never);

    const res = await request(app)
      .put('/api/users/1')
      .set('Authorization', adminHeader())
      .send({ name: 'Updated Name', role: 'ADMIN', isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });
});

// ─── POST /api/users/:id/reset-password ──────────────────────────────────────
describe('POST /api/users/:id/reset-password', () => {
  it('resets password and returns user', async () => {
    const user = buildUser();
    mockService.resetPassword.mockResolvedValue(user as never);

    const res = await request(app)
      .post('/api/users/1/reset-password')
      .set('Authorization', adminHeader())
      .send({ newPassword: 'NewPassword123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
describe('DELETE /api/users/:id', () => {
  it('deactivates user when requester is regular admin (remove)', async () => {
    const deactivated = buildUser({ isActive: false });
    mockService.remove.mockResolvedValue(deactivated as never);

    const res = await request(app)
      .delete('/api/users/2')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(mockService.remove).toHaveBeenCalled();
    expect(mockService.hardDelete).not.toHaveBeenCalled();
  });

  it('hard-deletes user when requester is system admin (hardDelete)', async () => {
    mockService.hardDelete.mockResolvedValue(undefined as never);

    const res = await request(app)
      .delete('/api/users/2')
      .set('Authorization', systemAdminHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(mockService.hardDelete).toHaveBeenCalled();
    expect(mockService.remove).not.toHaveBeenCalled();
  });
});

// ─── 500 error paths ──────────────────────────────────────────────────────────
describe('500 error handling', () => {
  it('GET /users returns 500 on unexpected error', async () => {
    mockService.findAll.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/users').set('Authorization', adminHeader());
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('GET /users/:id returns 500 on unexpected error', async () => {
    mockService.findOne.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/users/1').set('Authorization', adminHeader());
    expect(res.status).toBe(500);
  });

  it('POST /users returns 500 on unexpected error', async () => {
    mockService.create.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', adminHeader())
      .send({ name: 'X', email: 'x@tms.ro', password: 'Pass123!', role: 'DISPATCHER' });
    expect(res.status).toBe(500);
  });

  it('PUT /users/:id returns 404 when user not found', async () => {
    mockService.update.mockRejectedValue(new Error('User not found'));
    const res = await request(app)
      .put('/api/users/999')
      .set('Authorization', adminHeader())
      .send({ name: 'X', role: 'DISPATCHER', isActive: true });
    expect(res.status).toBe(404);
  });

  it('PUT /users/:id returns 500 on unexpected error', async () => {
    mockService.update.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .put('/api/users/1')
      .set('Authorization', adminHeader())
      .send({ name: 'X', role: 'DISPATCHER', isActive: true });
    expect(res.status).toBe(500);
  });

  it('POST /users/:id/reset-password returns 500 on unexpected error', async () => {
    mockService.resetPassword.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/api/users/1/reset-password')
      .set('Authorization', adminHeader())
      .send({ newPassword: 'NewPass123!' });
    expect(res.status).toBe(500);
  });

  it('DELETE /users/:id returns 500 on unexpected error', async () => {
    mockService.remove.mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/api/users/1').set('Authorization', adminHeader());
    expect(res.status).toBe(500);
  });
});
