/**
 * Hook: Offline submission queue
 *
 * Exposes online status, queue length, pending items, add/process/remove,
 * and syncs when the app comes back online.
 *
 * @module useOfflineQueue
 */

import { useCallback, useEffect, useState } from 'react';
import {
  addToQueue as addToQueueLib,
  getPendingItems,
  getQueueLength,
  isOnline as isOnlineLib,
  processQueue,
  removeFromQueue,
  type FormType,
  type OfflineSubmitter,
  type QueuedSubmission,
} from '../lib/offlineQueue';
import { logger } from '../lib/logger';

export interface UseOfflineQueueOptions {
  /** Submitter to use when processing the queue (e.g. from app/context). */
  submitter: OfflineSubmitter | null;
  /** Optional conflict check: if returns true, queued item is discarded. */
  conflictCheck?: (item: QueuedSubmission) => Promise<boolean>;
  /** Run processQueue automatically when coming back online. */
  processOnOnline?: boolean;
}

export interface UseOfflineQueueReturn {
  isOnline: boolean;
  queueLength: number;
  pendingItems: QueuedSubmission[];
  addToQueue: (
    formType: FormType,
    payload: Record<string, unknown>,
    options?: { userId?: string; dateFor?: string; files?: Record<string, Blob> }
  ) => Promise<string>;
  processQueueNow: () => Promise<{ processed: number; failed: number; discarded: number }>;
  removeFromQueue: (id: string) => Promise<void>;
  refreshPending: () => Promise<void>;
}

export function useOfflineQueue(options: UseOfflineQueueOptions): UseOfflineQueueReturn {
  const { submitter, conflictCheck, processOnOnline = true } = options;
  const [isOnline, setIsOnline] = useState(() => isOnlineLib());
  const [queueLength, setQueueLength] = useState(0);
  const [pendingItems, setPendingItems] = useState<QueuedSubmission[]>([]);

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

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (processOnOnline && submitter) {
        processQueue(submitter, { conflictCheck })
          .then(({ processed, failed, discarded }) => {
            if (processed > 0 || failed > 0 || discarded > 0) {
              logger.info('[offlineQueue] Synced after online', { processed, failed, discarded });
              refreshPending();
            }
          })
          .catch((err) => {
            logger.error('[offlineQueue] Process queue failed after online', err);
            refreshPending();
          });
      }
      refreshPending();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [submitter, conflictCheck, processOnOnline, refreshPending]);

  const addToQueue = useCallback(
    async (
      formType: FormType,
      payload: Record<string, unknown>,
      opts?: { userId?: string; dateFor?: string; files?: Record<string, Blob> }
    ) => {
      const id = await addToQueueLib(formType, payload, opts);
      await refreshPending();
      return id;
    },
    [refreshPending]
  );

  const processQueueNow = useCallback(async () => {
    if (!submitter) return { processed: 0, failed: 0, discarded: 0 };
    const result = await processQueue(submitter, { conflictCheck });
    await refreshPending();
    return result;
  }, [submitter, conflictCheck, refreshPending]);

  const removeFromQueueById = useCallback(
    async (id: string) => {
      await removeFromQueue(id);
      await refreshPending();
    },
    [refreshPending]
  );

  return {
    isOnline,
    queueLength,
    pendingItems,
    addToQueue,
    processQueueNow,
    removeFromQueue: removeFromQueueById,
    refreshPending,
  };
}
