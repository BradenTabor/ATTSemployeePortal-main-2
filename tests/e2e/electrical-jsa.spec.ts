import { test, expect } from '@playwright/test';

/**
 * E2E: Electrical hazard section in Daily JSA
 * - Electrical hazards selected → section appears
 * - Voltage selection → MAD displays (when voltage > 0)
 * - Submission blocked when required electrical fields empty
 * - Successful submission with all electrical fields filled (requires full auth flow)
 */

test.describe('Electrical JSA section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Assume authenticated - adjust if your app requires login first
  });

  test('electrical hazard section appears when electrical hazards selected', async ({
    page,
  }) => {
    await page.goto('/forms/jsa/new');
    // Wait for form to load
    await expect(page.getByText(/Daily JSA|Job Info/i)).toBeVisible({ timeout: 10000 });

    // Navigate to hazards step (step 4)
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /Next|→/i }).click();
    }

    // Click "Lines energized?" to toggle electrical hazard
    await page.getByRole('button', { name: /Lines energized/i }).click();

    // Electrical hazard details section should appear
    await expect(
      page.getByRole('region', { name: /Electrical hazard details/i })
    ).toBeVisible({ timeout: 5000 });
  });

  test('voltage selection shows MAD display when valid voltage', async ({
    page,
  }) => {
    await page.goto('/forms/jsa/new');
    await expect(page.getByText(/Daily JSA|Job Info/i)).toBeVisible({ timeout: 10000 });

    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: /Next|→/i }).click();
    }

    await page.getByRole('button', { name: /Lines energized/i }).click();

    // Select 12.47kV from dropdown
    await page.getByLabel(/Voltage/i).selectOption({ value: '12.47' });

    // MAD display should appear
    await expect(page.getByText(/Minimum Approach Distance|Phase-to-ground/i)).toBeVisible({
      timeout: 3000,
    });
  });
});
