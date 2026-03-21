import { useMemo, useCallback, Suspense, lazy, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "react-router-dom";
import { Shield, FileText, ClipboardCheck, FileBarChart, ChevronDown } from "lucide-react";
import IncidentLoggingModal from "../../components/admin/IncidentLoggingModal";
import SafetyIncidentsList from "../../components/admin/SafetyIncidentsList";
import { motion, AnimatePresence } from "framer-motion";
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
import { useInspectionReadinessStatus } from "../../hooks/queries/useInspectionReadinessStatus";
import { use300ACertification } from "../../hooks/queries/useOSHA300A";

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
  "text-xs uppercase tracking-widest font-medium text-rose-200/60";

const CURRENT_YEAR = new Date().getFullYear();

const STATUS_DOT: Record<string, string> = {
  compliant: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]",
  warning: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]",
  "non-compliant": "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]",
};

export default function SafetyOfficerDashboard() {
  const { role, setSession, signOut } = useAuth();
  const navigate = useNavigate();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [commonCollapsed, setCommonCollapsed] = useState(true);
  const shouldReduceMotion = caps.prefersReducedMotion || caps.isLowEnd;
  const commonCards = useMemo(() => getCommonNavCards("redwhite"), []);
  const { variants } = useMotionConfig();
  const inspectionStatus = useInspectionReadinessStatus();
  const { data: osha300aCert } = use300ACertification(CURRENT_YEAR - 1);

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
                background: "radial-gradient(circle, #9f1239, transparent 65%)",
                filter: "blur(60px)",
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
          <div className={`${glass.cardRed} p-8 sm:p-10 text-center max-w-sm`}>
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/25 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-8 h-8 text-rose-400" aria-hidden />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-white/60 text-sm mb-6">You don&apos;t have permission to view this page.</p>
            <button
              onClick={() => navigate(getRoleDashboard(role))}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-500/30 text-white text-sm font-semibold transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
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
        {/* Layer 1 — atmospheric: deep rose glow (safety officer role) */}
        <div
          className="absolute inset-0 pointer-events-none select-none overflow-hidden rounded-2xl"
          style={{ zIndex: -1 }}
          aria-hidden
        >
          <div
            className="absolute top-0 right-0 w-[min(100%,24rem)] h-72 rounded-full opacity-[0.07]"
            style={{
              background: "radial-gradient(circle, #fda4af 0%, #be123c 40%, transparent 70%)",
              filter: "blur(60px)",
              transform: "translate(20%, -20%)",
            }}
          />
          <div
            className="absolute bottom-1/4 left-0 w-64 h-64 rounded-full opacity-[0.04]"
            style={{
              background: "radial-gradient(circle, #9f1239, transparent 65%)",
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

          <div className="min-h-[400px] space-y-4">
            {/* Command bar — spotlight quick access */}
            <nav className={`${glass.commandBar} grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden`} aria-label="Quick access">
              <Link
                to="/emergency-action-plan"
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-inset"
              >
                <FileText className="w-4 h-4 text-rose-400/80 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-white block truncate">Emergency Action Plan</span>
                  <span className="text-[11px] text-white/40">Reference doc</span>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT.compliant}`} aria-label="Available" />
              </Link>
              <Link
                to="/inspection-readiness"
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] border-t sm:border-t-0 sm:border-l border-white/[0.06] transition-colors duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-inset"
              >
                <ClipboardCheck className="w-4 h-4 text-rose-400/80 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-white block truncate">Inspection Readiness</span>
                  <span className="text-[11px] text-white/40 font-mono tabular-nums">
                    {inspectionStatus.isLoading ? "..." : `${inspectionStatus.compliant}/${inspectionStatus.compliant + inspectionStatus.warning + inspectionStatus.nonCompliant}`}
                  </span>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[inspectionStatus.aggregate]}`} aria-label={inspectionStatus.aggregate} />
              </Link>
              <Link
                to="/safety-officer/osha-300a"
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] border-t sm:border-t-0 sm:border-l border-white/[0.06] transition-colors duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-inset"
              >
                <FileBarChart className="w-4 h-4 text-rose-400/80 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-white block truncate">OSHA 300A Summary</span>
                  <span className="text-[11px] text-white/40">
                    {osha300aCert ? "Certified" : "Not certified"}
                  </span>
                </div>
                <span className={`w-2 h-2 rounded-full shrink-0 ${osha300aCert ? STATUS_DOT.compliant : STATUS_DOT.warning}`} aria-label={osha300aCert ? "Certified" : "Not certified"} />
              </Link>
            </nav>

            {/* Critical alerts — full width */}
            <section className="grid grid-cols-1 gap-2" aria-label="Critical alerts">
              <RapidReportingTimer />
              <PostingReminder />
            </section>

            {/* Bento metrics — asymmetric grid */}
            <section
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr] gap-2"
              aria-label="Key metrics"
            >
              <DaysSinceIncident />
              <RiskScoreWidget />
              <ComplianceRatesWidget />
              <SafetyFlagsWidget />
              <div className="sm:col-span-2 lg:col-span-2">
                <CertExpirationWarnings />
              </div>
            </section>

            {/* Actionable lists — 2 columns */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-2" aria-label="Actionable lists">
              <OverdueFormAlerts />
              <CorrectiveActionList />
            </section>

            {/* Analytics — 2 columns */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-2" aria-label="Analytics">
              <IncidentTrendChart />
              <div className="space-y-2">
                <NearMissTrend />
                <NearMissCategoryBreakdown />
              </div>
            </section>

            {/* Detailed views */}
            <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2" aria-label="Detailed views">
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

            {/* Navigation — Safety Tools */}
            <div className="space-y-3">
              <p className={SECTION_LABEL_CLASS}>Safety Tools</p>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
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

            {/* Common Features — collapsed by default */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setCommonCollapsed((v) => !v)}
                className="flex items-center gap-2 group focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 rounded-lg px-1 -mx-1"
                aria-expanded={!commonCollapsed}
              >
                <p className={SECTION_LABEL_CLASS}>Common Features</p>
                <span className="text-[10px] font-mono tabular-nums text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded">
                  {commonCards.length}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-white/30 transition-transform duration-200 ${commonCollapsed ? "" : "rotate-180"}`}
                  aria-hidden
                />
              </button>
              <AnimatePresence initial={false}>
                {!commonCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <motion.div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1"
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
                  </motion.div>
                )}
              </AnimatePresence>
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
