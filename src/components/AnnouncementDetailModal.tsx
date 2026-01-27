import { memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Calendar, User } from 'lucide-react';
import { cn } from '../lib/utils';
import attsLogoStamped from '../assets/ATTS_Logo_stamped.png';
import { useModalOverlay } from '../hooks/useModalOverlay';

interface Announcement {
  id: string;
  title: string;
  message: string;
  author: string | null;
  date: string;
  created_at: string;
}

interface AnnouncementDetailModalProps {
  announcement: Announcement | null;
  isOpen: boolean;
  onClose: () => void;
  formatDate: (date: string) => string;
}

function AnnouncementDetailModalComponent({
  announcement,
  isOpen,
  onClose,
  formatDate,
}: AnnouncementDetailModalProps) {
  const { modalRef, zIndex } = useModalOverlay({ isOpen, onClose, zIndex: 100 });

  if (!announcement) return null;
  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md"
        style={{ zIndex }}
        onClick={onClose}
        aria-hidden
      >
        {/* Wrapper to position stamped logo relative to modal */}
        <div className="relative w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[85vh] m-3 sm:m-0">
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-detail-modal-title"
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={cn(
              'w-full rounded-2xl sm:rounded-3xl border border-emerald-400/30',
              'bg-gradient-to-br from-[#04150f] via-[#041812] to-[#03120c]',
              'shadow-lg shadow-emerald-900/25 overflow-hidden flex flex-col h-full sm:h-auto'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent pointer-events-none" />
            <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20 pointer-events-none" aria-hidden />

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 pt-6 pb-4 sm:px-6 sm:py-5 border-b border-emerald-500/20 bg-emerald-900/10 flex-shrink-0">
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-full bg-emerald-400/25 blur-md" />
                    <span className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-300/50 text-[10px] sm:text-xs font-bold tracking-[0.25em] text-emerald-100 bg-gradient-to-r from-emerald-500/25 via-emerald-400/15 to-emerald-500/25 shadow-lg shadow-emerald-500/15 backdrop-blur-sm">
                      <motion.div
                        animate={{ rotate: [0, 15, -15, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-200" />
                      </motion.div>
                      ANNOUNCEMENT
                    </span>
                  </div>
                </div>
                <h2
                  id="announcement-detail-modal-title"
                  className="text-lg sm:text-xl md:text-2xl font-black leading-tight mt-2"
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #d1fae5 50%, #a7f3d0 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {announcement.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl border border-emerald-500/30 text-emerald-200/70 flex items-center justify-center hover:bg-emerald-500/15 hover:border-emerald-400/50 hover:text-emerald-100 active:scale-95 transition-all touch-manipulation flex-shrink-0 min-w-[44px] min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                aria-label="Close announcement"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="relative flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 min-h-0">
              {/* Message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-[15px] sm:text-base md:text-lg text-white/85 leading-relaxed whitespace-pre-wrap"
              >
                {announcement.message}
              </motion.div>
            </div>

            {/* Footer - Author & Date */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative px-5 py-4 sm:px-6 sm:py-5 border-t border-emerald-500/20 bg-emerald-900/5 flex-shrink-0"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-emerald-400/40 to-emerald-600/40 blur-sm" />
                    <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-xl shadow-emerald-500/30 ring-2 ring-emerald-300/30">
                      {announcement.author ? announcement.author.charAt(0).toUpperCase() : 'A'}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-300/50 mb-0.5">
                      <User className="w-3 h-3" />
                      <span className="font-semibold tracking-wider uppercase">Originator</span>
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-white truncate">
                      {announcement.author || 'ATTS Leadership'}
                    </p>
                  </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 sm:self-start">
                  <Calendar className="w-4 h-4 text-emerald-400/70" />
                  <span className="text-xs sm:text-sm text-emerald-200/70 font-medium">
                    {formatDate(announcement.created_at)}
                  </span>
                </div>
              </div>

              {/* Close hint - hidden on mobile since there's an X button */}
              <p className="hidden sm:block text-[10px] sm:text-xs text-white/30 text-center mt-4">
                Tap outside or press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono">ESC</kbd> to close
              </p>
            </motion.div>

            </motion.div>

            {/* ATTS Stamped Logo - Overlays the modal like a real stamp */}
            {/* Positioned relative to modal wrapper, extending beyond modal boundaries */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute bottom-12 right-0 pointer-events-none z-[60] sm:bottom-16"
              style={{
                transform: 'translate(20%, 0)',
                filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4)) invert(1)',
              }}
            >
              <img
                src={attsLogoStamped}
                alt="ATTS"
                className="h-20 w-20 sm:h-28 sm:w-28 md:h-32 md:w-32 object-contain opacity-95"
              />
            </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

export const AnnouncementDetailModal = memo(AnnouncementDetailModalComponent);
export default AnnouncementDetailModal;

