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
// COMPACT NAV CARD - Mobile-optimized
// =============================================================================
const CompactNavCard = memo(function CompactNavCard({ 
  title, 
  icon, 
  to, 
  description,
  comingSoon = false 
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
      <div className="relative opacity-50 cursor-not-allowed">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#1a0c08]/60 border border-orange-500/10">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400/50">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white/40 truncate">{title}</span>
              <span className="text-[8px] uppercase font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-300/50 border border-orange-500/20">
                Soon
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <motion.button
      onClick={() => navigate(to)}
      className="group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#1a0c08] to-[#0f0705] border border-orange-500/20 hover:border-orange-500/40 active:scale-[0.98] transition-all"
      whileTap={{ scale: 0.98 }}
    >
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/25 to-orange-600/15 flex items-center justify-center text-orange-400 group-hover:text-orange-300 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <span className="text-sm font-semibold text-white/90 group-hover:text-white truncate block">{title}</span>
        {description && (
          <span className="text-[10px] text-orange-300/40 truncate block">{description}</span>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-orange-400/40 group-hover:text-orange-400/70 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
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
          className={`relative overflow-hidden rounded-xl px-3 py-3.5 font-bold text-sm transition-all active:scale-[0.97] ${
            action.primary 
              ? "bg-gradient-to-br from-orange-500 via-orange-600 to-amber-700 text-white shadow-lg shadow-orange-500/30" 
              : "bg-gradient-to-br from-[#2b1810] to-[#1a0c08] text-orange-200 border border-orange-500/25 hover:border-orange-500/40"
          }`}
          whileTap={{ scale: 0.97 }}
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className={action.primary ? "text-white/90" : "text-orange-400"}>
              {action.icon}
            </div>
            <span className="truncate">{action.label}</span>
          </div>
          {action.primary && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          )}
        </motion.button>
      ))}
    </motion.div>
  );
});

// =============================================================================
// NAV SECTION - Collapsible tools menu
// =============================================================================
const NavSection = memo(function NavSection({ 
  title, 
  cards 
}: { 
  title: string; 
  cards: Array<{ title: string; description?: string; icon?: React.ReactNode; to: string; comingSoon?: boolean }> 
}) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;
  
  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-[0.2em] text-orange-400/50 font-bold px-1">{title}</p>
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
      console.error('Sign out failed:', error);
    }
  }, [navigate, setSession, signOut]);

  // Memoized nav cards
  const commonCards = useMemo(() => getCommonNavCards("ember"), []);
  const activeCards = useMemo(() => MECHANIC_NAV_CARDS.filter(card => !card.comingSoon), []);
  const comingSoonCards = useMemo(() => MECHANIC_NAV_CARDS.filter(card => card.comingSoon), []);

  // Unauthorized check
  if (unauthorized) {
    return (
      <DashboardLayout title="Mechanic Panel">
        <div className="max-w-xl mx-auto mt-10 text-center text-sm text-gray-300">
          You do not have permission to view the mechanic panel.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Mechanic Panel">
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pb-6 pt-2 sm:pt-4">
        
        {/* ============ COMPACT HERO HEADER ============ */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4"
        >
          <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-[#1f0f09] via-[#150906]/90 to-[#0a0504] shadow-lg shadow-orange-900/20">
            {/* Subtle glow */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Content */}
            <div className="relative px-4 py-3.5 sm:py-4">
              {/* Top row: badges + avatar */}
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-500/15 border border-orange-500/25">
                    <Wrench className="w-3 h-3 text-orange-400" />
                    <span className="text-[9px] uppercase tracking-wider font-bold text-orange-200">Mechanic</span>
                  </div>
                  {role === "admin" && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1a0c08]/80 border border-orange-500/15">
                      <Shield className="w-2.5 h-2.5 text-orange-400/70" />
                      <span className="text-[8px] uppercase tracking-wider font-semibold text-orange-300/60">Admin</span>
                    </div>
                  )}
                </div>
                
                <AvatarDropdownPortal
                  email={user?.email}
                  role={role}
                  fullName={fullName || user?.email || ''}
                  avatarUrl={avatarUrl}
                  theme="ember"
                  onSignOut={handleSignOut}
                />
              </div>

              {/* Welcome text - compact */}
              <div className="flex items-center gap-3">
                <div className="w-1 h-10 rounded-full bg-gradient-to-b from-orange-400 via-orange-500 to-orange-700 flex-shrink-0 shadow-[0_0_12px_rgba(249,115,22,0.5)]" />
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-black text-white truncate">
                    Hey, <span className="text-orange-300">{firstName}</span> 👋
                  </h1>
                  <p className="text-[11px] sm:text-xs text-orange-200/40 font-medium truncate">
                    Keep the fleet running smooth
                  </p>
                </div>
              </div>
            </div>
            
            {/* Bottom accent line */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
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
              <div className="rounded-xl border border-orange-500/15 bg-[#1a0c08]/60 p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded bg-orange-500/20" />
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
              <div className="rounded-xl border border-orange-500/15 bg-[#1a0c08]/60 p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20" />
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
