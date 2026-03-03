/**
 * Draft Recovery Modal Component
 * 
 * A premium modal that appears when a user has an unsaved draft.
 * Allows them to restore or discard the draft.
 * 
 * @module DraftRecoveryModal
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Clock, Trash2, RotateCcw } from 'lucide-react';
import type { DraftData } from '../../hooks/useFormPersistence';
import attsLogoStamped from '../../assets/ATTS_Logo_stamped.png';
import { useModalOverlay } from '../../hooks/useModalOverlay';

interface DraftRecoveryModalProps<T> {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** The draft data */
  draft: DraftData<T> | null;
  /** Form type for display */
  formType: 'jsa' | 'dvir' | 'equipment' | 'near_miss' | 'tree_felling_jsa';
  /** Callback when user chooses to restore */
  onRestore: () => void;
  /** Callback when user chooses to discard */
  onDiscard: () => void;
}

const FORM_LABELS = {
  jsa: 'Job Safety Analysis',
  dvir: 'Vehicle Inspection',
  equipment: 'Equipment Inspection',
  near_miss: 'Near-Miss Report',
  tree_felling_jsa: 'Tree Felling JSA',
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DraftRecoveryModal<T>({
  isOpen,
  draft,
  formType,
  onRestore,
  onDiscard,
}: DraftRecoveryModalProps<T>) {
  const savedAt = draft?.savedAt ? new Date(draft.savedAt) : null;
  const { modalRef, zIndex } = useModalOverlay({ isOpen, onClose: onDiscard, zIndex: 100 });
  const [logoEntranceDone, setLogoEntranceDone] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => setLogoEntranceDone(true), 480);
    return () => clearTimeout(t);
  }, [isOpen]);

  if (!isOpen || !draft) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-hidden
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDiscard}
        />

        {/* Modal */}
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="draft-recovery-modal-title"
          className="relative w-full max-w-sm bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
            {/* Glow accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-emerald-500/20 blur-3xl pointer-events-none" />

            {/* Content */}
            <div className="relative p-5">
              {/* Icon — 3× size, premium in/out motion */}
              <div className="flex justify-center mb-5">
                <motion.div
                  className="w-[128px] h-[128px] rounded-2xl flex items-center justify-center overflow-hidden bg-transparent"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={
                    logoEntranceDone
                      ? { scale: [1, 1.06, 1], opacity: 0.95 }
                      : { scale: 1, opacity: 0.95 }
                  }
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={
                    logoEntranceDone
                      ? {
                          scale: { duration: 2.2, repeat: Infinity, repeatDelay: 0.6 },
                          opacity: { duration: 0 },
                        }
                      : {
                          type: 'spring',
                          stiffness: 280,
                          damping: 22,
                          mass: 0.85,
                        }
                  }
                >
                  <img
                    src={attsLogoStamped}
                    alt=""
                    className="w-[120px] h-[120px] object-contain brightness-0 invert opacity-95"
                    aria-hidden
                  />
                </motion.div>
              </div>

              {/* Title */}
              <h3 id="draft-recovery-modal-title" className="text-lg font-bold text-white text-center mb-1">
                Resume Draft?
              </h3>

              {/* Subtitle */}
              <p className="text-sm text-white/60 text-center mb-4">
                You have an unsaved {FORM_LABELS[formType]} draft.
              </p>

              {/* Draft info card */}
              <div className="bg-white/5 rounded-xl border border-white/10 p-3 mb-5">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Last saved: {savedAt ? formatTimeAgo(savedAt) : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-emerald-300/70">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <span>
                    Step {draft.currentStep} of 6 • {draft.completedSteps.length} steps completed
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                {/* Discard */}
                <button
                  onClick={onDiscard}
                  aria-label="Discard draft and start fresh"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/70 hover:text-white transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <Trash2 className="w-4 h-4" aria-hidden />
                  Start Fresh
                </button>

                {/* Restore */}
                <button
                  onClick={onRestore}
                  aria-label="Restore draft"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-emerald-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden />
                  Restore
                </button>
              </div>
            </div>
          </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

export default DraftRecoveryModal;
