import { useMemo, useCallback, Suspense, lazy, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Briefcase, AlertTriangle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { FOREMAN_NAV_CARDS, getCommonNavCards } from "../../components/admin/adminNavConfig";
import { useAuth } from "../../contexts/AuthContext";
import { useUserAssignedJobs } from "../../hooks/jobs";
import BrandedNavCard from "../../components/BrandedNavCard";
import { EnableNotificationsButton } from "../../components/notifications";
import { ScrollReveal } from "../../motion";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { logger } from "../../lib/logger";
import {
  DashboardAvatar,
  ExpandableSection,
  WelcomeHeader,
  CompactComplianceStrip,
  DashboardGrid,
  DashboardCard,
  StackedLayout,
  FloatingActionButton,
  PinnedFavorites,
  PullToRefresh,
  WelcomeHeaderSkeleton,
  JobsSectionSkeleton,
  EnhancedNavCardsSkeleton,
  EnhancedEmptyJobsState,
} from "../../components/dashboard";
import { CompactJobCard } from "../../components/jobs";
import { PERSISTENCE_KEYS } from "../../lib/persistence";
import type { JobProgressTracker } from "../../types/jobs";

// Lazy-loaded components
const ThemedAnnouncementCard = lazy(() => import("../../components/ThemedAnnouncementCard"));
const EnhancedRewardsCard = lazy(() => import("../../components/dashboard/EnhancedRewardsCard"));

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 30,
    }
  },
};

// ============================================================================
// ERROR STATE
// ============================================================================

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

const ErrorState = function ErrorState({ message, onRetry }: ErrorStateProps) {
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
};

// ============================================================================
// NAVIGABLE JOB CARD
// ============================================================================

interface NavigableJobCardProps {
  job: JobProgressTracker;
}

const NavigableJobCard = function NavigableJobCard({ job }: NavigableJobCardProps) {
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
      <CompactJobCard job={job} theme="blue" />
    </motion.div>
  );
};

// ============================================================================
// ASSIGNED JOBS SECTION (Blue themed)
// ============================================================================

interface AssignedJobsSectionProps {
  jobs: JobProgressTracker[];
  loading: boolean;
  error: string | null;
  onRefetch: () => void;
}

const AssignedJobsSection = function AssignedJobsSection({
  jobs,
  loading,
  error,
  onRefetch,
}: AssignedJobsSectionProps) {
  if (loading) {
    return <JobsSectionSkeleton />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRefetch} />;
  }

  if (jobs.length === 0) {
    return <EnhancedEmptyJobsState />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-2.5"
    >
      {/* Compact Header - Blue themed */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-400/30 flex items-center justify-center">
            <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">Active Jobs</h3>
            <p className="text-[9px] sm:text-[10px] text-blue-400/60">
              {jobs.length} assignment{jobs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        
        {/* View all link */}
        <a 
          href="/assigned-jobs"
          className="text-[10px] sm:text-xs font-medium text-blue-400/70 hover:text-blue-300 transition-colors"
        >
          View all →
        </a>
      </div>

      {/* Compact Jobs Grid/List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {jobs.slice(0, 4).map((job, index) => (
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
      
      {/* Show more indicator if more than 4 jobs */}
      {jobs.length > 4 && (
        <a 
          href="/assigned-jobs"
          className="flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 hover:border-blue-500/30 transition-all"
        >
          <span className="text-xs font-medium text-blue-400">
            +{jobs.length - 4} more job{jobs.length - 4 !== 1 ? 's' : ''}
          </span>
        </a>
      )}
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ForemanDashboard() {
  const { role, user, setSession, signOut } = useAuth();
  const navigate = useNavigate();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  // State management
  const [complianceState, setComplianceState] = useState({
    dvir: false,
    equipment: false,
    jsa: false,
  });
  const [rewardPoints, setRewardPoints] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch user's assigned jobs
  const {
    assignedJobs,
    loading: jobsLoading,
    error: jobsError,
    refetch: refetchJobs,
  } = useUserAssignedJobs(user?.id);

  // Get nav cards with bluewhite theme
  const commonCards = useMemo(() => getCommonNavCards("bluewhite"), []);

  // Handle compliance change
  const handleComplianceChange = useCallback((dvir: boolean, equipment: boolean, jsa: boolean) => {
    setComplianceState({ dvir, equipment, jsa });
  }, []);

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      logger.error("[ForemanDashboard] Sign out failed:", error);
    }
  }, [navigate, setSession, signOut]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetchJobs();
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchJobs]);

  // Derived state
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

  // Access control - redirect if not authorized
  if (role !== "foreman" && role !== "admin") {
    return (
      <DashboardLayout title="Access Denied">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400 mb-6">You don't have permission to view this page.</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Foreman Dashboard">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-4 pt-3 sm:pt-6">
          
          {/* ============================================================ */}
          {/* TIER 1: Welcome Header - Blue themed */}
          {/* ============================================================ */}
          <div className="mb-3 sm:mb-4">
            <Suspense fallback={<WelcomeHeaderSkeleton />}>
              <WelcomeHeader
                theme="blue"
                allFormsComplete={allFormsComplete}
                activeJobsCount={assignedJobs.length}
                currentJobName={currentJobName}
                rewardPoints={rewardPoints}
                onSignOut={handleSignOut}
              />
            </Suspense>
          </div>

          {/* ============================================================ */}
          {/* TIER 1.5: Featured Announcement */}
          {/* ============================================================ */}
          <div className="mb-3 sm:mb-4">
            <ScrollReveal variant="fadeUp" delay={0.02}>
              <Suspense fallback={
                <div className="rounded-3xl border border-blue-500/20 bg-[#0a1628]/70 p-5 space-y-3 animate-pulse">
                  <div className="h-3 w-32 bg-white/10 rounded-full" />
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-white/10 rounded-full" />
                    <div className="h-3 w-3/4 bg-white/10 rounded-full" />
                  </div>
                </div>
              }>
                <ThemedAnnouncementCard theme="bluewhite" />
              </Suspense>
            </ScrollReveal>
          </div>

          {/* ============================================================ */}
          {/* TIER 2: Compliance Strip - Blue themed */}
          {/* ============================================================ */}
          <div className="mb-3 sm:mb-4">
            <ScrollReveal variant="fadeUp" delay={0.04}>
              <CompactComplianceStrip theme="blue" onComplianceChange={handleComplianceChange} />
            </ScrollReveal>
          </div>

          {/* ============================================================ */}
          {/* TIER 3: Primary Content Grid */}
          {/* Two columns on md+ screens: Jobs | Rewards */}
          {/* ============================================================ */}
          <div className="mb-3 sm:mb-4">
            <ScrollReveal variant="fadeUp" delay={0.06}>
              <DashboardGrid
                gap="md"
                primaryWider={hasActiveJobs}
                primary={
                  <StackedLayout gap="sm">
                    {/* Active Jobs Section */}
                    <DashboardCard variant="elevated" theme="blue">
                      <div className="p-3 sm:p-4">
                        <AssignedJobsSection
                          jobs={assignedJobs}
                          loading={jobsLoading}
                          error={jobsError}
                          onRefetch={refetchJobs}
                        />
                      </div>
                    </DashboardCard>
                    
                    {/* Pinned Favorites - Below jobs on mobile */}
                    <div className="block md:hidden">
                      <PinnedFavorites showTitle={false} theme="blue" />
                    </div>
                  </StackedLayout>
                }
                secondary={
                  <StackedLayout gap="sm">
                    {/* Rewards Card - Blue themed */}
                    <Suspense fallback={
                      <div className="rounded-2xl border border-blue-400/20 bg-[#0a1628] p-4 animate-pulse h-[120px]">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-white/5" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 w-28 bg-white/10 rounded" />
                            <div className="h-3 w-40 bg-white/5 rounded" />
                          </div>
                        </div>
                      </div>
                    }>
                      <EnhancedRewardsCard theme="blue" onPointsChange={setRewardPoints} />
                    </Suspense>
                    
                    {/* Pinned Favorites - In right column on desktop */}
                    <div className="hidden md:block">
                      <PinnedFavorites showTitle={true} theme="blue" />
                    </div>
                  </StackedLayout>
                }
              />
            </ScrollReveal>
          </div>

          {/* ============================================================ */}
          {/* TIER 4: Foreman Tools (Expandable) */}
          {/* ============================================================ */}
          <div className="mb-3 sm:mb-4">
            <ScrollReveal variant="fadeUp" delay={0.08}>
              <ExpandableSection
                id="foreman-tools"
                title="Foreman Tools"
                subtitle="Crew management & reports"
                icon={<DashboardAvatar variant="jobs" className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" />}
                storageKey={PERSISTENCE_KEYS.ALL_TOOLS}
                defaultOpen={true}
                ariaLabel="Foreman tools section. Expand to access crew management and reporting tools."
                theme="blue"
              >
                <motion.div 
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3"
                  variants={shouldReduceMotion ? undefined : containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {FOREMAN_NAV_CARDS.map((card) => (
                    <motion.div key={card.to} variants={shouldReduceMotion ? undefined : itemVariants}>
                      <BrandedNavCard
                        title={card.title}
                        description={card.description}
                        icon={card.icon}
                        to={card.to}
                        variant="bluewhite"
                        comingSoon={card.comingSoon}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </ExpandableSection>
            </ScrollReveal>
          </div>

          {/* ============================================================ */}
          {/* TIER 5: All Tools (Expandable) */}
          {/* ============================================================ */}
          <ScrollReveal variant="fadeUp" delay={0.12}>
            <ExpandableSection
              id="foreman-all-tools"
              title="All Tools"
              subtitle="Forms, resources & more"
              icon={<DashboardAvatar variant="tools" className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10" />}
              storageKey="foreman_all_tools_expanded"
              defaultOpen={false}
              ariaLabel="All Tools section. Expand to browse forms and resources."
              theme="blue"
            >
              <div className="space-y-4">
                {/* Pin hint message */}
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-900/30 via-blue-950/20 to-transparent border border-blue-500/25">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-400/30 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </div>
                  <p className="text-xs text-blue-200/80 leading-relaxed">
                    <span className="font-semibold text-blue-300">Tip:</span>{' '}
                    <span className="hidden sm:inline">Long-press (mobile) or right-click (desktop) any item below to </span>
                    <span className="sm:hidden">Long-press any item to </span>
                    <span className="font-medium text-blue-200">pin it to Quick Access</span>
                  </p>
                </div>
                
                {/* Navigation Cards */}
                <Suspense fallback={<EnhancedNavCardsSkeleton />}>
                  <motion.div 
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3"
                    variants={shouldReduceMotion ? undefined : containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {commonCards.map((card) => (
                      <motion.div key={card.to} variants={shouldReduceMotion ? undefined : itemVariants}>
                        <BrandedNavCard
                          title={card.title}
                          description={card.description}
                          icon={card.icon}
                          to={card.to}
                          variant="bluewhite"
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </Suspense>
              </div>
            </ExpandableSection>
          </ScrollReveal>

          {/* ============================================================ */}
          {/* TIER 6: Push Notifications Toggle */}
          {/* ============================================================ */}
          <ScrollReveal variant="fadeUp" delay={0.16}>
            <div className="flex justify-center mt-4">
              <EnableNotificationsButton variant="bluewhite" />
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
