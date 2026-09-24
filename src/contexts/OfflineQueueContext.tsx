/**
 * Offline Queue Context (v2)
 *
 * Provides a submitter that replays queued form submissions when back online.
 *
 * v2 additions:
 * - DVIR + Equipment submitters with photo upload from offlinePhotoStore
 * - JSA submitter updated to handle offline photos
 * - Batched session refresh gate (one refresh per cycle, not per-submission)
 * - Idempotent photo uploads (upsert: true for interrupted retries)
 * - Post-sync integrity verification (DB read-back)
 * - Conflict detection with archival via syncConflicts store
 *
 * @module OfflineQueueContext
 */

import { useCallback, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import type { QueuedSubmission } from "../lib/offlineQueue";
import { toast } from "sonner";
import { archiveConflict } from "../lib/syncConflicts";
import { logger } from "../lib/logger";
import { submitOfflineForm, hasOfflineConflict } from "../lib/offlineSubmission";
import { OfflineQueueContext } from "./offlineQueueContextValue";

// ---------------------------------------------------------------------------
// Photo upload helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const conflictCheck = useCallback(
    (item: QueuedSubmission) => user?.id ? hasOfflineConflict(item, user.id) : Promise.resolve(false),
    [user],
  );

  /**
   * Handle conflict: archive the discarded item to sync_conflicts store.
   * The user can review conflicts in the OfflineQueuePanel.
   */
  const onConflict = useCallback(async (item: QueuedSubmission) => {
    const reason = item.formType === 'dvir'
      ? `A DVIR for ${item.dateFor || 'this date'} already exists`
      : `An equipment inspection for ${item.dateFor || 'this date'} already exists`;

    toast.warning('Submission conflict', {
      description: `${reason}. It was moved to Offline queue → Conflicts.`,
      duration: 6000,
    });

    await archiveConflict(
      item.id,
      item.formType,
      item.payload,
      reason,
      { photoIds: item.photoIds },
    );

    logger.warn('[OfflineQueue] Conflict archived', {
      formType: item.formType,
      dateFor: item.dateFor,
      id: item.id,
    });
  }, []);

  const value = useOfflineQueue({
    submitter: user?.id ? submitOfflineForm : null,
    userId: user?.id,
    conflictCheck,
    onConflict,
    processOnOnline: true,
  });

  // Record sync timestamp when queue finishes processing
  // (handled inside useOfflineQueue via useNetworkStore.recordSync())

  return (
    <OfflineQueueContext.Provider value={value}>
      {children}
    </OfflineQueueContext.Provider>
  );
}
