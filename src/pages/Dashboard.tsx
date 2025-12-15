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
import type { JobProgressTracker } from '../types/jobs';

const DashboardAnnouncementCard = lazy(
  () => import('../components/DashboardAnnouncementCard')
);
const NavCards = lazy(() => import('../components/NavCards'));

// Skeleton loaders
const AnnouncementCardSkeleton = () => (
  <div className="rounded-3xl border border-white/10 bg-[#041b14]/70 p-5 space-y-3 animate-pulse">
    <div className="h-3 w-32 bg-white/10 rounded-full" />
    <div className="space-y-2">
      <div className="h-3 w-full bg-white/10 rounded-full" />
      <div className="h-3 w-3/4 bg-white/10 rounded-full" />
      <div className="h-3 w-2/3 bg-white/5 rounded-full" />
    </div>
  </div>
);

const JobCardSkeleton = () => (
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

const NavCardsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
    {Array.from({ length: 6 }).map((_, idx) => (
      <div
        key={`nav-skeleton-${idx}`}
        className="rounded-2xl border border-white/10 bg-white/5 h-28 md:h-32 animate-pulse"
      />
    ))}
  </div>
);

// Empty state component for jobs
const EmptyJobsState = () => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
      <Inbox className="w-6 h-6 text-emerald-400/60" />
    </div>
    <p className="text-sm text-white/60 font-medium">No active assignments</p>
    <p className="text-xs text-white/40 mt-1">Jobs assigned to you will appear here</p>
  </div>
);

// Error state component with retry
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center py-6 text-center">
    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
      <AlertTriangle className="w-5 h-5 text-red-400" />
    </div>
    <p className="text-sm text-red-400 font-medium">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Try Again
      </button>
    )}
  </div>
);

// Expandable Job Card wrapper
interface ExpandableJobCardProps {
  job: JobProgressTracker;
  onJobUpdate?: () => void;
}

const ExpandableJobCard = memo(function ExpandableJobCard({ job, onJobUpdate }: ExpandableJobCardProps) {
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
});

function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, setSession, role, isAdmin, hasMechanicAccess } = useAuth();
  const [fullName, setFullName] = useState<string | null>(null);

  // Fetch full_name from app_users table
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
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
      }
    };

    fetchUserProfile();
  }, [user?.id]);

  // Display full_name if available, otherwise show full email
  const displayName = fullName || user?.email || 'Employee';

  // Fetch user's assigned jobs
  const {
    assignedJobs,
    loading: jobsLoading,
    error: jobsError,
    refetch: refetchJobs,
  } = useUserAssignedJobs(user?.id);

  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }, [navigate, setSession, signOut]);

  // Quick links for CompactQuickActions
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

  // Hero config - simplified for cleaner look
  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      heading: `Welcome back, ${displayName}`,
    }),
    [displayName]
  );

  // Side panel content (desktop only - includes sign out)
  const sidePanelContent = (
    <div className="space-y-6">
      {/* Profile card with sign out */}
      <div className="rounded-3xl border border-white/10 bg-[#03150f]/80 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
              Profile Snapshot
            </p>
            <p className="text-lg font-semibold text-white mt-2 truncate">
              {user?.email}
            </p>
            <p className="text-sm text-white/60 capitalize">{role}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleSignOut}
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-red-600/80 px-3 py-2 text-xs font-semibold border border-red-500/40 hover:bg-red-600 transition-colors"
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
              {quickLinks.length}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/60">Active Jobs</span>
            <span className="text-sm font-semibold text-emerald-400">
              {assignedJobs.length}
            </span>
          </div>
        </div>
      </div>
    </div>
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
          {/* 
            Mobile stacking order (priority):
            1. Announcements (defaultOpen: true)
            2. Assigned Jobs (defaultOpen: true)
            3. All Tools (defaultOpen: false)
            Quick Actions are accessible via FAB (floating action button)
          */}

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

          {/* Section 2: Assigned Jobs */}
          <ExpandableSection
            id="dashboard-assigned-jobs"
            title="Your Assigned Jobs"
            subtitle={`${assignedJobs.length} active assignment${assignedJobs.length !== 1 ? 's' : ''}`}
            icon={<DashboardAvatar variant="jobs" className="w-8 h-8 md:w-10 md:h-10" />}
            storageKey={PERSISTENCE_KEYS.ASSIGNED_JOBS}
            defaultOpen={true}
          >
            {jobsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <JobCardSkeleton key={`job-skeleton-${i}`} />
                ))}
              </div>
            ) : jobsError ? (
              <ErrorState message={jobsError} onRetry={refetchJobs} />
            ) : assignedJobs.length === 0 ? (
              <EmptyJobsState />
            ) : (
              <div className="space-y-3">
                {assignedJobs.map((job) => (
                  <ExpandableJobCard key={job.id} job={job} onJobUpdate={refetchJobs} />
                ))}
              </div>
            )}
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

      {/* Quick Actions FAB - Floating action button (outside scaffold for proper z-index) */}
      <QuickActionsFAB links={quickLinks} />
    </DashboardLayout>
  );
}

export default memo(Dashboard);
