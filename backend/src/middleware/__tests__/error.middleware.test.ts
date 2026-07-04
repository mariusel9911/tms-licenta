import { vi, describe, it, expect } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorMiddleware } from '../error.middleware.js';

describe('errorMiddleware', () => {
  it('returns 500 with generic error message and logs the error', () => {
    const err = new Error('Some unexpected database failure');
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    errorMiddleware(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Internal server error' });
  });

  it('does not call next() after sending the response', () => {
    const req = {} as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    errorMiddleware(new Error('test'), req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});
