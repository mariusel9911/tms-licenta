/**
 * Load Test — 10 Concurrent Users, 5 Minutes
 *
 * Validates that the system handles the maximum expected production load
 * (10 simultaneous users) with acceptable response times and zero errors.
 *
 * Target thresholds:
 *   - p95 response time < 500ms
 *   - p99 response time < 1000ms
 *   - Error rate < 1%
 *
 * User journey per iteration:
 *   1. List orders (paginated)
 *   2. View first order detail
 *   3. List partners
 *   4. List vehicles
 *   5. Load settings
 *   6. Create a DRAFT order
 *   7. Update the order
 *   8. Delete the order (cleanup)
 *
 * Run: k6 run backend/tests/load/scenarios/load-test.js
 * Or:  npm run test:load  (from backend/)
 */

import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

import { BASE_URL, LOAD_THRESHOLDS } from '../config.js';
import { login, authHeaders } from '../helpers/auth.js';
import { buildOrderPayload, LOAD_TEST_MARKER } from '../helpers/data.js';

// ---------------------------------------------------------------------------
// k6 Options
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
    },
  },
  thresholds: LOAD_THRESHOLDS,
};

// ---------------------------------------------------------------------------
// Setup — runs once before all VUs start
// ---------------------------------------------------------------------------

/**
 * Logs in once and shares the token with all VUs.
 * Also fetches the first available partner ID for order creation.
 */
export function setup() {
  const token = login();
  const params = authHeaders(token);

  // Fetch a real partner ID for order payloads (optional — order can be created without one)
  const partnersRes = http.get(`${BASE_URL}/api/partners?page=1&limit=1`, {
    ...params,
    tags: { name: 'GET /partners (setup)' },
  });

  let clientId = null;
  if (partnersRes.status === 200) {
    const body = partnersRes.json();
    // API returns { success: true, data: { items: [], total, page, limit } }
    const partners = body?.data?.items || [];
    if (partners.length > 0) {
      clientId = partners[0].id;
    }
  }

  if (!clientId) {
    fail('No partners found in the database. Seed the database before running the load test.');
  }

  return { token, clientId };
}

// ---------------------------------------------------------------------------
// Default function — runs once per VU iteration
// ---------------------------------------------------------------------------

export default function ({ token, clientId }) {
  const params = authHeaders(token);

  // ------------------------------------------------------------------
  // 1. List orders
  // ------------------------------------------------------------------
  group('list-orders', () => {
    const res = http.get(
      `${BASE_URL}/api/orders?page=1&limit=20&sortBy=createdAt&sortOrder=desc`,
      { ...params, tags: { name: 'GET /orders' } }
    );

    check(res, {
      'list orders: status 200': (r) => r.status === 200,
      'list orders: has data': (r) => {
        try {
          const body = r.json();
          return body?.success === true;
        } catch {
          return false;
        }
      },
    });

    sleep(randomIntBetween(1, 2) / 10); // 100–200ms think time
  });

  sleep(randomIntBetween(2, 5) / 10); // 200–500ms think time

  // ------------------------------------------------------------------
  // 3. Load reference data (partners, vehicles, settings)
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
      [
        'GET',
        `${BASE_URL}/api/settings`,
        null,
        { ...params, tags: { name: 'GET /settings' } },
      ],
    ]);

    check(responses[0], { 'partners: status 200': (r) => r.status === 200 });
    check(responses[1], { 'vehicles: status 200': (r) => r.status === 200 });
    check(responses[2], { 'settings: status 200': (r) => r.status === 200 });
  });

  sleep(randomIntBetween(3, 8) / 10); // 300–800ms think time

  // ------------------------------------------------------------------
  // 4. Create a DRAFT order
  // ------------------------------------------------------------------
  let createdOrderId = null;

  group('create-order', () => {
    const payload = buildOrderPayload(clientId);
    const createRes = http.post(
      `${BASE_URL}/api/orders`,
      JSON.stringify(payload),
      { ...params, tags: { name: 'POST /orders' } }
    );

    const passed = check(createRes, {
      'create order: status 201': (r) => r.status === 201,
    });

    if (passed) {
      try {
        const body = createRes.json();
        // API returns { success: true, data: { id, orderNumber, ... } }
        createdOrderId = body?.data?.id;
      } catch {
        // ignore
      }
    }
  });

  sleep(randomIntBetween(2, 5) / 10);

  // ------------------------------------------------------------------
  // 5. View the order we just created (no race condition — we own it)
  //    AND update it, then delete it
  // ------------------------------------------------------------------
  if (createdOrderId) {
    group('view-order', () => {
      const detailRes = http.get(`${BASE_URL}/api/orders/${createdOrderId}`, {
        ...params,
        tags: { name: 'GET /orders/:id' },
      });
      check(detailRes, {
        'order detail: status 200': (r) => r.status === 200,
      });
    });

    sleep(randomIntBetween(1, 2) / 10);
    group('update-order', () => {
      const updatePayload = {
        driverName: `Driver ${randomIntBetween(1, 999)}`,
        status: 'CONFIRMED',
      };
      const updateRes = http.put(
        `${BASE_URL}/api/orders/${createdOrderId}`,
        JSON.stringify(updatePayload),
        { ...params, tags: { name: 'PUT /orders/:id' } }
      );
      check(updateRes, {
        'update order: status 200': (r) => r.status === 200,
      });
    });

    sleep(randomIntBetween(1, 3) / 10);

    // ------------------------------------------------------------------
    // 6. Delete the order (cleanup — prevent DB accumulation)
    // ------------------------------------------------------------------
    group('delete-order', () => {
      // Must reset to DRAFT before deleting (only DRAFT orders can be deleted)
      const resetRes = http.put(
        `${BASE_URL}/api/orders/${createdOrderId}`,
        JSON.stringify({ status: 'DRAFT' }),
        { ...params, tags: { name: 'PUT /orders/:id (reset)' } }
      );
      check(resetRes, {
        'reset to draft: status 200': (r) => r.status === 200,
      });

      const deleteRes = http.del(
        `${BASE_URL}/api/orders/${createdOrderId}`,
        null,
        { ...params, tags: { name: 'DELETE /orders/:id' } }
      );
      check(deleteRes, {
        'delete order: status 200': (r) => r.status === 200,
      });
    });
  }

  // Think time between full iterations (1–3 seconds)
  sleep(randomIntBetween(10, 30) / 10);
}

// ---------------------------------------------------------------------------
// Teardown — cleanup any leftover LOAD_TEST_MARKER orders
// ---------------------------------------------------------------------------

export function teardown({ token }) {
  const params = authHeaders(token);

  // Search for any orders left over from the test (pickupAddress starts with LOADTEST_)
  const searchRes = http.get(
    `${BASE_URL}/api/orders?page=1&limit=100&search=${LOAD_TEST_MARKER}`,
    { ...params, tags: { name: 'GET /orders (teardown)' } }
  );

  if (searchRes.status !== 200) return;

  let orders = [];
  try {
    const body = searchRes.json();
    // API returns { success: true, data: { items: [], total, page, limit } }
    orders = body?.data?.items || [];
  } catch {
    return;
  }

  for (const order of orders) {
    if (!order.id) continue;

    // Reset to DRAFT if needed
    if (order.status !== 'DRAFT') {
      http.put(
        `${BASE_URL}/api/orders/${order.id}`,
        JSON.stringify({ status: 'DRAFT' }),
        { ...params, tags: { name: 'PUT /orders/:id (teardown reset)' } }
      );
    }

    http.del(`${BASE_URL}/api/orders/${order.id}`, null, {
      ...params,
      tags: { name: 'DELETE /orders/:id (teardown)' },
    });
  }
}

// ---------------------------------------------------------------------------
// Summary — terminal output + HTML report
// ---------------------------------------------------------------------------

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = `tests/load/reports/load-test-${timestamp}`;

  return {
    [`${reportPath}.html`]: htmlReport(data),
    [`${reportPath}.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}
