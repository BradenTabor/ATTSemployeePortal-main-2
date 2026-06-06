import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Trophy } from 'lucide-react';
import { glass } from '@/lib/glass';
import { Z } from '@/lib/zIndex';
import type { RewardCatalogItem } from '@/types/redemption';

const modalTransition = { duration: 0.2 };

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
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: Z.modal }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={modalTransition}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={!isSubmitting ? onCancel : undefined}
            aria-hidden
          />

          <motion.div
            className={`relative w-full max-w-md p-6 ${glass.elevated}`}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={modalTransition}
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

            <div className={`space-y-2 mb-5 rounded-xl p-4 ${glass.subtle} border-[#f4c979]/10`}>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Cost</span>
                <span className="font-semibold text-[#f4c979] tabular-nums">{item.point_cost} pts</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Current balance</span>
                <span className="text-white flex items-center gap-1 tabular-nums">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" aria-hidden />
                  {balance} pts
                </span>
              </div>
              <div className="border-t border-white/[0.06] pt-2 flex justify-between text-sm">
                <span className="text-white/60">Balance after</span>
                <span className="font-semibold text-white tabular-nums">{resultingBalance} pts</span>
              </div>
            </div>

            <p className="text-xs text-white/50 mb-4 leading-relaxed">
              Points are held immediately. An admin will fulfill your request or refund you if denied.
            </p>

            {error && (
              <div className="mb-4 rounded-xl border border-red-500/25 bg-red-950/40 p-3" role="alert">
                <p className="text-sm text-red-200" data-testid="redeem-error">
                  {error}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-white/[0.08] rounded-lg hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-[#2d1c04] bg-gradient-to-r from-[#f4c979] to-[#d89d3e] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
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
