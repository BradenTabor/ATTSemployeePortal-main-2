import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { glass } from '@/lib/glass';
import { Z } from '@/lib/zIndex';

const dialogTransition = { duration: 0.2 };

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
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: Z.modalNested }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={dialogTransition}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          />

          <motion.div
            className={`relative w-full max-w-sm p-6 ${glass.elevated}`}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={dialogTransition}
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
                <p id="redemption-confirm-desc" className="text-sm text-white/60 mt-1 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={onCancel}
                disabled={confirmLoading}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-white/[0.08] rounded-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmDisabled || confirmLoading}
                className="px-4 py-2 text-sm font-medium text-[#2d1c04] bg-gradient-to-r from-[#f4c979] to-[#d89d3e] hover:from-[#f6dcb2] hover:to-[#f4c979] rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
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
