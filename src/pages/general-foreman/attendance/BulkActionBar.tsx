import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users } from 'lucide-react';
import { cn } from '../../../lib/utils';
import ConfirmDialog from './ConfirmDialog';
import type { AttendanceStatus } from './types';
import { STATUS_CONFIG, ALL_STATUSES } from './types';

const BULK_CONFIRM_THRESHOLD = 5;

interface BulkActionBarProps {
  selectedCount: number;
  onApplyStatus: (status: AttendanceStatus) => void;
  onClearSelection: () => void;
}

export default function BulkActionBar({
  selectedCount,
  onApplyStatus,
  onClearSelection,
}: BulkActionBarProps) {
  const [pendingStatus, setPendingStatus] = useState<AttendanceStatus | null>(null);

  const handleStatusClick = (status: AttendanceStatus) => {
    if (selectedCount > BULK_CONFIRM_THRESHOLD) {
      setPendingStatus(status);
    } else {
      onApplyStatus(status);
    }
  };

  const handleConfirm = () => {
    if (pendingStatus) {
      onApplyStatus(pendingStatus);
      setPendingStatus(null);
    }
  };

  return createPortal(
    <>
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            className="fixed bottom-0 inset-x-0 z-[999] p-4 pb-safe"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div
              className={cn(
                'max-w-2xl mx-auto rounded-2xl bg-gray-800 border border-white/[0.08]',
                'shadow-[0_-4px_20px_rgba(192,132,252,0.15),0_2px_8px_rgba(0,0,0,0.6)]',
                'p-4'
              )}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-purple-300" />
                  </div>
                  <span className="text-sm font-medium text-white">
                    {selectedCount} selected
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {ALL_STATUSES.map((status) => {
                  const config = STATUS_CONFIG[status];
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusClick(status)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold border transition-all',
                        'active:scale-[0.96]',
                        config.bgClass,
                        'hover:brightness-125'
                      )}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!pendingStatus}
        title={`Mark ${selectedCount} employees as ${pendingStatus ? STATUS_CONFIG[pendingStatus].label : ''}?`}
        description={`This will update attendance records for ${selectedCount} employees.`}
        confirmLabel="Confirm"
        onConfirm={handleConfirm}
        onCancel={() => setPendingStatus(null)}
      />
    </>,
    document.body
  );
}
