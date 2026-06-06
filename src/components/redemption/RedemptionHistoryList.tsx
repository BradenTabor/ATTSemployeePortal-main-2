import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Gift, XCircle } from 'lucide-react';
import type { RedemptionWithItem } from '@/types/redemption';
import {
  REDEMPTION_STATUS_LABELS,
  REDEMPTION_STATUS_MEANINGS,
} from '@/lib/redemptionCopy';
import { RedemptionConfirmDialog } from './RedemptionConfirmDialog';

interface RedemptionHistoryListProps {
  redemptions: RedemptionWithItem[];
  onCancel: (redemptionId: string) => void;
  cancelLoading: boolean;
  cancelError: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  approved: 'text-blue-300 bg-blue-500/10 border-blue-500/25',
  fulfilled: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  denied: 'text-red-300 bg-red-500/10 border-red-500/25',
  canceled: 'text-white/50 bg-white/5 border-white/10',
};

export const RedemptionHistoryList = memo(function RedemptionHistoryList({
  redemptions,
  onCancel,
  cancelLoading,
  cancelError,
}: RedemptionHistoryListProps) {
  const [cancelTarget, setCancelTarget] = useState<RedemptionWithItem | null>(null);

  if (redemptions.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <Clock className="w-10 h-10 text-white/20 mx-auto mb-3" aria-hidden />
        <p className="text-white/60 text-sm">No redemption requests yet.</p>
        <p className="text-white/40 text-xs mt-1">Your requests and their status will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3" data-testid="redemption-history-list">
        {redemptions.map((row, index) => (
          <motion.li
            key={row.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            data-testid={`redemption-row-${row.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f4c979]/10 flex items-center justify-center flex-shrink-0">
                <Gift className="w-5 h-5 text-[#f4c979]" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white truncate">{row.item_name}</p>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[row.status] ?? STATUS_COLORS.canceled}`}
                    data-testid={`redemption-status-${row.id}`}
                  >
                    {REDEMPTION_STATUS_LABELS[row.status]}
                  </span>
                </div>
                <p className="text-xs text-white/50 mt-1" data-testid={`redemption-meaning-${row.id}`}>
                  {REDEMPTION_STATUS_MEANINGS[row.status]}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-white/40">
                  <span>{row.point_cost} pts</span>
                  <span>Requested {formatDate(row.requested_at)}</span>
                  {row.decided_at && (
                    <span>Updated {formatDate(row.decided_at)}</span>
                  )}
                </div>
              </div>
              {row.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => setCancelTarget(row)}
                  disabled={cancelLoading}
                  className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-red-300 border border-red-500/25 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  data-testid={`cancel-redemption-${row.id}`}
                >
                  <XCircle className="w-3.5 h-3.5 inline mr-1" aria-hidden />
                  Cancel
                </button>
              )}
            </div>
          </motion.li>
        ))}
      </ul>

      {cancelError && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {cancelError}
        </p>
      )}

      <RedemptionConfirmDialog
        isOpen={!!cancelTarget}
        title="Cancel redemption?"
        description={`Cancel your request for ${cancelTarget?.item_name}? Your ${cancelTarget?.point_cost} points will be refunded.`}
        confirmLabel="Cancel request"
        onConfirm={() => {
          if (cancelTarget) {
            onCancel(cancelTarget.id);
            setCancelTarget(null);
          }
        }}
        onCancel={() => setCancelTarget(null)}
        confirmLoading={cancelLoading}
      />
    </>
  );
});
