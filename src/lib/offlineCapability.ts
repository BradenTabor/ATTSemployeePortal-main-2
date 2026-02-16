/**
 * Offline Capability Detection
 *
 * Tests whether the browser supports IndexedDB reliably (fails in incognito
 * on some browsers, or when storage is disabled). Every offline feature is
 * gated behind the `offlineCapable` flag exposed by the Zustand store.
 *
 * Usage:
 *   import { useOfflineCapability } from '../lib/offlineCapability';
 *   const { offlineCapable, probeComplete } = useOfflineCapability();
 *
 * The probe runs once on first access, caches the result in memory, and
 * never writes to localStorage or any other persistent store (since those
 * might be the things that are broken).
 *
 * @module offlineCapability
 */

import { create } from 'zustand';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// IndexedDB probe
// ---------------------------------------------------------------------------

const PROBE_DB_NAME = '__atts_idb_probe__';

let probeResultCache: boolean | null = null;

/**
 * Open a throwaway IndexedDB, write a value, read it back, then delete the DB.
 * Returns `true` if everything works, `false` otherwise.
 */
async function probeIndexedDB(): Promise<boolean> {
  // Return cached result if we've already probed this session
  if (probeResultCache !== null) return probeResultCache;

  try {
    if (typeof indexedDB === 'undefined') {
      probeResultCache = false;
      return false;
    }

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(PROBE_DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('probe', { keyPath: 'id' });
      };
    });

    // Write
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('probe', 'readwrite');
      tx.objectStore('probe').put({ id: 'test', value: 1 });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Read back
    const val = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('probe', 'readonly');
      const req = tx.objectStore('probe').get('test');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    db.close();

    // Clean up the probe database
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(PROBE_DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // best-effort cleanup
      req.onblocked = () => resolve();
    });

    const ok = val != null && (val as { value: number }).value === 1;
    probeResultCache = ok;

    if (!ok) {
      logger.warn('[offlineCapability] IndexedDB probe: write/read mismatch');
    }

    return ok;
  } catch (err) {
    logger.warn('[offlineCapability] IndexedDB probe failed:', err);
    probeResultCache = false;
    return false;
  }
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

interface OfflineCapabilityState {
  /** Whether IndexedDB is available and functional. */
  offlineCapable: boolean;
  /** Whether the initial probe has completed. */
  probeComplete: boolean;
  /** Whether the one-time "offline not available" notice has been dismissed. */
  noticeDismissed: boolean;
  /** Run the probe (idempotent — only runs once). */
  runProbe: () => Promise<void>;
  /** Dismiss the "offline not available" notice. */
  dismissNotice: () => void;
}

export const useOfflineCapability = create<OfflineCapabilityState>()((set, get) => ({
  offlineCapable: true, // optimistic default until probe completes
  probeComplete: false,
  noticeDismissed: false,

  runProbe: async () => {
    // Only run once
    if (get().probeComplete) return;

    const ok = await probeIndexedDB();
    set({ offlineCapable: ok, probeComplete: true });

    if (ok) {
      logger.info('[offlineCapability] IndexedDB available — offline features enabled');
    } else {
      logger.warn('[offlineCapability] IndexedDB unavailable — offline features disabled');
    }
  },

  dismissNotice: () => set({ noticeDismissed: true }),
}));

/**
 * Convenience: check capability synchronously (after probe).
 * Returns `true` if the probe passed or hasn't run yet (optimistic).
 */
export function isOfflineCapable(): boolean {
  return useOfflineCapability.getState().offlineCapable;
}
