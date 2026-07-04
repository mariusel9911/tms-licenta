import { test as base, Page } from '@playwright/test';

/**
 * Credentials for the seeded admin user.
 * Override via E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD env vars.
 * Defaults match the development seed values in backend/.env.
 */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@tms.ro';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin123';

/**
 * Perform a full login via the UI (fills email + password, clicks Sign in).
 * Waits for redirect to /orders before returning so the caller can trust
 * the session is fully established.
 */
export async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/login');

  // Wait for the login form to be visible
  await page.waitForSelector('input[type="email"]', { state: 'visible' });

  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect — the app navigates to /orders on success
  await page.waitForURL('**/orders', { timeout: 10_000 });
}

/**
 * Faster login via direct localStorage injection.
 * Calls the backend API directly (no UI interaction) and writes
 * the JWT token into localStorage so React Query hydrates immediately.
 *
 * Use this for tests that DO NOT test the login flow itself.
 */
export async function loginViaApi(page: Page): Promise<void> {
  // Hit the real backend login endpoint
  const response = await page.request.post('http://localhost:3001/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok()) {
    throw new Error(
      `Login API failed: ${response.status()} — check that the backend is running on http://localhost:3001`,
    );
  }

  const body = await response.json();
  const token: string = body.data?.token ?? body.token;
  const user = body.data?.user ?? body.user;

  if (!token) {
    throw new Error(`Login API response did not contain a token: ${JSON.stringify(body)}`);
  }

  // Navigate to the app first so we have a page context to inject into
  await page.goto('/login');

  // Inject auth state into the Zustand store via localStorage.
  // The store name is 'tms-auth' (from auth.store.ts: persist({ name: 'tms-auth' })).
  // The persist middleware wraps state as: { state: { token, user }, version: 0 }
  await page.evaluate(
    ({ t, u }) => {
      const storeData = {
        state: { token: t, user: u },
        version: 0,
      };
      localStorage.setItem('tms-auth', JSON.stringify(storeData));
    },
    { t: token, u: user },
  );

  // Navigate to the protected route; the app should stay there (token is set)
  await page.goto('/orders');
  await page.waitForURL('**/orders', { timeout: 10_000 });
}

// ─── Extended test fixture ────────────────────────────────────────────────────

interface AuthFixtures {
  /** Logged-in page via API injection — fastest, preferred for non-auth tests */
  authedPage: Page;
}

/**
 * Extended Playwright test with a pre-authenticated page.
 *
 * Usage:
 *   import { test } from './fixtures/auth.fixture';
 *   test('my test', async ({ authedPage }) => { ... });
 */
export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    await loginViaApi(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
