/**
 * PushNotificationPrompt Component
 * 
 * A premium modal overlay that prompts unsubscribed users to enable push notifications.
 * 
 * Features:
 * - 3-second delay before showing (prevents jarring popup after login)
 * - Session-based tracking (won't re-show on dashboard navigation)
 * - 7-day cooldown after "Maybe Later" click
 * - Success celebration animation after enable
 * - Framer Motion animations
 * - Dev bypass with ?test-push-prompt=1
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';

// Storage keys
const DISMISSED_KEY = 'atts_push_notification_dismissed';
const SESSION_KEY = 'atts_push_prompt_shown_this_session';
const COOLDOWN_DAYS = 7;

/**
 * Check if the prompt was dismissed within the cooldown period
 */
function isDismissedRecently(): boolean {
  try {
    const dismissedAt = localStorage.getItem(DISMISSED_KEY);
    if (!dismissedAt) return false;

    const dismissedDate = new Date(dismissedAt);
    const daysSinceDismissal = 
      (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceDismissal < COOLDOWN_DAYS;
  } catch {
    return false;
  }
}

/**
 * Check if prompt was already shown this session
 */
function hasShownThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark the prompt as shown this session
 */
function markShownThisSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, 'true');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Store dismissal timestamp
 */
function setDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
  } catch {
    // Ignore storage errors
  }
}

function PushNotificationPromptComponent() {
  const { user } = useAuth();
  const {
    permission,
    isSubscribed,
    isSupported,
    requestPermission,
    loading,
  } = usePushNotifications();

  const [showPrompt, setShowPrompt] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Debug: Log mount in dev mode
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[PushPrompt] Component mounted, checking conditions...');
    }
  }, []);

  // Check if we should show the prompt
  const shouldShow = useCallback(() => {
    // Dev mode bypass
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('test-push-prompt') === '1') {
        console.log('[PushPrompt] Dev bypass - showing prompt');
        return true;
      }
    }

    // Don't show if:
    // - Not logged in
    // - Not supported
    // - Already subscribed
    // - Permission denied (can't ask again)
    // - Dismissed recently (within 7 days)
    // - Already shown this session
    
    // Debug logging in dev mode
    if (import.meta.env.DEV) {
      console.log('[PushPrompt] Checking conditions:', {
        hasUser: !!user,
        isSupported,
        isSubscribed,
        permission,
        dismissedRecently: isDismissedRecently(),
        shownThisSession: hasShownThisSession(),
      });
    }

    if (!user) {
      if (import.meta.env.DEV) console.log('[PushPrompt] Not showing: no user');
      return false;
    }
    if (!isSupported) {
      if (import.meta.env.DEV) console.log('[PushPrompt] Not showing: not supported');
      return false;
    }
    if (isSubscribed) {
      if (import.meta.env.DEV) console.log('[PushPrompt] Not showing: already subscribed');
      return false;
    }
    if (permission === 'denied') {
      if (import.meta.env.DEV) console.log('[PushPrompt] Not showing: permission denied');
      return false;
    }
    if (isDismissedRecently()) {
      if (import.meta.env.DEV) console.log('[PushPrompt] Not showing: dismissed recently (7-day cooldown)');
      return false;
    }
    if (hasShownThisSession()) {
      if (import.meta.env.DEV) console.log('[PushPrompt] Not showing: already shown this session');
      return false;
    }

    if (import.meta.env.DEV) console.log('[PushPrompt] ✅ All conditions met - will show in 3 seconds');
    return true;
  }, [user, isSupported, isSubscribed, permission]);

  // Show prompt after 3-second delay
  useEffect(() => {
    if (!shouldShow()) return;

    const timer = setTimeout(() => {
      markShownThisSession();
      setShowPrompt(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [shouldShow]);

  // Handle enable notifications
  const handleEnable = useCallback(async () => {
    const success = await requestPermission();
    
    if (success) {
      setShowSuccess(true);
      // Hide after showing success for 1.5 seconds
      setTimeout(() => {
        setShowPrompt(false);
      }, 1500);
    }
  }, [requestPermission]);

  // Handle dismiss (Maybe Later or click outside)
  const handleDismiss = useCallback(() => {
    setDismissed();
    setShowPrompt(false);
  }, []);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  }, [handleDismiss]);

  // Don't render if prompt shouldn't be shown
  if (!showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-label="Enable Push Notifications"
        tabIndex={0}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Premium glass card */}
          <div 
            className="relative overflow-hidden rounded-3xl border border-white/[0.15] shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]"
            style={{
              background: 'linear-gradient(145deg, rgba(34, 197, 94, 0.08) 0%, rgba(10, 25, 18, 0.95) 50%, rgba(5, 12, 8, 0.98) 100%)',
              backdropFilter: 'blur(24px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            }}
          >
            {/* Top gradient accent */}
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500" />
            
            {/* Glass gloss effect */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(125deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 30%, transparent 60%)',
              }}
            />

            {/* Inner glow */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 50% 0%, rgba(34, 197, 94, 0.15) 0%, transparent 50%)',
              }}
            />

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all z-10"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="relative px-6 py-8 text-center">
              {showSuccess ? (
                // Success state
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="py-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="w-10 h-10 text-emerald-400" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    All Set!
                  </h3>
                  <p className="text-emerald-200/70 text-sm">
                    You'll receive notifications for important updates
                  </p>
                </motion.div>
              ) : (
                // Default state
                <>
                  {/* Animated bell icon */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mb-5"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                      <motion.div
                        animate={{ 
                          rotate: [0, -10, 10, -10, 0],
                        }}
                        transition={{ 
                          duration: 0.5, 
                          delay: 0.5,
                          ease: 'easeInOut',
                        }}
                      >
                        <Bell className="w-8 h-8 text-emerald-400" />
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Heading */}
                  <motion.h3
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="text-2xl font-bold text-white mb-2"
                  >
                    Stay Updated
                  </motion.h3>

                  {/* Description */}
                  <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-white/60 text-sm mb-6 leading-relaxed"
                  >
                    Get notified about job assignments, announcements, and important updates — even when you're away.
                  </motion.p>

                  {/* Buttons */}
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="flex flex-col gap-3"
                  >
                    <motion.button
                      onClick={handleEnable}
                      disabled={loading}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                          <span>Enabling...</span>
                        </>
                      ) : (
                        <>
                          <Bell className="w-5 h-5" />
                          <span>Enable Notifications</span>
                        </>
                      )}
                    </motion.button>

                    <button
                      onClick={handleDismiss}
                      disabled={loading}
                      className="w-full px-6 py-3 rounded-xl text-white/60 hover:text-white hover:bg-white/5 font-medium transition-all disabled:opacity-50"
                    >
                      Maybe Later
                    </button>
                  </motion.div>
                </>
              )}
            </div>

            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export const PushNotificationPrompt = memo(PushNotificationPromptComponent);
export default PushNotificationPrompt;

