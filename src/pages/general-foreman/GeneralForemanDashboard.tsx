import { useMemo, useCallback, Suspense, lazy, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { HardHat } from "lucide-react";
import IncidentLoggingModal from "../../components/admin/IncidentLoggingModal";
import SafetyIncidentsList from "../../components/admin/SafetyIncidentsList";
import SafetyPointsLeaderboard from "../../components/admin/SafetyPointsLeaderboard";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { GENERAL_FOREMAN_NAV_CARDS, getCommonNavCards } from "../../components/admin/adminNavConfig";
import { useAuth } from "../../contexts/AuthContext";
import { getRoleDashboard } from "../../lib/navigation";
import { WelcomeHeader } from "../../components/dashboard";
import BrandedNavCard from "../../components/BrandedNavCard";
import { EnableNotificationsButton } from "../../components/notifications";
import { ScrollReveal } from "../../motion";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { logger } from "../../lib/logger";
import CrewStatusAnalytics from "./CrewStatusAnalytics";

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

          {/* Common Features Section */}
          <ScrollReveal variant="fadeUp" delay={0.05}>
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e9d5ff]/70 font-medium px-1">
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
                      variant="purple"
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </ScrollReveal>

          {/* General Foreman Tools Section */}
          <ScrollReveal variant="fadeUp" delay={0.1}>
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#e9d5ff]/70 font-medium px-1">
                General Foreman Tools
              </p>
              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3"
                variants={shouldReduceMotion ? undefined : containerVariants}
                initial="hidden"
                animate="visible"
              >
                {GENERAL_FOREMAN_NAV_CARDS.map((card) => (
                  <motion.div key={card.to} variants={shouldReduceMotion ? undefined : itemVariants}>
                    <BrandedNavCard
                      title={card.title}
                      description={card.description}
                      icon={card.icon}
                      to={card.to}
                      variant="purple"
                    />
                  </motion.div>
                ))}
              </motion.div>
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
