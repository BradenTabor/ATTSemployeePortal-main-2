import { useEffect, useState, useCallback, useMemo, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Wrench } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { ScrollReveal } from "../../motion";
import { MECHANIC_NAV_CARDS, getCommonNavCards } from "../../components/admin/adminNavConfig";
import { fetchDvirMetrics, type DvirMetrics } from "../../lib/dvirMetrics";
import { logger } from "../../lib/logger";
import { supabase } from "../../lib/supabaseClient";
import { EmberExpandableSection } from "../../components/dashboard/EmberExpandableSection";
import { DashboardAvatar } from "../../components/dashboard/DashboardAvatar";
import BrandedNavCard from "../../components/BrandedNavCard";
import ProfileBar from "../../components/ProfileBar";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { TextEffect } from "../../components/ui/TextEffect";

// Lazy-loaded announcement card
const ThemedAnnouncementCard = lazy(() => import("../../components/ThemedAnnouncementCard"));

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
      type: "spring" as const,
      stiffness: 500,
      damping: 30,
    }
  },
};

// Mechanic navigation cards component using BrandedNavCard
function MechanicNavCards() {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  // Get common nav cards with ember theme
  const commonCards = useMemo(() => getCommonNavCards("ember"), []);

  // Filter active vs coming soon cards for role-specific
  const activeCards = MECHANIC_NAV_CARDS.filter(card => !card.comingSoon);
  const comingSoonCards = MECHANIC_NAV_CARDS.filter(card => card.comingSoon);

  return (
    <div className="space-y-6">
      {/* Common Features Section */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#ffb48a]/70 font-medium px-1">
          Common Features
        </p>
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3"
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
                variant="ember"
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Mechanic Tools Section */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#ffb48a]/70 font-medium px-1">
          Mechanic Tools
        </p>
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
      </div>

      {/* Coming Soon cards - muted styling */}
      {comingSoonCards.length > 0 && (
        <div className="space-y-3">
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
  // Metrics state - stored for future dashboard stats display
  const [_dvirMetrics, setDvirMetrics] = useState<DvirMetrics | null>(null);
  const [_metricsLoading, setMetricsLoading] = useState(true);
  const [_equipmentCount, setEquipmentCount] = useState(0);
  const [_equipmentLoading, setEquipmentLoading] = useState(true);
  void _dvirMetrics; void _metricsLoading; void _equipmentCount; void _equipmentLoading; // Suppress warnings
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

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Premium Animated Welcome Section with Glass Backdrop - Ember Theme */}
        <div className="mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Glass backdrop container - Ember theme */}
            <div 
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background: 'linear-gradient(145deg, rgba(255, 111, 60, 0.1) 0%, rgba(43, 18, 11, 0.65) 40%, rgba(8, 4, 3, 0.75) 100%)',
                backdropFilter: 'blur(24px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              }}
            >
              {/* Realistic glass gloss - diagonal shine reflection */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, transparent 50%, transparent 100%)',
                }}
              />
              
              {/* Secondary gloss layer */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%)',
                }}
              />
              
              {/* Inner ember glow */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at 25% 0%, rgba(255, 147, 80, 0.2) 0%, transparent 45%)',
                }}
              />
              
              {/* Specular highlight - corner gleam */}
              <div 
                className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)',
                }}
              />
              
              {/* Top edge highlight */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />
              
              {/* Left edge highlight */}
              <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-l-[inherit]" />

              {/* Content area */}
              <div className="relative px-5 py-4 md:px-7 md:py-5">
                {/* Eyebrow with role badge */}
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#ff6f3c]/15 border border-[#ff6f3c]/30"
                  >
                    <Wrench className="w-3.5 h-3.5 text-[#ffb48a]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#ffe7d0]">
                      Mechanic
                    </span>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2b120b]/60 border border-[#ff6f3c]/20"
                  >
                    <Wrench className="w-3 h-3 text-[#ffb48a]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#ffe7d0]/70">
                      {role === "admin" ? "Admin Access" : "Mechanic"}
                    </span>
                  </motion.div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Gradient line accent - Ember/Orange */}
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#ffb48a] via-[#ff6f3c] to-[#d45a2a] origin-top flex-shrink-0"
                    style={{
                      boxShadow: '0 0 20px rgba(255, 111, 60, 0.5), 0 0 40px rgba(255, 111, 60, 0.25)',
                    }}
                  />
                  
                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect
                        as="h1"
                        preset="blurSlide"
                        per="char"
                        delay={0.15}
                        className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight"
                        segmentWrapperClassName="bg-gradient-to-r from-white via-[#ffb48a] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,111,60,0.35)]"
                      >
                        {`Welcome back, ${displayName}`}
                      </TextEffect>
                    ) : (
                      <h1 
                        className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#ffb48a] to-white/90 bg-clip-text text-transparent"
                      >
                        {`Welcome back, ${displayName}`}
                      </h1>
                    )}
                    
                    {/* Description */}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7, ease: 'easeOut' }}
                      className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#ffb48a]/50 font-medium leading-relaxed max-w-xl"
                    >
                      Manage vehicle inspections, equipment maintenance, and keep the fleet running
                    </motion.p>
                  </div>
                </div>
              </div>
              
              {/* Bottom edge shadow */}
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              
              {/* Right edge shadow */}
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        {/* Mobile-first Bento layout */}
        <div className="w-full space-y-4 md:space-y-6">
          {/* Announcements Section */}
          <ScrollReveal variant="fadeUp" delay={0}>
            <Suspense fallback={
              <div className="rounded-3xl border border-orange-500/20 bg-[#281405]/70 p-5 space-y-3 animate-pulse">
                <div className="h-3 w-32 bg-white/10 rounded-full" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-white/10 rounded-full" />
                  <div className="h-3 w-3/4 bg-white/10 rounded-full" />
                </div>
              </div>
            }>
              <ThemedAnnouncementCard theme="ember" />
            </Suspense>
          </ScrollReveal>

          {/* All Tools & Features */}
          <ScrollReveal variant="fadeUp" delay={0.05}>
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

          {/* Profile Bar - Bottom section */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <ProfileBar
              email={user?.email}
              role={role}
              onSignOut={handleSignOut}
              theme="ember"
            />
          </ScrollReveal>
        </div>
      </div>
    </DashboardLayout>
  );
}
