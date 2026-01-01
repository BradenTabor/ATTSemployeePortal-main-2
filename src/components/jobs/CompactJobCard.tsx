import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, AlertTriangle, Briefcase, Target, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { calculateJobProgress, calculateSpanProgress, getSpanProgressColors } from '../../lib/jobProgressUtils';
import { useCanViewJobProgress } from '../../hooks/useCanViewJobProgress';
import { JobProgressBar } from './JobProgressBar';
import type { JobProgressTracker } from '../../types/jobs';

interface CompactJobCardProps {
  job: JobProgressTracker;
  className?: string;
}

function CompactJobCardComponent({ 
  job, 
  className 
}: CompactJobCardProps) {
  const { canViewProgress } = useCanViewJobProgress();
  const isSpanBased = job.tracking_type === 'job_progress';
  
  // Calculate span-based progress
  const spanProgress = useMemo(() => {
    if (!isSpanBased) return null;
    const progressUpdates = job.progress_updates || [];
    const totalSpans = progressUpdates.reduce((sum, u) => sum + (u.spans_completed || 0), 0);
    const totalFeet = progressUpdates.reduce((sum, u) => sum + (u.total_feet_completed || 0), 0);
    return calculateSpanProgress(
      totalSpans,
      totalFeet,
      job.estimated_total_spans,
      job.estimated_total_feet,
      job.span_progress_metric || 'spans'
    );
  }, [isSpanBased, job.progress_updates, job.estimated_total_spans, job.estimated_total_feet, job.span_progress_metric]);
  
  const spanProgressColors = useMemo(() => {
    if (!spanProgress) return null;
    return getSpanProgressColors(spanProgress.percentage);
  }, [spanProgress]);
  
  // Timeline-based progress (only for non-span jobs)
  const progress = isSpanBased 
    ? { percentage: spanProgress?.percentage ?? 0, status: 'in_progress' as const, daysExceeded: 0, daysRemaining: 0, totalDays: 0, elapsedDays: 0 }
    : calculateJobProgress(job.start_date, job.end_date);
  
  // Never show exceeded for span-based jobs
  const isExceeded = !isSpanBased && progress.status === 'exceeded';

  // Card styling - span-based jobs use blue accent, never red
  const cardColors = isSpanBased
    ? 'border-blue-500/20 from-[#040815]/80 via-[#020509]/90 to-[#010204] hover:border-blue-400/40 hover:shadow-blue-900/20'
    : isExceeded
      ? 'border-red-500/30 from-[#1a0808]/80 via-[#0d0505]/90 to-[#050302] hover:border-red-500/50 hover:shadow-red-900/20'
      : 'border-emerald-500/20 from-[#041510]/80 via-[#020d09]/90 to-[#010604] hover:border-emerald-400/40 hover:shadow-emerald-900/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      aria-label={`${job.job_name}, ${isSpanBased && spanProgress ? spanProgress.percentage : progress.percentage}% complete${!isSpanBased && isExceeded ? ', timeline exceeded' : ''}`}
      className={cn(
        // Base card styles - more compact on mobile
        'rounded-xl sm:rounded-2xl border overflow-hidden transition-all cursor-pointer',
        'bg-gradient-to-br hover:shadow-lg active:scale-[0.99]',
        cardColors,
        className
      )}
    >
      <div 
        className="w-full p-2.5 sm:p-3 md:p-4 text-left min-h-[40px] sm:min-h-[44px]"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(5, 77, 53, 1) 0%, rgba(10, 10, 10, 1) 100%)' }}
      >
        {/* Compact layout: Job info and progress in single row on mobile */}
        <div className="flex items-center justify-between gap-2 sm:gap-3 mb-1.5 sm:mb-2">
          {/* Left: Job name - optimized for mobile */}
          <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2">
            <Briefcase 
              className={cn(
                'w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0',
                isExceeded && !isSpanBased && 'text-red-400'
              )}
              style={{
                color: isSpanBased ? 'rgb(231, 114, 4)' : isExceeded ? undefined : 'rgb(0, 219, 77)'
              }}
            />
            <h4 className="font-semibold text-xs sm:text-sm md:text-base text-white truncate leading-tight">
              {job.job_name}
            </h4>
          </div>

          {/* Right: Progress percentage - more compact on mobile */}
          {canViewProgress ? (
            <div 
              className={cn(
                'flex-shrink-0 text-right',
                'px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg',
                isSpanBased && spanProgressColors
                  ? cn(spanProgressColors.bg, 'border', spanProgressColors.border)
                  : isExceeded
                    ? 'bg-red-500/15 border border-red-500/30'
                    : 'bg-emerald-500/15 border border-emerald-500/30'
              )}
            >
              <span 
                className={cn(
                  'text-xs sm:text-sm md:text-base font-bold tabular-nums',
                  isSpanBased && spanProgressColors
                    ? spanProgressColors.text
                    : isExceeded ? 'text-red-400' : 'text-emerald-400'
                )}
              >
                {isSpanBased && spanProgress ? spanProgress.percentage : progress.percentage}%
              </span>
            </div>
          ) : (
            <div className="flex-shrink-0 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400/60" />
            </div>
          )}
        </div>

        {/* Location - shown inline under name on mobile */}
        {job.job_location && (
          <p className="flex items-center gap-1 text-[10px] sm:text-xs text-white/45 mb-1.5 sm:mb-2 ml-[18px] sm:ml-5 truncate">
            <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
            <span className="truncate">{job.job_location}</span>
          </p>
        )}

        {/* Progress bar - more compact */}
        <div className="ml-[18px] sm:ml-5">
          {isSpanBased && spanProgress && spanProgressColors ? (
            // Span-based progress bar - show placeholder for restricted roles
            canViewProgress ? (
              <div className="space-y-0.5 sm:space-y-1">
                <div className={cn(
                  'relative w-full h-1 sm:h-1.5 rounded-full overflow-hidden',
                  spanProgressColors.bg
                )}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${spanProgress.percentage}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r',
                      spanProgressColors.gradient
                    )}
                  />
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] text-white/50">
                  <Target className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                  <span className="truncate">{spanProgress.completed.toLocaleString()} / {spanProgress.total > 0 ? spanProgress.total.toLocaleString() : '?'} {spanProgress.metricLabel}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5 py-1 sm:py-1.5 px-2 sm:px-3 rounded-md sm:rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <Lock className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-emerald-400/60" />
                <span className="text-[8px] sm:text-[10px] text-emerald-400/70 font-medium truncate">Progress visible to management</span>
              </div>
            )
          ) : (
            // Timeline-based progress bar (JobProgressBar handles its own restriction)
            <JobProgressBar
              startDate={job.start_date}
              endDate={job.end_date}
              size="sm"
              showLabel={false}
              showExceededBadge={false}
            />
          )}
        </div>

        {/* Timeline exceeded badge - more compact on mobile */}
        {!isSpanBased && isExceeded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-1.5 sm:mt-2 ml-[18px] sm:ml-5"
          >
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[9px] sm:text-[10px] md:text-xs font-semibold">
              <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden xs:inline">Timeline</span> Exceeded
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export const CompactJobCard = memo(CompactJobCardComponent);
export default CompactJobCard;
