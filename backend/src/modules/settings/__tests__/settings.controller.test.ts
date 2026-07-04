import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import request from 'supertest';

// ─── Shared prisma mock (imported before vi.mock factories run) ──────────────
import { prismaMock } from '../../../__tests__/helpers/prisma-mock.js';

// ─── mockGetMetrics must be hoisted so the metrics mock factory can reference it
const { mockGetMetrics } = vi.hoisted(() => ({
  mockGetMetrics: vi.fn().mockReturnValue({
    uptime: 3600,
    totalRequests: 100,
    totalErrors4xx: 2,
    totalErrors5xx: 0,
    avgResponseTime: 12.5,
    p95ResponseTime: 40.0,
    p99ResponseTime: 80.0,
    requestsPerMinute: 1.67,
    topRoutes: [],
  }),
}));

vi.mock('../../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../../middleware/metrics.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../middleware/metrics.middleware')>();
  return { ...actual, getMetricsSummary: mockGetMetrics };
});
vi.mock('../../../middleware/maintenance.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../middleware/maintenance.middleware')>();
  return { ...actual, clearMaintenanceCache: vi.fn() };
});
vi.mock('../../../middleware/ai-toggle.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../middleware/ai-toggle.middleware')>();
  return { ...actual, clearAiToggleCache: vi.fn() };
});

// ─── Mock image-validator so magic-byte check passes without a real file ──────
vi.mock('../../../utils/image-validator', () => ({
  isValidImageFile: vi.fn().mockResolvedValue(true),
}));

// ─── Hoisted upload middleware mock (vi.fn() so per-test override is possible) ─
const { mockUploadMiddleware } = vi.hoisted(() => {
  const mockUploadMiddleware = vi.fn(
    (req: Record<string, unknown>, _res: unknown, next: () => void) => {
      req['file'] = { filename: 'company-logo.png', path: '/tmp/company-logo.png', size: 1024, mimetype: 'image/png' };
      next();
    },
  );
  return { mockUploadMiddleware };
});

// ─── nodemailer mock ──────────────────────────────────────────────────────────
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn() },
}));

// ─── Service + middleware mocks (hoisted before app import) ───────────────────
vi.mock('../settings.service', () => ({
  settingsService: {
    get: vi.fn(),
    update: vi.fn(),
    updateLogoPath: vi.fn(),
    updateStampPath: vi.fn(),
  },
}));

vi.mock('../../../middleware/upload.middleware', () => ({
  uploadLogoMiddleware: mockUploadMiddleware,
  uploadStampMiddleware: mockUploadMiddleware,
  uploadBackupMiddleware: mockUploadMiddleware,
}));

import { app } from '../../../app.js';
import nodemailer from 'nodemailer';
import { settingsService } from '../settings.service.js';
import { isValidImageFile } from '../../../utils/image-validator.js';
import { authHeader, createTestToken } from '../../../__tests__/helpers/auth.js';
import { buildAppSettings } from '../../../__tests__/helpers/factories.js';

const mockService = vi.mocked(settingsService);
const nodemailerMock = nodemailer as unknown as { createTransport: ReturnType<typeof vi.fn> };

const adminHeader = () => `Bearer ${createTestToken({ role: 'ADMIN' })}`;
const dispatcherHeader = () =>
  `Bearer ${createTestToken({ role: 'DISPATCHER', email: 'dispatcher@tms.ro' })}`;

beforeEach(() => {
  vi.clearAllMocks();
  mockReset(prismaMock);
  // Re-apply default: inject req.file (clearAllMocks wipes mockImplementation)
  mockUploadMiddleware.mockImplementation(
    (req: Record<string, unknown>, _res: unknown, next: () => void) => {
      req['file'] = { filename: 'company-logo.png', path: '/tmp/company-logo.png', size: 1024, mimetype: 'image/png' };
      next();
    },
  );
});

// ─── GET /api/settings ────────────────────────────────────────────────────────
describe('GET /api/settings', () => {
  it('returns settings data', async () => {
    const settings = buildAppSettings();
    mockService.get.mockResolvedValue(settings);

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.companyName).toBe(settings.companyName);
  });
});

// ─── PUT /api/settings ────────────────────────────────────────────────────────
describe('PUT /api/settings', () => {
  const validBody = { companyName: 'Updated Company SRL' };

  it('updates settings for ADMIN and returns result', async () => {
    const updated = buildAppSettings({ companyName: 'Updated Company SRL' });
    mockService.update.mockResolvedValue(updated);

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', adminHeader())
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.data.companyName).toBe('Updated Company SRL');
  });

  it('returns 403 for DISPATCHER role', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', dispatcherHeader())
      .send(validBody);

    expect(res.status).toBe(403);
  });

  it('returns 400 on Zod validation error (invalid field type)', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', adminHeader())
      .send({ smtpPort: 'not-a-number' }); // smtpPort must be a number

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /api/settings/logo ──────────────────────────────────────────────────
describe('POST /api/settings/logo', () => {
  it('saves logo path and returns updated settings', async () => {
    const updated = buildAppSettings({ companyLogoPath: 'uploads/logos/company-logo.png' });
    mockService.updateLogoPath.mockResolvedValue(updated);

    const res = await request(app)
      .post('/api/settings/logo')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.companyLogoPath).toContain('company-logo.png');
    expect(mockService.updateLogoPath).toHaveBeenCalledWith('uploads/logos/company-logo.png');
  });

  it('returns 400 when no file is uploaded', async () => {
    // Override: middleware calls next() without injecting req.file
    mockUploadMiddleware.mockImplementationOnce(
      (_req: unknown, _res: unknown, next: () => void) => next(),
    );

    const res = await request(app)
      .post('/api/settings/logo')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });
});

// ─── DELETE /api/settings/logo ────────────────────────────────────────────────
describe('DELETE /api/settings/logo', () => {
  it('clears logo path when no existing file', async () => {
    // Return settings with no logo so file deletion branch is skipped
    mockService.get.mockResolvedValue(buildAppSettings({ companyLogoPath: null }));
    const updated = buildAppSettings({ companyLogoPath: null });
    mockService.updateLogoPath.mockResolvedValue(updated);

    const res = await request(app)
      .delete('/api/settings/logo')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.companyLogoPath).toBeNull();
    expect(mockService.updateLogoPath).toHaveBeenCalledWith(null);
  });

  it('enters file-deletion branch when companyLogoPath is set', async () => {
    // Covers if(current.companyLogoPath) branch; fs.existsSync returns false so no unlinkSync
    mockService.get.mockResolvedValue(
      buildAppSettings({ companyLogoPath: 'uploads/logos/nonexistent.png' }),
    );
    const updated = buildAppSettings({ companyLogoPath: null });
    mockService.updateLogoPath.mockResolvedValue(updated);

    const res = await request(app)
      .delete('/api/settings/logo')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(mockService.updateLogoPath).toHaveBeenCalledWith(null);
  });
});

// ─── POST /api/settings/stamp ────────────────────────────────────────────────
describe('POST /api/settings/stamp', () => {
  it('saves stamp path and returns updated settings', async () => {
    const updated = buildAppSettings({ companyStampPath: 'uploads/stamps/company-stamp.png' });
    mockService.updateStampPath.mockResolvedValue(updated);
    // Override middleware to inject a stamp filename
    mockUploadMiddleware.mockImplementationOnce(
      (req: Record<string, unknown>, _res: unknown, next: () => void) => {
        req['file'] = { filename: 'company-stamp.png', path: '/tmp/company-stamp.png', size: 512, mimetype: 'image/png' };
        next();
      },
    );

    const res = await request(app)
      .post('/api/settings/stamp')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.companyStampPath).toContain('company-stamp.png');
    expect(mockService.updateStampPath).toHaveBeenCalledWith('uploads/stamps/company-stamp.png');
  });

  it('returns 400 when no file is uploaded', async () => {
    mockUploadMiddleware.mockImplementationOnce(
      (_req: unknown, _res: unknown, next: () => void) => next(),
    );

    const res = await request(app)
      .post('/api/settings/stamp')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });
});

// ─── DELETE /api/settings/stamp ──────────────────────────────────────────────
describe('DELETE /api/settings/stamp', () => {
  it('clears stamp path when no existing file', async () => {
    mockService.get.mockResolvedValue(buildAppSettings({ companyStampPath: null }));
    const updated = buildAppSettings({ companyStampPath: null });
    mockService.updateStampPath.mockResolvedValue(updated);

    const res = await request(app)
      .delete('/api/settings/stamp')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.companyStampPath).toBeNull();
    expect(mockService.updateStampPath).toHaveBeenCalledWith(null);
  });

  it('enters file-deletion branch when companyStampPath is set', async () => {
    mockService.get.mockResolvedValue(
      buildAppSettings({ companyStampPath: 'uploads/stamps/nonexistent.png' }),
    );
    const updated = buildAppSettings({ companyStampPath: null });
    mockService.updateStampPath.mockResolvedValue(updated);

    const res = await request(app)
      .delete('/api/settings/stamp')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(mockService.updateStampPath).toHaveBeenCalledWith(null);
  });
});

// ─── 500 error paths ──────────────────────────────────────────────────────────
describe('500 error handling', () => {
  it('GET /settings returns 500 on unexpected error', async () => {
    mockService.get.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/settings').set('Authorization', authHeader());
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('PUT /settings returns 500 on unexpected error', async () => {
    mockService.update.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', adminHeader())
      .send({ companyName: 'X' });
    expect(res.status).toBe(500);
  });

  it('POST /settings/logo returns 500 on unexpected error', async () => {
    mockService.updateLogoPath.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/api/settings/logo')
      .set('Authorization', adminHeader());
    expect(res.status).toBe(500);
  });

  it('DELETE /settings/logo returns 500 on unexpected error', async () => {
    mockService.get.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .delete('/api/settings/logo')
      .set('Authorization', adminHeader());
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/settings/smtp/test ────────────────────────────────────────────
describe('POST /api/settings/smtp/test', () => {
  const configuredSettings = () =>
    buildAppSettings({
      smtpHost: 'smtp.example.com',
      smtpEmail: 'test@example.com',
      smtpPassword: 'secret',
      smtpPort: 587,
    });

  it('returns 200 { ok: true } when SMTP is configured and verify succeeds', async () => {
    mockService.get.mockResolvedValue(configuredSettings());
    const mockVerify = vi.fn().mockResolvedValue(true);
    nodemailerMock.createTransport.mockReturnValue({ verify: mockVerify } as never);

    const res = await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
    expect(mockVerify).toHaveBeenCalledOnce();
  });

  it('creates transporter with connectionTimeout:10000', async () => {
    mockService.get.mockResolvedValue(configuredSettings());
    nodemailerMock.createTransport.mockReturnValue({ verify: vi.fn().mockResolvedValue(true) } as never);

    await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ connectionTimeout: 10000 }),
    );
  });

  it('uses secure:true when port is 465', async () => {
    mockService.get.mockResolvedValue(configuredSettings());
    nodemailerMock.createTransport.mockReturnValue({ verify: vi.fn().mockResolvedValue(true) } as never);
    mockService.get.mockResolvedValue(buildAppSettings({
      smtpHost: 'smtp.example.com', smtpEmail: 'test@example.com',
      smtpPassword: 'secret', smtpPort: 465, smtpSecure: true,
    }));

    await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(nodemailerMock.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it('returns 400 "SMTP not configured" when host is empty', async () => {
    mockService.get.mockResolvedValue(
      buildAppSettings({ smtpHost: '', smtpEmail: 'test@example.com', smtpPassword: 'secret' }),
    );

    const res = await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('SMTP not configured');
  });

  it('returns 400 "SMTP not configured" when email is empty', async () => {
    mockService.get.mockResolvedValue(
      buildAppSettings({ smtpHost: 'smtp.example.com', smtpEmail: '', smtpPassword: 'secret' }),
    );

    const res = await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('SMTP not configured');
  });

  it('returns 400 "SMTP not configured" when password is empty', async () => {
    mockService.get.mockResolvedValue(
      buildAppSettings({ smtpHost: 'smtp.example.com', smtpEmail: 'test@example.com', smtpPassword: '' }),
    );

    const res = await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('SMTP not configured');
  });

  it('returns 400 "Connection refused" on ECONNREFUSED', async () => {
    mockService.get.mockResolvedValue(configuredSettings());
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:587'), { code: 'ECONNREFUSED' });
    nodemailerMock.createTransport.mockReturnValue({ verify: vi.fn().mockRejectedValue(err) } as never);

    const res = await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Connection refused');
  });

  it('returns 400 "Connection timed out" on ESOCKET (nodemailer timeout wrapper)', async () => {
    mockService.get.mockResolvedValue(configuredSettings());
    const err = Object.assign(new Error('connect ETIMEDOUT 142.251.127.109:587'), { code: 'ESOCKET' });
    nodemailerMock.createTransport.mockReturnValue({ verify: vi.fn().mockRejectedValue(err) } as never);

    const res = await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Connection timed out');
  });

  it('returns 400 "Host not found" on ENOTFOUND', async () => {
    mockService.get.mockResolvedValue(configuredSettings());
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND notahost.invalid'), { code: 'ENOTFOUND' });
    nodemailerMock.createTransport.mockReturnValue({ verify: vi.fn().mockRejectedValue(err) } as never);

    const res = await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Host not found');
  });

  it('returns 400 "Invalid credentials" when error message contains 535', async () => {
    mockService.get.mockResolvedValue(configuredSettings());
    const err = new Error('535 Authentication failed: Invalid username or password');
    nodemailerMock.createTransport.mockReturnValue({ verify: vi.fn().mockRejectedValue(err) } as never);

    const res = await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 403 for DISPATCHER role', async () => {
    const res = await request(app)
      .post('/api/settings/smtp/test')
      .set('Authorization', dispatcherHeader());

    expect(res.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).post('/api/settings/smtp/test');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/settings — non-admin branch ────────────────────────────────────
describe('GET /api/settings — role-based masking', () => {
  it('omits smtpPassword and smartbillApiToken keys for DISPATCHER role', async () => {
    const settings = buildAppSettings({ smtpPassword: 'secret', smartbillApiToken: 'token' });
    mockService.get.mockResolvedValue(settings);

    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', dispatcherHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).not.toHaveProperty('smtpPassword');
    expect(res.body.data).not.toHaveProperty('smartbillApiToken');
    // public fields still present
    expect(res.body.data.companyName).toBe(settings.companyName);
  });
});

// ─── POST /api/settings/logo — invalid file content ──────────────────────────
describe('POST /api/settings/logo — invalid image', () => {
  it('returns 400 when isValidImageFile returns false', async () => {
    vi.mocked(isValidImageFile).mockResolvedValueOnce(false);
    // Controller calls fs.unlinkSync on the temp file — stub it to avoid ENOENT
    const { default: fs } = await import('fs');
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/settings/logo')
      .set('Authorization', adminHeader());

    unlinkSpy.mockRestore();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid file content/);
  });
});

// ─── POST /api/settings/stamp — invalid file content ─────────────────────────
describe('POST /api/settings/stamp — invalid image', () => {
  it('returns 400 when isValidImageFile returns false', async () => {
    vi.mocked(isValidImageFile).mockResolvedValueOnce(false);
    mockUploadMiddleware.mockImplementationOnce(
      (req: Record<string, unknown>, _res: unknown, next: () => void) => {
        req['file'] = { filename: 'stamp.png', path: '/tmp/stamp.png', size: 512, mimetype: 'image/png' };
        next();
      },
    );
    const { default: fs } = await import('fs');
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    const res = await request(app)
      .post('/api/settings/stamp')
      .set('Authorization', adminHeader());

    unlinkSpy.mockRestore();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid file content/);
  });
});

// ─── GET /api/settings/system-info ───────────────────────────────────────────
describe('GET /api/settings/system-info', () => {
  // SEED_USER_EMAIL is 'admin@tms.ro' in .env.test
  const sysAdminHeader = () => `Bearer ${createTestToken({ email: 'admin@tms.ro', role: 'ADMIN' })}`;

  it('returns 403 when user is not the system admin', async () => {
    const res = await request(app)
      .get('/api/settings/system-info')
      .set('Authorization', adminHeader()); // default: test-admin@tms.ro, not SEED_USER_EMAIL

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('System admin access required');
  });

  it('returns system info for the system admin', async () => {
    const settings = buildAppSettings({ maintenanceEnabled: false } as never);
    mockService.get.mockResolvedValue(settings);
    prismaMock.$queryRaw.mockResolvedValue([{ size: BigInt(2048000) }] as never);

    const res = await request(app)
      .get('/api/settings/system-info')
      .set('Authorization', sysAdminHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      nodeVersion: expect.any(String),
      uptime: expect.any(Number),
      totalRequests: expect.any(Number),
      databaseSizeBytes: 2048000,
    });
    expect(mockGetMetrics).toHaveBeenCalledOnce();
  });

  it('returns 500 on DB error in system-info', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('DB unreachable'));

    const res = await request(app)
      .get('/api/settings/system-info')
      .set('Authorization', sysAdminHeader());

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});
