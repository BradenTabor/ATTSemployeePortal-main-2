/**
 * SMS Communications export section (Chunk 2).
 * Two mutually exclusive outcomes after Load — never conflate soft-empty with zero rows:
 *  - pre-migration: unavailable warning (no count)
 *  - post-migration: real record count (including "0 records in range")
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('SMS Communications export', () => {
  test.setTimeout(60000);

  async function openSmsSectionAndLoad(page: import('@playwright/test').Page) {
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

    return smsSection;
  }

  test('pre-migration: Load shows unavailable warning, not a zero count', async ({ page }) => {
    const smsSection = await openSmsSectionAndLoad(page);

    const unavailable = smsSection.getByTestId('export-section-sms-unavailable');
    const count = smsSection.getByTestId('export-section-sms-count');
    const alert = smsSection.getByRole('alert');

    await expect(unavailable.or(count).or(alert)).toBeVisible({ timeout: 20000 });

    if (await count.isVisible().catch(() => false)) {
      test.skip(true, 'sms_message_log_compat is present — post-migration path applies');
      return;
    }

    if (await alert.isVisible().catch(() => false)) {
      const msg = (await alert.textContent()) ?? '';
      throw new Error(`SMS export Load failed with error (expected unavailable): ${msg}`);
    }

    await expect(unavailable).toBeVisible();
    await expect(unavailable).toContainText(/migration 20260902200000/i);
    await expect(unavailable).toContainText(/not an empty date range/i);
    await expect(count).toHaveCount(0);

    const exportCsv = smsSection.getByRole('button', { name: /Export CSV/i });
    const exportPdf = smsSection.getByRole('button', { name: /Export PDF/i });
    await expect(exportCsv).toHaveCount(0);
    await expect(exportPdf).toHaveCount(0);
  });

  test('post-migration: Load shows a real record count (including empty range)', async ({ page }) => {
    const smsSection = await openSmsSectionAndLoad(page);

    const unavailable = smsSection.getByTestId('export-section-sms-unavailable');
    const count = smsSection.getByTestId('export-section-sms-count');
    const alert = smsSection.getByRole('alert');

    await expect(unavailable.or(count).or(alert)).toBeVisible({ timeout: 20000 });

    if (await unavailable.isVisible().catch(() => false)) {
      test.skip(true, 'sms_message_log_compat missing — pre-migration unavailable path applies');
      return;
    }

    if (await alert.isVisible().catch(() => false)) {
      const msg = (await alert.textContent()) ?? '';
      throw new Error(`SMS export Load failed: ${msg}`);
    }

    await expect(count).toBeVisible();
    await expect(count).toContainText(/record/i);
    // Empty range must be labeled as successful empty — not silent soft-empty.
    const text = (await count.textContent()) ?? '';
    if (/\b0\b/.test(text)) {
      await expect(count).toContainText(/in range/i);
    }
  });
});
