import { useCallback, memo, useMemo, Suspense, lazy, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ScrollReveal } from '../motion';
import {
  RefreshCw,
  Inbox,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';
import { DashboardAvatar } from '../components/dashboard/DashboardAvatar';
import ProfileBar from '../components/ProfileBar';
import { useAuth } from '../contexts/AuthContext';
import { useUserAssignedJobs } from '../hooks/jobs';
import DashboardLayout from '../layouts/DashboardLayout';
import { PERSISTENCE_KEYS } from '../lib/persistence';
import { TextEffect } from '../components/ui/TextEffect';
import { getDeviceCapabilities } from '../lib/mobilePerf';
import { ExpandableSection } from '../components/dashboard/ExpandableSection';
import { CompactJobCard } from '../components/jobs';
import {
  perfMark,
  perfMeasure,
  initLongTaskObserver,
} from '../lib/mobilePerf';
import type { JobProgressTracker } from '../types/jobs';

// Lazy-loaded components for code splitting
const DashboardAnnouncementCard = lazy(
  () => import('../components/DashboardAnnouncementCard')
);
const NavCards = lazy(() => import('../components/NavCards'));

// ============================================================================
// SKELETON LOADERS
// ============================================================================

const AnnouncementCardSkeleton = memo(function AnnouncementCardSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#041b14]/70 p-5 space-y-3 animate-pulse">
      <div className="h-3 w-32 bg-white/10 rounded-full" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-white/10 rounded-full" />
        <div className="h-3 w-3/4 bg-white/10 rounded-full" />
        <div className="h-3 w-2/3 bg-white/5 rounded-full" />
      </div>
    </div>
  );
});

const JobCardSkeleton = memo(function JobCardSkeleton() {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-[#041510]/80 p-3 md:p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="h-4 w-32 bg-white/10 rounded mb-2" />
          <div className="h-3 w-24 bg-white/5 rounded" />
        </div>
        <div className="h-8 w-12 bg-emerald-500/10 rounded-lg" />
      </div>
      <div className="ml-5 h-1.5 bg-white/5 rounded-full" />
    </div>
  );
});

const NavCardsSkeleton = memo(function NavCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={`nav-skeleton-${idx}`}
          className="rounded-2xl border border-white/10 bg-white/5 h-28 md:h-32 animate-pulse"
        />
      ))}
    </div>
  );
});

// ============================================================================
// EMPTY & ERROR STATES
// ============================================================================

const EmptyJobsState = memo(function EmptyJobsState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
        <Inbox className="w-6 h-6 text-emerald-400/60" />
      </div>
      <p className="text-sm text-white/60 font-medium">No active assignments</p>
      <p className="text-xs text-white/40 mt-1">Jobs assigned to you will appear here</p>
    </div>
  );
});

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState = memo(function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5 text-red-400" />
      </div>
      <p className="text-sm text-red-400 font-medium">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 min-h-[44px]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      )}
    </div>
  );
});

// ============================================================================
// NAVIGABLE JOB CARD - Navigates to Assigned Jobs page on click
// ============================================================================

interface NavigableJobCardProps {
  job: JobProgressTracker;
}

const NavigableJobCard = memo(
  function NavigableJobCard({ job }: NavigableJobCardProps) {
    const navigate = useNavigate();

    const handleClick = useCallback(() => {
      navigate(`/assigned-jobs?job=${job.id}`);
    }, [navigate, job.id]);

    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={handleClick}
        className="cursor-pointer"
      >
        <CompactJobCard job={job} />
      </motion.div>
    );
  },
  // Custom comparison to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    // Re-render only if job data changed or if it's a different job
    return (
      prevProps.job.id === nextProps.job.id &&
      prevProps.job.status === nextProps.job.status &&
      // Check for progress changes
      JSON.stringify(prevProps.job.progress_updates?.length) === 
        JSON.stringify(nextProps.job.progress_updates?.length) &&
      JSON.stringify(prevProps.job.milestones?.filter(m => m.is_completed).length) ===
        JSON.stringify(nextProps.job.milestones?.filter(m => m.is_completed).length)
    );
  }
);

// ============================================================================
// ASSIGNED JOBS SECTION - Isolated with progressive rendering
// ============================================================================

interface AssignedJobsSectionProps {
  jobs: JobProgressTracker[];
  loading: boolean;
  error: string | null;
  onRefetch: () => void;
}

const AssignedJobsSection = memo(function AssignedJobsSection({
  jobs,
  loading,
  error,
  onRefetch,
}: AssignedJobsSectionProps) {
  const caps = getDeviceCapabilities();
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <JobCardSkeleton key={`job-skeleton-${i}`} />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefetch} />;
  }

  if (jobs.length === 0) {
    return <EmptyJobsState />;
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 120, damping: 20 }}
      className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-[28px] border border-emerald-400/30 shadow-[0_4px_30px_-10px_rgba(16,185,129,0.35),0_2px_12px_-6px_rgba(0,0,0,0.4)] sm:shadow-[0_8px_60px_-15px_rgba(16,185,129,0.4),0_4px_20px_-8px_rgba(0,0,0,0.5)]"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 1) 50%, rgba(1, 8, 5, 1) 100%)',
      }}
    >
      {/* Outer glow border effect - reduced on mobile */}
      <div className="absolute -inset-[1px] rounded-[inherit] bg-gradient-to-br from-emerald-400/40 via-emerald-500/20 to-emerald-600/30 opacity-40 sm:opacity-50 blur-[1px] pointer-events-none" />
      
      {/* Animated rotating gradient ring - only with animations */}
      {enableAnimations && (
        <motion.div
          className="absolute -inset-[2px] rounded-[inherit] opacity-40 pointer-events-none"
          style={{
            background: 'conic-gradient(from 0deg, transparent 0%, rgba(16, 185, 129, 0.5) 10%, transparent 25%, transparent 50%, rgba(52, 211, 153, 0.3) 60%, transparent 75%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      )}
      
      {/* Inner container with solid bg */}
      <div 
        className="relative rounded-[inherit] overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.99) 0%, rgba(2, 15, 10, 1) 50%, rgba(1, 8, 5, 1) 100%)',
        }}
      >
        {/* Premium top shine line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
        
        {/* Floating orbs - only on desktop */}
        {enableAnimations && (
          <>
            <motion.div
              className="absolute w-48 h-48 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
                top: '-15%',
                left: '-10%',
                filter: 'blur(30px)',
              }}
              animate={{ 
                x: [0, 15, 0],
                y: [0, 10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute w-36 h-36 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(52, 211, 153, 0.15) 0%, transparent 70%)',
                bottom: '-10%',
                right: '-5%',
                filter: 'blur(25px)',
              }}
              animate={{ 
                x: [0, -10, 0],
                y: [0, -8, 0],
                scale: [1, 1.12, 1],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
          </>
        )}
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(16, 185, 129, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(16, 185, 129, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '35px 35px',
          }}
        />
        
        {/* Corner accent decorations - hidden on smallest screens */}
        <div className="hidden sm:block absolute top-2 sm:top-2.5 right-2 sm:right-2.5 w-8 sm:w-12 h-8 sm:h-12 pointer-events-none opacity-25 sm:opacity-30">
          <div className="absolute top-0 right-0 w-4 sm:w-6 h-[1px] bg-gradient-to-l from-emerald-400/70 to-transparent" />
          <div className="absolute top-0 right-0 w-[1px] h-4 sm:h-6 bg-gradient-to-b from-emerald-400/70 to-transparent" />
        </div>
        <div className="hidden sm:block absolute bottom-2 sm:bottom-2.5 left-2 sm:left-2.5 w-8 sm:w-12 h-8 sm:h-12 pointer-events-none opacity-25 sm:opacity-30">
          <div className="absolute bottom-0 left-0 w-4 sm:w-6 h-[1px] bg-gradient-to-r from-emerald-400/70 to-transparent" />
          <div className="absolute bottom-0 left-0 w-[1px] h-4 sm:h-6 bg-gradient-to-t from-emerald-400/70 to-transparent" />
        </div>

        {/* Content container - optimized for mobile */}
        <div className="relative p-3 sm:p-4 md:p-6">
          {/* Compact header row */}
          <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <motion.div 
                className="relative"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
              >
                {/* Badge glow - smaller on mobile */}
                <div className="absolute -inset-0.5 sm:-inset-1 rounded-full bg-emerald-400/20 blur-sm sm:blur-md" />
                <span className="relative inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-emerald-300/50 text-[9px] sm:text-xs font-bold tracking-[0.15em] sm:tracking-[0.25em] text-emerald-100 bg-gradient-to-r from-emerald-500/25 via-emerald-400/15 to-emerald-500/25 shadow-md shadow-emerald-500/15 backdrop-blur-sm">
                  <motion.div
                    animate={enableAnimations ? { rotate: [0, 15, -15, 0] } : undefined}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Briefcase className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-200" />
                  </motion.div>
                  <span className="hidden xs:inline">ACTIVE</span> JOBS
                </span>
              </motion.div>
              
              {/* Compact count badge */}
              <div className="flex items-center gap-1 text-[9px] sm:text-xs text-emerald-200/50 font-medium">
                <div className="w-1 h-1 rounded-full bg-emerald-400/60 animate-pulse" />
                <span className="tabular-nums">{jobs.length}</span>
              </div>
            </div>
          </div>

          {/* Jobs Grid - tighter spacing on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            {jobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03, duration: 0.25 }}
              >
                <NavigableJobCard job={job} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.article>
  );
});

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, setSession, role, fullName } = useAuth();

  // Initialize long task observer in dev mode
  useEffect(() => {
    const cleanup = initLongTaskObserver();
    return () => cleanup?.();
  }, []);

  // Display full_name if available, otherwise show full email
  const displayName = useMemo(() => fullName || user?.email || 'Employee', [fullName, user?.email]);

  // Fetch user's assigned jobs with optimized hook
  const {
    assignedJobs,
    loading: jobsLoading,
    error: jobsError,
    refetch: refetchJobs,
  } = useUserAssignedJobs(user?.id);

  // Stable sign out handler
  const handleSignOut = useCallback(async () => {
    perfMark('sign-out');
    try {
      setSession(null);
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      perfMeasure('sign-out');
    }
  }, [navigate, setSession, signOut]);

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  return (
    <DashboardLayout title="Employee Hub">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-6 sm:pt-8">
        {/* Premium Animated Welcome Section with Glass Backdrop */}
        <div className="mb-6 md:mb-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Glass backdrop container */}
            <div 
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.1) 0%, rgba(4, 30, 21, 0.65) 40%, rgba(0, 0, 0, 0.75) 100%)',
                backdropFilter: 'blur(24px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              }}
            >
              {/* Realistic glass gloss - diagonal shine reflection */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, transparent 50%, transparent 100%)',
                }}
              />
              
              {/* Secondary gloss layer - softer highlight */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%)',
                }}
              />
              
              {/* Inner emerald glow */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at 25% 0%, rgba(16, 185, 129, 0.2) 0%, transparent 45%)',
                }}
              />
              
              {/* Specular highlight - corner gleam */}
              <div 
                className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)',
                }}
              />
              
              {/* Top edge highlight - brighter for glass effect */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />
              
              {/* Left edge highlight */}
              <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-l-[inherit]" />
              
              {/* Content area */}
              <div className="relative px-5 py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-4">
                  {/* Subtle gradient line accent */}
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-1 h-12 md:h-14 rounded-full bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 origin-top flex-shrink-0"
                    style={{
                      boxShadow: '0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.25)',
                    }}
                  />
                  
                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect
                        as="h1"
                        preset="blurSlide"
                        per="char"
                        delay={0.15}
                        className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight"
                        segmentWrapperClassName="bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(125,225,180,0.35)]"
                      >
                        {`Welcome back, ${displayName}`}
                      </TextEffect>
                    ) : (
                      <h1 
                        className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-emerald-100 to-white/90 bg-clip-text text-transparent"
                      >
                        {`Welcome back, ${displayName}`}
                      </h1>
                    )}
                    
                    {/* Subtle tagline with fade-in */}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7, ease: 'easeOut' }}
                      className="mt-1 md:mt-1.5 text-xs sm:text-sm md:text-base text-emerald-300/40 font-medium tracking-wide"
                    >
                      Your command center awaits
                    </motion.p>
                  </div>
                </div>
              </div>
              
              {/* Bottom edge - subtle dark line for depth */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              
              {/* Right edge subtle shadow for 3D depth */}
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        {/* Mobile-first Bento layout */}
        <div className="w-full space-y-4 md:space-y-6">
          {/* Section 1: Announcements - Clean direct display */}
          <ScrollReveal variant="fadeUp" delay={0}>
            <Suspense fallback={<AnnouncementCardSkeleton />}>
              <DashboardAnnouncementCard />
            </Suspense>
          </ScrollReveal>

          {/* Section 2: Assigned Jobs - Clean floating grid display */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <AssignedJobsSection
              jobs={assignedJobs}
              loading={jobsLoading}
              error={jobsError}
              onRefetch={refetchJobs}
            />
          </ScrollReveal>

          {/* Section 3: All Tools & Features */}
          <ScrollReveal variant="fadeUp" delay={0.2}>
            <ExpandableSection
              id="dashboard-all-tools"
              title="All Tools & Features"
              subtitle="Complete navigation menu"
              icon={<DashboardAvatar variant="tools" className="w-8 h-8 md:w-10 md:h-10" />}
              storageKey={PERSISTENCE_KEYS.ALL_TOOLS}
              defaultOpen={false}
            >
              <Suspense fallback={<NavCardsSkeleton />}>
                <NavCards />
              </Suspense>
            </ExpandableSection>
          </ScrollReveal>

          {/* Profile Bar - Bottom section */}
          <ScrollReveal variant="fadeUp" delay={0.25}>
            <ProfileBar
              email={user?.email}
              role={role}
              onSignOut={handleSignOut}
              theme="emerald"
            />
          </ScrollReveal>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default memo(Dashboard);
