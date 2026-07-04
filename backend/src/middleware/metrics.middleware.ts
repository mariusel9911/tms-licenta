import { Request, Response, NextFunction } from 'express';

const RING_SIZE = 1000;
const MAX_ROUTES = 100;
const startedAt = Date.now();

interface RouteMetrics {
  count: number;
  errors4xx: number;
  errors5xx: number;
  latencies: number[];
  latencyIdx: number;
}

const routes = new Map<string, RouteMetrics>();
let totalRequests = 0;

function normalizeRoute(method: string, path: string): string {
  const normalized = path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id');
  return `${method} ${normalized}`;
}

function getOrCreate(route: string): RouteMetrics {
  let m = routes.get(route);
  if (!m) {
    if (routes.size >= MAX_ROUTES) {
      const oldest = routes.keys().next().value;
      if (oldest !== undefined) routes.delete(oldest);
    }
    m = { count: 0, errors4xx: 0, errors5xx: 0, latencies: [], latencyIdx: 0 };
    routes.set(route, m);
  }
  return m;
}

function recordMetric(route: string, statusCode: number, durationMs: number): void {
  const m = getOrCreate(route);
  m.count++;
  totalRequests++;
  if (statusCode >= 400 && statusCode < 500) m.errors4xx++;
  if (statusCode >= 500) m.errors5xx++;

  if (m.latencies.length < RING_SIZE) {
    m.latencies.push(durationMs);
  } else {
    m.latencies[m.latencyIdx % RING_SIZE] = durationMs;
  }
  m.latencyIdx++;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * (p / 100)) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

export interface MetricsSummary {
  uptime: number;
  totalRequests: number;
  totalErrors4xx: number;
  totalErrors5xx: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerMinute: number;
  topRoutes: Array<{ route: string; count: number; avgMs: number }>;
}

export function getMetricsSummary(): MetricsSummary {
  const uptimeSeconds = (Date.now() - startedAt) / 1000;
  let allLatencies: number[] = [];
  let total4xx = 0;
  let total5xx = 0;

  const routeEntries: Array<{ route: string; count: number; avgMs: number }> = [];

  for (const [route, m] of routes.entries()) {
    total4xx += m.errors4xx;
    total5xx += m.errors5xx;
    allLatencies = allLatencies.concat(m.latencies);

    const sum = m.latencies.reduce((a, b) => a + b, 0);
    routeEntries.push({
      route,
      count: m.count,
      avgMs: m.latencies.length > 0 ? Math.round((sum / m.latencies.length) * 100) / 100 : 0,
    });
  }

  allLatencies.sort((a, b) => a - b);
  const avgAll = allLatencies.length > 0
    ? Math.round((allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length) * 100) / 100
    : 0;

  routeEntries.sort((a, b) => b.count - a.count);

  return {
    uptime: Math.round(uptimeSeconds),
    totalRequests,
    totalErrors4xx: total4xx,
    totalErrors5xx: total5xx,
    avgResponseTime: avgAll,
    p95ResponseTime: Math.round(percentile(allLatencies, 95) * 100) / 100,
    p99ResponseTime: Math.round(percentile(allLatencies, 99) * 100) / 100,
    requestsPerMinute: uptimeSeconds > 0
      ? Math.round((totalRequests / (uptimeSeconds / 60)) * 100) / 100
      : 0,
    topRoutes: routeEntries.slice(0, 10),
  };
}

const EXCLUDED_PATHS = new Set([
  '/api/health',
  '/api/metrics',
  '/api/settings/smtp/test',
  '/api/settings/system-info',
]);

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (EXCLUDED_PATHS.has(req.path)) {
    next();
    return;
  }
  const start = process.hrtime.bigint();
  res.on('close', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    recordMetric(normalizeRoute(req.method, req.path), res.statusCode, durationMs);
  });
  next();
};
