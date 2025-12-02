import { useEffect, useMemo, useState, useCallback } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { Wrench, AlertTriangle, Flame, Activity } from "lucide-react";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";
import { MECHANIC_NAV_CARDS } from "../components/admin/adminNavConfig";
import {
  fetchDvirMetrics,
  type DvirMetrics,
} from "../lib/dvirMetrics";
import { logger } from "../lib/logger";
import { supabase } from "../lib/supabaseClient";

const UPCOMING_PANELS = [
  {
    title: "Preventive Maintenance",
    body: "Auto-generate PM windows, export checklists, and share schedules with ops.",
    tag: "Launching soon",
  },
  {
    title: "Parts & Repairs Log",
    body: "Track parts consumption, vendor history, and recurring component failures.",
    tag: "In design",
  },
];

const ACTIVE_ALERTS = [
  {
    title: "3 failed DVIRs awaiting triage",
    detail: "Units #112, #214, #309",
    tone: "text-[#ffb48a]",
  },
  {
    title: "2 overdue PM intervals",
    detail: "Bucket Truck 18, Line Truck 07",
    tone: "text-[#ffd0a6]",
  },
];

type EquipmentHighlights = {
  total: number;
  needsAttention: number;
  awaitingFix: number;
  resolved: number;
  recentHazards: Array<{ equipment: string; signer: string; submitted: string }>;
};

type InspectionLite = {
  general_checklist: Record<string, string> | null;
  specific_checklist: Record<string, string> | null;
  mechanic_fixes: string | null;
  equipment_number: string | null;
  submitted_by: string | null;
  created_at: string;
};

const inspectionHasFailures = (inspection: InspectionLite): boolean => {
  const general = inspection.general_checklist || {};
  const specific = inspection.specific_checklist || {};
  return (
    Object.values(general).some((val) => val === "F") ||
    Object.values(specific).some((val) => val === "F")
  );
};

const equipmentDefaults: EquipmentHighlights = {
  total: 0,
  needsAttention: 0,
  awaitingFix: 0,
  resolved: 0,
  recentHazards: [],
};

export default function MechanicDashboard() {
  const { role } = useAuth();
  const unauthorized = role && role !== "mechanic" && role !== "admin";
  const [dvirMetrics, setDvirMetrics] = useState<DvirMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [equipmentStats, setEquipmentStats] = useState<EquipmentHighlights>(equipmentDefaults);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const refreshMs = 60_000;

    const loadMetrics = async (withSpinner: boolean) => {
      if (withSpinner) {
        setMetricsLoading(true);
      }
      try {
        const data = await fetchDvirMetrics();
        if (!isMounted) return;
        setDvirMetrics(data);
        setMetricsError(null);
      } catch (error) {
        logger.error("[MechanicDashboard] Failed to fetch DVIR metrics", error);
        if (!isMounted) return;
        setMetricsError("Unable to sync DVIR metrics right now.");
      } finally {
        if (isMounted) {
          setMetricsLoading(false);
        }
      }
    };

    loadMetrics(true);
    const interval = setInterval(() => loadMetrics(false), refreshMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const EQUIPMENT_FETCH_LIMIT = 200;

  const loadEquipmentHighlights = useCallback(async () => {
    try {
      setEquipmentLoading(true);
      setEquipmentError(null);

      const allInspections = await supabase
        .from("daily_equipment_inspections")
        .select(
          `
          id,
          equipment_number,
          submitted_by,
          created_at,
          general_checklist,
          specific_checklist,
          mechanic_fixes,
          last_mechanic_updated_at
        `
        )
        .order("created_at", { ascending: false })
        .range(0, EQUIPMENT_FETCH_LIMIT - 1);

      if (allInspections.error) {
        throw allInspections.error;
      }

      const inspections = (allInspections.data as InspectionLite[]) || [];
      const needsAttention = inspections.filter(inspectionHasFailures).length;
      const resolved = inspections.filter((inspection) => Boolean(inspection.mechanic_fixes?.trim()))
        .length;
      const awaitingFix = Math.max(needsAttention - resolved, 0);

      const recentHazards = inspections
        .filter(inspectionHasFailures)
        .slice(0, 4)
        .map((inspection) => ({
          equipment: inspection.equipment_number || "Unknown unit",
          signer: inspection.submitted_by || "Unknown operator",
          submitted: new Date(inspection.created_at).toLocaleDateString(),
        }));

      setEquipmentStats({
        total: inspections.length,
        needsAttention,
        awaitingFix,
        resolved,
        recentHazards,
      });
    } catch (error) {
      logger.error("[MechanicDashboard] Failed to load equipment highlights", error);
      setEquipmentError("Unable to sync equipment metrics.");
      setEquipmentStats(equipmentDefaults);
    } finally {
      setEquipmentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEquipmentHighlights();
  }, [loadEquipmentHighlights]);

  const heroStats = useMemo<AdminStat[]>(
    () => [
      {
        label: "Open DVIRs",
        value: String(dvirMetrics?.totalOpen ?? 0),
        hint: "Awaiting mechanic review",
      },
      {
        label: "Today's DVIRs",
        value: String(dvirMetrics?.todaysReports ?? 0),
        hint: "Submitted since midnight",
      },
      {
        label: "Equipment Alerts",
        value: String(equipmentStats.needsAttention ?? 0),
        hint: "Inspections with failed items",
      },
    ],
    [dvirMetrics, equipmentStats.needsAttention]
  );

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Ember Ops Network",
      eyebrowIcon: <Wrench className="w-4 h-4 text-[#ffb48a]" />,
      heading: "Mechanic Control Center",
      description:
        "Stay ahead of failed inspections, coordinate PM windows, and keep the fleet road-ready.",
      badges: [
        {
          label: "Shift live",
          icon: <Flame className="w-4 h-4 text-[#ff9350]" />,
          variant: "solid",
        },
        {
          label: "Realtime feed",
          icon: <Activity className="w-4 h-4 text-[#ff9350]" />,
          variant: "outline",
        },
      ],
    }),
    []
  );

  const sidePanelContent = (
    <>
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-[#ffbf94]/70">
          Alerts & Watchlist
        </p>
        <div className="mt-4 space-y-4">
          {ACTIVE_ALERTS.map((alert) => (
            <div
              key={alert.title}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-md"
            >
              <p className={`text-sm font-semibold ${alert.tone}`}>
                {alert.title}
              </p>
              <p className="text-xs text-white/60 mt-1">{alert.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/15 bg-black/20 px-4 py-4">
        <p className="text-xs uppercase tracking-[0.3em] text-[#ffd4b8]/70">
          Quick Links
        </p>
        <ul className="mt-3 space-y-2 text-sm text-white/80">
          <li className="flex items-center justify-between">
            <span>Latest failed DVIR</span>
            <span className="text-[#ffb48a] font-semibold">Unit #214</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Shop capacity</span>
            <span className="text-[#ffd0a6] font-semibold">4 / 8 bays</span>
          </li>
          <li className="flex items-center justify-between">
            <span>Next PM window</span>
            <span className="text-[#ffb48a] font-semibold">Thu · 07:00</span>
          </li>
        </ul>
      </div>
    </>
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
        stats={heroStats}
        navCards={MECHANIC_NAV_CARDS}
        sidePanel={sidePanelContent}
        theme="ember"
      >
        <div className="grid gap-6 md:grid-cols-2">
          {UPCOMING_PANELS.map((panel) => (
            <div
              key={panel.title}
              className="rounded-3xl border border-[#f28b53]/30 bg-[#1a0905]/80 p-6 shadow-lg shadow-black/40 space-y-3 text-white/80"
            >
              <div className="text-xs uppercase tracking-[0.35em] text-[#ffb48a]/70">
                {panel.tag}
              </div>
              <h3 className="text-xl font-semibold text-white">
                {panel.title}
              </h3>
              <p className="text-sm text-white/70">{panel.body}</p>
              <div className="inline-flex items-center gap-1 text-xs text-[#ff9350]">
                <span>Preview</span>
                <span>↗</span>
              </div>
            </div>
          ))}
        </div>


        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[#f28b53]/25 bg-[#120705]/90 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-[#ffbf94]/70">
                  DVIR Highlights
                </p>
                <p className="text-lg font-semibold text-white mt-2">
                  Live inspection health
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-[#ff9c63]" />
            </div>

            <div className="text-xs text-white/60">
              {metricsLoading ? (
                <span className="animate-pulse text-white/70">Syncing live DVIR metrics…</span>
              ) : metricsError ? (
                <span className="text-red-200">{metricsError}</span>
              ) : dvirMetrics ? (
                <div className="grid gap-3 sm:grid-cols-2 text-left">
                  {[
                    {
                      label: "Awaiting Review",
                      value: dvirMetrics.totalOpen,
                      helper: "Need mechanic sign-off",
                    },
                    {
                      label: "Completed (7d)",
                      value: dvirMetrics.totalCompletedLast7Days,
                      helper: "Signed by shop",
                    },
                    {
                      label: "Today's Reports",
                      value: dvirMetrics.todaysReports,
                      helper: "Submitted since midnight",
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/60">
                        {metric.label}
                      </p>
                      <p className="text-2xl font-bold text-[#ffe4c9]">
                        {metric.value.toLocaleString()}
                      </p>
                      <p className="text-xs text-white/50 mt-1">{metric.helper}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <span>DVIR metrics unavailable.</span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[#f28b53]/25 bg-[#120705]/90 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-[#ffbf94]/70">
                  Equipment Highlights
                </p>
                <p className="text-lg font-semibold text-white mt-2">
                  Daily inspection spotlight
                </p>
              </div>
              <Wrench className="w-8 h-8 text-[#ffb48a]" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-sm text-white/80">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Needs attention</p>
                <p className="text-2xl font-bold text-[#ffe4c9]">
                  {equipmentStats.needsAttention}
                </p>
                <p className="text-xs text-white/50 mt-1">Failed checklists</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Awaiting fix</p>
                <p className="text-2xl font-bold text-[#ffe4c9]">{equipmentStats.awaitingFix}</p>
                <p className="text-xs text-white/50 mt-1">Need mechanic log</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Fixes logged</p>
                <p className="text-2xl font-bold text-[#ffe4c9]">{equipmentStats.resolved}</p>
                <p className="text-xs text-white/50 mt-1">Mechanic updates</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Total inspections</p>
                <p className="text-2xl font-bold text-[#ffe4c9]">{equipmentStats.total}</p>
                <p className="text-xs text-white/50 mt-1">Historical submissions</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Recent hazards</p>
              {equipmentLoading ? (
                <p className="text-xs text-white/60 animate-pulse">Loading equipment feed…</p>
              ) : equipmentError ? (
                <p className="text-xs text-red-200">{equipmentError}</p>
              ) : equipmentStats.recentHazards.length === 0 ? (
                <p className="text-xs text-white/60">No failed inspections in the latest batch.</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {equipmentStats.recentHazards.map((hazard, index) => (
                    <div
                      key={`${hazard.equipment}-${hazard.submitted}-${index}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2"
                    >
                      <div>
                        <p className="text-white font-semibold">{hazard.equipment}</p>
                        <p className="text-xs text-white/60">{hazard.signer}</p>
                      </div>
                      <span className="text-xs text-white/60">{hazard.submitted}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}
