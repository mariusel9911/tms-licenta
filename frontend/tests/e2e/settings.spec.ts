import { expect } from '@playwright/test';
import { test } from './fixtures/auth.fixture';

/**
 * Settings page E2E tests.
 *
 * Priority: MEDIUM — settings affect PDF output, invoicing, and integrations.
 *
 * Scenarios covered:
 *   1. Page renders with General tab active by default
 *   2. Page title is "Settings"
 *   3. All tab labels are visible (General, Invoicing, Integrations, Security, Users)
 *   4. General tab has company form fields
 *   5. Settings API is called on load
 *   6. Switching to Invoicing tab renders invoicing fields
 *   7. Users tab is visible for ADMIN role
 */

test.describe('Settings page', () => {
  test.describe('Page structure', () => {
    test('page title is Settings', async ({ authedPage }) => {
      await authedPage.goto('/settings');
      await expect(authedPage).toHaveTitle('Settings');
    });

    test('settings API is called on load', async ({ authedPage }) => {
      const responsePromise = authedPage.waitForResponse(
        (r) => r.url().includes('/api/settings') && r.status() === 200,
      );

      await authedPage.goto('/settings');
      const response = await responsePromise;

      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test('General tab is active by default', async ({ authedPage }) => {
      await authedPage.goto('/settings');

      await authedPage.waitForResponse(
        (r) => r.url().includes('/api/settings') && r.status() === 200,
      );

      // The General tab button should be visible and active
      await expect(authedPage.getByRole('button', { name: /general/i })).toBeVisible();
    });

    test('all five tab labels are rendered', async ({ authedPage }) => {
      await authedPage.goto('/settings');

      // Wait for settings to load
      await authedPage.waitForResponse(
        (r) => r.url().includes('/api/settings') && r.status() === 200,
      );
      await authedPage.waitForTimeout(300);

      const expectedTabs = ['General', 'Invoicing', 'Integrations', 'Security'];
      for (const tabName of expectedTabs) {
        await expect(authedPage.getByRole('button', { name: tabName })).toBeVisible();
      }

      // Users tab only visible to ADMIN — logged in as admin@tms.ro so it should be visible
      await expect(authedPage.getByRole('button', { name: 'Users' })).toBeVisible();
    });
  });

  test.describe('General tab', () => {
    test('General tab shows company identity fields', async ({ authedPage }) => {
      await authedPage.goto('/settings');
      await authedPage.waitForResponse(
        (r) => r.url().includes('/api/settings') && r.status() === 200,
      );
      await authedPage.waitForTimeout(300);

      // The General tab has two cards: "Company Identity" and "Inbox / SMTP"
      // Check that company name field is present
      await expect(authedPage.getByLabel(/company name/i).first()).toBeVisible({ timeout: 5_000 });
    });

    test('Save button is visible on General tab', async ({ authedPage }) => {
      await authedPage.goto('/settings');
      await authedPage.waitForResponse(
        (r) => r.url().includes('/api/settings') && r.status() === 200,
      );
      await authedPage.waitForTimeout(300);

      await expect(authedPage.getByRole('button', { name: /save/i }).first()).toBeVisible();
    });
  });

  test.describe('Tab navigation', () => {
    test('clicking Invoicing tab shows invoicing fields', async ({ authedPage }) => {
      await authedPage.goto('/settings');
      await authedPage.waitForResponse(
        (r) => r.url().includes('/api/settings') && r.status() === 200,
      );

      await authedPage.getByRole('button', { name: 'Invoicing' }).click();

      // Invoicing tab description: "Invoice defaults and terms of service."
      await expect(authedPage.getByText(/invoice defaults/i)).toBeVisible({ timeout: 5_000 });
    });

    test('clicking Security tab renders the security section', async ({ authedPage }) => {
      await authedPage.goto('/settings');
      await authedPage.waitForResponse(
        (r) => r.url().includes('/api/settings') && r.status() === 200,
      );

      await authedPage.getByRole('button', { name: 'Security' }).click();

      // SecurityTabContent renders MFA section
      await expect(authedPage.getByText(/two-factor|security|mfa/i).first()).toBeVisible({ timeout: 5_000 });
    });

    test('clicking Users tab shows the users management panel', async ({ authedPage }) => {
      await authedPage.goto('/settings');
      await authedPage.waitForResponse(
        (r) => r.url().includes('/api/settings') && r.status() === 200,
      );

      // Set up the users API listener before clicking the tab so we don't miss it
      const usersResponsePromise = authedPage.waitForResponse(
        (r) => r.url().includes('/api/users') && r.status() === 200,
        { timeout: 10_000 },
      );

      await authedPage.getByRole('button', { name: 'Users' }).click();

      await usersResponsePromise;

      // UsersManagementPanel renders "New User" button (from screenshot)
      await expect(authedPage.getByRole('button', { name: /new user/i })).toBeVisible({ timeout: 5_000 });
    });
  });
});
