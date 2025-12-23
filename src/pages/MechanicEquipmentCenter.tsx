import { useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { EquipmentInspectionControlCenter } from "../components/mechanic/EquipmentInspectionControlCenter";
import { AlertTriangle, Wrench, ClipboardCheck, Shield, Flame } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
} from "../components/admin/AdminPremiumScaffold";

export default function MechanicEquipmentCenter() {
  const { role, session } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const unauthorized = role && role !== "mechanic" && role !== "admin";
  const [stats, setStats] = useState({
    total: 0,
    needsAttention: 0,
    resolved: 0,
    awaitingFix: 0,
  });

  // Compact hero config
  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Fleet Ops",
      eyebrowIcon: <Flame className="w-3.5 h-3.5 text-amber-400" />,
      heading: "Equipment Center",
      description: "Review inspections and log fixes",
      badges: [
        {
          label: role === "admin" ? "ADMIN" : "MECH",
          icon: <Wrench className="w-3.5 h-3.5 text-amber-400" />,
          variant: "solid",
        },
      ],
    }),
    [role]
  );

  // Compact side panel with stats grid
  const sidePanel = (
    <div className="space-y-4">
      {/* Stats grid - compact */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Awaiting",
            value: stats.awaitingFix,
            icon: AlertTriangle,
            gradient: "from-red-500/20 to-red-600/10",
            border: "border-red-500/30",
            iconColor: "text-red-400",
            valueColor: "text-red-300",
          },
          {
            label: "Attention",
            value: stats.needsAttention,
            icon: ClipboardCheck,
            gradient: "from-amber-500/20 to-amber-600/10",
            border: "border-amber-500/30",
            iconColor: "text-amber-400",
            valueColor: "text-amber-300",
          },
          {
            label: "Fixed",
            value: stats.resolved,
            icon: Wrench,
            gradient: "from-emerald-500/20 to-emerald-600/10",
            border: "border-emerald-500/30",
            iconColor: "text-emerald-400",
            valueColor: "text-emerald-300",
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 + 0.2 }}
            className={`rounded-xl border ${stat.border} bg-gradient-to-br ${stat.gradient} p-2.5 text-center`}
          >
            <stat.icon className={`w-4 h-4 ${stat.iconColor} mx-auto mb-1`} />
            <div className={`text-xl font-bold ${stat.valueColor}`}>{stat.value}</div>
            <div className="text-[9px] uppercase tracking-wider text-white/50">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick tip - more subtle */}
      <div className="rounded-xl border border-white/5 bg-black/20 p-3">
        <p className="text-[11px] text-white/50 leading-relaxed">
          <span className="text-amber-400 font-medium">Tip:</span> Focus on "Needs Attention" items first.
        </p>
      </div>

      {/* User info - minimal */}
      <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/5">
        <span>{session?.user?.email?.split("@")[0] || "User"}</span>
        <span className="uppercase font-medium text-amber-400/70">{role}</span>
      </div>
    </div>
  );

  if (unauthorized) {
    return (
      <DashboardLayout title="Equipment Inspection Center">
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Equipment Inspection Center">
      <div className="w-full min-h-screen bg-gradient-to-br from-[#1a0804] via-[#0f0402] to-[#0a0201]">
        <AdminPremiumScaffold
          hero={heroConfig}
          sidePanel={sidePanel}
          theme="ember"
        >
          <motion.div
            className="space-y-4"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <EquipmentInspectionControlCenter onStatsUpdate={setStats} />
          </motion.div>
        </AdminPremiumScaffold>
      </div>
    </DashboardLayout>
  );
}
