import { useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Sparkles,
  HardHat,
  AlertTriangle,
  Users,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { useJobs } from '../../hooks/jobs';
import { calculateJobProgress } from '../../lib/jobProgressUtils';
import { CrewOversightJobList, JobTrackerErrorBoundary } from '../../components/jobs';
import { TextEffect } from '../../components/ui/TextEffect';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

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
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

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
        {/* Premium Glass Header - Purple Theme */}
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
                background: 'linear-gradient(145deg, rgba(45, 27, 78, 0.6) 0%, rgba(26, 15, 46, 0.5) 50%, rgba(10, 5, 19, 0.4) 100%)',
                boxShadow: 'inset 0 0 15px rgba(192, 132, 252, 0.05), 0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)' }} />
              <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(192, 132, 252, 0.3) 0%, transparent 70%)', filter: 'blur(15px)' }} />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
              <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-white/[0.1] to-transparent" />
              <div className="absolute top-0 bottom-0 right-0 w-[1px] bg-gradient-to-b from-transparent via-black/[0.1] to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/[0.15] to-transparent" />

              <div className="relative px-5 py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#c084fc]/15 border border-[#c084fc]/30">
                    <Sparkles className="w-3.5 h-3.5 text-[#c084fc]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#e9d5ff]">General Foreman</span>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2d1b4e]/60 border border-[#c084fc]/20">
                    <Briefcase className="w-3 h-3 text-[#c084fc]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#e9d5ff]/70">{jobs.length} jobs</span>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.35 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2d1b4e]/60 border border-[#c084fc]/20">
                    <Users className="w-3 h-3 text-[#c084fc]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#e9d5ff]/70">{jobStats.totalCrew.size} crew</span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-4">
                  <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#c084fc] via-[#a855f7] to-[#7c3aed] origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(192, 132, 252, 0.4), 0 0 40px rgba(192, 132, 252, 0.2)' }} />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-[#e9d5ff] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(192,132,252,0.3)]">
                        Crew Oversight
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#e9d5ff] to-white/90 bg-clip-text text-transparent">Crew Oversight</h1>
                    )}
                    <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#e9d5ff]/50 font-medium leading-relaxed max-w-xl">
                      Monitor crew assignments and job progress
                    </motion.p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

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
