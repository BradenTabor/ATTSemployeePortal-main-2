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

import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, Shield, Zap, TreePine } from 'lucide-react';
import { useAppUpdate } from '../../hooks/useAppUpdate';
import { createPortal } from 'react-dom';
import { APP_VERSION } from '../../lib/appVersion';
import { Z } from "@/lib/zIndex";

interface RequiredUpdatePromptProps {
  /** Whether to require update (can't dismiss) - default true */
  required?: boolean;
  /** Test mode bypasses service worker check for visual verification */
  testMode?: boolean;
}

function RequiredUpdatePromptComponent({ required = true, testMode = false }: RequiredUpdatePromptProps) {
  const updates = useAppUpdate();
  const [testModeVisible, setTestModeVisible] = useState(testMode);
  const [dismissed, setDismissed] = useState(false);
  const needRefresh = updates.available && !dismissed;
  const isUpdating = updates.updating;
  const updateError = updates.error;
  const handleUpdate = useCallback(() => {
    if (testMode) setTestModeVisible(false);
    else updates.applyUpdate();
  }, [testMode, updates]);
  const handleDismiss = useCallback(() => {
    if (!required) {
      setTestModeVisible(false);
      setDismissed(true);
    }
  }, [required]);

  // Only show when there's an update available (or in test mode)
  if (!needRefresh && !testModeVisible) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      <motion.div style={{ zIndex: Z.modal }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center"
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
          <div className="relative rounded-leaf border border-emerald-500/30 bg-gradient-to-br from-[#121A15] via-[#121A15] to-[#0B100D] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_100px_rgba(47,164,90,0.1)] overflow-hidden">
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
                  <div className="w-24 h-24 rounded-leaf-sm bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center overflow-hidden shadow-lg shadow-emerald-500/20">
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
                    className="absolute inset-0 rounded-leaf-sm border-2 border-emerald-400/50"
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
    </AnimatePresence>,
    document.body,
  );
}

export const RequiredUpdatePrompt = memo(RequiredUpdatePromptComponent);
export default RequiredUpdatePrompt;
