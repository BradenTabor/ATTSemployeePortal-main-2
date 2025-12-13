import { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Sparkles,
  Shield,
  AlertTriangle,
  Plus,
  Target,
  Users,
} from 'lucide-react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../contexts/AuthContext';
import { useJobs, useCrewMembers } from '../hooks/jobs';
import { calculateJobProgress } from '../lib/jobProgressUtils';
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from '../components/admin/AdminPremiumScaffold';
import { JobList, JobCreationForm, JobTrackerErrorBoundary } from '../components/jobs';
import type { JobFormData, JobStatus } from '../types/jobs';
import { toast } from '../lib/toast';

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

  const heroStats = useMemo<AdminStat[]>(() => [
    {
      label: 'Active Jobs',
      value: String(jobStats.active),
      hint: 'Currently in progress',
    },
    {
      label: 'Completed',
      value: String(jobStats.completed),
      hint: 'Finished jobs',
    },
    {
      label: 'Timeline Exceeded',
      value: String(jobStats.exceeded),
      hint: jobStats.exceeded > 0 ? 'Needs attention' : 'All on track',
    },
  ], [jobStats]);

  const heroConfig = useMemo<AdminHeroConfig>(() => ({
    eyebrow: 'Admin • Job Management',
    eyebrowIcon: <Sparkles className="w-4 h-4 text-[#f8dda7]" />,
    heading: 'Job Progress Tracker',
    description:
      'Create, assign, and monitor job timelines with real-time progress tracking and milestone management.',
    badges: [
      {
        label: `${jobs.length} total jobs`,
        icon: <Briefcase className="w-4 h-4 text-[#f4c979]" />,
      },
      {
        label: `${jobStats.totalCrew.size} crew assigned`,
        icon: <Users className="w-4 h-4 text-[#f4c979]" />,
        variant: 'outline',
      },
    ],
  }), [jobs.length, jobStats.totalCrew.size]);

  const sidePanel = (
    <div className="space-y-5 text-sm text-[#fdf4db]/80">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-[#1b1812] border border-[#f6dcb2]/30">
          <Target className="w-5 h-5 text-[#f8dda7]" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#f7e7c3]">
            Quick Stats
          </p>
          <p className="text-[#fdf4db] font-semibold">Milestone Progress</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#050402]/50 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">Total Milestones</span>
          <span className="text-[#f4c979] font-semibold">{jobStats.totalMilestones}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">Completed</span>
          <span className="text-emerald-400 font-semibold">{jobStats.completedMilestones}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#f4c979] to-[#d79a32]"
            style={{
              width: `${jobStats.totalMilestones > 0 ? (jobStats.completedMilestones / jobStats.totalMilestones) * 100 : 0}%`
            }}
          />
        </div>
      </div>

      <ul className="space-y-3 text-xs text-[#f5e3c0]/80">
        <li className="flex gap-2">
          <span className="text-[#f6dcb2]">•</span>
          Active jobs show real-time progress based on their timeline.
        </li>
        <li className="flex gap-2">
          <span className="text-[#f6dcb2]">•</span>
          Exceeded timelines are highlighted in red for immediate attention.
        </li>
        <li className="flex gap-2">
          <span className="text-[#f6dcb2]">•</span>
          Assign crew members to notify them of their job assignments.
        </li>
      </ul>

      {/* Quick action button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowCreateForm(true)}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] text-sm font-semibold hover:shadow-[0_0_20px_rgba(244,201,121,0.3)] transition-shadow"
      >
        <Plus className="w-4 h-4" />
        Create New Job
      </motion.button>
    </div>
  );

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
      <DashboardLayout title="Job Tracker">
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
    <DashboardLayout title="Job Progress Tracker">
      <AdminPremiumScaffold
        hero={heroConfig}
        stats={heroStats}
        sidePanel={sidePanel}
        theme="gold"
      >
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
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}

export default memo(AdminJobTracker);

