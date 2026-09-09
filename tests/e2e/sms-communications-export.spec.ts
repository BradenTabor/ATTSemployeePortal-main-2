/**
 * SMS Communications export section (Chunk 2).
 * Admin opens Data Export, expands SMS section, Load over a date range
 * succeeds on an empty result set (pre-migration soft-empty or no rows).
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('SMS Communications export', () => {
  test.setTimeout(60000);

  test('admin can load SMS export section over a date range without error', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(
      '/admin/safety-compliance?section=compliance-audit&auditTab=export',
      { waitUntil: 'domcontentloaded' }
    );

    const smsSection = page.getByTestId('export-section-sms');
    await expect(smsSection).toBeVisible({ timeout: 15000 });
    await expect(smsSection.getByRole('heading', { name: /SMS Communications/i })).toBeVisible();

    await smsSection.getByRole('button', { name: /SMS Communications/i }).click();
    await expect(smsSection.getByTestId('export-section-sms-load')).toBeVisible({ timeout: 5000 });

    await smsSection.getByTestId('export-section-sms-load').click();

    const count = smsSection.getByTestId('export-section-sms-count');
    const alert = smsSection.getByRole('alert');
    await expect(count.or(alert)).toBeVisible({ timeout: 20000 });

    if (await alert.isVisible().catch(() => false)) {
      const msg = (await alert.textContent()) ?? '';
      throw new Error(`SMS export Load failed: ${msg}`);
    }

    await expect(count).toContainText(/record/i);
  });
});
