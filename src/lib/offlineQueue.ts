/**
 * Offline Submission Queue (v2)
 *
 * Stores form submissions when the app is offline and syncs when connectivity
 * returns. Uses IndexedDB for persistence.
 *
 * v2 additions:
 * - `photoIds` field linking to offlinePhotoStore blobs
 * - Priority-based processing: text-only first, then photo submissions
 * - Photo-specific retry schedule (30s / 120s / 300s, 3 retries max)
 * - Progress callbacks for SyncProgressIndicator
 * - Conflict resolution with archival (not discard)
 *
 * @module offlineQueue
 */

import { openDB, deleteDB, type IDBPDatabase } from 'idb';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'atts-offline-queue';
const DB_VERSION = 2;
const STORE_NAME = 'submissions';

export type FormType = 'jsa' | 'dvir' | 'equipment';

export type QueuedSubmissionStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'failed_manual';

export interface QueuedSubmission {
  id: string;
  formType: FormType;
  payload: Record<string, unknown>;
  /** Photo IDs referencing blobs in offlinePhotoStore. Empty array = text-only. */
  photoIds: string[];
  userId?: string;
  dateFor?: string;
  timestamp: number;
  retryCount: number;
  status: QueuedSubmissionStatus;
  error?: string;
}

export type OfflineSubmitter = (
  formType: FormType,
  payload: Record<string, unknown>,
  photoIds: string[],
) => Promise<void>;

/** Progress callback emitted during processQueue. */
export interface SyncProgress {
  /** Current submission index (1-based). */
  current: number;
  /** Total submissions to process. */
  total: number;
  /** Current form type being processed. */
  formType: FormType;
  /** Whether the current submission has photos. */
  hasPhotos: boolean;
}

// Retry schedule for text-only submissions
const TEXT_DEFAULT_BACKOFF_MS = 1_000;
const TEXT_MAX_BACKOFF_MS = 30_000;
const TEXT_MAX_RETRIES = 5;

// Retry schedule for photo submissions (longer intervals, fewer retries)
const PHOTO_RETRY_DELAYS_MS = [30_000, 120_000, 300_000]; // 30s, 120s, 300s
const PHOTO_MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Database access
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        // v2: photoIds field added to schema (no store migration needed —
        // existing entries without photoIds default to [] in code)
      },
    }).catch(async (err: unknown) => {
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'VersionError') {
        logger.warn('[offlineQueue] VersionError — deleting and recreating DB');
        try {
          await deleteDB(DB_NAME);
          return await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
              if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeEntry(raw: Record<string, unknown>): QueuedSubmission {
  return {
    ...raw,
    // Ensure v1 entries (without photoIds) get an empty array
    photoIds: (raw.photoIds as string[] | undefined) ?? [],
  } as QueuedSubmission;
}

async function getAllActionable(db: IDBPDatabase): Promise<QueuedSubmission[]> {
  const all = await db.getAll(STORE_NAME);
  return (all as Record<string, unknown>[])
    .map(normalizeEntry)
    .filter((i) => i.status === 'pending' || i.status === 'failed');
}

/**
 * Backoff delay for text-only submissions: exponential with jitter, capped.
 */
function textBackoffMs(retryCount: number): number {
  const exp = Math.min(TEXT_DEFAULT_BACKOFF_MS * Math.pow(2, retryCount), TEXT_MAX_BACKOFF_MS);
  const jitter = Math.random() * 0.3 * exp;
  return Math.floor(exp + jitter);
}

/**
 * Backoff delay for photo submissions: fixed schedule.
 */
function photoBackoffMs(retryCount: number): number {
  if (retryCount >= PHOTO_RETRY_DELAYS_MS.length) return PHOTO_RETRY_DELAYS_MS[PHOTO_RETRY_DELAYS_MS.length - 1];
  return PHOTO_RETRY_DELAYS_MS[retryCount];
}

function hasPhotos(item: QueuedSubmission): boolean {
  return item.photoIds.length > 0;
}

function maxRetries(item: QueuedSubmission): number {
  return hasPhotos(item) ? PHOTO_MAX_RETRIES : TEXT_MAX_RETRIES;
}

function backoffMs(item: QueuedSubmission): number {
  return hasPhotos(item) ? photoBackoffMs(item.retryCount) : textBackoffMs(item.retryCount);
}

/**
 * Sort items for priority processing: text-only first, then photos.
 * Within each tier, maintain FIFO (timestamp order).
 */
function sortByPriority(items: QueuedSubmission[]): QueuedSubmission[] {
  return [...items].sort((a, b) => {
    const aHasPhotos = hasPhotos(a) ? 1 : 0;
    const bHasPhotos = hasPhotos(b) ? 1 : 0;
    if (aHasPhotos !== bHasPhotos) return aHasPhotos - bHasPhotos;
    return a.timestamp - b.timestamp;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add a submission to the queue.
 */
export async function addToQueue(
  formType: FormType,
  payload: Record<string, unknown>,
  options?: {
    userId?: string;
    dateFor?: string;
    photoIds?: string[];
  },
): Promise<string> {
  const id = `atts-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const item: QueuedSubmission = {
    id,
    formType,
    payload: JSON.parse(JSON.stringify(payload)),
    photoIds: options?.photoIds ?? [],
    userId: options?.userId,
    dateFor: options?.dateFor,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  };
  const db = await getDB();
  await db.put(STORE_NAME, item);
  logger.info('[offlineQueue] Added to queue', {
    id,
    formType,
    hasPhotos: item.photoIds.length > 0,
    photoCount: item.photoIds.length,
  });
  return id;
}

/**
 * Get count of actionable items (pending + failed) in the queue.
 */
export async function getQueueLength(): Promise<number> {
  const db = await getDB();
  const items = await getAllActionable(db);
  return items.length;
}

/**
 * Get all pending/failed items for UI display.
 */
export async function getPendingItems(): Promise<QueuedSubmission[]> {
  const db = await getDB();
  const items = await getAllActionable(db);
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get all items (including synced/failed_manual) for the queue panel.
 */
export async function getAllItems(): Promise<QueuedSubmission[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return (all as Record<string, unknown>[])
    .map(normalizeEntry)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Process the queue with priority ordering and progress callbacks.
 *
 * Processing order: text-only submissions first, then photo submissions.
 * Each tier is processed in FIFO order.
 */
export async function processQueue(
  submitter: OfflineSubmitter,
  options?: {
    conflictCheck?: (item: QueuedSubmission) => Promise<boolean>;
    onProgress?: (progress: SyncProgress) => void;
    /** Called when a conflict is detected, with the discarded item. */
    onConflict?: (item: QueuedSubmission) => void;
    /** Called after each individual item syncs successfully. */
    onItemSynced?: (item: QueuedSubmission) => void;
    /** Called when an item fails (after retry logic). */
    onItemFailed?: (item: QueuedSubmission, error: string) => void;
  },
): Promise<{ processed: number; failed: number; discarded: number }> {
  const db = await getDB();
  const items = await getAllActionable(db);
  const sorted = sortByPriority(items);

  let processed = 0;
  let failed = 0;
  let discarded = 0;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];

    // Max retries exceeded
    if (item.retryCount >= maxRetries(item)) {
      const status: QueuedSubmissionStatus = hasPhotos(item) ? 'failed_manual' : 'failed';
      item.status = status;
      item.error = hasPhotos(item)
        ? 'Photo upload failed after 3 attempts — manual retry required'
        : 'Max retries exceeded';
      await db.put(STORE_NAME, item);
      failed++;
      continue;
    }

    // Backoff check: skip if not enough time has passed since last failure
    if (item.status === 'failed') {
      const delay = backoffMs(item);
      if (Date.now() - item.timestamp < delay) {
        continue;
      }
    }

    // Conflict check
    if (options?.conflictCheck && (await options.conflictCheck(item))) {
      options?.onConflict?.(item);
      await db.delete(STORE_NAME, item.id);
      discarded++;
      continue;
    }

    // Emit progress
    options?.onProgress?.({
      current: processed + failed + discarded + 1,
      total: sorted.length,
      formType: item.formType,
      hasPhotos: hasPhotos(item),
    });

    // Mark as syncing
    item.status = 'syncing';
    item.timestamp = Date.now();
    await db.put(STORE_NAME, item);

    try {
      await submitter(item.formType, item.payload, item.photoIds);
      await db.delete(STORE_NAME, item.id);
      processed++;
      // Notify per-item success
      options?.onItemSynced?.(item);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[offlineQueue] Submit failed', {
        id: item.id,
        formType: item.formType,
        hasPhotos: hasPhotos(item),
        error: message,
        retryCount: item.retryCount + 1,
      });
      item.status = 'failed';
      item.retryCount += 1;
      item.error = message;
      item.timestamp = Date.now();
      await db.put(STORE_NAME, item);
      failed++;
      // Notify per-item failure
      options?.onItemFailed?.(item, message);
    }
  }

  return { processed, failed, discarded };
}

/**
 * Remove a single item from the queue (e.g. user chose "discard").
 */
export async function removeFromQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/**
 * Get a single queue entry by ID.
 */
export async function getQueueItem(id: string): Promise<QueuedSubmission | undefined> {
  const db = await getDB();
  const raw = await db.get(STORE_NAME, id);
  return raw ? normalizeEntry(raw as Record<string, unknown>) : undefined;
}

/**
 * Reset a failed_manual item to pending for manual retry.
 */
export async function retryManual(id: string): Promise<void> {
  const db = await getDB();
  const raw = await db.get(STORE_NAME, id);
  if (!raw) return;
  const item = normalizeEntry(raw as Record<string, unknown>);
  item.status = 'pending';
  item.retryCount = 0;
  item.error = undefined;
  item.timestamp = Date.now();
  await db.put(STORE_NAME, item);
}

/**
 * Check if the app is online (navigator.onLine — quick check).
 * For reliable detection, use `isReliablyOnline()` from networkStatus.
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}
