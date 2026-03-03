/**
 * Safety & Compliance Hub — single entry for Analytics, Risk Calibration, and Compliance Audit.
 * Sections are lazy-loaded; only the active section is mounted. Risk Calibration tab hidden for safety_officer.
 */

import { Suspense, lazy, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Shield, BarChart3, Activity, FileCheck, ClipboardList } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import AdminSegmentedControl, { type SegmentTab } from "../../components/admin/AdminSegmentedControl";

const SafetyAnalyticsSection = lazy(() =>
  import("./safety-compliance/SafetyAnalyticsSection").then((m) => ({ default: m.default }))
);
const RiskCalibrationSection = lazy(() =>
  import("./safety-compliance/RiskCalibrationSection").then((m) => ({ default: m.default }))
);
const ComplianceAuditSection = lazy(() =>
  import("./safety-compliance/ComplianceAuditSection").then((m) => ({ default: m.default }))
);
const BriefingComplianceSection = lazy(() =>
  import("./safety-compliance/BriefingComplianceSection").then((m) => ({ default: m.default }))
);

const SECTION_ANALYTICS = "analytics";
const SECTION_RISK = "risk-calibration";
const SECTION_AUDIT = "compliance-audit";
const SECTION_BRIEFING = "briefing-compliance";
type SectionId = typeof SECTION_ANALYTICS | typeof SECTION_RISK | typeof SECTION_AUDIT | typeof SECTION_BRIEFING;

const SECTION_FALLBACK = (
  <div className="flex items-center justify-center min-h-[280px] rounded-xl border border-white/10 bg-white/[0.02]">
    <div className="w-8 h-8 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin" aria-hidden />
    <span className="sr-only">Loading section…</span>
  </div>
);

export default function SafetyComplianceHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();

  const section = (searchParams.get("section") as SectionId) || SECTION_ANALYTICS;
  const validSection: SectionId =
    section === SECTION_RISK || section === SECTION_AUDIT || section === SECTION_BRIEFING
      ? section
      : SECTION_ANALYTICS;

  const isAdmin = role === "admin";
  const showRiskCalibration = isAdmin;

  const tabs: SegmentTab[] = useMemo(() => {
    const base = [
      { id: SECTION_ANALYTICS, label: "Analytics", shortLabel: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
      ...(showRiskCalibration
        ? [{ id: SECTION_RISK, label: "Risk Calibration", shortLabel: "Risk", icon: <Activity className="w-4 h-4" /> }]
        : []),
      { id: SECTION_AUDIT, label: "Compliance Audit", shortLabel: "Audit", icon: <FileCheck className="w-4 h-4" /> },
      { id: SECTION_BRIEFING, label: "Briefing Compliance", shortLabel: "Briefing", icon: <ClipboardList className="w-4 h-4" /> },
    ];
    return base as SegmentTab[];
  }, [showRiskCalibration]);

  const setSection = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("section", id);
        if (id !== SECTION_AUDIT) next.delete("auditTab");
        return next;
      },
      { replace: true }
    );
  };

  return (
    <DashboardLayout title="Safety & Compliance">
      <div className="min-h-screen rounded-[25px] bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white px-3 py-4 sm:px-4 sm:py-6 pb-20 sm:pb-24 w-full min-w-0">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400" aria-hidden />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-white">Safety & Compliance</h1>
                <p className="text-xs sm:text-sm text-white/60">
                  Analytics · Risk Calibration · Compliance Audit · Briefing Compliance
                </p>
              </div>
            </div>
          </div>

          <AdminSegmentedControl
            tabs={tabs}
            activeTab={validSection}
            onChange={setSection}
          />

          <Suspense fallback={SECTION_FALLBACK}>
            {validSection === SECTION_ANALYTICS && <SafetyAnalyticsSection />}
            {validSection === SECTION_RISK && <RiskCalibrationSection />}
            {validSection === SECTION_AUDIT && <ComplianceAuditSection />}
            {validSection === SECTION_BRIEFING && <BriefingComplianceSection />}
          </Suspense>
        </div>
      </div>
    </DashboardLayout>
  );
}
