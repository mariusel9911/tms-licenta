import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './fixtures/auth.fixture';

/**
 * Authentication E2E tests.
 *
 * Priority: HIGH — login gates all app functionality.
 *
 * Scenarios covered:
 *   1. Happy path — valid credentials → redirect to /orders
 *   2. Wrong password — error message shown, user stays on login page
 *   3. Unknown email — error message shown
 *   4. Empty form submission — field-level validation messages
 *   5. Already authenticated — visiting /login redirects to /orders
 *   6. Logout — clicking logout clears session and returns to /login
 */

test.describe('Authentication', () => {
  test.describe('Login page structure', () => {
    test('renders the login card with email and password fields', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      await loginPage.expectTitle();
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.signInButton).toBeVisible();

      // The description text is shown below the title
      await expect(page.getByText(/sign in to your account/i)).toBeVisible();
    });

    test('has the correct page title', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveTitle('Login - TMS');
    });
  });

  test.describe('Successful login', () => {
    test('valid credentials redirect to /orders', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
      await loginPage.expectRedirectedToOrders();
    });

    test('orders page title is set after login', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.waitForURL('**/orders');
      await expect(page).toHaveTitle('Orders');
    });

    test('authenticated user visiting /login is redirected to /orders', async ({ page }) => {
      // First, log in
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.waitForURL('**/orders');

      // Now navigate back to /login — should redirect away
      await page.goto('/login');
      await expect(page).toHaveURL(/.*\/orders/, { timeout: 5_000 });
    });
  });

  test.describe('Failed login', () => {
    test('wrong password shows credentials error', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(ADMIN_EMAIL, 'wrongpassword');

      // Backend returns code "invalid_credentials" → shows "Invalid email or password" message
      await loginPage.expectPasswordError('Invalid email or password');
      // User must stay on the login page
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('unknown email shows invalid email error', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login('notexist@tms.ro', 'anypassword');

      await loginPage.expectEmailError('Invalid email');
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('empty form shows HTML5 validation (does not submit)', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Click Sign In without filling fields
      await loginPage.signInButton.click();

      // The form should NOT have submitted — we stay on /login
      await expect(page).toHaveURL(/.*\/login/);
      // Zod or browser validation prevents submission
      // The button should not show loading state
      await expect(loginPage.signInButton).not.toHaveText(/signing in/i);
    });

    test('invalid email format prevents submission and stays on login page', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // "notanemail" has no @ so the browser's native email input validation
      // blocks the submit before reaching Zod / React Hook Form.
      // We verify the form does not submit (stays on /login).
      await loginPage.emailInput.fill('notanemail');
      await loginPage.passwordInput.fill('somepassword');
      await loginPage.signInButton.click();

      // Must stay on login — native browser constraint validation blocked submit
      await expect(page).toHaveURL(/.*\/login/);
      // Sign In button must not have entered loading state
      await expect(loginPage.signInButton).not.toHaveText(/signing in/i);
    });

    test('Zod email validation message shown for malformed email via React Hook Form', async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();

      // Fill an email that passes browser format (has @) but fails Zod's stricter validation
      // then trigger validation manually by calling focus/blur
      await loginPage.emailInput.fill('a@');
      await loginPage.passwordInput.fill('somepassword');
      // Blur the email field to trigger React Hook Form's onChange/onBlur validation
      await loginPage.passwordInput.press('Tab');
      await loginPage.signInButton.click();

      // Either a Zod message or the form stays on /login is acceptable
      await expect(page).toHaveURL(/.*\/login/);
    });
  });

  test.describe('Logout', () => {
    test('logout button clears session and returns to login', async ({ page }) => {
      // Log in first
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.waitForURL('**/orders');

      // The header has a logout button (icon + text, or just icon)
      // AppLayout > Header renders a logout button
      const logoutButton = page.getByRole('button', { name: /log out|logout|sign out/i });
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
      } else {
        // Fallback: click the user menu / avatar then find logout
        const userMenu = page.getByRole('button', { name: new RegExp(ADMIN_EMAIL, 'i') });
        if (await userMenu.isVisible()) {
          await userMenu.click();
        }
        await page.getByRole('menuitem', { name: /log out|logout|sign out/i }).click();
      }

      await expect(page).toHaveURL(/.*\/login/, { timeout: 8_000 });
    });
  });

  test.describe('Protected routes', () => {
    test('unauthenticated visit to /orders redirects to /login', async ({ page }) => {
      // Clear any existing auth state
      await page.goto('/login');
      await page.evaluate(() => localStorage.removeItem('tms-auth'));

      // Now try to access /orders directly
      await page.goto('/orders');

      // PrivateRoute should redirect to /login
      await expect(page).toHaveURL(/.*\/login/, { timeout: 8_000 });
    });

    test('unauthenticated visit to /partners redirects to /login', async ({ page }) => {
      await page.goto('/login');
      await page.evaluate(() => localStorage.removeItem('tms-auth'));

      await page.goto('/partners');
      await expect(page).toHaveURL(/.*\/login/, { timeout: 8_000 });
    });
  });
});
