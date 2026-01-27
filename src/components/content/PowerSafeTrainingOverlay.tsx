/**
 * PowerSafeTrainingOverlay
 *
 * Full-page overlay displaying Power Safe Training instructions and iLevel LMS link.
 * Accessible: Escape to close, click-outside to close, scroll lock when open.
 * No access restrictions - available to all users on Resources page.
 * Optimized for mobile screens.
 */

import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Shield, CheckCircle2, Copy, Check, StickyNote } from 'lucide-react';
import { useModalOverlay } from '../../hooks/useModalOverlay';

interface PowerSafeTrainingOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onPinStickyNote?: () => void;
}

const TRAINING_COURSES = [
  'T&D Baseline',
  'Human Performance',
  'Active Shooter Awareness',
  'T&D Annual Specifics',
  'Observe/Spotter',
  'Temporary Traffic Control',
  'Vegetation Specifics',
];

const USERNAME = 'attsinc';
const PASSWORD = 'employeetrain';
const TRAINING_URL = 'https://training.ilevel.org/Applications/AllianceLMS/Login';

// Detect if device is mobile
function useIsMobile() {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);
}

function CopyButton({ text, label, compact = false }: { text: string; label: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center gap-1 rounded-md bg-purple-500/20 border border-purple-400/30 text-purple-200 font-medium hover:bg-purple-500/30 hover:border-purple-400/50 active:scale-95 transition-all touch-manipulation focus-visible:outline focus-visible:ring-2 focus-visible:ring-purple-400 ${
        compact ? 'px-2 py-1 text-[10px] min-w-[52px]' : 'px-2.5 py-1.5 text-xs'
      }`}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <>
          <Check className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} style={{ color: '#4ade80' }} />
          {!compact && <span style={{ color: '#4ade80' }}>Copied!</span>}
        </>
      ) : (
        <>
          <Copy className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          {!compact && <span>Copy</span>}
        </>
      )}
    </button>
  );
}

export function PowerSafeTrainingOverlay({ isOpen, onClose, onPinStickyNote }: PowerSafeTrainingOverlayProps) {
  const isMobile = useIsMobile();
  const { modalRef, zIndex } = useModalOverlay({ isOpen, onClose, zIndex: 100 });

  const handlePinAndOpen = useCallback(() => {
    if (isMobile) {
      // On mobile, just open in new tab (popups don't work well)
      window.open(TRAINING_URL, '_blank');
    } else {
      // On desktop, open popup window
      const width = Math.min(1200, Math.floor(window.screen.width * 0.65));
      const height = Math.min(900, Math.floor(window.screen.height * 0.85));
      const left = window.screen.width - width - 20;
      const top = Math.floor((window.screen.height - height) / 2);
      const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=yes,resizable=yes,scrollbars=yes`;
      window.open(TRAINING_URL, 'PowerSafeTraining', features);
    }
    onPinStickyNote?.();
  }, [onPinStickyNote, isMobile]);

  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-md"
        style={{ zIndex }}
        onClick={onClose}
        aria-hidden
      >
        {/* Modal container - slides up on mobile like a bottom sheet */}
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="power-safe-title"
          initial={{ opacity: 0, y: isMobile ? '100%' : 60, scale: isMobile ? 1 : 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isMobile ? '100%' : 40, scale: isMobile ? 1 : 0.97 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full sm:max-w-xl max-h-[95vh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border-t sm:border border-purple-400/30 shadow-[0_-8px_40px_-10px_rgba(139,92,246,0.4)]"
          style={{
            background: 'linear-gradient(145deg, rgba(30, 10, 40, 0.99) 0%, rgba(15, 5, 25, 1) 50%, rgba(5, 2, 10, 1) 100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
            {/* Glow border effect - hidden on mobile for performance */}
            <div className="hidden sm:block absolute -inset-[1px] rounded-[inherit] bg-gradient-to-br from-purple-400/40 via-pink-500/20 to-blue-500/30 opacity-50 blur-[1px] pointer-events-none" />

            {/* Top shine line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-300/70 to-transparent" />

            {/* Mobile drag handle */}
            <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30 z-10" />

            {/* Floating orbs - hidden on mobile for performance */}
            <motion.div
              className="hidden sm:block absolute w-64 h-64 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
                top: '-15%',
                left: '-10%',
                filter: 'blur(40px)',
              }}
              animate={{ x: [0, 20, 0], y: [0, 15, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Header - more compact on mobile */}
            <div className="relative flex items-center justify-between px-4 pt-5 pb-3 sm:px-5 sm:pt-5 sm:pb-4 border-b border-purple-500/20 bg-purple-900/10 flex-shrink-0">
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border border-purple-300/50 text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-purple-100 bg-gradient-to-r from-purple-500/25 via-pink-400/15 to-blue-500/25 backdrop-blur-sm">
                    <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-200" />
                    TRAINING
                  </span>
                </div>
                <h2
                  id="power-safe-title"
                  className="text-base sm:text-lg font-black leading-tight"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #e9d5ff 50%, #c4b5fd 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Power Safe Training
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border border-purple-500/30 text-purple-200/70 flex items-center justify-center hover:bg-purple-500/15 hover:text-purple-100 active:scale-95 transition-all touch-manipulation flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden />
              </button>
            </div>

            {/* Content - Scrollable, compact on mobile */}
            <div className="relative flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 max-h-[calc(95vh-140px)] sm:max-h-[calc(85vh-160px)]">
              {/* Action buttons */}
              <div className="mb-4 sm:mb-5 space-y-2 sm:space-y-3">
                <a
                  href={TRAINING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-center gap-2 w-full py-3 sm:py-3.5 px-4 rounded-lg sm:rounded-xl text-white font-bold text-sm sm:text-base shadow-lg transition-all duration-300 hover:scale-[1.02] focus-visible:outline focus-visible:ring-2 focus-visible:ring-purple-400"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 25%, #ec4899 50%, #3b82f6 75%, #7c3aed 100%)',
                    backgroundSize: '200% 200%',
                    animation: 'pulse-gradient 4s ease-in-out infinite',
                  }}
                >
                  <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                  Open Training Portal
                </a>
                
                {onPinStickyNote && (
                  <button
                    type="button"
                    onClick={handlePinAndOpen}
                    className="flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 px-3 rounded-lg bg-purple-500/15 border border-purple-400/25 text-purple-200 text-xs sm:text-sm font-medium hover:bg-purple-500/25 active:scale-[0.98] transition-all touch-manipulation"
                  >
                    <StickyNote className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {isMobile ? 'Open + Show Credentials' : 'Open Portal + Pin Credentials'}
                  </button>
                )}
              </div>

              {/* Credentials box - compact */}
              <div className="mb-4 sm:mb-5 p-3 rounded-lg bg-purple-500/10 border border-purple-400/20">
                <p className="text-[10px] sm:text-xs font-bold text-purple-300/80 uppercase tracking-wider mb-2">Login Credentials</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs sm:text-sm">
                      <span className="text-purple-300/70">User:</span>{' '}
                      <span className="text-white font-semibold">{USERNAME}</span>
                    </span>
                    <CopyButton text={USERNAME} label="username" compact={isMobile} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs sm:text-sm">
                      <span className="text-purple-300/70">Pass:</span>{' '}
                      <span className="text-white font-semibold">{PASSWORD}</span>
                    </span>
                    <CopyButton text={PASSWORD} label="password" compact={isMobile} />
                  </div>
                </div>
              </div>

              {/* Instructions - compact numbered list */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-[10px] sm:text-xs font-bold text-purple-200/80 uppercase tracking-wider">
                  Steps
                </h3>
                
                <ol className="space-y-2 sm:space-y-2.5 text-white/85 text-xs sm:text-sm">
                  <li className="flex gap-2 sm:gap-3">
                    <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-[10px] sm:text-xs font-bold text-purple-300">1</span>
                    <span className="pt-0.5">Click the link above to open iLevel LMS.</span>
                  </li>
                  <li className="flex gap-2 sm:gap-3">
                    <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-[10px] sm:text-xs font-bold text-purple-300">2</span>
                    <span className="pt-0.5">Click <strong className="text-purple-200">Login</strong> (top right).</span>
                  </li>
                  <li className="flex gap-2 sm:gap-3">
                    <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-[10px] sm:text-xs font-bold text-purple-300">3</span>
                    <span className="pt-0.5">Select <strong className="text-purple-200">"Take web-based training"</strong>.</span>
                  </li>
                  <li className="flex gap-2 sm:gap-3">
                    <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-[10px] sm:text-xs font-bold text-purple-300">4</span>
                    <span className="pt-0.5">Enter credentials above, click <strong className="text-purple-200">"Open curriculum"</strong>.</span>
                  </li>
                  <li className="flex gap-2 sm:gap-3">
                    <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-[10px] sm:text-xs font-bold text-purple-300">5</span>
                    <span className="pt-0.5">Enter your social security number.</span>
                  </li>
                  <li className="flex gap-2 sm:gap-3">
                    <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-[10px] sm:text-xs font-bold text-purple-300">6</span>
                    <div className="flex-1 pt-0.5">
                      <span className="block mb-2">Complete these courses:</span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {TRAINING_COURSES.map((course, index) => (
                          <div
                            key={course}
                            className="flex items-center gap-1.5 py-1.5 px-2 sm:px-2.5 rounded bg-purple-500/10 border border-purple-400/10"
                          >
                            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400/60 flex-shrink-0" />
                            <span className="text-[11px] sm:text-xs text-white/80">
                              <span className="text-purple-300/70">{index + 1}.</span> {course}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-2 sm:gap-3">
                    <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-[10px] sm:text-xs font-bold text-purple-300">7</span>
                    <span className="pt-0.5">Exit when all are completed.</span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Footer - minimal on mobile */}
            <div className="relative px-4 py-3 sm:px-5 sm:py-4 border-t border-purple-500/20 bg-purple-900/5 flex-shrink-0">
              <p className="text-[9px] sm:text-[10px] text-white/25 text-center">
                Tap outside or press ESC to close
              </p>
            </div>
          </motion.div>
        </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

/**
 * PowerSafeStickyNote - Premium floating credentials widget
 */
interface PowerSafeStickyNoteProps {
  isVisible: boolean;
  onClose: () => void;
}

// Inline copy field with tap-to-copy functionality
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex items-center gap-2 w-full p-2 rounded-lg bg-white/5 border border-purple-400/20 hover:bg-purple-500/10 hover:border-purple-400/40 active:scale-[0.98] transition-all touch-manipulation text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-purple-300/60 font-medium mb-0.5">{label}</p>
        <p className="font-mono text-sm text-white font-semibold truncate">{value}</p>
      </div>
      <div className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
        copied 
          ? 'bg-green-500/20 text-green-400' 
          : 'bg-purple-500/20 text-purple-300 group-hover:bg-purple-500/30'
      }`}>
        {copied ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </div>
    </button>
  );
}

export function PowerSafeStickyNote({ isVisible, onClose }: PowerSafeStickyNoteProps) {
  const isMobile = useIsMobile();

  const handleOpenPortal = useCallback(() => {
    if (isMobile) {
      window.open(TRAINING_URL, '_blank');
    } else {
      const width = Math.min(1200, Math.floor(window.screen.width * 0.65));
      const height = Math.min(900, Math.floor(window.screen.height * 0.85));
      const left = window.screen.width - width - 20;
      const top = Math.floor((window.screen.height - height) / 2);
      const features = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=yes,resizable=yes,scrollbars=yes`;
      window.open(TRAINING_URL, 'PowerSafeTraining', features);
    }
  }, [isMobile]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed bottom-20 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-auto z-40 sm:w-64 rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(165deg, rgba(45, 20, 60, 0.97) 0%, rgba(25, 10, 35, 0.98) 100%)',
            boxShadow: '0 20px 50px -12px rgba(139, 92, 246, 0.35), 0 0 0 1px rgba(139, 92, 246, 0.2)',
          }}
        >
          {/* Animated gradient border */}
          <div 
            className="absolute inset-0 rounded-[inherit] pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(236,72,153,0.2) 50%, rgba(59,130,246,0.3) 100%)',
              padding: '1px',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'xor',
              WebkitMaskComposite: 'xor',
            }}
          />
          
          {/* Top accent line */}
          <div className="absolute top-0 left-4 right-4 h-[2px] bg-gradient-to-r from-purple-500/0 via-purple-400/60 to-purple-500/0" />

          {/* Header */}
          <div className="relative flex items-center justify-between px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/20 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-purple-200" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide">Power Safe</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded-lg text-purple-300/60 flex items-center justify-center hover:bg-white/10 hover:text-white active:scale-90 transition-all touch-manipulation"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="relative px-3.5 pb-3.5 space-y-2">
            {/* Credentials - tap to copy */}
            <CopyField label="Username" value={USERNAME} />
            <CopyField label="Password" value={PASSWORD} />

            {/* Open portal button */}
            <button
              type="button"
              onClick={handleOpenPortal}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:ring-2 focus-visible:ring-purple-400 mt-1"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 40%, #ec4899 100%)',
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Training Portal
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PowerSafeTrainingOverlay;
