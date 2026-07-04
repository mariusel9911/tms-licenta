import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Partners page (/partners).
 *
 * Two views (tabs): list | form
 */
export class PartnersPagePOM {
  readonly page: Page;

  // Tab bar
  readonly partnerTab: Locator;

  // List-view toolbar
  readonly addPartnerButton: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;

  // Table
  readonly tableRows: Locator;
  readonly tableHeaders: Locator;

  constructor(page: Page) {
    this.page = page;

    this.partnerTab = page.getByRole('button', { name: /^partner$/i });
    this.addPartnerButton = page.getByRole('button', { name: /add partner/i });
    this.searchInput = page.getByPlaceholder('Quick search...');
    this.searchButton = page.getByRole('button', { name: /^search$/i });

    this.tableRows = page.locator('tbody tr');
    this.tableHeaders = page.locator('thead th');
  }

  async goto(): Promise<void> {
    await this.page.goto('/partners');
    await this.page.waitForURL('**/partners');
  }

  /** Wait until the partners API response arrives. */
  async waitForListReady(): Promise<void> {
    await this.page.waitForResponse(
      (r) => r.url().includes('/api/partners') && r.status() === 200,
      { timeout: 10_000 },
    );
  }

  /** Wait until at least one table row is visible (data loaded). */
  async waitForTableData(): Promise<void> {
    await this.waitForListReady();
    await this.tableRows.first().waitFor({ state: 'visible', timeout: 8_000 });
  }

  async clickAddPartner(): Promise<void> {
    await this.addPartnerButton.click();
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
  }

  async expectListViewVisible(): Promise<void> {
    await expect(this.partnerTab).toBeVisible();
    await expect(this.addPartnerButton).toBeVisible();
  }

  async expectTableHasRows(): Promise<void> {
    await expect(this.tableRows.first()).toBeVisible();
  }

  async expectColumnHeaders(): Promise<void> {
    await expect(this.page.getByRole('columnheader', { name: /partner name/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /email/i })).toBeVisible();
    await expect(this.page.getByRole('columnheader', { name: /fiscal code/i })).toBeVisible();
  }

  async expectFormVisible(): Promise<void> {
    // The add-partner form tab label is "Add partner"
    await expect(this.page.getByText('Add partner')).toBeVisible();
    // PartnerForm renders "PARTNER DETAILS" section header and "Partner name *" label at the top
    await expect(this.page.getByText('PARTNER DETAILS')).toBeVisible({ timeout: 5_000 });
  }
}
