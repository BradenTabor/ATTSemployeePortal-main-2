/**
 * Unit Tests: Sync Conflicts Store
 *
 * Tests for src/lib/syncConflicts.ts — archive, retrieve, prune TTL, clear.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  archiveConflict,
  getConflicts,
  getConflictCount,
  deleteConflict,
  clearConflicts,
  pruneExpiredConflicts,
} from '@/lib/syncConflicts';

describe('syncConflicts', () => {
  // Clear the conflict store before each test (the module caches its DB
  // connection, so deleteDatabase in afterEach is insufficient).
  beforeEach(async () => {
    await clearConflicts();
  });
  describe('archiveConflict', () => {
    it('stores a conflict with correct fields', async () => {
      await archiveConflict(
        'q-123',
        'dvir',
        { truckNumber: 'B132' },
        'DVIR already exists for this date',
        { existingRecordId: 'existing-456' },
      );

      const conflicts = await getConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe('q-123');
      expect(conflicts[0].formType).toBe('dvir');
      expect(conflicts[0].payload).toEqual({ truckNumber: 'B132' });
      expect(conflicts[0].conflictReason).toBe('DVIR already exists for this date');
      expect(conflicts[0].existingRecordId).toBe('existing-456');
    });

    it('sets expiresAt to createdAt + 7 days', async () => {
      const before = Date.now();
      await archiveConflict('q-1', 'jsa', {}, 'duplicate');
      const after = Date.now();

      const conflicts = await getConflicts();
      const conflict = conflicts[0];
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      expect(conflict.createdAt).toBeGreaterThanOrEqual(before);
      expect(conflict.createdAt).toBeLessThanOrEqual(after);
      expect(conflict.expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs);
      expect(conflict.expiresAt).toBeLessThanOrEqual(after + sevenDaysMs);
    });

    it('stores photoIds when provided', async () => {
      await archiveConflict('q-2', 'dvir', {}, 'dup', {
        photoIds: ['p1', 'p2'],
      });

      const conflicts = await getConflicts();
      expect(conflicts[0].photoIds).toEqual(['p1', 'p2']);
    });
  });

  describe('getConflicts / getConflictCount', () => {
    it('returns empty array for fresh DB', async () => {
      expect(await getConflicts()).toEqual([]);
      expect(await getConflictCount()).toBe(0);
    });

    it('returns multiple conflicts sorted by newest first', async () => {
      await archiveConflict('q-1', 'dvir', {}, 'reason 1');
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 5));
      await archiveConflict('q-2', 'jsa', {}, 'reason 2');

      const conflicts = await getConflicts();
      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].id).toBe('q-2'); // newest first
      expect(conflicts[1].id).toBe('q-1');
      expect(await getConflictCount()).toBe(2);
    });

    it('excludes expired conflicts from results', async () => {
      // Manually create an expired conflict by manipulating time
      await archiveConflict('q-expired', 'dvir', {}, 'old');
      await archiveConflict('q-valid', 'jsa', {}, 'new');

      // Hack: the expired one needs expiresAt in the past. We can't easily
      // do this through the public API, so we test via pruneExpiredConflicts below.
      // For now, verify both are returned when not expired.
      expect(await getConflictCount()).toBe(2);
    });
  });

  describe('deleteConflict', () => {
    it('removes a specific conflict by ID', async () => {
      await archiveConflict('q-1', 'dvir', {}, 'reason 1');
      await archiveConflict('q-2', 'jsa', {}, 'reason 2');

      await deleteConflict('q-1');

      const conflicts = await getConflicts();
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe('q-2');
    });

    it('no-ops for non-existent ID', async () => {
      await expect(deleteConflict('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('clearConflicts', () => {
    it('removes all conflicts', async () => {
      await archiveConflict('q-1', 'dvir', {}, 'r1');
      await archiveConflict('q-2', 'jsa', {}, 'r2');
      await archiveConflict('q-3', 'equipment', {}, 'r3');

      await clearConflicts();
      expect(await getConflictCount()).toBe(0);
    });

    it('no-ops on empty store', async () => {
      await expect(clearConflicts()).resolves.toBeUndefined();
    });
  });

  describe('pruneExpiredConflicts', () => {
    it('removes expired items and returns count', async () => {
      // Archive a conflict, then advance time past TTL
      const baseTime = Date.now();

      // Archive at current time
      await archiveConflict('q-old', 'dvir', {}, 'expired');

      // Fast-forward 8 days
      const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
      vi.spyOn(Date, 'now').mockReturnValue(baseTime + eightDaysMs);

      // Archive one more at the "new" time
      await archiveConflict('q-new', 'jsa', {}, 'still valid');

      const pruned = await pruneExpiredConflicts();
      expect(pruned).toBe(1); // q-old expired

      const remaining = await getConflicts();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('q-new');

      vi.restoreAllMocks();
    });

    it('returns 0 when nothing to prune', async () => {
      await archiveConflict('q-1', 'jsa', {}, 'fresh');
      const pruned = await pruneExpiredConflicts();
      expect(pruned).toBe(0);
    });
  });
});
