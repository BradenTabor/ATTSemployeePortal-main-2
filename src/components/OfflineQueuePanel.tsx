/**
 * Offline Queue Management Panel
 *
 * Slide-out panel accessible from the OfflineModeBanner that shows:
 * - List of queued submissions with form type, timestamp, photo count
 * - Storage usage and remaining photo capacity
 * - Per-item discard / retry actions
 * - Conflict review tab
 * - "Sync all" button
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trash2,
  RefreshCw,
  FileText,
  Camera,
  AlertTriangle,
  HardDrive,
  Clock,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useOfflineQueueContext } from '../hooks/useOfflineQueueContext';
import { useStorageQuota } from '../hooks/useStorageQuota';
import { getConflicts, deleteConflict, clearConflicts, type SyncConflict } from '../lib/syncConflicts';
import { deletePhotosForQueue } from '../lib/offlinePhotoStore';
import type { QueuedSubmission } from '../lib/offlineQueue';

interface OfflineQueuePanelProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'queue' | 'conflicts';

const FORM_LABELS: Record<string, string> = {
  jsa: 'JSA',
  dvir: 'DVIR',
  equipment: 'Equipment Inspection',
};

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function QueueItem({
  item,
  onDiscard,
  onRetry,
}: {
  item: QueuedSubmission;
  onDiscard: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const hasPhotos = item.photoIds.length > 0;
  const isFailed = item.status === 'failed' || item.status === 'failed_manual';

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-xl border",
      isFailed
        ? "bg-red-900/10 border-red-500/20"
        : item.status === 'syncing'
        ? "bg-blue-900/10 border-blue-500/20"
        : "bg-white/[0.02] border-white/10"
    )}>
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
        isFailed ? "bg-red-500/20" : "bg-emerald-500/20"
      )}>
        <FileText className={cn("w-4 h-4", isFailed ? "text-red-400" : "text-emerald-400")} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {FORM_LABELS[item.formType] || item.formType}
          </span>
          {hasPhotos && (
            <span className="inline-flex items-center gap-1 text-xs text-white/50">
              <Camera className="w-3 h-3" />
              {item.photoIds.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock className="w-3 h-3 text-white/30" />
          <span className="text-xs text-white/40">{formatTimestamp(item.timestamp)}</span>
        </div>
        {isFailed && item.error && (
          <p className="text-xs text-red-400/80 mt-1 line-clamp-2">{item.error}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {item.status === 'failed_manual' && (
          <button
            type="button"
            onClick={() => onRetry(item.id)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-blue-400 transition-colors"
            title="Retry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDiscard(item.id)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
          title="Discard"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ConflictItem({
  conflict,
  onDelete,
}: {
  conflict: SyncConflict;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border bg-amber-900/10 border-amber-500/20">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-amber-500/20">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-amber-200">
          {FORM_LABELS[conflict.formType] || conflict.formType}
        </span>
        <p className="text-xs text-amber-300/70 mt-0.5">{conflict.conflictReason}</p>
        <div className="flex items-center gap-2 mt-1">
          <Clock className="w-3 h-3 text-white/30" />
          <span className="text-xs text-white/40">{formatTimestamp(conflict.createdAt)}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDelete(conflict.id)}
        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors shrink-0"
        title="Dismiss"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function OfflineQueuePanel({ open, onClose }: OfflineQueuePanelProps) {
  const { pendingItems, processQueueNow, removeFromQueue, retryManual, isOnline, syncProgress } = useOfflineQueueContext();
  const storage = useStorageQuota();
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Load conflicts when tab is active
  useEffect(() => {
    if (open && activeTab === 'conflicts') {
      getConflicts().then(setConflicts);
    }
  }, [open, activeTab]);

  const handleDiscard = useCallback(async (id: string) => {
    // Also clean up any associated photos
    await deletePhotosForQueue(id);
    await removeFromQueue(id);
  }, [removeFromQueue]);

  const handleDeleteConflict = useCallback(async (id: string) => {
    await deleteConflict(id);
    setConflicts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleClearConflicts = useCallback(async () => {
    await clearConflicts();
    setConflicts([]);
  }, []);

  const handleSyncAll = useCallback(async () => {
    setSyncing(true);
    try {
      await processQueueNow();
    } finally {
      setSyncing(false);
    }
  }, [processQueueNow]);

  const isSyncing = syncing || syncProgress !== null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-[61] w-full max-w-md bg-[#0a0f0d] border-l border-white/10 shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Offline Queue</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {(['queue', 'conflicts'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors",
                    activeTab === tab
                      ? "text-emerald-400 border-b-2 border-emerald-400"
                      : "text-white/40 hover:text-white/60"
                  )}
                >
                  {tab === 'queue' ? `Queue (${pendingItems.length})` : `Conflicts (${conflicts.length})`}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeTab === 'queue' ? (
                pendingItems.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-sm">
                    No pending submissions
                  </div>
                ) : (
                  pendingItems.map((item) => (
                    <QueueItem
                      key={item.id}
                      item={item}
                      onDiscard={handleDiscard}
                      onRetry={retryManual}
                    />
                  ))
                )
              ) : (
                conflicts.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-sm">
                    No conflicts to review
                  </div>
                ) : (
                  <>
                    {conflicts.map((conflict) => (
                      <ConflictItem
                        key={conflict.id}
                        conflict={conflict}
                        onDelete={handleDeleteConflict}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={handleClearConflicts}
                      className="w-full mt-2 py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                      Clear all conflicts
                    </button>
                  </>
                )
              )}
            </div>

            {/* Footer: storage + sync */}
            <div className="border-t border-white/10 p-4 space-y-3">
              {/* Storage indicator */}
              <div className="flex items-center gap-3">
                <HardDrive className={cn(
                  "w-4 h-4 shrink-0",
                  storage.isCritical ? "text-red-400" : storage.isWarning ? "text-amber-400" : "text-white/40"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className={cn(
                      storage.isCritical ? "text-red-300" : storage.isWarning ? "text-amber-300" : "text-white/50"
                    )}>
                      {storage.isCritical
                        ? `Storage critical: ~${storage.remainingPhotos} photos left`
                        : storage.isWarning
                        ? `Storage low: ~${storage.remainingPhotos} photos left`
                        : `~${storage.remainingPhotos} photos remaining`}
                    </span>
                    {storage.storedPhotoCount > 0 && (
                      <span className="text-white/30">
                        {storage.storedPhotoCount} stored ({formatBytes(storage.storedPhotoBytes)})
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        storage.isCritical ? "bg-red-500" : storage.isWarning ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(storage.usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Sync button */}
              {pendingItems.length > 0 && isOnline && (
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-sm font-medium transition-colors"
                >
                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                  {isSyncing
                    ? syncProgress
                      ? `Syncing ${syncProgress.current} of ${syncProgress.total}...`
                      : 'Syncing...'
                    : `Sync ${pendingItems.length} submission${pendingItems.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
