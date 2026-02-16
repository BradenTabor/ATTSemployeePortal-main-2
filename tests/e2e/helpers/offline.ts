/**
 * E2E Offline Test Helpers
 *
 * Shared utilities for offline-related Playwright tests. Encapsulates
 * common patterns to prevent recurring bugs across test files.
 *
 * KEY DESIGN DECISIONS:
 * - goOffline() dispatches the DOM `offline` event manually because
 *   Playwright's context.setOffline() intercepts at the protocol level
 *   but does NOT guarantee the browser fires the DOM event (especially
 *   in headless mode). The app's networkStatus store relies on that event.
 * - seedQueueItems() inserts directly into IndexedDB. This couples the
 *   test to the internal schema — see version notes on each helper.
 */

import { expect, type Page, type BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Schema constants — keep in sync with src/lib/offlineQueue.ts
// Target: Offline Queue v2 (DB_VERSION = 2)
// ---------------------------------------------------------------------------
const QUEUE_DB_NAME = 'atts-offline-queue';
const QUEUE_DB_VERSION = 2;
const QUEUE_STORE_NAME = 'submissions';

// ---------------------------------------------------------------------------
// Network state helpers
// ---------------------------------------------------------------------------

/**
 * Simulate going offline in Playwright.
 *
 * 1. Blocks network at protocol level via context.setOffline(true)
 * 2. Dispatches the DOM `offline` event so the app's networkStatus store
 *    transitions isOnline → false
 * 3. Asserts that the offline banner ("You're offline") becomes visible
 *    within `bannerTimeoutMs`. Fails hard if it doesn't — any downstream
 *    assertion would be meaningless without confirmed offline state.
 *
 * @param page - current Playwright page (must be on a route that renders
 *               OfflineModeBanner, typically /dashboard)
 * @param context - browser context to set offline
 * @param bannerTimeoutMs - how long to wait for the banner (default 5s)
 */
export async function goOffline(
  page: Page,
  context: BrowserContext,
  bannerTimeoutMs = 12_000,
): Promise<void> {
  await context.setOffline(true);

  // Manually fire the DOM event — Playwright's protocol-level offline
  // doesn't reliably trigger it in all engines (especially headless WebKit).
  // Dispatch multiple times with gaps to handle race conditions where the
  // event fires before the React listener is attached. WebKit/Mobile Safari
  // are particularly slow to propagate state changes through React.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // Check if banner appeared early
    const visible = await page
      .locator('text=You\'re offline')
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    if (visible) return;

    // Also force-set the networkStatus store directly as a fallback
    if (attempt === 1) {
      await page.evaluate(() => {
        // Ensure navigator.onLine reads false (some engines don't update it)
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        window.dispatchEvent(new Event('offline'));
      });
    }
  }

  // Final assertion: the banner should be visible by now.
  await expect(
    page.locator('text=You\'re offline').first(),
  ).toBeVisible({ timeout: bannerTimeoutMs });
}

/**
 * Simulate going back online.
 *
 * Restores network at protocol level and dispatches the DOM `online` event
 * so the app's networkStatus store transitions isOnline → true.
 */
export async function goOnline(
  page: Page,
  context: BrowserContext,
): Promise<void> {
  await context.setOffline(false);

  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
  });

  // Brief settle for React to re-render
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// IndexedDB helpers (offline queue v2 schema)
// ---------------------------------------------------------------------------

/**
 * Get the number of items in the offline queue.
 *
 * Schema target: atts-offline-queue v2, store "submissions"
 */
export async function getQueueLength(page: Page): Promise<number> {
  return page.evaluate(
    async ({ dbName, dbVersion, storeName }) => {
      return new Promise<number>((resolve) => {
        const req = indexedDB.open(dbName, dbVersion);
        req.onupgradeneeded = () => {
          // DB didn't exist or version mismatch — create the store so
          // the count query doesn't fail
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains(storeName)) {
              resolve(0);
              return;
            }
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const countReq = store.count();
            countReq.onsuccess = () => resolve(countReq.result);
            countReq.onerror = () => resolve(0);
          } catch {
            resolve(0);
          }
        };
        req.onerror = () => resolve(0);
      });
    },
    { dbName: QUEUE_DB_NAME, dbVersion: QUEUE_DB_VERSION, storeName: QUEUE_STORE_NAME },
  );
}

/**
 * Seed the offline queue with synthetic test items.
 *
 * Schema target: atts-offline-queue v2, store "submissions"
 * Field layout mirrors QueuedSubmission from src/lib/offlineQueue.ts
 *
 * @param page - Playwright page with IndexedDB access
 * @param count - number of items to insert
 * @param formType - form type to use (default: 'jsa')
 */
export async function seedQueueItems(
  page: Page,
  count: number,
  formType: 'jsa' | 'dvir' | 'equipment' = 'jsa',
): Promise<void> {
  await page.evaluate(
    async ({ n, ft, dbName, dbVersion, storeName }) => {
      const req = indexedDB.open(dbName, dbVersion);
      await new Promise<void>((resolve, reject) => {
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          for (let i = 0; i < n; i++) {
            store.put({
              id: `e2e-test-${Date.now()}-${i}`,
              formType: ft,
              payload: { __e2e: true, index: i },
              photoIds: [],
              timestamp: Date.now() + i,          // distinct timestamps for FIFO ordering
              retryCount: 0,
              status: 'pending',
            });
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    {
      n: count,
      ft: formType,
      dbName: QUEUE_DB_NAME,
      dbVersion: QUEUE_DB_VERSION,
      storeName: QUEUE_STORE_NAME,
    },
  );
}

/**
 * Clear all items from the offline queue.
 */
export async function clearQueue(page: Page): Promise<void> {
  await page.evaluate(
    async ({ dbName, dbVersion, storeName }) => {
      const req = indexedDB.open(dbName, dbVersion);
      await new Promise<void>((resolve, reject) => {
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(storeName)) {
            resolve();
            return;
          }
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          store.clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    },
    { dbName: QUEUE_DB_NAME, dbVersion: QUEUE_DB_VERSION, storeName: QUEUE_STORE_NAME },
  );
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the offline queue to drain by polling the UI for sync-completion
 * signals. Uses observable indicators (queue count = 0, success toast) rather
 * than arbitrary timeouts.
 *
 * @returns true if queue drained within timeout, false otherwise
 */
export async function waitForQueueEmpty(
  page: Page,
  timeoutMs = 30_000,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // Check for "synced successfully" indicator
    const syncSuccess = await page
      .locator('text=synced successfully, text=All submissions synced')
      .first()
      .isVisible()
      .catch(() => false);
    if (syncSuccess) return true;

    // Check that the pending submissions banner is gone
    const pendingBanner = await page
      .locator('text=Pending submissions')
      .first()
      .isVisible()
      .catch(() => false);
    if (!pendingBanner) {
      // Double-check via IDB
      const count = await getQueueLength(page);
      if (count === 0) return true;
    }

    await page.waitForTimeout(1_000);
  }
  return false;
}

/**
 * Get the count of items in the sync-conflicts IndexedDB store.
 */
export async function getConflictCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    return new Promise<number>((resolve) => {
      const req = indexedDB.open('atts-sync-conflicts', 1);
      req.onsuccess = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains('conflicts')) {
            resolve(0);
            return;
          }
          const tx = db.transaction('conflicts', 'readonly');
          const store = tx.objectStore('conflicts');
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => resolve(0);
        } catch {
          resolve(0);
        }
      };
      req.onerror = () => resolve(0);
    });
  });
}

/**
 * Get the number of photos in the offline photo store.
 */
export async function getPhotoCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    return new Promise<number>((resolve) => {
      const req = indexedDB.open('atts-offline-photos', 1);
      req.onsuccess = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains('photos')) {
            resolve(0);
            return;
          }
          const tx = db.transaction('photos', 'readonly');
          const store = tx.objectStore('photos');
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result);
          countReq.onerror = () => resolve(0);
        } catch {
          resolve(0);
        }
      };
      req.onerror = () => resolve(0);
    });
  });
}
