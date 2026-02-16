/**
 * Hook: Offline submission queue (v2)
 *
 * Exposes online status, queue length, pending items, add/process/remove,
 * and syncs when the app comes back online.
 *
 * v2: photoIds instead of file blobs, progress callbacks, retryManual.
 * v2.1: sync history tracking + per-item/summary confirmations.
 *
 * @module useOfflineQueue
 */

import { useCallback, useEffect, useState } from 'react';
import { toast as sonnerToast } from 'sonner';
import {
  addToQueue as addToQueueLib,
  getPendingItems,
  getQueueLength,
  processQueue,
  removeFromQueue,
  retryManual as retryManualLib,
  type FormType,
  type OfflineSubmitter,
  type QueuedSubmission,
  type SyncProgress,
} from '../lib/offlineQueue';
import { useNetworkStore } from '../lib/networkStatus';
import { useSyncHistory, getFormLabel } from '../lib/syncHistory';
import { logger } from '../lib/logger';

export interface UseOfflineQueueOptions {
  /** Submitter to use when processing the queue (e.g. from app/context). */
  submitter: OfflineSubmitter | null;
  /** Optional conflict check: if returns true, queued item is discarded. */
  conflictCheck?: (item: QueuedSubmission) => Promise<boolean>;
  /** Called when a conflict is detected and item is discarded. */
  onConflict?: (item: QueuedSubmission) => void;
  /** Run processQueue automatically when coming back online. */
  processOnOnline?: boolean;
}

export interface UseOfflineQueueReturn {
  isOnline: boolean;
  queueLength: number;
  pendingItems: QueuedSubmission[];
  syncProgress: SyncProgress | null;
  addToQueue: (
    formType: FormType,
    payload: Record<string, unknown>,
    options?: { userId?: string; dateFor?: string; photoIds?: string[] }
  ) => Promise<string>;
  processQueueNow: () => Promise<{ processed: number; failed: number; discarded: number }>;
  removeFromQueue: (id: string) => Promise<void>;
  retryManual: (id: string) => Promise<void>;
  refreshPending: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Sync history + toast helpers
// ---------------------------------------------------------------------------

function hasPhotos(item: QueuedSubmission): boolean {
  return item.photoIds.length > 0;
}

/** Record a single item sync in the history store. */
function recordItemSynced(item: QueuedSubmission): void {
  useSyncHistory.getState().addSyncedItem({
    id: item.id,
    formType: item.formType,
    hadPhotos: hasPhotos(item),
    photoCount: item.photoIds.length,
    dateFor: item.dateFor,
  });
}

/** Show a per-item success toast (non-blocking corner toast). */
function showItemSyncedToast(item: QueuedSubmission): void {
  const label = getFormLabel(item.formType);
  const photoNote = hasPhotos(item)
    ? ` with ${item.photoIds.length} photo${item.photoIds.length !== 1 ? 's' : ''}`
    : '';

  sonnerToast.success(`${label} synced successfully`, {
    description: `Your offline ${label.toLowerCase()}${photoNote} has been submitted.`,
    duration: 4000,
  });
}

/** Show a sync cycle summary toast. */
function showCycleSummaryToast(
  processed: number,
  failed: number,
  discarded: number,
): void {
  if (processed === 0 && failed === 0) return;

  if (failed === 0 && discarded === 0) {
    // All succeeded
    sonnerToast.success(
      `All ${processed} offline submission${processed !== 1 ? 's' : ''} synced`,
      {
        description: 'Everything is up to date.',
        duration: 5000,
      },
    );
  } else if (processed > 0 && failed > 0) {
    // Mixed results
    sonnerToast.warning(
      `${processed} synced, ${failed} failed`,
      {
        description: `${failed} submission${failed !== 1 ? 's' : ''} will retry automatically. Check the queue for details.`,
        duration: 6000,
      },
    );
  } else if (failed > 0 && processed === 0) {
    // All failed
    sonnerToast.error(
      `Sync failed for ${failed} submission${failed !== 1 ? 's' : ''}`,
      {
        description: 'Check the offline queue for details.',
        duration: 6000,
      },
    );
  }
}

/** Show a per-item failure toast. */
function showItemFailedToast(item: QueuedSubmission, error: string): void {
  const label = getFormLabel(item.formType);
  sonnerToast.error(`${label} sync failed`, {
    description: error.length > 80 ? error.slice(0, 80) + '...' : error,
    duration: 5000,
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOfflineQueue(options: UseOfflineQueueOptions): UseOfflineQueueReturn {
  const { submitter, conflictCheck, onConflict, processOnOnline = true } = options;
  const networkIsOnline = useNetworkStore((s) => s.isOnline);
  const [queueLength, setQueueLength] = useState(0);
  const [pendingItems, setPendingItems] = useState<QueuedSubmission[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  const refreshPending = useCallback(async () => {
    const [length, items] = await Promise.all([getQueueLength(), getPendingItems()]);
    setQueueLength(length);
    setPendingItems(items);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      refreshPending();
    }, 0);
    return () => clearTimeout(id);
  }, [refreshPending]);

  // Common sync callback wiring
  const buildProcessOptions = useCallback(() => ({
    conflictCheck,
    onConflict,
    onProgress: (progress: SyncProgress) => setSyncProgress(progress),
    onItemSynced: (item: QueuedSubmission) => {
      recordItemSynced(item);
      showItemSyncedToast(item);
    },
    onItemFailed: (item: QueuedSubmission, error: string) => {
      showItemFailedToast(item, error);
    },
  }), [conflictCheck, onConflict]);

  // Process queue when coming back online
  useEffect(() => {
    if (!networkIsOnline || !processOnOnline || !submitter) return;

    // Small delay to let network stabilize
    const timer = setTimeout(() => {
      processQueue(submitter, buildProcessOptions())
        .then(({ processed, failed, discarded }) => {
          setSyncProgress(null);

          if (processed > 0 || failed > 0 || discarded > 0) {
            logger.info('[offlineQueue] Synced after online', { processed, failed, discarded });
            useNetworkStore.getState().recordSync();

            // Record cycle summary
            useSyncHistory.getState().addCycleSummary({ processed, failed, discarded });

            // Show summary toast (only if >1 item, otherwise per-item toast is enough)
            if (processed + failed > 1) {
              showCycleSummaryToast(processed, failed, discarded);
            }
          }

          refreshPending();
        })
        .catch((err) => {
          setSyncProgress(null);
          logger.error('[offlineQueue] Process queue failed after online', err);
          refreshPending();
        });
    }, 2_000);

    return () => clearTimeout(timer);
    // Only trigger when going from offline -> online
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkIsOnline]);

  const addToQueue = useCallback(
    async (
      formType: FormType,
      payload: Record<string, unknown>,
      opts?: { userId?: string; dateFor?: string; photoIds?: string[] },
    ) => {
      const id = await addToQueueLib(formType, payload, opts);
      await refreshPending();
      return id;
    },
    [refreshPending],
  );

  const processQueueNow = useCallback(async () => {
    if (!submitter) return { processed: 0, failed: 0, discarded: 0 };
    setSyncProgress({ current: 0, total: 0, formType: 'jsa', hasPhotos: false });

    const result = await processQueue(submitter, buildProcessOptions());
    setSyncProgress(null);

    if (result.processed > 0) {
      useNetworkStore.getState().recordSync();
      useSyncHistory.getState().addCycleSummary(result);

      if (result.processed + result.failed > 1) {
        showCycleSummaryToast(result.processed, result.failed, result.discarded);
      }
    }

    await refreshPending();
    return result;
  }, [submitter, buildProcessOptions, refreshPending]);

  const removeFromQueueById = useCallback(
    async (id: string) => {
      await removeFromQueue(id);
      await refreshPending();
    },
    [refreshPending],
  );

  const retryManual = useCallback(
    async (id: string) => {
      await retryManualLib(id);
      await refreshPending();
    },
    [refreshPending],
  );

  return {
    isOnline: networkIsOnline,
    queueLength,
    pendingItems,
    syncProgress,
    addToQueue,
    processQueueNow,
    removeFromQueue: removeFromQueueById,
    retryManual,
    refreshPending,
  };
}
