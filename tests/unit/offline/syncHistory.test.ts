/**
 * Unit Tests: Sync History Store
 *
 * Tests for src/lib/syncHistory.ts — addSyncedItem, addCycleSummary,
 * acknowledge, prune, max items, getFormLabel.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSyncHistory,
  getUnacknowledgedItems,
  getUnacknowledgedSummary,
  getFormLabel,
} from '@/lib/syncHistory';

describe('syncHistory', () => {
  beforeEach(() => {
    useSyncHistory.getState().clear();
  });

  describe('addSyncedItem', () => {
    it('adds an item with syncedAt and acknowledged=false', () => {
      useSyncHistory.getState().addSyncedItem({
        id: 'q-1',
        formType: 'dvir',
        hadPhotos: true,
        photoCount: 2,
        dateFor: '2026-02-12',
      });

      const state = useSyncHistory.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('q-1');
      expect(state.items[0].acknowledged).toBe(false);
      expect(state.items[0].syncedAt).toBeGreaterThan(0);
    });

    it('adds newest item to front', () => {
      useSyncHistory.getState().addSyncedItem({
        id: 'q-1', formType: 'jsa', hadPhotos: false, photoCount: 0,
      });
      useSyncHistory.getState().addSyncedItem({
        id: 'q-2', formType: 'dvir', hadPhotos: true, photoCount: 1,
      });

      const items = useSyncHistory.getState().items;
      expect(items[0].id).toBe('q-2');
      expect(items[1].id).toBe('q-1');
    });

    it('trims to max 50 items', () => {
      for (let i = 0; i < 55; i++) {
        useSyncHistory.getState().addSyncedItem({
          id: `q-${i}`, formType: 'jsa', hadPhotos: false, photoCount: 0,
        });
      }

      expect(useSyncHistory.getState().items).toHaveLength(50);
    });

    it('updates unacknowledgedCount', () => {
      useSyncHistory.getState().addSyncedItem({
        id: 'q-1', formType: 'jsa', hadPhotos: false, photoCount: 0,
      });
      useSyncHistory.getState().addSyncedItem({
        id: 'q-2', formType: 'dvir', hadPhotos: false, photoCount: 0,
      });

      expect(useSyncHistory.getState().unacknowledgedCount).toBe(2);
    });
  });

  describe('addCycleSummary', () => {
    it('stores a cycle summary', () => {
      useSyncHistory.getState().addCycleSummary({
        processed: 3, failed: 1, discarded: 0,
      });

      const summary = useSyncHistory.getState().lastCycleSummary;
      expect(summary).toBeDefined();
      expect(summary!.processed).toBe(3);
      expect(summary!.failed).toBe(1);
      expect(summary!.acknowledged).toBe(false);
      expect(summary!.completedAt).toBeGreaterThan(0);
    });

    it('does not store empty cycle (0 processed, 0 failed, 0 discarded)', () => {
      useSyncHistory.getState().addCycleSummary({
        processed: 0, failed: 0, discarded: 0,
      });

      expect(useSyncHistory.getState().lastCycleSummary).toBeNull();
    });

    it('replaces previous summary', () => {
      useSyncHistory.getState().addCycleSummary({ processed: 1, failed: 0, discarded: 0 });
      useSyncHistory.getState().addCycleSummary({ processed: 5, failed: 2, discarded: 1 });

      expect(useSyncHistory.getState().lastCycleSummary!.processed).toBe(5);
    });
  });

  describe('acknowledgeAll', () => {
    it('marks all items as acknowledged', () => {
      useSyncHistory.getState().addSyncedItem({
        id: 'q-1', formType: 'jsa', hadPhotos: false, photoCount: 0,
      });
      useSyncHistory.getState().addSyncedItem({
        id: 'q-2', formType: 'dvir', hadPhotos: false, photoCount: 0,
      });

      useSyncHistory.getState().acknowledgeAll();

      const state = useSyncHistory.getState();
      expect(state.items.every((i) => i.acknowledged)).toBe(true);
      expect(state.unacknowledgedCount).toBe(0);
    });
  });

  describe('acknowledgeSummary', () => {
    it('marks the cycle summary as acknowledged', () => {
      useSyncHistory.getState().addCycleSummary({ processed: 2, failed: 0, discarded: 0 });
      useSyncHistory.getState().acknowledgeSummary();

      expect(useSyncHistory.getState().lastCycleSummary!.acknowledged).toBe(true);
    });

    it('handles null summary gracefully', () => {
      useSyncHistory.getState().acknowledgeSummary();
      expect(useSyncHistory.getState().lastCycleSummary).toBeNull();
    });
  });

  describe('pruneExpired', () => {
    it('removes items older than 1 hour', () => {
      const oneHourPlusMs = 61 * 60 * 1000;

      // Add item with past syncedAt
      useSyncHistory.setState({
        items: [
          {
            id: 'old',
            formType: 'jsa',
            hadPhotos: false,
            photoCount: 0,
            syncedAt: Date.now() - oneHourPlusMs,
            acknowledged: false,
          },
          {
            id: 'fresh',
            formType: 'dvir',
            hadPhotos: false,
            photoCount: 0,
            syncedAt: Date.now(),
            acknowledged: false,
          },
        ],
        unacknowledgedCount: 2,
      });

      useSyncHistory.getState().pruneExpired();

      const state = useSyncHistory.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('fresh');
      expect(state.unacknowledgedCount).toBe(1);
    });
  });

  describe('getUnacknowledgedItems', () => {
    it('returns only unacknowledged items', () => {
      useSyncHistory.getState().addSyncedItem({
        id: 'q-1', formType: 'jsa', hadPhotos: false, photoCount: 0,
      });
      useSyncHistory.getState().addSyncedItem({
        id: 'q-2', formType: 'dvir', hadPhotos: false, photoCount: 0,
      });
      useSyncHistory.getState().acknowledgeAll();
      useSyncHistory.getState().addSyncedItem({
        id: 'q-3', formType: 'equipment', hadPhotos: false, photoCount: 0,
      });

      const items = getUnacknowledgedItems();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('q-3');
    });
  });

  describe('getUnacknowledgedSummary', () => {
    it('returns null when no summary', () => {
      expect(getUnacknowledgedSummary()).toBeNull();
    });

    it('returns null when summary is acknowledged', () => {
      useSyncHistory.getState().addCycleSummary({ processed: 1, failed: 0, discarded: 0 });
      useSyncHistory.getState().acknowledgeSummary();
      expect(getUnacknowledgedSummary()).toBeNull();
    });

    it('returns summary when unacknowledged', () => {
      useSyncHistory.getState().addCycleSummary({ processed: 3, failed: 0, discarded: 0 });
      const summary = getUnacknowledgedSummary();
      expect(summary).toBeDefined();
      expect(summary!.processed).toBe(3);
    });
  });

  describe('getFormLabel', () => {
    it('maps jsa to JSA', () => {
      expect(getFormLabel('jsa')).toBe('JSA');
    });

    it('maps dvir to DVIR', () => {
      expect(getFormLabel('dvir')).toBe('DVIR');
    });

    it('maps equipment to Equipment Inspection', () => {
      expect(getFormLabel('equipment')).toBe('Equipment Inspection');
    });
  });

  describe('clear', () => {
    it('resets all state', () => {
      useSyncHistory.getState().addSyncedItem({
        id: 'q-1', formType: 'jsa', hadPhotos: false, photoCount: 0,
      });
      useSyncHistory.getState().addCycleSummary({ processed: 1, failed: 0, discarded: 0 });

      useSyncHistory.getState().clear();

      const state = useSyncHistory.getState();
      expect(state.items).toEqual([]);
      expect(state.lastCycleSummary).toBeNull();
      expect(state.unacknowledgedCount).toBe(0);
    });
  });
});
