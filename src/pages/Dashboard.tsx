import { useCallback, memo, useMemo, Suspense, lazy, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Calendar,
  FileText,
  Megaphone,
  Zap,
  Shield,
  Wrench,
  Briefcase,
  Grid3X3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useUserAssignedJobs } from "../hooks/jobs";
import { cn } from "../lib/utils";
import DashboardLayout from "../layouts/DashboardLayout";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";
import { CollapsibleSection } from "../components/dashboard";
import { CompactQuickActions } from "../components/dashboard";
import { CompactJobCard } from "../components/jobs";

const DashboardAnnouncementCard = lazy(
  () => import("../components/DashboardAnnouncementCard")
);
const NavCards = lazy(() => import("../components/NavCards"));

// Storage keys for persisted collapse states
const STORAGE_KEYS = {
  announcements: "atts:dashboard:collapse:announcements",
  assignedJobs: "atts:dashboard:collapse:assignedJobs",
  quickActions: "atts:dashboard:collapse:quickActions",
  allTools: "atts:dashboard:collapse:allTools",
} as const;

type QuickLink = {
  label: string;
  description: string;
  icon: LucideIcon;
  path: string;
  gradient?: string;
  border?: string;
  glow?: string;
  iconBg?: string;
  iconAccent?: string;
};

// Skeletons
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

const NavCardsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
    {Array.from({ length: 6 }).map((_, idx) => (
      <div
        key={`nav-skeleton-${idx}`}
        className="rounded-2xl border border-white/10 bg-white/5 h-32 animate-pulse"
      />
    ))}
  </div>
);

const JobCardSkeleton = () => (
  <div className="rounded-xl border border-white/10 bg-[#041b14]/70 p-3 animate-pulse">
    <div className="flex items-center gap-3">
      <div className="flex-1 space-y-2">
        <div className="h-3 w-3/4 bg-white/10 rounded-full" />
        <div className="h-2 w-1/2 bg-white/5 rounded-full" />
      </div>
      <div className="w-16 space-y-1">
        <div className="h-3 w-full bg-white/10 rounded-full" />
        <div className="h-1.5 w-full bg-white/5 rounded-full" />
      </div>
    </div>
  </div>
);

function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut, setSession, role, isAdmin, hasMechanicAccess } =
    useAuth();
  const displayName = user?.email?.split("@")[0] ?? "Employee";
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch user's assigned jobs for the widget
  const {
    assignedJobs,
    loading: jobsLoading,
    error: jobsError,
  } = useUserAssignedJobs(user?.id);

  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }, [navigate, setSession, signOut]);

  const quickLinks: QuickLink[] = useMemo(
    () => [
      {
        label: "View Forms History",
        description: "Review, export, and reference previous submissions.",
        icon: FileText,
        path: "/forms-history",
      },
      ...(isAdmin
        ? [
            {
              label: "Manage RTO Requests",
              description:
                "Approve or deny employee time-off requests in one place.",
              icon: Calendar,
              path: "/admin/rto",
              gradient:
                "from-[#f6b96b]/70 via-black/80 to-[#37240d] hover:from-[#fccc7b]",
              border: "border-[#f6b96b]/40",
              glow: "from-[#f5c982]/18 to-transparent",
              iconBg: "bg-[#f6b96b]/15 border border-[#f6b96b]/40",
              iconAccent: "text-[#ffd9a6]",
            },
            {
              label: "Manage App Users",
              description: "Update user roles, permissions, and onboarding.",
              icon: Shield,
              path: "/admin/users",
              gradient:
                "from-[#f7e4bd]/70 via-black/80 to-[#3a250f] hover:from-[#f7e4bd]",
              border: "border-[#f7e4bd]/35",
              glow: "from-[#ffe6c3]/18 to-transparent",
              iconBg: "bg-[#f7e4bd]/10 border border-[#f4c979]/35",
              iconAccent: "text-[#f4c979]",
            },
          ]
        : []),
      ...(hasMechanicAccess
        ? [
            {
              label: "DVIR ControlCenter",
              description: "Inspect DVIR submissions and coordinate repairs.",
              icon: Wrench,
              path: "/mechanic-dvir-center",
              gradient:
                "from-[#ff8f5b]/70 via-black/80 to-[#3d1a0c] hover:from-[#ff9f6f]",
              border: "border-[#ff9f6f]/35",
              glow: "from-[#ff925d]/18 to-transparent",
              iconBg: "bg-[#ff9350]/10 border border-[#ff9350]/35",
              iconAccent: "text-[#ffb48a]",
            },
          ]
        : []),
    ],
    [isAdmin, hasMechanicAccess]
  );

  const heroStats = useMemo<AdminStat[]>(() => {
    const localTime = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return [
      {
        label: "Portal Status",
        value: "ACTIVE",
        hint: "Secure session",
      },
      {
        label: "Quick Links",
        value: quickLinks.length.toString().padStart(2, "0"),
        hint: "Personalized shortcuts",
      },
      {
        label: "Local Time",
        value: localTime,
        hint: "System clock",
      },
    ];
  }, [quickLinks.length]);

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Employee Command",
      eyebrowIcon: <Zap className="w-4 h-4 text-[#7ef2c8]" />,
      heading: `Welcome back, ${displayName}`,
      description:
        "Stay synced with forms, announcements, and role-specific panels—all from one launch surface.",
      badges: [
        {
          label: (role ?? "Employee").toUpperCase(),
          icon: <Shield className="w-4 h-4 text-[#7ef2c8]" />,
          variant: "solid",
        },
        {
          label: `${quickLinks.length} quick links`,
          icon: <FileText className="w-4 h-4 text-[#7ef2c8]" />,
          variant: "outline",
        },
      ],
    }),
    [displayName, quickLinks.length, role]
  );

  // Assigned jobs section content
  const assignedJobsContent = useMemo(() => {
    if (jobsLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, idx) => (
            <JobCardSkeleton key={`job-skeleton-${idx}`} />
          ))}
        </div>
      );
    }

    if (jobsError) {
      return (
        <p className="text-sm text-red-400/80 py-4 text-center">
          Failed to load assignments. Please try again.
        </p>
      );
    }

    if (assignedJobs.length === 0) {
      return (
        <p className="text-sm text-white/50 py-4 text-center">
          No active assignments at the moment.
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {assignedJobs.slice(0, 5).map((job, idx) => (
          <CompactJobCard
            key={job.id}
            job={job}
            index={idx}
            onClick={() => navigate("/job-tracker")}
          />
        ))}
        {assignedJobs.length > 5 && (
          <button
            onClick={() => navigate("/job-tracker")}
            className="w-full text-center text-xs text-emerald-300 hover:text-emerald-200 py-2 transition-colors"
          >
            View all {assignedJobs.length} assignments →
          </button>
        )}
      </div>
    );
  }, [assignedJobs, jobsError, jobsLoading, navigate]);

  // Side panel for desktop (profile + sign-out + announcements)
  const sidePanelContent = (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-[#03150f]/80 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
              Profile Snapshot
            </p>
            <p className="text-lg font-semibold text-white mt-2">
              {user?.email}
            </p>
            <p className="text-sm text-white/60 capitalize">{role}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-full bg-red-600/80 px-3 py-2 text-xs font-semibold border border-red-500/40"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </motion.button>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#041b14]/80 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-emerald-300" />
          <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">
            Latest News
          </p>
        </div>
        <Suspense fallback={<AnnouncementCardSkeleton />}>
          <DashboardAnnouncementCard />
        </Suspense>
      </div>
    </div>
  );

  // Mobile-first main content with collapsible sections
  const mainContent = (
    <div className="w-full space-y-4 md:space-y-6">
      {/* Mobile sign-out header */}
      {isMobile && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-white/60">
            Logged in as <span className="text-emerald-300">{displayName}</span>
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSignOut}
            aria-label="Sign out"
            className={cn(
              "p-2 rounded-full bg-red-600/80 border border-red-500/40",
              "hover:bg-red-600 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
            )}
          >
            <LogOut className="w-4 h-4 text-white" />
          </motion.button>
        </div>
      )}

      {/* 1. Announcements - always visible, open by default */}
      <CollapsibleSection
        id="announcements"
        title="Latest Announcements"
        subtitle="Stay up to date with company news"
        icon={<Megaphone className="w-5 h-5" />}
        storageKey={STORAGE_KEYS.announcements}
        defaultOpen={true}
      >
        <Suspense fallback={<AnnouncementCardSkeleton />}>
          <DashboardAnnouncementCard />
        </Suspense>
      </CollapsibleSection>

      {/* 2. Assigned Jobs - open by default, prioritized for mobile */}
      <CollapsibleSection
        id="assigned-jobs"
        title="My Assigned Jobs"
        subtitle={
          jobsLoading
            ? "Loading..."
            : `${assignedJobs.length} active assignment${assignedJobs.length !== 1 ? "s" : ""}`
        }
        icon={<Briefcase className="w-5 h-5" />}
        storageKey={STORAGE_KEYS.assignedJobs}
        defaultOpen={true}
      >
        {assignedJobsContent}
      </CollapsibleSection>

      {/* 3. Quick Actions - collapsed by default on mobile */}
      <CollapsibleSection
        id="quick-actions"
        title="Quick Actions"
        subtitle="Launch high-impact workflows"
        icon={<Zap className="w-5 h-5" />}
        storageKey={STORAGE_KEYS.quickActions}
        defaultOpen={false}
      >
        <CompactQuickActions links={quickLinks} />
      </CollapsibleSection>

      {/* 4. All Tools & Features - collapsed by default */}
      <CollapsibleSection
        id="all-tools"
        title="All Tools & Features"
        subtitle="Full navigation menu"
        icon={<Grid3X3 className="w-5 h-5" />}
        storageKey={STORAGE_KEYS.allTools}
        defaultOpen={false}
      >
        <Suspense fallback={<NavCardsSkeleton />}>
          <NavCards />
        </Suspense>
      </CollapsibleSection>
    </div>
  );

  return (
    <DashboardLayout title="Employee Hub">
      <AdminPremiumScaffold
        hero={heroConfig}
        stats={heroStats}
        theme="emerald"
        sidePanel={isMobile ? undefined : sidePanelContent}
      >
        {mainContent}
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}

export default memo(Dashboard);
