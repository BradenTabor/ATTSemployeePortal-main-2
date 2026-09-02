import { useEffect, useState, useCallback, useMemo, Suspense, lazy, memo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Wrench, ChevronRight, Shield } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { MECHANIC_NAV_CARDS, getCommonNavCards } from "../../components/admin/adminNavConfig";
import { fetchDvirMetrics, type DvirMetrics } from "../../lib/dvirMetrics";
import { logger } from "../../lib/logger";
import { supabase } from "../../lib/supabaseClient";
import { AvatarDropdownPortal } from "../../components/dashboard/AvatarDropdownPortal";
import { EnableNotificationsButton } from "../../components/notifications";
import { canopy } from "../../lib/glass";
import { Eyebrow } from "../../components/canopy/Eyebrow";
import { getDeviceCapabilities } from "../../lib/mobilePerf";

// Lazy-loaded components
const ThemedAnnouncementCard = lazy(() => import("../../components/ThemedAnnouncementCard"));
const FleetAiSummary = lazy(() => import("./components/FleetAiSummary"));
const PendingDefectsWidget = lazy(() => import("./components/PendingDefectsWidget"));

// Compact stagger animation
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 25 }
  },
};

// =============================================================================
// COMPACT NAV CARD - Mobile-optimized, mechanic theme
// =============================================================================
const CompactNavCard = memo(function CompactNavCard({
  title,
  icon,
  to,
  description,
  comingSoon = false,
}: {
  title: string;
  icon: React.ReactNode;
  to: string;
  description?: string;
  comingSoon?: boolean;
}) {
  const navigate = useNavigate();

  if (comingSoon) {
    return (
      <div className="relative rounded-leaf-sm border border-bone-50/[0.06] bg-ink-950/40 overflow-hidden">
        <div className="flex items-center gap-3 px-3.5 py-3 opacity-75">
          <div className="w-10 h-10 rounded-leaf-sm bg-bone-50/[0.03] border border-bone-50/[0.08] flex items-center justify-center text-bone-500 flex-shrink-0 [&>img]:max-w-[20px] [&>img]:max-h-[20px] [&>img]:object-contain">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white/50 truncate">{title}</span>
              <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-bone-50/[0.06] text-bone-400 border border-bone-50/[0.1] font-mono flex-shrink-0">
                Soon
              </span>
            </div>
            {description && (
              <span className="text-[11px] text-bone-500 line-clamp-2 mt-0.5 block">{description}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.button
      onClick={() => navigate(to)}
      className="group w-full flex items-center gap-3 px-3.5 py-3 rounded-leaf-sm text-left bg-ink-950/60 border border-bone-50/[0.08] hover:border-lime-400/40 hover:bg-ink-900/80 active:scale-[0.99] transition-[border-color,background-color,transform] duration-500 ease-canopy focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/70"
      whileTap={{ scale: 0.99 }}
    >
      <div className="w-10 h-10 rounded-leaf-sm bg-verdant-500/15 border border-verdant-400/25 flex items-center justify-center text-lime-300 group-hover:text-lime-200 transition-colors flex-shrink-0 [&>img]:max-w-[22px] [&>img]:max-h-[22px] [&>img]:object-contain">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-white/95 group-hover:text-white truncate block">{title}</span>
        {description && (
          <span className="text-[11px] text-bone-400 group-hover:text-bone-300 truncate block mt-0.5">{description}</span>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-bone-500 group-hover:text-lime-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </motion.button>
  );
});

// =============================================================================
// QUICK ACTION GRID - Prominent action buttons
// =============================================================================
const QuickActionGrid = memo(function QuickActionGrid() {
  const navigate = useNavigate();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;
  
  const quickActions = [
    { label: "DVIR Queue", to: "/mechanic-dvir-center", icon: <Wrench className="w-5 h-5" />, primary: true },
    { label: "Parts & Repairs", to: "/mechanic/parts-repairs", icon: <Shield className="w-5 h-5" />, primary: false },
  ];
  
  return (
    <motion.div 
      className="grid grid-cols-2 gap-2"
      variants={shouldReduceMotion ? undefined : staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {quickActions.map((action) => (
        <motion.button
          key={action.to}
          onClick={() => navigate(action.to)}
          variants={shouldReduceMotion ? undefined : fadeUp}
          className={`group relative overflow-hidden rounded-leaf-sm px-3 py-4 text-sm font-semibold transition-[border-color,background-color,transform] duration-500 ease-canopy active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 ${
            action.primary
              ? "border border-bone-50/30 bg-[linear-gradient(135deg,#F4F7F2_0%,#D2FFA3_100%)] text-ink-950 shadow-[0_2px_6px_rgba(0,0,0,0.5),0_18px_36px_-18px_rgba(184,255,122,0.8)] hover:shadow-glow-lime"
              : "border border-bone-50/[0.1] bg-ink-950/60 text-bone-100 hover:border-lime-400/50 hover:bg-ink-900/80"
          }`}
          whileTap={{ scale: 0.97 }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className={action.primary ? "text-ink-950" : "text-lime-300"}>
              {action.icon}
            </div>
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.18em]">{action.label}</span>
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
});

// =============================================================================
// NAV SECTION - Grouped panel with mechanic theme
// =============================================================================
const NavSection = memo(function NavSection({
  title,
  cards,
}: {
  title: string;
  cards: Array<{ title: string; description?: string; icon?: React.ReactNode; to: string; comingSoon?: boolean }>;
}) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  return (
    <section className="rounded-leaf border border-bone-50/[0.08] bg-ink-900/70 overflow-hidden shadow-slab">
      <div className="px-4 pt-3.5 pb-2.5 border-b border-bone-50/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 rounded-full bg-lime-400 flex-shrink-0" />
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-lime-300/80">{title}</p>
        </div>
      </div>
      <div className="p-2.5 space-y-1.5">
        <motion.div
          className="space-y-1.5"
          variants={shouldReduceMotion ? undefined : staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {cards.map((card) => (
            <motion.div key={card.to} variants={shouldReduceMotion ? undefined : fadeUp}>
              <CompactNavCard
                title={card.title}
                description={card.description}
                icon={card.icon}
                to={card.to}
                comingSoon={card.comingSoon}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
});

// =============================================================================
// MAIN DASHBOARD
// =============================================================================
export default function MechanicDashboard() {
  const navigate = useNavigate();
  const { role, user, signOut, setSession, fullName, avatarUrl } = useAuth();
  const unauthorized = role && role !== "mechanic" && role !== "admin";
  
  // Metrics state
  const [_dvirMetrics, setDvirMetrics] = useState<DvirMetrics | null>(null);
  const [_metricsLoading, setMetricsLoading] = useState(true);
  const [_equipmentCount, setEquipmentCount] = useState(0);
  const [_equipmentLoading, setEquipmentLoading] = useState(true);
  void _dvirMetrics; void _metricsLoading; void _equipmentCount; void _equipmentLoading;

  const displayName = fullName || user?.email?.split('@')[0] || 'Mechanic';
  const firstName = displayName.split(' ')[0];

  // Data fetching
  useEffect(() => {
    let isMounted = true;
    const loadMetrics = async (withSpinner: boolean) => {
      if (withSpinner) setMetricsLoading(true);
      try {
        const data = await fetchDvirMetrics();
        if (isMounted) setDvirMetrics(data);
      } catch (error) {
        logger.error("[MechanicDashboard] Failed to fetch DVIR metrics", error);
      } finally {
        if (isMounted) setMetricsLoading(false);
      }
    };
    loadMetrics(true);
    const interval = setInterval(() => loadMetrics(false), 60_000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const loadEquipmentCount = useCallback(async () => {
    try {
      setEquipmentLoading(true);
      const { count, error } = await supabase
        .from("daily_equipment_inspections")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      setEquipmentCount(count ?? 0);
    } catch (error) {
      logger.error("[MechanicDashboard] Failed to load equipment count", error);
      setEquipmentCount(0);
    } finally {
      setEquipmentLoading(false);
    }
  }, []);

  useEffect(() => { loadEquipmentCount(); }, [loadEquipmentCount]);

  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      logger.error("[MechanicDashboard] Sign out failed:", error);
    }
  }, [navigate, setSession, signOut]);

  // Memoized nav cards
  const commonCards = useMemo(() => getCommonNavCards("ember"), []);
  const activeCards = useMemo(() => MECHANIC_NAV_CARDS.filter(card => !card.comingSoon), []);
  const comingSoonCards = useMemo(() => MECHANIC_NAV_CARDS.filter(card => card.comingSoon), []);

  // Unauthorized check
  if (unauthorized) {
    return (
      <DashboardLayout title="Mechanic Panel" pageHeading>
        <div className="max-w-xl mx-auto mt-10 text-center text-sm text-gray-300">
          You do not have permission to view the mechanic panel.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Mechanic Panel" pageHeading>
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pb-6 pt-2 sm:pt-4">
        
        {/* ============ COMPACT HERO HEADER ============ */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4"
        >
          <div className={`${canopy.hero} px-5 py-6 sm:px-7 sm:py-7`}>
            <div
              aria-hidden
              className="pointer-events-none absolute -left-20 -top-28 h-64 w-64 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(210,255,163,0.26) 0%, transparent 70%)' }}
            />

            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Eyebrow tone="lime" rule={false}>
                  <span className="inline-flex items-center gap-2">
                    <Wrench className="h-3 w-3" aria-hidden />
                    Mechanic{role === "admin" ? " · admin access" : ""}
                  </span>
                </Eyebrow>
                <h1 className="type-display mt-4 truncate text-[clamp(1.9rem,5vw,3rem)] font-light text-bone-50">
                  Hey, <span className="italic text-lime-300 text-glow">{firstName}</span>
                </h1>
                <p className="mt-2 text-sm text-bone-300">Keep the fleet running smooth.</p>
              </div>

              <div className="relative z-10 shrink-0">
                <AvatarDropdownPortal
                  email={user?.email}
                  role={role}
                  fullName={fullName || user?.email || ''}
                  avatarUrl={avatarUrl}
                  theme="ember"
                  onSignOut={handleSignOut}
                />
              </div>
            </div>
          </div>
        </motion.header>

        {/* ============ QUICK ACTIONS ============ */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="mb-4"
        >
          <QuickActionGrid />
        </motion.section>

        {/* ============ MAIN CONTENT ============ */}
        <div className="space-y-3">
          
          {/* Announcements - Compact */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Suspense fallback={
              <div className="rounded-leaf-sm border border-bone-50/[0.06] bg-ink-950/60 p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded bg-bone-50/10" />
                  <div className="h-3 w-20 bg-white/10 rounded-full" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-full bg-white/10 rounded-full" />
                  <div className="h-3 w-2/3 bg-white/10 rounded-full" />
                </div>
              </div>
            }>
              <ThemedAnnouncementCard theme="ember" />
            </Suspense>
          </motion.section>

          {/* Fleet AI Summary */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Suspense fallback={
              <div className="rounded-xl border border-purple-500/15 bg-purple-900/10 p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20" />
                  <div className="h-4 w-24 bg-white/10 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-14 rounded-lg bg-white/5" />
                  <div className="h-14 rounded-lg bg-white/5" />
                  <div className="h-14 rounded-lg bg-white/5" />
                </div>
              </div>
            }>
              <FleetAiSummary />
            </Suspense>
          </motion.section>

          {/* Pending Defects Widget - Jidoka Maintenance */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <Suspense fallback={
              <div className="rounded-leaf-sm border border-bone-50/[0.06] bg-ink-950/60 p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-bone-50/10" />
                  <div className="h-4 w-32 bg-white/10 rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="h-12 rounded-lg bg-white/5" />
                  <div className="h-12 rounded-lg bg-white/5" />
                </div>
              </div>
            }>
              <PendingDefectsWidget />
            </Suspense>
          </motion.section>

          {/* Navigation Cards - Collapsible sections */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-4"
          >
            {/* Common Features */}
            <NavSection title="Quick Links" cards={commonCards} />
            
            {/* Mechanic Tools */}
            <NavSection title="Mechanic Tools" cards={activeCards} />
            
            {/* Coming Soon */}
            {comingSoonCards.length > 0 && (
              <NavSection title="Coming Soon" cards={comingSoonCards} />
            )}
          </motion.section>

          {/* Notifications Toggle - Minimal */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="pt-2"
          >
            <div className="flex justify-center">
              <EnableNotificationsButton variant="ember" />
            </div>
          </motion.section>
        </div>
      </div>
    </DashboardLayout>
  );
}
