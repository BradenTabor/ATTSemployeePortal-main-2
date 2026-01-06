/**
 * PWAUpdatePrompt Component
 * 
 * Displays a prompt when a new service worker is available.
 * Allows users to update the app to the latest version.
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X, Download, Wifi } from 'lucide-react';
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

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  // Don't render if nothing to show
  if (!offlineReady && !needRefresh) {
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
            {offlineReady ? (
              // Offline ready message
              <>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                    <Wifi className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">
                      Ready for Offline Use
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      The app has been cached and works offline.
                    </p>
                  </div>
                  <button
                    onClick={close}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              // Update available message
              <>
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
                    className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => updateServiceWorker(true)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-medium transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Update Now
                  </motion.button>
                  <button
                    onClick={close}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                  >
                    Later
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export const PWAUpdatePrompt = memo(PWAUpdatePromptComponent);
export default PWAUpdatePrompt;

