/**
 * Enhanced Network Status Detection
 *
 * Replaces bare `navigator.onLine` with a two-layer approach:
 * 1. `navigator.onLine` + online/offline events for instant detection
 * 2. Periodic heartbeat ping for silent disconnection (captive portal, DNS
 *    failure while navigator.onLine still reports true)
 *
 * Intervals:
 *   - Online:  60 s
 *   - Offline: 15 s initial, exponential backoff → 30 s → 60 s → 120 s cap
 *   - Backgrounded (document.visibilityState === 'hidden'): pings paused
 *
 * Exposes a Zustand store consumed by the rest of the offline system.
 *
 * @module networkStatus
 */

import { create } from 'zustand';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ONLINE_PING_INTERVAL_MS = 60_000;     // 60 s when online
const OFFLINE_BASE_INTERVAL_MS = 15_000;     // 15 s when offline (initial)
const OFFLINE_MAX_INTERVAL_MS = 120_000;     // 120 s cap
const OFFLINE_BACKOFF_FACTOR = 2;

/**
 * We ping the Supabase REST endpoint with a lightweight HEAD request.
 * Using the project URL root is fine — it returns 200 and is tiny.
 */
function getHealthUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (url) return `${url}/rest/v1/`;
  // Fallback: just hit a known public endpoint
  return 'https://www.google.com/generate_204';
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

interface NetworkState {
  /** Quick check: navigator.onLine */
  isOnline: boolean;
  /** Reliable check: last heartbeat succeeded AND navigator.onLine */
  isReliablyOnline: boolean;
  /** Timestamp of last confirmed online moment */
  lastOnlineAt: number | null;
  /** Timestamp of last successful queue sync (set externally) */
  lastSyncAt: number | null;
  /** Number of consecutive failed heartbeat pings */
  failedPings: number;

  // Actions (called internally by the monitor, or externally)
  /** Record a successful sync (called by OfflineQueueContext after processQueue) */
  recordSync: () => void;
}

export const useNetworkStore = create<NetworkState>()((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isReliablyOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastOnlineAt: typeof navigator !== 'undefined' && navigator.onLine ? Date.now() : null,
  lastSyncAt: null,
  failedPings: 0,

  recordSync: () => set({ lastSyncAt: Date.now() }),
}));

// ---------------------------------------------------------------------------
// Heartbeat ping
// ---------------------------------------------------------------------------

let pingTimer: ReturnType<typeof setTimeout> | null = null;
let currentOfflineInterval = OFFLINE_BASE_INTERVAL_MS;
let monitorStarted = false;

/** Stored so stopNetworkMonitor() can remove listeners (avoids memory leak). */
let handleOnlineRef: (() => void) | null = null;
let handleOfflineRef: (() => void) | null = null;
let handleVisibilityChangeRef: (() => void) | null = null;

async function heartbeat(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000); // 5 s timeout
    const res = await fetch(getHealthUrl(), {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    // In no-cors mode, an opaque response (type === 'opaque') still means
    // the network request succeeded — the server responded.
    return res.ok || res.type === 'opaque';
  } catch {
    return false;
  }
}

function scheduleNextPing() {
  if (pingTimer) clearTimeout(pingTimer);

  // Don't ping when the tab is hidden
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return;
  }

  const state = useNetworkStore.getState();
  let delay: number;

  if (state.isOnline) {
    delay = ONLINE_PING_INTERVAL_MS;
    // Reset offline backoff when online
    currentOfflineInterval = OFFLINE_BASE_INTERVAL_MS;
  } else {
    delay = currentOfflineInterval;
    // Exponential backoff for offline pings
    currentOfflineInterval = Math.min(
      currentOfflineInterval * OFFLINE_BACKOFF_FACTOR,
      OFFLINE_MAX_INTERVAL_MS,
    );
  }

  pingTimer = setTimeout(async () => {
    const ok = await heartbeat();
    const navOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const reliablyOnline = ok && navOnline;

    useNetworkStore.setState((prev) => ({
      isReliablyOnline: reliablyOnline,
      failedPings: ok ? 0 : prev.failedPings + 1,
      lastOnlineAt: reliablyOnline ? Date.now() : prev.lastOnlineAt,
    }));

    if (!ok && navOnline) {
      logger.warn('[networkStatus] Heartbeat failed but navigator.onLine=true (possible captive portal)');
    }

    scheduleNextPing();
  }, delay);
}

// ---------------------------------------------------------------------------
// Public: start / stop monitor
// ---------------------------------------------------------------------------

/**
 * Start the network monitor. Idempotent — safe to call multiple times.
 * Sets up online/offline event listeners, visibility change handler, and
 * periodic heartbeat.
 */
export function startNetworkMonitor(): void {
  if (monitorStarted) return;
  monitorStarted = true;

  if (typeof window === 'undefined') return;

  if (!handleOnlineRef) {
    handleOnlineRef = () => {
      currentOfflineInterval = OFFLINE_BASE_INTERVAL_MS;
      useNetworkStore.setState({
        isOnline: true,
        isReliablyOnline: true, // optimistic — next heartbeat confirms
        lastOnlineAt: Date.now(),
        failedPings: 0,
      });
      logger.info('[networkStatus] Browser online event');
      scheduleNextPing();
    };
    handleOfflineRef = () => {
      useNetworkStore.setState({
        isOnline: false,
        isReliablyOnline: false,
      });
      logger.info('[networkStatus] Browser offline event');
      scheduleNextPing();
    };
    handleVisibilityChangeRef = () => {
      if (document.visibilityState === 'visible') {
        scheduleNextPing();
      } else {
        if (pingTimer) {
          clearTimeout(pingTimer);
          pingTimer = null;
        }
      }
    };
  }

  window.addEventListener('online', handleOnlineRef);
  window.addEventListener('offline', handleOfflineRef!);
  document.addEventListener('visibilitychange', handleVisibilityChangeRef!);

  scheduleNextPing();
}

/**
 * Stop the network monitor (for testing/cleanup).
 * Removes event listeners to avoid memory leaks when remounting or in tests.
 */
export function stopNetworkMonitor(): void {
  if (pingTimer) {
    clearTimeout(pingTimer);
    pingTimer = null;
  }
  const hOn = handleOnlineRef;
  const hOff = handleOfflineRef;
  const hVis = handleVisibilityChangeRef;
  if (typeof window !== 'undefined' && hOn && hOff && hVis) {
    window.removeEventListener('online', hOn);
    window.removeEventListener('offline', hOff!);
    document.removeEventListener('visibilitychange', hVis!);
  }
  monitorStarted = false;
}

// ---------------------------------------------------------------------------
// Convenience accessors (non-reactive, for use outside React)
// ---------------------------------------------------------------------------

/** Check if the app is online (quick check, same as navigator.onLine). */
export function isOnline(): boolean {
  return useNetworkStore.getState().isOnline;
}

/** Check if the app is reliably online (heartbeat-confirmed). */
export function isReliablyOnline(): boolean {
  return useNetworkStore.getState().isReliablyOnline;
}
