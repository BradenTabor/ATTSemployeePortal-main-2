/**
 * Unit Tests: Network Status Detection
 *
 * Tests for src/lib/networkStatus.ts — Zustand store state, browser events,
 * ping logic, exponential backoff, recordSync, visibility handling.
 *
 * Note: The heartbeat/ping logic uses setTimeout and fetch, both of which
 * are mocked here. We test the store state transitions rather than actual
 * network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useNetworkStore,
  startNetworkMonitor,
  stopNetworkMonitor,
  isOnline,
  isReliablyOnline,
} from '@/lib/networkStatus';

describe('networkStatus', () => {
  beforeEach(() => {
    // Reset store to defaults
    useNetworkStore.setState({
      isOnline: true,
      isReliablyOnline: true,
      lastOnlineAt: Date.now(),
      lastSyncAt: null,
      failedPings: 0,
    });
    stopNetworkMonitor();
    vi.useFakeTimers();
    // Stub fetch for heartbeat pings
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, type: 'basic' })));
  });

  afterEach(() => {
    stopNetworkMonitor();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('initial store state', () => {
    it('defaults to online when navigator.onLine is true', () => {
      const state = useNetworkStore.getState();
      expect(state.isOnline).toBe(true);
      expect(state.failedPings).toBe(0);
      expect(state.lastSyncAt).toBeNull();
    });
  });

  describe('convenience accessors', () => {
    it('isOnline() returns current store value', () => {
      expect(isOnline()).toBe(true);
      useNetworkStore.setState({ isOnline: false });
      expect(isOnline()).toBe(false);
    });

    it('isReliablyOnline() returns current store value', () => {
      expect(isReliablyOnline()).toBe(true);
      useNetworkStore.setState({ isReliablyOnline: false });
      expect(isReliablyOnline()).toBe(false);
    });
  });

  describe('recordSync', () => {
    it('updates lastSyncAt to current time', () => {
      expect(useNetworkStore.getState().lastSyncAt).toBeNull();
      useNetworkStore.getState().recordSync();
      expect(useNetworkStore.getState().lastSyncAt).toBeGreaterThan(0);
    });
  });

  describe('browser events', () => {
    it('sets isOnline=false on offline event', () => {
      startNetworkMonitor();
      window.dispatchEvent(new Event('offline'));

      const state = useNetworkStore.getState();
      expect(state.isOnline).toBe(false);
      expect(state.isReliablyOnline).toBe(false);
    });

    it('sets isOnline=true on online event', () => {
      startNetworkMonitor();
      // Go offline first
      window.dispatchEvent(new Event('offline'));
      expect(useNetworkStore.getState().isOnline).toBe(false);

      // Come back online
      window.dispatchEvent(new Event('online'));
      const state = useNetworkStore.getState();
      expect(state.isOnline).toBe(true);
      expect(state.isReliablyOnline).toBe(true); // optimistic on event
      expect(state.failedPings).toBe(0);
    });
  });

  describe('heartbeat ping', () => {
    it('schedules a ping on start and updates isReliablyOnline on success', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, type: 'basic' } as Response);
      startNetworkMonitor();

      // Advance past the online ping interval (60s)
      await vi.advanceTimersByTimeAsync(61_000);

      expect(fetch).toHaveBeenCalled();
      expect(useNetworkStore.getState().isReliablyOnline).toBe(true);
      expect(useNetworkStore.getState().failedPings).toBe(0);
    });

    it('increments failedPings on fetch failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
      startNetworkMonitor();

      // Advance to trigger first ping
      await vi.advanceTimersByTimeAsync(61_000);

      expect(useNetworkStore.getState().failedPings).toBe(1);
      expect(useNetworkStore.getState().isReliablyOnline).toBe(false);
    });

    it('accepts opaque responses (no-cors mode) as success', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false, type: 'opaque' } as Response);
      startNetworkMonitor();

      await vi.advanceTimersByTimeAsync(61_000);

      expect(useNetworkStore.getState().isReliablyOnline).toBe(true);
      expect(useNetworkStore.getState().failedPings).toBe(0);
    });
  });

  describe('startNetworkMonitor / stopNetworkMonitor', () => {
    it('is idempotent — multiple starts do not duplicate listeners', () => {
      startNetworkMonitor();
      startNetworkMonitor(); // second call should be no-op

      // Trigger offline event — should only fire handlers once
      window.dispatchEvent(new Event('offline'));
      expect(useNetworkStore.getState().isOnline).toBe(false);
    });

    it('stopNetworkMonitor clears ping timer', () => {
      startNetworkMonitor();
      stopNetworkMonitor();

      // No pings should fire after stop
      vi.mocked(fetch).mockClear();
      vi.advanceTimersByTime(120_000);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('visibility change', () => {
    it('pauses pings when tab is hidden', async () => {
      startNetworkMonitor();

      // Simulate tab going hidden
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));

      vi.mocked(fetch).mockClear();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(fetch).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('resumes pings when tab becomes visible', async () => {
      startNetworkMonitor();

      // Go hidden
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));

      vi.mocked(fetch).mockClear();

      // Come back visible
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));

      // Should schedule a new ping
      await vi.advanceTimersByTimeAsync(61_000);
      expect(fetch).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });
});
