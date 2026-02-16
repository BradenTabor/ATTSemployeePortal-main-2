/**
 * Unit Tests: Offline Photo Blob Store
 *
 * Tests for src/lib/offlinePhotoStore.ts — CRUD, storage usage,
 * capacity estimation, and negative tests for near-full / zero-remaining.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  storePhoto,
  storePhotosForQueue,
  getPhotosForQueue,
  getPhoto,
  deletePhotosForQueue,
  deletePhoto,
  getStorageUsage,
  estimateRemainingCapacity,
  getQueueIdsWithPhotos,
  AVG_COMPRESSED_PHOTO_BYTES,
} from '@/lib/offlinePhotoStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlob(sizeBytes = 1024): Blob {
  return new Blob([new Uint8Array(sizeBytes)], { type: 'image/jpeg' });
}

function makePhotoInput(overrides: Partial<{
  queueId: string;
  formType: 'dvir' | 'equipment' | 'jsa';
  fieldName: string;
  blob: Blob;
  fileName: string;
  contentType: string;
  compressed: boolean;
}> = {}) {
  return {
    queueId: overrides.queueId ?? 'q-1',
    formType: overrides.formType ?? 'dvir' as const,
    fieldName: overrides.fieldName ?? 'oil_dipstick',
    blob: overrides.blob ?? makeBlob(),
    fileName: overrides.fileName ?? 'photo.jpg',
    contentType: overrides.contentType ?? 'image/jpeg',
    compressed: overrides.compressed ?? true,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('offlinePhotoStore', () => {
  // Clear photos between tests (module caches its IDB connection).
  beforeEach(async () => {
    const queueIds = await getQueueIdsWithPhotos();
    for (const qid of queueIds) {
      await deletePhotosForQueue(qid);
    }
  });

  describe('storePhoto / getPhoto', () => {
    it('stores and retrieves a photo with correct fields', async () => {
      const input = makePhotoInput({ fieldName: 'tire_photo' });
      const id = await storePhoto(input);

      expect(id).toBeTruthy();
      expect(id).toMatch(/^photo-/);

      const photo = await getPhoto(id);
      expect(photo).toBeDefined();
      expect(photo!.queueId).toBe('q-1');
      expect(photo!.formType).toBe('dvir');
      expect(photo!.fieldName).toBe('tire_photo');
      expect(photo!.fileName).toBe('photo.jpg');
      expect(photo!.contentType).toBe('image/jpeg');
      expect(photo!.compressed).toBe(true);
      expect(photo!.createdAt).toBeGreaterThan(0);
    });

    it('preserves blob metadata through round-trip', async () => {
      const blob = makeBlob(2048);
      const id = await storePhoto(makePhotoInput({
        blob,
        contentType: 'image/png',
        fieldName: 'test_field',
      }));

      const photo = await getPhoto(id);
      expect(photo).toBeDefined();
      expect(photo!.contentType).toBe('image/png');
      expect(photo!.fieldName).toBe('test_field');
      expect(photo!.queueId).toBe('q-1');
      // Blob should be stored (exact type may vary in jsdom + fake-indexeddb)
      expect(photo!.blob).toBeDefined();
    });

    it('returns undefined for unknown ID', async () => {
      expect(await getPhoto('nonexistent')).toBeUndefined();
    });
  });

  describe('storePhotosForQueue', () => {
    it('stores multiple photos and returns array of IDs', async () => {
      const photos = [
        { fieldName: 'oil', blob: makeBlob(), fileName: 'oil.jpg', contentType: 'image/jpeg', compressed: true },
        { fieldName: 'tire', blob: makeBlob(), fileName: 'tire.jpg', contentType: 'image/jpeg', compressed: true },
      ];

      const ids = await storePhotosForQueue('q-batch', 'dvir', photos);

      expect(ids).toHaveLength(2);
      expect(ids[0]).toMatch(/^photo-/);
      expect(ids[1]).toMatch(/^photo-/);

      // All photos linked to the same queueId
      const stored = await getPhotosForQueue('q-batch');
      expect(stored).toHaveLength(2);
    });

    it('returns empty array for empty input', async () => {
      const ids = await storePhotosForQueue('q-empty', 'jsa', []);
      expect(ids).toEqual([]);
    });
  });

  describe('getPhotosForQueue', () => {
    it('returns only photos for the given queueId', async () => {
      await storePhoto(makePhotoInput({ queueId: 'q-A', fieldName: 'field-A' }));
      await storePhoto(makePhotoInput({ queueId: 'q-B', fieldName: 'field-B' }));
      await storePhoto(makePhotoInput({ queueId: 'q-A', fieldName: 'field-A2' }));

      const photosA = await getPhotosForQueue('q-A');
      expect(photosA).toHaveLength(2);
      expect(photosA.every((p) => p.queueId === 'q-A')).toBe(true);

      const photosB = await getPhotosForQueue('q-B');
      expect(photosB).toHaveLength(1);
    });

    it('returns empty array for unknown queueId', async () => {
      expect(await getPhotosForQueue('nonexistent')).toEqual([]);
    });
  });

  describe('deletePhotosForQueue', () => {
    it('removes all photos for a queueId and leaves others', async () => {
      await storePhoto(makePhotoInput({ queueId: 'q-del', fieldName: 'f1' }));
      await storePhoto(makePhotoInput({ queueId: 'q-del', fieldName: 'f2' }));
      await storePhoto(makePhotoInput({ queueId: 'q-keep', fieldName: 'f3' }));

      await deletePhotosForQueue('q-del');

      expect(await getPhotosForQueue('q-del')).toEqual([]);
      expect(await getPhotosForQueue('q-keep')).toHaveLength(1);
    });

    it('no-ops for queueId with no photos', async () => {
      await expect(deletePhotosForQueue('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('deletePhoto', () => {
    it('removes a single photo by ID', async () => {
      const id = await storePhoto(makePhotoInput());
      expect(await getPhoto(id)).toBeDefined();
      await deletePhoto(id);
      expect(await getPhoto(id)).toBeUndefined();
    });
  });

  describe('getStorageUsage', () => {
    it('returns correct photo count', async () => {
      await storePhoto(makePhotoInput({ blob: makeBlob(500) }));
      await storePhoto(makePhotoInput({ blob: makeBlob(300) }));

      const usage = await getStorageUsage();
      expect(usage.count).toBe(2);
      // Note: blob.size may not survive fake-indexeddb structured clone in
      // jsdom, so totalBytes may be NaN. We test count reliably here.
      // totalBytes accuracy is verified in E2E tests with real IndexedDB.
    });

    it('returns zeros for empty store', async () => {
      const usage = await getStorageUsage();
      expect(usage.count).toBe(0);
      expect(usage.totalBytes).toBe(0);
    });
  });

  describe('estimateRemainingCapacity', () => {
    it('calculates remainingPhotos based on AVG_COMPRESSED_PHOTO_BYTES', async () => {
      const capacity = await estimateRemainingCapacity();

      expect(capacity.available).toBe(true);
      expect(capacity.quotaBytes).toBe(1024 * 1024 * 500); // from mock
      expect(capacity.usageBytes).toBe(0);
      expect(capacity.remainingPhotos).toBe(
        Math.floor((1024 * 1024 * 500) / AVG_COMPRESSED_PHOTO_BYTES),
      );
    });

    it('returns low remainingPhotos when quota is nearly full', async () => {
      const almostFullQuota = 1024 * 1024 * 500; // 500MB
      const almostFullUsage = almostFullQuota - AVG_COMPRESSED_PHOTO_BYTES * 5; // room for ~5 photos

      vi.spyOn(navigator.storage, 'estimate').mockResolvedValueOnce({
        usage: almostFullUsage,
        quota: almostFullQuota,
      });

      const capacity = await estimateRemainingCapacity();
      expect(capacity.remainingPhotos).toBe(5);
      expect(capacity.available).toBe(true);
    });

    it('returns 0 remainingPhotos when quota is full', async () => {
      vi.spyOn(navigator.storage, 'estimate').mockResolvedValueOnce({
        usage: 500 * 1024 * 1024,
        quota: 500 * 1024 * 1024,
      });

      const capacity = await estimateRemainingCapacity();
      expect(capacity.remainingPhotos).toBe(0);
    });

    it('returns fallback when Storage API throws', async () => {
      vi.spyOn(navigator.storage, 'estimate').mockRejectedValueOnce(
        new Error('Storage API error'),
      );

      const capacity = await estimateRemainingCapacity();
      expect(capacity.available).toBe(false);
      expect(capacity.remainingPhotos).toBe(100); // conservative fallback
    });
  });

  describe('getQueueIdsWithPhotos', () => {
    it('returns Set of unique queueIds', async () => {
      await storePhoto(makePhotoInput({ queueId: 'q-1' }));
      await storePhoto(makePhotoInput({ queueId: 'q-1' }));
      await storePhoto(makePhotoInput({ queueId: 'q-2' }));

      const ids = await getQueueIdsWithPhotos();
      expect(ids).toEqual(new Set(['q-1', 'q-2']));
    });

    it('returns empty Set for empty store', async () => {
      const ids = await getQueueIdsWithPhotos();
      expect(ids.size).toBe(0);
    });
  });
});
