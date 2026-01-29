/**
 * Offline Submission Queue
 *
 * Stores form submissions when the app is offline and syncs when connectivity
 * returns. Uses IndexedDB for persistence. Supports conflict resolution
 * (e.g. discard queued if user already submitted online) and exponential
 * backoff for retries.
 *
 * @module offlineQueue
 */

import { logger } from './logger';

const DB_NAME = 'atts-offline-queue';
const DB_VERSION = 1;
const STORE_NAME = 'submissions';

export type FormType = 'jsa' | 'dvir' | 'equipment';

export type QueuedSubmissionStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface QueuedSubmission {
  id: string;
  formType: FormType;
  payload: Record<string, unknown>;
  /** Optional: keyed by field name; stored as Blob in IndexedDB for DVIR photos */
  fileKeys?: string[];
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
  files?: Record<string, Blob>
) => Promise<void>;

const DEFAULT_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const MAX_RETRIES = 5;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

function getAllPending(db: IDBDatabase): Promise<QueuedSubmission[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const items = (req.result as QueuedSubmission[]).filter(
        (i) => i.status === 'pending' || i.status === 'failed'
      );
      resolve(items);
    };
  });
}

function put(db: IDBDatabase, item: QueuedSubmission): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

/**
 * Backoff delay in ms: exponential with jitter, capped.
 */
function backoffMs(retryCount: number): number {
  const exp = Math.min(DEFAULT_BACKOFF_MS * Math.pow(2, retryCount), MAX_BACKOFF_MS);
  const jitter = Math.random() * 0.3 * exp;
  return Math.floor(exp + jitter);
}

/**
 * Add a submission to the queue. Call when offline or when submit fails due to network.
 */
export async function addToQueue(
  formType: FormType,
  payload: Record<string, unknown>,
  options?: { userId?: string; dateFor?: string; files?: Record<string, Blob> }
): Promise<string> {
  const id = `atts-q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const item: QueuedSubmission = {
    id,
    formType,
    payload: JSON.parse(JSON.stringify(payload)),
    userId: options?.userId,
    dateFor: options?.dateFor,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  };
  if (options?.files && Object.keys(options.files).length > 0) {
    item.fileKeys = Object.keys(options.files);
    logger.warn('[offlineQueue] Files not yet persisted in queue; DVIR with photos will need to be submitted when online.');
  }
  const db = await openDB();
  await put(db, item);
  db.close();
  return id;
}

/**
 * Get count of pending (and failed) items in the queue.
 */
export async function getQueueLength(): Promise<number> {
  const db = await openDB();
  const items = await getAllPending(db);
  db.close();
  return items.length;
}

/**
 * Get all pending items (for UI display).
 */
export async function getPendingItems(): Promise<QueuedSubmission[]> {
  const db = await openDB();
  const items = await getAllPending(db);
  db.close();
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Process the queue: for each pending item, call the registered submitter.
 * Uses exponential backoff on failure. Removes item on success.
 * Conflict resolution: caller can pass a conflict checker; if it returns true, item is discarded.
 */
export async function processQueue(
  submitter: OfflineSubmitter,
  options?: {
    conflictCheck?: (item: QueuedSubmission) => Promise<boolean>;
  }
): Promise<{ processed: number; failed: number; discarded: number }> {
  const db = await openDB();
  const items = await getAllPending(db);
  let processed = 0;
  let failed = 0;
  let discarded = 0;

  for (const item of items) {
    if (item.retryCount >= MAX_RETRIES) {
      item.status = 'failed';
      item.error = 'Max retries exceeded';
      await put(db, item);
      failed++;
      continue;
    }

    const backoff = backoffMs(item.retryCount);
    if (item.status === 'failed' && item.timestamp + backoff > Date.now()) {
      continue;
    }

    if (options?.conflictCheck && (await options.conflictCheck(item))) {
      await deleteById(db, item.id);
      discarded++;
      continue;
    }

    item.status = 'syncing';
    item.timestamp = Date.now();
    await put(db, item);

    try {
      const files: Record<string, Blob> | undefined = undefined;
      await submitter(item.formType, item.payload, files);
      await deleteById(db, item.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[offlineQueue] Submit failed', { id: item.id, formType: item.formType, error: message });
      item.status = 'failed';
      item.retryCount += 1;
      item.error = message;
      await put(db, item);
      failed++;
    }
  }

  db.close();
  return { processed, failed, discarded };
}

/**
 * Remove a single item from the queue (e.g. user chose "discard").
 */
export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  await deleteById(db, id);
  db.close();
}

/**
 * Check if the app is online (navigator.onLine; can be unreliable but simple).
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}
