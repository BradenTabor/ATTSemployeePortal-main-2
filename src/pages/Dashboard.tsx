import { useCallback, memo, useMemo, Suspense, lazy, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Calendar,
  FileText,
  Shield,
  Wrench,
  RefreshCw,
  Inbox,
  AlertTriangle,
} from 'lucide-react';
import { DashboardAvatar } from '../components/dashboard/DashboardAvatar';
import { useAuth } from '../contexts/AuthContext';
import { useUserAssignedJobs } from '../hooks/jobs';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import DashboardLayout from '../layouts/DashboardLayout';
import AdminPremiumScaffold, {
  type AdminHeroConfig,
} from '../components/admin/AdminPremiumScaffold';
import { PERSISTENCE_KEYS } from '../lib/persistence';
import { ExpandableSection } from '../components/dashboard/ExpandableSection';
import { QuickActionsFAB, type QuickActionLink } from '../components/dashboard/QuickActionsFAB';
import { CompactJobCard } from '../components/jobs';
import {
  ExpandableScreen,
  ExpandableScreenTrigger,
  ExpandableScreenContent,
} from '../components/ui/ExpandableScreen';
import { JobDetailExpanded } from '../components/jobs/JobDetailExpanded';
import {
  getDeviceCapabilities,
  getQualitySettings,
  scheduleIdleWork,
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
// EXPANDABLE JOB CARD - Memoized with stable props
// ============================================================================

interface ExpandableJobCardProps {
  job: JobProgressTracker;
  onJobUpdate: () => void;
}

const ExpandableJobCard = memo(
  function ExpandableJobCard({ job, onJobUpdate }: ExpandableJobCardProps) {
    return (
      <ExpandableScreen
        layoutId={`job-card-${job.id}`}
        triggerRadius="16px"
        contentRadius="24px"
        animationDuration={0.35}
      >
        <ExpandableScreenTrigger>
          <CompactJobCard job={job} />
        </ExpandableScreenTrigger>
        <ExpandableScreenContent className="bg-gradient-to-br from-[#041812] via-[#020d09] to-[#010604]">
          <JobDetailExpanded job={job} onJobUpdate={onJobUpdate} />
        </ExpandableScreenContent>
      </ExpandableScreen>
    );
  },
  // Custom comparison to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    // Re-render only if job data changed or if it's a different job
    return (
      prevProps.job.id === nextProps.job.id &&
      prevProps.job.status === nextProps.job.status &&
      prevProps.onJobUpdate === nextProps.onJobUpdate &&
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
  const quality = getQualitySettings();
  const [visibleCount, setVisibleCount] = useState(5);
  const hasMoreJobs = jobs.length > visibleCount;

  // Progressive rendering: render first batch immediately, rest on idle
  useEffect(() => {
    if (jobs.length <= 5) {
      setVisibleCount(jobs.length);
      return;
    }

    // Reset to initial batch
    setVisibleCount(5);

    // Schedule remaining items during idle time
    const cancel = scheduleIdleWork(() => {
      setVisibleCount(jobs.length);
    }, { timeout: 200 });

    return cancel;
  }, [jobs.length]);

  // Virtualization threshold check
  const shouldVirtualize = jobs.length > quality.virtualizationThreshold;

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

  // Render visible jobs (progressive or virtualized)
  const visibleJobs = shouldVirtualize ? jobs.slice(0, visibleCount) : jobs;

  return (
    <div className="space-y-3">
      {visibleJobs.map((job) => (
        <ExpandableJobCard key={job.id} job={job} onJobUpdate={onRefetch} />
      ))}
      
      {/* Show loading indicator for remaining items */}
      {hasMoreJobs && !shouldVirtualize && (
        <div className="text-center py-2">
          <span className="text-xs text-white/40">Loading more...</span>
        </div>
      )}
      
      {/* Virtualization notice */}
      {shouldVirtualize && jobs.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((prev) => Math.min(prev + 10, jobs.length))}
          className="w-full py-2 text-center text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors min-h-[44px]"
        >
          Show more ({jobs.length - visibleCount} remaining)
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
  const { user, signOut, setSession, role, isAdmin, hasMechanicAccess } = useAuth();
  const [fullName, setFullName] = useState<string | null>(null);

  // Initialize long task observer in dev mode
  useEffect(() => {
    const cleanup = initLongTaskObserver();
    return () => cleanup?.();
  }, []);

  // Fetch full_name from app_users table
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      perfMark('fetch-user-profile');
      
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch user profile:', error);
          return;
        }

        if (data?.full_name) {
          setFullName(data.full_name);
        }
      } catch (err) {
        logger.error('Unexpected error fetching user profile:', err);
      } finally {
        perfMeasure('fetch-user-profile');
      }
    };

    fetchUserProfile();
  }, [user?.id]);

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

          {/* Section 2: Assigned Jobs - Isolated with progressive rendering */}
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

          {/* Section 3: All Tools & Features */}
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
        </div>
      </AdminPremiumScaffold>

      {/* Quick Actions FAB */}
      <QuickActionsFAB links={quickLinks} />
    </DashboardLayout>
  );
}

export default memo(Dashboard);
