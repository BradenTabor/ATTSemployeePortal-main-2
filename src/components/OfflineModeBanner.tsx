/**
 * Offline Mode Banner
 *
 * Persistent banner shown on the dashboard (and optionally globally) that
 * communicates offline status, queued submission count, last sync timestamp,
 * and provides a manual "Sync now" button.
 *
 * Replaces the minimal OfflineSyncIndicator for dashboard use. The floating
 * indicator remains for all-page coverage.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff,
  CloudOff,
  RefreshCw,
  ChevronDown,
  Clock,
  List,
  CheckCircle2,
} from 'lucide-react';
import { useOfflineQueueContext } from '../hooks/useOfflineQueueContext';
import { useNetworkStore } from '../lib/networkStatus';
import { useSyncHistory } from '../lib/syncHistory';
import { OfflineQueuePanel } from './OfflineQueuePanel';
import { cn } from '../lib/utils';

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function OfflineModeBanner() {
  const { isOnline, queueLength, syncProgress, processQueueNow } = useOfflineQueueContext();
  const lastSyncAt = useNetworkStore((s) => s.lastSyncAt);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const lastCycleSummary = useSyncHistory((s) => s.lastCycleSummary);
  const unacknowledgedCount = useSyncHistory((s) => s.unacknowledgedCount);

  const isSyncing = syncing || syncProgress !== null;
  const show = !isOnline || queueLength > 0;

  const lastSyncText = useMemo(() => formatRelativeTime(lastSyncAt), [lastSyncAt]);
  const lastSyncStale = lastSyncAt ? Date.now() - lastSyncAt > 24 * 60 * 60 * 1000 : false;

  // Post-sync success state: online, queue empty, but recent syncs happened
  const showPostSyncSuccess = isOnline && queueLength === 0 && lastCycleSummary && !lastCycleSummary.acknowledged;

  if (!show) {
    // Show post-sync confirmation banner (green state)
    if (showPostSyncSuccess) {
      const { processed, failed } = lastCycleSummary;
      return (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-900/15 p-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-200">
                {failed === 0
                  ? `${processed} submission${processed !== 1 ? 's' : ''} synced successfully`
                  : `${processed} synced, ${failed} need attention`
                }
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                {failed === 0
                  ? 'All your offline submissions have been confirmed on the server.'
                  : 'Some submissions encountered issues. Check the queue for details.'
                }
              </p>
            </div>
            {unacknowledgedCount > 0 && (
              <div className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-xs font-medium text-emerald-300">
                {unacknowledgedCount} new
              </div>
            )}
          </div>
          {lastSyncAt && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-emerald-500/10 text-xs text-emerald-300/60">
              <Clock className="w-3 h-3" />
              <span>Synced {lastSyncText}</span>
            </div>
          )}
        </motion.div>
      );
    }

    // Even when online and queue is empty, show the "Last synced" indicator
    // if there's a lastSyncAt timestamp (for user confidence)
    if (lastSyncAt) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-white/40 mb-3">
          <Clock className="w-3 h-3" />
          <span>
            Last synced: {lastSyncText}
          </span>
        </div>
      );
    }
    return null;
  }

  const handleSync = async () => {
    if (!isOnline || queueLength === 0) return;
    setSyncing(true);
    try {
      await processQueueNow();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        "mb-3 rounded-xl border p-3",
        !isOnline
          ? "bg-amber-900/20 border-amber-500/20"
          : "bg-blue-900/20 border-blue-500/20"
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          !isOnline ? "bg-amber-500/20" : "bg-blue-500/20"
        )}>
          {!isOnline ? (
            <WifiOff className="w-4 h-4 text-amber-400" />
          ) : (
            <CloudOff className="w-4 h-4 text-blue-400" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium",
            !isOnline ? "text-amber-200" : "text-blue-200"
          )}>
            {!isOnline ? "You're offline" : "Pending submissions"}
          </p>
          <p className="text-xs text-white/50 mt-0.5">
            {!isOnline ? (
              queueLength > 0
                ? `${queueLength} submission${queueLength !== 1 ? 's' : ''} queued. They'll sync when you're back online.`
                : "Some features are unavailable offline."
            ) : isSyncing ? (
              syncProgress
                ? `Syncing ${syncProgress.current} of ${syncProgress.total}${syncProgress.hasPhotos ? ' (with photos)' : ''}...`
                : 'Syncing...'
            ) : (
              `${queueLength} submission${queueLength !== 1 ? 's' : ''} ready to sync.`
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isOnline && queueLength > 0 && (
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50 transition-colors min-h-[36px]"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
              {isSyncing ? 'Syncing...' : 'Sync now'}
            </button>
          )}

          {queueLength > 0 && (
            <>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="View queue details"
                title="View queue"
              >
                <List className="w-4 h-4 text-white/50" />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                aria-label={expanded ? 'Collapse details' : 'Expand details'}
              >
                <ChevronDown className={cn("w-4 h-4 text-white/50 transition-transform", expanded && "rotate-180")} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Last sync timestamp */}
      {lastSyncAt && (
        <div className={cn(
          "flex items-center gap-1.5 mt-2 pt-2 border-t text-xs",
          !isOnline ? "border-amber-500/10" : "border-blue-500/10",
          lastSyncStale && queueLength > 0 ? "text-amber-400" : "text-white/40"
        )}>
          <Clock className="w-3 h-3" />
          <span>Last synced: {lastSyncText}</span>
          {lastSyncStale && queueLength > 0 && (
            <span className="ml-1 text-amber-400/80">(over 24h ago)</span>
          )}
        </div>
      )}

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 pt-2 border-t border-white/5 text-xs text-white/50"
          >
            {isSyncing && (
              <p className="text-white/60">
                Your data is saved locally and will continue syncing if interrupted.
              </p>
            )}
            {!isOnline && (
              <p>
                Forms you submit while offline are saved to your device and will
                automatically sync when connectivity returns.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>

    {/* Queue management panel */}
    <OfflineQueuePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
