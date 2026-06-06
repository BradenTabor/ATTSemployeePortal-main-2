import { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Sparkles,
  Shield,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useJobs, useCrewMembers } from '../../hooks/jobs';
import { calculateJobProgress } from '../../lib/jobProgressUtils';
import { JobList, JobCreationForm, JobTrackerErrorBoundary } from '../../components/jobs';
import type { JobFormData, JobStatus } from '../../types/jobs';
import { toast } from '../../lib/toast';
import { TextEffect } from '../../components/ui/TextEffect';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

function AdminJobTracker() {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin';
  const userId = user?.id || '';

  const {
    jobs,
    loading: jobsLoading,
    createJob,
    updateJob,
    deleteJob,
    updateJobStatus,
    toggleMilestone,
    stackJobs,
    unstackJobs,
  } = useJobs();

  const { crewMembers, loading: crewLoading } = useCrewMembers();

  const [showCreateForm, setShowCreateForm] = useState(false);

  // Calculate job statistics
  const jobStats = useMemo(() => {
    const stats = {
      active: 0,
      completed: 0,
      paused: 0,
      exceeded: 0,
      totalMilestones: 0,
      completedMilestones: 0,
      totalCrew: new Set<string>(),
    };

    jobs.forEach(job => {
      if (job.status === 'active') stats.active++;
      if (job.status === 'completed') stats.completed++;
      if (job.status === 'paused') stats.paused++;

      // Check if active timeline-based job has exceeded timeline
      // Span-based jobs don't have timeline exceeded status
      if (job.status === 'active' && job.tracking_type !== 'job_progress') {
        const progress = calculateJobProgress(job.start_date, job.end_date);
        if (progress.status === 'exceeded') stats.exceeded++;
      }

      // Count milestones
      job.milestones?.forEach(m => {
        stats.totalMilestones++;
        if (m.is_completed) stats.completedMilestones++;
      });

      // Count unique crew members
      job.crew_assignments?.forEach(a => stats.totalCrew.add(a.user_id));
    });

    return stats;
  }, [jobs]);

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  const handleCreateJob = useCallback(async (data: JobFormData) => {
    const result = await createJob(data, userId);
    if (result.success) {
      setShowCreateForm(false);
      toast.success(`Job "${data.job_name}" created successfully`);
    } else {
      toast.error(result.error || 'Failed to create job');
    }
    return result;
  }, [createJob, userId]);

  const handleUpdateJob = useCallback(async (jobId: string, data: JobFormData) => {
    const result = await updateJob(jobId, data, userId);
    if (result.success) {
      toast.success('Job updated successfully');
    } else {
      toast.error(result.error || 'Failed to update job');
    }
    return result;
  }, [updateJob, userId]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    const result = await deleteJob(jobId);
    if (result.success) {
      toast.success('Job deleted successfully');
    } else {
      toast.error(result.error || 'Failed to delete job');
    }
    return result;
  }, [deleteJob]);

  const handleStatusChange = useCallback(async (jobId: string, status: JobStatus) => {
    const result = await updateJobStatus(jobId, status);
    if (result.success) {
      toast.success(`Job status updated to ${status}`);
    } else {
      toast.error(result.error || 'Failed to update status');
    }
    return result;
  }, [updateJobStatus]);

  const handleToggleMilestone = useCallback(async (milestoneId: string, isCompleted: boolean) => {
    const result = await toggleMilestone(milestoneId, isCompleted, userId);
    if (result.success) {
      toast.success(isCompleted ? 'Milestone completed' : 'Milestone uncompleted');
    } else {
      toast.error(result.error || 'Failed to update milestone');
    }
    return result;
  }, [toggleMilestone, userId]);

  // Access denied for non-admins
  if (!isAdmin) {
    return (
      <DashboardLayout title="Job Tracker" pageHeading>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">
              You do not have permission to view this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Job Progress Tracker" pageHeading>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Premium Glass Header - Gold Theme */}
        <div className="mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div 
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background: 'linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)',
                backdropFilter: 'blur(24px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, transparent 50%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.2) 0%, transparent 45%)' }} />
              <div className="absolute top-0 left-0 w-32 h-32 pointer-events-none" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)' }} />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />
              <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-l-[inherit]" />

              <div className="relative px-5 py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
                    <Sparkles className="w-3.5 h-3.5 text-[#f4c979]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f8e5bb]">Admin • Job Management</span>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20">
                    <Briefcase className="w-3 h-3 text-[#f4c979]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">{jobs.length} total jobs</span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-4">
                  <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(244, 201, 121, 0.5), 0 0 40px rgba(244, 201, 121, 0.25)' }} />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,201,121,0.35)]">
                        Job Progress Tracker
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">Job Progress Tracker</h1>
                    )}
                    <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium leading-relaxed max-w-xl">
                      Create, assign, and monitor job timelines with real-time progress tracking
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        <JobTrackerErrorBoundary>
          <div className="space-y-8">
            {/* Warning banner for exceeded jobs */}
            <AnimatePresence>
              {jobStats.exceeded > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <div>
                      <p className="text-sm font-semibold text-red-400">
                        {jobStats.exceeded} job{jobStats.exceeded !== 1 ? 's have' : ' has'} exceeded their timeline
                      </p>
                      <p className="text-xs text-red-400/70 mt-0.5">
                        Review and update status or extend deadlines as needed.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Create button for main content area */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#f4c979]/10 border border-[#f4c979]/30">
                  <Briefcase className="w-5 h-5 text-[#f4c979]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">All Jobs</h3>
                  <p className="text-xs text-white/50">Manage and monitor job progress</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] text-sm font-semibold hover:shadow-[0_0_20px_rgba(244,201,121,0.3)] transition-shadow"
              >
                <Plus className="w-4 h-4" />
                Create Job
              </motion.button>
            </motion.div>

            {/* Job List */}
            <JobList
              jobs={jobs}
              crewMembers={crewMembers}
              crewLoading={crewLoading}
              loading={jobsLoading}
              onUpdate={handleUpdateJob}
              onDelete={handleDeleteJob}
              onStatusChange={handleStatusChange}
              onToggleMilestone={handleToggleMilestone}
              onStackJobs={stackJobs}
              onUnstackJobs={unstackJobs}
              userId={userId}
            />
          </div>
        </JobTrackerErrorBoundary>

        {/* Create Job Modal */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowCreateForm(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-6 shadow-[0_40px_80px_rgba(0,0,0,0.7)]"
              >
                <JobCreationForm
                  crewMembers={crewMembers}
                  crewLoading={crewLoading}
                  onSubmit={handleCreateJob}
                  onCancel={() => setShowCreateForm(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

export default memo(AdminJobTracker);

