import { memo, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Calendar,
  FileText,
  ClipboardList,
  StickyNote,
  Users,
  Target,
  CheckCircle2,
  Circle,
  Edit3,
  Trash2,
  Play,
  Pause,
  Check,
  XCircle,
  Loader2,
  Undo2,
  Ruler,
  Lock,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  formatDateForDisplay, 
  formatDateRange, 
  calculateMilestoneProgress,
  calculateSpanProgress,
  formatSpanProgressLabel,
  getSpanProgressColors,
} from '../../lib/jobProgressUtils';
import { JobProgressBar } from './JobProgressBar';
import { JobCreationForm } from './JobCreationForm';
import { useCanViewJobProgress } from '../../hooks/useCanViewJobProgress';
import type { JobProgressTracker, JobStatus, JobFormData, CrewMember } from '../../types/jobs';
import { JOB_STATUS_CONFIG } from '../../types/jobs';

interface JobDetailModalProps {
  job: JobProgressTracker;
  crewMembers: CrewMember[];
  crewLoading?: boolean;
  onClose: () => void;
  onUpdate: (jobId: string, data: JobFormData, userId: string) => Promise<{ success: boolean; error?: string }>;
  onDelete: (jobId: string) => Promise<{ success: boolean; error?: string }>;
  onStatusChange: (jobId: string, status: JobStatus) => Promise<{ success: boolean; error?: string }>;
  onToggleMilestone: (milestoneId: string, isCompleted: boolean, userId: string) => Promise<{ success: boolean; error?: string }>;
  userId: string;
}

function JobDetailModalComponent({
  job,
  crewMembers,
  crewLoading,
  onClose,
  onUpdate,
  onDelete,
  onStatusChange,
  onToggleMilestone,
  userId,
}: JobDetailModalProps) {
  const { canViewProgress } = useCanViewJobProgress();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [togglingMilestone, setTogglingMilestone] = useState<string | null>(null);
  
  // Optimistic state for milestones
  const [optimisticMilestones, setOptimisticMilestones] = useState<Record<string, boolean>>({});
  
  // Milestone confirmation dialog state
  const [milestoneToToggle, setMilestoneToToggle] = useState<{
    id: string;
    title: string;
    isCompleted: boolean;
  } | null>(null);

  const statusConfig = JOB_STATUS_CONFIG[job.status as JobStatus];
  
  // Merge optimistic state with actual milestones
  const milestonesWithOptimistic = (job.milestones || []).map(m => ({
    ...m,
    is_completed: optimisticMilestones[m.id] !== undefined ? optimisticMilestones[m.id] : m.is_completed,
  }));
  
  const milestoneProgress = calculateMilestoneProgress(milestonesWithOptimistic);
  const crewAssignments = job.crew_assignments || [];
  
  // Calculate span-based progress for job_progress tracking type
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

  const handleUpdate = useCallback(async (data: JobFormData) => {
    const result = await onUpdate(job.id, data, userId);
    if (result.success) {
      setIsEditing(false);
    }
    return result;
  }, [job.id, onUpdate, userId]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    const result = await onDelete(job.id);
    if (result.success) {
      onClose();
    }
    setIsDeleting(false);
  }, [job.id, onDelete, onClose]);

  const handleStatusChange = useCallback(async (newStatus: JobStatus) => {
    setStatusUpdating(true);
    await onStatusChange(job.id, newStatus);
    setStatusUpdating(false);
  }, [job.id, onStatusChange]);

  // Open confirmation dialog when clicking a milestone
  const openMilestoneConfirm = useCallback((id: string, title: string, isCompleted: boolean) => {
    setMilestoneToToggle({ id, title, isCompleted });
  }, []);

  // Handle confirmed milestone toggle
  const handleConfirmedToggle = useCallback(async () => {
    if (!milestoneToToggle) return;
    
    const { id: milestoneId, isCompleted } = milestoneToToggle;
    const newState = !isCompleted;
    
    // Close the dialog
    setMilestoneToToggle(null);
    
    // Optimistically update the UI immediately
    setOptimisticMilestones(prev => ({ ...prev, [milestoneId]: newState }));
    setTogglingMilestone(milestoneId);
    
    const result = await onToggleMilestone(milestoneId, newState, userId);
    
    // If failed, revert the optimistic update
    if (!result.success) {
      setOptimisticMilestones(prev => {
        const next = { ...prev };
        delete next[milestoneId];
        return next;
      });
    } else {
      // Clear optimistic state after successful server update (data will refresh)
      setOptimisticMilestones(prev => {
        const next = { ...prev };
        delete next[milestoneId];
        return next;
      });
    }
    
    setTogglingMilestone(null);
  }, [milestoneToToggle, onToggleMilestone, userId]);

  // Cancel milestone toggle
  const cancelMilestoneToggle = useCallback(() => {
    setMilestoneToToggle(null);
  }, []);

  const statusActions = [
    { status: 'active' as JobStatus, icon: Play, label: 'Active', show: job.status !== 'active' },
    { status: 'paused' as JobStatus, icon: Pause, label: 'Pause', show: job.status === 'active' },
    { status: 'completed' as JobStatus, icon: Check, label: 'Complete', show: job.status !== 'completed' },
    { status: 'cancelled' as JobStatus, icon: XCircle, label: 'Cancel', show: job.status !== 'cancelled' },
  ].filter(a => a.show);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] shadow-[0_40px_80px_rgba(0,0,0,0.7)]"
      >
        {isEditing ? (
          <div className="p-6">
            <JobCreationForm
              crewMembers={crewMembers}
              crewLoading={crewLoading}
              onSubmit={handleUpdate}
              onCancel={() => setIsEditing(false)}
              initialData={job}
              isEditing
            />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-6 border-b border-white/10 bg-[#0b0906]/95 backdrop-blur-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className={cn(
                    'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
                    statusConfig.bgColor,
                    statusConfig.borderColor,
                    statusConfig.textColor
                  )}>
                    {statusConfig.label}
                  </span>
                  <span className="text-xs text-white/40">
                    Created {formatDateForDisplay(job.created_at)}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white">{job.job_name}</h2>
                {job.job_location && (
                  <p className="flex items-center gap-2 text-sm text-white/60 mt-1">
                    <MapPin className="w-4 h-4 text-[#f4c979]/60" />
                    {job.job_location}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close job details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress */}
            <div className="p-6 border-b border-white/10">
              {isSpanBased && spanProgress && spanProgressColors ? (
                // Span-based progress display
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-semibold border border-blue-500/40 bg-blue-500/10 text-blue-200">
                      <Ruler className="w-3 h-3 mr-1.5" />
                      SPAN-BASED TRACKING
                    </span>
                  </div>
                  
                  {canViewProgress ? (
                    <>
                      {/* Progress bar */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className={cn('font-medium', spanProgressColors.text)}>
                            {spanProgress.percentage}%
                          </span>
                          <span className="text-white/50">
                            {formatSpanProgressLabel(spanProgress)}
                          </span>
                        </div>
                        <div className={cn(
                          'relative w-full h-4 rounded-full overflow-hidden',
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
                      
                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                          <p className="text-xs text-white/50 mb-1">Completed</p>
                          <p className="text-lg font-bold text-emerald-400">
                            {spanProgress.completed.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-white/40">{spanProgress.metricLabel}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                          <p className="text-xs text-white/50 mb-1">Estimated</p>
                          <p className="text-lg font-bold text-[#f4c979]">
                            {spanProgress.total > 0 ? spanProgress.total.toLocaleString() : '—'}
                          </p>
                          <p className="text-[10px] text-white/40">{spanProgress.metricLabel}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                          <p className="text-xs text-white/50 mb-1">Remaining</p>
                          <p className="text-lg font-bold text-white/80">
                            {spanProgress.total > 0 ? spanProgress.remaining.toLocaleString() : '—'}
                          </p>
                          <p className="text-[10px] text-white/40">{spanProgress.metricLabel}</p>
                        </div>
                      </div>
                      
                      {/* No estimate warning */}
                      {spanProgress.total === 0 && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                          <p className="text-xs text-amber-300">
                            No estimated total set. Edit this job to add an estimated total for accurate progress tracking.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <Lock className="w-4 h-4 text-emerald-400/60" />
                      <span className="text-sm text-emerald-400/70 font-medium">
                        Progress visible to management only
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                // Timeline-based progress display (JobProgressBar handles its own restriction)
                <>
                  <JobProgressBar
                    startDate={job.start_date}
                    endDate={job.end_date}
                    size="lg"
                  />
                  <div className="flex items-center gap-2 mt-3 text-sm text-white/60">
                    <Calendar className="w-4 h-4 text-[#f4c979]/60" />
                    <span>{formatDateRange(job.start_date, job.end_date)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Description & Specs */}
              {(job.job_description || job.job_specs) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {job.job_description && (
                    <div className="rounded-2xl border border-white/10 bg-[#050402]/50 p-4">
                      <h4 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#f4c979]/70 mb-2">
                        <FileText className="w-4 h-4" />
                        Description
                      </h4>
                      <p className="text-sm text-white/80 whitespace-pre-wrap">{job.job_description}</p>
                    </div>
                  )}
                  {job.job_specs && (
                    <div className="rounded-2xl border border-white/10 bg-[#050402]/50 p-4">
                      <h4 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#f4c979]/70 mb-2">
                        <ClipboardList className="w-4 h-4" />
                        Specifications
                      </h4>
                      <p className="text-sm text-white/80 whitespace-pre-wrap">{job.job_specs}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Crew */}
              <div className="rounded-2xl border border-white/10 bg-[#050402]/50 p-4">
                <h4 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#f4c979]/70 mb-3">
                  <Users className="w-4 h-4" />
                  Assigned Crew ({crewAssignments.length})
                </h4>
                {crewAssignments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {crewAssignments.map((assignment) => {
                      const displayName = assignment.user_full_name || assignment.user_email;
                      const avatarInitial = (assignment.user_full_name?.[0] || assignment.user_email?.[0] || '?').toUpperCase();
                      return (
                        <div
                          key={assignment.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10"
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[10px] font-bold text-[#2d1c04]">
                            {avatarInitial}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-white/90 font-medium">
                              {displayName}
                            </span>
                            {assignment.user_full_name && assignment.user_email && (
                              <span className="text-xs text-white/50">
                                {assignment.user_email}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-white/40">No crew members assigned</p>
                )}
              </div>

              {/* Milestones */}
              {milestonesWithOptimistic.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#050402]/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#f4c979]/70">
                      <Target className="w-4 h-4" />
                      Milestones
                    </h4>
                    <span className="text-xs text-white/50">
                      {milestoneProgress.completed}/{milestoneProgress.total} complete
                    </span>
                  </div>
                  <div className="space-y-2">
                    {milestonesWithOptimistic.map((milestone) => (
                      <motion.button
                        key={milestone.id}
                        layout
                        onClick={() => openMilestoneConfirm(milestone.id, milestone.title, milestone.is_completed)}
                        disabled={togglingMilestone === milestone.id}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                          milestone.is_completed
                            ? 'border-emerald-500/30 bg-emerald-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:border-[#f4c979]/30'
                        )}
                      >
                        {togglingMilestone === milestone.id ? (
                          <Loader2 className="w-5 h-5 text-[#f4c979] animate-spin" />
                        ) : milestone.is_completed ? (
                          <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          >
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          </motion.div>
                        ) : (
                          <Circle className="w-5 h-5 text-white/30 group-hover:text-[#f4c979]/50" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-medium transition-all',
                            milestone.is_completed ? 'text-white/60 line-through' : 'text-white'
                          )}>
                            {milestone.title}
                          </p>
                          {milestone.description && (
                            <p className="text-xs text-white/40 mt-0.5 truncate">
                              {milestone.description}
                            </p>
                          )}
                        </div>
                        {milestone.target_date && (
                          <span className="text-xs text-white/40">
                            {formatDateForDisplay(milestone.target_date)}
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {job.notes && (
                <div className="rounded-2xl border border-white/10 bg-[#050402]/50 p-4">
                  <h4 className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#f4c979]/70 mb-2">
                    <StickyNote className="w-4 h-4" />
                    Notes
                  </h4>
                  <p className="text-sm text-white/80 whitespace-pre-wrap">{job.notes}</p>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="sticky bottom-0 flex items-center justify-between gap-4 p-6 border-t border-white/10 bg-[#0b0906]/95 backdrop-blur-sm">
              {/* Status actions */}
              <div className="flex items-center gap-2">
                {statusActions.map((action) => (
                  <button
                    key={action.status}
                    onClick={() => handleStatusChange(action.status)}
                    disabled={statusUpdating}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                      action.status === 'cancelled'
                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                        : action.status === 'completed'
                        ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        : 'border-white/20 text-white/70 hover:bg-white/5'
                    )}
                  >
                    {statusUpdating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <action.icon className="w-3.5 h-3.5" />
                    )}
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Edit/Delete actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#f4c979]/30 text-[#f4c979] text-xs font-semibold hover:bg-[#f4c979]/10 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                
                <AnimatePresence>
                  {showDeleteConfirm ? (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="flex items-center gap-2"
                    >
                      <span className="text-xs text-red-400">Delete?</span>
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-colors"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Yes'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-3 py-2 rounded-xl border border-white/20 text-white/60 text-xs font-semibold hover:bg-white/5 transition-colors"
                      >
                        No
                      </button>
                    </motion.div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </motion.div>

      {/* Milestone Confirmation Dialog */}
      <AnimatePresence>
        {milestoneToToggle && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={cancelMilestoneToggle}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#f6dcb2]/30 bg-gradient-to-br from-[#1a1610] via-[#0f0d0a] to-[#080705] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.8)]"
            >
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center',
                  milestoneToToggle.isCompleted
                    ? 'bg-amber-500/15 border border-amber-500/30'
                    : 'bg-emerald-500/15 border border-emerald-500/30'
                )}>
                  {milestoneToToggle.isCompleted ? (
                    <Undo2 className="w-7 h-7 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                  )}
                </div>
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-white text-center mb-2">
                {milestoneToToggle.isCompleted ? 'Undo Milestone?' : 'Complete Milestone?'}
              </h3>

              {/* Description */}
              <p className="text-sm text-white/60 text-center mb-2">
                {milestoneToToggle.isCompleted
                  ? 'Are you sure you want to mark this milestone as incomplete?'
                  : 'Are you sure you want to mark this milestone as complete?'}
              </p>

              {/* Milestone name */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 mb-6">
                <p className="text-sm text-[#f4c979] font-medium text-center">
                  "{milestoneToToggle.title}"
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={cancelMilestoneToggle}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white/70 text-sm font-semibold hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmedToggle}
                  className={cn(
                    'flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all',
                    milestoneToToggle.isCompleted
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                      : 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  )}
                >
                  {milestoneToToggle.isCompleted ? 'Undo' : 'Complete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export const JobDetailModal = memo(JobDetailModalComponent);

