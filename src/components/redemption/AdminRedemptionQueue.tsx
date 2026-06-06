import { memo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Gift, X } from 'lucide-react';
import type { AdminRedemptionRow, RedemptionStatus } from '@/types/redemption';
import { REDEMPTION_STATUS_LABELS } from '@/lib/redemptionCopy';
import { glass } from '@/lib/glass';

interface AdminActionNoteDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  note: string;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLoading: boolean;
}

function AdminActionNoteDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  note,
  onNoteChange,
  onConfirm,
  onCancel,
  confirmLoading,
}: AdminActionNoteDialogProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            className={`relative w-full max-w-sm p-6 ${glass.elevated}`}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            role="alertdialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" aria-hidden />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="text-sm text-gray-400 mt-1">{description}</p>
              </div>
            </div>
            <label className="block text-xs text-white/50 mb-1" htmlFor="fulfillment-note">
              Optional note
            </label>
            <input
              id="fulfillment-note"
              type="text"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="e.g. Picked up at office"
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-900 border border-white/10 text-white placeholder:text-white/30 mb-5"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={confirmLoading}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-white/[0.04] border border-white/10 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg disabled:opacity-50"
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

type ActionType = 'fulfill' | 'deny';

interface AdminRedemptionQueueProps {
  pending: AdminRedemptionRow[];
  history: AdminRedemptionRow[];
  statusFilter: RedemptionStatus | 'all';
  onStatusFilterChange: (filter: RedemptionStatus | 'all') => void;
  onFulfill: (redemptionId: string, note?: string) => void;
  onDeny: (redemptionId: string, note?: string) => void;
  actionLoading: boolean;
  actionError: string | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  });
}

const FILTER_OPTIONS: { value: RedemptionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'denied', label: 'Denied' },
  { value: 'canceled', label: 'Canceled' },
];

export const AdminRedemptionQueue = memo(function AdminRedemptionQueue({
  pending,
  history,
  statusFilter,
  onStatusFilterChange,
  onFulfill,
  onDeny,
  actionLoading,
  actionError,
}: AdminRedemptionQueueProps) {
  const [actionTarget, setActionTarget] = useState<{
    row: AdminRedemptionRow;
    type: ActionType;
  } | null>(null);
  const [note, setNote] = useState('');

  const handleConfirmAction = () => {
    if (!actionTarget) return;
    if (actionTarget.type === 'fulfill') {
      onFulfill(actionTarget.row.id, note);
    } else {
      onDeny(actionTarget.row.id, note);
    }
    setActionTarget(null);
    setNote('');
  };

  return (
    <div className="space-y-6" data-testid="admin-redemption-queue">
      {/* Pending queue */}
      <section aria-labelledby="pending-queue-heading">
        <h2 id="pending-queue-heading" className="text-lg font-semibold text-white mb-3">
          Pending requests
          {pending.length > 0 && (
            <span className="ml-2 text-sm font-normal text-[#f4c979]">({pending.length})</span>
          )}
        </h2>

        {pending.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-white/50 text-sm">No pending redemption requests.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((row, index) => (
              <motion.li
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-xl border border-[#f4c979]/20 bg-white/[0.03] p-4"
                data-testid={`admin-pending-${row.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#f4c979]/10 flex items-center justify-center flex-shrink-0">
                      <Gift className="w-5 h-5 text-[#f4c979]" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white">{row.item_name}</p>
                      <p className="text-sm text-white/60 truncate">
                        {row.requester_name || row.requester_email || 'Unknown user'}
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        {row.point_cost} pts · {formatDateTime(row.requested_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setNote('');
                        setActionTarget({ row, type: 'fulfill' });
                      }}
                      disabled={actionLoading}
                      className="flex-1 sm:flex-none px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
                      data-testid={`fulfill-${row.id}`}
                    >
                      <Check className="w-3.5 h-3.5 inline mr-1" aria-hidden />
                      Fulfill
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNote('');
                        setActionTarget({ row, type: 'deny' });
                      }}
                      disabled={actionLoading}
                      className="flex-1 sm:flex-none px-3 py-2 text-xs font-semibold rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      data-testid={`deny-${row.id}`}
                    >
                      <X className="w-3.5 h-3.5 inline mr-1" aria-hidden />
                      Deny
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      {/* History */}
      <section aria-labelledby="history-queue-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 id="history-queue-heading" className="text-lg font-semibold text-white">
            Recent history
          </h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusFilterChange(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-[#f4c979]/15 border-[#f4c979]/30 text-[#f4c979]'
                    : 'border-white/10 text-white/50 hover:text-white/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-white/50 text-sm">No matching redemption history.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                data-testid={`admin-history-${row.id}`}
              >
                <span className="text-white font-medium">{row.item_name}</span>
                <span className="text-white/50 truncate">
                  {row.requester_name || row.requester_email}
                </span>
                <span className="text-[#f4c979]">{row.point_cost} pts</span>
                <span className="text-white/40 text-xs">{REDEMPTION_STATUS_LABELS[row.status]}</span>
                <span className="text-white/30 text-xs ml-auto">
                  {formatDateTime(row.decided_at ?? row.requested_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {actionError && (
        <p className="text-sm text-red-300" role="alert">
          {actionError}
        </p>
      )}

      {actionTarget && (
        <AdminActionNoteDialog
          isOpen={!!actionTarget}
          title={
            actionTarget.type === 'fulfill'
              ? 'Fulfill redemption?'
              : 'Deny redemption?'
          }
          description={
            actionTarget.type === 'fulfill'
              ? `Mark ${actionTarget.row.item_name} as handed over to ${actionTarget.row.requester_name || 'the requester'}? This is final — points stay deducted.`
              : `Deny ${actionTarget.row.item_name} for ${actionTarget.row.requester_name || 'the requester'}? Their ${actionTarget.row.point_cost} points will be refunded.`
          }
          confirmLabel={actionTarget.type === 'fulfill' ? 'Mark fulfilled' : 'Deny & refund'}
          note={note}
          onNoteChange={setNote}
          onConfirm={handleConfirmAction}
          onCancel={() => {
            setActionTarget(null);
            setNote('');
          }}
          confirmLoading={actionLoading}
        />
      )}
    </div>
  );
});
