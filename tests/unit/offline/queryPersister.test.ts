/**
 * Unit Tests: Query Persister
 *
 * Tests for src/lib/queryPersister.ts — shouldDehydrateQuery filter,
 * createIDBPersister persist/restore round-trip, no-op when not capable.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldDehydrateQuery,
  createIDBPersister,
  PERSISTABLE_KEYS,
  PERSISTER_MAX_AGE_MS,
} from '@/lib/queryPersister';
import { useOfflineCapability } from '@/lib/offlineCapability';

describe('queryPersister', () => {
  // Ensure probe reports capable before each test
  beforeEach(async () => {
    useOfflineCapability.setState({ offlineCapable: true, probeComplete: true });
  });

  // -------------------------------------------------------------------------
  // shouldDehydrateQuery
  // -------------------------------------------------------------------------

  describe('shouldDehydrateQuery', () => {
    it('returns true for persistable keys with success status', () => {
      for (const key of PERSISTABLE_KEYS) {
        expect(
          shouldDehydrateQuery({
            queryKey: [key],
            state: { status: 'success' },
          }),
        ).toBe(true);
      }
    });

    it('returns false for non-persistable keys', () => {
      expect(
        shouldDehydrateQuery({
          queryKey: ['jsa-history'],
          state: { status: 'success' },
        }),
      ).toBe(false);

      expect(
        shouldDehydrateQuery({
          queryKey: ['random-key'],
          state: { status: 'success' },
        }),
      ).toBe(false);
    });

    it('returns false for error status', () => {
      expect(
        shouldDehydrateQuery({
          queryKey: ['announcements'],
          state: { status: 'error' },
        }),
      ).toBe(false);
    });

    it('returns false for loading status', () => {
      expect(
        shouldDehydrateQuery({
          queryKey: ['user-profile'],
          state: { status: 'pending' },
        }),
      ).toBe(false);
    });

    it('returns false for non-string first key', () => {
      expect(
        shouldDehydrateQuery({
          queryKey: [123],
          state: { status: 'success' },
        }),
      ).toBe(false);
    });

    it('handles compound query keys (checks only first element)', () => {
      expect(
        shouldDehydrateQuery({
          queryKey: ['announcements', { page: 1 }],
          state: { status: 'success' },
        }),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // PERSISTABLE_KEYS
  // -------------------------------------------------------------------------

  describe('PERSISTABLE_KEYS', () => {
    it('contains the expected keys', () => {
      expect(PERSISTABLE_KEYS).toContain('announcements');
      expect(PERSISTABLE_KEYS).toContain('assigned-jobs');
      expect(PERSISTABLE_KEYS).toContain('user-profile');
      expect(PERSISTABLE_KEYS).toContain('user-role');
    });
  });

  describe('PERSISTER_MAX_AGE_MS', () => {
    it('is 24 hours', () => {
      expect(PERSISTER_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
    });
  });

  // -------------------------------------------------------------------------
  // createIDBPersister
  // -------------------------------------------------------------------------

  describe('createIDBPersister', () => {
    // The module caches its DB connection, so clear between tests
    let persister: ReturnType<typeof createIDBPersister>;

    beforeEach(async () => {
      persister = createIDBPersister();
      await persister.removeClient();
    });

    it('persist/restore round-trip returns same data', async () => {
      const mockClient = {
        timestamp: Date.now(),
        buster: 'test-buster',
        clientState: {
          queries: [{ queryKey: ['announcements'], state: { data: [1, 2, 3] } }],
          mutations: [],
        },
      };

      await persister.persistClient(mockClient as unknown as Parameters<typeof persister.persistClient>[0]);
      const restored = await persister.restoreClient();

      expect(restored).toEqual(mockClient);
    });

    it('restoreClient returns undefined when nothing persisted', async () => {
      const result = await persister.restoreClient();
      expect(result).toBeUndefined();
    });

    it('removeClient clears persisted data', async () => {
      await persister.persistClient({ timestamp: 1, buster: '', clientState: {} } as unknown as Parameters<typeof persister.persistClient>[0]);
      await persister.removeClient();

      const result = await persister.restoreClient();
      expect(result).toBeUndefined();
    });

    it('restoreClient returns undefined when persisted data exceeds maxAge', async () => {
      const staleClient = {
        timestamp: Date.now() - PERSISTER_MAX_AGE_MS - 1,
        buster: 'test',
        clientState: { queries: [], mutations: [] },
      };
      await persister.persistClient(staleClient as unknown as Parameters<typeof persister.persistClient>[0]);
      const result = await persister.restoreClient();
      expect(result).toBeUndefined();
    });
  });

  describe('createIDBPersister — not capable', () => {
    beforeEach(() => {
      useOfflineCapability.setState({ offlineCapable: false, probeComplete: true });
    });

    it('persistClient is no-op when not capable', async () => {
      const persister = createIDBPersister();
      await persister.persistClient({ timestamp: 1, buster: '', clientState: {} } as unknown as Parameters<typeof persister.persistClient>[0]);

      // Since it's a no-op, restore should return undefined
      // (need to make capable again to verify nothing was stored)
      useOfflineCapability.setState({ offlineCapable: true });
      const result = await persister.restoreClient();
      expect(result).toBeUndefined();
    });

    it('restoreClient returns undefined when not capable', async () => {
      const persister = createIDBPersister();
      const result = await persister.restoreClient();
      expect(result).toBeUndefined();
    });

    it('removeClient is no-op when not capable', async () => {
      const persister = createIDBPersister();
      await expect(persister.removeClient()).resolves.toBeUndefined();
    });
  });
});
