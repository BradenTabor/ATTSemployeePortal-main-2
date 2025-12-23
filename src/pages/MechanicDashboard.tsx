import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { ScrollReveal } from "../motion";
import { 
  LogOut,
} from "lucide-react";
import { MECHANIC_NAV_CARDS } from "../components/admin/adminNavConfig";
import { fetchDvirMetrics, type DvirMetrics } from "../lib/dvirMetrics";
import { logger } from "../lib/logger";
import { supabase } from "../lib/supabaseClient";
import { MechanicAvatar } from "../components/admin/MechanicAvatar";
import { EmberExpandableSection } from "../components/dashboard/EmberExpandableSection";
import { DashboardAvatar } from "../components/dashboard/DashboardAvatar";
import AdminPremiumScaffold, { type AdminHeroConfig } from "../components/admin/AdminPremiumScaffold";
import BrandedNavCard from "../components/BrandedNavCard";
import { getDeviceCapabilities } from "../lib/mobilePerf";

// Persistence keys for section states
const PERSISTENCE_KEYS = {
  QUICK_ACTIONS: 'mechanic_quick_actions_open',
};

// Stagger animation variants for cards
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
      type: "spring",
      stiffness: 500,
      damping: 30,
    }
  },
};

// Mechanic navigation cards component using BrandedNavCard
function MechanicNavCards() {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  // Filter active vs coming soon cards
  const activeCards = MECHANIC_NAV_CARDS.filter(card => !card.comingSoon);
  const comingSoonCards = MECHANIC_NAV_CARDS.filter(card => card.comingSoon);

  return (
    <div className="space-y-4">
      {/* Active cards using BrandedNavCard */}
      <motion.div 
        className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3"
        variants={shouldReduceMotion ? undefined : containerVariants}
        initial="hidden"
        animate="visible"
      >
        {activeCards.map((card) => (
          <motion.div key={card.to} variants={shouldReduceMotion ? undefined : itemVariants}>
            <BrandedNavCard
              title={card.title}
              description={card.description}
              icon={card.icon}
              to={card.to}
              variant="ember"
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Coming Soon cards - muted styling */}
      {comingSoonCards.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#ffb48a]/50 font-medium px-1">
            Coming Soon
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {comingSoonCards.map((card) => (
              <div 
                key={card.to}
                className="group relative opacity-50 cursor-not-allowed"
              >
                <div className="relative w-full p-[2px] rounded-2xl overflow-hidden bg-gradient-to-br from-[#341109]/40 via-[#120504]/50 to-[#050201]/40">
                  <div className="relative h-full w-full rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 flex items-center gap-3.5 min-h-[60px] border border-[#f38d57]/15 bg-[#0a0504]/80">
                    {/* Muted icon */}
                    <div className="flex-shrink-0 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#ff9350]/5 border border-[#ff9350]/10">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400/40 [&>svg]:w-full [&>svg]:h-full">
                        {card.icon}
                      </div>
                    </div>
                    
                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-semibold text-white/40 truncate">
                          {card.title}
                        </h3>
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-[#ff9350]/15 text-[#ffb48a]/60 border border-[#ff9350]/20">
                          Soon
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm mt-0.5 line-clamp-1 sm:line-clamp-2 text-white/25">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MechanicDashboard() {
  const navigate = useNavigate();
  const { role, user, signOut, setSession } = useAuth();
  const unauthorized = role && role !== "mechanic" && role !== "admin";
  const [dvirMetrics, setDvirMetrics] = useState<DvirMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [equipmentCount, setEquipmentCount] = useState(0);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
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

  // Display name
  const displayName = fullName || user?.email || 'Mechanic';

  useEffect(() => {
    let isMounted = true;
    const refreshMs = 60_000;

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
    const interval = setInterval(() => loadMetrics(false), refreshMs);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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

  useEffect(() => {
    loadEquipmentCount();
  }, [loadEquipmentCount]);

  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }, [navigate, setSession, signOut]);

  // Hero config with avatar
  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      heading: `Welcome back, ${displayName}`,
      description: "Manage vehicle inspections, equipment maintenance, and keep the fleet running smoothly.",
      avatar: <MechanicAvatar className="w-full h-full" />,
    }),
    [displayName]
  );

  // Side panel content
  const sidePanelContent = (
    <div className="space-y-6">
      {/* Profile card with sign out */}
      <div className="rounded-3xl border border-[#ff9350]/20 bg-[#140804]/80 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.35em] text-[#ffb48a]/70">
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
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-[#ff0000] px-3 py-2 text-xs font-semibold border border-red-100/40 hover:bg-red-600 transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </motion.button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="hidden lg:block rounded-3xl border border-[#ff9350]/20 bg-[#140804]/80 p-5 space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-[#ffb48a]/70">
          Quick Stats
        </p>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/60">Open DVIRs</span>
            <span className="text-sm font-semibold text-[#ffb48a]">
              {metricsLoading ? "–" : dvirMetrics?.totalOpen ?? 0}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/60">Equipment Inspections</span>
            <span className="text-sm font-semibold text-[#ffb48a]">
              {equipmentLoading ? "–" : equipmentCount}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-white/60">Today's DVIRs</span>
            <span className="text-sm font-semibold text-[#ffb48a]">
              {metricsLoading ? "–" : dvirMetrics?.todaysReports ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

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
      <AdminPremiumScaffold
        hero={heroConfig}
        theme="ember"
        sidePanel={sidePanelContent}
      >
        {/* Mobile-first Bento layout */}
        <div className="w-full space-y-4 md:space-y-6">
          {/* All Tools & Features */}
          <ScrollReveal variant="fadeUp" delay={0}>
            <EmberExpandableSection
              id="mechanic-quick-actions"
              title="All Tools & Features"
              subtitle="Complete navigation menu"
              icon={<DashboardAvatar variant="jobs" className="w-8 h-8 md:w-10 md:h-10" />}
              storageKey={PERSISTENCE_KEYS.QUICK_ACTIONS}
              defaultOpen={false}
            >
              <MechanicNavCards />
            </EmberExpandableSection>
          </ScrollReveal>
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}
