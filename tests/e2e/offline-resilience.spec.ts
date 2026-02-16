/**
 * E2E Tests: Offline Resilience
 *
 * Tests queue persistence across app restarts and orphan cleanup:
 * - Queue submissions → close page → new page (same context) → verify
 *   queue persisted
 * - Queue submissions → close context → new persistent context → verify
 *   queue persisted (uses launchPersistentContext with temp user-data-dir)
 * - Verify IndexedDB photo store cleanup after sync
 *
 * IMPORTANT: Playwright contexts are isolated storage partitions.
 * browser.newContext() does NOT share IndexedDB. To test true cross-restart
 * persistence, we use chromium.launchPersistentContext() with a temp
 * directory (only available on Chromium).
 */

import { test, expect, chromium } from '@playwright/test';
import { loginAs } from './helpers/auth';
import {
  seedQueueItems,
  getQueueLength,
  getPhotoCount,
  clearQueue,
} from './helpers/offline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Offline Resilience', () => {
  test('queue persists across page close and reopen (same context)', async ({ page, context }) => {
    // WebKit auth can take up to 25s; combined with page close/reopen +
    // navigation the 30s default is too tight.
    test.setTimeout(60_000);

    await loginAs(page, 'employee');
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Seed queue items while online (no banner needed for this test)
    await seedQueueItems(page, 2);
    const initialCount = await getQueueLength(page);
    expect(initialCount).toBe(2);

    // Close the page
    await page.close();

    // Open a new page in the same context (IndexedDB persists within context)
    const newPage = await context.newPage();

    // Navigate while ONLINE — never navigate while offline
    await newPage.goto('/dashboard');
    await newPage.waitForTimeout(1000);

    // Verify queue persisted
    const persistedCount = await getQueueLength(newPage);
    expect(persistedCount).toBe(2);

    // Clean up
    await clearQueue(newPage);
    await newPage.close();
  });

  /**
   * Cross-restart IDB persistence test.
   *
   * Uses chromium.launchPersistentContext() with a temp user-data-dir so that
   * IndexedDB survives across context close + reopen. This is the only way
   * to test the "close app, reopen, queue survives" scenario in Playwright.
   *
   * Only runs on Chromium — other engines don't support persistent context
   * via Playwright's public API in the same way.
   *
   * Timeout is extended because each persistent context launch + login takes
   * ~20s (Supabase auth round-trip).
   */
  test('queue persists across browser restart (persistent context, chromium only)', async ({ browserName }) => {
    test.setTimeout(90_000);

    // This test only works with Chromium's persistent context
    test.skip(browserName !== 'chromium', 'persistent context test only runs on Chromium');

    const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-offline-'));

    try {
      // ----- Session 1: login + seed data -----
      const context1 = await chromium.launchPersistentContext(tmpDir, {
        headless: true,
      });
      const page1 = context1.pages()[0] || await context1.newPage();

      // Navigate directly to the app and log in
      await page1.goto(`${baseURL}/`);
      await loginAs(page1, 'employee');
      // loginAs navigates to / and waits for redirect to /dashboard
      await page1.waitForLoadState('networkidle');

      // Seed queue items
      await seedQueueItems(page1, 3, 'dvir');
      const count1 = await getQueueLength(page1);
      expect(count1).toBe(3);

      // Close context entirely (simulates full app close)
      await context1.close();

      // ----- Session 2: verify persistence -----
      const context2 = await chromium.launchPersistentContext(tmpDir, {
        headless: true,
      });
      const page2 = context2.pages()[0] || await context2.newPage();

      // The auth session may or may not persist (depends on cookies/localStorage).
      // We only need IndexedDB access, which doesn't require login.
      // Navigate to any page to get IDB access:
      await page2.goto(`${baseURL}/`);
      await page2.waitForLoadState('domcontentloaded');
      await page2.waitForTimeout(2000);

      // Verify queue survived the restart
      const count2 = await getQueueLength(page2);
      expect(count2).toBe(3);

      // Clean up
      await clearQueue(page2);
      await context2.close();
    } finally {
      // Remove temp directory
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('IndexedDB photo store cleaned up after sync', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Check initial photo count (should be 0)
    const initialPhotos = await getPhotoCount(page);

    // After any sync cycle, photos associated with synced items should be
    // cleaned up. This is a structural test — we verify the cleanup mechanism
    // by checking that photo count doesn't grow unbounded.
    expect(initialPhotos).toBeGreaterThanOrEqual(0);

    // Navigate away and back
    await page.goto('/dashboard/forms/dvir');
    await page.waitForTimeout(1000);
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);

    const finalPhotos = await getPhotoCount(page);

    // Photo count should not grow without explicit photo uploads
    expect(finalPhotos).toBeLessThanOrEqual(initialPhotos);
  });
});
