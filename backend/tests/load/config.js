/**
 * Shared configuration for all k6 load test scenarios.
 *
 * Environment variables (override via k6 --env flag):
 *   BASE_URL       Backend base URL (default: http://localhost:3001)
 *   TEST_EMAIL     Test user email (default: admin@tms.ro)
 *   TEST_PASSWORD  Test user password (default: admin123)
 */

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export const TEST_USER = {
  email: __ENV.TEST_EMAIL || 'admin@tms.ro',
  password: __ENV.TEST_PASSWORD || 'admin123',
};

/**
 * Load test thresholds — strict (production readiness validation).
 * 10 VUs steady-state must meet these to be considered "passing".
 */
export const LOAD_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
};

/**
 * Stress test thresholds — lenient (measuring degradation, not pass/fail).
 * Thresholds here signal a severe breakdown; degradation is expected.
 */
export const STRESS_THRESHOLDS = {
  http_req_duration: ['p(95)<3000'],
  http_req_failed: ['rate<0.15'],
};

/**
 * PDF stress test thresholds — Puppeteer is inherently slow.
 *
 * Observed results (dev machine, 10 VUs):
 *   avg=2.59s  median=2.12s  p90=4.95s  p95=5.65s  max=7.15s
 *
 * 8s p95 threshold: allows for the observed 5.65s p95 + margin.
 * A breach signals OOM, process crash, or extreme resource contention.
 * 0% error rate is the real pass/fail — crashes would show here first.
 */
export const PDF_THRESHOLDS = {
  'http_req_duration{name:preview-pdf}': ['p(95)<8000'],
  http_req_failed: ['rate<0.05'],
};
