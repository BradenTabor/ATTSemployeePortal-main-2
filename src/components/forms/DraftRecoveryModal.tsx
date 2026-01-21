/**
 * Draft Recovery Modal Component
 * 
 * A premium modal that appears when a user has an unsaved draft.
 * Allows them to restore or discard the draft.
 * 
 * @module DraftRecoveryModal
 */

import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Clock, Trash2, RotateCcw } from 'lucide-react';
import type { DraftData } from '../../hooks/useFormPersistence';

interface DraftRecoveryModalProps<T> {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** The draft data */
  draft: DraftData<T> | null;
  /** Form type for display */
  formType: 'jsa' | 'dvir' | 'equipment';
  /** Callback when user chooses to restore */
  onRestore: () => void;
  /** Callback when user chooses to discard */
  onDiscard: () => void;
}

const FORM_LABELS = {
  jsa: 'Job Safety Analysis',
  dvir: 'Vehicle Inspection',
  equipment: 'Equipment Inspection',
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

  return (
    <AnimatePresence>
      {isOpen && draft && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
            className="relative w-full max-w-sm bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Glow accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-emerald-500/20 blur-3xl pointer-events-none" />

            {/* Content */}
            <div className="relative p-5">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                  <FileText className="w-7 h-7 text-emerald-400" />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-white text-center mb-1">
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
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white/70 hover:text-white transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Start Fresh
                </button>

                {/* Restore */}
                <button
                  onClick={onRestore}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-emerald-900/30"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DraftRecoveryModal;
