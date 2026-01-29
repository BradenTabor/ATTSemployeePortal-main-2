/**
 * PWAUpdatePrompt Component
 * 
 * Displays a prompt when a new service worker update is available.
 * Allows users to update the app to the latest version.
 * 
 * Note: "Ready for Offline Use" notification is disabled - only shows update prompts.
 */

import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Download } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface PWAUpdatePromptProps {
  /** Position of the prompt */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

function PWAUpdatePromptComponent({ position = 'bottom-right' }: PWAUpdatePromptProps) {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('[PWA] Service worker registered:', registration);
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error);
    },
  });

  // Auto-dismiss the offline ready notification (we don't want to show it)
  useEffect(() => {
    if (offlineReady) {
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  const close = () => {
    setNeedRefresh(false);
  };

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  // Only show when there's an update available (not for offline ready)
  if (!needRefresh) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed ${positionClasses[position]} z-50 max-w-sm`}
      >
        <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
          {/* Header gradient */}
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500" />
          
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">
                  Update Available
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  A new version of ATTS Portal is ready.
                </p>
              </div>
              <button
                onClick={close}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                aria-label="Dismiss update prompt"
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
            
            <div className="flex gap-2">
              <motion.button
                onClick={() => updateServiceWorker(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                aria-label="Update app now"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                <RefreshCw className="w-4 h-4" aria-hidden />
                Update Now
              </motion.button>
              <button
                onClick={close}
                aria-label="Remind me later"
                className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export const PWAUpdatePrompt = memo(PWAUpdatePromptComponent);
export default PWAUpdatePrompt;

