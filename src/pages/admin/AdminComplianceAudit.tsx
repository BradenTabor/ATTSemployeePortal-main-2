/**
 * Admin Compliance Audit — read-only viewer for safety_audit_log, osha_compliance_mapping,
 * Compliance Summary by Day report export, and Weekly Safety Audit Report runs.
 */

import { useState, useCallback, Fragment, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  BookOpen,
  Loader2,
  FileDown,
  FileText,
  Calendar,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";
import AdminSegmentedControl, { type SegmentTab } from "../../components/admin/AdminSegmentedControl";
import {
  DataExporter,
  generateFilename,
  type ExportMetadata,
  type ExportColumn,
} from "../../lib/exportUtils";
import { logReportExported } from "../../lib/safetyAuditLog";

const PAGE_SIZE = 50;

interface SafetyAuditLogRow {
  id: string;
  event_type: string;
  table_name: string;
  record_id: string | null;
  user_id: string | null;
  role: string | null;
  occurred_at: string;
  payload_snapshot: Record<string, unknown> | null;
  created_at: string;
}

interface OshaMappingRow {
  id: string;
  osha_regulation: string;
  requirement_description: string;
  data_source: string;
  validation_rule: string | null;
  created_at: string | null;
}

function useSafetyAuditLog(page: number) {
  return useQuery({
    queryKey: ["safety_audit_log", page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("safety_audit_log")
        .select("*", { count: "exact" })
        .order("occurred_at", { ascending: false })
        .range(from, to);
      if (error) throw new Error(error.message);
      return { rows: data as SafetyAuditLogRow[], total: count ?? 0 };
    },
    staleTime: 1000 * 60,
  });
}

function useOshaComplianceMapping() {
  return useQuery({
    queryKey: ["osha_compliance_mapping"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("osha_compliance_mapping")
        .select("*")
        .order("osha_regulation");
      if (error) throw new Error(error.message);
      return data as OshaMappingRow[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, " ");
}

interface ComplianceSummaryRow {
  date: string;
  dvir_count: number;
  dvir_users: number;
  equipment_count: number;
  equipment_users: number;
  jsa_count: number;
  jsa_users: number;
}

function getDefaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 89);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const COMPLIANCE_SUMMARY_COLUMNS: ExportColumn<ComplianceSummaryRow>[] = [
  { header: "Date", key: "date" },
  { header: "DVIR Count", key: "dvir_count" },
  { header: "DVIR Users", key: "dvir_users" },
  { header: "Equipment Count", key: "equipment_count" },
  { header: "Equipment Users", key: "equipment_users" },
  { header: "JSA Count", key: "jsa_count" },
  { header: "JSA Users", key: "jsa_users" },
];

// Incident Log (OSHA 300/301) — row shape from get_incident_log_osha_300_301 RPC
interface IncidentLogRow {
  case_number: string | null;
  incident_date: string;
  incident_time: string | null;
  employee_name: string | null;
  employee_job_title: string | null;
  work_site_name: string | null;
  description: string | null;
  what_doing_before: string | null;
  object_substance_harmed: string | null;
  body_parts_affected: string | null;
  injury_illness_type: string | null;
  severity: string | null;
  days_away_from_work: number | null;
  days_restricted_duty: number | null;
  emergency_room_treatment: boolean | null;
  hospitalized_overnight: boolean | null;
  physician_name: string | null;
  treatment_facility: string | null;
  time_began_work: string | null;
  employee_hire_date: string | null;
  osha_reportable: boolean | null;
  osha_reported: boolean | null;
  osha_report_date: string | null;
  job_name: string | null;
  crew_name: string | null;
  supervisor_name: string | null;
  corrective_actions_taken: string | null;
  corrective_actions_at: string | null;
  reported_at: string | null;
}

interface WeeklySafetyReportRow {
  id: string;
  week_start_date: string;
  week_end_date: string;
  generated_at: string;
  email_sent: boolean;
  email_sent_at: string | null;
  sheets_updated: boolean;
  sheets_updated_at: string | null;
  error: string | null;
  report_data: Record<string, unknown> | null;
}

function useWeeklySafetyReports(enabled: boolean) {
  return useQuery({
    queryKey: ["weekly_safety_reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_safety_reports")
        .select("id, week_start_date, week_end_date, generated_at, email_sent, email_sent_at, sheets_updated, sheets_updated_at, error, report_data")
        .order("week_start_date", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as WeeklySafetyReportRow[];
    },
    enabled,
    staleTime: 1000 * 60,
  });
}

const INCIDENT_LOG_COLUMNS: ExportColumn<IncidentLogRow>[] = [
  { header: "Case #", key: "case_number" },
  { header: "Incident Date", key: "incident_date" },
  { header: "Incident Time", key: "incident_time" },
  { header: "Employee Name", key: "employee_name" },
  { header: "Job Title", key: "employee_job_title" },
  { header: "Where Occurred", key: "work_site_name" },
  { header: "Description", key: "description" },
  { header: "What Doing Before", key: "what_doing_before" },
  { header: "Object/Substance Harmed", key: "object_substance_harmed" },
  { header: "Body Parts", key: "body_parts_affected" },
  { header: "Injury/Illness Type", key: "injury_illness_type" },
  { header: "Severity", key: "severity" },
  { header: "Days Away", key: "days_away_from_work" },
  { header: "Days Restricted", key: "days_restricted_duty" },
  { header: "ER Treatment", key: "emergency_room_treatment" },
  { header: "Hospitalized", key: "hospitalized_overnight" },
  { header: "Physician", key: "physician_name" },
  { header: "Treatment Facility", key: "treatment_facility" },
  { header: "Time Began Work", key: "time_began_work" },
  { header: "Hire Date", key: "employee_hire_date" },
  { header: "OSHA Reportable", key: "osha_reportable" },
  { header: "OSHA Reported", key: "osha_reported" },
  { header: "OSHA Report Date", key: "osha_report_date" },
  { header: "Job", key: "job_name" },
  { header: "Crew", key: "crew_name" },
  { header: "Supervisor", key: "supervisor_name" },
  { header: "Corrective Actions", key: "corrective_actions_taken" },
  { header: "Corrective At", key: "corrective_actions_at" },
  { header: "Reported At", key: "reported_at" },
];

export default function AdminComplianceAudit() {
  const { user, role } = useAuth();
  const defaultRange = getDefaultDateRange();
  const [tab, setTab] = useState<"audit" | "mapping" | "reports" | "weekly">("audit");
  const [auditPage, setAuditPage] = useState(1);
  const [reportDateFrom, setReportDateFrom] = useState(defaultRange.from);
  const [reportDateTo, setReportDateTo] = useState(defaultRange.to);
  const [incidentDateFrom, setIncidentDateFrom] = useState(defaultRange.from);
  const [incidentDateTo, setIncidentDateTo] = useState(defaultRange.to);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingIncident, setIsExportingIncident] = useState(false);
  const [expandedWeeklyId, setExpandedWeeklyId] = useState<string | null>(null);

  const auditQuery = useSafetyAuditLog(auditPage);
  const weeklyReportsQuery = useWeeklySafetyReports(tab === "weekly");
  const mappingQuery = useOshaComplianceMapping();

  const summaryQuery = useQuery({
    queryKey: ["compliance_summary_by_day", reportDateFrom, reportDateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_compliance_summary_by_day", {
        p_date_from: reportDateFrom,
        p_date_to: reportDateTo,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: { date: string } & Record<string, number>) => ({
        ...row,
        date: String(row.date).slice(0, 10),
      })) as ComplianceSummaryRow[];
    },
    enabled: tab === "reports" && !!reportDateFrom && !!reportDateTo,
    staleTime: 1000 * 60,
  });

  const incidentLogQuery = useQuery({
    queryKey: ["incident_log_osha_300_301", incidentDateFrom, incidentDateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_incident_log_osha_300_301", {
        p_date_from: incidentDateFrom,
        p_date_to: incidentDateTo,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        incident_date: row.incident_date != null ? String(row.incident_date).slice(0, 10) : null,
        incident_time: row.incident_time != null ? String(row.incident_time) : null,
        time_began_work: row.time_began_work != null ? String(row.time_began_work) : null,
        employee_hire_date: row.employee_hire_date != null ? String(row.employee_hire_date).slice(0, 10) : null,
        osha_report_date: row.osha_report_date != null ? String(row.osha_report_date).slice(0, 10) : null,
        corrective_actions_at: row.corrective_actions_at != null ? String(row.corrective_actions_at) : null,
        reported_at: row.reported_at != null ? String(row.reported_at) : null,
      })) as IncidentLogRow[];
    },
    enabled: tab === "reports" && !!incidentDateFrom && !!incidentDateTo,
    staleTime: 1000 * 60,
  });

  const handleExportComplianceSummary = useCallback(
    async (format: "csv" | "pdf") => {
      if (!summaryQuery.data || summaryQuery.data.length === 0) return;
      setIsExporting(true);
      try {
        const exporter = new DataExporter<ComplianceSummaryRow>();
        const metadata: ExportMetadata = {
          reportType: "Compliance Summary by Day",
          generatedAt: new Date(),
          exportedBy: user?.email ?? "Admin",
          filters: {
            "Date From": reportDateFrom,
            "Date To": reportDateTo,
          },
          totalRecords: summaryQuery.data.length,
        };
        const dateContext = `${reportDateFrom}_to_${reportDateTo}`;
        const filename = generateFilename("Compliance_Summary_By_Day", dateContext);
        if (format === "csv") {
          exporter.exportCSV({
            data: summaryQuery.data,
            columns: COMPLIANCE_SUMMARY_COLUMNS,
            filename,
            metadata,
          });
        } else {
          await exporter.exportPDF({
            data: summaryQuery.data,
            columns: COMPLIANCE_SUMMARY_COLUMNS,
            filename: filename.replace(".csv", ".pdf"),
            metadata,
            companyName: "All Terrain Tree Service",
            subtitle: `${reportDateFrom} to ${reportDateTo}`,
            orientation: "landscape",
          });
        }
        await logReportExported(
          {
            reportType: "Compliance Summary by Day",
            dateFrom: reportDateFrom,
            dateTo: reportDateTo,
            format,
            totalRecords: summaryQuery.data.length,
          },
          { userId: user?.id, role: role ?? undefined }
        );
      } finally {
        setIsExporting(false);
      }
    },
    [summaryQuery.data, reportDateFrom, reportDateTo, user?.id, user?.email, role]
  );

  const handleExportIncidentLog = useCallback(
    async (format: "csv" | "pdf") => {
      if (!incidentLogQuery.data || incidentLogQuery.data.length === 0) return;
      setIsExportingIncident(true);
      try {
        const exporter = new DataExporter<IncidentLogRow>();
        const metadata: ExportMetadata = {
          reportType: "Incident Log (OSHA 300/301)",
          generatedAt: new Date(),
          exportedBy: user?.email ?? "Admin",
          filters: {
            "Date From": incidentDateFrom,
            "Date To": incidentDateTo,
          },
          totalRecords: incidentLogQuery.data.length,
        };
        const dateContext = `${incidentDateFrom}_to_${incidentDateTo}`;
        const filename = generateFilename("Incident_Log_OSHA_300_301", dateContext);
        if (format === "csv") {
          exporter.exportCSV({
            data: incidentLogQuery.data,
            columns: INCIDENT_LOG_COLUMNS,
            filename,
            metadata,
          });
        } else {
          await exporter.exportPDF({
            data: incidentLogQuery.data,
            columns: INCIDENT_LOG_COLUMNS,
            filename: filename.replace(".csv", ".pdf"),
            metadata,
            companyName: "All Terrain Tree Service",
            subtitle: `Incident Log ${incidentDateFrom} to ${incidentDateTo}`,
            orientation: "landscape",
          });
        }
        await logReportExported(
          {
            reportType: "Incident Log (OSHA 300/301)",
            dateFrom: incidentDateFrom,
            dateTo: incidentDateTo,
            format,
            totalRecords: incidentLogQuery.data.length,
          },
          { userId: user?.id, role: role ?? undefined }
        );
      } finally {
        setIsExportingIncident(false);
      }
    },
    [
      incidentLogQuery.data,
      incidentDateFrom,
      incidentDateTo,
      user?.id,
      user?.email,
      role,
    ]
  );

  const totalPages = auditQuery.data
    ? Math.max(1, Math.ceil(auditQuery.data.total / PAGE_SIZE))
    : 1;

  // Tab configuration for AdminSegmentedControl
  const tabs: SegmentTab[] = useMemo(() => [
    { id: "audit", label: "Audit Log", shortLabel: "Audit", icon: <Database className="w-4 h-4" /> },
    { id: "mapping", label: "OSHA Mapping", shortLabel: "OSHA", icon: <BookOpen className="w-4 h-4" /> },
    { id: "reports", label: "Reports", shortLabel: "Reports", icon: <FileText className="w-4 h-4" /> },
    { id: "weekly", label: "Weekly Reports", shortLabel: "Weekly", icon: <Calendar className="w-4 h-4" /> },
  ], []);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white px-3 py-4 sm:px-4 sm:py-6 pb-20 sm:pb-24 w-full min-w-0">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 w-full min-w-0">
          {/* Header - compressed on mobile */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400" aria-hidden />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-white">Compliance Audit</h1>
                <p className="text-xs sm:text-sm text-white/60">
                  Safety audit log and OSHA regulation mapping (read-only)
                </p>
              </div>
            </div>
          </div>

          {/* Tabs - uses AdminSegmentedControl for mobile-friendly wrap */}
          <AdminSegmentedControl
            tabs={tabs}
            activeTab={tab}
            onChange={(tabId) => setTab(tabId as "audit" | "mapping" | "reports" | "weekly")}
          />

          <AnimatePresence mode="wait">
            {tab === "audit" && (
              <motion.div
                key="audit"
                id="panel-audit"
                role="tabpanel"
                aria-labelledby="tab-audit"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
              >
                <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs sm:text-sm text-white/70">
                    Safety audit log (submissions and report exports)
                  </span>
                  <button
                    type="button"
                    onClick={() => auditQuery.refetch()}
                    disabled={auditQuery.isFetching}
                    aria-label="Refresh audit log"
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs sm:text-sm text-white/80 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                  >
                    <RefreshCw
                      className={cn("w-4 h-4", auditQuery.isFetching && "animate-spin")}
                    />
                    Refresh
                  </button>
                </div>
                {auditQuery.isLoading && (
                  <div className="flex items-center justify-center py-12 sm:py-16">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-amber-400" />
                  </div>
                )}
                {auditQuery.error && (
                  <div className="p-4 sm:p-6 text-center text-red-400 text-sm">
                    {auditQuery.error.message}
                  </div>
                )}
                {auditQuery.data && auditQuery.data.rows.length === 0 && (
                  <div className="p-4 sm:p-6 text-center text-white/50 text-sm">
                    No audit entries yet.
                  </div>
                )}
                {auditQuery.data && auditQuery.data.rows.length > 0 && (
                  <>
                    {/* Mobile: card layout; Desktop: scrollable table */}
                    <div className="md:hidden divide-y divide-white/5">
                      {auditQuery.data.rows.map((row) => (
                        <div
                          key={row.id}
                          className="p-3 sm:p-4 space-y-2 border-b border-white/5 last:border-b-0"
                        >
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                            <span className="text-white/50 shrink-0">When</span>
                            <span className="text-white/80">
                              {new Date(row.occurred_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                            <span className="text-white/50 shrink-0">Event</span>
                            <span className="text-amber-300/90 font-medium">
                              {formatEventType(row.event_type)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                            <span className="text-white/50 shrink-0">Table</span>
                            <span className="text-white/70 break-all">{row.table_name}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                            <span className="text-white/50 shrink-0">Record ID</span>
                            <span className="text-white/50 font-mono break-all">
                              {row.record_id ?? "—"}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 text-xs sm:text-sm">
                            <span className="text-white/50 shrink-0">Payload</span>
                            {row.payload_snapshot ? (
                              <pre className="text-xs text-white/50 break-words whitespace-pre-wrap overflow-hidden max-h-24 overflow-y-auto rounded bg-white/5 px-2 py-1.5">
                                {JSON.stringify(row.payload_snapshot)}
                              </pre>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block w-full min-w-0 overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[560px]">
                        <thead>
                          <tr className="border-b border-white/10 text-white/60">
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">When</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Event</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Table</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Record ID</th>
                            <th className="p-2 sm:p-3 font-medium">Payload</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditQuery.data.rows.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-white/5 hover:bg-white/[0.02]"
                            >
                              <td className="p-2 sm:p-3 text-white/80 whitespace-nowrap">
                                {new Date(row.occurred_at).toLocaleString()}
                              </td>
                              <td className="p-2 sm:p-3 text-amber-300/90 font-medium whitespace-nowrap">
                                {formatEventType(row.event_type)}
                              </td>
                              <td className="p-2 sm:p-3 text-white/70 whitespace-nowrap">{row.table_name}</td>
                              <td className="p-2 sm:p-3 text-white/50 font-mono text-xs max-w-[120px] truncate" title={row.record_id ?? undefined}>
                                {row.record_id ? `${String(row.record_id).slice(0, 8)}…` : "—"}
                              </td>
                              <td className="p-2 sm:p-3 max-w-[180px]">
                                {row.payload_snapshot ? (
                                  <pre className="text-xs text-white/50 truncate" title={JSON.stringify(row.payload_snapshot)}>
                                    {JSON.stringify(row.payload_snapshot).slice(0, 60)}…
                                  </pre>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-2.5 sm:p-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-white/50 order-2 sm:order-1">
                        Page {auditPage} of {totalPages} ({auditQuery.data.total} total)
                      </span>
                      <div className="flex gap-2 order-1 sm:order-2">
                        <button
                          type="button"
                          onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                          disabled={auditPage <= 1}
                          aria-label="Previous page"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuditPage((p) => Math.min(totalPages, p + 1))}
                          disabled={auditPage >= totalPages}
                          aria-label="Next page"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none min-h-[44px] min-w-[44px] flex items-center justify-center"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {tab === "mapping" && (
              <motion.div
                key="mapping"
                id="panel-mapping"
                role="tabpanel"
                aria-labelledby="tab-mapping"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
              >
                <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs sm:text-sm text-white/70">
                    OSHA regulation → data source mapping
                  </span>
                  <button
                    type="button"
                    onClick={() => mappingQuery.refetch()}
                    disabled={mappingQuery.isFetching}
                    aria-label="Refresh OSHA mapping"
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs sm:text-sm text-white/80 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                  >
                    <RefreshCw
                      className={cn(
                        "w-4 h-4",
                        mappingQuery.isFetching && "animate-spin"
                      )}
                    />
                    Refresh
                  </button>
                </div>
                {mappingQuery.isLoading && (
                  <div className="flex items-center justify-center py-12 sm:py-16">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-amber-400" />
                  </div>
                )}
                {mappingQuery.error && (
                  <div className="p-4 sm:p-6 text-center text-red-400 text-sm">
                    {mappingQuery.error.message}
                  </div>
                )}
                {mappingQuery.data && mappingQuery.data.length === 0 && (
                  <div className="p-4 sm:p-6 text-center text-white/50 text-sm">
                    No OSHA mapping entries. Run migration seed.
                  </div>
                )}
                {mappingQuery.data && mappingQuery.data.length > 0 && (
                  <>
                    <div className="md:hidden divide-y divide-white/5">
                      {mappingQuery.data.map((row) => (
                        <div
                          key={row.id}
                          className="p-3 sm:p-4 space-y-2 border-b border-white/5 last:border-b-0"
                        >
                          <div className="flex flex-col gap-1 text-xs sm:text-sm">
                            <span className="text-white/50">Regulation</span>
                            <span className="text-amber-300/90 font-medium font-mono">{row.osha_regulation}</span>
                          </div>
                          <div className="flex flex-col gap-1 text-xs sm:text-sm">
                            <span className="text-white/50">Requirement</span>
                            <span className="text-white/80 break-words">{row.requirement_description}</span>
                          </div>
                          <div className="flex flex-col gap-1 text-xs sm:text-sm">
                            <span className="text-white/50">Data Source</span>
                            <span className="text-white/70 break-words">{row.data_source}</span>
                          </div>
                          <div className="flex flex-col gap-1 text-xs sm:text-sm">
                            <span className="text-white/50">Validation</span>
                            <span className="text-white/50 break-words">{row.validation_rule ?? "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block w-full min-w-0 overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[520px]">
                        <thead>
                          <tr className="border-b border-white/10 text-white/60">
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Regulation</th>
                            <th className="p-2 sm:p-3 font-medium">Requirement</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Data Source</th>
                            <th className="p-2 sm:p-3 font-medium">Validation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mappingQuery.data.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-white/5 hover:bg-white/[0.02]"
                            >
                              <td className="p-2 sm:p-3 text-amber-300/90 font-medium font-mono whitespace-nowrap">
                                {row.osha_regulation}
                              </td>
                              <td className="p-2 sm:p-3 text-white/80">{row.requirement_description}</td>
                              <td className="p-2 sm:p-3 text-white/70 text-xs whitespace-nowrap">{row.data_source}</td>
                              <td className="p-2 sm:p-3 text-white/50 text-xs">
                                {row.validation_rule ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {tab === "reports" && (
              <motion.div
                key="reports"
                id="panel-reports"
                role="tabpanel"
                aria-labelledby="tab-reports"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
              >
                {/* Compliance Summary Section */}
                <div className="p-3 sm:p-4 border-b border-white/10 space-y-3 sm:space-y-4">
                  <p className="text-xs sm:text-sm text-white/70">
                    Compliance Summary by Day — daily DVIR, Equipment, and JSA submission counts (max 366 days).
                  </p>
                  {/* Stacked on mobile: date inputs + Load in one row, Export buttons in next row */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                      <div className="flex-1 min-w-[130px]">
                        <label className="text-xs text-white/50 block mb-1">From</label>
                        <input
                          type="date"
                          value={reportDateFrom}
                          onChange={(e) => setReportDateFrom(e.target.value)}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm min-h-[44px]"
                        />
                      </div>
                      <div className="flex-1 min-w-[130px]">
                        <label className="text-xs text-white/50 block mb-1">To</label>
                        <input
                          type="date"
                          value={reportDateTo}
                          onChange={(e) => setReportDateTo(e.target.value)}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm min-h-[44px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => summaryQuery.refetch()}
                        disabled={summaryQuery.isFetching}
                        aria-label="Load compliance summary data"
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-medium disabled:opacity-50 min-h-[44px]"
                      >
                        <RefreshCw
                          className={cn("w-4 h-4", summaryQuery.isFetching && "animate-spin")}
                        />
                        Load
                      </button>
                    </div>
                    {summaryQuery.data && summaryQuery.data.length > 0 && (
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleExportComplianceSummary("csv")}
                          disabled={isExporting}
                          aria-label="Export compliance summary as CSV"
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15 disabled:opacity-50 min-h-[44px]"
                        >
                          <FileDown className="w-4 h-4" />
                          <span className="hidden xs:inline">Export</span> CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportComplianceSummary("pdf")}
                          disabled={isExporting}
                          aria-label="Export compliance summary as PDF"
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15 disabled:opacity-50 min-h-[44px]"
                        >
                          <FileDown className="w-4 h-4" />
                          <span className="hidden xs:inline">Export</span> PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {summaryQuery.isLoading && (
                  <div className="flex items-center justify-center py-12 sm:py-16">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-amber-400" />
                  </div>
                )}
                {summaryQuery.error && (
                  <div className="p-4 sm:p-6 text-center text-red-400 text-sm">
                    {summaryQuery.error.message}
                  </div>
                )}
                {summaryQuery.data && summaryQuery.data.length === 0 && !summaryQuery.isLoading && (
                  <div className="p-4 sm:p-6 text-center text-white/50 text-sm">
                    No data for this date range. Adjust dates and Load.
                  </div>
                )}
                {summaryQuery.data && summaryQuery.data.length > 0 && (
                  <>
                    <div className="md:hidden max-h-[40vh] overflow-y-auto divide-y divide-white/5">
                      {summaryQuery.data.map((row) => (
                        <div
                          key={row.date}
                          className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs sm:text-sm py-2.5"
                        >
                          <span className="text-white/50 col-span-2 sm:col-span-4">{row.date}</span>
                          <span className="text-white/70">DVIR</span>
                          <span className="text-white/80">{row.dvir_count}</span>
                          <span className="text-white/70">DVIR Users</span>
                          <span className="text-white/80">{row.dvir_users}</span>
                          <span className="text-white/70">Equip</span>
                          <span className="text-white/80">{row.equipment_count}</span>
                          <span className="text-white/70">Equip Users</span>
                          <span className="text-white/80">{row.equipment_users}</span>
                          <span className="text-white/70">JSA</span>
                          <span className="text-white/80">{row.jsa_count}</span>
                          <span className="text-white/70">JSA Users</span>
                          <span className="text-white/80">{row.jsa_users}</span>
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block w-full min-w-0 overflow-x-auto max-h-[35vh] sm:max-h-[40vh] overflow-y-auto">
                      <table className="w-full text-left text-sm min-w-[480px]">
                        <thead className="sticky top-0 bg-gray-900/95 z-10">
                          <tr className="border-b border-white/10 text-white/60">
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Date</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">DVIR</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">DVIR Users</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Equipment</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Equip Users</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">JSA</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">JSA Users</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryQuery.data.map((row) => (
                            <tr
                              key={row.date}
                              className="border-b border-white/5 hover:bg-white/[0.02]"
                            >
                              <td className="p-2 sm:p-3 text-white/80 whitespace-nowrap">{row.date}</td>
                              <td className="p-2 sm:p-3 text-white/70">{row.dvir_count}</td>
                              <td className="p-2 sm:p-3 text-white/70">{row.dvir_users}</td>
                              <td className="p-2 sm:p-3 text-white/70">{row.equipment_count}</td>
                              <td className="p-2 sm:p-3 text-white/70">{row.equipment_users}</td>
                              <td className="p-2 sm:p-3 text-white/70">{row.jsa_count}</td>
                              <td className="p-2 sm:p-3 text-white/70">{row.jsa_users}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Incident Log (OSHA 300/301) */}
                <div className="p-3 sm:p-4 border-t border-white/10 space-y-3 sm:space-y-4 mt-0">
                  <p className="text-xs sm:text-sm text-white/70">
                    Incident Log (OSHA 300/301) — injuries/illnesses with job, crew, and supervisor traceability (max 366 days).
                  </p>
                  {/* Stacked on mobile: date inputs + Load in one row, Export buttons in next row */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="flex flex-wrap items-end gap-2 sm:gap-3">
                      <div className="flex-1 min-w-[130px]">
                        <label className="text-xs text-white/50 block mb-1">From</label>
                        <input
                          type="date"
                          value={incidentDateFrom}
                          onChange={(e) => setIncidentDateFrom(e.target.value)}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm min-h-[44px]"
                        />
                      </div>
                      <div className="flex-1 min-w-[130px]">
                        <label className="text-xs text-white/50 block mb-1">To</label>
                        <input
                          type="date"
                          value={incidentDateTo}
                          onChange={(e) => setIncidentDateTo(e.target.value)}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm min-h-[44px]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => incidentLogQuery.refetch()}
                        disabled={incidentLogQuery.isFetching}
                        aria-label="Load incident log data"
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-medium disabled:opacity-50 min-h-[44px]"
                      >
                        <RefreshCw
                          className={cn("w-4 h-4", incidentLogQuery.isFetching && "animate-spin")}
                        />
                        Load
                      </button>
                    </div>
                    {incidentLogQuery.data && incidentLogQuery.data.length > 0 && (
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleExportIncidentLog("csv")}
                          disabled={isExportingIncident}
                          aria-label="Export incident log as CSV"
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15 disabled:opacity-50 min-h-[44px]"
                        >
                          <FileDown className="w-4 h-4" />
                          <span className="hidden xs:inline">Export</span> CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportIncidentLog("pdf")}
                          disabled={isExportingIncident}
                          aria-label="Export incident log as PDF"
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15 disabled:opacity-50 min-h-[44px]"
                        >
                          <FileDown className="w-4 h-4" />
                          <span className="hidden xs:inline">Export</span> PDF
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {incidentLogQuery.isLoading && (
                  <div className="flex flex-wrap justify-center py-6 sm:py-8 gap-4">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  </div>
                )}
                {incidentLogQuery.error && (
                  <div className="p-3 sm:p-4 text-center text-red-400 text-sm">
                    {incidentLogQuery.error.message}
                  </div>
                )}
                {incidentLogQuery.data && incidentLogQuery.data.length === 0 && !incidentLogQuery.isLoading && (
                  <div className="p-3 sm:p-4 text-center text-white/50 text-sm">
                    No incidents for this date range. Adjust dates and Load.
                  </div>
                )}
                {incidentLogQuery.data && incidentLogQuery.data.length > 0 && (
                  <>
                    <div className="md:hidden max-h-[40vh] overflow-y-auto divide-y divide-white/5 border-t border-white/10">
                      {incidentLogQuery.data.map((row, idx) => (
                        <div
                          key={`${row.case_number ?? row.incident_date}-${idx}`}
                          className="p-3 space-y-2 py-2.5"
                        >
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm">
                            <span className="text-white/50">Case #</span>
                            <span className="text-white/80 font-mono">{row.case_number ?? "—"}</span>
                            <span className="text-white/50">Date</span>
                            <span className="text-white/80">{row.incident_date}</span>
                          </div>
                          <div className="flex flex-col gap-1 text-xs sm:text-sm">
                            <span className="text-white/50">Employee</span>
                            <span className="text-white/70 break-words">{row.employee_name ?? "—"}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm">
                            <span className="text-white/50">Severity</span>
                            <span className="text-amber-300/90">{row.severity ?? "—"}</span>
                            <span className="text-white/50">Where</span>
                            <span className="text-white/60 break-words">{row.work_site_name ?? "—"}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm">
                            <span className="text-white/50">Job</span>
                            <span className="text-white/60 break-words">{row.job_name ?? "—"}</span>
                            <span className="text-white/50">Crew</span>
                            <span className="text-white/60">{row.crew_name ?? "—"}</span>
                            <span className="text-white/50">Supervisor</span>
                            <span className="text-white/60">{row.supervisor_name ?? "—"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden md:block w-full min-w-0 overflow-x-auto max-h-[40vh] sm:max-h-[50vh] overflow-y-auto border-t border-white/10">
                      <table className="w-full text-left text-sm min-w-[700px]">
                        <thead className="sticky top-0 bg-gray-900/95 z-10">
                          <tr className="border-b border-white/10 text-white/60">
                            <th className="p-1.5 sm:p-2 font-medium whitespace-nowrap">Case #</th>
                            <th className="p-1.5 sm:p-2 font-medium whitespace-nowrap">Date</th>
                            <th className="p-1.5 sm:p-2 font-medium whitespace-nowrap">Employee</th>
                            <th className="p-1.5 sm:p-2 font-medium whitespace-nowrap">Severity</th>
                            <th className="p-1.5 sm:p-2 font-medium whitespace-nowrap">Where</th>
                            <th className="p-1.5 sm:p-2 font-medium whitespace-nowrap">Job</th>
                            <th className="p-1.5 sm:p-2 font-medium whitespace-nowrap">Crew</th>
                            <th className="p-1.5 sm:p-2 font-medium whitespace-nowrap">Supervisor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incidentLogQuery.data.map((row, idx) => (
                            <tr
                              key={`${row.case_number ?? row.incident_date}-${idx}`}
                              className="border-b border-white/5 hover:bg-white/[0.02]"
                            >
                              <td className="p-1.5 sm:p-2 text-white/80 font-mono text-xs whitespace-nowrap">{row.case_number ?? "—"}</td>
                              <td className="p-1.5 sm:p-2 text-white/80 whitespace-nowrap">{row.incident_date}</td>
                              <td className="p-1.5 sm:p-2 text-white/70 max-w-[140px] truncate" title={row.employee_name ?? undefined}>{row.employee_name ?? "—"}</td>
                              <td className="p-1.5 sm:p-2 text-amber-300/90 whitespace-nowrap">{row.severity ?? "—"}</td>
                              <td className="p-1.5 sm:p-2 text-white/60 max-w-[120px] truncate" title={row.work_site_name ?? undefined}>{row.work_site_name ?? "—"}</td>
                              <td className="p-1.5 sm:p-2 text-white/60 max-w-[120px] truncate" title={row.job_name ?? undefined}>{row.job_name ?? "—"}</td>
                              <td className="p-1.5 sm:p-2 text-white/60 max-w-[100px] truncate" title={row.crew_name ?? undefined}>{row.crew_name ?? "—"}</td>
                              <td className="p-1.5 sm:p-2 text-white/60 max-w-[100px] truncate" title={row.supervisor_name ?? undefined}>{row.supervisor_name ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {tab === "weekly" && (
              <motion.div
                key="weekly"
                id="panel-weekly"
                role="tabpanel"
                aria-labelledby="tab-weekly"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden"
              >
                <div className="p-3 sm:p-4 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs sm:text-sm text-white/70">
                    Weekly Safety Audit Report runs (Friday 5 PM CST). Email + optional Google Sheets.
                  </span>
                  <button
                    type="button"
                    onClick={() => weeklyReportsQuery.refetch()}
                    disabled={weeklyReportsQuery.isFetching}
                    aria-label="Refresh weekly reports"
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs sm:text-sm text-white/80 disabled:opacity-50 min-h-[44px] sm:min-h-0"
                  >
                    <RefreshCw
                      className={cn("w-4 h-4", weeklyReportsQuery.isFetching && "animate-spin")}
                    />
                    Refresh
                  </button>
                </div>
                {weeklyReportsQuery.isLoading && (
                  <div className="flex items-center justify-center py-12 sm:py-16">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-amber-400" />
                  </div>
                )}
                {weeklyReportsQuery.error && (
                  <div className="p-4 sm:p-6 text-center text-red-400 text-sm">
                    {weeklyReportsQuery.error.message}
                  </div>
                )}
                {weeklyReportsQuery.data && weeklyReportsQuery.data.length === 0 && (
                  <div className="p-4 sm:p-6 text-center text-white/50 text-sm">
                    No weekly report runs yet. Reports are generated every Friday at 5 PM CST.
                  </div>
                )}
                {weeklyReportsQuery.data && weeklyReportsQuery.data.length > 0 && (
                  <>
                    <div className="md:hidden divide-y divide-white/5">
                      {weeklyReportsQuery.data.map((row) => {
                        const rd = row.report_data as {
                          compliance?: { dvirComplianceRate?: number; jsaComplianceRate?: number; equipmentComplianceRate?: number; activeUsers?: number };
                          incidents?: { totalIncidents?: number; oshaRecordable?: number };
                          certifications?: { certificationsCompleted?: number; certificationsExpiring?: number; certificationsOverdue?: number };
                        } | null;
                        const isExpanded = expandedWeeklyId === row.id;
                        return (
                          <div key={row.id} className="p-3 sm:p-4 space-y-2 border-b border-white/5 last:border-b-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                              <span className="text-white/80">
                                {row.week_start_date} → {row.week_end_date}
                              </span>
                              <span className="text-white/50">
                                {row.generated_at ? new Date(row.generated_at).toLocaleString() : "—"}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
                              {row.email_sent ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <Check className="w-3.5 h-3.5" /> Email sent
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-400">
                                  <X className="w-3.5 h-3.5" /> Email no
                                </span>
                              )}
                              {row.sheets_updated ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400">
                                  <Check className="w-3.5 h-3.5" /> Sheets
                                </span>
                              ) : (
                                <span className="text-white/50">Sheets —</span>
                              )}
                            </div>
                            {row.error && (
                              <p className="text-xs text-red-400/90 break-words">{row.error}</p>
                            )}
                            {rd && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setExpandedWeeklyId(isExpanded ? null : row.id)}
                                  className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
                                  aria-expanded={isExpanded}
                                  aria-label={isExpanded ? "Collapse report details" : "Expand report details"}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  {isExpanded ? "Hide" : "Show"} summary
                                </button>
                                {isExpanded && (
                                  <div className="grid grid-cols-2 gap-2 text-xs text-white/70 rounded-lg bg-white/5 p-3">
                                    {rd.compliance && (
                                      <>
                                        <span>DVIR: {rd.compliance.dvirComplianceRate ?? "—"}%</span>
                                        <span>JSA: {rd.compliance.jsaComplianceRate ?? "—"}%</span>
                                        <span>Equipment: {rd.compliance.equipmentComplianceRate ?? "—"}%</span>
                                        <span>Active users: {rd.compliance.activeUsers ?? "—"}</span>
                                      </>
                                    )}
                                    {rd.incidents && (
                                      <>
                                        <span>Incidents: {rd.incidents.totalIncidents ?? "—"}</span>
                                        <span>OSHA recordable: {rd.incidents.oshaRecordable ?? "—"}</span>
                                      </>
                                    )}
                                    {rd.certifications && (
                                      <>
                                        <span>Certs: {rd.certifications.certificationsCompleted ?? "—"}</span>
                                        <span>Expiring: {rd.certifications.certificationsExpiring ?? "—"}</span>
                                        <span>Overdue: {rd.certifications.certificationsOverdue ?? "—"}</span>
                                      </>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="hidden md:block w-full min-w-0 overflow-x-auto">
                      <table className="w-full text-left text-sm min-w-[520px]">
                        <thead className="bg-white/5">
                          <tr className="border-b border-white/10 text-white/60">
                            <th className="w-10 p-1.5 sm:p-2" aria-label="Expand" />
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Week</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Generated</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Email</th>
                            <th className="p-2 sm:p-3 font-medium whitespace-nowrap">Sheets</th>
                            <th className="p-2 sm:p-3 font-medium">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weeklyReportsQuery.data.map((row) => {
                            const rd = row.report_data as {
                              compliance?: { dvirComplianceRate?: number; jsaComplianceRate?: number; equipmentComplianceRate?: number; activeUsers?: number };
                              incidents?: { totalIncidents?: number; oshaRecordable?: number };
                              certifications?: { certificationsCompleted?: number; certificationsExpiring?: number; certificationsOverdue?: number };
                            } | null;
                            const isExpanded = expandedWeeklyId === row.id;
                            return (
                              <Fragment key={row.id}>
                                <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                                  <td className="p-1.5 sm:p-2">
                                    <button
                                      type="button"
                                      onClick={() => setExpandedWeeklyId(isExpanded ? null : row.id)}
                                      className="p-1.5 sm:p-1 rounded text-white/50 hover:text-white hover:bg-white/10 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                                      aria-expanded={isExpanded}
                                      aria-label={isExpanded ? "Collapse report details" : "Expand report details"}
                                    >
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                  </td>
                                  <td className="p-2 sm:p-3 text-white/80 whitespace-nowrap text-xs sm:text-sm">
                                    {row.week_start_date} → {row.week_end_date}
                                  </td>
                                  <td className="p-2 sm:p-3 text-white/70 text-xs whitespace-nowrap">
                                    {row.generated_at ? new Date(row.generated_at).toLocaleString() : "—"}
                                  </td>
                                  <td className="p-2 sm:p-3">
                                    {row.email_sent ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs sm:text-sm">
                                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Sent</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-amber-400 text-xs sm:text-sm">
                                        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">No</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 sm:p-3">
                                    {row.sheets_updated ? (
                                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs sm:text-sm">
                                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Yes</span>
                                      </span>
                                    ) : (
                                      <span className="text-white/50">—</span>
                                    )}
                                  </td>
                                  <td className="p-2 sm:p-3 text-red-400/90 max-w-[120px] sm:max-w-[200px] truncate text-xs sm:text-sm" title={row.error ?? undefined}>
                                    {row.error ?? "—"}
                                  </td>
                                </tr>
                                {isExpanded && rd && (
                                  <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <td colSpan={6} className="p-3 sm:p-4 text-xs text-white/70">
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                        {rd.compliance && (
                                          <>
                                            <span>DVIR: {rd.compliance.dvirComplianceRate ?? "—"}%</span>
                                            <span>JSA: {rd.compliance.jsaComplianceRate ?? "—"}%</span>
                                            <span>Equipment: {rd.compliance.equipmentComplianceRate ?? "—"}%</span>
                                            <span>Active users: {rd.compliance.activeUsers ?? "—"}</span>
                                          </>
                                        )}
                                        {rd.incidents && (
                                          <>
                                            <span>Incidents: {rd.incidents.totalIncidents ?? "—"}</span>
                                            <span>OSHA recordable: {rd.incidents.oshaRecordable ?? "—"}</span>
                                          </>
                                        )}
                                        {rd.certifications && (
                                          <>
                                            <span>Certs completed: {rd.certifications.certificationsCompleted ?? "—"}</span>
                                            <span>Expiring (30d): {rd.certifications.certificationsExpiring ?? "—"}</span>
                                            <span>Overdue: {rd.certifications.certificationsOverdue ?? "—"}</span>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
