import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ─── Service mocks (hoisted before app import) ───────────────────────────────
vi.mock('../auth.service', () => ({
  authService: {
    login: vi.fn(),
    verifyMfa: vi.fn(),
    getMfaStatus: vi.fn(),
    setupMfa: vi.fn(),
    confirmMfaSetup: vi.fn(),
    disableMfa: vi.fn(),
    getUserById: vi.fn(),
    getRecoveryCodeCount: vi.fn(),
    regenerateRecoveryCodes: vi.fn(),
    requestEmailOtp: vi.fn(),
  },
}));

import { app } from '../../../app.js';
import { authService } from '../auth.service.js';
import { authHeader } from '../../../__tests__/helpers/auth.js';
import { buildUser } from '../../../__tests__/helpers/factories.js';

const mockAuth = vi.mocked(authService);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 200 with token on valid credentials', async () => {
    const mockResult = { token: 'jwt-token', user: { id: 1, email: 'admin@tms.ro', name: 'Admin', role: 'ADMIN' } };
    mockAuth.login.mockResolvedValue(mockResult as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tms.ro', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('jwt-token');
  });

  it('returns 400 on Zod validation error (missing password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tms.ro' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 with invalid_credentials when user not found', async () => {
    mockAuth.login.mockRejectedValue(new Error('User not found'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@tms.ro', password: 'pass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('returns 401 with invalid_credentials on wrong password', async () => {
    mockAuth.login.mockRejectedValue(new Error('Invalid credentials'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tms.ro', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('returns mfaRequired payload when user has MFA enabled', async () => {
    const mfaResult = { mfaRequired: true, mfaToken: 'mfa-jwt-token' };
    mockAuth.login.mockResolvedValue(mfaResult as never);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'mfa@tms.ro', password: 'pass' });

    expect(res.status).toBe(200);
    expect(res.body.data.mfaRequired).toBe(true);
    expect(res.body.data.mfaToken).toBe('mfa-jwt-token');
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns user data with valid token', async () => {
    const user = { ...buildUser(), isSystemAdmin: false };
    mockAuth.getUserById.mockResolvedValue(user as never);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(user.id);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/mfa/verify (public route) ────────────────────────────────
describe('POST /api/auth/mfa/verify', () => {
  it('returns 200 with full token on valid TOTP code', async () => {
    const mockResult = { token: 'full-jwt', user: { id: 1, email: 'admin@tms.ro', name: 'Admin', role: 'ADMIN' } };
    mockAuth.verifyMfa.mockResolvedValue(mockResult as never);

    const res = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ mfaToken: 'mfa-jwt', totpCode: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('full-jwt');
  });

  it('returns 401 on invalid mfa token', async () => {
    mockAuth.verifyMfa.mockRejectedValue(new Error('mfa_token_invalid'));

    const res = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ mfaToken: 'bad', totpCode: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('mfa_token_invalid');
  });
});

// ─── GET /api/auth/mfa/status ─────────────────────────────────────────────────
describe('GET /api/auth/mfa/status', () => {
  it('returns MFA status for authenticated user', async () => {
    mockAuth.getMfaStatus.mockResolvedValue({ totpEnabled: false });

    const res = await request(app)
      .get('/api/auth/mfa/status')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.totpEnabled).toBe(false);
  });
});

// ─── POST /api/auth/mfa/setup ────────────────────────────────────────────────
describe('POST /api/auth/mfa/setup', () => {
  it('returns QR code and secret on success', async () => {
    mockAuth.setupMfa.mockResolvedValue({ qrCodeDataUrl: 'data:image/png...' });

    const res = await request(app)
      .post('/api/auth/mfa/setup')
      .set('Authorization', authHeader())
      .send({ password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.data.qrCodeDataUrl).toBeDefined();
  });
});

// ─── POST /api/auth/mfa/confirm ──────────────────────────────────────────────
describe('POST /api/auth/mfa/confirm', () => {
  it('returns recovery codes on valid TOTP', async () => {
    const codes = ['AAAA-BBBB-CCCC', 'DDDD-EEEE-FFFF'];
    mockAuth.confirmMfaSetup.mockResolvedValue({ recoveryCodes: codes });

    const res = await request(app)
      .post('/api/auth/mfa/confirm')
      .set('Authorization', authHeader())
      .send({ totpCode: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data.recoveryCodes).toEqual(codes);
  });
});

// ─── POST /api/auth/mfa/disable ──────────────────────────────────────────────
describe('POST /api/auth/mfa/disable', () => {
  it('returns success message when MFA disabled', async () => {
    mockAuth.disableMfa.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/auth/mfa/disable')
      .set('Authorization', authHeader())
      .send({ password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('MFA disabled successfully');
  });

  it('returns 401 on wrong_password', async () => {
    mockAuth.disableMfa.mockRejectedValue(new Error('wrong_password'));

    const res = await request(app)
      .post('/api/auth/mfa/disable')
      .set('Authorization', authHeader())
      .send({ password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('wrong_password');
  });
});

// ─── POST /api/auth/mfa/verify — recovery code path ──────────────────────────
describe('POST /api/auth/mfa/verify (recovery code)', () => {
  it('returns 200 with full token on valid recovery code', async () => {
    const mockResult = { token: 'full-jwt', user: { id: 1, email: 'admin@tms.ro', name: 'Admin', role: 'ADMIN' } };
    mockAuth.verifyMfa.mockResolvedValue(mockResult as never);

    const res = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ mfaToken: 'mfa-jwt', recoveryCode: 'AAAA-BBBB-CCCC' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('full-jwt');
  });

  it('returns 401 with recovery_code_invalid on bad recovery code', async () => {
    mockAuth.verifyMfa.mockRejectedValue(new Error('recovery_code_invalid'));

    const res = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ mfaToken: 'mfa-jwt', recoveryCode: 'XXXX-XXXX-XXXX' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('recovery_code_invalid');
  });
});

// ─── GET /api/auth/mfa/recovery-codes/count ──────────────────────────────────
describe('GET /api/auth/mfa/recovery-codes/count', () => {
  it('returns remaining count for authenticated user', async () => {
    mockAuth.getRecoveryCodeCount.mockResolvedValue(8);

    const res = await request(app)
      .get('/api/auth/mfa/recovery-codes/count')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.remaining).toBe(8);
  });
});

// ─── POST /api/auth/mfa/recovery-codes/regenerate ────────────────────────────
describe('POST /api/auth/mfa/recovery-codes/regenerate', () => {
  it('returns new recovery codes on success', async () => {
    const codes = Array.from({ length: 10 }, (_, i) => `CODE-${i}`);
    mockAuth.regenerateRecoveryCodes.mockResolvedValue({ recoveryCodes: codes });

    const res = await request(app)
      .post('/api/auth/mfa/recovery-codes/regenerate')
      .set('Authorization', authHeader())
      .send({ password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.data.recoveryCodes).toEqual(codes);
  });

  it('returns 401 on wrong_password', async () => {
    mockAuth.regenerateRecoveryCodes.mockRejectedValue(new Error('wrong_password'));

    const res = await request(app)
      .post('/api/auth/mfa/recovery-codes/regenerate')
      .set('Authorization', authHeader())
      .send({ password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('wrong_password');
  });
});

// ─── 500 error paths ──────────────────────────────────────────────────────────
describe('500 error handling', () => {
  it('POST /login returns 500 on unexpected error', async () => {
    mockAuth.login.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'pass' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('GET /me returns 404 when getUserById returns null', async () => {
    mockAuth.getUserById.mockResolvedValue(null as never);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('GET /me returns 500 on unexpected error', async () => {
    mockAuth.getUserById.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });

  it('POST /mfa/verify returns 500 on unexpected error', async () => {
    mockAuth.verifyMfa.mockRejectedValue(new Error('unexpected'));

    const res = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ mfaToken: 'tok', totpCode: '123456' });

    expect(res.status).toBe(500);
  });

  it('GET /mfa/status returns 500 on unexpected error', async () => {
    mockAuth.getMfaStatus.mockRejectedValue(new Error('unexpected'));

    const res = await request(app)
      .get('/api/auth/mfa/status')
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });

  it('POST /mfa/setup returns 500 on unexpected error', async () => {
    mockAuth.setupMfa.mockRejectedValue(new Error('unexpected'));

    const res = await request(app)
      .post('/api/auth/mfa/setup')
      .set('Authorization', authHeader())
      .send({ password: 'pass' });

    expect(res.status).toBe(500);
  });

  it('POST /mfa/confirm returns 400 on totp_invalid', async () => {
    mockAuth.confirmMfaSetup.mockRejectedValue(new Error('totp_invalid'));

    const res = await request(app)
      .post('/api/auth/mfa/confirm')
      .set('Authorization', authHeader())
      .send({ totpCode: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('totp_invalid');
  });

  it('POST /mfa/confirm returns 500 on unexpected error', async () => {
    mockAuth.confirmMfaSetup.mockRejectedValue(new Error('unexpected'));

    const res = await request(app)
      .post('/api/auth/mfa/confirm')
      .set('Authorization', authHeader())
      .send({ totpCode: '123456' });

    expect(res.status).toBe(500);
  });

  it('POST /mfa/disable returns 500 on unexpected error', async () => {
    mockAuth.disableMfa.mockRejectedValue(new Error('unexpected'));

    const res = await request(app)
      .post('/api/auth/mfa/disable')
      .set('Authorization', authHeader())
      .send({ password: 'pass' });

    expect(res.status).toBe(500);
  });
});

// ─── POST /api/auth/mfa/email-otp/request (public route) ─────────────────────
describe('POST /api/auth/mfa/email-otp/request', () => {
  it('returns 200 with expiresAt on success', async () => {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    mockAuth.requestEmailOtp.mockResolvedValue({ expiresAt });

    const res = await request(app)
      .post('/api/auth/mfa/email-otp/request')
      .send({ mfaToken: 'valid-mfa-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expiresAt).toBeDefined();
  });

  it('returns 401 when mfaToken is invalid', async () => {
    mockAuth.requestEmailOtp.mockRejectedValue(new Error('mfa_token_invalid'));

    const res = await request(app)
      .post('/api/auth/mfa/email-otp/request')
      .send({ mfaToken: 'bad-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('mfa_token_invalid');
  });

  it('returns 503 when SMTP is not configured', async () => {
    mockAuth.requestEmailOtp.mockRejectedValue(new Error('smtp_not_configured'));

    const res = await request(app)
      .post('/api/auth/mfa/email-otp/request')
      .send({ mfaToken: 'valid-token' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('smtp_not_configured');
  });
});

// ─── POST /api/auth/mfa/verify with emailOtpCode ─────────────────────────────
describe('POST /api/auth/mfa/verify — emailOtpCode', () => {
  it('returns 200 with token when emailOtpCode is valid', async () => {
    const mockResult = { token: 'full-jwt', user: { id: 1, email: 'admin@tms.ro', name: 'Admin', role: 'ADMIN' } };
    mockAuth.verifyMfa.mockResolvedValue(mockResult as never);

    const res = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ mfaToken: 'mfa-jwt', emailOtpCode: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('full-jwt');
    expect(mockAuth.verifyMfa).toHaveBeenCalledWith('mfa-jwt', undefined, undefined, undefined, '123456');
  });

  it('returns 401 when emailOtpCode is invalid or expired', async () => {
    mockAuth.verifyMfa.mockRejectedValue(new Error('email_otp_invalid'));

    const res = await request(app)
      .post('/api/auth/mfa/verify')
      .send({ mfaToken: 'mfa-jwt', emailOtpCode: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('email_otp_invalid');
  });
});
