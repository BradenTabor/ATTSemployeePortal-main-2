import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Trophy } from 'lucide-react';
import { glass } from '@/lib/glass';
import type { RewardCatalogItem } from '@/types/redemption';

interface RedeemConfirmModalProps {
  isOpen: boolean;
  item: RewardCatalogItem | null;
  balance: number;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RedeemConfirmModal({
  isOpen,
  item,
  balance,
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}: RedeemConfirmModalProps) {
  if (typeof document === 'undefined' || !item) return null;

  const resultingBalance = balance - item.point_cost;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={!isSubmitting ? onCancel : undefined}
          />

          <motion.div
            className={`relative w-full max-w-md p-6 ${glass.elevated}`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="redeem-modal-title"
            data-testid="redeem-confirm-modal"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#f4c979]/15 flex items-center justify-center">
                {item.image_url ? (
                  <img src={item.image_url} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Gift className="w-6 h-6 text-[#f4c979]" aria-hidden />
                )}
              </div>
              <div>
                <h2 id="redeem-modal-title" className="text-lg font-semibold text-white">
                  Confirm redemption
                </h2>
                <p className="text-sm text-white/50">{item.name}</p>
              </div>
            </div>

            <div className="space-y-2 mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Cost</span>
                <span className="font-semibold text-[#f4c979]">{item.point_cost} pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Current balance</span>
                <span className="text-white flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" aria-hidden />
                  {balance} pts
                </span>
              </div>
              <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                <span className="text-white/50">Balance after</span>
                <span className="font-semibold text-white">{resultingBalance} pts</span>
              </div>
            </div>

            <p className="text-xs text-white/40 mb-4">
              Points are held immediately. An admin will fulfill your request or refund you if denied.
            </p>

            {error && (
              <p className="text-sm text-red-300 mb-4" role="alert" data-testid="redeem-error">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-white/[0.04] border border-white/10 rounded-lg hover:bg-white/[0.08] transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-[#2d1c04] bg-gradient-to-r from-[#f4c979] to-[#d89d3e] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="redeem-confirm-button"
              >
                {isSubmitting ? 'Redeeming…' : 'Confirm redemption'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
