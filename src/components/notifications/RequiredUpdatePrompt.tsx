/**
 * RequiredUpdatePrompt Component
 * 
 * Full-screen mandatory update prompt that cannot be dismissed.
 * Forces users to update the app when a new version is deployed.
 * 
 * Features:
 * - Blocks all interaction until update is clicked
 * - Premium emerald-themed design matching ATTS portal
 * - ATTS logo and branding
 * - Animated entrance with staggered elements
 * - Single "Update Now" button that triggers service worker update
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, Shield, Zap, TreePine } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { APP_VERSION } from '../../lib/appVersion';

interface RequiredUpdatePromptProps {
  /** Whether to require update (can't dismiss) - default true */
  required?: boolean;
  /** Test mode bypasses service worker check for visual verification */
  testMode?: boolean;
}

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (visibility + DeployVersionChecker cover fast path)

function RequiredUpdatePromptComponent({ required = true, testMode = false }: RequiredUpdatePromptProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [testModeVisible, setTestModeVisible] = useState(testMode);
  const updateCheckPendingRef = useRef(false);
  const swCleanupRef = useRef<(() => void) | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('[PWA] Service worker registered for required update:', registration);

      if (!registration) return;

      const checkForUpdate = async () => {
        if (updateCheckPendingRef.current) {
          console.log('[PWA] Update check already in progress, skipping');
          return;
        }
        updateCheckPendingRef.current = true;
        try {
          if (!registration.installing && navigator.onLine) {
            console.log('[PWA] Checking for updates...');
            await registration.update();
          }
        } catch (error) {
          console.warn('[PWA] Update check failed:', error);
        } finally {
          updateCheckPendingRef.current = false;
        }
      };

      // Periodic check: every 5 minutes
      const intervalId = setInterval(() => {
        console.log('[PWA] Periodic update check (5 min interval)');
        checkForUpdate();
      }, UPDATE_CHECK_INTERVAL_MS);

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('[PWA] Tab became visible, checking for updates');
          checkForUpdate();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      swCleanupRef.current = () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error);
      setUpdateError('Failed to prepare update. Please refresh the page.');
    },
  });

  useEffect(() => {
    return () => {
      swCleanupRef.current?.();
    };
  }, []);

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);
    setUpdateError(null);
    
    // In test mode, simulate update with a delay
    if (testMode) {
      console.log('[PWA Test Mode] Simulating update...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTestModeVisible(false);
      setIsUpdating(false);
      return;
    }
    
    try {
      // Set a timeout - if updateServiceWorker doesn't reload the page within 5 seconds,
      // fall back to a hard refresh. This handles dev mode and edge cases.
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Update timeout')), 5000);
      });
      
      // Race between the update and the timeout
      await Promise.race([
        updateServiceWorker(true),
        timeoutPromise
      ]);
      // The page will reload, so this code may not execute
    } catch (error) {
      console.warn('[PWA] Service worker update timed out or failed, performing hard refresh:', error);
      // Clear all caches and do a hard refresh as fallback
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Force reload from server
      window.location.reload();
    }
  }, [updateServiceWorker, testMode]);

  const handleDismiss = useCallback(() => {
    if (!required) {
      if (testMode) {
        setTestModeVisible(false);
      } else {
        setNeedRefresh(false);
      }
    }
  }, [required, setNeedRefresh, testMode]);

  // Only show when there's an update available (or in test mode)
  if (!needRefresh && !testModeVisible) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label={required ? "Update Required" : "Update Available"}
        tabIndex={0}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        />

        {/* Animated background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.1, 0.15, 0.1],
            }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1,
            }}
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl"
          />
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.1 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-[#0a1f16] via-[#0d2a1c] to-[#051510] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_100px_rgba(16,185,129,0.1)] overflow-hidden">
            {/* Top gradient line */}
            <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400" />

            {/* Tree decoration - top right */}
            <motion.div
              animate={{ 
                y: [0, -5, 0],
                opacity: [0.15, 0.25, 0.15]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-4 -right-4 w-32 h-32"
            >
              <TreePine className="w-full h-full text-emerald-500" />
            </motion.div>

            <div className="p-8 space-y-6">
              {/* ATTS Logo */}
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.2 }}
                className="flex justify-center"
              >
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center overflow-hidden shadow-lg shadow-emerald-500/20">
                    <img 
                      src="/icon-192.png" 
                      alt="ATTS Logo" 
                      className="w-20 h-20 object-contain"
                    />
                  </div>
                  {/* Pulse ring */}
                  <motion.div
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-2xl border-2 border-emerald-400/50"
                  />
                </div>
              </motion.div>

              {/* Title & Branding */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center space-y-3"
              >
                {/* Company Name */}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm font-semibold tracking-wider text-emerald-400/80 uppercase">
                    All Terrain Tree Service
                  </span>
                </div>
                
                <h2 className="text-2xl font-bold text-white">
                  {required ? 'Update Required' : 'Update Available'}
                </h2>
                <p className="text-emerald-100/70 text-sm">
                  A new version of ATTS Portal is ready
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400 font-medium">
                    Version {APP_VERSION}
                  </span>
                </div>
              </motion.div>

              {/* Features preview */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="space-y-3"
              >
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Security & Stability</p>
                    <p className="text-xs text-white/50">Bug fixes & performance improvements</p>
                  </div>
                </motion.div>
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Enhanced Experience</p>
                    <p className="text-xs text-white/50">Faster forms, better offline support</p>
                  </div>
                </motion.div>
              </motion.div>

              {/* Error message */}
              {updateError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-red-400 text-center bg-red-500/10 rounded-lg p-3 border border-red-500/20"
                >
                  {updateError}
                </motion.p>
              )}

              {/* Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-3"
              >
                <motion.button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  whileHover={{ scale: isUpdating ? 1 : 1.02 }}
                  whileTap={{ scale: isUpdating ? 1 : 0.98 }}
                  aria-label={isUpdating ? "Updating app..." : "Update app now"}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold text-base transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" aria-hidden />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" aria-hidden />
                      Update Now
                    </>
                  )}
                </motion.button>

                {/* Only show dismiss for non-required updates */}
                {!required && (
                  <button
                    onClick={handleDismiss}
                    aria-label="Remind me later"
                    className="w-full px-6 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                  >
                    Remind Me Later
                  </button>
                )}

                {required && (
                  <p className="text-xs text-white/40 text-center">
                    This update is required to continue using the app
                  </p>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export const RequiredUpdatePrompt = memo(RequiredUpdatePromptComponent);
export default RequiredUpdatePrompt;
