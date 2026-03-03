/**
 * Offline Photo Blob Store
 *
 * Dedicated IndexedDB database for storing compressed photo blobs when the
 * user submits forms offline. Blobs are linked to offline queue entries by
 * `queueId` and deleted only after successful sync + integrity verification.
 *
 * Separate from the queue database to keep the queue lightweight (metadata
 * only) while photos can be multi-MB blobs.
 *
 * @module offlinePhotoStore
 */

import { openDB, deleteDB, type IDBPDatabase } from 'idb';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'atts-offline-photos';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

/** Average compressed photo size used for storage estimates (~500 KB). */
export const AVG_COMPRESSED_PHOTO_BYTES = 500 * 1024;

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface OfflinePhoto {
  /** Unique identifier for this photo entry. */
  id: string;
  /** Links to the offline queue submission ID. */
  queueId: string;
  /** Form type this photo belongs to. */
  formType: 'dvir' | 'equipment' | 'jsa' | 'near_miss';
  /** Field name identifying the photo slot (e.g. 'oil_dipstick', 'hydraulic', 'tire'). */
  fieldName: string;
  /** The actual compressed photo blob. */
  blob: Blob;
  /** Original file name. */
  fileName: string;
  /** MIME type of the blob. */
  contentType: string;
  /** Whether the blob has been compressed. */
  compressed: boolean;
  /** Timestamp when stored. */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Database access
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('byQueueId', 'queueId', { unique: false });
        }
      },
    }).catch(async (err: unknown) => {
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'VersionError') {
        logger.warn('[offlinePhotoStore] VersionError — deleting and recreating DB');
        try {
          await deleteDB(DB_NAME);
          return await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
              if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('byQueueId', 'queueId', { unique: false });
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a unique photo ID.
 */
function generatePhotoId(): string {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Store a single photo blob.
 *
 * @param photo - Photo data (without `id` and `createdAt` which are auto-set)
 * @returns The generated photo ID.
 */
export async function storePhoto(
  photo: Omit<OfflinePhoto, 'id' | 'createdAt'>,
): Promise<string> {
  const db = await getDB();
  const id = generatePhotoId();
  const entry: OfflinePhoto = {
    ...photo,
    id,
    createdAt: Date.now(),
  };
  await db.put(STORE_NAME, entry);
  logger.info('[offlinePhotoStore] Stored photo', {
    id,
    queueId: photo.queueId,
    fieldName: photo.fieldName,
    sizeKB: Math.round(photo.blob.size / 1024),
  });
  return id;
}

/**
 * Store multiple photos for a single queue entry.
 *
 * @param queueId - The offline queue submission ID.
 * @param formType - Form type.
 * @param photos - Array of { fieldName, blob, fileName, contentType, compressed }.
 * @returns Array of generated photo IDs.
 */
export async function storePhotosForQueue(
  queueId: string,
  formType: OfflinePhoto['formType'],
  photos: Array<{
    fieldName: string;
    blob: Blob;
    fileName: string;
    contentType: string;
    compressed: boolean;
  }>,
): Promise<string[]> {
  const ids: string[] = [];
  for (const photo of photos) {
    const id = await storePhoto({
      queueId,
      formType,
      ...photo,
    });
    ids.push(id);
  }
  return ids;
}

/**
 * Retrieve all photos for a specific queue entry.
 */
export async function getPhotosForQueue(queueId: string): Promise<OfflinePhoto[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE_NAME, 'byQueueId', queueId);
}

/**
 * Retrieve a single photo by ID.
 */
export async function getPhoto(id: string): Promise<OfflinePhoto | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

/**
 * Delete all photos for a specific queue entry (after successful sync).
 */
export async function deletePhotosForQueue(queueId: string): Promise<void> {
  const db = await getDB();
  const photos = await db.getAllFromIndex(STORE_NAME, 'byQueueId', queueId);
  const tx = db.transaction(STORE_NAME, 'readwrite');
  for (const photo of photos) {
    tx.store.delete(photo.id);
  }
  await tx.done;

  if (photos.length > 0) {
    logger.info('[offlinePhotoStore] Deleted photos for queue entry', {
      queueId,
      count: photos.length,
    });
  }
}

/**
 * Delete a single photo by ID.
 */
export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

/**
 * Get total storage usage of all offline photos.
 *
 * @returns Object with `count` and `totalBytes`.
 */
export async function getStorageUsage(): Promise<{ count: number; totalBytes: number }> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  let totalBytes = 0;
  for (const photo of all) {
    totalBytes += (photo as OfflinePhoto).blob.size;
  }
  return { count: all.length, totalBytes };
}

/**
 * Estimate remaining photo capacity based on `navigator.storage.estimate()`.
 *
 * Returns:
 * - `remainingPhotos`: approximate number of photos that can still be stored
 * - `usageBytes` / `quotaBytes`: raw storage API values
 * - `available`: whether the Storage API is available
 *
 * Falls back to a conservative estimate if the Storage API is unavailable.
 */
export async function estimateRemainingCapacity(): Promise<{
  remainingPhotos: number;
  usageBytes: number;
  quotaBytes: number;
  available: boolean;
}> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return { remainingPhotos: 100, usageBytes: 0, quotaBytes: 0, available: false };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const remaining = Math.max(0, quota - usage);
    const remainingPhotos = Math.floor(remaining / AVG_COMPRESSED_PHOTO_BYTES);

    return {
      remainingPhotos,
      usageBytes: usage,
      quotaBytes: quota,
      available: true,
    };
  } catch {
    return { remainingPhotos: 100, usageBytes: 0, quotaBytes: 0, available: false };
  }
}

/**
 * Get all queue IDs that have photos stored.
 * Useful for checking which queue entries have associated blobs.
 */
export async function getQueueIdsWithPhotos(): Promise<Set<string>> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  const ids = new Set<string>();
  for (const photo of all) {
    ids.add((photo as OfflinePhoto).queueId);
  }
  return ids;
}
