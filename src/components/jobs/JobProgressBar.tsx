import { memo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { calculateJobProgress, formatProgressLabel } from '../../lib/jobProgressUtils';
import { useCanViewJobProgress } from '../../hooks/useCanViewJobProgress';
import type { JobProgressResult } from '../../types/jobs';

interface JobProgressBarProps {
  startDate: string;
  endDate: string;
  className?: string;
  showLabel?: boolean;
  showExceededBadge?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const getProgressGradient = (result: JobProgressResult): string => {
  switch (result.status) {
    case 'not_started':
      return 'from-gray-400 to-gray-500';
    case 'in_progress':
      return 'from-emerald-400 to-emerald-600';
    case 'completed':
      return 'from-[#f4c979] to-[#d79a32]';
    case 'exceeded':
      return 'from-red-500 to-red-600';
  }
};

const getBarBackground = (result: JobProgressResult): string => {
  return result.status === 'exceeded' ? 'bg-red-900/30' : 'bg-white/10';
};

function JobProgressBarComponent({
  startDate,
  endDate,
  className,
  showLabel = true,
  showExceededBadge = true,
  size = 'md',
}: JobProgressBarProps) {
  const { canViewProgress } = useCanViewJobProgress();
  const progress = calculateJobProgress(startDate, endDate);

  const barHeight = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size];

  const fontSize = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  }[size];

  // Show placeholder for restricted roles
  if (!canViewProgress) {
    return (
      <div className={cn('w-full', className)}>
        <div className={cn(
          'flex items-center justify-center gap-2 py-2 px-3 rounded-lg',
          'bg-emerald-500/5 border border-emerald-500/20',
          fontSize
        )}>
          <Lock className="w-3 h-3 text-emerald-400/60" />
          <span className="text-emerald-400/70 font-medium">
            Progress visible to management only
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {showLabel && (
        <div className={cn('flex items-center justify-between', fontSize)}>
          <span className={cn(
            'font-medium',
            progress.status === 'exceeded' ? 'text-red-400' : 'text-white/80'
          )}>
            {progress.percentage}%
          </span>
          <span className={cn(
            progress.status === 'exceeded' ? 'text-red-400/70' : 'text-white/50'
          )}>
            {formatProgressLabel(progress)}
          </span>
        </div>
      )}

      <div className={cn(
        'relative w-full rounded-full overflow-hidden transition-colors',
        barHeight,
        getBarBackground(progress)
      )}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress.percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r',
            getProgressGradient(progress)
          )}
        />
      </div>

      {showExceededBadge && progress.status === 'exceeded' && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 mt-2"
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            Job Timeline Exceeded — {progress.daysExceeded} day{progress.daysExceeded !== 1 ? 's' : ''} over
          </span>
        </motion.div>
      )}
    </div>
  );
}

export const JobProgressBar = memo(JobProgressBarComponent);

