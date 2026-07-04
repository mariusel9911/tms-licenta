import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  appSettings: { findUnique: vi.fn() },
}));

vi.mock('../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../config/env', () => ({ env: { RATE_LIMIT_ENABLED: true } }));

import {
  getCachedRateLimit,
  resetRateLimitCache,
  apiKeyGenerator,
  authLoginLimiter,
  authMfaLimiter,
  previewPdfLimiter,
  apiLimiter,
} from '../rate-limit.middleware.js';

// ── getCachedRateLimit ────────────────────────────────────────────────────────

describe('getCachedRateLimit()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimitCache();
  });

  it('returns rateLimitPerUser from DB when cache is empty', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      rateLimitEnabled: true, rateLimitPerUser: 100,
    });
    expect(await getCachedRateLimit()).toBe(100);
  });

  it('returns 999999 when rateLimitEnabled is false', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      rateLimitEnabled: false, rateLimitPerUser: 50,
    });
    expect(await getCachedRateLimit()).toBe(999999);
  });

  it('defaults to 50 when settings row is null', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue(null);
    expect(await getCachedRateLimit()).toBe(50);
  });

  it('uses cached value without re-querying DB within 30s TTL', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      rateLimitEnabled: true, rateLimitPerUser: 60,
    });
    await getCachedRateLimit();
    await getCachedRateLimit();
    await getCachedRateLimit();
    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledOnce();
  });

  it('keeps previous cached value on DB error without throwing', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      rateLimitEnabled: true, rateLimitPerUser: 80,
    });
    await getCachedRateLimit(); // prime cache to 80

    resetRateLimitCache();      // expire cache, keep cachedRateLimit=50 default
    prismaMock.appSettings.findUnique.mockRejectedValue(new Error('DB down'));

    // Should not throw and should return the previous cached value
    await expect(getCachedRateLimit()).resolves.not.toThrow();
    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledTimes(2);
  });
});

// ── apiKeyGenerator ───────────────────────────────────────────────────────────

describe('apiKeyGenerator()', () => {
  it('returns userId string for authenticated requests', () => {
    const req = { user: { id: 42 }, ip: '1.2.3.4' } as unknown as Request;
    expect(apiKeyGenerator(req)).toBe('42');
  });

  it('falls back to req.ip for unauthenticated requests', () => {
    const req = { user: undefined, ip: '5.6.7.8' } as unknown as Request;
    expect(apiKeyGenerator(req)).toBe('5.6.7.8');
  });

  it('falls back to "unknown" when both user and ip are absent', () => {
    const req = { user: undefined, ip: undefined } as unknown as Request;
    expect(apiKeyGenerator(req)).toBe('unknown');
  });
});

// ── exported limiters ─────────────────────────────────────────────────────────

describe('exported limiters', () => {
  it('exports all four rate limiter middlewares', () => {
    expect(authLoginLimiter).toBeDefined();
    expect(authMfaLimiter).toBeDefined();
    expect(previewPdfLimiter).toBeDefined();
    expect(apiLimiter).toBeDefined();
  });
});
