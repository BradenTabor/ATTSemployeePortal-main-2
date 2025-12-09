import { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase,
  MapPin,
  Calendar,
  FileText,
  ClipboardList,
  Target,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  Wrench,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  calculateJobProgress,
  formatDateForDisplay,
  formatProgressLabel,
  calculateMilestoneProgress,
} from '../../lib/jobProgressUtils';
import { JobProgressBar } from './JobProgressBar';
import type { JobProgressTracker, JOB_STATUS_CONFIG } from '../../types/jobs';

interface JobDetailExpandedProps {
  job: JobProgressTracker;
}

const statusConfig: typeof JOB_STATUS_CONFIG = {
  active: {
    label: 'Active',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
  },
  completed: {
    label: 'Completed',
    bgColor: 'bg-[#f4c979]/15',
    borderColor: 'border-[#f4c979]/30',
    textColor: 'text-[#f4c979]',
  },
  paused: {
    label: 'Paused',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
  },
  cancelled: {
    label: 'Cancelled',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
  },
};

function JobDetailExpandedComponent({ job }: JobDetailExpandedProps) {
  const progress = calculateJobProgress(job.start_date, job.end_date);
  const milestoneProgress = calculateMilestoneProgress(job.milestones || []);
  const isExceeded = progress.status === 'exceeded';
  const status = statusConfig[job.status];

  return (
    <div
      className={cn(
        'w-full bg-gradient-to-br p-6 sm:p-8',
        isExceeded
          ? 'from-[#1a0808] via-[#0d0606] to-[#050303]'
          : 'from-[#041812] via-[#020d09] to-[#010604]'
      )}
    >
      {/* Header */}
      <div className="mb-6">
        {/* Status badge */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
              status.bgColor,
              status.borderColor,
              status.textColor
            )}
          >
            <Briefcase className="w-3 h-3" />
            {status.label}
          </span>

          {isExceeded && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
              <AlertTriangle className="w-3 h-3" />
              Timeline Exceeded
            </span>
          )}
        </div>

        {/* Job name */}
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          {job.job_name}
        </h2>

        {/* Location */}
        {job.job_location && (
          <p className="flex items-center gap-2 text-white/60">
            <MapPin className="w-4 h-4 text-emerald-400/70" />
            {job.job_location}
          </p>
        )}
      </div>

      {/* Progress section */}
      <div
        className={cn(
          'rounded-2xl border p-4 mb-6',
          isExceeded
            ? 'border-red-500/20 bg-red-500/5'
            : 'border-emerald-500/20 bg-emerald-500/5'
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white/70">Progress</span>
          <span
            className={cn(
              'text-lg font-bold',
              isExceeded ? 'text-red-400' : 'text-emerald-400'
            )}
          >
            {progress.percentage}%
          </span>
        </div>
        <JobProgressBar
          startDate={job.start_date}
          endDate={job.end_date}
          size="lg"
          showLabel={false}
          showExceededBadge={false}
        />
        <p
          className={cn(
            'text-xs mt-2',
            isExceeded ? 'text-red-400/70' : 'text-white/50'
          )}
        >
          {formatProgressLabel(progress)}
        </p>
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
            <Calendar className="w-3.5 h-3.5" />
            Start Date
          </div>
          <p className="text-white font-semibold">
            {formatDateForDisplay(job.start_date)}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
            <Clock className="w-3.5 h-3.5" />
            End Date
          </div>
          <p className="text-white font-semibold">
            {formatDateForDisplay(job.end_date)}
          </p>
        </div>
      </div>

      {/* Description */}
      {job.job_description && (
        <div className="mb-6">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
            <FileText className="w-3.5 h-3.5" />
            Description
          </div>
          <p className="text-white/80 text-sm leading-relaxed bg-white/5 rounded-xl p-4 border border-white/10">
            {job.job_description}
          </p>
        </div>
      )}

      {/* Specs */}
      {job.job_specs && (
        <div className="mb-6">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
            <Wrench className="w-3.5 h-3.5" />
            Job Specifications
          </div>
          <p className="text-white/80 text-sm leading-relaxed bg-white/5 rounded-xl p-4 border border-white/10 whitespace-pre-wrap">
            {job.job_specs}
          </p>
        </div>
      )}

      {/* Milestones */}
      {job.milestones && job.milestones.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Target className="w-3.5 h-3.5" />
              Milestones
            </div>
            <span className="text-xs font-semibold text-emerald-400">
              {milestoneProgress.completed} / {milestoneProgress.total} complete
            </span>
          </div>

          <div className="space-y-2">
            {job.milestones.map((milestone, index) => (
              <motion.div
                key={milestone.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border',
                  milestone.is_completed
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-white/5 border-white/10'
                )}
              >
                {milestone.is_completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'font-medium text-sm',
                      milestone.is_completed
                        ? 'text-white/60 line-through'
                        : 'text-white'
                    )}
                  >
                    {milestone.title}
                  </p>
                  {milestone.description && (
                    <p className="text-xs text-white/40 mt-0.5">
                      {milestone.description}
                    </p>
                  )}
                  {milestone.target_date && (
                    <p className="text-xs text-white/30 mt-1">
                      Target: {formatDateForDisplay(milestone.target_date)}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {job.notes && (
        <div>
          <div className="flex items-center gap-2 text-white/50 text-xs mb-2">
            <ClipboardList className="w-3.5 h-3.5" />
            Notes
          </div>
          <p className="text-white/70 text-sm leading-relaxed bg-white/5 rounded-xl p-4 border border-white/10 whitespace-pre-wrap">
            {job.notes}
          </p>
        </div>
      )}
    </div>
  );
}

export const JobDetailExpanded = memo(JobDetailExpandedComponent);
export default JobDetailExpanded;

