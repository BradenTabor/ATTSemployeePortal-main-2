# Reference: E2E Test Template

File: `tests/e2e/<feature-name>.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('<Feature Name>', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page, '<role>');
    await page.goto('/<path>');
    await page.waitForLoadState('domcontentloaded');
  });

  // ── Smoke ──────────────────────────────────────────────────────────────────

  test('should render the page heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /<Page Title>/i })
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Happy Path ─────────────────────────────────────────────────────────────

  test('should complete the primary flow', async ({ page }) => {
    // Fill required fields
    // Example: await page.getByLabel(/Description/i).fill('Test description');
    // Example: await page.locator('select[name="severity"]').selectOption('low');

    // Submit
    const submitBtn = page.getByRole('button', { name: /submit/i });
    await expect(submitBtn).toBeEnabled({ timeout: 15000 });
    await submitBtn.click();

    // Verify success
    await expect(
      page.locator('[data-sonner-toast]').or(page.getByText(/success/i))
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  test('should show validation errors for empty required fields', async ({ page }) => {
    // Try to submit without filling required fields
    const submitBtn = page.getByRole('button', { name: /submit/i });

    // If the button is disabled without valid input, verify that
    // If the button is clickable, click and check for error messages
    if (await submitBtn.isEnabled()) {
      await submitBtn.click();
      await expect(
        page.getByText(/required|fix \d+ issue/i)
      ).toBeVisible({ timeout: 5000 });
    } else {
      await expect(submitBtn).toBeDisabled();
    }
  });

  // ── Role Access ────────────────────────────────────────────────────────────

  // Uncomment if the page is role-restricted:
  // test('should deny access to unauthorized role', async ({ page }) => {
  //   await loginAs(page, 'employee'); // wrong role
  //   await page.goto('/<admin-path>');
  //   await page.waitForLoadState('domcontentloaded');
  //   await expect(page.getByText(/access denied/i)).toBeVisible({ timeout: 10000 });
  // });

  // ── Keyboard Navigation (Accessibility) ────────────────────────────────────

  test('should be keyboard navigable', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();

    // Verify focus-visible styling exists (no keyboard trap)
    const tagName = await focused.evaluate((el) => el.tagName.toLowerCase());
    expect(['input', 'button', 'select', 'textarea', 'a']).toContain(tagName);
  });

  // ── Mobile Viewport (Optional) ────────────────────────────────────────────

  // These run automatically via the Pixel 5 / iPhone 13 projects in playwright.config.ts.
  // Only add mobile-specific tests if the page has distinct mobile behavior:
  //
  // test('should show mobile card view instead of table', async ({ page }) => {
  //   await page.setViewportSize({ width: 375, height: 812 });
  //   await expect(page.locator('.md\\:hidden')).toBeVisible();
  //   await expect(page.locator('.hidden.md\\:block')).not.toBeVisible();
  // });
});
```

## Multi-Step Form Template (Wizard)

For forms with wizard steps (like JSA):

```typescript
test.describe('Multi-Step Form', () => {
  test('should complete all wizard steps', async ({ page }) => {
    // Step 1
    await expect(page.getByText(/step 1/i)).toBeVisible();
    await page.getByLabel(/Job Site/i).fill('Test Site');
    await page.getByRole('button', { name: /next/i }).click();

    // Step 2
    await expect(page.getByText(/step 2/i)).toBeVisible({ timeout: 5000 });
    // ... fill step 2 fields
    await page.getByRole('button', { name: /next/i }).click();

    // Final step — submit
    await expect(page.getByText(/review/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /submit/i }).click();

    // Success
    await expect(
      page.locator('[data-sonner-toast]')
    ).toBeVisible({ timeout: 15000 });
  });

  test('should preserve data when navigating back', async ({ page }) => {
    // Fill step 1
    await page.getByLabel(/Job Site/i).fill('Preserved Site');
    await page.getByRole('button', { name: /next/i }).click();

    // Go back
    await page.getByRole('button', { name: /back|previous/i }).click();

    // Verify data preserved
    await expect(page.getByLabel(/Job Site/i)).toHaveValue('Preserved Site');
  });
});
```

## Admin Table Page Template

For admin pages with data tables:

```typescript
test.describe('Admin Table Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/<path>');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should render data table', async ({ page }) => {
    // Wait for data to load (loading spinner disappears)
    await expect(page.locator('.animate-spin')).not.toBeVisible({ timeout: 15000 });
    
    // Table should have rows
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
  });

  test('should filter by search', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test query');
    
    // Wait for debounce (300ms) + re-render
    await page.waitForTimeout(500);
    
    // Verify filter applied (results narrowed or "no results" shown)
    // This is one of the few acceptable uses of waitForTimeout — debounce testing
  });

  test('should export CSV', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /csv/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
```

## Notes

- Always use `loginAs()` — never write login code in the spec
- The `test.setTimeout(60000)` override accounts for slow Supabase auth + data loading
- Toast selectors: `[data-sonner-toast]` is the most reliable, `[data-testid="toast-success"]` is a fallback
- For download testing, use `page.waitForEvent('download')` in a `Promise.all` with the click
- Use `test.skip()` when test data prerequisites aren't met, not `test.fail()`
