/**
 * OSHA Inspection Readiness — Checklist from live data; Generate Report PDF.
 */

import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X, AlertTriangle, Loader2, FileDown, ClipboardCheck } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { supabase } from "../../lib/supabaseClient";
import { glass } from "../../lib/glass";
import type { jsPDF as JsPDFType } from "jspdf";
import { toZonedTime } from "date-fns-tz";

const TZ = "America/Chicago";

type Status = "compliant" | "warning" | "non-compliant";

interface ChecklistItem {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

function getTodayStr(): string {
  return toZonedTime(new Date(), TZ).toISOString().slice(0, 10);
}

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export default function InspectionReadiness() {
  const [generating, setGenerating] = useState(false);
  const today = getTodayStr();
  const currentYear = new Date().getFullYear();
  const shouldReduceMotion = useReducedMotion();

  const recordablesQuery = useQuery({
    queryKey: ["safety_incidents_recordable_unlogged"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_incidents")
        .select("id, incident_date, case_number")
        .in("severity", ["recordable", "lost_time", "fatality"])
        .is("case_number", null);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 1000 * 60,
  });

  const expiredCertsQuery = useQuery({
    queryKey: ["certification_records_expired"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("certification_records")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .lt("expires_at", new Date().toISOString());
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    staleTime: 1000 * 60,
  });

  const retentionQuery = useQuery({
    queryKey: ["data_retention_policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_retention_policies")
        .select("table_name, retention_days, enabled")
        .eq("table_name", "dvir_reports");
      if (error) throw new Error(error.message);
      return (data ?? []) as { table_name: string; retention_days: number; enabled: boolean }[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const equipmentQuery = useQuery({
    queryKey: ["daily_equipment_inspections_latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_equipment_inspections")
        .select("inspection_date")
        .order("inspection_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as { inspection_date: string } | null;
    },
    staleTime: 1000 * 60,
  });

  const items: ChecklistItem[] = useMemo(() => [
    {
      id: "300",
      label: "OSHA 300 Log current (no unlogged recordables)",
      status:
        recordablesQuery.data && recordablesQuery.data.length > 0 ? "non-compliant" : "compliant",
      detail:
        recordablesQuery.data && recordablesQuery.data.length > 0
          ? `${recordablesQuery.data.length} recordable(s) missing case number`
          : "All recordables have case numbers",
    },
    {
      id: "300a",
      label: "300A posted (current year)",
      status: "warning",
      detail: "Verify 300A is posted Feb 1–Apr 30 (manual check)",
    },
    {
      id: "training",
      label: "Training records current (no expired certs)",
      status: (expiredCertsQuery.data ?? 0) > 0 ? "non-compliant" : "compliant",
      detail:
        (expiredCertsQuery.data ?? 0) > 0
          ? `${expiredCertsQuery.data} active cert(s) past expiration`
          : "No expired active certifications",
    },
    {
      id: "dvir",
      label: "DVIRs retained for 3+ months",
      status:
        retentionQuery.data?.[0] && retentionQuery.data[0].retention_days >= 90
          ? "compliant"
          : "warning",
      detail: retentionQuery.data?.[0]
        ? `dvir_reports: ${retentionQuery.data[0].retention_days} days retention`
        : "No retention policy found for dvir_reports",
    },
    {
      id: "electrical",
      label: "Electrical qualifications documented",
      status: "warning",
      detail: "Verify app_users qualifications per site (manual check)",
    },
    {
      id: "equipment",
      label: "Equipment inspections current",
      status:
        equipmentQuery.data?.inspection_date === today
          ? "compliant"
          : equipmentQuery.data
            ? "warning"
            : "non-compliant",
      detail: equipmentQuery.data
        ? `Latest inspection: ${equipmentQuery.data.inspection_date}`
        : "No equipment inspections on record",
    },
  ], [recordablesQuery.data, expiredCertsQuery.data, retentionQuery.data, equipmentQuery.data, today]);

  const summary = useMemo(() => {
    const compliant = items.filter((i) => i.status === "compliant").length;
    const warning = items.filter((i) => i.status === "warning").length;
    const nonCompliant = items.filter((i) => i.status === "non-compliant").length;
    return { compliant, warning, nonCompliant, total: items.length };
  }, [items]);

  const generatePdf = useCallback(async () => {
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc: JsPDFType = new jsPDF();
      doc.setFontSize(16);
      doc.text("OSHA Inspection Readiness Report", 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
      doc.text(`Year: ${currentYear}`, 14, 34);
      let y = 44;
      items.forEach((item) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const icon = item.status === "compliant" ? "[OK]" : item.status === "non-compliant" ? "[X]" : "[!]";
        doc.text(`${icon} ${item.label}`, 14, y);
        doc.text(`    ${item.detail}`, 14, y + 6);
        y += 14;
      });
      doc.save(`inspection-readiness-${today}.pdf`);
    } finally {
      setGenerating(false);
    }
  }, [items, currentYear, today]);

  const isLoading =
    recordablesQuery.isLoading ||
    expiredCertsQuery.isLoading ||
    retentionQuery.isLoading ||
    equipmentQuery.isLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Inspection Readiness">
        <div className="max-w-2xl mx-auto flex items-center justify-center min-h-[40vh]" aria-busy="true" aria-live="polite">
          <Loader2 className="w-8 h-8 animate-spin text-red-400" aria-hidden />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Inspection Readiness">
      <div className="max-w-2xl mx-auto pb-20">
        {/* Section label */}
        <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2" aria-hidden>
          Live checklist
        </p>
        <p className="text-base text-white/80 leading-relaxed mb-6">
          OSHA inspection preparedness from live data. Verify 300A posting and electrical qualifications manually.
        </p>

        {/* Summary strip */}
        <div
          className={`${glass.card} p-4 mb-6 grid grid-cols-3 gap-3 text-center`}
          role="status"
          aria-live="polite"
          aria-label={`Checklist summary: ${summary.compliant} compliant, ${summary.warning} to verify, ${summary.nonCompliant} need attention`}
        >
          <div>
            <span className="block text-2xl font-semibold text-green-400 tabular-nums">{summary.compliant}</span>
            <span className="text-xs text-white/60">Compliant</span>
          </div>
          <div>
            <span className="block text-2xl font-semibold text-amber-400 tabular-nums">{summary.warning}</span>
            <span className="text-xs text-white/60">Verify</span>
          </div>
          <div>
            <span className="block text-2xl font-semibold text-red-400 tabular-nums">{summary.nonCompliant}</span>
            <span className="text-xs text-white/60">Needs attention</span>
          </div>
        </div>

        {/* Checklist */}
        <div className={`${glass.card} overflow-hidden`}>
          <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-red-400 flex-shrink-0" aria-hidden />
            <span className="text-sm font-medium text-white">Checklist</span>
          </div>
          <ul className="divide-y divide-white/[0.04]" aria-label="Inspection readiness checklist">
            {items.map((item, index) => (
              <motion.li
                key={item.id}
                variants={shouldReduceMotion ? {} : itemVariants}
                initial="hidden"
                animate="visible"
                transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.24) }}
                className={`flex items-start gap-3 p-4 transition-colors duration-150 ${
                  item.status === "compliant"
                    ? "bg-green-950/30 border-l-2 border-green-500/40"
                    : item.status === "non-compliant"
                      ? "bg-red-950/30 border-l-2 border-red-500/40"
                      : "bg-amber-950/20 border-l-2 border-amber-500/40"
                }`}
              >
                <span className="flex-shrink-0 mt-0.5" aria-hidden>
                  {item.status === "compliant" ? (
                    <Check className="w-5 h-5 text-green-400" strokeWidth={2} />
                  ) : item.status === "non-compliant" ? (
                    <X className="w-5 h-5 text-red-400" strokeWidth={2} />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400" strokeWidth={2} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">{item.label}</div>
                  <div className="text-xs text-white/60 mt-1 leading-relaxed">{item.detail}</div>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-6">
          <button
            type="button"
            onClick={generatePdf}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-red-600/20 border border-red-500/30 text-red-300 font-medium hover:bg-red-600/30 hover:border-red-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            aria-busy={generating}
            aria-live="polite"
          >
            {generating ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
            ) : (
              <FileDown className="w-5 h-5" aria-hidden />
            )}
            Generate Report (PDF)
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
