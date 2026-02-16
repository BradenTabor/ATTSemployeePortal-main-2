/**
 * Offline System Initialization
 *
 * Runs the IndexedDB availability probe, starts the network monitor,
 * and prunes expired sync conflicts.
 *
 * Imported as a side-effect module in main.tsx (same pattern as perf-init).
 * Must run before any component that depends on offline features mounts.
 */

import { useOfflineCapability } from '../lib/offlineCapability';
import { startNetworkMonitor } from '../lib/networkStatus';
import { pruneExpiredConflicts } from '../lib/syncConflicts';

// Run the IndexedDB probe (async, non-blocking)
useOfflineCapability.getState().runProbe();

// Start the network heartbeat monitor
startNetworkMonitor();

// Prune expired sync conflicts (best-effort, non-blocking)
pruneExpiredConflicts().catch(() => {
  // Ignore errors — IDB may not be available
});
