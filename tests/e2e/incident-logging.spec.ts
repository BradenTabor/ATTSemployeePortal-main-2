/**
 * Incident Logging E2E Tests
 *
 * Admin incident list, OSHA 300 export access.
 * Full incident creation flow is owned by Agent 2 (IncidentLoggingModal).
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Incident Logging', () => {
  test.setTimeout(60000);

  test('admin can access incident list and OSHA 300 export', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to incident-related admin area (Safety Incidents or Compliance)
    const incidentsLink = page.getByRole('link', { name: /incident|safety/i });
    if (await incidentsLink.first().isVisible().catch(() => false)) {
      await incidentsLink.first().click();
      await page.waitForLoadState('domcontentloaded');
    }

    // OSHA 300 export or incident list should be present
    const exportBtn = page.getByRole('button', { name: /OSHA|export/i });
    const incidentSection = page.getByText(/safety incident|incident log/i);
    const hasExport = await exportBtn.first().isVisible().catch(() => false);
    const hasSection = await incidentSection.first().isVisible().catch(() => false);
    expect(hasExport || hasSection).toBeTruthy();
  });
});
