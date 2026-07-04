import { Request } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

// When RATE_LIMIT_ENABLED is false (default in dev), all requests bypass the limiter.
// Set RATE_LIMIT_ENABLED=true in production .env to activate.
// Leave it unset during load/stress tests so they don't get throttled.
const skip = () => !env.RATE_LIMIT_ENABLED;

const RATE_LIMIT_RESPONSE = {
  success: false,
  error: 'Too many attempts. Please try again later.',
};

// ─── Dynamic per-user rate limit from AppSettings (cached 30s) ──────────────
let cachedRateLimit = 50;
let rateLimitCacheExpiry = 0;

export async function getCachedRateLimit(): Promise<number> {
  if (Date.now() < rateLimitCacheExpiry) return cachedRateLimit;
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { rateLimitPerUser: true, rateLimitEnabled: true },
    });
    if (settings && !settings.rateLimitEnabled) {
      cachedRateLimit = 999999; // Effectively disabled
    } else {
      cachedRateLimit = settings?.rateLimitPerUser ?? 50;
    }
  } catch {
    // On DB error, keep previous cached value
  }
  rateLimitCacheExpiry = Date.now() + 30_000;
  return cachedRateLimit;
}

export function resetRateLimitCache(): void {
  cachedRateLimit = 50;
  rateLimitCacheExpiry = 0;
}

// 20 login attempts per IP per 15 minutes.
// A legitimate user logs in once per session — this limit is never reached in normal use.
// A brute-force bot hits it within seconds.
export const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: RATE_LIMIT_RESPONSE,
});

// 10 MFA verify attempts per IP per 15 minutes.
// Attacker must hold a valid 5-min mfaToken to even reach this endpoint,
// so the real limit is 10 wrong TOTP guesses per token.
export const authMfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: RATE_LIMIT_RESPONSE,
});

// 5 PDF previews per IP per minute — each spawns a headless Chromium process.
export const previewPdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: RATE_LIMIT_RESPONSE,
});

// General API limiter applied to all authenticated business endpoints.
// Per-user keying: authenticated requests use userId, unauthenticated fall back to IP.
// Dynamic limit from AppSettings (default 50 req/min).
export function apiKeyGenerator(req: Request): string {
  const userId = (req as Request & { user?: { id: number } }).user?.id?.toString();
  if (userId) return userId;
  return ipKeyGenerator(req.ip ?? 'unknown');
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: async () => getCachedRateLimit(),
  keyGenerator: apiKeyGenerator,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: RATE_LIMIT_RESPONSE,
});
