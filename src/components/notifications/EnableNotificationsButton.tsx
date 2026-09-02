/**
 * EnableNotificationsButton — push permission instrument.
 *
 * One Canopy treatment for every role (the `variant` prop is kept for API
 * compatibility). States: iOS-not-installed instructions, iOS-too-old,
 * blocked, subscribed (disable = red, semantic), and enable.
 */

import { memo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Loader2, AlertTriangle, Smartphone, Share, Plus } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { canopy } from '@/lib/glass';

interface EnableNotificationsButtonProps {
  /** Kept for API compatibility — every role now shares the Canopy treatment */
  variant?: 'default' | 'gold' | 'green' | 'ember' | 'bluewhite' | 'purple' | 'redwhite';
  /** Show compact version */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-verdant-500/20 font-mono text-[9px] font-bold text-verdant-200">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function EnableNotificationsButtonComponent({ compact = false, className = '' }: EnableNotificationsButtonProps) {
  const { permission, isSubscribed, isSupported, isIOS, isInstalled, iOSVersion, requestPermission, unsubscribe, loading, error } =
    usePushNotifications();

  if (isIOS && !isInstalled) {
    return (
      <div className={`rounded-leaf-sm border border-verdant-500/25 bg-verdant-500/[0.06] p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-leaf-xs border border-verdant-400/30 bg-verdant-500/15">
            <Smartphone className="h-5 w-5 text-verdant-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="type-instrument mb-1.5 text-verdant-300">Install required (iOS)</p>
            <p className="mb-3 text-xs leading-relaxed text-bone-300">
              To receive push notifications on iPhone/iPad, install this app to your home screen:
            </p>
            <ol className="space-y-1.5 text-xs text-bone-300">
              <Step n={1}>
                Tap <Share className="mx-0.5 inline h-3 w-3" aria-hidden /> <strong className="text-bone-50">Share</strong> in Safari
              </Step>
              <Step n={2}>
                Select <Plus className="mx-0.5 inline h-3 w-3" aria-hidden /> <strong className="text-bone-50">Add to Home Screen</strong>
              </Step>
              <Step n={3}>Open from home screen</Step>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (isIOS && iOSVersion !== null && iOSVersion < 16.4) {
    return (
      <div className={`flex items-center gap-2 rounded-leaf-xs border border-lime-400/30 bg-lime-400/10 px-4 py-3 ${className}`}>
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-lime-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium text-lime-200">iOS update required</p>
          {!compact && <p className="truncate text-xs text-lime-200/70">Push notifications require iOS 16.4+. You have {iOSVersion}.</p>}
        </div>
      </div>
    );
  }

  if (!isSupported) return null;

  if (permission === 'denied') {
    return (
      <div className={`flex items-center gap-2 rounded-leaf-xs border border-bone-50/[0.12] bg-ink-900/70 px-4 py-3 text-bone-200 ${className}`}>
        <BellOff className="h-5 w-5 flex-shrink-0 text-bone-400" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium">Notifications blocked</p>
          {!compact && (
            <p className="truncate text-xs text-bone-400">
              {isIOS ? 'Go to Settings → ATTS Portal → Notifications' : 'Enable in browser settings'}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (permission === 'granted' && isSubscribed) {
    return (
      <div className={`space-y-2 ${className}`}>
        <motion.button
          onClick={unsubscribe}
          disabled={loading}
          whileTap={{ scale: 0.98 }}
          className={`${canopy.buttonGhost} w-full text-sm hover:border-rose-400/50 hover:text-rose-200`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
          <span>{loading ? 'Disabling...' : compact ? 'Disable' : 'Disable notifications'}</span>
        </motion.button>
        {!compact && (
          <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-verdant-300/80">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-verdant-400 align-middle" />
            Push notifications live
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <motion.button
        onClick={requestPermission}
        disabled={loading}
        aria-label={compact ? 'Enable' : 'Enable Notifications'}
        whileTap={{ scale: 0.98 }}
        className={`${canopy.buttonPrimary} w-full text-sm`}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
        <span>{loading ? 'Enabling...' : compact ? 'Enable' : 'Enable notifications'}</span>
      </motion.button>

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden />
          <span className="truncate">{error}</span>
        </div>
      )}

      {!compact && !error && (
        <p className="text-center text-xs text-bone-400">
          {isIOS && isInstalled ? 'Notifications will appear on your lock screen' : 'Get notified about announcements & updates'}
        </p>
      )}
    </div>
  );
}

export const EnableNotificationsButton = memo(EnableNotificationsButtonComponent);
export default EnableNotificationsButton;
