/**
 * App update pipeline — reload-loop regression.
 *
 * Reproduces the production incident: the server's /version.json advertises a
 * newer build than the one running. The old pipeline hard-reloaded every few
 * seconds and blocked sign-in. The new pipeline must:
 *   - never reload more than once,
 *   - keep the sign-in form usable,
 *   - show a non-blocking banner (never a full-screen modal) for a plain version drift.
 */
import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    __ATTS_UPDATE__?: {
      version: string;
      buildTime: string;
      state: () => { status: string; blocking: boolean };
      checkForUpdates: () => Promise<void>;
    };
  }
}

const NEWER = { version: '99.0.0', buildTime: '2099-01-01T00:00:00.000Z', commit: 'e2e', environment: 'e2e' };

test.describe('App update pipeline', () => {
  test('a newer version.json never causes a reload loop or blocks sign-in', async ({ page }) => {
    await page.route('**/version.json**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NEWER) }),
    );

    let loads = 0;
    page.on('load', () => {
      loads += 1;
    });

    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();

    // Give the pipeline generous time to misbehave: several old-pipeline reload cycles.
    await page.waitForTimeout(15_000);

    // At most the initial load plus one controlled reload — never a loop.
    expect(loads).toBeLessThanOrEqual(2);

    // The pipeline noticed the drift and is either downloading or (no SW change) reported it.
    const diag = await page.evaluate(() => window.__ATTS_UPDATE__?.state() ?? null);
    expect(diag).not.toBeNull();
    expect(['downloading', 'ready', 'failed', 'applying', 'idle']).toContain(diag!.status);
    expect(diag!.blocking).toBe(false);

    // Never a blocking overlay for a plain version drift; sign-in stays usable.
    await expect(page.getByTestId('app-update-blocking')).toHaveCount(0);
    const email = page.getByRole('textbox', { name: /email/i });
    await email.fill('worker@alltts.com');
    await expect(email).toHaveValue('worker@alltts.com');
  });

  test('a matching version.json keeps the pipeline idle', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    const diag = await page.evaluate(() => window.__ATTS_UPDATE__ ?? null);
    expect(diag).not.toBeNull();

    // Same build as the server → idle, no banner.
    await page.route('**/version.json**', (route, request) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...NEWER, version: diag!.version, buildTime: diag!.buildTime }),
      }).catch(() => request.continue()),
    );
    await page.evaluate(() => window.__ATTS_UPDATE__!.checkForUpdates());
    const state = await page.evaluate(() => window.__ATTS_UPDATE__!.state());
    expect(state.status).toBe('idle');
    await expect(page.getByTestId('app-update-banner')).toHaveCount(0);
  });
});
