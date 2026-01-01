import { memo, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layers, 
  ChevronDown, 
  Briefcase, 
  MapPin,
  Lock,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  calculateJobProgress, 
  calculateSpanProgress, 
  getSpanProgressColors 
} from '../../lib/jobProgressUtils';
import { useCanViewJobProgress } from '../../hooks/useCanViewJobProgress';
import type { JobProgressTracker } from '../../types/jobs';

interface StackedJobCardProps {
  /** Array of jobs in this stack/group */
  jobs: JobProgressTracker[];
  /** Callback when a specific job is selected */
  onSelectJob: (jobId: string) => void;
  /** Currently selected job ID */
  selectedJobId?: string | null;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A compact job item used within the stacked card when fanned out
 * Ultra-compact for very small screens
 */
const StackedJobItem = memo(function StackedJobItem({
  job,
  isSelected,
  onSelect,
}: {
  job: JobProgressTracker;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { canViewProgress } = useCanViewJobProgress();
  const isSpanBased = job.tracking_type === 'job_progress';

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

  const progress = isSpanBased
    ? { percentage: spanProgress?.percentage ?? 0, status: 'in_progress' as const }
    : calculateJobProgress(job.start_date, job.end_date);

  const isExceeded = !isSpanBased && progress.status === 'exceeded';

  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-lg sm:rounded-xl border p-2.5 sm:p-3 transition-all min-h-[48px] touch-manipulation overflow-hidden',
        'bg-gradient-to-br active:scale-[0.98] active:brightness-110',
        isSelected
          ? 'border-emerald-400/60 from-[#0a2a1f]/90 via-[#041812]/95 to-[#03120c]/90 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/40'
          : isSpanBased
            ? 'border-blue-500/20 from-[#040815]/80 via-[#020509]/90 to-[#010204] active:border-blue-400/40'
            : isExceeded
              ? 'border-red-500/30 from-[#1a0808]/80 via-[#0d0505]/90 to-[#050302] active:border-red-500/50'
              : 'border-emerald-500/20 from-[#041510]/80 via-[#020d09]/90 to-[#010604] active:border-emerald-400/40'
      )}
    >
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Briefcase
              className={cn(
                'w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0',
                isSelected ? 'text-emerald-300' : isExceeded && !isSpanBased ? 'text-red-400' : ''
              )}
              style={{
                color: isSelected ? undefined : (isSpanBased ? 'rgb(231, 114, 4)' : isExceeded ? undefined : 'rgb(0, 219, 77)')
              }}
            />
            <h4 className="font-semibold text-[12px] sm:text-sm text-white truncate leading-snug flex-1 min-w-0">
              {job.job_name}
            </h4>
          </div>
          {job.job_location && (
            <p className="flex items-center gap-1 mt-0.5 ml-4 sm:ml-5 text-[10px] sm:text-[11px] text-white/50">
              <MapPin className="w-2 h-2 sm:w-2.5 sm:h-2.5 flex-shrink-0" />
              <span className="truncate">{job.job_location}</span>
            </p>
          )}
        </div>

        {canViewProgress ? (
          <div
            className={cn(
              'flex-shrink-0 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold tabular-nums',
              isSpanBased && spanProgressColors
                ? cn(spanProgressColors.bg, 'border', spanProgressColors.border, spanProgressColors.text)
                : isExceeded
                  ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
            )}
          >
            {isSpanBased && spanProgress ? spanProgress.percentage : progress.percentage}%
          </div>
        ) : (
          <div className="flex-shrink-0 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <Lock className="w-3 h-3 text-emerald-400/60" />
          </div>
        )}
      </div>
    </motion.button>
  );
});

/**
 * StackedJobCard - Displays multiple grouped jobs as a stacked card
 * 
 * When collapsed: Shows top job with visual indication of stacked jobs behind
 * When expanded: Fan-out animation reveals all jobs in the group
 */
function StackedJobCardComponent({
  jobs,
  onSelectJob,
  selectedJobId,
  className,
}: StackedJobCardProps) {
  const { canViewProgress } = useCanViewJobProgress();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Primary job is the first one in the stack
  const primaryJob = jobs[0];
  const stackCount = jobs.length;
  
  // Calculate aggregate progress for the collapsed view
  const aggregateProgress = useMemo(() => {
    let totalProgress = 0;
    let spanBasedCount = 0;
    let timelineExceededCount = 0;
    
    jobs.forEach(job => {
      const isSpanBased = job.tracking_type === 'job_progress';
      if (isSpanBased) {
        spanBasedCount++;
        const progressUpdates = job.progress_updates || [];
        const totalSpans = progressUpdates.reduce((sum, u) => sum + (u.spans_completed || 0), 0);
        const totalFeet = progressUpdates.reduce((sum, u) => sum + (u.total_feet_completed || 0), 0);
        const spanProgress = calculateSpanProgress(
          totalSpans,
          totalFeet,
          job.estimated_total_spans,
          job.estimated_total_feet,
          job.span_progress_metric || 'spans'
        );
        totalProgress += spanProgress.percentage;
      } else {
        const progress = calculateJobProgress(job.start_date, job.end_date);
        totalProgress += progress.percentage;
        if (progress.status === 'exceeded') timelineExceededCount++;
      }
    });
    
    return {
      averagePercentage: Math.round(totalProgress / jobs.length),
      hasSpanBased: spanBasedCount > 0,
      hasExceeded: timelineExceededCount > 0,
      isMixedType: spanBasedCount > 0 && spanBasedCount < jobs.length,
    };
  }, [jobs]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleJobSelect = useCallback((jobId: string) => {
    onSelectJob(jobId);
  }, [onSelectJob]);

  // Determine if any job in the stack is selected
  const hasSelectedJob = jobs.some(job => job.id === selectedJobId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-2xl overflow-hidden',
        className
      )}
    >
      {/* Stacked cards background effect (visible when collapsed) */}
      <AnimatePresence>
        {!isExpanded && stackCount > 1 && (
          <>
            {/* Third card shadow (if 3+ jobs) */}
            {stackCount >= 3 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-2 top-2 h-full rounded-2xl border border-emerald-500/10 bg-gradient-to-br from-[#041510]/40 via-[#020d09]/50 to-[#010604]/40"
                style={{ transform: 'translateY(8px)' }}
              />
            )}
            {/* Second card shadow */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-1 top-1 h-full rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-[#041510]/60 via-[#020d09]/70 to-[#010604]/60"
              style={{ transform: 'translateY(4px)' }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Main card container */}
      <motion.div
        layout
        className={cn(
          'relative rounded-2xl border overflow-hidden transition-all',
          'bg-gradient-to-br',
          hasSelectedJob
            ? 'border-emerald-400/50 from-[#0a2a1f]/95 via-[#041812]/90 to-[#03120c]/95 shadow-lg shadow-emerald-500/15'
            : aggregateProgress.hasExceeded
              ? 'border-red-500/30 from-[#1a0808]/80 via-[#0d0505]/90 to-[#050302]'
              : 'border-emerald-500/25 from-[#041510]/90 via-[#020d09]/95 to-[#010604]/90 active:border-emerald-400/40'
        )}
      >
        {/* Header - Always visible - Ultra-compact for small screens */}
        <button
          onClick={toggleExpanded}
          className="w-full text-left p-2.5 xs:p-3 sm:p-4 min-h-[60px] touch-manipulation active:brightness-110 overflow-hidden"
          style={{ 
            background: 'radial-gradient(circle at 50% 50%, rgba(5, 77, 53, 0.8) 0%, rgba(10, 10, 10, 1) 100%)' 
          }}
        >
          {/* Row 1: Stack badge + progress + chevron */}
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Stack badge */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex-shrink-0">
                <Layers className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                <span className="text-[10px] sm:text-xs font-bold text-emerald-300">{stackCount}</span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-white/50 uppercase tracking-wider hidden xs:inline">Stacked</span>
            </div>
            
            {/* Progress + Chevron */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              {canViewProgress ? (
                <div
                  className={cn(
                    'px-1.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg border text-[10px] sm:text-xs font-bold tabular-nums whitespace-nowrap',
                    aggregateProgress.hasExceeded
                      ? 'bg-red-500/15 border-red-500/30 text-red-400'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  )}
                >
                  ~{aggregateProgress.averagePercentage}%
                </div>
              ) : (
                <div className="px-1.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Lock className="w-3 h-3 text-emerald-400/60" />
                </div>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                className="p-1 sm:p-1.5 rounded-md sm:rounded-lg bg-white/5 border border-white/10 flex items-center justify-center"
              >
                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/60" />
              </motion.div>
            </div>
          </div>

          {/* Row 2: Job name */}
          <div className="flex items-center gap-1.5 min-w-0">
            <Briefcase 
              className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0"
              style={{ color: 'rgb(0, 219, 77)' }}
            />
            <h4 className="font-semibold text-[13px] sm:text-sm text-white truncate leading-snug flex-1 min-w-0">
              {primaryJob.job_name}
            </h4>
            {stackCount > 1 && (
              <span className="text-[10px] sm:text-xs text-white/40 flex-shrink-0">
                +{stackCount - 1}
              </span>
            )}
          </div>

          {/* Row 3: Location (if exists) */}
          {primaryJob.job_location && (
            <p className="flex items-center gap-1 text-[10px] sm:text-[11px] text-white/50 mt-0.5 ml-4 sm:ml-5">
              <MapPin className="w-2 h-2 sm:w-2.5 sm:h-2.5 flex-shrink-0" />
              <span className="truncate">{primaryJob.job_location}</span>
            </p>
          )}

          {/* Mixed type indicator */}
          {aggregateProgress.isMixedType && (
            <div className="mt-1 ml-4 sm:ml-5">
              <span className="text-[8px] sm:text-[9px] text-white/40 uppercase tracking-wide">
                Mixed tracking
              </span>
            </div>
          )}
        </button>

        {/* Expanded content - Individual jobs */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-2 border-t border-white/10 pt-2.5 sm:pt-3">
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  <span className="text-[10px] sm:text-xs text-emerald-300/70 uppercase tracking-wider font-medium">
                    Select a job
                  </span>
                </div>
                
                {jobs.map((job, index) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <StackedJobItem
                      job={job}
                      isSelected={job.id === selectedJobId}
                      onSelect={() => handleJobSelect(job.id)}
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export const StackedJobCard = memo(StackedJobCardComponent);
export default StackedJobCard;

