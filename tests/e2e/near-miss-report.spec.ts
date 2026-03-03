/**
 * Near-Miss Report E2E Tests
 *
 * Happy path, employee role access, form validation.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

async function dismissWhatsNewModal(page: import('@playwright/test').Page) {
  const skip = page.getByRole('button', { name: 'Skip' });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

test.describe('Near-Miss Report Form', () => {
  test.setTimeout(60000);

  test('employee role can access near-miss form', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/near-miss');
    await page.waitForLoadState('domcontentloaded');
    await dismissWhatsNewModal(page);

    // Form should load (all roles can report near-miss)
    const heading = page.getByRole('heading', { name: /Report Near-Miss/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
    const categorySelect = page.locator('select').first();
    await expect(categorySelect).toBeVisible({ timeout: 5000 });
  });

  test('form validates required fields', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard/forms/near-miss');
    await page.waitForLoadState('domcontentloaded');
    await dismissWhatsNewModal(page);

    // Submit without filling required fields
    const submitBtn = page.getByRole('button', { name: /Submit Report/i });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();

    // Should show validation errors or stay on form
    await page.waitForTimeout(500);
    const heading = page.getByRole('heading', { name: /Report Near-Miss/i });
    await expect(heading).toBeVisible();
  });
});
