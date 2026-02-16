/**
 * Offline Form Indicator
 *
 * Small inline indicator for form pages that communicates whether the form
 * can be submitted offline. Shows below the form title or in the form header.
 *
 * Usage:
 *   <OfflineFormIndicator offlineCapable={true} />
 */

import { WifiOff, Wifi, AlertCircle } from 'lucide-react';
import { useNetworkStore } from '../lib/networkStatus';
import { useOfflineCapability } from '../lib/offlineCapability';
import { cn } from '../lib/utils';

interface OfflineFormIndicatorProps {
  /** Whether this specific form supports offline submission. */
  offlineCapable?: boolean;
  /** Optional class name. */
  className?: string;
}

export function OfflineFormIndicator({
  offlineCapable = true,
  className,
}: OfflineFormIndicatorProps) {
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { offlineCapable: deviceCapable } = useOfflineCapability();

  // Only show when offline
  if (isOnline) return null;

  const canSubmitOffline = offlineCapable && deviceCapable;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium border",
        canSubmitOffline
          ? "bg-amber-900/15 border-amber-500/20 text-amber-200"
          : "bg-red-900/15 border-red-500/20 text-red-200",
        className,
      )}
      role="status"
    >
      {canSubmitOffline ? (
        <>
          <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>You're offline. This form can be submitted and will sync when you're back online.</span>
        </>
      ) : !deviceCapable ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          <span>Offline mode unavailable in this browser. Please connect to submit.</span>
        </>
      ) : (
        <>
          <Wifi className="w-3.5 h-3.5 shrink-0 text-red-400" />
          <span>This form requires an internet connection to submit.</span>
        </>
      )}
    </div>
  );
}
