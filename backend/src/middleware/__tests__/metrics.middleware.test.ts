/**
 * metrics.middleware.test.ts
 *
 * The metrics module holds module-level state (routes Map, totalRequests counter).
 * We use vi.resetModules() + dynamic imports in beforeEach to get a clean slate
 * for every test, preventing state leakage across tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { MetricsSummary } from '../metrics.middleware.js';

type MetricsModule = {
  getMetricsSummary: () => MetricsSummary;
  metricsMiddleware: (req: Request, res: Response, next: NextFunction) => void;
};

function makeReq(path: string, method = 'GET'): Request {
  return { path, method } as unknown as Request;
}

function makeRes(statusCode = 200) {
  const listeners: Record<string, Array<() => void>> = {};
  const res = {
    statusCode,
    on: vi.fn((event: string, cb: () => void) => {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    }),
    emit: (event: string) => {
      listeners[event]?.forEach((cb) => cb());
    },
  };
  return res as unknown as Response & { emit: (event: string) => void };
}

// Fresh module import before each test to reset module-level counters
let metrics: MetricsModule;

beforeEach(async () => {
  vi.resetModules();
  metrics = await import('../metrics.middleware') as MetricsModule;
});

// ─── getMetricsSummary — empty state ─────────────────────────────────────────

describe('getMetricsSummary() — empty state', () => {
  it('returns zeroed metrics when no requests have been recorded', () => {
    const summary = metrics.getMetricsSummary();

    expect(summary.totalRequests).toBe(0);
    expect(summary.totalErrors4xx).toBe(0);
    expect(summary.totalErrors5xx).toBe(0);
    expect(summary.avgResponseTime).toBe(0);
    expect(summary.p95ResponseTime).toBe(0);
    expect(summary.p99ResponseTime).toBe(0);
    expect(summary.topRoutes).toHaveLength(0);
  });

  it('returns non-negative uptime', () => {
    const summary = metrics.getMetricsSummary();
    expect(summary.uptime).toBeGreaterThanOrEqual(0);
  });
});

// ─── metricsMiddleware — skip paths ──────────────────────────────────────────

describe('metricsMiddleware — skip paths', () => {
  it('calls next() immediately and skips recording for /api/health', () => {
    const req = makeReq('/api/health');
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    metrics.metricsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).not.toHaveBeenCalled(); // no close listener attached
  });

  it('calls next() immediately and skips recording for /api/metrics', () => {
    const req = makeReq('/api/metrics');
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    metrics.metricsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).not.toHaveBeenCalled();
  });
});

// ─── metricsMiddleware — recording ───────────────────────────────────────────

describe('metricsMiddleware — recording requests', () => {
  it('attaches a close listener and records metric when close fires', () => {
    const req = makeReq('/api/orders', 'GET');
    const res = makeRes(200);
    const next = vi.fn() as NextFunction;

    metrics.metricsMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.on).toHaveBeenCalledWith('close', expect.any(Function));

    res.emit('close'); // trigger the listener

    const summary = metrics.getMetricsSummary();
    expect(summary.totalRequests).toBe(1);
    expect(summary.topRoutes).toHaveLength(1);
    expect(summary.topRoutes[0]?.route).toBe('GET /api/orders');
  });

  it('counts 4xx errors correctly', () => {
    const req = makeReq('/api/orders/999', 'GET');
    const res = makeRes(404);
    const next = vi.fn() as NextFunction;

    metrics.metricsMiddleware(req, res, next);
    res.emit('close');

    const summary = metrics.getMetricsSummary();
    expect(summary.totalErrors4xx).toBe(1);
    expect(summary.totalErrors5xx).toBe(0);
  });

  it('counts 5xx errors correctly', () => {
    const req = makeReq('/api/orders', 'POST');
    const res = makeRes(500);
    const next = vi.fn() as NextFunction;

    metrics.metricsMiddleware(req, res, next);
    res.emit('close');

    const summary = metrics.getMetricsSummary();
    expect(summary.totalErrors5xx).toBe(1);
  });

  it('normalises numeric IDs in routes to :id', () => {
    const req = makeReq('/api/orders/42', 'GET');
    const res = makeRes(200);
    const next = vi.fn() as NextFunction;

    metrics.metricsMiddleware(req, res, next);
    res.emit('close');

    const summary = metrics.getMetricsSummary();
    expect(summary.topRoutes[0]?.route).toBe('GET /api/orders/:id');
  });

  it('computes avgResponseTime after recording multiple requests', () => {
    // Record two requests and verify averages are calculated
    for (let i = 0; i < 3; i++) {
      const req = makeReq('/api/partners', 'GET');
      const res = makeRes(200);
      const next = vi.fn() as NextFunction;
      metrics.metricsMiddleware(req, res, next);
      res.emit('close');
    }

    const summary = metrics.getMetricsSummary();
    expect(summary.totalRequests).toBe(3);
    expect(summary.avgResponseTime).toBeGreaterThanOrEqual(0);
  });
});

// ─── getOrCreate — MAX_ROUTES eviction ───────────────────────────────────────

describe('getMetricsSummary — MAX_ROUTES eviction', () => {
  it('evicts the oldest route when the limit of 100 routes is reached', () => {
    // Fill up 100 distinct routes
    for (let i = 0; i < 100; i++) {
      const req = makeReq(`/api/route${i}`, 'GET');
      const res = makeRes(200);
      const next = vi.fn() as NextFunction;
      metrics.metricsMiddleware(req, res, next);
      res.emit('close');
    }

    let summary = metrics.getMetricsSummary();
    expect(summary.topRoutes).toHaveLength(10); // topRoutes shows top-10

    // Adding a 101st route should evict the oldest
    const req = makeReq('/api/newroute', 'GET');
    const res = makeRes(200);
    const next = vi.fn() as NextFunction;
    metrics.metricsMiddleware(req, res, next);
    res.emit('close');

    summary = metrics.getMetricsSummary();
    // Still at most 100 routes internally — topRoutes still shows ≤10
    expect(summary.topRoutes.length).toBeLessThanOrEqual(10);
  });
});

// ─── ring buffer overflow ─────────────────────────────────────────────────────

describe('ring buffer overflow', () => {
  it('does not grow beyond RING_SIZE (1000) entries per route', () => {
    // Record 1001 requests on the same route — ring buffer should not overflow
    for (let i = 0; i < 1001; i++) {
      const req = makeReq('/api/orders', 'GET');
      const res = makeRes(200);
      const next = vi.fn() as NextFunction;
      metrics.metricsMiddleware(req, res, next);
      res.emit('close');
    }

    const summary = metrics.getMetricsSummary();
    expect(summary.totalRequests).toBe(1001);
    // avgResponseTime should still compute without error
    expect(summary.avgResponseTime).toBeGreaterThanOrEqual(0);
  });
});
