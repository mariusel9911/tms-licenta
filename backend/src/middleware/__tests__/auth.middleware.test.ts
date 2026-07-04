import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../auth.middleware.js';
import { blacklistToken, _clearBlacklist } from '../../config/token-blacklist.js';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function makeRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('authMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  afterEach(() => {
    _clearBlacklist();
  });

  it('calls next() and attaches req.user for a valid token', () => {
    const token = jwt.sign(
      { id: 1, email: 'test@tms.ro', role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ id: 1, email: 'test@tms.ro', role: 'ADMIN' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is completely missing', () => {
    const req = makeReq({});
    const res = makeRes();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid (garbage) token', () => {
    const req = makeReq({ authorization: 'Bearer this.is.garbage' });
    const res = makeRes();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an expired token', () => {
    const token = jwt.sign(
      { id: 1, email: 'test@tms.ro', role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '-1s' }, // already expired
    );
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with "Bearer "', () => {
    const req = makeReq({ authorization: 'Basic abc123' });
    const res = makeRes();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with "Token has been revoked" for a blacklisted token', () => {
    const jti = 'test-jti-12345';
    const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const token = jwt.sign(
      { id: 1, email: 'test@tms.ro', role: 'ADMIN', jti, exp },
      JWT_SECRET,
    );
    blacklistToken(jti, exp);

    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Token has been revoked' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for a valid token without a jti claim (backward compat)', () => {
    const token = jwt.sign(
      { id: 2, email: 'dispatcher@tms.ro', role: 'DISPATCHER' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
    const req = makeReq({ authorization: `Bearer ${token}` });
    const res = makeRes();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ id: 2, email: 'dispatcher@tms.ro', role: 'DISPATCHER' });
    expect(res.status).not.toHaveBeenCalled();
  });
});
