import { useMemo, useCallback, Suspense, lazy, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import IncidentLoggingModal from "../../components/admin/IncidentLoggingModal";
import SafetyIncidentsList from "../../components/admin/SafetyIncidentsList";
import { motion } from "framer-motion";
import DashboardLayout from "../../layouts/DashboardLayout";
import { SAFETY_OFFICER_NAV_CARDS, getCommonNavCards } from "../../components/admin/adminNavConfig";
import { useAuth } from "../../contexts/AuthContext";
import { getRoleDashboard } from "../../lib/navigation";
import { WelcomeHeader } from "../../components/dashboard";
import BrandedNavCard from "../../components/BrandedNavCard";
import { EnableNotificationsButton } from "../../components/notifications";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { logger } from "../../lib/logger";

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

export default function SafetyOfficerDashboard() {
  const { role, setSession, signOut } = useAuth();
  const navigate = useNavigate();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;

  // Get common nav cards with redwhite theme
  const commonCards = useMemo(() => getCommonNavCards("redwhite"), []);

  // Sign out handler - must be called before any conditional returns
  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      logger.error("[SafetyOfficerDashboard] Sign out failed:", error);
    }
  }, [navigate, setSession, signOut]);

  // Access control - redirect if not authorized (AFTER all hooks)
  if (role !== "safety_officer" && role !== "admin") {
    return (
      <DashboardLayout title="Access Denied">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-[#fecaca]/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-[#fecaca]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400 mb-6">You don't have permission to view this page.</p>
            <button
              onClick={() => navigate(getRoleDashboard(role))}
              className="px-6 py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl font-semibold transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Safety Officer Dashboard">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 pb-4 pt-2 sm:pt-4 md:pt-6">
        {/* Compact Welcome Header - Red Theme */}
        <div className="mb-4 md:mb-5">
          <WelcomeHeader
            theme="redwhite"
            onSignOut={handleSignOut}
            subtitle="Monitor safety compliance, track incidents, and protocols"
            roleBadgeText={role === "admin" ? "Admin Access" : "Safety Officer"}
          />
        </div>

        {/* Main content area - compact spacing */}
        <div className="min-h-[400px]">
          <div className="space-y-4">
            {/* Announcements Section */}
            <Suspense fallback={
              <div className="rounded-xl border border-red-500/20 bg-[#280a0a]/70 p-4 space-y-2 animate-pulse">
                <div className="h-3 w-24 bg-white/10 rounded-full" />
                <div className="h-3 w-full bg-white/10 rounded-full" />
              </div>
            }>
              <ThemedAnnouncementCard theme="redwhite" />
            </Suspense>

            {/* Safety Incidents - Full Component */}
            <SafetyIncidentsList onLogIncident={() => setShowIncidentModal(true)} />

            {/* Quick Tools Grid - Readable on Mobile */}
            <div className="space-y-2.5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#fef2f2]/60 font-medium px-1">
                Safety Tools
              </p>
              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
                variants={shouldReduceMotion ? undefined : containerVariants}
                initial="hidden"
                animate="visible"
              >
                {SAFETY_OFFICER_NAV_CARDS.map((card) => (
                  <motion.div key={card.to} variants={shouldReduceMotion ? undefined : itemVariants}>
                    <BrandedNavCard
                      title={card.title}
                      description={card.description}
                      icon={card.icon}
                      to={card.to}
                      variant="redwhite"
                      comingSoon={card.comingSoon}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Common Features - Readable on Mobile */}
            <div className="space-y-2.5">
              <p className="text-[10px] uppercase tracking-[0.15em] text-[#fef2f2]/60 font-medium px-1">
                Common Features
              </p>
              <motion.div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
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
                      variant="redwhite"
                      iconAsImage={card.iconAsImage}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>

            {/* Push Notifications - Compact */}
            <div className="flex justify-center pt-2">
              <EnableNotificationsButton variant="redwhite" />
            </div>
          </div>
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
