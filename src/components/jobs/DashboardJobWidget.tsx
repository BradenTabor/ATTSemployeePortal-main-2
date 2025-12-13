import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  ChevronDown,
  MapPin,
  Calendar,
  Target,
  CheckCircle2,
  Circle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  calculateJobProgress,
  formatDateRange,
  formatProgressLabel,
  calculateMilestoneProgress,
  calculateSpanProgress,
  formatSpanProgressLabel,
  getSpanProgressColors,
} from '../../lib/jobProgressUtils';
import { JobProgressBar } from './JobProgressBar';
import type { JobProgressTracker } from '../../types/jobs';

interface DashboardJobWidgetProps {
  jobs: JobProgressTracker[];
  loading: boolean;
  error: string | null;
}

interface JobWidgetCardProps {
  job: JobProgressTracker;
  defaultExpanded?: boolean;
}

function JobWidgetCard({ job, defaultExpanded = false }: JobWidgetCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
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
  
  // Timeline progress (only for non-span jobs)
  const progress = isSpanBased
    ? { percentage: spanProgress?.percentage ?? 0, status: 'in_progress' as const, daysExceeded: 0, daysRemaining: 0, totalDays: 0, elapsedDays: 0 }
    : calculateJobProgress(job.start_date, job.end_date);
  const milestoneProgress = calculateMilestoneProgress(job.milestones || []);
  
  // Never show exceeded for span-based jobs
  const isExceeded = !isSpanBased && progress.status === 'exceeded';

  // Card styling - span-based jobs use blue accent, never red
  const cardColors = isSpanBased
    ? 'border-blue-500/20 from-[#040815] via-[#020509] to-[#010204]'
    : isExceeded
      ? 'border-red-500/30 from-[#1a0808] via-[#0d0505] to-[#050302]'
      : 'border-emerald-500/20 from-[#041510] via-[#020d09] to-[#010604]';

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border bg-gradient-to-br overflow-hidden transition-colors',
        cardColors
      )}
    >
      {/* Header - Always visible with progress bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Briefcase className={cn(
                'w-4 h-4',
                isSpanBased ? 'text-blue-400' : isExceeded ? 'text-red-400' : 'text-emerald-400'
              )} />
              <h4 className="font-semibold text-white truncate">{job.job_name}</h4>
              {isSpanBased && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold border border-blue-500/40 bg-blue-500/10 text-blue-200">
                  SPAN
                </span>
              )}
            </div>
            {job.job_location && (
              <p className="flex items-center gap-1.5 text-xs text-white/50 mt-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{job.job_location}</span>
              </p>
            )}
          </div>
          <ChevronDown className={cn(
            'w-4 h-4 text-white/40 transition-transform',
            isExpanded && 'rotate-180'
          )} />
        </div>

        {/* Progress bar - always visible */}
        {isSpanBased && spanProgress && spanProgressColors ? (
          // Span-based progress
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className={cn('font-medium', spanProgressColors.text)}>
                {spanProgress.percentage}%
              </span>
              <span className="text-white/50">
                {formatSpanProgressLabel(spanProgress)}
              </span>
            </div>
            <div className={cn(
              'relative w-full h-2 rounded-full overflow-hidden',
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
          </div>
        ) : (
          // Timeline-based progress
          <JobProgressBar
            startDate={job.start_date}
            endDate={job.end_date}
            size="sm"
            showExceededBadge={false}
          />
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              {/* Timeline exceeded warning - only for timeline-based jobs */}
              {!isSpanBased && isExceeded && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400">
                    {formatProgressLabel(progress)}
                  </span>
                </div>
              )}

              {/* Span progress info for span-based jobs */}
              {isSpanBased && spanProgress && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-blue-300">
                    {spanProgress.remaining > 0 
                      ? `${spanProgress.remaining.toLocaleString()} ${spanProgress.metricLabel} remaining`
                      : spanProgress.total > 0 
                        ? 'Target reached!' 
                        : 'No estimate set'}
                  </span>
                </div>
              )}

              {/* Timeline - only for timeline-based jobs */}
              {!isSpanBased && (
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400/60" />
                  <span>{formatDateRange(job.start_date, job.end_date)}</span>
                </div>
              )}

              {/* Description */}
              {job.job_description && (
                <p className="text-xs text-white/60 line-clamp-2">
                  {job.job_description}
                </p>
              )}

              {/* Milestones */}
              {job.milestones && job.milestones.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white/50">
                      <Target className="w-3.5 h-3.5 text-emerald-400/60" />
                      Milestones
                    </span>
                    <span className="text-emerald-400">
                      {milestoneProgress.completed}/{milestoneProgress.total}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {job.milestones.slice(0, 3).map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        {milestone.is_completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-white/30" />
                        )}
                        <span className={cn(
                          'truncate',
                          milestone.is_completed ? 'text-white/50 line-through' : 'text-white/80'
                        )}>
                          {milestone.title}
                        </span>
                      </div>
                    ))}
                    {job.milestones.length > 3 && (
                      <p className="text-xs text-white/40 pl-5">
                        +{job.milestones.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DashboardJobWidgetComponent({
  jobs,
  loading,
  error,
}: DashboardJobWidgetProps) {
  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-3xl border border-emerald-500/20 bg-[#041510]/80 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-emerald-300" />
          <div className="h-3 w-32 bg-white/10 rounded-full animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/5 bg-white/5 h-24 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-[#1a0808]/80 p-5">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // Empty state - don't render if no jobs
  if (jobs.length === 0) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-emerald-500/20 bg-[#041510]/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-emerald-300" />
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
            Your Assigned Jobs
          </p>
        </div>
        <span className="text-xs text-emerald-400 font-semibold">
          {jobs.length} active
        </span>
      </div>

      <div className="space-y-3">
        {jobs.map((job, index) => (
          <JobWidgetCard
            key={job.id}
            job={job}
            defaultExpanded={index === 0}
          />
        ))}
      </div>
    </div>
  );
}

export const DashboardJobWidget = memo(DashboardJobWidgetComponent);

