/**
 * Requests & Oversight Hub — RTO Requests, Daily JSA Oversight, and Parts & Fixes in one place.
 * Role-aware: admins see all three tabs; safety_officer sees only JSA. Sections are lazy-loaded.
 */

import { Suspense, lazy, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, ClipboardList, Package } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import AdminSegmentedControl, { type SegmentTab } from "../../components/admin/AdminSegmentedControl";

const RTOSection = lazy(() =>
  import("./requests-oversight/RTOSection").then((m) => ({ default: m.default }))
);
const JSASection = lazy(() =>
  import("./requests-oversight/JSASection").then((m) => ({ default: m.default }))
);
const PartsFixesSection = lazy(() =>
  import("./requests-oversight/PartsFixesSection").then((m) => ({ default: m.default }))
);

const SECTION_RTO = "rto";
const SECTION_JSA = "jsa";
const SECTION_PARTS = "parts-fixes";
type SectionId = typeof SECTION_RTO | typeof SECTION_JSA | typeof SECTION_PARTS;

const SECTION_FALLBACK = (
  <div className="flex items-center justify-center min-h-[280px] rounded-xl border border-white/10 bg-white/[0.02]">
    <div className="w-8 h-8 border-2 border-amber-400/50 border-t-amber-400 rounded-full animate-spin" aria-hidden />
    <span className="sr-only">Loading section…</span>
  </div>
);

export default function RequestsOversightHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();

  const isAdmin = role === "admin";
  const rawSection = searchParams.get("section") as SectionId | null;

  // Role-aware default: admin → rto, safety_officer → jsa
  const defaultSection: SectionId = isAdmin ? SECTION_RTO : SECTION_JSA;
  const sectionFromUrl: SectionId | null =
    rawSection === SECTION_RTO || rawSection === SECTION_JSA || rawSection === SECTION_PARTS
      ? rawSection
      : null;

  // Safety officer cannot access RTO or Parts & Fixes; redirect to JSA and merge params
  useEffect(() => {
    if (!isAdmin && (sectionFromUrl === SECTION_RTO || sectionFromUrl === SECTION_PARTS)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("section", SECTION_JSA);
          return next;
        },
        { replace: true }
      );
    }
  }, [isAdmin, sectionFromUrl, setSearchParams]);

  // Effective section for rendering: after redirect, safety_officer only ever sees jsa
  const validSection: SectionId = useMemo(() => {
    if (isAdmin) {
      return sectionFromUrl ?? defaultSection;
    }
    if (sectionFromUrl === SECTION_RTO || sectionFromUrl === SECTION_PARTS) {
      return SECTION_JSA; // will redirect; show JSA until next render
    }
    return sectionFromUrl ?? defaultSection;
  }, [isAdmin, sectionFromUrl, defaultSection]);

  // Tabs: admin sees all three; safety_officer sees only JSA
  const tabs: SegmentTab[] = useMemo(() => {
    const allTabs: SegmentTab[] = [
      { id: SECTION_RTO, label: "RTO Requests", shortLabel: "RTO", icon: <Calendar className="w-4 h-4" /> },
      { id: SECTION_JSA, label: "Daily JSA", shortLabel: "JSA", icon: <ClipboardList className="w-4 h-4" /> },
      { id: SECTION_PARTS, label: "Parts & Fixes", shortLabel: "Parts", icon: <Package className="w-4 h-4" /> },
    ];
    if (isAdmin) return allTabs;
    return allTabs.filter((t) => t.id === SECTION_JSA);
  }, [isAdmin]);

  const setSection = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("section", id);
        return next;
      },
      { replace: true }
    );
  };

  return (
    <DashboardLayout title="Requests & Oversight" pageHeading>
      <div className="min-h-screen rounded-[25px] bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-white px-3 py-4 sm:px-4 sm:py-6 pb-20 sm:pb-24 w-full min-w-0">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400" aria-hidden />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-white">Requests & Oversight</h1>
                <p className="text-xs sm:text-sm text-white/60">
                  RTO · JSA oversight · Parts & Fixes
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
            {validSection === SECTION_RTO && <RTOSection />}
            {validSection === SECTION_JSA && <JSASection />}
            {validSection === SECTION_PARTS && <PartsFixesSection />}
          </Suspense>
        </div>
      </div>
    </DashboardLayout>
  );
}
