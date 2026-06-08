import { useCallback, memo, useMemo, Suspense, lazy, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { ScrollReveal } from '../motion';
import {
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserAssignedJobs } from '../hooks/jobs';
import { useProfileDiscoveryToast } from '../hooks/useProfileDiscoveryToast';
import { useGamificationWelcomeOnMount } from '@/hooks/gamification/useGamificationWelcomeOnMount';
import DashboardLayout from '../layouts/DashboardLayout';
import { PERSISTENCE_KEYS } from '../lib/persistence';
import {
  perfMark,
  perfMeasure,
  initLongTaskObserver,
} from '../lib/mobilePerf';
import { logger } from '../lib/logger';
import { getRoleDashboard } from '../lib/navigation';
import { trackDashboardAction } from '../lib/telemetry';
import { useTotalPoints } from '../hooks/useAnnouncementRewards';
import type { JobProgressTracker } from '../types/jobs';

// Dashboard components
import {
  ExpandableSection,
  WelcomeHeader,
  CompactComplianceStrip,
  DashboardGrid,
  StackedLayout,
  FloatingActionButton,
  PinnedFavorites,
  PullToRefresh,
  WelcomeHeaderSkeleton,
  JobsSectionSkeleton,
  EnhancedNavCardsSkeleton,
  EnhancedEmptyJobsState,
  FeaturedAnnouncementSection,
  GoodCatchPrompt,
} from '../components/dashboard';
import { CompactJobCard, StackedJobCard } from '../components/jobs';
import { EnableNotificationsButton } from '../components/notifications';
import { OfflineModeBanner } from '../components/OfflineModeBanner';
import { RecentlySynced } from '../components/RecentlySynced';

// Lazy-loaded components for code splitting
const NavCards = lazy(() => import('../components/NavCards'));
const ProgressWidget = lazy(
  () => import('../components/gamification/ProgressWidget')
);

// ============================================================================
// ERROR STATE
// ============================================================================

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
          type="button"
          onClick={onRetry}
          aria-label="Try again"
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] min-h-[44px]"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden />
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

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] rounded-xl';

const NavigableJobCard = memo(
  function NavigableJobCard({ job }: NavigableJobCardProps) {
    return (
      <Link
        to={`/assigned-jobs?job=${job.id}`}
        className={`block cursor-pointer ${FOCUS_RING}`}
        aria-label={`View job ${job.job_name || job.id}`}
        onClick={() => trackDashboardAction({ action: 'job_card_click', job_id: job.id })}
      >
        <motion.div
          whileHover={{ scale: 1.01, y: -1 }}
          whileTap={{ scale: 0.98, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="rounded-xl"
        >
          <CompactJobCard job={job} />
        </motion.div>
      </Link>
    );
  },
  (prevProps, nextProps) => {
    const prev = prevProps.job;
    const next = nextProps.job;
    return (
      prev.id === next.id &&
      prev.status === next.status &&
      (prev.progress_updates?.length ?? 0) === (next.progress_updates?.length ?? 0) &&
      (prev.milestones?.filter((m) => m.is_completed).length ?? 0) ===
        (next.milestones?.filter((m) => m.is_completed).length ?? 0)
    );
  }
);

// ============================================================================
// NAVIGABLE STACKED JOB CARD
// ============================================================================

interface NavigableStackedJobCardProps {
  jobs: JobProgressTracker[];
}

const NavigableStackedJobCard = memo(function NavigableStackedJobCard({ 
  jobs 
}: NavigableStackedJobCardProps) {
  const navigate = useNavigate();

  const handleSelectJob = useCallback((jobId: string) => {
    navigate(`/assigned-jobs?job=${jobId}`);
  }, [navigate]);

  return (
    <StackedJobCard
      jobs={jobs}
      onSelectJob={handleSelectJob}
    />
  );
});

// ============================================================================
// ASSIGNED JOBS SECTION
// ============================================================================

interface AssignedJobsSectionProps {
  jobs: JobProgressTracker[];
  loading: boolean;
  error: string | null;
  onRefetch: () => void;
  /** When true, only render body (grid + show more) for use inside ExpandableSection */
  hideHeader?: boolean;
}

type JobDisplayItem = 
  | { type: 'group'; groupId: string; jobs: JobProgressTracker[] }
  | { type: 'job'; job: JobProgressTracker };

const AssignedJobsSection = memo(function AssignedJobsSection({
  jobs,
  loading,
  error,
  onRefetch,
  hideHeader = false,
}: AssignedJobsSectionProps) {
  // Group jobs by job_group_id for stacked display
  const displayItems = useMemo(() => {
    const groupMap = new Map<string, JobProgressTracker[]>();
    const ungrouped: JobProgressTracker[] = [];
    
    jobs.forEach(job => {
      if (job.job_group_id) {
        const existing = groupMap.get(job.job_group_id) || [];
        existing.push(job);
        groupMap.set(job.job_group_id, existing);
      } else {
        ungrouped.push(job);
      }
    });
    
    const items: JobDisplayItem[] = [];
    
    const groups = Array.from(groupMap.entries());
    groups.sort((a, b) => {
      const aDate = new Date(a[1][0]?.created_at || 0).getTime();
      const bDate = new Date(b[1][0]?.created_at || 0).getTime();
      return bDate - aDate;
    });
    groups.forEach(([groupId, groupJobs]) => {
      items.push({ type: 'group', groupId, jobs: groupJobs });
    });
    
    ungrouped.forEach(job => items.push({ type: 'job', job }));
    
    return items;
  }, [jobs]);

  if (loading) {
    return <JobsSectionSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefetch} />;
  }

  if (jobs.length === 0) {
    return <EnhancedEmptyJobsState />;
  }

  /* Body only: grid + show more (for ExpandableSection) */
  if (hideHeader) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-2.5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {displayItems.slice(0, 4).map((item, index) => (
            <motion.div
              key={item.type === 'group' ? `group-${item.groupId}` : item.job.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
            >
              {item.type === 'group' ? (
                <NavigableStackedJobCard jobs={item.jobs} />
              ) : (
                <NavigableJobCard job={item.job} />
              )}
            </motion.div>
          ))}
        </div>
        {displayItems.length > 4 && (
          <a
            href="/assigned-jobs"
            className={`flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition-all ${FOCUS_RING}`}
          >
            <span className="text-xs font-medium text-emerald-400">
              +{displayItems.length - 4} more job{displayItems.length - 4 !== 1 ? 's' : ''}
            </span>
          </a>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-2.5"
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="relative w-full h-full flex items-center justify-center overflow-visible min-w-[80px] min-h-[96px] md:min-w-[96px] md:min-h-[112px] flex-shrink-0">
            <img
              src="/assets/jobs-specialist.webp"
              alt=""
              width={312}
              height={384}
              decoding="async"
              fetchPriority="high"
              className="h-20 w-auto md:h-24 object-contain object-center select-none pointer-events-none"
              style={{
                imageRendering: 'auto',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                transform: 'translateZ(0)',
              }}
            />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-white">Active Jobs</h3>
            <p className="text-[10px] sm:text-xs text-emerald-400/50 font-medium">
              {jobs.length} assignment{jobs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        {/* View all link */}
        <a 
          href="/assigned-jobs"
          className={`text-xs font-medium text-emerald-400/70 hover:text-emerald-300 transition-colors rounded ${FOCUS_RING}`}
        >
          View all →
        </a>
      </div>

      {/* Compact Jobs Grid/List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {displayItems.slice(0, 4).map((item, index) => (
          <motion.div
            key={item.type === 'group' ? `group-${item.groupId}` : item.job.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.25 }}
          >
            {item.type === 'group' ? (
              <NavigableStackedJobCard jobs={item.jobs} />
            ) : (
              <NavigableJobCard job={item.job} />
            )}
          </motion.div>
        ))}
      </div>
      
      {/* Show more indicator if more than 4 jobs */}
      {displayItems.length > 4 && (
        <a 
          href="/assigned-jobs"
          className={`flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 hover:border-emerald-500/30 transition-all ${FOCUS_RING}`}
        >
          <span className="text-xs font-medium text-emerald-400">
            +{displayItems.length - 4} more job{displayItems.length - 4 !== 1 ? 's' : ''}
          </span>
        </a>
      )}
    </motion.div>
  );
});

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, setSession, role } = useAuth();

  // State for compliance sync with QuickActions
  const [complianceState, setComplianceState] = useState({
    dvir: false,
    equipment: false,
    jsa: false,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: rewardPoints = 0 } = useTotalPoints();

  // Preserve scroll position when navigating away and back
  useEffect(() => {
    const scrollKey = 'dashboard-scroll-position';
    
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

  // Initialize long task observer in dev mode
  useEffect(() => {
    const cleanup = initLongTaskObserver();
    return () => cleanup?.();
  }, []);

  // Show one-time discovery toast for Profile/Settings pages
  useProfileDiscoveryToast({ delay: 4000, duration: 10000 });
  useGamificationWelcomeOnMount();

  // Dashboard success metrics: track view on mount
  useEffect(() => {
    trackDashboardAction({ action: 'view' });
  }, []);

  // Fetch user's assigned jobs
  const {
    assignedJobs,
    loading: jobsLoading,
    error: jobsError,
    refetch: refetchJobs,
  } = useUserAssignedJobs(user?.id);

  // Handle compliance change from MissionControlCard
  const handleComplianceChange = useCallback((dvir: boolean, equipment: boolean, jsa: boolean) => {
    setComplianceState({ dvir, equipment, jsa });
  }, []);

  // Stable sign out handler
  const handleSignOut = useCallback(async () => {
    perfMark('sign-out');
    try {
      setSession(null);
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      logger.error('[Dashboard] Sign out failed:', error);
    } finally {
      perfMeasure('sign-out');
    }
  }, [navigate, setSession, signOut]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    trackDashboardAction({ action: 'pull_refresh' });
    try {
      await refetchJobs();
      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchJobs]);

  // Determine if jobs should be elevated (shown before announcements)
  const hasActiveJobs = assignedJobs.length > 0;
  const allFormsComplete = complianceState.dvir && complianceState.equipment && complianceState.jsa;

  // Get current job name for welcome message
  const currentJobName = useMemo(() => {
    if (assignedJobs.length > 0) {
      const activeJob = assignedJobs.find(j => j.status === 'active') || assignedJobs[0];
      return activeJob?.job_name;
    }
    return undefined;
  }, [assignedJobs]);

  // Send role users to their dashboard (e.g. notification links to /dashboard).
  // Admin can navigate the entire app, so allow them to stay on /dashboard when they choose.
  const roleDashboard = getRoleDashboard(role);
  if (role !== 'admin' && roleDashboard !== '/dashboard') {
    return <Navigate to={roleDashboard} replace />;
  }

  return (
    <DashboardLayout title="Employee Hub">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-4 pt-3 sm:pt-6" data-testid="dashboard">

          {/* Offline Mode Banner - shows when offline or submissions queued */}
          <OfflineModeBanner />

          {/* Recently Synced Confirmations - shows after offline submissions sync */}
          <RecentlySynced />

          {/* ============================================================ */}
          {/* TIER 1: Welcome Header - Compact identity + status */}
          {/* ============================================================ */}
          <div className="mb-3 sm:mb-4">
            <Suspense fallback={<WelcomeHeaderSkeleton />}>
              <WelcomeHeader
                allFormsComplete={allFormsComplete}
                activeJobsCount={assignedJobs.length}
                currentJobName={currentJobName}
                rewardPoints={rewardPoints}
                onSignOut={handleSignOut}
              />
            </Suspense>
          </div>

          {/* ============================================================ */}
          {/* TIER 2: Compliance Strip - #1 morning action for field crews */}
          {/* Elevated above announcements for immediate form access */}
          {/* ============================================================ */}
          <div className="mb-3 sm:mb-4">
            <ScrollReveal variant="fadeUp" delay={0.05}>
              <CompactComplianceStrip onComplianceChange={handleComplianceChange} />
            </ScrollReveal>
          </div>

          {/* ============================================================ */}
          {/* TIER 2.5: Featured Announcement - Safety briefing awareness */}
          {/* ============================================================ */}
          <div className="mb-3 sm:mb-4">
            <ScrollReveal variant="fadeUp" delay={0.1}>
              <FeaturedAnnouncementSection />
            </ScrollReveal>
          </div>

          {/* Good-catch prompt: "Did you spot anything yesterday?" — field roles, dismissible for the day */}
          <GoodCatchPrompt />

          {/* ============================================================ */}
          {/* TIER 3: Primary Content Grid */}
          {/* Two columns on md+ screens: Jobs | Announcements+Rewards */}
          {/* Single column stacked on mobile */}
          {/* ============================================================ */}
          <div className="mb-3 sm:mb-4">
            <ScrollReveal variant="fadeUp" delay={0.15}>
              <DashboardGrid
                gap="md"
                primaryWider={hasActiveJobs}
                primary={
                  <StackedLayout gap="sm">
                    {/* Active Jobs Section - Collapsible like Foreman dashboard */}
                    <ExpandableSection
                      id="dashboard-active-jobs"
                      title="Active Jobs"
                      subtitle={
                        jobsLoading
                          ? 'Loading...'
                          : jobsError
                            ? 'Error'
                            : assignedJobs.length === 0
                              ? 'No assignments'
                              : `${assignedJobs.length} assignment${assignedJobs.length !== 1 ? 's' : ''}`
                      }
                      transparentIconContainer
                      icon={
                        <div className="relative w-full h-full flex items-center justify-center overflow-visible min-w-[100px] min-h-[120px] md:min-w-[120px] md:min-h-[140px]">
                          <img
                            src="/assets/jobs-specialist.webp"
                            alt=""
                            width={312}
                            height={384}
                            decoding="async"
                            fetchPriority="high"
                            className="h-[120px] w-auto md:h-[140px] object-contain object-center select-none pointer-events-none"
                            style={{
                              imageRendering: 'auto',
                              WebkitBackfaceVisibility: 'hidden',
                              backfaceVisibility: 'hidden',
                              transform: 'translateZ(0)',
                            }}
                          />
                        </div>
                      }
                      storageKey="dashboard_active_jobs_expanded"
                      defaultOpen={true}
                      theme="emerald"
                      ariaLabel="Active Jobs section. Expand to view assigned jobs."
                      headerAction={
                        <a
                          href="/assigned-jobs"
                          className={`text-xs font-medium text-emerald-400/70 hover:text-emerald-300 transition-colors rounded ${FOCUS_RING}`}
                        >
                          View all →
                        </a>
                      }
                    >
                      {jobsLoading && <JobsSectionSkeleton />}
                      {!jobsLoading && jobsError && (
                        <ErrorState message={jobsError} onRetry={refetchJobs} />
                      )}
                      {!jobsLoading && !jobsError && assignedJobs.length === 0 && (
                        <EnhancedEmptyJobsState />
                      )}
                      {!jobsLoading && !jobsError && assignedJobs.length > 0 && (
                        <AssignedJobsSection
                          hideHeader
                          jobs={assignedJobs}
                          loading={false}
                          error={null}
                          onRefetch={refetchJobs}
                        />
                      )}
                    </ExpandableSection>

                    {/* Pinned Favorites - Below jobs on mobile, visible always */}
                    <div className="block md:hidden">
                      <PinnedFavorites showTitle={false} />
                    </div>
                  </StackedLayout>
                }
                secondary={
                  <StackedLayout gap="sm">
                    {/* Rewards Card */}
                    <Suspense fallback={
                      <div className="rounded-2xl border border-emerald-400/20 bg-[#041b14] p-4 animate-pulse h-[120px]">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/5" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-28 bg-white/10 rounded" />
                            <div className="h-3 w-40 bg-white/5 rounded" />
                          </div>
                        </div>
                      </div>
                    }>
                      <ProgressWidget theme="emerald" />
                    </Suspense>
                    
                    {/* Pinned Favorites - In right column on desktop */}
                    <div className="hidden md:block">
                      <PinnedFavorites showTitle={true} />
                    </div>
                  </StackedLayout>
                }
              />
            </ScrollReveal>
          </div>

          {/* ============================================================ */}
          {/* TIER 4: All Tools (Expandable) - Full width */}
          {/* ============================================================ */}
          <ScrollReveal variant="fadeUp" delay={0.2} className="shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <ExpandableSection
              id="dashboard-all-tools"
              title="All Tools"
              subtitle="Forms, resources & more"
              transparentIconContainer
              icon={
                <div className="relative w-full h-full flex items-center justify-center overflow-visible min-w-[130px] min-h-[156px] md:min-w-[156px] md:min-h-[192px]">
                  <img
                    src="/assets/all-tools.webp"
                    alt=""
                    width={312}
                    height={384}
                    decoding="async"
                    fetchPriority="high"
                    className="h-[156px] w-auto md:h-[192px] object-contain object-center select-none pointer-events-none"
                    style={{
                      imageRendering: 'auto',
                      WebkitBackfaceVisibility: 'hidden',
                      backfaceVisibility: 'hidden',
                      transform: 'translateY(-16px) translateZ(0)',
                    }}
                  />
                </div>
              }
              storageKey={PERSISTENCE_KEYS.ALL_TOOLS}
              defaultOpen={false}
              ariaLabel="All Tools section. Expand to browse forms and resources. Tap and hold any item to pin it to your Quick Access shortcuts above."
            >
              <div className="space-y-4">
                {/* Pin hint message */}
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-900/30 via-amber-950/20 to-transparent border border-amber-500/25">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    <span className="font-semibold text-amber-300">Tip:</span>{' '}
                    <span className="hidden sm:inline">Long-press (mobile) or right-click (desktop) any item below to </span>
                    <span className="sm:hidden">Long-press any item to </span>
                    <span className="font-medium text-amber-200">pin it to Quick Access</span>
                  </p>
                </div>
                
                {/* Navigation Cards */}
                <Suspense fallback={<EnhancedNavCardsSkeleton />}>
                  <NavCards />
                </Suspense>
              </div>
            </ExpandableSection>
          </ScrollReveal>

          {/* ============================================================ */}
          {/* TIER 5: Push Notifications Toggle */}
          {/* ============================================================ */}
          <ScrollReveal variant="fadeUp" delay={0.25}>
            <div className="flex justify-center mt-4">
              <EnableNotificationsButton variant="green" />
            </div>
          </ScrollReveal>
        </div>
      </PullToRefresh>

      {/* ============================================================ */}
      {/* Floating Action Button (appears on scroll) */}
      {/* ============================================================ */}
      <FloatingActionButton scrollThreshold={400} showScrollToTop={true} />
    </DashboardLayout>
  );
}

export default memo(Dashboard);
