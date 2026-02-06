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

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();

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

    const circuitInput = page.getByLabel(/Circuit/i);
    await circuitInput.click();
    await circuitInput.fill('CKT-001');
    await expect(circuitInput).toHaveValue('CKT-001');
  });
});
