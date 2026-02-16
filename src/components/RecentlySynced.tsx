/**
 * Recently Synced Items
 *
 * Dashboard component that shows confirmed offline submissions after sync.
 * Displays for up to 1 hour after sync, with a dismiss button to acknowledge.
 *
 * Visual hierarchy:
 * - Green success state with checkmark icons
 * - Per-item detail: form type, photo count, timestamp
 * - Dismiss button to clear (marks items as acknowledged)
 * - Auto-hides after all items are acknowledged
 */

import { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Camera,
  X,
  Clock,
} from 'lucide-react';
import { useSyncHistory, getFormLabel, type SyncedItem } from '../lib/syncHistory';
import { cn } from '../lib/utils';

function formatSyncTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function SyncedItemRow({ item }: { item: SyncedItem }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-white/80">
          {getFormLabel(item.formType)}
        </span>
        {item.hadPhotos && (
          <span className="inline-flex items-center gap-1 ml-2 text-xs text-white/40">
            <Camera className="w-3 h-3" />
            {item.photoCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-white/30 shrink-0">
        <Clock className="w-3 h-3" />
        {formatSyncTime(item.syncedAt)}
      </div>
    </div>
  );
}

export function RecentlySynced() {
  const items = useSyncHistory((s) => s.items);
  const unacknowledgedCount = useSyncHistory((s) => s.unacknowledgedCount);
  const acknowledgeAll = useSyncHistory((s) => s.acknowledgeAll);
  const pruneExpired = useSyncHistory((s) => s.pruneExpired);

  // Prune expired items every 60 seconds
  useEffect(() => {
    const timer = setInterval(pruneExpired, 60_000);
    return () => clearInterval(timer);
  }, [pruneExpired]);

  const handleDismiss = useCallback(() => {
    acknowledgeAll();
  }, [acknowledgeAll]);

  // Only show unacknowledged items
  const unacknowledged = items.filter((i) => !i.acknowledged);
  if (unacknowledged.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-900/15 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-medium text-emerald-200">
              {unacknowledgedCount} submission{unacknowledgedCount !== 1 ? 's' : ''} synced
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white/60"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Items */}
        <div className="px-4 pb-3 divide-y divide-white/5">
          {unacknowledged.map((item) => (
            <SyncedItemRow key={item.id} item={item} />
          ))}
        </div>

        {/* Footer confirmation */}
        <div className={cn(
          "px-4 py-2 border-t border-emerald-500/10 text-xs text-emerald-300/60",
          "bg-emerald-950/30"
        )}>
          All offline submissions have been confirmed on the server.
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
