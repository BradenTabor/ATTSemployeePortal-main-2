import { useMemo, useCallback, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { FOREMAN_NAV_CARDS, getCommonNavCards } from "../../components/admin/adminNavConfig";
import { useAuth } from "../../contexts/AuthContext";
import { DashboardAvatar } from "../../components/dashboard/DashboardAvatar";
import ProfileBar from "../../components/ProfileBar";
import BrandedNavCard from "../../components/BrandedNavCard";
import { EnableNotificationsButton } from "../../components/notifications";
import { ScrollReveal } from "../../motion";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { TextEffect } from "../../components/ui/TextEffect";

// Lazy-loaded announcement card
const ThemedAnnouncementCard = lazy(() => import("../../components/ThemedAnnouncementCard"));

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

export default function ForemanDashboard() {
  const { role, user, setSession, signOut, fullName } = useAuth();
  const navigate = useNavigate();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  // Get common nav cards with bluewhite theme
  const commonCards = useMemo(() => getCommonNavCards("bluewhite"), []);

  // Display name - must be called before any conditional returns
  const displayName = useMemo(() => fullName || user?.email || "Foreman", [fullName, user?.email]);
  
  // Animation settings
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  // Sign out handler - must be called before any conditional returns
  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  }, [navigate, setSession, signOut]);

  // Access control - redirect if not authorized (AFTER all hooks)
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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Premium Animated Welcome Section with Glass Backdrop - Blue Theme */}
        <div className="mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Glass backdrop container - Blue theme */}
            <div 
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.1) 0%, rgba(10, 22, 40, 0.65) 40%, rgba(2, 4, 8, 0.75) 100%)',
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
              
              {/* Inner blue glow */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at 25% 0%, rgba(59, 130, 246, 0.2) 0%, transparent 45%)',
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
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/30"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-[#bfdbfe]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f0f9ff]">
                      Foreman
                    </span>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a1628]/60 border border-[#3b82f6]/20"
                  >
                    <Users className="w-3 h-3 text-[#bfdbfe]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#f0f9ff]/70">
                      {role === "admin" ? "Admin Access" : "Foreman"}
                    </span>
                  </motion.div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Gradient line accent - Blue */}
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#bfdbfe] via-[#3b82f6] to-[#1d4ed8] origin-top flex-shrink-0"
                    style={{
                      boxShadow: '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.25)',
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
                        segmentWrapperClassName="bg-gradient-to-r from-white via-[#bfdbfe] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(59,130,246,0.35)]"
                      >
                        {`Welcome back, ${displayName}`}
                      </TextEffect>
                    ) : (
                      <h1 
                        className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#bfdbfe] to-white/90 bg-clip-text text-transparent"
                      >
                        {`Welcome back, ${displayName}`}
                      </h1>
                    )}
                    
                    {/* Description */}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7, ease: 'easeOut' }}
                      className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#bfdbfe]/50 font-medium leading-relaxed max-w-xl"
                    >
                      Manage your crew, track daily progress, and coordinate assignments
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

        {/* Main content area */}
        <div className="space-y-5 md:space-y-6">
          {/* Announcements Section */}
          <ScrollReveal variant="fadeUp" delay={0}>
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

          {/* Common Features Section */}
          <ScrollReveal variant="fadeUp" delay={0.05}>
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#bfdbfe]/70 font-medium px-1">
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
                      variant="bluewhite"
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </ScrollReveal>

          {/* Foreman Tools Section */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#bfdbfe]/70 font-medium px-1">
                Foreman Tools
              </p>
              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3"
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
            </div>
          </ScrollReveal>

          {/* Crew Status Section */}
          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div className="rounded-3xl border border-blue-500/25 bg-gradient-to-br from-[#0a1628]/60 to-[#020408]/60 p-6">
              <div className="flex items-center gap-3 mb-4">
                <DashboardAvatar variant="jobs" className="w-8 h-8" />
                <h3 className="text-lg font-semibold text-white">
                  My Crew Status
                </h3>
              </div>
              <p className="text-sm text-[#f0f9ff]/70">
                Your crew assignments and member status will appear here.
              </p>
            </div>
          </ScrollReveal>

          {/* Daily Reports Section */}
          <ScrollReveal variant="fadeUp" delay={0.3}>
            <div className="rounded-3xl border border-blue-500/25 bg-gradient-to-br from-[#0a1628]/60 to-[#020408]/60 p-6">
              <div className="flex items-center gap-3 mb-4">
                <DashboardAvatar variant="announcements" className="w-8 h-8" />
                <h3 className="text-lg font-semibold text-white">
                  Daily Reports
                </h3>
              </div>
              <p className="text-sm text-[#f0f9ff]/70">
                Submit and view your daily job progress reports here.
              </p>
            </div>
          </ScrollReveal>

          {/* Push Notifications Toggle */}
          <ScrollReveal variant="fadeUp" delay={0.4}>
            <div className="flex justify-center">
              <EnableNotificationsButton variant="bluewhite" />
            </div>
          </ScrollReveal>

          {/* Profile Bar - Bottom section */}
          <ScrollReveal variant="fadeUp" delay={0.45}>
            <ProfileBar
              email={user?.email}
              role={role}
              onSignOut={handleSignOut}
              theme="bluewhite"
            />
          </ScrollReveal>
        </div>
      </div>
    </DashboardLayout>
  );
}
