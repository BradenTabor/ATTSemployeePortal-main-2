import { useCallback, memo, useMemo, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Calendar,
  FileText,
  Megaphone,
  Zap,
  Shield,
  Wrench,
  Briefcase,
  RefreshCw,
  Inbox,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserAssignedJobs } from '../hooks/jobs';
import { cn } from '../lib/utils';
import DashboardLayout from '../layouts/DashboardLayout';
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from '../components/admin/AdminPremiumScaffold';
import { PERSISTENCE_KEYS } from '../lib/persistence';
import { CollapsibleSection } from '../components/dashboard/CollapsibleSection';
import { CompactQuickActions, type QuickActionLink } from '../components/dashboard/CompactQuickActions';
import { CompactJobCard } from '../components/jobs';

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

function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, setSession, role, isAdmin, hasMechanicAccess } = useAuth();
  const displayName = user?.email?.split('@')[0] ?? 'Employee';

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

  // Hero stats
  const heroStats = useMemo<AdminStat[]>(() => {
    const localTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return [
      {
        label: 'Portal Status',
        value: 'ACTIVE',
        hint: 'Secure session',
      },
      {
        label: 'Active Jobs',
        value: assignedJobs.length.toString().padStart(2, '0'),
        hint: 'Assigned to you',
      },
      {
        label: 'Local Time',
        value: localTime,
        hint: 'System clock',
      },
    ];
  }, [assignedJobs.length]);

  // Hero config
  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: 'Employee Command',
      eyebrowIcon: <Zap className="w-4 h-4 text-[#7ef2c8]" />,
      heading: `Welcome back, ${displayName}`,
      description:
        'Stay synced with your jobs, announcements, and tools—all from one dashboard.',
      badges: [
        {
          label: (role ?? 'Employee').toUpperCase(),
          icon: <Shield className="w-4 h-4 text-[#7ef2c8]" />,
          variant: 'solid',
        },
        {
          label: `${assignedJobs.length} active job${assignedJobs.length !== 1 ? 's' : ''}`,
          icon: <Briefcase className="w-4 h-4 text-[#7ef2c8]" />,
          variant: 'outline',
        },
      ],
    }),
    [displayName, assignedJobs.length, role]
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
      {/* Mobile sign-out button - fixed in header area */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSignOut}
          aria-label="Sign out"
          className={cn(
            'w-11 h-11 rounded-full',
            'bg-red-600/90 border border-red-500/50',
            'flex items-center justify-center',
            'shadow-lg shadow-red-900/30',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900'
          )}
        >
          <LogOut className="w-5 h-5 text-white" />
        </motion.button>
      </div>

      <AdminPremiumScaffold
        hero={heroConfig}
        stats={heroStats}
        theme="emerald"
        sidePanel={sidePanelContent}
      >
        {/* Mobile-first Bento layout */}
        <div className="w-full space-y-4 md:space-y-6">
          {/* 
            Mobile stacking order (priority):
            1. Announcements (defaultOpen: true)
            2. Assigned Jobs (defaultOpen: true)
            3. Quick Actions (defaultOpen: false)
            4. All Tools (defaultOpen: false)
          */}

          {/* Section 1: Announcements */}
          <CollapsibleSection
            id="dashboard-announcements"
            title="Latest Announcements"
            subtitle="Company news and updates"
            icon={<Megaphone className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" />}
            storageKey={PERSISTENCE_KEYS.ANNOUNCEMENTS}
            defaultOpen={true}
          >
            <Suspense fallback={<AnnouncementCardSkeleton />}>
              <DashboardAnnouncementCard />
            </Suspense>
          </CollapsibleSection>

          {/* Section 2: Assigned Jobs */}
          <CollapsibleSection
            id="dashboard-assigned-jobs"
            title="Your Assigned Jobs"
            subtitle={`${assignedJobs.length} active assignment${assignedJobs.length !== 1 ? 's' : ''}`}
            icon={<Briefcase className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" />}
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
                  <CompactJobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Section 3: Quick Actions */}
          <CollapsibleSection
            id="dashboard-quick-actions"
            title="Quick Actions"
            subtitle="Launch high-impact workflows"
            icon={<Zap className="w-4 h-4 md:w-5 md:h-5 text-amber-300" />}
            storageKey={PERSISTENCE_KEYS.QUICK_ACTIONS}
            defaultOpen={false}
          >
            <CompactQuickActions links={quickLinks} />
          </CollapsibleSection>

          {/* Section 4: All Tools & Features */}
          <CollapsibleSection
            id="dashboard-all-tools"
            title="All Tools & Features"
            subtitle="Complete navigation menu"
            icon={<FileText className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" />}
            storageKey={PERSISTENCE_KEYS.ALL_TOOLS}
            defaultOpen={false}
          >
            <Suspense fallback={<NavCardsSkeleton />}>
              <NavCards />
            </Suspense>
          </CollapsibleSection>
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}

export default memo(Dashboard);
