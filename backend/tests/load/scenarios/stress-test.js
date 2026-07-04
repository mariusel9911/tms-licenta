/**
 * Stress Test — Ramping 10 → 25 → 50 → 100 VUs
 *
 * Identifies the degradation threshold: the exact concurrency level where
 * response times and error rates cross acceptable boundaries.
 *
 * Ramp schedule (~21 minutes total):
 *   0m–1m    Ramp  0 → 10 VUs  (warm up)
 *   1m–4m    Hold      10 VUs  (baseline — should be identical to load test)
 *   4m–6m    Ramp 10 → 25 VUs  (2.5× capacity)
 *   6m–9m    Hold      25 VUs  (measure degradation)
 *   9m–11m   Ramp 25 → 50 VUs  (5× capacity)
 *  11m–14m   Hold      50 VUs  (expect noticeable degradation)
 *  14m–16m   Ramp 50 → 100 VUs (10× capacity)
 *  16m–19m   Hold     100 VUs  (find breaking point)
 *  19m–21m   Ramp 100 → 0 VUs  (recovery — does system stabilise?)
 *
 * Thresholds are lenient — this test is for observation, not pass/fail.
 * A threshold breach here signals a severe system failure under extreme load.
 *
 * Journey: READ-ONLY (no creates/updates/deletes — prevents DB pollution at scale)
 *   1. List orders
 *   2. View order detail
 *   3. List partners
 *   4. List vehicles
 *
 * Run: k6 run backend/tests/load/scenarios/stress-test.js
 * Or:  npm run test:stress  (from backend/)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

import { BASE_URL, STRESS_THRESHOLDS } from '../config.js';
import { login, authHeaders } from '../helpers/auth.js';

// ---------------------------------------------------------------------------
// k6 Options
// ---------------------------------------------------------------------------

export const options = {
  stages: [
    // Warm up to baseline
    { duration: '1m', target: 10 },
    // Hold at baseline — validate stable (should mirror load test results)
    { duration: '3m', target: 10 },
    // Ramp to 2.5× production capacity
    { duration: '2m', target: 25 },
    // Hold — measure degradation at 25 VUs
    { duration: '3m', target: 25 },
    // Ramp to 5× capacity
    { duration: '2m', target: 50 },
    // Hold — expect noticeable response-time increase
    { duration: '3m', target: 50 },
    // Ramp to 10× capacity — find the breaking point
    { duration: '2m', target: 100 },
    // Hold — watch for errors, timeouts, connection pool exhaustion
    { duration: '3m', target: 100 },
    // Ramp down — test recovery
    { duration: '2m', target: 0 },
  ],
  thresholds: STRESS_THRESHOLDS,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function setup() {
  const token = login();
  const params = authHeaders(token);

  // Fetch a real order ID for the detail requests
  const ordersRes = http.get(`${BASE_URL}/api/orders?page=1&limit=1`, {
    ...params,
    tags: { name: 'GET /orders (setup)' },
  });

  let firstOrderId = null;
  if (ordersRes.status === 200) {
    try {
      const body = ordersRes.json();
      // API returns { success: true, data: { items: [], total, page, limit } }
      const orders = body?.data?.items || [];
      if (orders.length > 0) {
        firstOrderId = orders[0].id;
      }
    } catch {
      // ignore
    }
  }

  return { token, firstOrderId };
}

// ---------------------------------------------------------------------------
// Default function
// ---------------------------------------------------------------------------

export default function ({ token, firstOrderId }) {
  const params = authHeaders(token);

  // ------------------------------------------------------------------
  // 1. List orders
  // ------------------------------------------------------------------
  group('list-orders', () => {
    const res = http.get(
      `${BASE_URL}/api/orders?page=1&limit=20&sortBy=createdAt&sortOrder=desc`,
      { ...params, tags: { name: 'GET /orders' } }
    );
    check(res, { 'list orders: status 200': (r) => r.status === 200 });
  });

  sleep(randomIntBetween(1, 3) / 10);

  // ------------------------------------------------------------------
  // 2. Order detail
  // ------------------------------------------------------------------
  if (firstOrderId) {
    group('order-detail', () => {
      const res = http.get(`${BASE_URL}/api/orders/${firstOrderId}`, {
        ...params,
        tags: { name: 'GET /orders/:id' },
      });
      check(res, { 'order detail: status 200': (r) => r.status === 200 });
    });
  }

  sleep(randomIntBetween(2, 5) / 10);

  // ------------------------------------------------------------------
  // 3. Batch: partners + vehicles
  // ------------------------------------------------------------------
  group('reference-data', () => {
    const responses = http.batch([
      [
        'GET',
        `${BASE_URL}/api/partners?page=1&limit=20`,
        null,
        { ...params, tags: { name: 'GET /partners' } },
      ],
      [
        'GET',
        `${BASE_URL}/api/vehicles?page=1&limit=20`,
        null,
        { ...params, tags: { name: 'GET /vehicles' } },
      ],
    ]);
    check(responses[0], { 'partners: status 200': (r) => r.status === 200 });
    check(responses[1], { 'vehicles: status 200': (r) => r.status === 200 });
  });

  // Think time: 1–2 seconds
  sleep(randomIntBetween(10, 20) / 10);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = `tests/load/reports/stress-test-${timestamp}`;

  return {
    [`${reportPath}.html`]: htmlReport(data),
    [`${reportPath}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
