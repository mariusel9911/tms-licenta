import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ─── Service mocks (hoisted before app import) ───────────────────────────────
vi.mock('../partners.service', () => ({
  partnersService: {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../vies.service', () => ({
  lookupVies: vi.fn(),
}));

import { app } from '../../../app.js';
import { partnersService } from '../partners.service.js';
import { lookupVies } from '../vies.service.js';
import { authHeader, createDispatcherToken } from '../../../__tests__/helpers/auth.js';
import { buildPartner } from '../../../__tests__/helpers/factories.js';

const mockService = vi.mocked(partnersService);
const mockVies = vi.mocked(lookupVies);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/partners ────────────────────────────────────────────────────────
describe('GET /api/partners', () => {
  it('returns paginated list of partners', async () => {
    const partner = buildPartner();
    mockService.findAll.mockResolvedValue({
      items: [partner],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const res = await request(app)
      .get('/api/partners')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/partners');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/partners/:id ────────────────────────────────────────────────────
describe('GET /api/partners/:id', () => {
  it('returns partner when found', async () => {
    const partner = buildPartner();
    mockService.findOne.mockResolvedValue(partner);

    const res = await request(app)
      .get('/api/partners/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(partner.id);
  });

  it('returns 404 when partner not found', async () => {
    mockService.findOne.mockRejectedValue(new Error('Partner not found'));

    const res = await request(app)
      .get('/api/partners/999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Partner not found');
  });

  it('returns 400 for non-numeric ID', async () => {
    const res = await request(app)
      .get('/api/partners/abc')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid partner ID');
  });
});

// ─── POST /api/partners ───────────────────────────────────────────────────────
describe('POST /api/partners', () => {
  const validBody = {
    name: 'New Partner SRL',
    fiscalCode: 'RO99999999',
    country: 'Romania',
    addressLine1: 'Str. Test 1',
    phone: '+40712345678',
    email: 'new@partner.ro',
    contactPerson: 'Ion Test',
    partnerType: 'CLIENT',
  };

  it('creates partner and returns 201', async () => {
    const partner = buildPartner(validBody);
    mockService.create.mockResolvedValue(partner);

    const res = await request(app)
      .post('/api/partners')
      .set('Authorization', authHeader())
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(validBody.name);
  });

  it('returns 400 on Zod validation error (missing required field)', async () => {
    const res = await request(app)
      .post('/api/partners')
      .set('Authorization', authHeader())
      .send({ name: 'Missing fields' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when fiscal code already exists', async () => {
    mockService.create.mockRejectedValue(
      new Error('A partner with this fiscal code already exists'),
    );

    const res = await request(app)
      .post('/api/partners')
      .set('Authorization', authHeader())
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('fiscal code');
  });
});

// ─── PUT /api/partners/:id ────────────────────────────────────────────────────
describe('PUT /api/partners/:id', () => {
  it('updates partner successfully', async () => {
    const updated = buildPartner({ name: 'Updated Name' });
    mockService.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/partners/1')
      .set('Authorization', authHeader())
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });
});

// ─── DELETE /api/partners/:id ─────────────────────────────────────────────────
describe('DELETE /api/partners/:id', () => {
  it('deletes partner and returns null', async () => {
    mockService.remove.mockResolvedValue(undefined as never);

    const res = await request(app)
      .delete('/api/partners/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});

// ─── GET /api/partners/vies ───────────────────────────────────────────────────
describe('GET /api/partners/vies', () => {
  it('returns VIES company data on success', async () => {
    mockVies.mockResolvedValue({ name: 'Company SA', address: 'Str. Test 1, Timisoara' });

    const res = await request(app)
      .get('/api/partners/vies?vat=RO12345678')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Company SA');
  });

  it('returns 400 when vat query param is missing', async () => {
    const res = await request(app)
      .get('/api/partners/vies')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('vat');
  });
});

// ─── 500 error paths ──────────────────────────────────────────────────────────
describe('500 error handling', () => {
  it('GET /partners returns 500 on unexpected error', async () => {
    vi.mocked(partnersService.findAll).mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/partners').set('Authorization', authHeader());
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('GET /partners/:id returns 500 on unexpected error', async () => {
    vi.mocked(partnersService.findOne).mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/partners/1').set('Authorization', authHeader());
    expect(res.status).toBe(500);
  });

  it('POST /partners returns 500 on unexpected error', async () => {
    vi.mocked(partnersService.create).mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/api/partners')
      .set('Authorization', authHeader())
      .send({ name: 'X', fiscalCode: 'RO1', country: 'Romania', addressLine1: 'A', phone: '+40700000001', email: 'x@y.ro', contactPerson: 'Z', partnerType: 'CLIENT' });
    expect(res.status).toBe(500);
  });

  it('PUT /partners/:id returns 500 on unexpected error', async () => {
    vi.mocked(partnersService.update).mockRejectedValue(new Error('DB error'));
    const res = await request(app).put('/api/partners/1').set('Authorization', authHeader()).send({ name: 'X' });
    expect(res.status).toBe(500);
  });

  it('DELETE /partners/:id returns 500 on unexpected error', async () => {
    vi.mocked(partnersService.remove).mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/api/partners/1').set('Authorization', authHeader());
    expect(res.status).toBe(500);
  });

  it('GET /vies returns 500 on unexpected error', async () => {
    mockVies.mockRejectedValue(new Error('Network error'));
    const res = await request(app).get('/api/partners/vies?vat=RO1').set('Authorization', authHeader());
    expect(res.status).toBe(500);
  });

  it('PUT /partners/:id returns 404 when partner not found', async () => {
    vi.mocked(partnersService.update).mockRejectedValue(new Error('Partner not found'));
    const res = await request(app).put('/api/partners/999').set('Authorization', authHeader()).send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

// ─── RBAC: DISPATCHER role ────────────────────────────────────────────────────
describe('DELETE /api/partners/:id — RBAC', () => {
  it('returns 403 when called by DISPATCHER', async () => {
    const res = await request(app)
      .delete('/api/partners/1')
      .set('Authorization', `Bearer ${createDispatcherToken()}`);

    expect(res.status).toBe(403);
  });
});
