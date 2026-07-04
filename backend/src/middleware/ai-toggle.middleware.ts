import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

// ─── In-memory cache (5s TTL) to avoid DB hit on every request ──────────────
//
// AppSettings.aiChatbotEnabled / aiPredictionEnabled can be flipped by an admin
// from the Settings UI at any time. We cache the values for 5 seconds so the
// hot path (every /api/ai/* request) doesn't hit Postgres on each call.
//
// The cache is cleared immediately after a settings update via
// `clearAiToggleCache()` — see settings.controller.ts — so toggles take effect
// with no user-visible delay.
//
// Defaults when the DB is unreachable or the row is missing:
//   - chatbot:    DISABLED (fail-closed — the client mini-PC runs without Ollama)
//   - predictions: ENABLED (fail-open — the Python API is always running in prod)
// These defaults match the production deployment profile.

let cachedChatbotEnabled = false;
let cachedPredictionEnabled = true;
let cacheExpiry = 0;

const CACHE_TTL_MS = 5_000;

async function refreshCache(): Promise<void> {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { aiChatbotEnabled: true, aiPredictionEnabled: true },
    });
    cachedChatbotEnabled = settings?.aiChatbotEnabled ?? false;
    cachedPredictionEnabled = settings?.aiPredictionEnabled ?? true;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
  } catch (err) {
    // On DB error, keep previous cached value — don't block requests due to
    // a transient DB issue. Log as warn so ops can notice.
    logger.warn({ err }, 'AI toggle cache refresh failed');
  }
}

/**
 * Force-clear the cache so toggle changes take effect immediately
 * (called from settings.controller.ts after a settings update).
 */
export function clearAiToggleCache(): void {
  cacheExpiry = 0;
}

/**
 * Read the current chatbot toggle value (cache-aware).
 * Exposed for jobs or tests that need to check the state.
 */
export async function isChatbotEnabled(): Promise<boolean> {
  if (Date.now() >= cacheExpiry) await refreshCache();
  return cachedChatbotEnabled;
}

/**
 * Read the current predictions toggle value (cache-aware).
 */
export async function isPredictionEnabled(): Promise<boolean> {
  if (Date.now() >= cacheExpiry) await refreshCache();
  return cachedPredictionEnabled;
}

/**
 * Middleware: blocks the AI chatbot route (POST /api/ai/chat) when
 * `aiChatbotEnabled` is false in AppSettings.
 *
 * Why this exists: on the client mini-PC we run WITHOUT the Ollama
 * container (profile:ollama is off) to save ~5 GB of RAM. If the chat
 * route is reached with no container running, axios would hang for the
 * full 120-second timeout before failing — a bad user experience and a
 * real backend-thread waster. This middleware short-circuits with 503
 * in <5ms so callers get a clean, fast error.
 */
export const requireChatbotEnabled = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (Date.now() >= cacheExpiry) await refreshCache();

  if (cachedChatbotEnabled) {
    next();
    return;
  }

  res.status(503).json({
    success: false,
    error: 'AI chatbot is currently disabled',
    disabled: true,
  });
};

/**
 * Middleware: blocks all predictions/statistics/revenue/vehicle-finance
 * routes when `aiPredictionEnabled` is false.
 *
 * These routes are backed by pure SQL and/or the Python FastAPI service
 * (http://python-api:8000), both of which are cheap to run. In production
 * this toggle defaults to ON. It exists so the client can disable the
 * entire AI analytics surface in one click if needed (data sensitivity,
 * cost control, Python service down for maintenance, etc.).
 */
export const requirePredictionsEnabled = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (Date.now() >= cacheExpiry) await refreshCache();

  if (cachedPredictionEnabled) {
    next();
    return;
  }

  res.status(503).json({
    success: false,
    error: 'AI predictions are currently disabled',
    disabled: true,
  });
};
