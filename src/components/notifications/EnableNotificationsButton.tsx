/**
 * EnableNotificationsButton Component
 * 
 * A button that allows users to enable/disable push notifications.
 * Displays different states based on permission and subscription status.
 * 
 * iOS SUPPORT:
 * - Detects iOS devices and installation status
 * - Shows installation instructions when PWA not installed
 * - Provides iOS-specific error messages
 */

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Loader2, AlertTriangle, Smartphone, Share, Plus } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface EnableNotificationsButtonProps {
  /** Visual variant - matches dashboard themes */
  variant?: 'default' | 'gold' | 'green' | 'ember' | 'bluewhite' | 'purple' | 'redwhite';
  /** Show compact version */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

function EnableNotificationsButtonComponent({
  variant = 'default',
  compact = false,
  className = '',
}: EnableNotificationsButtonProps) {
  const {
    permission,
    isSubscribed,
    isSupported,
    isIOS,
    isInstalled,
    iOSVersion,
    requestPermission,
    unsubscribe,
    loading,
    error,
  } = usePushNotifications();

  // iOS not installed - show installation instructions
  if (isIOS && !isInstalled) {
    return (
      <div 
        className={`rounded-xl border border-blue-500/30 p-4 ${className}`}
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-blue-300 mb-1.5">Install Required (iOS)</p>
            <p className="text-xs text-blue-200/70 mb-3 leading-relaxed">
              To receive push notifications on iPhone/iPad, install this app to your home screen:
            </p>
            <ol className="space-y-1.5 text-xs text-blue-200/60">
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Tap <Share className="inline w-3 h-3 mx-0.5" /> <strong className="text-blue-200">Share</strong> in Safari</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Select <Plus className="inline w-3 h-3 mx-0.5" /> <strong className="text-blue-200">Add to Home Screen</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold">3</span>
                <span>Open from home screen</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // iOS version too old
  if (isIOS && iOSVersion !== null && iOSVersion < 16.4) {
    return (
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 ${className}`}>
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-300">iOS Update Required</p>
          {!compact && (
            <p className="text-xs text-amber-200/70 truncate">
              Push notifications require iOS 16.4+. You have {iOSVersion}.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Don't render if not supported (and not iOS-related issues above)
  if (!isSupported) {
    return null;
  }

  // Style variants - matches dashboard themes
  // "subscribed" = red button to disable, "unsubscribed" = themed button to enable
  const variants = {
    default: {
      subscribed: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border-red-500/50 shadow-lg shadow-red-500/20',
      unsubscribed: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500',
      denied: 'bg-yellow-600/20 text-yellow-300 border-yellow-500/30',
    },
    gold: {
      subscribed: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border-red-500/50 shadow-lg shadow-red-500/20',
      unsubscribed: 'bg-gradient-to-r from-[#f4c979] via-[#f8e5bb] to-[#f4c979] hover:from-[#f8e5bb] hover:via-[#fff6dd] hover:to-[#f8e5bb] text-[#0c0b09] border-[#f4c979]/50',
      denied: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    },
    green: {
      subscribed: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border-red-500/50 shadow-lg shadow-red-500/20',
      unsubscribed: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white border-emerald-400/50',
      denied: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
    },
    // Mechanic Dashboard - Ember/Orange theme
    ember: {
      subscribed: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border-red-500/50 shadow-lg shadow-red-500/20',
      unsubscribed: 'bg-gradient-to-r from-[#ff9350] to-[#ff6f3c] hover:from-[#ffb48a] hover:to-[#ff9350] text-white border-[#ff6f3c]/50',
      denied: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
    },
    // Foreman Dashboard - Blue/White theme
    bluewhite: {
      subscribed: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border-red-500/50 shadow-lg shadow-red-500/20',
      unsubscribed: 'bg-gradient-to-r from-[#3b82f6] to-[#2563eb] hover:from-[#60a5fa] hover:to-[#3b82f6] text-white border-[#3b82f6]/50',
      denied: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    },
    // General Foreman Dashboard - Purple theme
    purple: {
      subscribed: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border-red-500/50 shadow-lg shadow-red-500/20',
      unsubscribed: 'bg-gradient-to-r from-[#a855f7] to-[#9333ea] hover:from-[#c084fc] hover:to-[#a855f7] text-white border-[#a855f7]/50',
      denied: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    },
    // Safety Officer Dashboard - Red/White theme
    redwhite: {
      subscribed: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white border-red-500/50 shadow-lg shadow-red-500/20',
      unsubscribed: 'bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#f87171] hover:to-[#ef4444] text-white border-[#ef4444]/50',
      denied: 'bg-red-500/10 text-red-300 border-red-500/30',
    },
  };

  const currentVariant = variants[variant];

  // Permission denied state
  if (permission === 'denied') {
    return (
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${currentVariant.denied} ${className}`}>
        <BellOff className="w-5 h-5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Notifications Blocked</p>
          {!compact && (
            <p className="text-xs opacity-70 truncate hover:scale-[1.02]">
              {isIOS 
                ? 'Go to Settings → ATTS Portal → Notifications'
                : 'Enable in browser settings'
              }
            </p>
          )}
        </div>
      </div>
    );
  }

  // Subscribed state - show red "Disable Notifications" button
  if (permission === 'granted' && isSubscribed) {
    return (
      <div className={`space-y-2 ${className}`}>
        <motion.button
          onClick={unsubscribe}
          disabled={loading}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${currentVariant.subscribed}`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <BellOff className="w-5 h-5" />
          )}
          <span className="font-semibold">
            {loading ? 'Disabling...' : compact ? 'Disable' : 'Disable Notifications'}
          </span>
        </motion.button>
        {!compact && (
          <p className="text-xs text-center text-emerald-400/80 hover:scale-[1.02]">
            ✓ Push notifications are enabled
          </p>
        )}
      </div>
    );
  }

  // Default state - enable button
  return (
    <div className={`space-y-2 ${className}`}>
      <motion.button
        onClick={requestPermission}
        disabled={loading}
        aria-label={compact ? 'Enable' : 'Enable Notifications'}
        whileTap={{ scale: 0.98 }}
        className={`relative flex items-center justify-center gap-2 px-4 py-4 min-h-[56px] rounded-xl border-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${currentVariant.unsubscribed}`}
        style={{
          background: 'linear-gradient(90deg, rgba(52, 211, 153, 0) 0%, rgba(16, 185, 129, 0) 6%)',
          boxShadow: 'none',
        }}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin relative z-10" />
        ) : (
          <Bell className="w-5 h-5 relative z-10 opacity-0" aria-hidden />
        )}
        <span className={`font-semibold relative z-10 ${!loading ? 'opacity-0' : ''}`}>
          {loading ? 'Enabling...' : compact ? 'Enable' : 'Enable Notifications'}
        </span>
        {/* Decorative overlay - sized to fit inside button so bell is fully contained */}
        {!loading && (
          <img
            src="/assets/enable-notifications-overlay.webp"
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none rounded-xl"
            style={{
              transform: 'scale(1.15)',
              transformOrigin: 'center center',
            }}
          />
        )}
      </motion.button>
      
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}
      
      {!compact && !error && (
        <p className="text-xs text-center opacity-60">
          {isIOS && isInstalled
            ? '📱 Notifications will appear on your lock screen'
            : 'Get notified about announcements & updates'
          }
        </p>
      )}
    </div>
  );
}

export const EnableNotificationsButton = memo(EnableNotificationsButtonComponent);
export default EnableNotificationsButton;

