import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Login page (/login).
 *
 * Covers the two-step login flow:
 *   Step 1 — email + password form
 *   Step 2 — TOTP OTP entry (only when MFA is enabled for the account)
 */
export class LoginPage {
  readonly page: Page;

  // Step 1 locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly rootError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: /sign in/i });
    this.emailError = page.getByText('Invalid email');
    this.passwordError = page.getByText(/wrong credentials/i);
    this.rootError = page.getByText(/something went wrong/i);
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.emailInput.waitFor({ state: 'visible' });
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }

  async expectRedirectedToOrders(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/orders/, { timeout: 10_000 });
  }

  async expectEmailError(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async expectPasswordError(message: string): Promise<void> {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async expectTitle(): Promise<void> {
    // CardTitle uses a <div> not a <h2>, so match by text content
    await expect(this.page.getByText('TMS', { exact: true })).toBeVisible();
  }
}
