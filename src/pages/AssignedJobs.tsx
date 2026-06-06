import { memo, useCallback, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  FileText,
  Inbox,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Ruler,
  Sparkles,
  Target,
  Wrench,
  AlertTriangle,
  X,
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { useUserAssignedJobs } from '../hooks/jobs';
import { TextEffect } from '../components/ui/TextEffect';
import { getDeviceCapabilities } from '../lib/mobilePerf';
import { cn } from '../lib/utils';
import {
  calculateJobProgress,
  formatDateForDisplay,
  calculateMilestoneProgress,
  calculateSpanProgress,
  formatSpanProgressLabel,
  getSpanProgressColors,
} from '../lib/jobProgressUtils';
import { JobProgressBar } from '../components/jobs/JobProgressBar';
import { JobProgressUpdateForm } from '../components/jobs/JobProgressUpdateForm';
import { StackedJobCard } from '../components/jobs/StackedJobCard';
import { QuickProgressModal } from '../components/jobs/QuickProgressModal';
import { useCanViewJobProgress } from '../hooks/useCanViewJobProgress';
import type { JobProgressTracker, JOB_STATUS_CONFIG, JobGroup } from '../types/jobs';
import { Z } from "@/lib/zIndex";

// ============================================================================
// CONSTANTS
// ============================================================================

const JOBS_PER_PAGE = 6;

// ============================================================================
// STATUS CONFIG
// ============================================================================

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

// ============================================================================
// SKELETON LOADERS - Mobile-optimized
// ============================================================================

const JobCardSkeleton = memo(function JobCardSkeleton() {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-[#041510]/80 p-3 sm:p-4 animate-pulse min-h-[60px]">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex-1">
          <div className="h-4 w-28 sm:w-32 bg-white/10 rounded mb-1.5" />
          <div className="h-3 w-16 sm:w-20 bg-white/5 rounded" />
        </div>
        <div className="h-6 sm:h-7 w-10 sm:w-12 bg-emerald-500/10 rounded-lg" />
      </div>
    </div>
  );
});


// ============================================================================
// EMPTY & ERROR STATES - Mobile-friendly
// ============================================================================

const EmptyJobsState = memo(function EmptyJobsState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center mb-4 sm:mb-5 border border-emerald-500/30"
      >
        <Inbox className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400/60" />
      </motion.div>
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-base sm:text-lg text-white/70 font-semibold"
      >
        No Active Assignments
      </motion.p>
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-sm text-white/40 mt-1.5 sm:mt-2 max-w-[280px] sm:max-w-xs"
      >
        Jobs assigned to you will appear here. Check back later!
      </motion.p>
    </div>
  );
});

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState = memo(function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 sm:py-12 px-4 text-center">
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-3 sm:mb-4 border border-red-500/30">
        <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-red-400" />
      </div>
      <p className="text-sm sm:text-base text-red-400 font-semibold max-w-[280px] sm:max-w-none">{message}</p>
      {onRetry && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium min-h-[48px] touch-manipulation active:bg-red-500/20 active:brightness-110"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </motion.button>
      )}
    </div>
  );
});

// ============================================================================
// CIRCUIT FILTER - Ultra-compact for very small screens
// ============================================================================

interface CircuitFilterProps {
  circuits: string[];
  activeCircuit: string;
  onChange: (circuit: string) => void;
}

const CircuitFilter = memo(function CircuitFilter({
  circuits,
  activeCircuit,
  onChange,
}: CircuitFilterProps) {
  if (circuits.length <= 1) return null;

  return (
    <div className="overflow-x-auto -mx-3 sm:-mx-1 px-3 sm:px-1 pb-1.5 scrollbar-hide overscroll-x-contain snap-x snap-mandatory">
      <div className="flex gap-1.5 sm:gap-2.5 min-w-max">
        <button
          type="button"
          onClick={() => onChange('All')}
          aria-label="Show all circuits"
          aria-pressed={activeCircuit === 'All'}
          className={cn(
            'flex items-center gap-1 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border text-[11px] sm:text-sm font-medium transition-all min-h-[40px] sm:min-h-[44px] touch-manipulation whitespace-nowrap snap-start',
            'active:scale-[0.97] active:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]',
            activeCircuit === 'All'
              ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-white/5 text-white/60 border-white/10 active:bg-white/15'
          )}
        >
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden />
          All
        </button>
        {circuits.map((circuit) => (
          <button
            key={circuit}
            type="button"
            onClick={() => onChange(circuit)}
            aria-label={`Filter by circuit ${circuit}`}
            aria-pressed={activeCircuit === circuit}
            className={cn(
              'flex items-center gap-1 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border text-[11px] sm:text-sm font-medium transition-all min-h-[40px] sm:min-h-[44px] touch-manipulation whitespace-nowrap snap-start',
              'active:scale-[0.97] active:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]',
              activeCircuit === circuit
                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                : 'bg-white/5 text-white/60 border-white/10 active:bg-white/15'
            )}
          >
            <MapPin className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 flex-shrink-0" aria-hidden />
            <span className="max-w-[80px] sm:max-w-none truncate">{circuit}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// PAGINATION - Mobile-first with large touch targets
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPrevious: () => void;
  onNext: () => void;
}

const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPrevious,
  onNext,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between pt-3 sm:pt-4 mt-2 sm:mt-3 border-t border-white/10">
      <span className="text-[11px] sm:text-xs text-white/50">
        {startItem}–{endItem} of {totalItems}
      </span>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className={cn(
            'p-2 sm:p-2.5 rounded-xl border transition-all min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] disabled:focus-visible:ring-0',
            'active:scale-[0.95]',
            currentPage === 1
              ? 'border-white/5 text-white/20 cursor-not-allowed'
              : 'border-white/20 text-white/70 active:bg-white/15 active:border-white/30'
          )}
        >
          <ChevronLeft className="w-5 h-5" aria-hidden />
        </button>
        <span className="text-xs sm:text-sm text-white/70 px-1.5 sm:px-2 tabular-nums font-medium min-w-[40px] sm:min-w-[48px] text-center" aria-live="polite">
          {currentPage}/{totalPages}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className={cn(
            'p-2 sm:p-2.5 rounded-xl border transition-all min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] disabled:focus-visible:ring-0',
            'active:scale-[0.95]',
            currentPage === totalPages
              ? 'border-white/5 text-white/20 cursor-not-allowed'
              : 'border-white/20 text-white/70 active:bg-white/15 active:border-white/30'
          )}
        >
          <ChevronRight className="w-5 h-5" aria-hidden />
        </button>
      </div>
    </div>
  );
});

// ============================================================================
// JOB LIST ITEM - Ultra-compact for very small screens
// ============================================================================

interface JobListItemProps {
  job: JobProgressTracker;
  isSelected: boolean;
  onSelect: (jobId: string) => void;
}

const JobListItem = memo(function JobListItem({
  job,
  isSelected,
  onSelect,
}: JobListItemProps) {
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
    <button
      type="button"
      onClick={() => onSelect(job.id)}
      aria-label={`View job ${job.job_name}${job.circuit ? `, circuit ${job.circuit}` : ''}${isSelected ? ', selected' : ''}`}
      aria-pressed={isSelected}
      className={cn(
        'w-full text-left rounded-lg sm:rounded-xl border p-2.5 sm:p-3 transition-all min-h-[52px] touch-manipulation overflow-hidden',
        'bg-gradient-to-br active:scale-[0.98] active:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]',
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
          {(job.job_location || (canViewProgress && isSpanBased && spanProgress)) && (
            <div className="flex items-center gap-1 mt-0.5 ml-4 sm:ml-5 text-[10px] sm:text-[11px] text-white/50">
              {job.job_location && <span className="truncate">{job.job_location}</span>}
              {canViewProgress && isSpanBased && spanProgress && (
                <span className="text-white/40 flex-shrink-0">
                  • {spanProgress.completed}/{spanProgress.total > 0 ? spanProgress.total : '?'}
                </span>
              )}
            </div>
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
    </button>
  );
});

// ============================================================================
// JOB DETAIL PANEL - Mobile-first full-screen design
// ============================================================================

interface JobDetailPanelProps {
  job: JobProgressTracker;
  onJobUpdate: () => void;
  onClose: () => void;
}

const JobDetailPanel = memo(function JobDetailPanel({
  job,
  onJobUpdate,
  onClose,
}: JobDetailPanelProps) {
  const { canViewProgress } = useCanViewJobProgress();
  const isSpanBased = job.tracking_type === 'job_progress';
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [showAllMilestones, setShowAllMilestones] = useState(false);

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
  const milestoneProgress = calculateMilestoneProgress(job.milestones || []);

  const isExceeded = !isSpanBased && progress.status === 'exceeded';
  const status = statusConfig[job.status];

  const displayedMilestones = showAllMilestones 
    ? job.milestones 
    : job.milestones?.slice(0, 3);

  // Use portal to render at document body level - CENTERED modal
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-md"
      style={{ zIndex: Z.modal, 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: [0.25, 0.8, 0.25, 1] }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-md sm:max-w-lg overflow-hidden flex flex-col',
          'rounded-2xl border shadow-2xl',
          isSpanBased ? 'border-emerald-500/30' : isExceeded ? 'border-red-500/30' : 'border-emerald-500/30'
        )}
        style={{
          maxHeight: 'calc(100dvh - 48px)',
          background: isSpanBased
            ? 'linear-gradient(135deg, rgba(4, 21, 15, 0.99) 0%, rgba(4, 24, 18, 0.98) 50%, rgba(3, 18, 12, 0.99) 100%)'
            : isExceeded
              ? 'linear-gradient(to bottom right, #1a0808, #0d0606, #050303)'
              : 'linear-gradient(to bottom right, #04150f, #041812, #03120c)',
        }}
      >
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-3.5 sm:p-5">
            {/* Close Button - positioned at top right */}
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={onClose}
                className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 active:bg-white/15 active:border-white/25 transition-colors min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center touch-manipulation focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                aria-label="Close job detail"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-white/60" aria-hidden />
              </button>
            </div>
          
          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center flex-wrap gap-2 mb-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                  status.bgColor, status.borderColor, status.textColor
                )}
              >
                <Briefcase className="w-3 h-3" />
                {status.label}
              </span>
              {isSpanBased && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold border border-blue-500/40 bg-blue-500/10 text-blue-200">
                  SPAN TRACKING
                </span>
              )}
              {!isSpanBased && isExceeded && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  Exceeded
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight mb-1">
              {job.job_name}
            </h2>
            {job.job_location && (
              <p className="flex items-center gap-2 text-sm text-white/50">
                <MapPin className="w-3.5 h-3.5 text-emerald-400/70" />
                {job.job_location}
              </p>
            )}
          </div>

        {/* Span-based Progress */}
        {isSpanBased && spanProgress && spanProgressColors && (
          <div className={cn('rounded-xl border p-4 mb-4', canViewProgress ? cn(spanProgressColors.border, spanProgressColors.bg) : 'border-gray-500/30 bg-gray-500/15')}>
            {canViewProgress ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-white/70">
                      {formatSpanProgressLabel(spanProgress)}
                    </span>
                  </div>
                  <span className={cn('text-lg font-bold', spanProgressColors.text)}>
                    {spanProgress.percentage}%
                  </span>
                </div>
                <div className={cn('relative w-full h-3 rounded-full overflow-hidden', spanProgressColors.bg)}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${spanProgress.percentage}%` }}
                    transition={{ duration: 0.4 }}
                    className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r', spanProgressColors.gradient)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="text-center p-2 rounded-lg bg-white/5">
                    <p className="text-[11px] text-white/50 mb-0.5">Done</p>
                    <p className="text-base font-bold text-emerald-400">{spanProgress.completed.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/5">
                    <p className="text-[11px] text-white/50 mb-0.5">Goal</p>
                    <p className="text-base font-bold text-[#f4c979]">{spanProgress.total > 0 ? spanProgress.total.toLocaleString() : '—'}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-white/5">
                    <p className="text-[11px] text-white/50 mb-0.5">Left</p>
                    <p className="text-base font-bold text-white/70">{spanProgress.total > 0 ? spanProgress.remaining.toLocaleString() : '—'}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 py-3">
                <Lock className="w-4 h-4 text-emerald-400/60" />
                <span className="text-sm text-emerald-400/70 font-medium">
                  Progress visible to management only
                </span>
              </div>
            )}
            
            {/* Add Update Button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowProgressForm(true)}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold min-h-[48px] touch-manipulation"
              style={{
                background: 'linear-gradient(135deg, rgba(247, 228, 189, 1) 0%, rgba(244, 201, 121, 0.85) 50%, rgba(215, 154, 50, 1) 100%)',
                color: '#2e1b02',
                boxShadow: '0 4px 16px rgba(244, 201, 121, 0.3)',
              }}
            >
              <Plus className="w-4 h-4" />
              Add Progress Update
            </motion.button>
          </div>
        )}

        {/* Timeline-based Progress */}
        {!isSpanBased && (
          <div className={cn('rounded-xl border p-4 mb-4', canViewProgress ? (isExceeded ? 'border-red-500/20 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5') : 'border-gray-500/30 bg-gray-500/15')}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-white/70">Timeline</span>
              {canViewProgress ? (
                <span className={cn('text-lg font-bold', isExceeded ? 'text-red-400' : 'text-emerald-400')}>
                  {progress.percentage}%
                </span>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Lock className="w-3 h-3 text-emerald-400/60" />
                </div>
              )}
            </div>
            <JobProgressBar startDate={job.start_date} endDate={job.end_date} size="md" showLabel={false} showExceededBadge={false} />
            <div className="flex items-center justify-between mt-3 text-xs text-white/50">
              <span>{formatDateForDisplay(job.start_date)}</span>
              <span>{formatDateForDisplay(job.end_date)}</span>
            </div>
          </div>
        )}

        {/* Info Sections */}
        <div className="space-y-3">
          {job.job_description && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
                <FileText className="w-3.5 h-3.5" />
                Description
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                {job.job_description}
              </p>
            </div>
          )}

          {job.job_specs && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
                <Wrench className="w-3.5 h-3.5" />
                Specifications
              </div>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                {job.job_specs}
              </p>
            </div>
          )}

          {job.milestones && job.milestones.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <Target className="w-3.5 h-3.5" />
                  Milestones
                </div>
                <span className="text-xs font-semibold text-emerald-400">
                  {milestoneProgress.completed}/{milestoneProgress.total}
                </span>
              </div>
              <div className="space-y-2">
                {displayedMilestones?.map((milestone) => (
                  <div
                    key={milestone.id}
                    className={cn(
                      'flex items-center gap-3 py-2 px-3 rounded-lg text-sm',
                      milestone.is_completed ? 'bg-emerald-500/10' : 'bg-white/5'
                    )}
                  >
                    {milestone.is_completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-white/30 flex-shrink-0" />
                    )}
                    <span className={cn(milestone.is_completed ? 'text-white/50 line-through' : 'text-white/80')}>
                      {milestone.title}
                    </span>
                  </div>
                ))}
              </div>
              {job.milestones.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllMilestones(!showAllMilestones)}
                  aria-label={showAllMilestones ? "Show less milestones" : `Show ${job.milestones.length - 3} more milestones`}
                  aria-expanded={showAllMilestones}
                  className="mt-3 text-xs text-emerald-400 active:text-emerald-300 min-h-[44px] px-3 -mx-3 touch-manipulation focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] rounded"
                >
                  {showAllMilestones ? 'Show less' : `Show ${job.milestones.length - 3} more`}
                </button>
              )}
            </div>
          )}

          {job.notes && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
                <ClipboardList className="w-3.5 h-3.5" />
                Notes
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                {job.notes}
              </p>
            </div>
          )}
        </div>
          </div>
        </div>

        {showProgressForm && (
          <JobProgressUpdateForm
            job={job}
            onSubmit={() => {
              setShowProgressForm(false);
              onJobUpdate();
            }}
            onCancel={() => setShowProgressForm(false)}
          />
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
});

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

function AssignedJobs() {
  // Preserve scroll position when navigating away and back
  useEffect(() => {
    const scrollKey = 'assigned-jobs-scroll-position';
    
    // Restore scroll position on mount
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll) {
      const scrollY = parseInt(savedScroll, 10);
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
      // Clear after restore
      sessionStorage.removeItem(scrollKey);
    }

    // Save scroll position before navigation
    const handleBeforeUnload = () => {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    };

    // Save scroll position periodically (debounced)
    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        sessionStorage.setItem(scrollKey, String(window.scrollY));
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearTimeout(scrollTimeout);
    };
  }, []);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedJobId = searchParams.get('job');
  const [activeCircuit, setActiveCircuit] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [showQuickProgress, setShowQuickProgress] = useState(false);

  const {
    assignedJobs,
    loading,
    error,
    refetch,
  } = useUserAssignedJobs(user?.id);

  // Extract unique circuits
  const circuits = useMemo(() => {
    const circuitSet = new Set<string>();
    assignedJobs.forEach(job => {
      const circuit = job.circuit || job.job_location;
      if (circuit) circuitSet.add(circuit);
    });
    return Array.from(circuitSet).sort();
  }, [assignedJobs]);

  // Filter jobs by circuit
  const filteredJobs = useMemo(() => {
    if (activeCircuit === 'All') return assignedJobs;
    return assignedJobs.filter(job => (job.circuit || job.job_location) === activeCircuit);
  }, [assignedJobs, activeCircuit]);

  // Group jobs by job_group_id for stacked display
  // Returns: { groups: JobGroup[], displayItems }
  const { displayItems } = useMemo(() => {
    const groupMap = new Map<string, JobProgressTracker[]>();
    const ungrouped: JobProgressTracker[] = [];
    
    filteredJobs.forEach(job => {
      if (job.job_group_id) {
        const existing = groupMap.get(job.job_group_id) || [];
        existing.push(job);
        groupMap.set(job.job_group_id, existing);
      } else {
        ungrouped.push(job);
      }
    });
    
    const groups: JobGroup[] = Array.from(groupMap.entries()).map(([groupId, jobs]) => ({
      groupId,
      jobs,
    }));
    
    // Create a unified display list with proper ordering
    // Each item is either a group or an individual job
    type DisplayItem = 
      | { type: 'group'; group: JobGroup }
      | { type: 'job'; job: JobProgressTracker };
    
    const items: DisplayItem[] = [];
    
    // Add groups first (sorted by first job's created_at)
    groups.sort((a, b) => {
      const aDate = new Date(a.jobs[0]?.created_at || 0).getTime();
      const bDate = new Date(b.jobs[0]?.created_at || 0).getTime();
      return bDate - aDate;
    });
    groups.forEach(group => items.push({ type: 'group', group }));
    
    // Add ungrouped jobs
    ungrouped.forEach(job => items.push({ type: 'job', job }));
    
    return { jobGroups: groups, displayItems: items };
  }, [filteredJobs]);

  // For pagination, count groups as 1 item each
  const totalDisplayItems = displayItems.length;
  const totalPages = Math.max(1, Math.ceil(totalDisplayItems / JOBS_PER_PAGE));
  const paginatedDisplayItems = useMemo(() => {
    const start = (currentPage - 1) * JOBS_PER_PAGE;
    return displayItems.slice(start, start + JOBS_PER_PAGE);
  }, [displayItems, currentPage]);

  // Find selected job
  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return assignedJobs.find(job => job.id === selectedJobId) || null;
  }, [assignedJobs, selectedJobId]);

  // Note: Removed auto-select since job details now show as overlay
  // Users tap a job to open the detail modal

  const handleSelectJob = useCallback((jobId: string) => {
    setSearchParams({ job: jobId });
  }, [setSearchParams]);

  const handleCloseJobDetail = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const handleCircuitChange = useCallback((circuit: string) => {
    setActiveCircuit(circuit);
    setCurrentPage(1); // Reset to first page when filter changes
    const jobsInCircuit = circuit === 'All' 
      ? assignedJobs 
      : assignedJobs.filter(j => (j.circuit || j.job_location) === circuit);
    if (jobsInCircuit.length > 0 && !jobsInCircuit.find(j => j.id === selectedJobId)) {
      setSearchParams({ job: jobsInCircuit[0].id }, { replace: true });
    }
  }, [assignedJobs, selectedJobId, setSearchParams]);

  // Hero config
  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  return (
    <DashboardLayout title="My Jobs" pageHeading>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Premium Glass Header - Emerald Theme */}
        <div className="mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div 
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
              style={{
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.6) 0%, rgba(2, 15, 10, 0.5) 50%, rgba(1, 8, 5, 0.4) 100%)',
                boxShadow: 'inset 0 0 15px rgba(125, 225, 180, 0.05), 0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)' }} />
              <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(125,225,180,0.3) 0%, transparent 70%)', filter: 'blur(15px)' }} />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
              <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-white/[0.1] to-transparent" />
              <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-black/[0.1] to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/[0.15] to-transparent" />

              <div className="relative px-5 py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-200">My Jobs</span>
                  </motion.div>
                  {assignedJobs.length > 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#03150f]/60 border border-emerald-500/20">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-200/70">{assignedJobs.length} Active</span>
                    </motion.div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(16, 185, 129, 0.2)' }} />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(125,225,180,0.3)]">
                        Your Jobs
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent">Your Jobs</h1>
                    )}
                    <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1.5 md:mt-2 text-xs sm:text-sm text-emerald-200/50 font-medium leading-relaxed max-w-xl">
                      View details and submit progress
                    </motion.p>
                  </div>
                  {/* Quick Add Progress Button */}
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.5 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowQuickProgress(true)}
                    className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold min-h-[44px] touch-manipulation"
                    style={{
                      background: 'linear-gradient(135deg, rgba(247, 228, 189, 1) 0%, rgba(244, 201, 121, 0.85) 50%, rgba(215, 154, 50, 1) 100%)',
                      color: '#2e1b02',
                      boxShadow: '0 4px 16px rgba(244, 201, 121, 0.3)',
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Progress</span>
                    <span className="sm:hidden">Add</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-4">
          {error && <ErrorState message={error} onRetry={refetch} />}

          {loading && !error && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <JobCardSkeleton key={`skeleton-${i}`} />
              ))}
            </div>
          )}

          {!loading && !error && assignedJobs.length === 0 && <EmptyJobsState />}

          {!loading && !error && assignedJobs.length > 0 && (
            <div className="space-y-2.5 sm:space-y-4">
              {/* Circuit Filter */}
              {circuits.length > 1 && (
                <CircuitFilter
                  circuits={circuits}
                  activeCircuit={activeCircuit}
                  onChange={handleCircuitChange}
                />
              )}

              {/* Job List Container - Ultra compact on small screens */}
              <div className="rounded-lg sm:rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-[#04150f]/95 via-[#041812]/90 to-[#03120c]/95 p-2.5 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-400" />
                    <span className="text-[9px] sm:text-xs uppercase tracking-widest text-emerald-200/70 font-medium">
                      Select Job
                    </span>
                  </div>
                  <span className="text-[9px] sm:text-xs text-white/40">
                    {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {displayItems.length > 0 ? (
                  <>
                    <div className="space-y-2 sm:space-y-2.5">
                      {paginatedDisplayItems.map((item) => {
                        if (item.type === 'group') {
                          // Render stacked job card for grouped jobs
                          return (
                            <StackedJobCard
                              key={`group-${item.group.groupId}`}
                              jobs={item.group.jobs}
                              onSelectJob={handleSelectJob}
                              selectedJobId={selectedJobId}
                            />
                          );
                        } else {
                          // Render regular job item for ungrouped jobs
                          return (
                            <JobListItem
                              key={item.job.id}
                              job={item.job}
                              isSelected={item.job.id === selectedJobId}
                              onSelect={handleSelectJob}
                            />
                          );
                        }
                      })}
                    </div>
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalDisplayItems}
                      pageSize={JOBS_PER_PAGE}
                      onPrevious={() => setCurrentPage(p => Math.max(1, p - 1))}
                      onNext={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    />
                  </>
                ) : (
                  <div className="py-10 sm:py-8 text-center">
                    <p className="text-sm text-white/50">No jobs in this circuit</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Job Detail Overlay Modal */}
        <AnimatePresence mode="wait">
          {selectedJob && (
            <JobDetailPanel
              key={selectedJob.id}
              job={selectedJob}
              onJobUpdate={refetch}
              onClose={handleCloseJobDetail}
            />
          )}
        </AnimatePresence>

        {/* Quick Progress Modal */}
        <QuickProgressModal
          jobs={assignedJobs}
          isOpen={showQuickProgress}
          onClose={() => setShowQuickProgress(false)}
          onJobUpdate={refetch}
        />
      </div>
    </DashboardLayout>
  );
}

export default memo(AssignedJobs);
