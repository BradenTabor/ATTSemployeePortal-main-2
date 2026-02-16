/**
 * Sync Conflicts Store
 *
 * Archives queued submissions that were discarded due to conflicts during
 * sync (e.g., a DVIR already exists for that date). Stored in IndexedDB
 * with a 7-day TTL so users can review what was dropped.
 *
 * @module syncConflicts
 */

import { openDB, type IDBPDatabase } from 'idb';
import { logger } from './logger';
import type { FormType } from './offlineQueue';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'atts-sync-conflicts';
const DB_VERSION = 1;
const STORE_NAME = 'conflicts';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface SyncConflict {
  id: string;
  formType: FormType;
  payload: Record<string, unknown>;
  photoIds?: string[];
  conflictReason: string;
  existingRecordId?: string;
  createdAt: number;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('byExpiresAt', 'expiresAt');
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Archive a conflicting submission.
 */
export async function archiveConflict(
  queueId: string,
  formType: FormType,
  payload: Record<string, unknown>,
  conflictReason: string,
  options?: {
    photoIds?: string[];
    existingRecordId?: string;
  },
): Promise<void> {
  const db = await getDB();
  const now = Date.now();
  const conflict: SyncConflict = {
    id: queueId,
    formType,
    payload,
    photoIds: options?.photoIds,
    conflictReason,
    existingRecordId: options?.existingRecordId,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  await db.put(STORE_NAME, conflict);
  logger.info('[syncConflicts] Archived conflict', {
    id: queueId,
    formType,
    reason: conflictReason,
  });
}

/**
 * Get all non-expired conflicts.
 */
export async function getConflicts(): Promise<SyncConflict[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME) as SyncConflict[];
  const now = Date.now();
  return all.filter((c) => c.expiresAt > now).sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get count of active conflicts.
 */
export async function getConflictCount(): Promise<number> {
  const conflicts = await getConflicts();
  return conflicts.length;
}

/**
 * Delete a specific conflict (e.g. after user reviews it).
 */
export async function deleteConflict(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/**
 * Delete all conflicts.
 */
export async function clearConflicts(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

/**
 * Clean up expired conflicts. Call periodically (e.g. on app init).
 */
export async function pruneExpiredConflicts(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME) as SyncConflict[];
  const now = Date.now();
  let pruned = 0;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const conflict of all) {
    if (conflict.expiresAt <= now) {
      tx.store.delete(conflict.id);
      pruned++;
    }
  }
  await tx.done;
  if (pruned > 0) {
    logger.info('[syncConflicts] Pruned expired conflicts', { count: pruned });
  }
  return pruned;
}
