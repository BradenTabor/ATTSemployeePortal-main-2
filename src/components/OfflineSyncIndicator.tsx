/**
 * Offline / sync indicator: shows when the app is offline or has queued submissions,
 * with a "Sync now" button when online and queue has items.
 */

import { useOfflineQueueContext } from "../hooks/useOfflineQueueContext";
import { useState } from "react";
import { WifiOff, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";

export function OfflineSyncIndicator() {
  const { isOnline, queueLength, processQueueNow } = useOfflineQueueContext();
  const [syncing, setSyncing] = useState(false);

  const show = !isOnline || queueLength > 0;
  if (!show) return null;

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
    <div
      className={cn(
        "fixed top-2 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium shadow-lg",
        !isOnline
          ? "bg-amber-900/95 text-amber-100 border border-amber-600/50"
          : "bg-emerald-900/95 text-emerald-100 border border-emerald-600/50"
      )}
      role="status"
      aria-live="polite"
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
          <span>You're offline</span>
          {queueLength > 0 && (
            <span className="opacity-90">· {queueLength} queued</span>
          )}
        </>
      ) : (
        <>
          <CloudOff className="w-4 h-4 shrink-0" aria-hidden />
          <span>{queueLength} submission{queueLength !== 1 ? "s" : ""} queued</span>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 hover:bg-white/30 disabled:opacity-50 text-xs font-medium"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", syncing && "animate-spin")}
              aria-hidden
            />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </>
      )}
    </div>
  );
}
