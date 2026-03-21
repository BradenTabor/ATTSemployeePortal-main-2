import { useMemo, useCallback, Suspense, lazy, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "react-router-dom";
import { HardHat, Shield, Truck, Users, CalendarCheck } from "lucide-react";
import IncidentLoggingModal from "../../components/admin/IncidentLoggingModal";
import SafetyIncidentsList from "../../components/admin/SafetyIncidentsList";
import SafetyPointsLeaderboard from "../../components/admin/SafetyPointsLeaderboard";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { getCommonNavCards } from "../../components/admin/adminNavConfig";
import { useAuth } from "../../contexts/AuthContext";
import { getRoleDashboard } from "../../lib/navigation";
import { WelcomeHeader } from "../../components/dashboard";
import BrandedNavCard from "../../components/BrandedNavCard";
import { EnableNotificationsButton } from "../../components/notifications";
import { ScrollReveal } from "../../motion";
import { staggerContainer, staggerItem } from "../../motion/presets";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { glass } from "../../lib/glass";
import { logger } from "../../lib/logger";
import CrewStatusAnalytics from "./CrewStatusAnalytics";

const ThemedAnnouncementCard = lazy(() => import("../../components/ThemedAnnouncementCard"));

export default function GeneralForemanDashboard() {
  const { role, setSession, signOut } = useAuth();
  const navigate = useNavigate();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  // Get common nav cards with purple theme
  const commonCards = useMemo(() => getCommonNavCards("purple"), []);

  // Sign out handler - must be called before any conditional returns
  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      logger.error("[GeneralForemanDashboard] Sign out failed:", error);
    }
  }, [navigate, setSession, signOut]);

  // Access control - redirect if not authorized (AFTER all hooks)
  if (role !== "general_foreman" && role !== "admin") {
    return (
      <DashboardLayout title="Access Denied">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-[#c084fc]/10 flex items-center justify-center mx-auto mb-4">
              <HardHat className="w-10 h-10 text-[#c084fc]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400 mb-6">You don't have permission to view this page.</p>
            <button
              onClick={() => navigate(getRoleDashboard(role))}
              className="px-6 py-3 bg-[#c084fc] hover:bg-[#a855f7] text-white rounded-xl font-semibold transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="General Foreman Dashboard">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Compact Welcome Header - Purple Theme */}
        <div className="mb-5 md:mb-6">
          <WelcomeHeader
            theme="purple"
            onSignOut={handleSignOut}
            subtitle="Oversee crew assignments, safety compliance, and equipment"
            roleBadgeText={role === "admin" ? "Admin Access" : "General Foreman"}
          />
        </div>

        {/* Main content area */}
        <div className="space-y-5 md:space-y-6">
          {/* Announcements Section */}
          <ScrollReveal variant="fadeUp" delay={0}>
            <Suspense fallback={
              <div className="rounded-3xl border border-purple-500/20 bg-[#190a28]/70 p-5 space-y-3 animate-pulse">
                <div className="h-3 w-32 bg-white/10 rounded-full" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-white/10 rounded-full" />
                  <div className="h-3 w-3/4 bg-white/10 rounded-full" />
                </div>
              </div>
            }>
              <ThemedAnnouncementCard theme="purple" />
            </Suspense>
          </ScrollReveal>

          {/* Common Features Section - single composition: job-site + foreman as one scene */}
          <ScrollReveal variant="fadeUp" delay={0.05}>
            <div className="space-y-3">
              {/* Unified composition: viewport-scaled so it grows on larger screens (clamp + vw) */}
              <div
                className="relative overflow-hidden rounded-2xl max-w-5xl mx-auto bg-gradient-to-b from-[#1a0f24]/80 to-[#0f0814]/90"
                style={{ minHeight: 'clamp(220px, 28vw, 420px)' }}
              >
                {/* Job-site: scales with viewport */}
                <div
                  className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-center overflow-hidden pointer-events-none z-0"
                  aria-hidden
                >
                  <img
                    src="/assets/job-site.webp"
                    alt=""
                    width={600}
                    height={400}
                    decoding="async"
                    fetchPriority="low"
                    className="w-full h-[95%] object-contain object-bottom object-center select-none opacity-90"
                    style={{
                      imageRendering: 'auto',
                      WebkitBackfaceVisibility: 'hidden',
                      backfaceVisibility: 'hidden',
                      transform: 'translateZ(0)',
                      minHeight: 'clamp(200px, 24vw, 380px)',
                      maxHeight: 'clamp(280px, 32vw, 520px)',
                    }}
                  />
                </div>
                {/* General foreman: height scales with viewport so he grows on large screens */}
                <div
                  className="absolute right-0 bottom-0 left-0 flex items-end justify-end pointer-events-none z-10 pr-0"
                  aria-hidden
                >
                  <img
                    src="/assets/general-foreman-specialist.webp"
                    alt=""
                    width={312}
                    height={384}
                    decoding="async"
                    fetchPriority="low"
                    className="w-auto object-contain object-bottom object-right select-none drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
                    style={{
                      imageRendering: 'auto',
                      WebkitBackfaceVisibility: 'hidden',
                      backfaceVisibility: 'hidden',
                      transform: 'translateZ(0)',
                      height: 'clamp(140px, 18vw, 260px)',
                      background: 'radial-gradient(circle at 50% 50%, rgba(13, 12, 12, 1) 0%, rgba(136, 136, 136, 0) 70%, rgba(255, 255, 255, 0) 100%)',
                      border: 'none',
                      borderRadius: '30px',
                    }}
                  />
                </div>
                {/* COMMON FEATURES label - top-right */}
                <p
                  className="absolute right-0 top-0 z-20 px-3 py-2.5 uppercase tracking-[0.2em] text-[#e9d5ff]/90 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
                  style={{ fontSize: 'clamp(0.625rem, 1.2vw, 0.75rem)' }}
                >
                  Common Features
                </p>
              </div>
              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3"
                variants={shouldReduceMotion ? undefined : staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {commonCards.map((card) => (
                  <motion.div key={card.to} variants={shouldReduceMotion ? undefined : staggerItem}>
                    <BrandedNavCard
                      title={card.title}
                      description={card.description}
                      icon={card.icon}
                      to={card.to}
                      variant="purple"
                      iconAsImage={card.iconAsImage}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </ScrollReveal>

          {/* General Foreman Tools - 2-col asymmetric layout */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e9d5ff]/70 font-medium px-1">
                General Foreman Tools
              </p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {/* Safety Compliance - hero card spanning 3 cols */}
                <Link
                  to="/general-foreman/safety-compliance"
                  className={`${glass.cardPurple} md:col-span-3 p-5 sm:p-6 group transition-all duration-200 hover:border-purple-400/40 hover:shadow-[0_8px_32px_rgba(147,51,234,0.15)] block`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-purple-100 transition-colors">
                        Safety Compliance
                      </h3>
                      <p className="text-sm text-white/60 mt-1 leading-relaxed">
                        Review JSA submissions, audit crew safety reports, and export compliance records.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-purple-500/15">
                    <div className="flex items-center gap-1.5 text-xs text-purple-300/80">
                      <img loading="lazy" src="/assets/safety-compliance.webp" alt="" className="w-5 h-5 object-contain" />
                      JSA Review
                    </div>
                    <span className="text-xs text-purple-300/50 group-hover:text-purple-200/70 transition-colors ml-auto">
                      View all &rarr;
                    </span>
                  </div>
                </Link>

                {/* Right column: 2 stacked smaller cards */}
                <div className="md:col-span-2 grid grid-cols-1 gap-3">
                  <Link
                    to="/crew-oversight"
                    className={`${glass.subtlePurple} p-4 group transition-all duration-200 hover:border-purple-400/35 block`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-400/25 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-purple-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-white group-hover:text-purple-100 transition-colors">Crew Oversight</h4>
                        <p className="text-xs text-white/50 mt-0.5 truncate">Monitor assignments and progress</p>
                      </div>
                    </div>
                  </Link>
                  <Link
                    to="/general-foreman/equipment-logs"
                    className={`${glass.subtlePurple} p-4 group transition-all duration-200 hover:border-purple-400/35 block`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-400/25 flex items-center justify-center flex-shrink-0">
                        <Truck className="w-5 h-5 text-purple-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-white group-hover:text-purple-100 transition-colors">Equipment Logs</h4>
                        <p className="text-xs text-white/50 mt-0.5 truncate">DVIR and inspections</p>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Employee Attendance - full width card */}
              <Link
                to="/general-foreman/attendance"
                className={`${glass.subtlePurple} p-4 group transition-all duration-200 hover:border-purple-400/35 block`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-400/25 flex items-center justify-center flex-shrink-0">
                    <CalendarCheck className="w-5 h-5 text-purple-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-white group-hover:text-purple-100 transition-colors">Employee Attendance</h4>
                    <p className="text-xs text-white/50 mt-0.5">Track daily attendance for all crew members</p>
                  </div>
                  <span className="text-xs text-purple-300/50 group-hover:text-purple-200/70 transition-colors flex-shrink-0 hidden sm:block">
                    Open &rarr;
                  </span>
                </div>
              </Link>
            </div>
          </ScrollReveal>

          {/* Safety Section - Side by Side on Desktop */}
          <ScrollReveal variant="fadeUp" delay={0.2}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Safety Incidents */}
              <SafetyIncidentsList onLogIncident={() => setShowIncidentModal(true)} />
              
              {/* Safety Leaderboard - Purple Theme */}
              <SafetyPointsLeaderboard 
                theme="purple" 
                compact 
                maxEntries={5} 
                showAnalyticsLink={false}
              />
            </div>
          </ScrollReveal>

          {/* Crew Status Analytics Section */}
          <ScrollReveal variant="fadeUp" delay={0.25}>
            <CrewStatusAnalytics />
          </ScrollReveal>

          {/* Push Notifications Toggle */}
          <ScrollReveal variant="fadeUp" delay={0.4}>
            <div className="flex justify-center">
              <EnableNotificationsButton variant="purple" />
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* Incident Logging Modal - portaled so it sits above layout */}
      {createPortal(
        <IncidentLoggingModal
          isOpen={showIncidentModal}
          onClose={() => setShowIncidentModal(false)}
        />,
        document.body
      )}
    </DashboardLayout>
  );
}
