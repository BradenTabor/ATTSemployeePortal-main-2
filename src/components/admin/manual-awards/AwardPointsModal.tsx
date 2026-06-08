import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useModalOverlay } from '../../../hooks/useModalOverlay';
import { Z } from '../../../lib/zIndex';
import {
  useAwardPoints,
  useAwarderBudgetHint,
} from '../../../hooks/queries/useManualAwards';
import {
  MANUAL_AWARD_CATEGORIES,
  MANUAL_AWARD_CATEGORY_LABELS,
  type ManualAwardCategory,
} from '../../../types/manualAwards';
import {
  AwardRecipientPicker,
  type AwardRecipient,
} from './AwardRecipientPicker';
import { AwardAmountPicker } from './AwardAmountPicker';

interface AwardPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-select recipient when opened from a user row */
  initialRecipient?: AwardRecipient | null;
}

type ModalPhase = 'form' | 'success';

export function AwardPointsModal({
  isOpen,
  onClose,
  initialRecipient = null,
}: AwardPointsModalProps) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const requestIdRef = useRef<string | null>(null);
  const { modalRef } = useModalOverlay({ isOpen, onClose, zIndex: Z.modal });

  const [phase, setPhase] = useState<ModalPhase>('form');
  const [recipient, setRecipient] = useState<AwardRecipient | null>(initialRecipient);
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<ManualAwardCategory>('good_performance');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [awardedAmount, setAwardedAmount] = useState(0);

  const { data: budgetHint, isLoading: budgetLoading } = useAwarderBudgetHint(
    user?.id,
    isAdmin
  );
  const awardMutation = useAwardPoints();

  // One request_id per modal open / award attempt — reused on retry, never regenerated mid-attempt.
  useEffect(() => {
    if (isOpen && !requestIdRef.current) {
      requestIdRef.current = crypto.randomUUID();
    }
    if (!isOpen) {
      requestIdRef.current = null;
      setPhase('form');
      setRecipient(null);
      setAmount(null);
      setCategory('good_performance');
      setReason('');
      setError(null);
      setAwardedAmount(0);
      awardMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset awardMutation only on close
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialRecipient) {
      setRecipient(initialRecipient);
    }
  }, [isOpen, initialRecipient]);

  const handleClose = useCallback(() => {
    if (awardMutation.isPending) return;
    onClose();
  }, [awardMutation.isPending, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recipient) {
      setError('Please select a recipient.');
      return;
    }
    if (amount === null || amount === 0) {
      setError('Select a point amount.');
      return;
    }
    if (amount < 0 && !isAdmin) {
      setError('Only admins can deduct points.');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required.');
      return;
    }
    if (!requestIdRef.current) {
      requestIdRef.current = crypto.randomUUID();
    }

    try {
      await awardMutation.mutateAsync({
        recipientId: recipient.user_id,
        amount,
        category,
        reason: reason.trim(),
        requestId: requestIdRef.current,
      });
      setAwardedAmount(amount);
      setPhase('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to award points.');
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ zIndex: Z.modal }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="award-points-title"
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#f4c979]/20 bg-gradient-to-b from-[#1b1914] to-[#0f0d0a] shadow-2xl"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#1b1914]/95 backdrop-blur">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#f4c979]" aria-hidden />
              <h2 id="award-points-title" className="text-lg font-bold text-[#fef3d1]">
                Award Points
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={awardMutation.isPending}
              className="p-2 rounded-lg text-[#c7b696] hover:text-white hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5">
            {phase === 'success' ? (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" aria-hidden />
                <p className="text-lg font-semibold text-white">
                  {awardedAmount < 0
                    ? `${Math.abs(awardedAmount)} point${Math.abs(awardedAmount) === 1 ? '' : 's'} deducted`
                    : `${awardedAmount} point${awardedAmount === 1 ? '' : 's'} awarded`}
                  !
                </p>
                <p className="text-sm text-[#c7b696]">
                  {recipient?.full_name || recipient?.email} will see updated totals shortly.
                </p>
                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-4 w-full py-3 rounded-xl bg-[#f4c979] text-[#2d1c04] font-semibold hover:bg-[#f6dcb2] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <AwardRecipientPicker
                  currentUserId={user?.id ?? ''}
                  selected={recipient}
                  onSelect={setRecipient}
                  disabled={awardMutation.isPending}
                />

                <div className="grid grid-cols-2 gap-3">
                  <AwardAmountPicker
                    value={amount}
                    onChange={setAmount}
                    isAdmin={isAdmin}
                    budgetHint={budgetHint}
                    disabled={awardMutation.isPending || budgetLoading}
                  />
                  <div>
                    <label
                      htmlFor="award-category"
                      className="text-xs font-medium text-[#f8e5bb]/70 uppercase tracking-wider"
                    >
                      Category
                    </label>
                    <select
                      id="award-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ManualAwardCategory)}
                      disabled={awardMutation.isPending}
                      className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-base focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      {MANUAL_AWARD_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {MANUAL_AWARD_CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isAdmin && budgetHint && !budgetLoading && (
                  <p className="text-xs text-[#c7b696] rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                    <span className="text-[#f4c979]/80 font-medium">Indicative budget: </span>
                    ~{budgetHint.remaining} of {budgetHint.monthlyBudget} pts remaining this month
                    (cap {budgetHint.perAwardCap}/award). Final limits enforced by the server.
                  </p>
                )}
                {isAdmin && (
                  <p className="text-xs text-[#c7b696]">
                    Admin awards are not capped — limits are enforced server-side for grant holders only.
                    Scroll to deduct points with negative presets.
                  </p>
                )}

                <div>
                  <label
                    htmlFor="award-reason"
                    className="text-xs font-medium text-[#f8e5bb]/70 uppercase tracking-wider"
                  >
                    Reason
                  </label>
                  <textarea
                    id="award-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    disabled={awardMutation.isPending}
                    placeholder={
                      amount !== null && amount < 0
                        ? 'Why are you deducting these points?'
                        : 'Why are you awarding these points?'
                    }
                    className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-white text-base resize-none focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                    required
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={awardMutation.isPending || amount === null}
                  className={
                    amount !== null && amount < 0
                      ? 'w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-bold disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400'
                      : 'w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#f4c979] to-[#d89d3e] text-[#2d1c04] font-bold disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400'
                  }
                >
                  {awardMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      {amount !== null && amount < 0 ? 'Deducting…' : 'Awarding…'}
                    </>
                  ) : amount !== null && amount < 0 ? (
                    'Deduct Points'
                  ) : (
                    'Award Points'
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
