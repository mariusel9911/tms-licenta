import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../role.middleware.js';

function makeReq(user?: { id: number; email: string; role: 'ADMIN' | 'DISPATCHER' }): Request {
  return { user } as unknown as Request;
}

function makeRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('requireAdmin', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('calls next() when the user has ADMIN role', () => {
    const req = makeReq({ id: 1, email: 'admin@tms.ro', role: 'ADMIN' });
    const res = makeRes();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when the user has DISPATCHER role', () => {
    const req = makeReq({ id: 2, email: 'dispatcher@tms.ro', role: 'DISPATCHER' });
    const res = makeRes();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is undefined (unauthenticated)', () => {
    const req = makeReq(undefined);
    const res = makeRes();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
