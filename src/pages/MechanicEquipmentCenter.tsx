import { useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { EquipmentInspectionControlCenter } from "../components/mechanic/EquipmentInspectionControlCenter";
import { AlertTriangle, Wrench, ClipboardList } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function MechanicEquipmentCenter() {
  const { role } = useAuth();
  const unauthorized = role && role !== "mechanic" && role !== "admin";
  const [stats, setStats] = useState({
    total: 0,
    needsAttention: 0,
    resolved: 0,
    awaitingFix: 0,
  });

  if (unauthorized) {
    return (
      <DashboardLayout title="Equipment Inspection Center">
        <div className="min-h-screen flex items-center justify-center text-white/70">
          You do not have permission to view this page.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Equipment Inspection Center">
      <div className="w-full min-h-screen bg-gradient-to-br from-[#2c1404] via-[#150602] to-[#2a0d03] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.35em] text-[#ffbf94]/70">
                Ember Fleet Ops
              </p>
              <h1 className="text-3xl font-bold text-white">Equipment Inspection Control</h1>
              <p className="text-white/70 max-w-2xl">
                Access every Daily Equipment Inspection, review checklist outcomes, and record
                mechanic fixes from one workspace.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 inline-flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#ffb48a]" />
              Mechanics & admins can update records in real time.
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Total Inspections",
                value: stats.total,
                icon: ClipboardList,
                tone: "text-white",
                hint: "Submitted to date",
              },
              {
                label: "Needs Attention",
                value: stats.needsAttention,
                icon: AlertTriangle,
                tone: "text-[#ffb199]",
                hint: "Checklist fails",
              },
              {
                label: "Awaiting Fix",
                value: stats.awaitingFix,
                icon: Wrench,
                tone: "text-[#ffd4b8]",
                hint: "Failures without fix log",
              },
              {
                label: "Fixes Logged",
                value: stats.resolved,
                icon: Wrench,
                tone: "text-[#7ef2c8]",
                hint: "Mechanic updates",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 flex flex-col gap-2 shadow-lg shadow-black/30"
              >
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.35em] text-white/45">
                  <card.icon className={`w-4 h-4 ${card.tone}`} />
                  {card.label}
                </div>
                <div className="text-3xl font-semibold text-white">{card.value}</div>
                <p className="text-xs text-white/60">{card.hint}</p>
              </div>
            ))}
          </div>

          <EquipmentInspectionControlCenter onStatsUpdate={setStats} />
        </div>
      </div>
    </DashboardLayout>
  );
}

