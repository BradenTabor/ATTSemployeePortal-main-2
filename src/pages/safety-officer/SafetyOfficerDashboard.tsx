import { useMemo, useCallback, Suspense, lazy, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "react-router-dom";
import { Shield, FileText, ClipboardCheck, FileBarChart } from "lucide-react";
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
import { glass } from "../../lib/glass";
import { useMotionConfig } from "../../motion/hooks";
import { DashboardCardThemeProvider } from "../../contexts/DashboardCardThemeContext";

import DaysSinceIncident from "../../components/dashboard/DaysSinceIncident";
import ComplianceRatesWidget from "../../components/dashboard/ComplianceRatesWidget";
import RiskScoreWidget from "../../components/dashboard/RiskScoreWidget";
import CertExpirationWarnings from "../../components/dashboard/CertExpirationWarnings";
import OverdueFormAlerts from "../../components/dashboard/OverdueFormAlerts";
import IncidentTrendChart from "../../components/dashboard/IncidentTrendChart";
import BodyPartHeatMap from "../../components/dashboard/BodyPartHeatMap";
import CrewSiteOverview from "../../components/dashboard/CrewSiteOverview";
import SafetyFlagsWidget from "../../components/dashboard/SafetyFlagsWidget";

import PostingReminder from "../../components/safety/PostingReminder";
import RapidReportingTimer from "../../components/safety/RapidReportingTimer";
import CorrectiveActionList from "../../components/safety/CorrectiveActionList";
import NearMissTrend from "../../components/safety/NearMissTrend";
import NearMissCategoryBreakdown from "../../components/safety/NearMissCategoryBreakdown";

const ThemedAnnouncementCard = lazy(() => import("../../components/ThemedAnnouncementCard"));

/** Section label — uppercase, tracked, role-tinted */
const SECTION_LABEL_CLASS =
  "text-xs uppercase tracking-widest font-medium text-red-200/60";

export default function SafetyOfficerDashboard() {
  const { role, setSession, signOut } = useAuth();
  const navigate = useNavigate();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;
  const commonCards = useMemo(() => getCommonNavCards("redwhite"), []);
  const { variants } = useMotionConfig();

  const handleSignOut = useCallback(async () => {
    try {
      setSession(null);
      await signOut();
      navigate("/", { replace: true });
    } catch (error) {
      logger.error("[SafetyOfficerDashboard] Sign out failed:", error);
    }
  }, [navigate, setSession, signOut]);

  if (role !== "safety_officer" && role !== "admin") {
    return (
      <DashboardLayout title="Access Denied">
        <div className="relative flex items-center justify-center min-h-[60vh] px-4">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: -1 }}
            aria-hidden
          >
            <div
              className="absolute top-1/2 left-1/2 w-96 h-96 rounded-full opacity-[0.06]"
              style={{
                background: "radial-gradient(circle, #dc2626, transparent 65%)",
                filter: "blur(60px)",
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
          <div className={`${glass.cardRed} p-8 sm:p-10 text-center max-w-sm`}>
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-8 h-8 text-red-400" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-white/60 text-sm mb-6">You don&apos;t have permission to view this page.</p>
            <button
              onClick={() => navigate(getRoleDashboard(role))}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 border border-red-500/30 text-white text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
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
      <div className="relative w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 pb-6 pt-2 sm:pt-4 md:pt-6">
        {/* Layer 1 — atmospheric: static red/white glow (safety officer role) */}
        <div
          className="absolute inset-0 pointer-events-none select-none overflow-hidden rounded-2xl"
          style={{ zIndex: -1 }}
          aria-hidden
        >
          <div
            className="absolute top-0 right-0 w-[min(100%,24rem)] h-72 rounded-full opacity-[0.07]"
            style={{
              background: "radial-gradient(circle, #fecaca 0%, #dc2626 40%, transparent 70%)",
              filter: "blur(60px)",
              transform: "translate(20%, -20%)",
            }}
          />
          <div
            className="absolute bottom-1/4 left-0 w-64 h-64 rounded-full opacity-[0.04]"
            style={{
              background: "radial-gradient(circle, #dc2626, transparent 65%)",
              filter: "blur(50px)",
              transform: "translate(-30%, 0)",
            }}
          />
        </div>

        <div className="relative z-10">
          <DashboardCardThemeProvider cardClass={glass.cardRed} subtleClass={glass.subtleRed}>
          <div className="mb-5 md:mb-6">
            <WelcomeHeader
              theme="redwhite"
              onSignOut={handleSignOut}
              subtitle="Monitor safety compliance, track incidents, and protocols"
              roleBadgeText={role === "admin" ? "Admin Access" : "Safety Officer"}
            />
          </div>

          <div className="min-h-[400px] space-y-6">
            {/* Critical alerts — full width */}
            <section className="grid grid-cols-1 gap-3" aria-label="Critical alerts">
              <RapidReportingTimer />
              <PostingReminder />
            </section>

            {/* Key metrics — 1 col mobile, 2 tablet, 3–4 desktop */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" aria-label="Key metrics">
              <DaysSinceIncident />
              <ComplianceRatesWidget />
              <RiskScoreWidget />
              <div className="flex flex-col gap-3">
                <CertExpirationWarnings />
                <SafetyFlagsWidget />
              </div>
            </section>

            {/* Actionable lists — 2 columns */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3" aria-label="Actionable lists">
              <OverdueFormAlerts />
              <CorrectiveActionList />
            </section>

            {/* Analytics — 2 columns */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3" aria-label="Analytics">
              <IncidentTrendChart />
              <div className="space-y-3">
                <NearMissTrend />
                <NearMissCategoryBreakdown />
              </div>
            </section>

            {/* Detailed views */}
            <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3" aria-label="Detailed views">
              <CrewSiteOverview />
              <BodyPartHeatMap />
              <div className="lg:col-span-2 xl:col-span-1">
                <SafetyIncidentsList onLogIncident={() => setShowIncidentModal(true)} />
              </div>
            </section>

            {/* Announcements */}
            <Suspense
              fallback={
                <div className={`${glass.cardRed} p-4 space-y-2 animate-pulse`}>
                  <div className="h-3 w-24 bg-white/10 rounded-full" aria-hidden />
                  <div className="h-3 w-full bg-white/10 rounded-full" aria-hidden />
                </div>
              }
            >
              <ThemedAnnouncementCard theme="redwhite" />
            </Suspense>

            {/* Quick access — EAP, Inspection Readiness, OSHA 300A */}
            <div className="space-y-3">
              <p className={SECTION_LABEL_CLASS}>Quick access</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/emergency-action-plan"
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/90
                    ${glass.subtleRed} hover:border-red-400/40 hover:text-red-100
                    transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50`}
                >
                  <FileText className="w-4 h-4 text-red-400/80 shrink-0" aria-hidden />
                  Emergency Action Plan
                </Link>
                <Link
                  to="/inspection-readiness"
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/90
                    ${glass.subtleRed} hover:border-red-400/40 hover:text-red-100
                    transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50`}
                >
                  <ClipboardCheck className="w-4 h-4 text-red-400/80 shrink-0" aria-hidden />
                  Inspection Readiness
                </Link>
                <Link
                  to="/safety-officer/osha-300a"
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/90
                    ${glass.subtleRed} hover:border-red-400/40 hover:text-red-100
                    transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50`}
                >
                  <FileBarChart className="w-4 h-4 text-red-400/80 shrink-0" aria-hidden />
                  OSHA 300A Summary
                </Link>
              </div>
            </div>

            {/* Navigation — Safety Tools */}
            <div className="space-y-3">
              <p className={SECTION_LABEL_CLASS}>Safety Tools</p>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                variants={shouldReduceMotion ? undefined : variants.staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {SAFETY_OFFICER_NAV_CARDS.map((card) => (
                  <motion.div key={card.to} variants={shouldReduceMotion ? undefined : variants.staggerItem}>
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

            {/* Common Features */}
            <div className="space-y-3">
              <p className={SECTION_LABEL_CLASS}>Common Features</p>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                variants={shouldReduceMotion ? undefined : variants.staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {commonCards.map((card) => (
                  <motion.div key={card.to} variants={shouldReduceMotion ? undefined : variants.staggerItem}>
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

            <div className="flex justify-center pt-4">
              <EnableNotificationsButton variant="redwhite" />
            </div>
          </div>
          </DashboardCardThemeProvider>
        </div>
      </div>

      {createPortal(
        <IncidentLoggingModal isOpen={showIncidentModal} onClose={() => setShowIncidentModal(false)} />,
        document.body
      )}
    </DashboardLayout>
  );
}
