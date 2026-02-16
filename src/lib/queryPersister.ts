/**
 * React Query IndexedDB Persister
 *
 * Persists a filtered subset of the React Query cache to IndexedDB so that
 * announcements, assigned jobs, and user profile data survive app restarts
 * and are available offline.
 *
 * Only queries whose first key is in PERSISTABLE_KEYS are dehydrated.
 * Data has a 24-hour maxAge — stale offline data is a placeholder while fresh
 * data loads, not a source of truth.
 *
 * Gated behind offlineCapable flag (Phase 1.0).
 *
 * @module queryPersister
 */

import { openDB, deleteDB, type IDBPDatabase } from 'idb';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { logger } from './logger';
import { isOfflineCapable } from './offlineCapability';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DB_NAME = 'atts-query-cache';
const DB_VERSION = 1;
const STORE_NAME = 'persisted-client';
const CACHE_KEY = 'react-query';

/** Max age for persisted data (24 hours). */
export const PERSISTER_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Only these query key prefixes are persisted. Everything else stays in-memory
 * only and is lost on page refresh.
 */
export const PERSISTABLE_KEYS = [
  'announcements',
  'assigned-jobs',
  'user-profile',
  'user-role',
] as const;

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    }).catch(async (err: unknown) => {
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'VersionError') {
        logger.warn('[queryPersister] VersionError — deleting and recreating DB');
        try {
          await deleteDB(DB_NAME);
          return await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
              if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
              }
            },
          });
        } catch (recoveryErr) {
          dbPromise = null;
          throw recoveryErr;
        }
      }
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Persister implementation
// ---------------------------------------------------------------------------

/**
 * Creates an IndexedDB-backed persister for React Query.
 *
 * If IndexedDB is not available (offlineCapable === false), returns a no-op
 * persister that never reads or writes anything.
 */
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      if (!isOfflineCapable()) return;

      try {
        const db = await getDB();
        await db.put(STORE_NAME, client, CACHE_KEY);
      } catch (err) {
        logger.warn('[queryPersister] Failed to persist client:', err);
      }
    },

    restoreClient: async (): Promise<PersistedClient | undefined> => {
      if (!isOfflineCapable()) return undefined;

      try {
        const db = await getDB();
        const client = await db.get(STORE_NAME, CACHE_KEY) as PersistedClient | undefined;
        return client;
      } catch (err) {
        logger.warn('[queryPersister] Failed to restore client:', err);
        return undefined;
      }
    },

    removeClient: async () => {
      if (!isOfflineCapable()) return;

      try {
        const db = await getDB();
        await db.delete(STORE_NAME, CACHE_KEY);
      } catch (err) {
        logger.warn('[queryPersister] Failed to remove client:', err);
      }
    },
  };
}

/**
 * shouldDehydrateQuery filter for persistQueryClient.
 *
 * Only persists queries that:
 * 1. Have a key prefix in PERSISTABLE_KEYS
 * 2. Are in a 'success' state (don't persist errors or loading states)
 */
export function shouldDehydrateQuery(query: { queryKey: readonly unknown[]; state: { status: string } }): boolean {
  const firstKey = query.queryKey[0];
  if (typeof firstKey !== 'string') return false;

  return (
    (PERSISTABLE_KEYS as readonly string[]).includes(firstKey) &&
    query.state.status === 'success'
  );
}
