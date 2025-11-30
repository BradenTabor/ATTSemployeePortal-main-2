import { useMemo } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { Wrench, AlertTriangle, Flame, Activity } from "lucide-react";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";
import { MECHANIC_NAV_CARDS } from "../components/admin/adminNavConfig";

const PLACEHOLDER_STATS = {
  dvirQueue: "08",
  failedToday: "03",
  openRepairs: "12",
};

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

export default function MechanicDashboard() {
  const { role } = useAuth();

  if (role && role !== "mechanic" && role !== "admin") {
    return (
      <DashboardLayout title="Mechanic Panel">
        <div className="max-w-xl mx-auto mt-10 text-center text-sm text-gray-300">
          You do not have permission to view the mechanic panel.
        </div>
      </DashboardLayout>
    );
  }

  const heroStats = useMemo<AdminStat[]>(
    () => [
      {
        label: "DVIR Queue",
        value: PLACEHOLDER_STATS.dvirQueue,
        hint: "Awaiting review",
      },
      {
        label: "Failed Today",
        value: PLACEHOLDER_STATS.failedToday,
        hint: "Needs triage",
      },
      {
        label: "Open Repairs",
        value: PLACEHOLDER_STATS.openRepairs,
        hint: "Tracked in shop",
      },
    ],
    []
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

        <div className="rounded-3xl border border-[#f28b53]/25 bg-[#120705]/90 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#ffbf94]/70">
                DVIR Highlights
              </p>
              <p className="text-lg font-semibold text-white mt-2">
                Failed reasons this shift
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-[#ff9c63]" />
          </div>

          <div className="grid gap-4 md:grid-cols-3 text-sm">
            {[
              { label: "Brakes", count: "05" },
              { label: "Lighting", count: "03" },
              { label: "Hydraulics", count: "02" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                  {item.label}
                </p>
                <p className="text-2xl font-bold text-[#ffe4c9]">
                  {item.count}
                </p>
                <p className="text-xs text-white/50 mt-1">flags in queue</p>
              </div>
            ))}
          </div>

          <div className="text-xs text-white/60">
            Real metrics will pipe in directly from the DVIR Center once the API
            endpoints are finalized.
          </div>
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}
