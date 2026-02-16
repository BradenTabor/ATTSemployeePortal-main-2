/**
 * Mobile Auto-Zoom Prevention E2E Tests
 *
 * Smoke tests at mobile viewport to ensure the JSA location picker flow
 * and other form interactions do not leave the page in a broken layout
 * (e.g. after modal close). Real iOS device testing is required to verify
 * that focus-triggered auto-zoom is fully prevented.
 */

import { test, expect } from '@playwright/test';
import { loginAs, dismissOnboardingIfPresent } from './helpers/auth';

const MOBILE_VIEWPORT = { width: 375, height: 667 }; // iPhone SE

test.describe('Mobile Auto-Zoom Prevention', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('JSA location picker open and close does not break layout', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/forms/jsa');
    await page.waitForTimeout(1200);
    await dismissOnboardingIfPresent(page);
    await page.waitForSelector('[data-testid="jsa-wizard"]', { timeout: 10000 });

    await expect(page.getByText('Job Information')).toBeVisible();
    const openMapHospital = page.getByRole('button', {
      name: /open map to select hospital/i,
    });
    await expect(openMapHospital).toBeVisible();
    await openMapHospital.click();

    // Map picker may use role="dialog" or a custom fixed overlay.
    // Wait for any overlay to appear after clicking the map button.
    await page.waitForTimeout(1000);

    // Close the overlay. We must avoid the Sonner toast close button
    // (data-close-button="true") which can also match /close/i.
    // Scope: look for a Cancel/Close button that is NOT a toast close button.
    const cancelInDialog = page.locator(
      'button:not([data-close-button]):is(:text-matches("cancel|close", "i"))'
    );
    const dialogCloseX = page.locator('[role="dialog"] button[aria-label*="close" i], .fixed.inset-0 button[aria-label*="close" i]');
    const escapeKey = async () => { await page.keyboard.press('Escape'); };

    const cancelVisible = await cancelInDialog.first().isVisible({ timeout: 3000 }).catch(() => false);
    const closeXVisible = await dialogCloseX.first().isVisible({ timeout: 1000 }).catch(() => false);

    if (cancelVisible) {
      await cancelInDialog.first().click();
    } else if (closeXVisible) {
      await dialogCloseX.first().click();
    } else {
      // Fallback: press Escape to dismiss any overlay
      await escapeKey();
    }
    await page.waitForTimeout(500);

    // After closing, the JSA form should still be intact
    await expect(page.getByText('Job Information')).toBeVisible();
    await expect(page.getByLabel(/Work Location/i)).toBeVisible();
  });

  test('Form inputs remain usable at mobile viewport', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/forms/jsa');
    await page.waitForTimeout(1200);
    await dismissOnboardingIfPresent(page);
    await page.waitForSelector('[data-testid="jsa-wizard"]', { timeout: 10000 });

    const workLocation = page.getByLabel(/Work Location/i);
    await workLocation.click();
    await workLocation.fill('Test location');
    await expect(workLocation).toHaveValue('Test location');

    // The Circuit # field has no explicit htmlFor/id association, so getByLabel
    // may not resolve. Use getByPlaceholder which targets the input directly.
    const circuitInput = page.getByPlaceholder('Circuit number');
    await circuitInput.click();
    await circuitInput.fill('CKT-001');
    await expect(circuitInput).toHaveValue('CKT-001');
  });
});
