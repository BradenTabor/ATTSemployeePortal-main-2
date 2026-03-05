import { CheckCircle, XCircle, AlertTriangle, Calendar } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { AttendanceStatus } from './types';
import { STATUS_CONFIG } from './types';

const ICON_MAP = {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
} as const;

interface StatusButtonProps {
  status: AttendanceStatus;
  isActive: boolean;
  onClick: () => void;
  /** icon-only (desktop table) */
  compact?: boolean;
  /** equal-width with label, for mobile grid */
  mobile?: boolean;
  disabled?: boolean;
}

export default function StatusButton({
  status,
  isActive,
  onClick,
  compact = false,
  mobile = false,
  disabled = false,
}: StatusButtonProps) {
  const config = STATUS_CONFIG[status];
  const Icon = ICON_MAP[config.icon];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center gap-1 rounded-lg border font-medium transition-all duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400',
        compact
          ? 'px-2 py-1.5 text-[11px]'
          : mobile
            ? 'flex-1 py-2 text-[11px] px-1'
            : 'px-3 py-2 text-xs',
        isActive
          ? cn(config.solidClass, 'border-transparent shadow-sm')
          : cn(
              'border-white/10 bg-white/[0.03] text-gray-400',
              'hover:bg-white/[0.06] hover:text-gray-200',
              'active:scale-[0.96]'
            ),
        disabled && 'opacity-40 pointer-events-none'
      )}
      aria-pressed={isActive}
      aria-label={`Mark as ${config.label}`}
    >
      <Icon className={cn(compact ? 'w-3.5 h-3.5' : mobile ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      {!compact && <span className={mobile ? 'truncate' : ''}>{config.shortLabel}</span>}
      {compact && <span className="sr-only">{config.label}</span>}
    </button>
  );
}
