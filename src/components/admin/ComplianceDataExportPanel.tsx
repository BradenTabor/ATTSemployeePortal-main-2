/**
 * Compliance Data Export Panel — review and export all compliance datasets
 * for the Admin Compliance Audit page. Each section: optional date range,
 * Load, preview count, Export CSV / PDF.
 */

import { useState, useCallback } from "react";
import {
  Loader2,
  FileDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabaseClient";
import {
  DataExporter,
  generateFilename,
  getExportColumns,
  formatDateForExport,
  formatCurrency,
  formatValue,
  type ExportMetadata,
  type ExportColumn,
} from "../../lib/exportUtils";
import { logReportExported } from "../../lib/safetyAuditLog";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";
import { dvirExportColumns, equipmentExportColumns, DVIR_PDF_EXPORT_COLUMNS, EQUIPMENT_PDF_EXPORT_COLUMNS } from "../../pages/mechanic/equipment-logs/exportColumns";
import type { DVIRReport } from "../../pages/mechanic/equipment-logs/types";
import type { EquipmentInspection } from "../../pages/mechanic/equipment-logs/types";

const PAGE_SIZE = 5000;

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 89);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

// -----------------------------------------------------------------------------
// Section: one dataset with date range, Load, count, Export
// -----------------------------------------------------------------------------

type ExportFormat = "csv" | "pdf";

interface SectionConfig<T> {
  id: string;
  title: string;
  description: string;
  columns: ExportColumn<T>[];
  /** Optional slim column set for PDF (fewer columns, short headers, full data). */
  pdfColumns?: ExportColumn<T>[];
  reportType: string;
  filenamePrefix: string;
  fetchData: (from: string, to: string) => Promise<T[]>;
  getRowCount: (data: T[]) => number;
}

function ExportSection<T>({
  config,
  defaultFrom,
  defaultTo,
  exportedBy,
  onExport,
}: {
  config: SectionConfig<T>;
  defaultFrom: string;
  defaultTo: string;
  exportedBy: string;
  onExport: (reportType: string, format: ExportFormat, totalRecords: number, dateFrom: string, dateTo: string) => Promise<void>;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleLoad = useCallback(async () => {
    setError(null);
    const fromTrim = from.trim();
    const toTrim = to.trim();
    if (!fromTrim || !toTrim) {
      setError("Please select both From and To dates.");
      return;
    }
    if (fromTrim > toTrim) {
      setError("From date must be on or before To date.");
      return;
    }
    setLoading(true);
    try {
      const rows = await config.fetchData(fromTrim, toTrim);
      setData(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [config, from, to]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!data || data.length === 0) return;
      setExporting(format);
      try {
        const exporter = new DataExporter<T>();
        const metadata: ExportMetadata = {
          reportType: config.reportType,
          generatedAt: new Date(),
          exportedBy,
          filters: { "Date From": from, "Date To": to },
          totalRecords: data.length,
        };
        const dateContext = `${from}_to_${to}`;
        const filename = generateFilename(config.filenamePrefix, dateContext, format === "csv" ? "csv" : "pdf");
        if (format === "csv") {
          exporter.exportCSV({
            data,
            columns: config.columns,
            filename,
            metadata,
          });
        } else {
          const pdfColumns = config.pdfColumns ?? getExportColumns(config.columns as ExportColumn<T>[], "pdf");
          await exporter.exportPDF({
            data,
            columns: pdfColumns,
            filename,
            metadata,
            companyName: "All Terrain Tree Service",
            subtitle: `${from} to ${to}`,
            orientation: "landscape",
          });
        }
        await onExport(config.reportType, format, data.length, from, to);
      } finally {
        setExporting(null);
      }
    },
    [data, config, from, to, exportedBy, onExport]
  );

  const count = data ? config.getRowCount(data) : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full p-3 sm:p-4 flex items-center justify-between gap-2 text-left hover:bg-white/[0.02]"
      >
        <div>
          <h3 className="text-sm font-medium text-white">{config.title}</h3>
          <p className="text-xs text-white/50 mt-0.5">{config.description}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/50" /> : <ChevronDown className="w-4 h-4 text-white/50" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/10 overflow-hidden"
          >
            <div className="p-3 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs text-white/50 block mb-1">From</label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm min-h-[40px]"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="text-xs text-white/50 block mb-1">To</label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm min-h-[40px]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLoad}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-medium disabled:opacity-50 min-h-[40px]"
                >
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                  Load
                </button>
              </div>
              {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
              {data !== null && (
                <>
                  <p className="text-xs text-white/60">
                    {count} record{count !== 1 ? "s" : ""} loaded.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleExport("csv")}
                      disabled={count === 0 || exporting !== null}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15 disabled:opacity-50 min-h-[40px]"
                    >
                      <FileDown className="w-4 h-4" />
                      {exporting === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Export CSV"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("pdf")}
                      disabled={count === 0 || exporting !== null}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15 disabled:opacity-50 min-h-[40px]"
                    >
                      <FileDown className="w-4 h-4" />
                      {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Export PDF"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Column definitions for datasets that don't have shared export columns
// -----------------------------------------------------------------------------

interface JsaRow {
  id: string;
  job_date: string;
  work_location: string | null;
  status: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string | null;
  notes: string | null;
  jsa_photo_paths: string[] | null;
}

const JSA_COLUMNS: ExportColumn<JsaRow>[] = [
  { header: "ID", key: "id", format: (v) => (v as string)?.slice(0, 8) ?? "—", width: 12 },
  { header: "Job Date", key: "job_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Work Location", key: "work_location", format: (v) => formatValue(v), width: 24 },
  { header: "Status", key: "status", format: (v) => formatValue(v), width: 12 },
  { header: "Created", key: "created_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
  { header: "Notes", key: "notes", format: (v) => formatValue(v), width: 30 },
  { header: "Paper JSA Photos", key: "jsa_photo_paths", format: (v) => {
    const paths = v as string[] | null;
    if (!paths || paths.length === 0) return "None";
    return `${paths.length} attached`;
  }, width: 18 },
];

interface RtoRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string | null;
  submitted_at: string | null;
  email: string | null;
  full_name: string | null;
}

const RTO_COLUMNS: ExportColumn<RtoRow>[] = [
  { header: "ID", key: "id", format: (v) => (v as string)?.slice(0, 8) ?? "—", width: 12 },
  { header: "Full Name", key: "full_name", format: (v) => formatValue(v), width: 20 },
  { header: "Email", key: "email", format: (v) => formatValue(v), width: 28 },
  { header: "Start Date", key: "start_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "End Date", key: "end_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Reason", key: "reason", format: (v) => formatValue(v), width: 30 },
  { header: "Status", key: "status", format: (v) => formatValue(v), width: 12 },
  { header: "Submitted At", key: "submitted_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
];

interface ComplianceRewardRow {
  user_id: string;
  date_for: string;
  forms_completed: string[] | unknown;
  points_awarded: number | null;
}

const COMPLIANCE_REWARDS_COLUMNS: ExportColumn<ComplianceRewardRow>[] = [
  { header: "User ID", key: "user_id", format: (v) => (v as string)?.slice(0, 8) ?? "—", width: 12 },
  { header: "Date", key: "date_for", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Forms Completed", key: "forms_completed", format: (v) => (Array.isArray(v) ? v.join(", ") : formatValue(v)), width: 30 },
  { header: "Points", key: "points_awarded", format: (v) => String(v ?? 0), width: 10 },
];

interface AnnouncementRewardRow {
  user_id: string;
  user_name?: string;
  announcement_id: string;
  points_awarded: number | null;
  claimed_at: string;
}

const ANNOUNCEMENT_REWARDS_COLUMNS: ExportColumn<AnnouncementRewardRow>[] = [
  { header: "User", key: "user_name", format: (v, row) => (v as string) || (row?.user_id as string) || "—", width: 22 },
  { header: "Announcement ID", key: "announcement_id", format: (v) => (v as string)?.slice(0, 8) ?? "—", width: 14 },
  { header: "Points", key: "points_awarded", format: (v) => String(v ?? 0), width: 10 },
  { header: "Claimed At", key: "claimed_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
];

interface CertificationRecordRow {
  id: string;
  user_id: string;
  certification_type_id: string;
  certified_at: string | null;
  expires_at: string;
  status: string | null;
  created_at: string;
}

const CERTIFICATION_RECORDS_COLUMNS: ExportColumn<CertificationRecordRow>[] = [
  { header: "ID", key: "id", format: (v) => (v as string)?.slice(0, 8) ?? "—", width: 12 },
  { header: "User ID", key: "user_id", format: (v) => (v as string)?.slice(0, 8) ?? "—", width: 12 },
  { header: "Cert Type ID", key: "certification_type_id", format: (v) => (v as string)?.slice(0, 8) ?? "—", width: 14 },
  { header: "Certified At", key: "certified_at", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Expires At", key: "expires_at", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Status", key: "status", format: (v) => formatValue(v), width: 14 },
  { header: "Created", key: "created_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
];

interface MaintenanceLogRow {
  id: string;
  truck_number: string | null;
  maintenance_type: string | null;
  description: string | null;
  service_date: string | null;
  mileage_at_service: number | null;
  cost: number | null;
  performed_by_name: string | null;
  created_at: string;
}

const MAINTENANCE_LOG_COLUMNS: ExportColumn<MaintenanceLogRow>[] = [
  { header: "ID", key: "id", format: (v) => (v as string)?.slice(0, 8) ?? "—", width: 12 },
  { header: "Truck #", key: "truck_number", format: (v) => formatValue(v), width: 14 },
  { header: "Type", key: "maintenance_type", format: (v) => formatValue(v), width: 18 },
  { header: "Description", key: "description", format: (v) => formatValue(v), width: 35 },
  { header: "Service Date", key: "service_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Mileage", key: "mileage_at_service", format: (v) => (v != null ? String(v) : "—"), width: 12 },
  { header: "Cost", key: "cost", format: (v) => formatCurrency(v as number | null), width: 12 },
  { header: "Performed By", key: "performed_by_name", format: (v) => formatValue(v), width: 20 },
  { header: "Created", key: "created_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
];

interface SafetyIncidentRow {
  id: string;
  incident_date: string | null;
  severity: string | null;
  description: string | null;
  case_number: string | null;
  work_site_name: string | null;
  created_at: string;
}

const SAFETY_INCIDENTS_COLUMNS: ExportColumn<SafetyIncidentRow>[] = [
  { header: "ID", key: "id", format: (v) => (v as string)?.slice(0, 8) ?? "—", width: 12 },
  { header: "Case #", key: "case_number", format: (v) => formatValue(v), width: 14 },
  { header: "Incident Date", key: "incident_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Severity", key: "severity", format: (v) => formatValue(v), width: 14 },
  { header: "Description", key: "description", format: (v) => formatValue(v), width: 40 },
  { header: "Work Site", key: "work_site_name", format: (v) => formatValue(v), width: 24 },
  { header: "Created", key: "created_at", format: (v) => formatDateForExport(v as string, true), width: 22 },
];

interface ComplianceSummaryRow {
  date: string;
  dvir_count: number;
  dvir_users: number;
  equipment_count: number;
  equipment_users: number;
  jsa_count: number;
  jsa_users: number;
}

const COMPLIANCE_SUMMARY_COLUMNS: ExportColumn<ComplianceSummaryRow>[] = [
  { header: "Date", key: "date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "DVIR Count", key: "dvir_count", format: (v) => String(v ?? 0), width: 12 },
  { header: "DVIR Users", key: "dvir_users", format: (v) => String(v ?? 0), width: 12 },
  { header: "Equip Count", key: "equipment_count", format: (v) => String(v ?? 0), width: 12 },
  { header: "Equip Users", key: "equipment_users", format: (v) => String(v ?? 0), width: 12 },
  { header: "JSA Count", key: "jsa_count", format: (v) => String(v ?? 0), width: 12 },
  { header: "JSA Users", key: "jsa_users", format: (v) => String(v ?? 0), width: 12 },
];

interface IncidentLogRow {
  case_number: string | null;
  incident_date: string;
  incident_time: string | null;
  employee_name: string | null;
  employee_job_title: string | null;
  work_site_name: string | null;
  description: string | null;
  severity: string | null;
  reported_at: string | null;
  [key: string]: unknown;
}

const INCIDENT_LOG_COLUMNS: ExportColumn<IncidentLogRow>[] = [
  { header: "Case #", key: "case_number", format: (v) => formatValue(v), width: 14 },
  { header: "Incident Date", key: "incident_date", format: (v) => formatDateForExport(v as string), width: 14 },
  { header: "Employee", key: "employee_name", format: (v) => formatValue(v), width: 20 },
  { header: "Job Title", key: "employee_job_title", format: (v) => formatValue(v), width: 18 },
  { header: "Where", key: "work_site_name", format: (v) => formatValue(v), width: 24 },
  { header: "Description", key: "description", format: (v) => formatValue(v), width: 36 },
  { header: "Severity", key: "severity", format: (v) => formatValue(v), width: 12 },
  { header: "Reported At", key: "reported_at", format: (v) => formatDateForExport(v as string, true), width: 20 },
];

// -----------------------------------------------------------------------------
// Panel
// -----------------------------------------------------------------------------

export default function ComplianceDataExportPanel() {
  const { user, role } = useAuth();
  const defaultRange = getDefaultDateRange();

  const onExport = useCallback(
    async (
      reportType: string,
      format: ExportFormat,
      totalRecords: number,
      dateFrom: string,
      dateTo: string
    ) => {
      await logReportExported(
        { reportType, dateFrom, dateTo, format, totalRecords },
        { userId: user?.id, role: role ?? undefined }
      );
    },
    [user?.id, role]
  );

  const sections: SectionConfig<unknown>[] = [
    {
      id: "dvir",
      title: "DVIR submission data",
      description: "Daily vehicle inspection reports.",
      reportType: "DVIR Submissions",
      filenamePrefix: "DVIR_Submissions",
      columns: dvirExportColumns as ExportColumn<unknown>[],
      pdfColumns: DVIR_PDF_EXPORT_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase
          .from("dvir_reports")
          .select("*")
          .gte("report_date", fromDate)
          .lte("report_date", toDate)
          .order("report_date", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw new Error(error.message);
        return (data ?? []) as DVIRReport[];
      },
    },
    {
      id: "jsa",
      title: "JSA submission data",
      description: "Job safety analysis forms.",
      reportType: "JSA Submissions",
      filenamePrefix: "JSA_Submissions",
      columns: JSA_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase
          .from("daily_jsa")
          .select("id, job_date, work_location, status, user_id, created_at, updated_at, notes, jsa_photo_paths")
          .gte("job_date", fromDate)
          .lte("job_date", toDate)
          .order("job_date", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw new Error(error.message);
        return (data ?? []) as JsaRow[];
      },
    },
    {
      id: "equipment",
      title: "Equipment inspection submission data",
      description: "Daily equipment inspections.",
      reportType: "Equipment Inspections",
      filenamePrefix: "Equipment_Inspections",
      columns: equipmentExportColumns as ExportColumn<unknown>[],
      pdfColumns: EQUIPMENT_PDF_EXPORT_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase
          .from("daily_equipment_inspections")
          .select("*")
          .gte("inspection_date", fromDate)
          .lte("inspection_date", toDate)
          .order("inspection_date", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw new Error(error.message);
        return (data ?? []) as EquipmentInspection[];
      },
    },
    {
      id: "mechanic",
      title: "Mechanic fixes and updates data",
      description: "Vehicle maintenance log (repairs, parts, cost).",
      reportType: "Mechanic Fixes & Maintenance",
      filenamePrefix: "Mechanic_Maintenance_Log",
      columns: MAINTENANCE_LOG_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase
          .from("vehicle_maintenance_log")
          .select("id, truck_number, maintenance_type, description, service_date, mileage_at_service, cost, performed_by_name, created_at")
          .gte("service_date", fromDate)
          .lte("service_date", toDate)
          .order("service_date", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw new Error(error.message);
        return (data ?? []) as MaintenanceLogRow[];
      },
    },
    {
      id: "compliance_summary",
      title: "Compliance summary data",
      description: "Daily DVIR, Equipment, and JSA submission counts.",
      reportType: "Compliance Summary by Day",
      filenamePrefix: "Compliance_Summary_By_Day",
      columns: COMPLIANCE_SUMMARY_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase.rpc("get_compliance_summary_by_day", {
          p_date_from: fromDate,
          p_date_to: toDate,
        });
        if (error) throw new Error(error.message);
        return (data ?? []).map((row: { date: string } & Record<string, number>) => ({
          ...row,
          date: String(row.date).slice(0, 10),
        })) as ComplianceSummaryRow[];
      },
    },
    {
      id: "incident_log",
      title: "Incident log data",
      description: "OSHA 300/301 incident log (injuries/illnesses).",
      reportType: "Incident Log (OSHA 300/301)",
      filenamePrefix: "Incident_Log_OSHA_300_301",
      columns: INCIDENT_LOG_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase.rpc("get_incident_log_osha_300_301", {
          p_date_from: fromDate,
          p_date_to: toDate,
        });
        if (error) throw new Error(error.message);
        return (data ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          incident_date: row.incident_date != null ? String(row.incident_date).slice(0, 10) : null,
          reported_at: row.reported_at != null ? String(row.reported_at) : null,
        })) as IncidentLogRow[];
      },
    },
    {
      id: "rto",
      title: "RTO requests data",
      description: "Request time off submissions and status.",
      reportType: "RTO Requests",
      filenamePrefix: "RTO_Requests",
      columns: RTO_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase
          .from("rto_requests")
          .select("id, user_id, start_date, end_date, reason, status, submitted_at, email, full_name")
          .gte("submitted_at", `${fromDate}T00:00:00`)
          .lte("submitted_at", `${toDate}T23:59:59`)
          .order("submitted_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw new Error(error.message);
        return (data ?? []) as RtoRow[];
      },
    },
    {
      id: "compliance_rewards",
      title: "Safety analytics (compliance rewards)",
      description: "Form completion rewards by user and date.",
      reportType: "Compliance Rewards",
      filenamePrefix: "Compliance_Rewards",
      columns: COMPLIANCE_REWARDS_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase
          .from("compliance_rewards")
          .select("user_id, date_for, forms_completed, points_awarded")
          .gte("date_for", fromDate)
          .lte("date_for", toDate)
          .order("date_for", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw new Error(error.message);
        return (data ?? []) as ComplianceRewardRow[];
      },
    },
    {
      id: "announcement_rewards",
      title: "Safety analytics (announcement rewards)",
      description: "Safety announcement engagement claims.",
      reportType: "Announcement Rewards",
      filenamePrefix: "Announcement_Rewards",
      columns: ANNOUNCEMENT_REWARDS_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase
          .from("announcement_rewards")
          .select("user_id, announcement_id, points_awarded, claimed_at")
          .gte("claimed_at", `${fromDate}T00:00:00`)
          .lte("claimed_at", `${toDate}T23:59:59`)
          .order("claimed_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as AnnouncementRewardRow[];
        const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
        if (userIds.length === 0) return rows;
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        const nameByUserId = new Map<string, string>();
        for (const p of profiles ?? []) {
          const name = (p as { user_id: string; full_name: string | null; email: string | null }).full_name
            || (p as { user_id: string; full_name: string | null; email: string | null }).email
            || (p as { user_id: string }).user_id;
          nameByUserId.set((p as { user_id: string }).user_id, name);
        }
        return rows.map((r) => ({
          ...r,
          user_name: nameByUserId.get(r.user_id) ?? r.user_id,
        }));
      },
    },
    {
      id: "certifications",
      title: "Certifications data",
      description: "Certification records (completed, expired, status).",
      reportType: "Certification Records",
      filenamePrefix: "Certification_Records",
      columns: CERTIFICATION_RECORDS_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase
          .from("certification_records")
          .select("id, user_id, certification_type_id, certified_at, expires_at, status, created_at")
          .gte("created_at", `${fromDate}T00:00:00`)
          .lte("created_at", `${toDate}T23:59:59`)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw new Error(error.message);
        return (data ?? []) as CertificationRecordRow[];
      },
    },
    {
      id: "safety_incidents",
      title: "Safety risk / incident data",
      description: "Safety incidents (OSHA recordable, severity, site).",
      reportType: "Safety Incidents",
      filenamePrefix: "Safety_Incidents",
      columns: SAFETY_INCIDENTS_COLUMNS as ExportColumn<unknown>[],
      getRowCount: (d) => d.length,
      fetchData: async (fromDate, toDate) => {
        const { data, error } = await supabase
          .from("safety_incidents")
          .select("id, incident_date, severity, description, case_number, work_site_name, created_at")
          .gte("incident_date", fromDate)
          .lte("incident_date", toDate)
          .order("incident_date", { ascending: false })
          .limit(PAGE_SIZE);
        if (error) throw new Error(error.message);
        return (data ?? []) as SafetyIncidentRow[];
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-white/70 text-sm">
        <Package className="w-5 h-5 text-amber-400" />
        <span>
          Load each dataset with a date range, then export as CSV or PDF. Exports are logged to the safety audit log.
        </span>
      </div>
      <div className="space-y-2">
        {sections.map((section) => (
          <ExportSection
            key={section.id}
            config={section}
            defaultFrom={defaultRange.from}
            defaultTo={defaultRange.to}
            exportedBy={user?.email ?? "Admin"}
            onExport={onExport}
          />
        ))}
      </div>
    </div>
  );
}
