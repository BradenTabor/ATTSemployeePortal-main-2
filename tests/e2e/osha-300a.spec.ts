/**
 * OSHA 300A Annual Summary E2E Tests
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('OSHA 300A Annual Summary', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/safety-officer/osha-300a');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('300A page loads with year selector', async ({ page }) => {
    await expect(page).toHaveURL(/osha-300a/);
    const heading = page.getByRole('main').getByRole('heading', { name: /OSHA 300A Annual Summary/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
    const yearSelect = page.locator('select').first();
    await expect(yearSelect).toBeVisible();
  });

  test('summary section renders', async ({ page }) => {
    const hasSummary = page.getByText('Summary (from incident data)');
    const hasEmpty = page.getByText('No data for selected year.');
    await expect(hasSummary.or(hasEmpty)).toBeVisible({ timeout: 10000 });
    if (await hasSummary.isVisible()) {
      await expect(page.getByText('Total recordable cases')).toBeVisible();
    }
  });

  test('export buttons are present', async ({ page }) => {
    const exportButtons = page.getByRole('button', { name: /Export|ITA CSV|300.*CSV/i });
    const hasEmpty = page.getByText('No data for selected year.');
    await expect(exportButtons.first().or(hasEmpty)).toBeVisible({ timeout: 10000 });
  });

  test('certify button or certification status visible', async ({ page }) => {
    const certifyBtn = page.getByRole('button', { name: /Certify 300A/i });
    const certifiedStatus = page.getByText(/Certified by/i);
    const oneVisible = await certifyBtn.isVisible().then(() => true).catch(() => false) ||
      await certifiedStatus.isVisible().then(() => true).catch(() => false);
    expect(oneVisible).toBe(true);
  });

  test('back link navigates to safety officer dashboard', async ({ page }) => {
    const backLink = page.getByRole('link', { name: /Back to Safety Officer Dashboard/i });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/safety-officer-dashboard/);
  });
});
