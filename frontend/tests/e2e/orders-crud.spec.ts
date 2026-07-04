import { expect } from '@playwright/test';
import { test, ADMIN_EMAIL, ADMIN_PASSWORD } from './fixtures/auth.fixture';
import { OrdersPagePOM } from './pages/OrdersPage';

/**
 * Orders CRUD E2E tests.
 *
 * Tests the full create / view detail / edit / duplicate / status change / delete flows,
 * as well as a comprehensive "full order" test that fills addresses, selects countries,
 * adds multiple cargo rows and verifies PDF preview.
 *
 * === Cleanup strategy ===
 * • beforeAll  — creates one shared test partner + one shared DRAFT order (testOrder).
 * • afterEach  — deletes any orders whose IDs were pushed to `createdOrderIds` during
 *                the test. Only newly created (DRAFT) orders are tracked here.
 * • afterAll   — resets testOrder back to DRAFT (it may have been changed to CONFIRMED
 *                by the status-change test), deletes testOrder, then soft-deletes the
 *                test partner.
 *
 * Requires both servers running:
 *   Backend : http://localhost:3001
 *   Frontend: http://localhost:5173
 */

// ─── Shared test state (populated in beforeAll) ───────────────────────────────

/** Unique suffix per test run to avoid collisions in the shared dev database. */
const TS = Date.now().toString().slice(-8);

const TEST_PARTNER_NAME = `E2E-Orders-${TS}`;

let authToken: string;
let testPartner: { id: number; name: string };
let testOrderId: number;
let testOrderNumber: string; // e.g. "BGR1001"

/**
 * Orders created during a test that need cleanup in afterEach.
 * Each test pushes the numeric ID of any order it creates via the UI or API.
 * afterEach drains this array via DELETE /api/orders/:id.
 */
const createdOrderIds: number[] = [];

// ─── Setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async ({ request }) => {
  // 1. Authenticate to get a JWT for subsequent API calls
  const loginRes = await request.post('http://localhost:3001/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginBody = await loginRes.json();
  authToken = loginBody.data.token;

  // 2. Create a test CLIENT partner with a unique name
  const partnerRes = await request.post('http://localhost:3001/api/partners', {
    headers: { Authorization: `Bearer ${authToken}` },
    data: {
      partnerType: 'CLIENT',
      name: TEST_PARTNER_NAME,
      fiscalCode: `RO${TS}`,
      addressLine1: '123 E2E Test Street',
      country: 'Romania',
      phone: '+40700000001',
      email: `e2e${TS}@test.local`,
      contactPerson: 'E2E Tester',
    },
  });
  expect(partnerRes.ok()).toBeTruthy();
  const partnerBody = await partnerRes.json();
  testPartner = { id: partnerBody.data.id, name: partnerBody.data.name };

  // 3. Create a DRAFT order (reused by detail / edit / duplicate / status tests)
  const orderRes = await request.post('http://localhost:3001/api/orders', {
    headers: { Authorization: `Bearer ${authToken}` },
    data: { clientId: testPartner.id },
  });
  expect(orderRes.ok()).toBeTruthy();
  const orderBody = await orderRes.json();
  testOrderId = orderBody.data.id;
  testOrderNumber = orderBody.data.orderNumber;
});

/**
 * After every test: delete all orders pushed into `createdOrderIds` during that test.
 * Errors are silently swallowed — a cleanup failure should not fail the test itself.
 */
test.afterEach(async ({ request }) => {
  for (const id of createdOrderIds) {
    await request
      .delete(`http://localhost:3001/api/orders/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      .catch(() => {
        // ignore — order may have already been deleted by the test itself
      });
  }
  // Clear the array for the next test
  createdOrderIds.length = 0;
});

/**
 * After all tests: clean up the shared testOrder and testPartner.
 *
 * testOrder may be CONFIRMED (changed by the status-change test), so we first
 * reset it to DRAFT via PATCH /status before attempting the hard delete.
 */
test.afterAll(async ({ request }) => {
  if (testOrderId) {
    // Reset status to DRAFT so the order can be deleted
    await request
      .patch(`http://localhost:3001/api/orders/${testOrderId}/status`, {
        headers: { Authorization: `Bearer ${authToken}` },
        data: { status: 'DRAFT' },
      })
      .catch(() => {});

    await request
      .delete(`http://localhost:3001/api/orders/${testOrderId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      .catch(() => {});
  }

  if (testPartner?.id) {
    await request
      .delete(`http://localhost:3001/api/partners/${testPartner.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      .catch(() => {});
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Returns the numeric portion of an order number.
 * OrdersTable renders only the numeric part (e.g. "BGR1001" → "1001").
 */
function orderNumeric(orderNumber: string): string {
  return orderNumber.replace(/^[A-Z]+/, '');
}

// ─── Create order flow ────────────────────────────────────────────────────────

test.describe('Create order flow', () => {
  test('creates a new order with only a client selected', async ({ authedPage }) => {
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForListReady();

    await ordersPage.clickNewOrder();
    await ordersPage.expectFormViewVisible();

    // Register ALL response listeners BEFORE triggering any actions.
    // React Query invalidates and refetches the list immediately after the mutation
    // resolves — if we wait until after clickSubmitOrder() to register the list
    // listener, the GET /api/orders response will have already passed.
    const createPromise = ordersPage.waitForOrderCreated();
    const listRefreshPromise = authedPage.waitForResponse(
      (r) =>
        /\/api\/orders(\?|$)/.test(r.url()) &&
        r.request().method() === 'GET' &&
        r.status() === 200,
      { timeout: 15_000 },
    );

    // Select the test partner as client
    await ordersPage.selectClientByName(TEST_PARTNER_NAME);
    await expect(authedPage.getByRole('combobox').first()).toContainText(TEST_PARTNER_NAME);

    // Submit the form
    await ordersPage.clickSubmitOrder();

    // Wait for the backend to create the order and the list to refresh
    const { id: newOrderId, orderNumber: newOrderNumber } = await createPromise;
    await listRefreshPromise;

    // Track for afterEach cleanup
    createdOrderIds.push(newOrderId);

    expect(newOrderNumber).toBeTruthy();
    expect(newOrderNumber).toMatch(/^[A-Z]+\d+/); // e.g. "BGR1002"

    // Form should close and list view should be active
    await ordersPage.expectListViewVisible();

    // The new order must appear in the table
    const row = ordersPage.getOrderRow(orderNumeric(newOrderNumber));
    await expect(row.first()).toBeVisible({ timeout: 8_000 });
  });

  test('shows a validation error when submitting without selecting a client', async ({ authedPage }) => {
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForListReady();

    await ordersPage.clickNewOrder();
    await ordersPage.expectFormViewVisible();

    // Click Create Order without selecting a client (clientId defaults to 0 → fails validation)
    await ordersPage.clickSubmitOrder();

    // The FormMessage below the Client combobox should show the Zod error
    await expect(authedPage.getByText(/client is required/i)).toBeVisible({ timeout: 5_000 });

    // No API call should have been made (form blocked by client-side validation)
    // The form is still open
    await expect(authedPage.getByText('SHIPPING ORDER')).toBeVisible();
  });
});

// ─── Full order form (address + country + cargo + PDF) ───────────────────────

test.describe('Full order form', () => {
  test('creates a full order with addresses, countries, cargo rows, and PDF preview', async ({
    authedPage,
  }) => {
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForListReady();

    await ordersPage.clickNewOrder();
    await ordersPage.expectFormViewVisible();

    // ── Client ──────────────────────────────────────────────────────────────
    await ordersPage.selectClientByName(TEST_PARTNER_NAME);
    await expect(authedPage.getByRole('combobox').first()).toContainText(TEST_PARTNER_NAME);

    // ── Pickup address + country ─────────────────────────────────────────────
    await ordersPage.fillPickupAddress('Strada Victoriei 10, Cluj-Napoca, Romania');
    // Select pickup country manually via the CountryDropdown in "Loading Address" section
    await ordersPage.selectPickupCountry('Romania');

    // ── Delivery address + country ───────────────────────────────────────────
    await ordersPage.fillDeliveryAddress('Hauptstraße 5, Berlin, Germany');
    // Select delivery country manually via the CountryDropdown in "Delivery Address" section
    await ordersPage.selectDeliveryCountry('Germany');

    // ── Cargo rows ───────────────────────────────────────────────────────────
    // Row 0 is always present by default
    await ordersPage.fillCargoRow(0, {
      qty: 2,
      description: 'Steel Coils',
      lengthCm: 120,
      widthCm: 80,
      heightCm: 80,
      weightKg: 5000,
    });

    // Add a second cargo row and fill it
    await ordersPage.clickAddCargoRow();
    await ordersPage.fillCargoRow(1, {
      qty: 1,
      description: 'Packing Materials',
      weightKg: 200,
    });

    // ── Notes ────────────────────────────────────────────────────────────────
    await ordersPage.fillNotes(`E2E full order test ${TS} — fragile, handle with care`);

    // ── PDF preview ──────────────────────────────────────────────────────────
    // Click "Preview PDF": backend generates the chartering agreement PDF via Puppeteer.
    // The frontend receives the binary PDF, creates a blob URL and opens it in a new tab.
    // clickPreviewPdf() asserts the API returned HTTP 200 with Content-Type application/pdf.
    const pdfTab = await ordersPage.clickPreviewPdf();
    // Close the PDF tab — we verified the PDF was generated (API returned 200)
    await pdfTab.close().catch(() => {});

    // ── Submit ───────────────────────────────────────────────────────────────
    const createPromise = ordersPage.waitForOrderCreated();
    const listRefreshPromise = authedPage.waitForResponse(
      (r) =>
        /\/api\/orders(\?|$)/.test(r.url()) &&
        r.request().method() === 'GET' &&
        r.status() === 200,
      { timeout: 15_000 },
    );

    await ordersPage.clickSubmitOrder();

    const { id: newOrderId, orderNumber: newOrderNumber } = await createPromise;
    await listRefreshPromise;

    // Track for afterEach cleanup
    createdOrderIds.push(newOrderId);

    expect(newOrderNumber).toBeTruthy();
    expect(newOrderNumber).toMatch(/^[A-Z]+\d+/);

    // Form closes → list view is active
    await ordersPage.expectListViewVisible();

    // New order appears in the table
    const row = ordersPage.getOrderRow(orderNumeric(newOrderNumber));
    await expect(row.first()).toBeVisible({ timeout: 8_000 });
  });
});

// ─── Order detail view ────────────────────────────────────────────────────────

test.describe('Order detail view', () => {
  test('clicking View details opens the detail tab for the order', async ({ authedPage }) => {
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForTableData();

    const row = ordersPage.getOrderRow(orderNumeric(testOrderNumber));
    await expect(row.first()).toBeVisible({ timeout: 8_000 });

    await ordersPage.clickRowViewDetail(row.first());

    // Detail view: Edit button is present (rendered by OrderDetailPage)
    await ordersPage.expectDetailViewVisible();

    // The detail tab in the tab bar shows the full order number (may appear in multiple
    // places in the detail view — use .first() to pass strict mode)
    await expect(authedPage.getByText(testOrderNumber).first()).toBeVisible({ timeout: 5_000 });
  });

  test('detail view has Edit and Duplicate action buttons', async ({ authedPage }) => {
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForTableData();

    const row = ordersPage.getOrderRow(orderNumeric(testOrderNumber));
    await ordersPage.clickRowViewDetail(row.first());

    await ordersPage.expectDetailViewVisible();

    // Both action buttons must be present
    await expect(authedPage.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(authedPage.getByRole('button', { name: /duplicate/i })).toBeVisible();
  });

  test('closing the detail tab returns to list view', async ({ authedPage }) => {
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForTableData();

    const row = ordersPage.getOrderRow(orderNumeric(testOrderNumber));
    await ordersPage.clickRowViewDetail(row.first());
    await ordersPage.expectDetailViewVisible();

    // Close the detail tab with the X button
    const closeBtn = authedPage.locator('[title="Close tab"]').first();
    await closeBtn.click();

    await ordersPage.expectListViewVisible();
  });
});

// ─── Edit order ───────────────────────────────────────────────────────────────

test.describe('Edit order', () => {
  test('edits an order by updating the notes field and saves successfully', async ({ authedPage }) => {
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForTableData();

    // Open detail view for the test order
    const row = ordersPage.getOrderRow(orderNumeric(testOrderNumber));
    await ordersPage.clickRowViewDetail(row.first());
    await ordersPage.expectDetailViewVisible();

    // Click Edit — form opens in edit mode with the order number in the tab
    await authedPage.getByRole('button', { name: 'Edit' }).click();
    // The order number appears in multiple places in the edit form; use .first()
    await expect(authedPage.getByText(testOrderNumber).first()).toBeVisible({ timeout: 5_000 });
    await expect(authedPage.getByText('SHIPPING ORDER')).toBeVisible();

    // Modify the notes
    const uniqueNote = `E2E updated notes ${TS}`;
    await ordersPage.fillNotes(uniqueNote);

    // Register update listener before submitting
    const updatePromise = ordersPage.waitForOrderUpdated();
    await ordersPage.clickSubmitOrder();
    await updatePromise;

    // After save, the form closes and returns to detail view
    // (formOrigin === 'detail' so closeForm() goes back to detail, not list)
    await ordersPage.expectDetailViewVisible();
  });
});

// ─── Duplicate order ──────────────────────────────────────────────────────────

test.describe('Duplicate order', () => {
  test('duplicates an order creating a new DRAFT with a different order number', async ({ authedPage }) => {
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForTableData();

    const row = ordersPage.getOrderRow(orderNumeric(testOrderNumber));
    await expect(row.first()).toBeVisible({ timeout: 8_000 });

    // Register ALL listeners BEFORE clicking — React Query invalidates the list
    // immediately after the duplicate mutation resolves, so the GET /api/orders
    // response can arrive before we set up the listener if we wait until after.
    const duplicatePromise = authedPage.waitForResponse(
      (r) =>
        r.url().includes(`/api/orders/${testOrderId}/duplicate`) &&
        r.ok(),
      { timeout: 10_000 },
    );
    const listRefreshPromise = authedPage.waitForResponse(
      (r) =>
        /\/api\/orders(\?|$)/.test(r.url()) &&
        r.request().method() === 'GET' &&
        r.status() === 200,
      { timeout: 15_000 },
    );

    await ordersPage.clickRowDuplicate(row.first());
    const dupResponse = await duplicatePromise;
    await listRefreshPromise;

    const dupBody = await dupResponse.json();
    expect(dupBody.success).toBe(true);
    expect(dupBody.data.orderNumber).not.toBe(testOrderNumber); // different order number
    expect(dupBody.data.status).toBe('DRAFT'); // always created as DRAFT

    // Track the duplicate for afterEach cleanup
    createdOrderIds.push(dupBody.data.id);

    // Success toast should appear — use exact text to avoid strict-mode violation
    // (the accessibility live region also contains this text as a concatenated string)
    await expect(authedPage.getByText('Order duplicated', { exact: true })).toBeVisible({ timeout: 5_000 });

    // The new duplicated order must appear in the table
    await authedPage.waitForTimeout(300);
    const dupRow = ordersPage.getOrderRow(orderNumeric(dupBody.data.orderNumber));
    await expect(dupRow.first()).toBeVisible({ timeout: 8_000 });
  });
});

// ─── Status change ────────────────────────────────────────────────────────────

test.describe('Order status change', () => {
  test('changes order status from Draft to Confirmed via TableStatusPill and ConfirmDialog', async ({ authedPage }) => {
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForTableData();

    const row = ordersPage.getOrderRow(orderNumeric(testOrderNumber));
    await expect(row.first()).toBeVisible({ timeout: 8_000 });

    // Click the status pill — currently "Draft"
    await ordersPage.clickRowStatusPill(row.first());

    // Popover opens — the status options panel is a Radix popper content wrapper
    const popover = authedPage.locator('[data-radix-popper-content-wrapper]').last();
    await expect(popover.getByRole('button', { name: 'Confirmed' })).toBeVisible({ timeout: 5_000 });

    // Select "Confirmed" from the popover
    await popover.getByRole('button', { name: 'Confirmed' }).click();

    // ConfirmDialog opens
    const dialog = authedPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toContainText('Change Order Status');
    await expect(dialog).toContainText('"Draft"');
    await expect(dialog).toContainText('"Confirmed"');

    // Register PATCH listener before confirming
    const patchPromise = authedPage.waitForResponse(
      (r) =>
        r.url().includes(`/api/orders/${testOrderId}/status`) &&
        r.request().method() === 'PATCH' &&
        r.status() === 200,
      { timeout: 10_000 },
    );

    // Confirm the status change
    await dialog.getByRole('button', { name: 'Change Status' }).click();
    await patchPromise;

    // Toast confirmation
    await expect(authedPage.getByText(/status changed to confirmed/i)).toBeVisible({ timeout: 5_000 });

    // The row status pill must now show "Confirmed"
    await expect(
      row.first().locator('button').filter({ hasText: /^Confirmed$/ }),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ─── Delete order ─────────────────────────────────────────────────────────────

test.describe('Delete order', () => {
  test('deletes a DRAFT order via the delete button and confirmation dialog', async ({ authedPage, request }) => {
    // Create a fresh DRAFT order specifically for this test — we don't want
    // to destroy the shared testOrder which other tests (re-runs) may depend on
    const orderRes = await request.post('http://localhost:3001/api/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: { clientId: testPartner.id },
    });
    expect(orderRes.ok()).toBeTruthy();
    const orderBody = await orderRes.json();
    const deleteOrderId: number = orderBody.data.id;
    const deleteOrderNumber: string = orderBody.data.orderNumber;

    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForTableData();

    // The freshly created DRAFT should be at the top of the list (sorted by createdAt desc)
    const row = ordersPage.getOrderRow(orderNumeric(deleteOrderNumber));
    await expect(row.first()).toBeVisible({ timeout: 8_000 });

    // Click the Delete (trash) icon for this row
    await ordersPage.clickRowDelete(row.first());

    // ConfirmDialog appears
    const dialog = authedPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(dialog).toContainText('Delete Order');
    await expect(dialog).toContainText(deleteOrderNumber);

    // Register DELETE listener before confirming
    const deletePromise = authedPage.waitForResponse(
      (r) =>
        r.url().includes(`/api/orders/${deleteOrderId}`) &&
        r.request().method() === 'DELETE' &&
        r.ok(),
      { timeout: 10_000 },
    );

    // Confirm deletion — the button is scoped inside the dialog to avoid
    // matching the row's Delete icon button (which also has title="Delete")
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await deletePromise;

    // List refreshes — the deleted order must no longer be visible
    await ordersPage.waitForListReady();
    await authedPage.waitForTimeout(500);
    await expect(row.first()).not.toBeVisible({ timeout: 8_000 });
    // No afterEach cleanup needed — the order was deleted within the test
  });

  test('cannot delete a non-DRAFT order — shows error toast', async ({ authedPage }) => {
    // testOrder was changed to CONFIRMED status in the status-change test.
    // Trying to delete it should fail with a business-rule error.
    const ordersPage = new OrdersPagePOM(authedPage);
    await ordersPage.goto();
    await ordersPage.waitForTableData();

    const row = ordersPage.getOrderRow(orderNumeric(testOrderNumber));
    await expect(row.first()).toBeVisible({ timeout: 8_000 });

    // Click Delete
    await ordersPage.clickRowDelete(row.first());

    const dialog = authedPage.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Confirm — backend returns 400 because order is not DRAFT
    const deleteAttempt = authedPage.waitForResponse(
      (r) =>
        r.url().includes(`/api/orders/${testOrderId}`) &&
        r.request().method() === 'DELETE',
      { timeout: 10_000 },
    );

    await dialog.getByRole('button', { name: 'Delete' }).click();
    const deleteRes = await deleteAttempt;

    // Backend responds with 400 (business rule: only DRAFT orders can be deleted)
    expect(deleteRes.status()).toBe(400);

    // Error toast appears — use exact title text to avoid strict-mode violation
    // (both the title "Cannot delete order" and the description "Only Draft orders..."
    // match the regex; exact: true scopes to just the title element)
    await expect(authedPage.getByText('Cannot delete order', { exact: true })).toBeVisible({ timeout: 5_000 });
  });
});
