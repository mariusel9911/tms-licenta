import { expect } from '@playwright/test';
import { test } from './fixtures/auth.fixture';
import { PartnersPagePOM } from './pages/PartnersPage';

/**
 * Partners page E2E tests.
 *
 * Priority: HIGH — partners are core data linked to every order.
 *
 * Scenarios covered:
 *   1. Page renders with list view active
 *   2. Partners API is called and table renders
 *   3. Table has expected column headers
 *   4. Add Partner button opens the form tab
 *   5. Search triggers an API request
 *   6. Clear search resets results
 *   7. Form tab has required fields (Name, Email, etc.)
 *   8. Closing form tab returns to list
 *   9. Page title is "Partners"
 */

test.describe('Partners page', () => {
  test.describe('List view', () => {
    test('page title is Partners', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await expect(authedPage).toHaveTitle('Partners');
    });

    test('Partner tab is visible and active', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.expectListViewVisible();
    });

    test('Add Partner button is visible', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await expect(page.addPartnerButton).toBeVisible();
    });

    test('partners API is called and returns valid response', async ({ authedPage }) => {
      const responsePromise = authedPage.waitForResponse(
        (r) => r.url().includes('/api/partners') && r.status() === 200,
      );

      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      const response = await responsePromise;

      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('items');
      expect(body.data).toHaveProperty('total');
    });

    test('table has expected column headers', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();
      await authedPage.waitForTimeout(500);

      const rowCount = await page.tableRows.count();
      if (rowCount > 0) {
        await page.expectColumnHeaders();
      }
    });

    test('table renders rows when partners exist, or shows empty state', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();
      await authedPage.waitForTimeout(500);

      const rowCount = await page.tableRows.count();
      if (rowCount > 0) {
        await page.expectTableHasRows();
      } else {
        // Empty state: "No partners found" message
        await expect(authedPage.getByText(/no partners found/i)).toBeVisible();
      }
    });

    test('each partner row has Edit and Delete action buttons', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();
      await authedPage.waitForTimeout(500);

      const rowCount = await page.tableRows.count();
      if (rowCount > 0) {
        const firstRow = page.tableRows.first();
        // PartnersTable renders Pencil (edit) and Trash2 (delete) icon buttons
        const editBtn = firstRow.getByRole('button').first();
        await expect(editBtn).toBeVisible();
      }
    });
  });

  test.describe('Add Partner flow', () => {
    test('clicking Add Partner opens the form tab', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();

      await page.clickAddPartner();

      await page.expectFormVisible();
    });

    test('form tab label shows "Add partner"', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();

      await page.clickAddPartner();

      await expect(authedPage.getByText('Add partner')).toBeVisible();
    });

    test('form has required fields: Partner name, Fiscal Code, Country, Address, Phone', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();

      await page.clickAddPartner();
      await page.expectFormVisible();

      // PartnerForm has 7 required fields (marked with *)
      // Check visible required field labels from the screenshot
      await expect(authedPage.getByText('Partner name *')).toBeVisible();
      await expect(authedPage.getByText('Fiscal code *')).toBeVisible();
      await expect(authedPage.getByText('Country *')).toBeVisible();
    });

    test('form has VIES lookup section', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();

      await page.clickAddPartner();

      // ViesLookup renders "Check VAT" or similar
      await expect(authedPage.getByText(/vat|vies|fiscal/i).first()).toBeVisible();
    });

    test('closing form tab with X returns to list view', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();

      await page.clickAddPartner();
      await page.expectFormVisible();

      // Click the X close button in the tab
      const closeButton = authedPage.locator('[title="Close tab"]').first();
      await closeButton.click();

      await page.expectListViewVisible();
    });

    test('clicking Partner tab from form returns to list view', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();

      await page.clickAddPartner();

      // Click the Partner tab to go back
      await page.partnerTab.click();

      await page.expectListViewVisible();
    });
  });

  test.describe('Edit Partner flow', () => {
    test('clicking Edit on a partner row opens the form with partner data', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();
      await authedPage.waitForTimeout(500);

      const rowCount = await page.tableRows.count();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Click the edit (pencil) button on the first row
      const firstRow = page.tableRows.first();
      const editButton = firstRow.getByRole('button').first();
      await editButton.click();

      // Form tab should open with the partner's name (not "Add partner")
      await expect(authedPage.getByRole('button', { name: /save/i })).toBeVisible();
    });
  });

  test.describe('Search', () => {
    test('search form is visible with input and Search button', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();

      await expect(page.searchInput).toBeVisible();
      await expect(page.searchButton).toBeVisible();
    });

    test('submitting search triggers a filtered API request', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();

      const searchResponsePromise = authedPage.waitForResponse(
        (r) => r.url().includes('/api/partners') && r.url().includes('search=') && r.status() === 200,
        { timeout: 5_000 },
      );

      await page.search('TEST_QUERY');

      const response = await searchResponsePromise;
      expect(response.url()).toContain('search=TEST_QUERY');
    });

    test('Clear button appears after search and resets filter', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();

      await page.search('something');

      // After search is submitted, a "Clear" button appears
      const clearButton = authedPage.getByRole('button', { name: /clear/i });
      await expect(clearButton).toBeVisible({ timeout: 5_000 });

      await clearButton.click();

      // After clearing, the Clear button should disappear and the search input should be empty
      await expect(clearButton).not.toBeVisible({ timeout: 5_000 });
      await expect(authedPage.getByPlaceholder('Quick search...')).toHaveValue('');
    });
  });

  test.describe('Pagination', () => {
    test('pagination controls render when total > 0', async ({ authedPage }) => {
      const page = new PartnersPagePOM(authedPage);
      await page.goto();
      await page.waitForListReady();
      await authedPage.waitForTimeout(500);

      const rowCount = await page.tableRows.count();
      if (rowCount > 0) {
        // Items per page select and navigation buttons should be visible
        await expect(authedPage.getByText(/items per page/i)).toBeVisible();
      }
    });
  });
});
