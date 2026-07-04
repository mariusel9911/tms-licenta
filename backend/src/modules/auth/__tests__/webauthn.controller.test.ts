import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ─── Service mocks (hoisted before app import) ───────────────────────────────
vi.mock('../webauthn.service', () => ({
  webAuthnService: {
    generateRegistrationOptions: vi.fn(),
    verifyRegistration: vi.fn(),
    generateAuthenticationOptions: vi.fn(),
    listAuthenticators: vi.fn(),
    removeAuthenticator: vi.fn(),
    renameAuthenticator: vi.fn(),
  },
}));

vi.mock('../../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    JWT_EXPIRES_IN: '8h',
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_RP_NAME: 'TMS Transport',
    WEBAUTHN_ORIGIN: 'http://localhost:5173',
    PORT: 3001,
    NODE_ENV: 'test',
    SEED_USER_EMAIL: 'admin@tms.ro',
    RATE_LIMIT_ENABLED: 'false',
  },
}));

import { app } from '../../../app.js';
import { webAuthnService } from '../webauthn.service.js';
import { authHeader } from '../../../__tests__/helpers/auth.js';

const mockWebAuthn = vi.mocked(webAuthnService);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/auth/mfa/passkey/register/options ───────────────────────────────
describe('GET /api/auth/mfa/passkey/register/options', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/auth/mfa/passkey/register/options');
    expect(res.status).toBe(401);
  });

  it('returns registration options for authenticated user', async () => {
    mockWebAuthn.generateRegistrationOptions.mockResolvedValue({ challenge: 'challenge-abc' } as never);

    const res = await request(app)
      .get('/api/auth/mfa/passkey/register/options')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.challenge).toBe('challenge-abc');
    expect(mockWebAuthn.generateRegistrationOptions).toHaveBeenCalledWith(1);
  });
});

// ─── POST /api/auth/mfa/passkey/register/verify ───────────────────────────────
describe('POST /api/auth/mfa/passkey/register/verify', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/auth/mfa/passkey/register/verify').send({});
    expect(res.status).toBe(401);
  });

  it('creates passkey and returns 201', async () => {
    const mockAuth = { id: 'auth-1', deviceName: 'My Key', createdAt: new Date().toISOString() };
    mockWebAuthn.verifyRegistration.mockResolvedValue(mockAuth as never);

    const res = await request(app)
      .post('/api/auth/mfa/passkey/register/verify')
      .set('Authorization', authHeader())
      .send({ deviceName: 'My Key', id: 'cred-id', rawId: 'raw-id', response: {}, type: 'public-key' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('auth-1');
  });

  it('returns 400 on verification_failed', async () => {
    mockWebAuthn.verifyRegistration.mockRejectedValue(new Error('verification_failed'));

    const res = await request(app)
      .post('/api/auth/mfa/passkey/register/verify')
      .set('Authorization', authHeader())
      .send({ id: 'cred-id', rawId: 'raw-id', response: {}, type: 'public-key' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('verification_failed');
  });

  it('returns 400 on no_challenge', async () => {
    mockWebAuthn.verifyRegistration.mockRejectedValue(new Error('no_challenge'));

    const res = await request(app)
      .post('/api/auth/mfa/passkey/register/verify')
      .set('Authorization', authHeader())
      .send({ id: 'cred-id', rawId: 'raw-id', response: {}, type: 'public-key' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('no_challenge');
  });
});

// ─── GET /api/auth/mfa/passkeys ───────────────────────────────────────────────
describe('GET /api/auth/mfa/passkeys', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/auth/mfa/passkeys');
    expect(res.status).toBe(401);
  });

  it('returns passkey list for authenticated user', async () => {
    const list = [{ id: 'auth-1', deviceName: 'Key', createdAt: new Date().toISOString() }];
    mockWebAuthn.listAuthenticators.mockResolvedValue(list as never);

    const res = await request(app)
      .get('/api/auth/mfa/passkeys')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(mockWebAuthn.listAuthenticators).toHaveBeenCalledWith(1);
  });
});

// ─── DELETE /api/auth/mfa/passkeys/:id ───────────────────────────────────────
describe('DELETE /api/auth/mfa/passkeys/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).delete('/api/auth/mfa/passkeys/auth-1');
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful deletion', async () => {
    mockWebAuthn.removeAuthenticator.mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/api/auth/mfa/passkeys/auth-1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockWebAuthn.removeAuthenticator).toHaveBeenCalledWith(1, 'auth-1');
  });

  it('returns 404 when passkey not found', async () => {
    mockWebAuthn.removeAuthenticator.mockRejectedValue(new Error('not_found'));

    const res = await request(app)
      .delete('/api/auth/mfa/passkeys/auth-1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── PATCH /api/auth/mfa/passkeys/:id ────────────────────────────────────────
describe('PATCH /api/auth/mfa/passkeys/:id', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/auth/mfa/passkeys/auth-1').send({ deviceName: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when deviceName is empty', async () => {
    const res = await request(app)
      .patch('/api/auth/mfa/passkeys/auth-1')
      .set('Authorization', authHeader())
      .send({ deviceName: '' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when deviceName is missing', async () => {
    const res = await request(app)
      .patch('/api/auth/mfa/passkeys/auth-1')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns updated passkey', async () => {
    const updated = { id: 'auth-1', deviceName: 'New Name', createdAt: new Date().toISOString() };
    mockWebAuthn.renameAuthenticator.mockResolvedValue(updated as never);

    const res = await request(app)
      .patch('/api/auth/mfa/passkeys/auth-1')
      .set('Authorization', authHeader())
      .send({ deviceName: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deviceName).toBe('New Name');
    expect(mockWebAuthn.renameAuthenticator).toHaveBeenCalledWith(1, 'auth-1', 'New Name');
  });
});
