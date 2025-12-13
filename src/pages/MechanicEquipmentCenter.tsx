import { useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { EquipmentInspectionControlCenter } from "../components/mechanic/EquipmentInspectionControlCenter";
import { AlertTriangle, Wrench, ClipboardList, ClipboardCheck, Shield, Flame } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";

// Animation variants - optimized for performance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// Reduced motion variants
const containerVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

const itemVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

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

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Ember Fleet Ops",
      eyebrowIcon: <Flame className="w-4 h-4 text-[#ff9350]" />,
      heading: `Equipment Inspection Control`,
      description:
        "Access every Daily Equipment Inspection, review checklist outcomes, and record mechanic fixes from one workspace.",
      badges: [
        {
          label: role === "admin" ? "ADMIN" : "MECHANIC",
          icon: <Wrench className="w-4 h-4 text-[#ff9350]" />,
          variant: "solid",
        },
        {
          label: "Real-time Updates",
          icon: <ClipboardCheck className="w-4 h-4 text-[#ffb48a]" />,
          variant: "outline",
        },
      ],
    }),
    [role]
  );

  const heroStats = useMemo<AdminStat[]>(
    () => [
      {
        label: "Total Inspections",
        value: stats.total.toString().padStart(2, "0"),
        hint: "Submitted to date",
      },
      {
        label: "Needs Attention",
        value: stats.needsAttention.toString().padStart(2, "0"),
        hint: "Checklist failures",
      },
      {
        label: "Fixes Logged",
        value: stats.resolved.toString().padStart(2, "0"),
        hint: "Mechanic updates",
      },
    ],
    [stats]
  );

  // Side panel content with quick stats
  const sidePanel = (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ff9350]/10 border border-[#ff9350]/30 rounded-full text-[0.65rem] font-semibold tracking-[0.3em] uppercase text-[#ffd4b8] mb-4">
          <ClipboardList className="w-4 h-4 text-[#ff9350]" />
          Quick Overview
        </div>
        <h3 className="text-xl font-semibold text-white">Inspection Status</h3>
        <p className="text-sm text-[#ffd4b8]/80 mt-1">
          Monitor fleet equipment health at a glance.
        </p>
      </div>

      <div className="space-y-3">
        {[
          {
            label: "Awaiting Fix",
            value: stats.awaitingFix,
            icon: AlertTriangle,
            color: "text-[#ffb199]",
            bgColor: "bg-[#ff6b4a]/15",
            borderColor: "border-[#ff6b4a]/30",
          },
          {
            label: "Needs Attention",
            value: stats.needsAttention,
            icon: ClipboardList,
            color: "text-[#ffd4b8]",
            bgColor: "bg-[#ff9350]/15",
            borderColor: "border-[#ff9350]/30",
          },
          {
            label: "Fixes Logged",
            value: stats.resolved,
            icon: Wrench,
            color: "text-[#7ef2c8]",
            bgColor: "bg-[#10b981]/15",
            borderColor: "border-[#10b981]/30",
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 + 0.3 }}
            className={`rounded-2xl border ${stat.borderColor} ${stat.bgColor} p-4 flex items-center justify-between`}
          >
            <div className="flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-sm text-white/90">{stat.label}</span>
            </div>
            <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-[#ffd4b8]/70 leading-relaxed">
          <strong className="text-[#ff9350]">Tip:</strong> Use the filters to focus on equipment that needs immediate attention. Log fixes promptly to keep records accurate.
        </p>
      </div>

      <div className="pt-2 border-t border-white/10">
        <p className="text-xs text-[#ffd4b8]/60">
          Logged in as <span className="text-[#ff9350] font-medium">{session?.user?.email?.split("@")[0] || "User"}</span>
        </p>
        <p className="text-xs text-[#ffd4b8]/60 mt-1">
          Role: <span className="text-white/80 font-medium uppercase">{role}</span>
        </p>
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
          stats={heroStats}
          sidePanel={sidePanel}
          theme="ember"
        >
          <motion.div
            className="space-y-6"
            variants={prefersReducedMotion ? containerVariantsReduced : containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={prefersReducedMotion ? itemVariantsReduced : itemVariants}>
              <EquipmentInspectionControlCenter onStatsUpdate={setStats} />
            </motion.div>
          </motion.div>
        </AdminPremiumScaffold>
      </div>
    </DashboardLayout>
  );
}
