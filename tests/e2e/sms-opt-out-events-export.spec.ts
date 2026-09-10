/**
 * SMS Opt-Out Events export section.
 *
 * Mirrors sms-communications-export.spec.ts: the two outcomes after Load are mutually
 * exclusive and must never be conflated — a missing table is "unavailable", an empty
 * date range is a real count of zero.
 *
 * This section is deliberately separate from SMS Communications. That export proves what
 * was sent; this one proves what was received and whether it was honoured, which is the
 * half a TCPA allegation turns on. The last assertion here guards that separation.
 */

import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const SECTION = 'export-section-sms_opt_out_events';

test.describe('SMS Opt-Out Events export', () => {
  test.setTimeout(60000);

  async function openOptOutSection(page: import('@playwright/test').Page) {
    await loginAs(page, 'admin');
    await page.goto(
      '/admin/safety-compliance?section=compliance-audit&auditTab=export',
      { waitUntil: 'domcontentloaded' }
    );

    const section = page.getByTestId(SECTION);
    await expect(section).toBeVisible({ timeout: 15000 });
    await expect(section.getByRole('heading', { name: /SMS Opt-Out Events/i })).toBeVisible();

    await section.getByRole('button', { name: /SMS Opt-Out Events/i }).click();
    await expect(section.getByTestId(`${SECTION}-load`)).toBeVisible({ timeout: 5000 });

    return section;
  }

  async function loadWideRange(section: import('@playwright/test').Locator) {
    // The historical record is backdated to 2026-03-04, outside the default 90-day window.
    await section.getByTestId(`${SECTION}-from`).fill('2026-01-01');
    await section.getByTestId(`${SECTION}-load`).click();
  }

  test('is a section of its own, not merged into SMS Communications', async ({ page }) => {
    const section = await openOptOutSection(page);
    const sendLogSection = page.getByTestId('export-section-sms');

    await expect(sendLogSection).toBeVisible();
    await expect(sendLogSection.getByRole('heading', { name: /SMS Communications/i })).toBeVisible();

    // Not a text search: this section's description names the other one on purpose,
    // to explain the separation. What must not appear here is the other section's
    // heading or its distinctive send-log columns.
    await expect(section.getByRole('heading', { name: /SMS Communications/i })).toHaveCount(0);
    await expect(section.locator('th', { hasText: /Provider Status|Delivery Status/i })).toHaveCount(0);
  });

  test('unavailable: Load shows the opt-out migration warning, not a zero count', async ({ page }) => {
    const section = await openOptOutSection(page);
    await loadWideRange(section);

    const unavailable = section.getByTestId(`${SECTION}-unavailable`);
    const count = section.getByTestId(`${SECTION}-count`);
    const alert = section.getByRole('alert');

    await expect(unavailable.or(count).or(alert)).toBeVisible({ timeout: 20000 });

    if (await count.isVisible().catch(() => false)) {
      test.skip(true, 'sms_opt_out_events is present — the loaded path applies');
      return;
    }

    if (await alert.isVisible().catch(() => false)) {
      const msg = (await alert.textContent()) ?? '';
      throw new Error(`Opt-out export Load failed with error (expected unavailable): ${msg}`);
    }

    // Must name its own migration, not the send log's.
    await expect(unavailable).toContainText(/migration 20260909110000/i);
    await expect(unavailable).toContainText(/not an empty date range/i);
    await expect(count).toHaveCount(0);
  });

  test('loaded: shows a real record count and legible provenance', async ({ page }) => {
    const section = await openOptOutSection(page);
    await loadWideRange(section);

    const unavailable = section.getByTestId(`${SECTION}-unavailable`);
    const count = section.getByTestId(`${SECTION}-count`);
    const alert = section.getByRole('alert');

    await expect(unavailable.or(count).or(alert)).toBeVisible({ timeout: 20000 });

    if (await unavailable.isVisible().catch(() => false)) {
      test.skip(true, 'sms_opt_out_events missing — unavailable path applies');
      return;
    }

    if (await alert.isVisible().catch(() => false)) {
      const msg = (await alert.textContent()) ?? '';
      throw new Error(`Opt-out export Load failed: ${msg}`);
    }

    await expect(count).toBeVisible();
    const text = (await count.textContent()) ?? '';
    if (/\b0\b/.test(text)) {
      // Empty range must be labeled as a successful empty, not a silent soft-empty.
      await expect(count).toContainText(/in range/i);
      return;
    }

    // Caveats travel with the data, not just with the file.
    await expect(section.getByTestId(`${SECTION}-note`).first()).toContainText(
      /what was said to us|not what we sent|deliberately not merged/i
    );

    // A retrospective reconstruction must not read as a live inbound event.
    const table = section.locator('table');
    await expect(table).toBeVisible();
    const body = (await table.textContent()) ?? '';
    if (/RETROSPECTIVE RECORD/i.test(body)) {
      expect(body).toMatch(/Admin-entered \(not a live inbound message\)/i);
      expect(body).toMatch(/not a live inbound event/i);
    }

    // Preview masks the phone; full E.164 is CSV-only.
    expect(body).not.toMatch(/\+1\d{10}/);
  });
});
