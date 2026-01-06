/**
 * IOSInstallPrompt Component
 * 
 * A slide-up prompt for iOS Safari users with step-by-step installation instructions.
 * iOS Safari does NOT support the standard `beforeinstallprompt` event, so we must
 * provide manual installation guidance.
 * 
 * CRITICAL iOS REQUIREMENT:
 * Push notifications ONLY work when the PWA is installed to the home screen.
 * Safari browser tabs do NOT support Web Push.
 * 
 * Features:
 * - Detects iOS device and standalone mode
 * - Shows after user engagement (scroll) or 10-second fallback
 * - Persists "dismissed" state in localStorage
 * - Premium green theme matching ATTS portal design
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, Plus, Smartphone, ArrowUp } from 'lucide-react';

const DISMISSED_KEY = 'atts_ios_install_prompt_dismissed';

export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  // Detect iOS device
  const isIOS = typeof window !== 'undefined' && 
    /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

  // Check if running as installed PWA (standalone mode)
  const isInstalled = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );

  // Check if already dismissed
  const isDismissed = typeof localStorage !== 'undefined' && 
    localStorage.getItem(DISMISSED_KEY) === 'true';

  useEffect(() => {
    // Only show if: iOS + not installed + not dismissed
    if (!isIOS || isInstalled || isDismissed) return;

    let hasScrolled = false;
    let promptShown = false;

    const showPromptNow = () => {
      if (!promptShown) {
        promptShown = true;
        setShowPrompt(true);
      }
    };

    // Show after user scrolls (engagement signal)
    const handleScroll = () => {
      if (!hasScrolled && window.scrollY > 200) {
        hasScrolled = true;
        setTimeout(showPromptNow, 2000);
        window.removeEventListener('scroll', handleScroll);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Fallback: Show after 10 seconds if no scroll
    const fallbackTimer = setTimeout(() => {
      if (!hasScrolled) {
        showPromptNow();
      }
    }, 10000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(fallbackTimer);
    };
  }, [isIOS, isInstalled, isDismissed]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    setShowPrompt(false);
  }, []);

  // Don't render if not showing
  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
      >
        <div 
          className="max-w-md mx-auto relative overflow-hidden rounded-2xl border border-white/[0.15] shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)]"
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
          <div className="relative px-6 py-6">
            {/* Icon and heading */}
            <div className="flex items-center gap-4 mb-5">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20"
              >
                <Smartphone className="w-7 h-7 text-emerald-400" />
              </motion.div>
              <div>
                <motion.h3 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="text-lg font-bold text-white"
                >
                  Install ATTS Portal
                </motion.h3>
                <motion.p 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-white/60"
                >
                  Get notifications and quick access
                </motion.p>
              </div>
            </div>

            {/* Installation instructions */}
            <motion.div 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="space-y-3 mb-5"
            >
              <p className="text-sm text-white/80 font-medium">
                To enable push notifications on iOS:
              </p>
              
              <ol className="space-y-2.5">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/30">
                    1
                  </span>
                  <span className="flex-1 text-sm text-white/70">
                    Tap the{' '}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                      <Share className="w-3.5 h-3.5" />
                      Share
                    </span>{' '}
                    button in Safari
                  </span>
                </li>
                
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/30">
                    2
                  </span>
                  <span className="flex-1 text-sm text-white/70">
                    Scroll down and tap{' '}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/10 text-white/90 rounded border border-white/20">
                      <Plus className="w-3.5 h-3.5" />
                      Add to Home Screen
                    </span>
                  </span>
                </li>
                
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/30">
                    3
                  </span>
                  <span className="flex-1 text-sm text-white/70">
                    Tap <strong className="text-white">"Add"</strong> in the top right corner
                  </span>
                </li>
                
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/30">
                    4
                  </span>
                  <span className="flex-1 text-sm text-white/70">
                    Open the app from your home screen and enable notifications
                  </span>
                </li>
              </ol>
            </motion.div>

            {/* Visual hint - Safari share location */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-center gap-2 text-xs text-white/40 mb-4"
            >
              <ArrowUp className="w-4 h-4 animate-bounce" />
              <span>Share button is at the bottom of Safari</span>
              <ArrowUp className="w-4 h-4 animate-bounce" style={{ animationDelay: '0.1s' }} />
            </motion.div>

            {/* Actions */}
            <motion.div 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex gap-3"
            >
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white/60 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all"
              >
                Maybe Later
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl hover:from-emerald-400 hover:to-emerald-500 shadow-lg shadow-emerald-500/30 transition-all"
              >
                Got It!
              </button>
            </motion.div>
          </div>

          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default IOSInstallPrompt;


