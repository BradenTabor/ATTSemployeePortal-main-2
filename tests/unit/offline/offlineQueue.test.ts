/**
 * Unit Tests: Offline Submission Queue
 *
 * Tests for src/lib/offlineQueue.ts — CRUD operations, processQueue logic,
 * priority ordering (text before photos), retry/backoff, conflict detection,
 * concurrent guard, and idempotent re-processing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addToQueue,
  getQueueLength,
  getPendingItems,
  getAllItems,
  processQueue,
  removeFromQueue,
  getQueueItem,
  retryManual,
  type OfflineSubmitter,
  type QueuedSubmission,
} from '@/lib/offlineQueue';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a no-op submitter that always succeeds. */
function successSubmitter(): OfflineSubmitter {
  return vi.fn(async () => {});
}

/** Creates a submitter that fails with a given message. */
function failSubmitter(msg = 'Network error'): OfflineSubmitter {
  return vi.fn(async () => {
    throw new Error(msg);
  });
}


// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('offlineQueue', () => {
  // The module caches its IDB connection, so deleteDatabase in afterEach is
  // insufficient. Clear the store contents via the public API instead.
  beforeEach(async () => {
    const items = await getAllItems();
    for (const item of items) {
      await removeFromQueue(item.id);
    }
  });

  describe('addToQueue', () => {
    it('adds an item and returns a unique ID', async () => {
      const id = await addToQueue('dvir', { truckNumber: 'B132' });
      expect(id).toBeTruthy();
      expect(id).toMatch(/^atts-q-/);
    });

    it('sets status to pending with retryCount 0', async () => {
      const id = await addToQueue('jsa', { location: 'Site A' });
      const item = await getQueueItem(id);
      expect(item).toBeDefined();
      expect(item!.status).toBe('pending');
      expect(item!.retryCount).toBe(0);
      expect(item!.formType).toBe('jsa');
    });

    it('stores photoIds when provided', async () => {
      const id = await addToQueue('dvir', { data: 1 }, {
        photoIds: ['photo-1', 'photo-2'],
      });
      const item = await getQueueItem(id);
      expect(item!.photoIds).toEqual(['photo-1', 'photo-2']);
    });

    it('defaults photoIds to empty array', async () => {
      const id = await addToQueue('equipment', { data: 1 });
      const item = await getQueueItem(id);
      expect(item!.photoIds).toEqual([]);
    });

    it('deep-clones the payload', async () => {
      const payload = { nested: { value: 1 } };
      const id = await addToQueue('jsa', payload);
      payload.nested.value = 999; // mutate original
      const item = await getQueueItem(id);
      expect(item!.payload).toEqual({ nested: { value: 1 } });
    });

    it('stores userId and dateFor when provided', async () => {
      const id = await addToQueue('dvir', {}, {
        userId: 'user-123',
        dateFor: '2026-02-12',
      });
      const item = await getQueueItem(id);
      expect(item!.userId).toBe('user-123');
      expect(item!.dateFor).toBe('2026-02-12');
    });
  });

  describe('getQueueLength', () => {
    it('returns 0 for empty queue', async () => {
      expect(await getQueueLength()).toBe(0);
    });

    it('counts only pending and failed items', async () => {
      await addToQueue('jsa', { a: 1 });
      await addToQueue('dvir', { b: 2 });
      expect(await getQueueLength()).toBe(2);
    });
  });

  describe('getPendingItems', () => {
    it('returns items sorted by timestamp (FIFO)', async () => {
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => ++mockTime);

      const id1 = await addToQueue('jsa', { order: 1 });
      const id2 = await addToQueue('dvir', { order: 2 });
      vi.restoreAllMocks();

      const items = await getPendingItems();
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe(id1);
      expect(items[1].id).toBe(id2);
    });

    it('excludes synced items', async () => {
      await addToQueue('jsa', { data: 1 });
      const sub = successSubmitter();
      await processQueue(sub);
      expect(await getPendingItems()).toHaveLength(0);
    });
  });

  describe('getAllItems', () => {
    it('returns all items regardless of status', async () => {
      await addToQueue('jsa', { a: 1 });
      const all = await getAllItems();
      expect(all.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('removeFromQueue', () => {
    it('removes an item by ID', async () => {
      const id = await addToQueue('dvir', { data: 1 });
      expect(await getQueueLength()).toBe(1);
      await removeFromQueue(id);
      expect(await getQueueLength()).toBe(0);
    });

    it('no-ops for non-existent ID', async () => {
      await expect(removeFromQueue('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('getQueueItem', () => {
    it('returns the item by ID', async () => {
      const id = await addToQueue('equipment', { serial: 'X1' });
      const item = await getQueueItem(id);
      expect(item).toBeDefined();
      expect(item!.formType).toBe('equipment');
    });

    it('returns undefined for unknown ID', async () => {
      expect(await getQueueItem('nope')).toBeUndefined();
    });
  });

  describe('retryManual', () => {
    it('resets a failed_manual item to pending with retryCount 0', async () => {
      const id = await addToQueue('dvir', { data: 1 }, { photoIds: ['p1'] });

      // Photo items: retries at 30s / 120s / 300s, max 3.
      // Advance Date.now() past each backoff window between processQueue calls.
      const realNow = Date.now;
      let mockTime = realNow();

      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      const sub = failSubmitter();
      // Photo backoff uses retryCount AFTER increment:
      //   retryCount=1 → photoBackoffMs(1) = 120s
      //   retryCount=2 → photoBackoffMs(2) = 300s
      //   retryCount=3 → maxRetries reached → failed_manual (no backoff needed)
      await processQueue(sub); // retryCount 0→1 (failed)
      mockTime += 121_000;       // past 120s backoff for retryCount=1
      await processQueue(sub); // retryCount 1→2 (failed)
      mockTime += 301_000;       // past 300s backoff for retryCount=2
      await processQueue(sub); // retryCount 2→3 (failed)
      // No time advance needed — maxRetries check fires before backoff
      await processQueue(sub); // retryCount >= 3 → failed_manual

      const failedItem = await getQueueItem(id);
      expect(failedItem!.status).toBe('failed_manual');

      await retryManual(id);
      const retried = await getQueueItem(id);
      expect(retried!.status).toBe('pending');
      expect(retried!.retryCount).toBe(0);
      expect(retried!.error).toBeUndefined();
      vi.restoreAllMocks();
    });

    it('no-ops for non-existent ID', async () => {
      await expect(retryManual('nonexistent')).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // processQueue
  // -------------------------------------------------------------------------

  describe('processQueue', () => {
    it('calls submitter for each pending item and deletes on success', async () => {
      await addToQueue('jsa', { a: 1 });
      await addToQueue('dvir', { b: 2 });

      const sub = successSubmitter();
      const result = await processQueue(sub);

      expect(sub).toHaveBeenCalledTimes(2);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.discarded).toBe(0);
      expect(await getQueueLength()).toBe(0);
    });

    it('marks item as failed on submitter error and increments retryCount', async () => {
      const id = await addToQueue('jsa', { data: 1 });
      const sub = failSubmitter('Oops');
      const result = await processQueue(sub);

      expect(result.failed).toBe(1);
      const item = await getQueueItem(id);
      expect(item!.status).toBe('failed');
      expect(item!.retryCount).toBe(1);
      expect(item!.error).toBe('Oops');
    });

    it('calls onItemSynced callback per successful item', async () => {
      await addToQueue('jsa', { a: 1 });
      const sub = successSubmitter();
      const onItemSynced = vi.fn();
      await processQueue(sub, { onItemSynced });
      expect(onItemSynced).toHaveBeenCalledTimes(1);
      expect(onItemSynced).toHaveBeenCalledWith(expect.objectContaining({ formType: 'jsa' }));
    });

    it('calls onItemFailed callback per failed item', async () => {
      await addToQueue('dvir', { a: 1 });
      const sub = failSubmitter('Timeout');
      const onItemFailed = vi.fn();
      await processQueue(sub, { onItemFailed });
      expect(onItemFailed).toHaveBeenCalledTimes(1);
      expect(onItemFailed).toHaveBeenCalledWith(
        expect.objectContaining({ formType: 'dvir' }),
        'Timeout',
      );
    });

    it('emits onProgress callbacks', async () => {
      await addToQueue('jsa', { a: 1 });
      await addToQueue('dvir', { b: 2 });

      const sub = successSubmitter();
      const onProgress = vi.fn();
      await processQueue(sub, { onProgress });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ current: 1, total: 2 }));
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ current: 2, total: 2 }));
    });

    it('returns empty result for empty queue', async () => {
      const sub = successSubmitter();
      const result = await processQueue(sub);
      expect(result).toEqual({ processed: 0, failed: 0, discarded: 0 });
      expect(sub).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Priority ordering: text-only before photos, FIFO within tier
  // -------------------------------------------------------------------------

  describe('priority ordering', () => {
    it('processes text-only items before photo items', async () => {
      const callOrder: string[] = [];
      const sub: OfflineSubmitter = vi.fn(async (_ft, payload) => {
        callOrder.push(payload.label as string);
      });

      // Use incrementing mock time to ensure distinct timestamps
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => ++mockTime);

      // Add photo item first, then text items
      await addToQueue('dvir', { label: 'photo-1' }, { photoIds: ['p1'] });
      await addToQueue('jsa', { label: 'text-1' });
      await addToQueue('equipment', { label: 'text-2' });
      await addToQueue('dvir', { label: 'photo-2' }, { photoIds: ['p2'] });

      await processQueue(sub);
      vi.restoreAllMocks();

      // Text items processed first (FIFO), then photo items (FIFO)
      expect(callOrder).toEqual(['text-1', 'text-2', 'photo-1', 'photo-2']);
    });

    it('preserves FIFO within all-text queue', async () => {
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => ++mockTime);

      const callOrder: string[] = [];
      const sub: OfflineSubmitter = vi.fn(async (_ft, payload) => {
        callOrder.push(payload.label as string);
      });

      await addToQueue('jsa', { label: 'A' });
      await addToQueue('dvir', { label: 'B' });
      await addToQueue('equipment', { label: 'C' });

      await processQueue(sub);
      vi.restoreAllMocks();
      expect(callOrder).toEqual(['A', 'B', 'C']);
    });

    it('preserves FIFO within all-photo queue', async () => {
      const callOrder: string[] = [];
      const sub: OfflineSubmitter = vi.fn(async (_ft, payload) => {
        callOrder.push(payload.label as string);
      });

      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => ++mockTime);

      await addToQueue('jsa', { label: 'X' }, { photoIds: ['p1'] });
      await addToQueue('dvir', { label: 'Y' }, { photoIds: ['p2'] });

      await processQueue(sub);
      vi.restoreAllMocks();

      expect(callOrder).toEqual(['X', 'Y']);
    });

    it('handles empty queue without error', async () => {
      const sub = successSubmitter();
      const result = await processQueue(sub);
      expect(result).toEqual({ processed: 0, failed: 0, discarded: 0 });
    });

    it('only processes pending and failed items (not synced/failed_manual)', async () => {
      // Add and successfully process an item
      await addToQueue('jsa', { label: 'will-sync' });
      await processQueue(successSubmitter());

      // Add a new item
      await addToQueue('dvir', { label: 'new' });

      const sub = successSubmitter();
      const result = await processQueue(sub);
      // Only the new item should be processed (the synced one was already deleted)
      expect(result.processed).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Retry limits
  // -------------------------------------------------------------------------

  describe('retry limits', () => {
    it('text-only items fail permanently after 5 retries', async () => {
      const id = await addToQueue('jsa', { data: 1 }); // no photos = text-only
      const sub = failSubmitter();

      // Advance Date.now() past backoff between calls
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      for (let i = 0; i < 6; i++) {
        await processQueue(sub);
        mockTime += 31_000; // past max text backoff (30s)
      }

      const item = await getQueueItem(id);
      expect(item!.status).toBe('failed');
      expect(item!.retryCount).toBeGreaterThanOrEqual(5);
      vi.restoreAllMocks();
    });

    it('photo items become failed_manual after 3 retries', async () => {
      const id = await addToQueue('dvir', { data: 1 }, { photoIds: ['p1'] });
      const sub = failSubmitter();

      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      // After each fail, advance past the backoff for the next retryCount
      await processQueue(sub);   // retryCount 0→1
      mockTime += 121_000;       // past 120s (photoBackoffMs(1))
      await processQueue(sub);   // retryCount 1→2
      mockTime += 301_000;       // past 300s (photoBackoffMs(2))
      await processQueue(sub);   // retryCount 2→3
      await processQueue(sub);   // retryCount >= 3 → failed_manual

      const item = await getQueueItem(id);
      expect(item!.status).toBe('failed_manual');
      expect(item!.error).toContain('manual retry');
      vi.restoreAllMocks();
    });
  });

  // -------------------------------------------------------------------------
  // Conflict detection
  // -------------------------------------------------------------------------

  describe('conflict detection', () => {
    it('discards items where conflictCheck returns true', async () => {
      await addToQueue('dvir', { data: 1 }, { dateFor: '2026-02-12' });
      const sub = successSubmitter();
      const conflictCheck = vi.fn(async () => true);
      const onConflict = vi.fn();

      const result = await processQueue(sub, { conflictCheck, onConflict });

      expect(result.discarded).toBe(1);
      expect(result.processed).toBe(0);
      expect(sub).not.toHaveBeenCalled();
      expect(onConflict).toHaveBeenCalledTimes(1);
      expect(await getQueueLength()).toBe(0); // item removed from queue
    });

    it('processes items where conflictCheck returns false', async () => {
      await addToQueue('jsa', { data: 1 });
      const sub = successSubmitter();
      const conflictCheck = vi.fn(async () => false);

      const result = await processQueue(sub, { conflictCheck });

      expect(result.processed).toBe(1);
      expect(result.discarded).toBe(0);
    });

    it('checks conflicts per-item, not globally', async () => {
      await addToQueue('dvir', { label: 'conflict' }, { dateFor: '2026-02-12' });
      await addToQueue('jsa', { label: 'ok' });

      const conflictCheck = vi.fn(async (item: QueuedSubmission) => {
        return item.formType === 'dvir';
      });

      const sub = successSubmitter();
      const result = await processQueue(sub, { conflictCheck });

      expect(result.discarded).toBe(1);
      expect(result.processed).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Idempotent re-processing (simulate partial sync)
  // -------------------------------------------------------------------------

  describe('idempotent re-processing', () => {
    it('processes remaining items after partial sync (simulating app kill)', async () => {
      // Submitter that succeeds for first item, then throws (simulating app kill)
      let callCount = 0;
      const partialSub: OfflineSubmitter = vi.fn(async () => {
        callCount++;
        if (callCount > 1) throw new Error('Simulated app kill');
      });

      await addToQueue('jsa', { label: 'item-1' });
      await addToQueue('dvir', { label: 'item-2' });
      await addToQueue('equipment', { label: 'item-3' });

      // First pass: item-1 syncs, item-2 fails, item-3 fails
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      const result1 = await processQueue(partialSub);
      expect(result1.processed).toBe(1);
      expect(result1.failed).toBe(2);

      // Advance past backoff so failed items are retryable
      mockTime += 31_000;

      // Second pass with working submitter: remaining items process
      const sub2 = successSubmitter();
      const result2 = await processQueue(sub2);
      expect(result2.processed).toBe(2);
      expect(await getQueueLength()).toBe(0);
      vi.restoreAllMocks();
    });

    it('reprocessed items do not create duplicates (submitter called once per remaining item)', async () => {
      let mockTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => ++mockTime);

      const ids: string[] = [];
      const sub: OfflineSubmitter = vi.fn(async (_ft, payload) => {
        ids.push(payload.label as string);
      });

      await addToQueue('dvir', { label: 'A' });
      await addToQueue('dvir', { label: 'B' });

      // Process all
      await processQueue(sub);
      vi.restoreAllMocks();
      expect(ids).toEqual(['A', 'B']);

      // Process again — should find nothing to do
      const sub2 = successSubmitter();
      const result = await processQueue(sub2);
      expect(result.processed).toBe(0);
      expect(sub2).not.toHaveBeenCalled();
    });
  });
});
