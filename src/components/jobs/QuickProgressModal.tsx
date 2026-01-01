import { memo, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, MapPin, Ruler, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { calculateSpanProgress, getSpanProgressColors } from '../../lib/jobProgressUtils';
import { JobProgressUpdateForm } from './JobProgressUpdateForm';
import { useCanViewJobProgress } from '../../hooks/useCanViewJobProgress';
import type { JobProgressTracker } from '../../types/jobs';

interface QuickProgressModalProps {
  jobs: JobProgressTracker[];
  isOpen: boolean;
  onClose: () => void;
  onJobUpdate: () => void;
}

function QuickProgressModalComponent({
  jobs,
  isOpen,
  onClose,
  onJobUpdate,
}: QuickProgressModalProps) {
  const { canViewProgress } = useCanViewJobProgress();
  const [selectedJob, setSelectedJob] = useState<JobProgressTracker | null>(null);

  // Filter to only show active span-based jobs
  const eligibleJobs = useMemo(() => {
    return jobs.filter(
      (job) => job.tracking_type === 'job_progress' && job.status === 'active'
    );
  }, [jobs]);

  const handleClose = () => {
    setSelectedJob(null);
    onClose();
  };

  const handleJobSelect = (job: JobProgressTracker) => {
    setSelectedJob(job);
  };

  const handleBack = () => {
    setSelectedJob(null);
  };

  const handleFormSubmit = () => {
    setSelectedJob(null);
    onJobUpdate();
    onClose();
  };

  if (!isOpen) return null;

  // If a job is selected, show the progress update form
  if (selectedJob) {
    return (
      <JobProgressUpdateForm
        job={selectedJob}
        onSubmit={handleFormSubmit}
        onCancel={handleBack}
      />
    );
  }

  // Show job selection
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-emerald-500/30',
            'shadow-2xl shadow-emerald-900/20 overflow-hidden flex flex-col',
            'max-h-[85vh] sm:max-h-[80vh]'
          )}
          style={{ background: 'linear-gradient(180deg, #04150f 0%, #041812 50%, #03120c 100%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/20 bg-emerald-900/10">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-semibold">
                  Quick Progress Update
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-0.5">Select a Job</h3>
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-lg border border-white/10 text-white/50 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all touch-manipulation"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto p-4">
            {eligibleJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Briefcase className="w-8 h-8 text-emerald-400/50" />
                </div>
                <p className="text-white/70 font-medium mb-1">No eligible jobs</p>
                <p className="text-white/40 text-sm">
                  You don't have any active span-based jobs assigned.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {eligibleJobs.map((job) => (
                  <JobSelectionCard
                    key={job.id}
                    job={job}
                    canViewProgress={canViewProgress}
                    onSelect={() => handleJobSelect(job)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          {eligibleJobs.length > 0 && (
            <div className="px-4 py-3 border-t border-emerald-500/20 bg-emerald-900/5">
              <p className="text-[11px] text-white/40 text-center">
                Tap a job to add a progress update
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Job selection card component
interface JobSelectionCardProps {
  job: JobProgressTracker;
  canViewProgress: boolean;
  onSelect: () => void;
}

const JobSelectionCard = memo(function JobSelectionCard({
  job,
  canViewProgress,
  onSelect,
}: JobSelectionCardProps) {
  const spanProgress = useMemo(() => {
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
  }, [job.progress_updates, job.estimated_total_spans, job.estimated_total_feet, job.span_progress_metric]);

  const progressColors = useMemo(() => {
    return getSpanProgressColors(spanProgress.percentage);
  }, [spanProgress.percentage]);

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-xl border p-3 transition-all touch-manipulation',
        'bg-gradient-to-br active:brightness-110',
        'border-emerald-500/20 from-[#041510]/80 via-[#020d09]/90 to-[#010604]',
        'hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-900/20'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgb(231, 114, 4)' }} />
            <h4 className="font-semibold text-sm text-white truncate">{job.job_name}</h4>
          </div>
          {job.job_location && (
            <p className="flex items-center gap-1.5 text-xs text-white/50 ml-5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{job.job_location}</span>
            </p>
          )}
          {job.circuit && (
            <p className="flex items-center gap-1.5 text-xs text-white/40 ml-5 mt-0.5">
              <Ruler className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{job.circuit}</span>
            </p>
          )}
        </div>
        
        {/* Progress indicator */}
        {canViewProgress && (
          <div
            className={cn(
              'flex-shrink-0 px-2 py-1 rounded-lg text-sm font-bold tabular-nums',
              progressColors.bg,
              'border',
              progressColors.border,
              progressColors.text
            )}
          >
            {spanProgress.percentage}%
          </div>
        )}
      </div>

      {/* Progress bar - only show if user can view progress */}
      {canViewProgress && (
        <div className="mt-2 ml-5">
          <div className={cn('relative w-full h-1.5 rounded-full overflow-hidden', progressColors.bg)}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${spanProgress.percentage}%` }}
              transition={{ duration: 0.4 }}
              className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r', progressColors.gradient)}
            />
          </div>
          <p className="text-[10px] text-white/40 mt-1">
            {spanProgress.completed.toLocaleString()} / {spanProgress.total > 0 ? spanProgress.total.toLocaleString() : '?'} {spanProgress.metricLabel}
          </p>
        </div>
      )}
    </motion.button>
  );
});

export const QuickProgressModal = memo(QuickProgressModalComponent);

