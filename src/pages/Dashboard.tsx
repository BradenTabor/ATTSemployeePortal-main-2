import { useCallback, memo, useMemo, Suspense, lazy, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ScrollReveal } from '../motion';
import {
  LogOut,
  Calendar,
  FileText,
  Shield,
  Wrench,
  RefreshCw,
  Inbox,
  AlertTriangle,
  Layers,
  Briefcase,
  ChevronDown,
} from 'lucide-react';
import { DashboardAvatar } from '../components/dashboard/DashboardAvatar';
import { useAuth } from '../contexts/AuthContext';
import { useUserAssignedJobs } from '../hooks/jobs';
import DashboardLayout from '../layouts/DashboardLayout';
import AdminPremiumScaffold, {
  type AdminHeroConfig,
} from '../components/admin/AdminPremiumScaffold';
import { PERSISTENCE_KEYS } from '../lib/persistence';
import { ExpandableSection } from '../components/dashboard/ExpandableSection';
import { QuickActionsFAB, type QuickActionLink } from '../components/dashboard/QuickActionsFAB';
import { CompactJobCard } from '../components/jobs';
import {
  getDeviceCapabilities,
  getQualitySettings,
  scheduleIdleWork,
  perfMark,
  perfMeasure,
  initLongTaskObserver,
} from '../lib/mobilePerf';
import {
  calculateJobProgress,
  calculateSpanProgress,
  getSpanProgressColors,
} from '../lib/jobProgressUtils';
import { cn } from '../lib/utils';
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

// Stacked job card for dashboard
const DashboardStackedCard = memo(function DashboardStackedCard({
  jobs,
}: {
  jobs: JobProgressTracker[];
}) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const primaryJob = jobs[0];

  const handleJobClick = useCallback((jobId: string) => {
    navigate(`/assigned-jobs?job=${jobId}`);
  }, [navigate]);

  return (
    <motion.div
      layout
      className="relative rounded-2xl overflow-hidden"
    >
      {/* Stacked card shadows */}
      {!isExpanded && jobs.length > 1 && (
        <>
          {jobs.length >= 3 && (
            <div 
              className="absolute inset-x-2 top-2 h-full rounded-2xl border border-emerald-500/10 bg-[#041510]/40"
              style={{ transform: 'translateY(6px)' }}
            />
          )}
          <div 
            className="absolute inset-x-1 top-1 h-full rounded-2xl border border-emerald-500/15 bg-[#041510]/60"
            style={{ transform: 'translateY(3px)' }}
          />
        </>
      )}
      
      {/* Main card */}
      <div className="relative rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#041510]/90 via-[#020d09]/95 to-[#010604] overflow-hidden">
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left p-3 md:p-4"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(5, 77, 53, 0.6) 0%, rgba(10, 10, 10, 1) 100%)' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                  <Layers className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300">{jobs.length}</span>
                </div>
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Stacked</span>
              </div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-white truncate">{primaryJob.job_name}</span>
                <span className="text-xs text-white/40">+{jobs.length - 1}</span>
              </div>
            </div>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="p-1.5 rounded-lg bg-white/5"
            >
              <ChevronDown className="w-4 h-4 text-white/50" />
            </motion.div>
          </div>
        </button>
        
        {/* Expanded content */}
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="border-t border-white/10 p-3 space-y-2"
          >
            {jobs.map((job) => {
              // Calculate progress for this job
              const isSpanBased = job.tracking_type === 'job_progress';
              let progressPercent = 0;
              let progressColors = null;
              
              if (isSpanBased) {
                const progressUpdates = job.progress_updates || [];
                const totalSpans = progressUpdates.reduce((sum, u) => sum + (u.spans_completed || 0), 0);
                const totalFeet = progressUpdates.reduce((sum, u) => sum + (u.total_feet_completed || 0), 0);
                const spanProgress = calculateSpanProgress(
                  totalSpans,
                  totalFeet,
                  job.estimated_total_spans,
                  job.estimated_total_feet,
                  job.span_progress_metric || 'spans'
                );
                progressPercent = spanProgress.percentage;
                progressColors = getSpanProgressColors(progressPercent);
              } else {
                const timelineProgress = calculateJobProgress(job.start_date, job.end_date);
                progressPercent = timelineProgress.percentage;
              }
              
              const isExceeded = !isSpanBased && progressPercent > 100;
              
              return (
                <button
                  key={job.id}
                  onClick={() => handleJobClick(job.id)}
                  className="w-full text-left p-2.5 rounded-xl border border-emerald-500/20 bg-[#041510]/50 hover:border-emerald-400/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Briefcase 
                        className="w-3 h-3 flex-shrink-0"
                        style={{ color: isSpanBased ? 'rgb(231, 114, 4)' : 'rgb(0, 219, 77)' }}
                      />
                      <span className="text-sm text-white truncate">{job.job_name}</span>
                    </div>
                    <div
                      className={cn(
                        'flex-shrink-0 px-2 py-0.5 rounded-md text-xs font-bold tabular-nums',
                        isSpanBased && progressColors
                          ? cn(progressColors.bg, 'border', progressColors.border, progressColors.text)
                          : isExceeded
                            ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                            : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                      )}
                    >
                      {progressPercent}%
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
});

const AssignedJobsSection = memo(function AssignedJobsSection({
  jobs,
  loading,
  error,
  onRefetch,
}: AssignedJobsSectionProps) {
  const quality = getQualitySettings();
  const [visibleCount, setVisibleCount] = useState(5);

  // Group jobs by job_group_id
  type DisplayItem = 
    | { type: 'group'; groupId: string; jobs: JobProgressTracker[] }
    | { type: 'job'; job: JobProgressTracker };
  
  const displayItems = useMemo<DisplayItem[]>(() => {
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
    
    const items: DisplayItem[] = [];
    groupMap.forEach((groupJobs, groupId) => {
      items.push({ type: 'group', groupId, jobs: groupJobs });
    });
    ungrouped.forEach(job => {
      items.push({ type: 'job', job });
    });
    
    return items;
  }, [jobs]);

  const hasMoreItems = displayItems.length > visibleCount;

  // Progressive rendering: render first batch immediately, rest on idle
  useEffect(() => {
    if (displayItems.length <= 5) {
      queueMicrotask(() => setVisibleCount(displayItems.length));
      return;
    }

    queueMicrotask(() => setVisibleCount(5));

    const cancel = scheduleIdleWork(() => {
      setVisibleCount(displayItems.length);
    }, { timeout: 200 });

    return cancel;
  }, [displayItems.length]);

  // Virtualization threshold check
  const shouldVirtualize = displayItems.length > quality.virtualizationThreshold;

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
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

  // Render visible items (progressive or virtualized)
  const visibleItems = shouldVirtualize ? displayItems.slice(0, visibleCount) : displayItems;

  return (
    <div className="space-y-3">
      {visibleItems.map((item) => {
        if (item.type === 'group') {
          return (
            <DashboardStackedCard 
              key={`group-${item.groupId}`} 
              jobs={item.jobs} 
            />
          );
        } else {
          return (
            <NavigableJobCard key={item.job.id} job={item.job} />
          );
        }
      })}
      
      {/* Show loading indicator for remaining items */}
      {hasMoreItems && !shouldVirtualize && (
        <div className="text-center py-2">
          <span className="text-xs text-white/40">Loading more...</span>
        </div>
      )}
      
      {/* Virtualization notice */}
      {shouldVirtualize && displayItems.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((prev) => Math.min(prev + 10, displayItems.length))}
          className="w-full py-2 text-center text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors min-h-[44px]"
        >
          Show more ({displayItems.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
});

// ============================================================================
// SIDE PANEL - Memoized to prevent re-renders
// ============================================================================

interface SidePanelProps {
  email: string | undefined;
  role: string | null;
  quickLinksCount: number;
  assignedJobsCount: number;
  onSignOut: () => void;
}

const SidePanel = memo(function SidePanel({
  email,
  role,
  quickLinksCount,
  assignedJobsCount,
  onSignOut,
}: SidePanelProps) {
  const caps = getDeviceCapabilities();
  
  return (
    <div className="space-y-6">
      {/* Profile card with sign out */}
      <div className="rounded-3xl border border-white/10 bg-[#03150f]/80 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
              Profile Snapshot
            </p>
            <p className="text-lg font-semibold text-white mt-2 truncate">
              {email}
            </p>
            <p className="text-sm text-white/60 capitalize">{role}</p>
          </div>
          <motion.button
            whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.02 }}
            whileTap={caps.prefersReducedMotion ? undefined : { scale: 0.96 }}
            onClick={onSignOut}
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-[#ff0000] px-3 py-2 text-xs font-semibold border-4 border-[rgba(255,214,214,0.55)] hover:bg-red-600 transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </motion.button>
        </div>
      </div>

      {/* Quick stats - desktop side panel */}
      <div className="hidden lg:block rounded-3xl border border-white/10 bg-[#03150f]/80 p-5 space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
          Quick Stats
        </p>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/60">Quick Links</span>
            <span className="text-sm font-semibold text-emerald-400">
              {quickLinksCount}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/60">Active Jobs</span>
            <span className="text-sm font-semibold text-emerald-400">
              {assignedJobsCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, setSession, role, isAdmin, hasMechanicAccess, fullName } = useAuth();

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

  // Memoized quick links
  const quickLinks: QuickActionLink[] = useMemo(
    () => [
      {
        label: 'View Forms History',
        description: 'Review and export previous submissions',
        icon: FileText,
        path: '/forms-history',
      },
      ...(isAdmin
        ? [
            {
              label: 'Manage RTO Requests',
              description: 'Approve or deny time-off requests',
              icon: Calendar,
              path: '/admin/rto',
              iconBg: 'bg-[#f6b96b]/15 border border-[#f6b96b]/30',
              iconColor: 'text-[#ffd9a6]',
            },
            {
              label: 'Manage App Users',
              description: 'Update roles and permissions',
              icon: Shield,
              path: '/admin/users',
              iconBg: 'bg-[#f7e4bd]/10 border border-[#f4c979]/30',
              iconColor: 'text-[#f4c979]',
            },
          ]
        : []),
      ...(hasMechanicAccess
        ? [
            {
              label: 'DVIR Control Center',
              description: 'Inspect DVIR submissions',
              icon: Wrench,
              path: '/mechanic-dvir-center',
              iconBg: 'bg-[#ff9350]/10 border border-[#ff9350]/30',
              iconColor: 'text-[#ffb48a]',
            },
          ]
        : []),
    ],
    [isAdmin, hasMechanicAccess]
  );

  // Memoized hero config
  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      heading: `Welcome back, ${displayName}`,
    }),
    [displayName]
  );

  // Memoized subtitle for jobs section
  const jobsSubtitle = useMemo(
    () => `${assignedJobs.length} active assignment${assignedJobs.length !== 1 ? 's' : ''}`,
    [assignedJobs.length]
  );

  // Memoized side panel content
  const sidePanelContent = useMemo(
    () => (
      <SidePanel
        email={user?.email}
        role={role}
        quickLinksCount={quickLinks.length}
        assignedJobsCount={assignedJobs.length}
        onSignOut={handleSignOut}
      />
    ),
    [user?.email, role, quickLinks.length, assignedJobs.length, handleSignOut]
  );

  return (
    <DashboardLayout title="Employee Hub">
      <AdminPremiumScaffold
        hero={heroConfig}
        theme="emerald"
        sidePanel={sidePanelContent}
      >
        {/* Mobile-first Bento layout */}
        <div className="w-full space-y-4 md:space-y-6">
          {/* Section 1: Announcements */}
          <ScrollReveal variant="fadeUp" delay={0}>
            <ExpandableSection
              id="dashboard-announcements"
              title="Latest Announcements"
              subtitle="Company news and updates"
              icon={<DashboardAvatar variant="announcements" className="w-8 h-8 md:w-10 md:h-10" />}
              storageKey={PERSISTENCE_KEYS.ANNOUNCEMENTS}
              defaultOpen={true}
            >
              <Suspense fallback={<AnnouncementCardSkeleton />}>
                <DashboardAnnouncementCard />
              </Suspense>
            </ExpandableSection>
          </ScrollReveal>

          {/* Section 2: Assigned Jobs - Isolated with progressive rendering */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <ExpandableSection
              id="dashboard-assigned-jobs"
              title="Your Assigned Jobs"
              subtitle={jobsSubtitle}
              icon={<DashboardAvatar variant="jobs" className="w-8 h-8 md:w-10 md:h-10" />}
              storageKey={PERSISTENCE_KEYS.ASSIGNED_JOBS}
              defaultOpen={true}
            >
              <AssignedJobsSection
                jobs={assignedJobs}
                loading={jobsLoading}
                error={jobsError}
                onRefetch={refetchJobs}
              />
            </ExpandableSection>
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
        </div>
      </AdminPremiumScaffold>

      {/* Quick Actions FAB */}
      <QuickActionsFAB links={quickLinks} />
    </DashboardLayout>
  );
}

export default memo(Dashboard);
