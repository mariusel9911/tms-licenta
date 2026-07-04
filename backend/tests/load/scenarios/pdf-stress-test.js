/**
 * PDF Stress Test — Puppeteer Isolation
 *
 * Exercises the most CPU-intensive operation in the system:
 * POST /api/orders/preview-pdf (launches a headless Chromium per request via Puppeteer).
 *
 * This test deliberately targets this single endpoint to identify:
 *   - Maximum safe concurrency before OOM / process crash
 *   - Response time degradation under concurrent PDF generation
 *   - Memory pressure characteristics
 *
 * Ramp schedule (~5 minutes total):
 *   0s–30s   Ramp to 2 VUs  (safe baseline — 2 concurrent Chromium instances)
 *  30s–90s   Hold  2 VUs
 *  90s–120s  Ramp to 5 VUs  (at rate limit of 5/min per IP in production)
 * 120s–180s  Hold  5 VUs
 * 180s–210s  Ramp to 10 VUs (2× rate limit — this will likely cause degradation)
 * 210s–270s  Hold  10 VUs   (find the breaking point — OOM / >5s responses)
 * 270s–300s  Ramp to 0 VUs  (recovery)
 *
 * ⚠️  IMPORTANT: Run with RATE_LIMIT_ENABLED=false to bypass the 5/min rate limit.
 *     The rate limiter is already disabled by default in dev (see rate-limit.middleware.ts).
 *
 * Monitor while running:
 *   Windows: Task Manager → node.exe memory  (watch for >500MB spikes)
 *   Linux:   watch -n1 'ps aux | grep node'
 *
 * Run: k6 run backend/tests/load/scenarios/pdf-stress-test.js
 * Or:  npm run test:pdf-stress  (from backend/)
 */

import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

import { BASE_URL, PDF_THRESHOLDS } from '../config.js';
import { login, authHeaders } from '../helpers/auth.js';

// ---------------------------------------------------------------------------
// k6 Options
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    pdf_generation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Ramp to 2 concurrent PDF generators (safe baseline)
        { duration: '30s', target: 2 },
        // Hold — verify 2 concurrent is stable
        { duration: '1m', target: 2 },
        // Ramp to 5 (matches production rate limit — 5/min per IP)
        { duration: '30s', target: 5 },
        // Hold — measure memory + response time at 5 concurrent
        { duration: '1m', target: 5 },
        // Ramp to 10 — 2× rate limit ceiling, expect degradation
        { duration: '30s', target: 10 },
        // Hold — find the breaking point
        { duration: '1m', target: 10 },
        // Ramp down — test recovery
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: PDF_THRESHOLDS,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function setup() {
  const token = login();
  const params = authHeaders(token);

  // Fetch a real partner ID — clientId is required by CreateOrderDto
  const partnersRes = http.get(`${BASE_URL}/api/partners?page=1&limit=1`, {
    ...params,
    tags: { name: 'GET /partners (setup)' },
  });

  let clientId = null;
  if (partnersRes.status === 200) {
    const body = partnersRes.json();
    const partners = body?.data?.items || [];
    if (partners.length > 0) {
      clientId = partners[0].id;
    }
  }

  if (!clientId) {
    fail('No partners found in the database. Seed the database before running the PDF stress test.');
  }

  return { token, clientId };
}

// ---------------------------------------------------------------------------
// Default function — each iteration = one PDF generation request
// ---------------------------------------------------------------------------

export default function ({ token, clientId }) {
  const params = authHeaders(token, { tags: { name: 'preview-pdf' } });

  // Build a realistic order payload for PDF rendering
  const tag = randomString(4).toUpperCase();
  const now = new Date().toISOString();

  const payload = {
    // clientId is required by CreateOrderDto (z.number().int().positive())
    clientId,
    orderSeries: 'BGR',
    documentDate: now,
    pickupAddress: `Warehouse ${tag}, Str. Industriilor nr. ${randomIntBetween(1, 200)}, Cluj-Napoca`,
    pickupCountry: 'Romania',
    deliveryAddress: `Depot ${tag}, Str. Főraktár ${randomIntBetween(1, 100)}, Budapest`,
    deliveryCountry: 'Hungary',
    pickupDateBegin: now,
    deliveryDateBegin: now,
    // Must be numbers, not strings (Zod: z.number().min(0))
    transporterPrice: randomIntBetween(500, 5000),
    transporterCurrency: 'EUR',
    clientPrice: randomIntBetween(600, 6000),
    clientCurrency: 'EUR',
    distanceKm: randomIntBetween(300, 1500),
    // CargoItemSchema fields: qty, weightKg (not quantity/weight/unit)
    cargoItems: [
      {
        description: `Goods ${tag} — electronics pallets`,
        weightKg: randomIntBetween(500, 24000),
        qty: randomIntBetween(1, 10),
      },
    ],
    driverName: `Driver ${randomString(6)}`,
    notes: 'Load test PDF generation — automated.',
  };

  const res = http.post(
    `${BASE_URL}/api/orders/preview-pdf`,
    JSON.stringify(payload),
    params
  );

  check(res, {
    'pdf status 200': (r) => r.status === 200,
    'pdf content-type': (r) =>
      (r.headers['Content-Type'] || '').includes('application/pdf'),
    'pdf has content': (r) => r.body && r.body.length > 100,
  });

  // No think time between PDF requests — we want to measure raw concurrency impact
  // Each VU hammers the endpoint as fast as possible
  sleep(0.1);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = `tests/load/reports/pdf-stress-test-${timestamp}`;

  return {
    [`${reportPath}.html`]: htmlReport(data),
    [`${reportPath}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
