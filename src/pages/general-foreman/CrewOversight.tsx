import { useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  HardHat,
  AlertTriangle,
  Users,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useJobs } from '../../hooks/jobs';
import { calculateJobProgress } from '../../lib/jobProgressUtils';
import { CrewOversightJobList, JobTrackerErrorBoundary } from '../../components/jobs';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import { glass } from '../../lib/glass';

function CrewOversight() {
  const { role } = useAuth();
  const isAuthorized = role === 'general_foreman' || role === 'admin';

  const {
    jobs,
    loading: jobsLoading,
  } = useJobs();

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
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  // Access denied for unauthorized users
  if (!isAuthorized) {
    return (
      <DashboardLayout title="Crew Oversight">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-[#c084fc]/10 flex items-center justify-center mx-auto mb-4">
              <HardHat className="w-10 h-10 text-[#c084fc]" />
            </div>
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
    <DashboardLayout title="Crew Oversight">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Compact header — solid premium surface */}
        <header className="mb-4 sm:mb-6">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`${glass.cardPurple} px-5 py-4 sm:px-6 sm:py-5`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-400/25 text-[10px] font-semibold uppercase tracking-wider text-purple-200">
                <HardHat className="w-3.5 h-3.5" aria-hidden />
                General Foreman
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/20 border border-purple-500/15 text-[10px] font-medium text-purple-200/70 tabular-nums">
                <Briefcase className="w-3 h-3" aria-hidden />
                {jobs.length} jobs
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/20 border border-purple-500/15 text-[10px] font-medium text-purple-200/70 tabular-nums">
                <Users className="w-3 h-3" aria-hidden />
                {jobStats.totalCrew.size} crew
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1 h-10 sm:h-12 rounded-full bg-gradient-to-b from-purple-400 via-violet-500 to-purple-600 flex-shrink-0" aria-hidden />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Crew Oversight
                </h1>
                <p className="text-xs sm:text-sm text-white/50 mt-0.5">
                  Monitor crew assignments and job progress
                </p>
              </div>
            </div>
          </motion.div>
        </header>

        <JobTrackerErrorBoundary>
          <div className="space-y-3 sm:space-y-4">
            {/* Warning banner for exceeded jobs - Compact */}
            <AnimatePresence>
              {jobStats.exceeded > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl sm:rounded-2xl border border-red-500/30 bg-red-500/10 p-2.5 sm:p-3"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-red-400">
                        {jobStats.exceeded} job{jobStats.exceeded !== 1 ? 's' : ''} exceeded timeline
                      </p>
                      <p className="text-[10px] sm:text-xs text-red-400/70 mt-0.5 hidden sm:block">
                        Contact admin to review and update status.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Section header - Compact */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <div className="p-1.5 rounded-lg bg-[#c084fc]/10 border border-[#c084fc]/30">
                <Briefcase className="w-4 h-4 text-[#c084fc]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">All Jobs</h3>
                <p className="text-[10px] sm:text-xs text-white/50">View crew assignments and progress</p>
              </div>
            </motion.div>

            {/* Read-only Job List with purple theme */}
            <CrewOversightJobList
              jobs={jobs}
              loading={jobsLoading}
            />
          </div>
        </JobTrackerErrorBoundary>
      </div>
    </DashboardLayout>
  );
}

export default memo(CrewOversight);
