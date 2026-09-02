import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Users, Calendar, Target, Clock, FileText } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDateRange, calculateMilestoneProgress, calculateSpanProgress, getSpanProgressColors } from '../../lib/jobProgressUtils';
import { JobProgressBar } from './JobProgressBar';
import type { JobProgressTracker, JobStatus } from '../../types/jobs';
import { JOB_STATUS_CONFIG } from '../../types/jobs';

interface ReadOnlyJobCardProps {
  job: JobProgressTracker;
  index?: number;
}

function ReadOnlyJobCardComponent({ job, index = 0 }: ReadOnlyJobCardProps) {
  const statusConfig = JOB_STATUS_CONFIG[job.status as JobStatus];
  const milestoneProgress = calculateMilestoneProgress(job.milestones || []);
  const crewAssignments = job.crew_assignments || [];
  const totalSpans = job.progress_updates?.reduce((sum, u) => sum + (u.spans_completed || 0), 0) || 0;
  const totalFeet = job.progress_updates?.reduce((sum, u) => sum + (u.total_feet_completed || 0), 0) || 0;
  
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-leaf-sm sm:rounded-leaf border border-[#5EE898]/25 bg-gradient-to-br from-[#12482A]/80 via-[#0A2A19] to-[#05170E] p-3 sm:p-4 space-y-2.5 sm:space-y-3 shadow-[0_10px_25px_rgba(0,0,0,0.4)]"
    >
      {/* Header - Compact */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
            {job.job_name}
          </h3>
          {(job.circuit || job.job_location) && (
            <p className="flex items-center gap-1 text-xs text-[#C8FFD4]/70 mt-0.5">
              <MapPin className="w-3 h-3 text-[#5EE898] flex-shrink-0" />
              <span className="truncate">{job.circuit || job.job_location}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-end gap-1 flex-shrink-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold border border-[#5EE898]/40 bg-[#5EE898]/10 text-[#C8FFD4]">
            {job.tracking_type === 'job_progress' ? 'SPAN' : 'TIME'}
          </span>
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold border',
              statusConfig.bgColor,
              statusConfig.borderColor,
              statusConfig.textColor
            )}
          >
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Description if exists - Compact */}
      {job.job_description && (
        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[#5EE898]/5 border border-[#5EE898]/10">
          <FileText className="w-3 h-3 text-[#5EE898] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#D9FFE3]/70 line-clamp-2 leading-relaxed">{job.job_description}</p>
        </div>
      )}

      {/* Progress Section - Enhanced Visibility */}
      {isSpanBased && spanProgress && spanProgressColors ? (
        <div className="space-y-2.5 p-3 rounded-xl bg-gradient-to-br from-[#5EE898]/15 via-[#1F7A44]/10 to-[#5EE898]/5 border border-[#5EE898]/30 shadow-[inset_0_1px_0_rgba(127,224,176,0.2)]">
          {/* Progress header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#5EE898] animate-pulse" />
              <span className="text-[10px] sm:text-xs text-[#5EE898] uppercase font-mono font-medium tracking-[0.14em]">Progress</span>
            </div>
            <span className={cn('text-sm sm:text-base font-black', spanProgressColors.text)}>
              {spanProgress.percentage}%
            </span>
          </div>
          
          {/* Enhanced progress bar */}
          <div className="relative">
            <div className="relative w-full h-3 sm:h-4 rounded-full overflow-hidden bg-[#05170E]/60 border border-[#5EE898]/20 shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${spanProgress.percentage}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#1F7A44] via-[#5EE898] to-[#C8FFD4] shadow-[0_0_12px_rgba(127,224,176,0.5)]"
              />
              {/* Glow overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-full pointer-events-none" />
            </div>
            {/* Progress label */}
            <div className="flex items-center justify-between mt-1.5 text-[10px] sm:text-xs">
              <span className="text-[#C8FFD4]/70 font-medium">
                {spanProgress.completed.toLocaleString()} completed
              </span>
              <span className="text-[#C8FFD4]/50">
                of {spanProgress.total > 0 ? spanProgress.total.toLocaleString() : '?'} {spanProgress.metricLabel}
              </span>
            </div>
          </div>
          
          {/* Stats row - Enhanced */}
          <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#05170E]/40 border border-[#5EE898]/15">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5EE898]/30 to-[#1F7A44]/20 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-[#5EE898]" />
              </div>
              <div>
                <p className="text-[#C8FFD4]/50 text-[9px] uppercase font-mono font-medium tracking-[0.14em]">Spans</p>
                <p className="text-[#C8FFD4] font-bold text-xs sm:text-sm">{totalSpans.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#05170E]/40 border border-[#5EE898]/15">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5EE898]/30 to-[#1F7A44]/20 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-[#5EE898]" />
              </div>
              <div>
                <p className="text-[#C8FFD4]/50 text-[9px] uppercase font-mono font-medium tracking-[0.14em]">Feet</p>
                <p className="text-[#C8FFD4] font-bold text-xs sm:text-sm">{totalFeet.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 p-3 rounded-xl bg-gradient-to-br from-[#5EE898]/15 via-[#1F7A44]/10 to-[#5EE898]/5 border border-[#5EE898]/30 shadow-[inset_0_1px_0_rgba(127,224,176,0.2)]">
          {/* Progress header */}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#5EE898] animate-pulse" />
            <span className="text-[10px] sm:text-xs text-[#5EE898] uppercase font-mono font-medium tracking-[0.14em]">Timeline Progress</span>
          </div>
          
          {/* Enhanced timeline progress */}
          <div className="bg-[#05170E]/40 rounded-lg p-2 border border-[#5EE898]/15">
            <JobProgressBar
              startDate={job.start_date}
              endDate={job.end_date}
              size="md"
              showExceededBadge={true}
            />
          </div>
          
          {/* Date range */}
          <div className="flex items-center gap-2 text-[10px] sm:text-xs">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#5EE898]/30 to-[#1F7A44]/20 flex items-center justify-center">
              <Clock className="w-3 h-3 text-[#5EE898]" />
            </div>
            <span className="text-[#C8FFD4]/70 font-medium">{formatDateRange(job.start_date, job.end_date)}</span>
          </div>
        </div>
      )}

      {/* Crew Members Section - Compact */}
      <div className="p-2 rounded-lg bg-[#5EE898]/5 border border-[#5EE898]/10">
        <div className="flex items-center gap-1.5 mb-2">
          <Users className="w-3 h-3 text-[#5EE898]" />
          <span className="text-[10px] sm:text-xs text-[#5EE898] uppercase font-mono font-medium tracking-[0.14em]">
            Crew ({crewAssignments.length})
          </span>
        </div>
        
        {crewAssignments.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {crewAssignments.map((assignment) => {
              const displayName = assignment.user_full_name || assignment.user_email || 'Unknown';
              const avatarInitial = (assignment.user_full_name?.[0] || assignment.user_email?.[0] || '?').toUpperCase();
              return (
                <div
                  key={assignment.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#12482A]/60 border border-[#5EE898]/15"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#5EE898] to-[#1F7A44] flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                    {avatarInitial}
                  </div>
                  <span className="text-xs text-[#D9FFE3] truncate max-w-[120px] sm:max-w-none">{displayName}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[#C8FFD4]/40 italic">No crew assigned</p>
        )}
      </div>

      {/* Milestones Row - Compact */}
      {milestoneProgress.total > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#12482A]/50 border border-[#5EE898]/15">
          <Target className="w-3 h-3 text-[#5EE898]" />
          <span className="text-[10px] sm:text-xs text-[#C8FFD4]/70">
            <span className="font-semibold text-[#5EE898]">{milestoneProgress.completed}</span>
            <span className="text-[#C8FFD4]/50">/{milestoneProgress.total} milestones</span>
          </span>
        </div>
      )}
    </motion.article>
  );
}

export const ReadOnlyJobCard = memo(ReadOnlyJobCardComponent);

