import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { 
  LogOut,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { MECHANIC_NAV_CARDS } from "../components/admin/adminNavConfig";
import { fetchDvirMetrics, type DvirMetrics } from "../lib/dvirMetrics";
import { logger } from "../lib/logger";
import { supabase } from "../lib/supabaseClient";
import { MechanicAvatar } from "../components/admin/MechanicAvatar";
import { EmberExpandableSection } from "../components/dashboard/EmberExpandableSection";
import { DashboardAvatar } from "../components/dashboard/DashboardAvatar";
import AdminPremiumScaffold, { type AdminHeroConfig } from "../components/admin/AdminPremiumScaffold";

// Persistence keys for section states
const PERSISTENCE_KEYS = {
  QUICK_ACTIONS: 'mechanic_quick_actions_open',
};

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
          <EmberExpandableSection
            id="mechanic-quick-actions"
            title="All Tools & Features"
            subtitle="Complete navigation menu"
            icon={<DashboardAvatar variant="jobs" className="w-8 h-8 md:w-10 md:h-10" />}
            storageKey={PERSISTENCE_KEYS.QUICK_ACTIONS}
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MECHANIC_NAV_CARDS.map((card) => {
                const baseClassName = `group flex items-start gap-3 rounded-xl border px-4 py-3 transition-all ${
                  card.comingSoon 
                    ? "border-[#ff9350]/10 bg-[#140804]/40 opacity-70 cursor-not-allowed"
                    : "border-[#ff9350]/20 bg-[#140804]/60 hover:border-[#ff9350]/40 hover:bg-[#1a0a06]"
                }`;
                
                const content = (
                  <>
                    <div className={`flex-shrink-0 p-2 rounded-lg border ${
                      card.comingSoon 
                        ? "bg-[#ff9350]/5 border-[#ff9350]/10" 
                        : "bg-[#ff9350]/10 border-[#ff9350]/20"
                    }`}>
                      {card.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold transition-colors ${
                          card.comingSoon 
                            ? "text-white/60" 
                            : "text-white group-hover:text-[#ffe4c9]"
                        }`}>
                          {card.title}
                        </p>
                        {card.comingSoon && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#ff9350]/20 text-[#ffb48a] border border-[#ff9350]/30">
                            Coming Soon
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 line-clamp-2 ${
                        card.comingSoon ? "text-white/30" : "text-white/50"
                      }`}>
                        {card.description}
                      </p>
                    </div>
                    {!card.comingSoon && (
                      <ArrowRight className="w-4 h-4 text-[#ffb48a]/40 group-hover:text-[#ffb48a] group-hover:translate-x-0.5 transition-all mt-1" />
                    )}
                  </>
                );
                
                return card.comingSoon ? (
                  <div key={card.to} className={baseClassName}>
                    {content}
                  </div>
                ) : (
                  <Link key={card.to} to={card.to} className={baseClassName}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </EmberExpandableSection>
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}
