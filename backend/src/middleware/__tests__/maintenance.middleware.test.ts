import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import type { Request, Response, NextFunction } from 'express';

// Undo the global mock from setup.ts so this file tests the real implementation
vi.unmock('../maintenance.middleware');

// ─── Import shared prismaMock (pattern from settings.service.test.ts) ─────────
import { prismaMock } from '../../__tests__/helpers/prisma-mock.js';

vi.mock('../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../config/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../../config/env', () => ({
  env: { SEED_USER_EMAIL: 'sysadmin@tms.ro' },
}));

import {
  maintenanceMiddleware,
  isMaintenanceActive,
  clearMaintenanceCache,
} from '../maintenance.middleware.js';

function makeReq(userOverrides: Record<string, unknown> = {}): Request {
  return { user: userOverrides } as unknown as Request;
}

function makeRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  mockReset(prismaMock);
  clearMaintenanceCache();
});

// ─── isMaintenanceActive ─────────────────────────────────────────────────────

describe('isMaintenanceActive()', () => {
  it('returns false when DB reports maintenance is off', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      maintenanceEnabled: false,
      maintenanceMessage: '',
    } as never);

    const result = await isMaintenanceActive();

    expect(result).toBe(false);
    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledOnce();
  });

  it('returns true when DB reports maintenance is on', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      maintenanceEnabled: true,
      maintenanceMessage: 'Scheduled maintenance',
    } as never);

    const result = await isMaintenanceActive();

    expect(result).toBe(true);
  });

  it('uses cached value on second call within TTL', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      maintenanceEnabled: false,
      maintenanceMessage: '',
    } as never);

    await isMaintenanceActive();
    await isMaintenanceActive(); // second call — should use cache

    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledOnce();
  });

  it('keeps previous value and does NOT throw on DB error', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      maintenanceEnabled: false,
      maintenanceMessage: '',
    } as never);
    await isMaintenanceActive();

    clearMaintenanceCache();
    prismaMock.appSettings.findUnique.mockRejectedValue(new Error('DB connection lost'));

    const result = await isMaintenanceActive();
    expect(result).toBe(false);
  });
});

// ─── clearMaintenanceCache ───────────────────────────────────────────────────

describe('clearMaintenanceCache()', () => {
  it('forces a fresh DB read on the next isMaintenanceActive call', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      maintenanceEnabled: false,
      maintenanceMessage: '',
    } as never);

    await isMaintenanceActive();
    clearMaintenanceCache();
    await isMaintenanceActive();

    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledTimes(2);
  });
});

// ─── maintenanceMiddleware ────────────────────────────────────────────────────

describe('maintenanceMiddleware', () => {
  it('calls next() immediately when maintenance is OFF', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      maintenanceEnabled: false,
      maintenanceMessage: '',
    } as never);
    const next = vi.fn() as NextFunction;

    await maintenanceMiddleware(makeReq({ email: 'user@tms.ro' }), makeRes(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next() for system admin even when maintenance is ON', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      maintenanceEnabled: true,
      maintenanceMessage: 'Deploying update',
    } as never);
    const next = vi.fn() as NextFunction;
    const res = makeRes();

    await maintenanceMiddleware(makeReq({ email: 'sysadmin@tms.ro' }), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 503 for a regular user when maintenance is ON', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      maintenanceEnabled: true,
      maintenanceMessage: 'Back soon',
    } as never);
    const next = vi.fn() as NextFunction;
    const res = makeRes();

    await maintenanceMiddleware(makeReq({ email: 'dispatcher@tms.ro' }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, maintenance: true, message: 'Back soon' }),
    );
  });

  it('returns 503 for unauthenticated request when maintenance is ON', async () => {
    prismaMock.appSettings.findUnique.mockResolvedValue({
      maintenanceEnabled: true,
      maintenanceMessage: '',
    } as never);
    const next = vi.fn() as NextFunction;
    const res = makeRes();

    await maintenanceMiddleware({ user: undefined } as unknown as Request, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
