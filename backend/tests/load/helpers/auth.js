/**
 * Authentication helper for k6 load tests.
 *
 * Usage:
 *   import { login, authHeaders } from '../helpers/auth.js';
 *   const token = login();
 *   http.get(`${BASE_URL}/api/orders`, authHeaders(token));
 */

import http from 'k6/http';
import { check, fail } from 'k6';
import { BASE_URL, TEST_USER } from '../config.js';

/**
 * Performs a login request and returns a valid JWT token.
 *
 * Fails the test immediately if:
 * - Login returns a non-200 status
 * - MFA is required (test user must not have MFA enabled)
 *
 * @returns {string} JWT access token
 */
export function login() {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /auth/login' },
    }
  );

  const passed = check(res, {
    'login status is 200': (r) => r.status === 200,
  });

  if (!passed) {
    fail(
      `Login failed — status ${res.status}. ` +
        `Check that the backend is running at ${BASE_URL} and credentials are correct.\n` +
        `Response: ${res.body}`
    );
  }

  let body;
  try {
    body = res.json();
  } catch {
    fail(`Login response is not valid JSON: ${res.body}`);
  }

  // MFA guard — test user must not have MFA enabled
  if (body.data && body.data.mfaRequired) {
    fail(
      'Test user has MFA enabled. ' +
        'Disable MFA for the test account or use a dedicated load-test user without MFA.'
    );
  }

  const token = body?.data?.token;
  if (!token) {
    fail(`Login response did not contain a token. Body: ${res.body}`);
  }

  return token;
}

/**
 * Returns k6 request params with Authorization header set.
 *
 * @param {string} token  JWT access token from login()
 * @param {object} extra  Additional params to merge (e.g. tags)
 * @returns {object} k6 params object
 */
export function authHeaders(token, extra = {}) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...extra,
  };
}
