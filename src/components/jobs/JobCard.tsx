import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Users, Calendar, Target, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDateRange, calculateMilestoneProgress, calculateSpanProgress, getSpanProgressColors } from '../../lib/jobProgressUtils';
import { JobProgressBar } from './JobProgressBar';
import type { JobProgressTracker, JobStatus } from '../../types/jobs';
import { JOB_STATUS_CONFIG } from '../../types/jobs';

interface JobCardProps {
  job: JobProgressTracker;
  onClick: () => void;
  index?: number;
}

function JobCardComponent({ job, onClick, index = 0 }: JobCardProps) {
  const statusConfig = JOB_STATUS_CONFIG[job.status as JobStatus];
  const milestoneProgress = calculateMilestoneProgress(job.milestones || []);
  const crewAssignments = job.crew_assignments || [];
  const totalSpans = job.progress_updates?.reduce((sum, u) => sum + (u.spans_completed || 0), 0) || 0;
  const totalFeet =
    job.progress_updates?.reduce((sum, u) => sum + (u.total_feet_completed || 0), 0) || 0;
  
  // Calculate span-based progress
  const isSpanBased = job.tracking_type === 'job_progress';
  const spanProgress = useMemo(() => {
    if (!isSpanBased) return null;
    return calculateSpanProgress(
      totalSpans,
      totalFeet,
      job.estimated_total_spans,
      job.estimated_total_feet,
      job.span_progress_metric || 'spans'
    );
  }, [isSpanBased, totalSpans, totalFeet, job.estimated_total_spans, job.estimated_total_feet, job.span_progress_metric]);
  
  const spanProgressColors = useMemo(() => {
    if (!spanProgress) return null;
    return getSpanProgressColors(spanProgress.percentage);
  }, [spanProgress]);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="group cursor-pointer rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-5 space-y-4 shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:border-[#f6dcb2]/40 transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white truncate group-hover:text-[#f4c979] transition-colors">
            {job.job_name}
          </h3>
          {(job.circuit || job.job_location) && (
            <p className="flex items-center gap-1.5 text-sm text-white/60 mt-1">
              <MapPin className="w-3.5 h-3.5 text-[#f4c979]/60" />
              <span className="truncate">{job.circuit || job.job_location}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {job.tracking_type === 'job_progress' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-semibold border border-blue-500/40 bg-blue-500/10 text-blue-200">
              SPAN-BASED
            </span>
          )}
          <span
            className={cn(
              'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
              statusConfig.bgColor,
              statusConfig.borderColor,
              statusConfig.textColor
            )}
          >
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Progress */}
      {isSpanBased && spanProgress && spanProgressColors ? (
        <div className="space-y-2">
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className={cn('font-medium', spanProgressColors.text)}>
                {spanProgress.percentage}%
              </span>
              <span className="text-white/50">
                {spanProgress.completed.toLocaleString()} / {spanProgress.total > 0 ? spanProgress.total.toLocaleString() : '?'} {spanProgress.metricLabel}
              </span>
            </div>
            <div className={cn(
              'relative w-full h-2.5 rounded-full overflow-hidden',
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
          
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-300" />
              <div>
                <p className="text-white/60">Spans</p>
                <p className="text-emerald-300 font-semibold">{totalSpans.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#f4c979]" />
              <div>
                <p className="text-white/60">Feet</p>
                <p className="text-[#f4c979] font-semibold">{totalFeet.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <JobProgressBar
            startDate={job.start_date}
            endDate={job.end_date}
            size="md"
            showExceededBadge={false}
          />
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Calendar className="w-3.5 h-3.5 text-[#f4c979]/60" />
            <span>{formatDateRange(job.start_date, job.end_date)}</span>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        {/* Crew avatars */}
        <div className="flex items-center gap-2">
          {crewAssignments.length > 0 ? (
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {crewAssignments.slice(0, 4).map((assignment, i) => {
                  const displayName = assignment.user_full_name || assignment.user_email;
                  const avatarInitial = (assignment.user_full_name?.[0] || assignment.user_email?.[0] || '?').toUpperCase();
                  return (
                    <div
                      key={assignment.id}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[10px] font-bold text-[#2d1c04] border-2 border-[#0b0906]"
                      style={{ zIndex: 4 - i }}
                      title={displayName}
                    >
                      {avatarInitial}
                    </div>
                  );
                })}
              </div>
              {crewAssignments.length > 4 && (
                <span className="ml-2 text-xs text-white/50">
                  +{crewAssignments.length - 4}
                </span>
              )}
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <Users className="w-3.5 h-3.5" />
              No crew assigned
            </span>
          )}
        </div>

        {/* Milestones summary */}
        {milestoneProgress.total > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-white/50">
            <Target className="w-3.5 h-3.5 text-[#f4c979]/60" />
            <span>
              {milestoneProgress.completed}/{milestoneProgress.total} milestones
            </span>
          </div>
        )}

        {/* Arrow indicator */}
        <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-[#f4c979] group-hover:translate-x-1 transition-all" />
      </div>
    </motion.article>
  );
}

export const JobCard = memo(JobCardComponent);

