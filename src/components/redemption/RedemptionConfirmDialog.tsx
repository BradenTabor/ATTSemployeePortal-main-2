import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { glass } from '@/lib/glass';

interface RedemptionConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RedemptionConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmDisabled = false,
  confirmLoading = false,
  onConfirm,
  onCancel,
}: RedemptionConfirmDialogProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={`relative w-full max-w-sm p-6 ${glass.elevated}`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="redemption-confirm-title"
            aria-describedby="redemption-confirm-desc"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" aria-hidden />
              </div>
              <div>
                <h3 id="redemption-confirm-title" className="text-base font-semibold text-white">
                  {title}
                </h3>
                <p id="redemption-confirm-desc" className="text-sm text-gray-400 mt-1">
                  {description}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={onCancel}
                disabled={confirmLoading}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-white/[0.04] border border-white/10 rounded-lg hover:bg-white/[0.08] transition-colors disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmDisabled || confirmLoading}
                className="px-4 py-2 text-sm font-medium text-[#2d1c04] bg-gradient-to-r from-[#f4c979] to-[#d89d3e] hover:from-[#f6dcb2] hover:to-[#f4c979] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmLoading ? 'Processing…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
