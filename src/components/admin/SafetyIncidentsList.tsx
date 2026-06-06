/**
 * SafetyIncidentsList - Premium collapsible safety incidents card
 *
 * Double-Bezel (Doppelrand) architecture with consistent red/danger theme.
 * Compact by default with expand toggle to reveal full incident list.
 * Used on Admin, Safety Officer, and General Foreman dashboards.
 */

import { useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  MapPin,
  Users,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  X,
  Clock,
  ShieldAlert,
  XCircle,
  Loader2,
  Download,
  Plus,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { glass } from "../../lib/glass";
import { supabase } from "../../lib/supabaseClient";
import { logger } from "../../lib/logger";
import { toast } from "../../lib/toast";
import { useSafetyIncidents, type SafetyIncident } from "../../hooks/queries/useRiskCalibration";
import {
  fetchOsha300Rows,
  downloadOsha300CsvFromRows,
  type Osha300Row,
} from "../../lib/osha300Export";
import { logReportExported } from "../../lib/safetyAuditLog";
import { useAuth } from "../../contexts/AuthContext";
import { useModalOverlay } from "../../hooks/useModalOverlay";
import { Z } from "@/lib/zIndex";

// ============================================================================
// TYPES
// ============================================================================

interface SafetyIncidentsListProps {
  onLogIncident: () => void;
  className?: string;
}

const OSHA_300_PREVIEW_COLUMNS: { key: keyof Osha300Row; label: string }[] = [
  { key: "case_number", label: "Case #" },
  { key: "employee_name", label: "Employee" },
  { key: "job_title", label: "Job Title" },
  { key: "date_of_injury", label: "Date of Injury" },
  { key: "where_event_occurred", label: "Where Occurred" },
  { key: "classification", label: "Classification" },
  { key: "days_away", label: "Days Away" },
  { key: "days_restricted", label: "Days Restricted" },
  { key: "reported_at", label: "Reported At" },
];

// ============================================================================
// CONSTANTS
// ============================================================================

const SEVERITY_CONFIG = {
  near_miss: {
    label: "Near Miss",
    bgClass: "bg-amber-500/15",
    borderClass: "border-amber-500/25",
    textClass: "text-amber-300",
    dotClass: "bg-amber-400",
    glowClass: "shadow-[0_0_8px_rgba(245,158,11,0.15)]",
  },
  first_aid: {
    label: "First Aid",
    bgClass: "bg-sky-500/15",
    borderClass: "border-sky-500/25",
    textClass: "text-sky-300",
    dotClass: "bg-sky-400",
    glowClass: "shadow-[0_0_8px_rgba(14,165,233,0.15)]",
  },
  recordable: {
    label: "Recordable",
    bgClass: "bg-orange-500/15",
    borderClass: "border-orange-500/25",
    textClass: "text-orange-300",
    dotClass: "bg-orange-400",
    glowClass: "shadow-[0_0_8px_rgba(249,115,22,0.15)]",
  },
  lost_time: {
    label: "Lost Time",
    bgClass: "bg-red-500/15",
    borderClass: "border-red-500/25",
    textClass: "text-red-300",
    dotClass: "bg-red-400",
    glowClass: "shadow-[0_0_8px_rgba(239,68,68,0.15)]",
  },
  fatality: {
    label: "Fatality",
    bgClass: "bg-red-600/20",
    borderClass: "border-red-600/40",
    textClass: "text-red-200",
    dotClass: "bg-red-500",
    glowClass: "shadow-[0_0_12px_rgba(220,38,38,0.25)]",
  },
} as const;

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  fall: "Fall",
  struck_by: "Struck By",
  caught_in: "Caught In/Between",
  electrical: "Electrical",
  vehicle: "Vehicle",
  equipment: "Equipment",
  environmental: "Environmental",
  other: "Other",
};

const CONTRIBUTING_FACTOR_LABELS: Record<string, string> = {
  inadequate_training: "Inadequate Training",
  equipment_failure: "Equipment Failure",
  weather: "Weather Conditions",
  supervision: "Lack of Supervision",
  procedure_violation: "Procedure Violation",
  fatigue: "Fatigue",
  communication: "Communication Failure",
  housekeeping: "Poor Housekeeping",
  ppe: "PPE Issues",
  other: "Other",
};

// Spring config for expand/collapse
const springTransition = { type: "spring" as const, stiffness: 300, damping: 30 };
const itemSpring = { type: "spring" as const, stiffness: 400, damping: 35 };

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(dateString);
}

// ============================================================================
// INCIDENT DETAIL MODAL
// ============================================================================

function IncidentDetailModal({
  incident,
  onClose,
}: {
  incident: SafetyIncident;
  onClose: () => void;
}) {
  const severityConfig = SEVERITY_CONFIG[incident.severity];
  const [involvedEmployees, setInvolvedEmployees] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useState(() => {
    if (!incident.involved_user_ids || incident.involved_user_ids.length === 0) return;
    setLoadingEmployees(true);
    supabase
      .from("app_users")
      .select("user_id, full_name")
      .in("user_id", incident.involved_user_ids)
      .then(({ data, error }) => {
        if (error) logger.error("[SafetyIncidentsList] Error fetching employee names:", error);
        else if (data) setInvolvedEmployees(data);
        setLoadingEmployees(false);
      });
  });

  const getEmployeeName = (userId: string): string => {
    const employee = involvedEmployees.find((e) => e.user_id === userId);
    return employee?.full_name || `User: ${userId.slice(0, 8)}...`;
  };

  const { modalRef, zIndex } = useModalOverlay({ isOpen: true, onClose, zIndex: 100 });

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm"
      style={{ zIndex }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-detail-modal-title"
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className={cn("w-full max-w-md max-h-[85vh] overflow-hidden", glass.incidentModal)}
      >
        {/* Header — severity-tinted bar */}
        <div className={cn(
          "flex items-center justify-between px-4 py-3 border-b border-red-500/10",
          "bg-gradient-to-r from-red-500/[0.08] to-transparent"
        )}>
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              severityConfig.bgClass, severityConfig.glowClass
            )}>
              <AlertTriangle className={cn("w-4 h-4", severityConfig.textClass)} />
            </div>
            <div>
              <h2 id="incident-detail-modal-title" className="text-sm font-semibold text-white tracking-tight">
                Incident Details
              </h2>
              <p className="text-[10px] text-white/40 font-mono tabular-nums">
                {incident.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all duration-200 active:scale-95"
            aria-label="Close incident details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-56px)] space-y-3">
          {/* Severity + Type badges */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, ...itemSpring }}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border",
              severityConfig.bgClass, severityConfig.borderClass, severityConfig.textClass, severityConfig.glowClass
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", severityConfig.dotClass)} />
              {severityConfig.label}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.06] text-white/60 border border-white/[0.08]">
              {INCIDENT_TYPE_LABELS[incident.incident_type] || incident.incident_type}
            </span>
            {incident.preventable && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-300 border border-red-500/15">
                <XCircle className="w-3 h-3" />
                Preventable
              </span>
            )}
            {incident.was_forecasted_high_risk && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/15">
                <ShieldAlert className="w-3 h-3" />
                High Risk
              </span>
            )}
          </motion.div>

          {/* Date / Time / Location — inner panel */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, ...itemSpring }}
            className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium">Date</p>
                <p className="text-[11px] text-white/80 font-medium tabular-nums">{formatDate(incident.incident_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium">Reported</p>
                <p className="text-[11px] text-white/80 font-medium">{getRelativeTime(incident.reported_at)}</p>
              </div>
            </div>
            {incident.work_site_name && (
              <div className="flex items-center gap-2 col-span-2">
                <MapPin className="w-3.5 h-3.5 text-red-400/60 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[9px] text-white/35 uppercase tracking-wider font-medium">Work Site</p>
                  <p className="text-[11px] text-white/80 font-medium truncate">{incident.work_site_name}</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, ...itemSpring }}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-white/30" />
              <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Description</p>
            </div>
            <p className="text-[12px] text-white/75 leading-relaxed bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
              {incident.description}
            </p>
          </motion.div>

          {/* Contributing Factors */}
          {incident.contributing_factors && incident.contributing_factors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...itemSpring }}
            >
              <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium mb-2">Contributing Factors</p>
              <div className="flex flex-wrap gap-1.5">
                {incident.contributing_factors.map((factor) => (
                  <span
                    key={factor}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-red-500/8 text-red-300/80 border border-red-500/15"
                  >
                    {CONTRIBUTING_FACTOR_LABELS[factor] || factor}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Involved Employees */}
          {incident.involved_user_ids && incident.involved_user_ids.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, ...itemSpring }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-white/30" />
                <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium">
                  Involved ({incident.involved_user_ids.length})
                </p>
              </div>
              {loadingEmployees ? (
                <div className="flex items-center gap-1.5 text-white/40 text-[10px]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {incident.involved_user_ids.map((userId) => (
                    <span
                      key={userId}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-sky-500/8 text-sky-300/80 border border-sky-500/15"
                    >
                      {getEmployeeName(userId)}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

// ============================================================================
// SEVERITY DOT BAR — visual summary of severity distribution
// ============================================================================

function SeverityDotBar({ bySeverity, total }: { bySeverity: Record<string, number>; total: number }) {
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-0.5 h-1.5 rounded-full overflow-hidden bg-white/[0.04] flex-1 max-w-[120px]">
      {Object.entries(SEVERITY_CONFIG).map(([key, config]) => {
        const count = bySeverity[key] || 0;
        if (count === 0) return null;
        const widthPercent = Math.max((count / total) * 100, 6);
        return (
          <motion.div
            key={key}
            initial={{ width: 0 }}
            animate={{ width: `${widthPercent}%` }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className={cn("h-full rounded-full", config.dotClass)}
            title={`${config.label}: ${count}`}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function getInitialDateRange() {
  const now = Date.now();
  const end = new Date(now).toISOString().split("T")[0];
  const start = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return { start, end };
}

const ITEMS_PER_PAGE = 5;

export default function SafetyIncidentsList({ onLogIncident, className }: SafetyIncidentsListProps) {
  const { user, role } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncident | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showOsha300Preview, setShowOsha300Preview] = useState(false);
  const [osha300PreviewData, setOsha300PreviewData] = useState<{ rows: Osha300Row[]; dateTo: string } | null>(null);
  const [osha300PreviewLoading, setOsha300PreviewLoading] = useState(false);

  const [dateRange] = useState(getInitialDateRange);
  const { data: incidents, isLoading, error } = useSafetyIncidents(dateRange);

  const handleFilterChange = useCallback((newSeverity: string) => {
    setFilterSeverity(newSeverity);
    setCurrentPage(1);
  }, []);

  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];
    if (filterSeverity === "all") return incidents;
    return incidents.filter((i) => i.severity === filterSeverity);
  }, [incidents, filterSeverity]);

  const totalPages = Math.ceil(filteredIncidents.length / ITEMS_PER_PAGE);
  const paginatedIncidents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredIncidents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredIncidents, currentPage]);

  const stats = useMemo(() => {
    if (!incidents) return { total: 0, bySeverity: {} as Record<string, number> };
    const bySeverity: Record<string, number> = {};
    incidents.forEach((i) => { bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1; });
    return { total: incidents.length, bySeverity };
  }, [incidents]);

  const latestIncident = incidents?.[0] ?? null;

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(glass.incidentOuter, className)}>
        <div className={cn(glass.incidentInner, "p-5")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" />
              <div className="h-2 w-20 rounded bg-white/[0.04] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn(glass.incidentOuter, className)}>
        <div className={cn(glass.incidentInner, "p-5")}>
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Failed to load incidents</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Double-Bezel Outer Shell */}
      <div className={cn(glass.incidentOuter, "relative group", className)}>
        {/* Ambient border glow */}
        <div className="absolute inset-0 rounded-[1.25rem] bg-gradient-to-br from-red-500/[0.06] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        {/* Inner Core */}
        <div className={cn(glass.incidentInner, "relative overflow-hidden")}>
          {/* Subtle top-edge highlight */}
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-red-400/15 to-transparent pointer-events-none" />

          {/* Header — always visible */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center gap-3">
              {/* Severity indicator */}
              <div className="relative flex-shrink-0">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  "bg-gradient-to-br from-red-500/20 to-red-600/10",
                  "border border-red-500/15",
                  stats.total > 0 && "animate-incident-pulse"
                )}>
                  <AlertTriangle className="w-4.5 h-4.5 text-red-400" />
                </div>
                {stats.total > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center ring-2 ring-[#0d0505] tabular-nums">
                    {stats.total > 99 ? "99+" : stats.total}
                  </span>
                )}
              </div>

              {/* Title + summary */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] sm:text-sm font-semibold text-white tracking-tight">
                    Safety Incidents
                  </h3>
                  <SeverityDotBar bySeverity={stats.bySeverity} total={stats.total} />
                </div>
                <p className="text-[10px] text-white/40 mt-0.5 font-medium tabular-nums">
                  {stats.total === 0
                    ? "No incidents in 90 days"
                    : `${stats.total} logged \u00b7 Last 90 days`}
                </p>
              </div>

              {/* Expand toggle */}
              <motion.button
                onClick={() => setExpanded((v) => !v)}
                className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors active:scale-95"
                aria-label={expanded ? "Collapse incidents" : "Expand incidents"}
                aria-expanded={expanded}
              >
                <motion.div
                  animate={{ rotate: expanded ? 180 : 0 }}
                  transition={springTransition}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </motion.button>
            </div>

            {/* Quick actions row + latest incident preview (collapsed) */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={async () => {
                  setOsha300PreviewLoading(true);
                  setShowOsha300Preview(true);
                  try {
                    const { rows, dateTo } = await fetchOsha300Rows();
                    setOsha300PreviewData({ rows, dateTo });
                  } catch (e) {
                    logger.error("[SafetyIncidentsList] OSHA 300 fetch failed", e);
                    toast.error("Could not load report", (e as Error)?.message ?? "Failed to load OSHA 300 log");
                    setShowOsha300Preview(false);
                  } finally {
                    setOsha300PreviewLoading(false);
                  }
                }}
                disabled={osha300PreviewLoading}
                aria-label="Preview and export OSHA 300 log (CSV)"
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 active:scale-[0.97]",
                  "bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white/70 hover:bg-white/[0.07] hover:border-white/[0.12]",
                  "disabled:opacity-40 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-400/40"
                )}
              >
                <Download className="w-3 h-3" aria-hidden />
                OSHA 300
              </button>

              <button
                type="button"
                onClick={onLogIncident}
                aria-label="Log new safety incident"
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 active:scale-[0.97]",
                  "bg-red-500/15 border border-red-500/20 text-red-300 hover:bg-red-500/25 hover:border-red-500/30",
                  "shadow-[0_0_12px_rgba(239,68,68,0.08)]"
                )}
              >
                <Plus className="w-3 h-3" aria-hidden />
                Log Incident
              </button>

              {/* Latest incident preview (collapsed only) */}
              {!expanded && latestIncident && (
                <motion.button
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, ...itemSpring }}
                  onClick={() => setSelectedIncident(latestIncident)}
                  className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors text-left"
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", SEVERITY_CONFIG[latestIncident.severity].dotClass)} />
                  <span className="text-[10px] text-white/50 truncate">{latestIncident.description}</span>
                  <ChevronRight className="w-2.5 h-2.5 text-white/25 flex-shrink-0 ml-auto" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Expandable Content */}
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="expanded-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={springTransition}
                className="overflow-hidden"
              >
                <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 space-y-3">
                  {/* Separator */}
                  <div className="h-px bg-gradient-to-r from-transparent via-red-500/15 to-transparent" />

                  {/* Severity breakdown chips */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, ...itemSpring }}
                    className="grid grid-cols-5 gap-1.5"
                  >
                    {Object.entries(SEVERITY_CONFIG).map(([key, config]) => {
                      const count = stats.bySeverity[key] || 0;
                      return (
                        <button
                          key={key}
                          onClick={() => handleFilterChange(filterSeverity === key ? "all" : key)}
                          className={cn(
                            "flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border transition-all duration-200 active:scale-[0.97]",
                            filterSeverity === key
                              ? cn(config.bgClass, config.borderClass, config.glowClass)
                              : count > 0
                              ? "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.1]"
                              : "bg-white/[0.02] border-white/[0.03] opacity-40"
                          )}
                        >
                          <span className={cn(
                            "text-sm font-bold tabular-nums leading-none",
                            filterSeverity === key ? config.textClass : count > 0 ? "text-white/70" : "text-white/30"
                          )}>
                            {count}
                          </span>
                          <span className={cn(
                            "text-[8px] font-medium tracking-wide leading-none",
                            filterSeverity === key ? config.textClass : "text-white/35"
                          )}>
                            {config.label.split(" ")[0]}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>

                  {/* Incident list */}
                  {filteredIncidents.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-center py-6"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/[0.03] mx-auto mb-2 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-white/15" />
                      </div>
                      <p className="text-[11px] text-white/35 font-medium">
                        {stats.total === 0 ? "No incidents logged in 90 days" : "No incidents match this filter"}
                      </p>
                      {stats.total === 0 && (
                        <button
                          onClick={onLogIncident}
                          className="mt-2 text-[10px] font-semibold text-red-400/70 hover:text-red-300 transition-colors"
                        >
                          Log the first incident
                        </button>
                      )}
                    </motion.div>
                  ) : (
                    <div className="space-y-1.5">
                      {paginatedIncidents.map((incident, idx) => {
                        const sc = SEVERITY_CONFIG[incident.severity];
                        return (
                          <motion.button
                            key={incident.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 + idx * 0.03, ...itemSpring }}
                            onClick={() => setSelectedIncident(incident)}
                            className={cn(
                              "w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all duration-200",
                              "bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1]",
                              "active:scale-[0.99] group/item"
                            )}
                          >
                            {/* Severity dot + label */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className={cn("w-2 h-2 rounded-full", sc.dotClass, sc.glowClass)} />
                              <span className={cn("text-[10px] font-semibold w-[52px]", sc.textClass)}>
                                {sc.label.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")}
                              </span>
                            </div>

                            {/* Description */}
                            <p className="text-[11px] text-white/50 truncate flex-1 min-w-0 group-hover/item:text-white/65 transition-colors">
                              {incident.description}
                            </p>

                            {/* Date */}
                            <span className="text-[9px] text-white/30 font-medium tabular-nums flex-shrink-0">
                              {getRelativeTime(incident.reported_at)}
                            </span>

                            <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0 group-hover/item:text-white/40 group-hover/item:translate-x-0.5 transition-all" />
                          </motion.button>
                        );
                      })}

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="flex items-center justify-between pt-2 border-t border-white/[0.05]"
                        >
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 active:scale-[0.97]",
                              currentPage === 1
                                ? "text-white/20 cursor-not-allowed"
                                : "text-white/50 hover:text-white/70 hover:bg-white/[0.05]"
                            )}
                          >
                            <ChevronLeft className="w-3 h-3" />
                            Prev
                          </button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={cn(
                                  "w-6 h-6 rounded-lg text-[10px] font-semibold transition-all duration-200 tabular-nums",
                                  page === currentPage
                                    ? "bg-red-500/20 text-red-300 border border-red-500/25 shadow-[0_0_8px_rgba(239,68,68,0.1)]"
                                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.05]"
                                )}
                              >
                                {page}
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 active:scale-[0.97]",
                              currentPage === totalPages
                                ? "text-white/20 cursor-not-allowed"
                                : "text-white/50 hover:text-white/70 hover:bg-white/[0.05]"
                            )}
                          >
                            Next
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </motion.div>
                      )}

                      {/* Items indicator */}
                      {filteredIncidents.length > ITEMS_PER_PAGE && (
                        <p className="text-[9px] text-white/25 text-center font-medium tabular-nums">
                          {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredIncidents.length)} of {filteredIncidents.length}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedIncident && (
          <IncidentDetailModal
            incident={selectedIncident}
            onClose={() => setSelectedIncident(null)}
          />
        )}
      </AnimatePresence>

      {/* OSHA 300 Preview Modal */}
      {showOsha300Preview &&
        createPortal(
          <AnimatePresence>
            <motion.div style={{ zIndex: Z.modal }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowOsha300Preview(false);
                  setOsha300PreviewData(null);
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className={cn("w-full max-w-4xl max-h-[90vh] flex flex-col", glass.incidentModal)}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className={cn(
                  "flex items-center justify-between px-5 py-4 border-b border-red-500/10",
                  "bg-gradient-to-r from-red-500/[0.06] to-transparent"
                )}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/15 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">OSHA 300 Log Preview</h3>
                      <p className="text-[10px] text-white/40 mt-0.5">Review before downloading</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOsha300Preview(false);
                      setOsha300PreviewData(null);
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all duration-200 active:scale-95"
                    aria-label="Close preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto min-h-0 p-5">
                  {osha300PreviewLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-white/50">
                      <Loader2 className="w-8 h-8 animate-spin text-red-400/60 mb-4" />
                      <span className="text-sm font-medium">Loading OSHA 300 log...</span>
                    </div>
                  ) : osha300PreviewData?.rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-white/40 text-center max-w-sm mx-auto">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
                        <FileText className="w-7 h-7 opacity-30" />
                      </div>
                      <p className="text-sm font-semibold text-white/60 mb-2">No recordable incidents</p>
                      <p className="text-xs leading-relaxed">
                        The OSHA 300 log only includes <strong className="text-white/50">Recordable</strong>, <strong className="text-white/50">Lost Time</strong>, and <strong className="text-white/50">Fatality</strong> incidents from the last 366 days.
                      </p>
                      <p className="text-[10px] mt-3 text-white/30">You can still download a CSV with headers.</p>
                    </div>
                  ) : osha300PreviewData ? (
                    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                            {OSHA_300_PREVIEW_COLUMNS.map((col) => (
                              <th key={col.key} className="py-2.5 px-3 font-semibold text-white/50 whitespace-nowrap text-[11px] uppercase tracking-wider">
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {osha300PreviewData.rows.map((row, idx) => (
                            <motion.tr
                              key={row.case_number ?? idx}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: idx * 0.02 }}
                              className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                            >
                              {OSHA_300_PREVIEW_COLUMNS.map((col) => (
                                <td key={col.key} className="py-2.5 px-3 text-white/70 max-w-[180px] truncate tabular-nums" title={String(row[col.key] ?? "")}>
                                  {row[col.key] != null ? String(row[col.key]) : "\u2014"}
                                </td>
                              ))}
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06] bg-black/20">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOsha300Preview(false);
                      setOsha300PreviewData(null);
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-all duration-200 active:scale-[0.98]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={!osha300PreviewData}
                    onClick={() => {
                      if (osha300PreviewData) {
                        downloadOsha300CsvFromRows(osha300PreviewData.rows, osha300PreviewData.dateTo);
                        toast.success("OSHA 300 log downloaded");
                        logReportExported(
                          {
                            reportType: "osha_300",
                            format: "csv",
                            dateTo: osha300PreviewData.dateTo,
                            totalRecords: osha300PreviewData.rows.length,
                          },
                          { userId: user?.id, role: role ?? undefined }
                        ).catch((e) => {
                          logger.error("[SafetyIncidentsList] OSHA 300 export audit log failed", e);
                        });
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]",
                      "bg-red-500/15 text-red-300 border border-red-500/20 hover:bg-red-500/25",
                      "shadow-[0_0_16px_rgba(239,68,68,0.1)]",
                      "disabled:opacity-40 disabled:pointer-events-none"
                    )}
                  >
                    <Download className="w-4 h-4" />
                    Download CSV
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
