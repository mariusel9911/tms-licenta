import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ─── Service mock (hoisted before app import) ─────────────────────────────────
vi.mock('../vehicles.service', () => ({
  vehiclesService: {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { app } from '../../../app.js';
import { vehiclesService } from '../vehicles.service.js';
import { authHeader, createDispatcherToken } from '../../../__tests__/helpers/auth.js';
import { buildVehicle } from '../../../__tests__/helpers/factories.js';

const mockService = vi.mocked(vehiclesService);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/vehicles ────────────────────────────────────────────────────────
describe('GET /api/vehicles', () => {
  it('returns paginated vehicle list', async () => {
    const vehicle = buildVehicle();
    mockService.findAll.mockResolvedValue({
      items: [vehicle],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const res = await request(app)
      .get('/api/vehicles')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
  });
});

// ─── GET /api/vehicles/:id ────────────────────────────────────────────────────
describe('GET /api/vehicles/:id', () => {
  it('returns vehicle when found', async () => {
    const vehicle = buildVehicle();
    mockService.findOne.mockResolvedValue(vehicle);

    const res = await request(app)
      .get('/api/vehicles/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.licensePlate).toBe(vehicle.licensePlate);
  });

  it('returns 404 when vehicle not found', async () => {
    mockService.findOne.mockRejectedValue(new Error('Vehicle not found'));

    const res = await request(app)
      .get('/api/vehicles/999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Vehicle not found');
  });

  it('returns 400 for non-numeric ID', async () => {
    const res = await request(app)
      .get('/api/vehicles/abc')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid vehicle ID');
  });
});

// ─── POST /api/vehicles ───────────────────────────────────────────────────────
describe('POST /api/vehicles', () => {
  const validBody = {
    licensePlate: 'TM01XYZ',
    status: 'AVAILABLE',
  };

  it('creates vehicle and returns 201', async () => {
    const vehicle = buildVehicle({ licensePlate: 'TM01XYZ' });
    mockService.create.mockResolvedValue(vehicle);

    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', authHeader())
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data.licensePlate).toBe('TM01XYZ');
  });

  it('returns 409 when license plate already exists', async () => {
    mockService.create.mockRejectedValue(
      new Error('A vehicle with this license plate already exists'),
    );

    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', authHeader())
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('license plate');
  });
});

// ─── PUT /api/vehicles/:id ────────────────────────────────────────────────────
describe('PUT /api/vehicles/:id', () => {
  it('updates vehicle and returns success', async () => {
    const updated = buildVehicle({ licensePlate: 'TM99ZZZ' });
    mockService.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/vehicles/1')
      .set('Authorization', authHeader())
      .send({ licensePlate: 'TM99ZZZ' });

    expect(res.status).toBe(200);
    expect(res.body.data.licensePlate).toBe('TM99ZZZ');
  });
});

// ─── DELETE /api/vehicles/:id ─────────────────────────────────────────────────
describe('DELETE /api/vehicles/:id', () => {
  it('deletes vehicle and returns null', async () => {
    mockService.remove.mockResolvedValue(undefined as never);

    const res = await request(app)
      .delete('/api/vehicles/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

// ─── 500 error paths ──────────────────────────────────────────────────────────
describe('500 error handling', () => {
  it('GET /vehicles returns 500 on unexpected error', async () => {
    vi.mocked(vehiclesService.findAll).mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/vehicles').set('Authorization', authHeader());
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('GET /vehicles/:id returns 500 on unexpected error', async () => {
    vi.mocked(vehiclesService.findOne).mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/vehicles/1').set('Authorization', authHeader());
    expect(res.status).toBe(500);
  });

  it('POST /vehicles returns 500 on unexpected error', async () => {
    vi.mocked(vehiclesService.create).mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/api/vehicles')
      .set('Authorization', authHeader())
      .send({ licensePlate: 'TM01ABC', status: 'AVAILABLE' });
    expect(res.status).toBe(500);
  });

  it('PUT /vehicles/:id returns 404 when vehicle not found', async () => {
    vi.mocked(vehiclesService.update).mockRejectedValue(new Error('Vehicle not found'));
    const res = await request(app).put('/api/vehicles/999').set('Authorization', authHeader()).send({ licensePlate: 'X' });
    expect(res.status).toBe(404);
  });

  it('PUT /vehicles/:id returns 500 on unexpected error', async () => {
    vi.mocked(vehiclesService.update).mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/api/vehicles/1').set('Authorization', authHeader()).send({ licensePlate: 'X' });
    expect(res.status).toBe(500);
  });

  it('DELETE /vehicles/:id returns 500 on unexpected error', async () => {
    vi.mocked(vehiclesService.remove).mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/api/vehicles/1').set('Authorization', authHeader());
    expect(res.status).toBe(500);
  });
});

// ─── RBAC: DISPATCHER role ────────────────────────────────────────────────────
describe('DELETE /api/vehicles/:id — RBAC', () => {
  it('returns 403 when called by DISPATCHER', async () => {
    const res = await request(app)
      .delete('/api/vehicles/1')
      .set('Authorization', `Bearer ${createDispatcherToken()}`);

    expect(res.status).toBe(403);
  });
});
