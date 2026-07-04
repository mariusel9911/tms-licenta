import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// ─── In-memory cache (5s TTL) to avoid DB hit on every request ──────────────
let cachedEnabled = false;
let cachedMessage = '';
let cacheExpiry = 0;

async function refreshCache(): Promise<void> {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { maintenanceEnabled: true, maintenanceMessage: true },
    });
    cachedEnabled = settings?.maintenanceEnabled ?? false;
    cachedMessage = settings?.maintenanceMessage ?? '';
    cacheExpiry = Date.now() + 5_000;
  } catch (err) {
    // On DB error, keep previous cached value — don't block requests due to transient DB issue
    logger.warn({ err }, 'Maintenance cache refresh failed');
  }
}

/**
 * Check if maintenance mode is currently active.
 * Used by cron jobs to skip execution during maintenance.
 */
export async function isMaintenanceActive(): Promise<boolean> {
  if (Date.now() >= cacheExpiry) await refreshCache();
  return cachedEnabled;
}

/**
 * Force-clear the cache so changes take effect immediately
 * (called after settings update).
 */
export function clearMaintenanceCache(): void {
  cacheExpiry = 0;
}

/**
 * Middleware: blocks non-system-admin requests when maintenance mode is on.
 * Must be placed AFTER authMiddleware (req.user is available).
 */
export const maintenanceMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (Date.now() >= cacheExpiry) await refreshCache();

  if (!cachedEnabled) {
    next();
    return;
  }

  // System admin bypasses maintenance
  if (req.user?.email === env.SEED_USER_EMAIL) {
    next();
    return;
  }

  res.status(503).json({
    success: false,
    error: 'Service under maintenance',
    maintenance: true,
    message: cachedMessage,
  });
};
