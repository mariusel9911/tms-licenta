import { Page, Locator, expect } from '@playwright/test';

/**
 * Data for a single cargo row in the CharteringAgreementForm.
 */
export interface CargoRowData {
  qty?: number;
  description: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
}

/**
 * Page Object Model for the Orders page (/orders).
 *
 * Three views (tabs): list | form | detail
 * This POM covers list-view interactions, form-view, and CRUD operations.
 */
export class OrdersPagePOM {
  readonly page: Page;

  // Tab bar
  readonly myShipmentsTab: Locator;

  // List-view toolbar
  readonly newOrderButton: Locator;
  readonly exportButton: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly archivedButton: Locator;
  readonly tableSettingsButton: Locator;

  // Table
  readonly tableRows: Locator;
  readonly tableHeaders: Locator;

  // Skeleton (loading state — pulsing rows inside a card)
  readonly skeleton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.myShipmentsTab = page.getByRole('button', { name: /my shipments/i });
    this.newOrderButton = page.getByRole('button', { name: /\+ new order/i });
    this.exportButton = page.getByRole('button', { name: /export/i });
    this.searchInput = page.getByPlaceholder('Quick search');
    this.statusFilter = page.getByRole('combobox').first();
    this.archivedButton = page.getByRole('button', { name: /archived orders/i });
    this.tableSettingsButton = page.getByRole('button', { name: /table settings/i });

    // Table rows — skip the header row
    this.tableRows = page.locator('tbody tr');
    this.tableHeaders = page.locator('thead th');

    // The TableSkeleton renders animated divs; match by aria-label or by
    // the pulsing card that wraps the placeholder rows
    this.skeleton = page.locator('[class*="animate-pulse"]').first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/orders');
    await this.page.waitForURL('**/orders');
  }

  /** Wait until the skeleton disappears and at least one tbody row is visible. */
  async waitForTableData(): Promise<void> {
    // Wait for the orders API response
    await this.page.waitForResponse(
      (r) => r.url().includes('/api/orders') && r.status() === 200,
      { timeout: 10_000 },
    );
    // Then wait for a table row to appear (skeleton has been replaced)
    await this.tableRows.first().waitFor({ state: 'visible', timeout: 8_000 });
  }

  /** Wait for the list to load — handles the empty-state case too. */
  async waitForListReady(): Promise<void> {
    await this.page.waitForResponse(
      (r) => r.url().includes('/api/orders') && r.status() === 200,
      { timeout: 10_000 },
    );
  }

  async clickNewOrder(): Promise<void> {
    await this.newOrderButton.click();
  }

  async openFormTab(): Promise<void> {
    await this.clickNewOrder();
    // Wait for the form tab to appear
    await expect(this.page.getByText('New Order')).toBeVisible();
  }

  async expectListViewVisible(): Promise<void> {
    await expect(this.myShipmentsTab).toBeVisible();
    await expect(this.newOrderButton).toBeVisible();
  }

  async expectFormViewVisible(): Promise<void> {
    // The form tab shows "New Order" or an order number
    await expect(this.page.getByText('New Order')).toBeVisible();
    // The chartering form renders a "SHIPPING ORDER" header visible at the top
    await expect(this.page.getByText('SHIPPING ORDER')).toBeVisible();
  }

  async expectTableHasRows(): Promise<void> {
    await expect(this.tableRows.first()).toBeVisible();
  }

  async expectEmptyState(): Promise<void> {
    // When no orders exist the app shows an empty state message
    await expect(this.page.getByText(/no orders/i)).toBeVisible();
  }

  // ─── Form interactions (CharteringAgreementForm) ───────────────────────────

  /**
   * Select a client by partner name in the Client combobox.
   * Must be called while the form view is active.
   */
  async selectClientByName(partnerName: string): Promise<void> {
    // Client combobox is the first role="combobox" on the page (above the document card)
    await this.page.getByRole('combobox').first().click();
    // Type the name to filter options via the Command search input
    await this.page.getByPlaceholder('Search partners…').fill(partnerName);
    // Click the matching option (CommandItem renders as role="option")
    await this.page.getByRole('option', { name: partnerName }).click();
  }

  /** Fill the pickup (loading) address textarea. */
  async fillPickupAddress(address: string): Promise<void> {
    await this.page.getByPlaceholder('Full pickup address…').fill(address);
  }

  /** Fill the delivery address textarea. */
  async fillDeliveryAddress(address: string): Promise<void> {
    await this.page.getByPlaceholder('Full delivery address…').fill(address);
  }

  /**
   * Select a country in the Loading Address section's CountryDropdown.
   *
   * The form has two CountryDropdown instances in an address grid:
   *   - "Loading Address" (pickup) — left column
   *   - "Delivery Address" — right column
   *
   * We scope the button click to the h4-labelled section, then use the
   * Command palette (placeholder "Search country...") to filter and select.
   */
  async selectPickupCountry(countryName: string): Promise<void> {
    await this._selectCountryInSection('Loading Address', countryName);
  }

  /** Select a country in the Delivery Address section's CountryDropdown. */
  async selectDeliveryCountry(countryName: string): Promise<void> {
    await this._selectCountryInSection('Delivery Address', countryName);
  }

  /**
   * Internal helper: open the CountryDropdown inside a named address section
   * and select the given country by name.
   *
   * @param sectionHeading - The exact text inside the `<h4>` element (e.g. "Loading Address")
   * @param countryName    - Full country name as stored in country-data-list (e.g. "Romania")
   */
  private async _selectCountryInSection(
    sectionHeading: string,
    countryName: string,
  ): Promise<void> {
    // Navigate from the <h4> heading to its DIRECT parent div (the address section column).
    // Using `..` (XPath parent axis) avoids matching distant ancestors that contain
    // unrelated buttons (e.g. tab close buttons, sidebar items).
    //
    // DOM structure inside the address grid:
    //   <div class="p-4 border-r ...">           ← direct parent of h4
    //     <h4>Loading Address</h4>
    //     <div>                                  ← FormItem
    //       <button>Select country / Romania</button>  ← CountryDropdown trigger
    //     </div>
    //     <textarea placeholder="Full pickup address…" />
    //   </div>
    const h4 = this.page.locator('h4', { hasText: sectionHeading });
    const section = h4.locator('..');  // immediate parent div

    // The CountryDropdown trigger is the first button inside the section
    await section.locator('button').first().click();

    // Command palette opens — type to filter options
    await this.page.getByPlaceholder('Search country...').fill(countryName);

    // Click the matching option in the dropdown list
    await this.page
      .locator('[role="option"]')
      .filter({ hasText: countryName })
      .first()
      .click();
  }

  /** Fill the notes / additional information textarea. */
  async fillNotes(notes: string): Promise<void> {
    await this.page.getByPlaceholder('Any special instructions or notes…').fill(notes);
  }

  /**
   * Fill a cargo row at the given 0-based index.
   *
   * The row must already exist — row 0 is always present (default), additional
   * rows are appended with clickAddCargoRow().
   *
   * React Hook Form spreads `name` onto each input, so we use:
   *   input[name="cargoItems.{index}.{field}"]
   */
  async fillCargoRow(index: number, data: CargoRowData): Promise<void> {
    if (data.qty !== undefined) {
      await this.page
        .locator(`input[name="cargoItems.${index}.qty"]`)
        .fill(String(data.qty));
    }
    if (data.description) {
      await this.page
        .locator(`input[name="cargoItems.${index}.description"]`)
        .fill(data.description);
    }
    if (data.lengthCm !== undefined) {
      await this.page
        .locator(`input[name="cargoItems.${index}.lengthCm"]`)
        .fill(String(data.lengthCm));
    }
    if (data.widthCm !== undefined) {
      await this.page
        .locator(`input[name="cargoItems.${index}.widthCm"]`)
        .fill(String(data.widthCm));
    }
    if (data.heightCm !== undefined) {
      await this.page
        .locator(`input[name="cargoItems.${index}.heightCm"]`)
        .fill(String(data.heightCm));
    }
    if (data.weightKg !== undefined) {
      await this.page
        .locator(`input[name="cargoItems.${index}.weightKg"]`)
        .fill(String(data.weightKg));
    }
  }

  /**
   * Click the "Add cargo row" button to append a new empty cargo row.
   * Call this before fillCargoRow(index) for index >= 1.
   */
  async clickAddCargoRow(): Promise<void> {
    await this.page.getByRole('button', { name: 'Add cargo row' }).click();
  }

  /**
   * Click "Preview PDF" and wait for the backend to respond with the PDF.
   *
   * The button is disabled while the PDF is generating (shows a spinner).
   * The backend returns application/pdf bytes at POST /api/orders/preview-pdf.
   * The frontend opens the PDF in a new browser tab via window.open(blobUrl).
   *
   * Returns the Playwright Page for the popup (new tab) so callers can close it.
   *
   * NOTE: We do NOT call `popup.waitForLoadState()` because Chromium's built-in
   * PDF viewer for blob: URLs never fires the standard 'load' event in headless mode.
   * The PDF API response being 200 is the authoritative success signal.
   */
  async clickPreviewPdf(): Promise<Page> {
    // Register the API response listener BEFORE clicking
    const pdfResponsePromise = this.page.waitForResponse(
      (r) =>
        r.url().includes('/api/orders/preview-pdf') &&
        r.request().method() === 'POST',
      { timeout: 20_000 },
    );

    // The PDF opens in a popup tab
    const [popup] = await Promise.all([
      this.page.waitForEvent('popup', { timeout: 20_000 }),
      this.page.getByRole('button', { name: /preview pdf/i }).click(),
    ]);

    // Verify the PDF API call succeeded
    const pdfResponse = await pdfResponsePromise;
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');

    // DO NOT call popup.waitForLoadState() — Chromium's PDF viewer for blob: URLs
    // does not fire the 'load' event reliably in headless mode.
    return popup;
  }

  /**
   * Click the "Create Order" or "Update Order" submit button.
   * Scrolls it into view first (it is at the bottom of the long form).
   */
  async clickSubmitOrder(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /create order|update order/i });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
  }

  /**
   * Wait for POST /api/orders 201 and return the created order id and number.
   * Register this listener BEFORE calling clickSubmitOrder().
   */
  async waitForOrderCreated(): Promise<{ id: number; orderNumber: string }> {
    const res = await this.page.waitForResponse(
      (r) =>
        // Match exactly /api/orders (create) — not /api/orders/123 (update/etc.)
        /\/api\/orders$/.test(r.url()) &&
        r.request().method() === 'POST' &&
        r.status() === 201,
      { timeout: 15_000 },
    );
    const body = await res.json();
    return { id: body.data?.id ?? 0, orderNumber: body.data?.orderNumber ?? '' };
  }

  /**
   * Wait for PUT /api/orders/:id 200 (order update response).
   * Register this listener BEFORE calling clickSubmitOrder().
   */
  async waitForOrderUpdated(): Promise<void> {
    await this.page.waitForResponse(
      (r) =>
        /\/api\/orders\/\d+$/.test(r.url()) &&
        !r.url().includes('/duplicate') &&
        !r.url().includes('/send') &&
        !r.url().includes('/status') &&
        r.request().method() === 'PUT' &&
        r.status() === 200,
      { timeout: 15_000 },
    );
  }

  // ─── Table row finders and actions ─────────────────────────────────────────

  /**
   * Get the table row(s) that contain the given text.
   * Pass the numeric portion of an order number (e.g. '1001' for 'BGR1001')
   * since the table renders only the numeric portion in the order number cell.
   */
  getOrderRow(text: string): Locator {
    return this.tableRows.filter({ hasText: text });
  }

  /** Click the "View details" eye icon button for the given row. */
  async clickRowViewDetail(row: Locator): Promise<void> {
    await row.getByTitle('View details').click();
  }

  /** Click the "Duplicate" copy icon button for the given row. */
  async clickRowDuplicate(row: Locator): Promise<void> {
    await row.getByTitle('Duplicate').click();
  }

  /** Click the "Delete" trash icon button for the given row. */
  async clickRowDelete(row: Locator): Promise<void> {
    await row.getByTitle('Delete').click();
  }

  /**
   * Click the status pill button in the given row.
   * The pill shows the current status label (Draft, Confirmed, etc.)
   * and opens a Popover with all status options on click.
   */
  async clickRowStatusPill(row: Locator): Promise<void> {
    await row
      .locator('button')
      .filter({ hasText: /^(Draft|Confirmed|In Progress|Completed|Cancelled)$/ })
      .click();
  }

  // ─── Detail view ────────────────────────────────────────────────────────────

  /**
   * Expect the detail view to be active.
   * Checks that the "Edit" button rendered by OrderDetailPage is visible.
   */
  async expectDetailViewVisible(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: 'Edit' }),
    ).toBeVisible({ timeout: 8_000 });
  }
}
