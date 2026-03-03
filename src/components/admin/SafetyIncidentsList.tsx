/**
 * SafetyIncidentsList - Displays logged safety incidents with detail view
 *
 * Shows a list of safety incidents that admins can click on to view full details.
 */

import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useModalOverlay } from "../../hooks/useModalOverlay";
import {
  AlertTriangle,
  Calendar,
  MapPin,
  Users,
  FileText,
  ChevronRight,
  ChevronLeft,
  X,
  Clock,
  ShieldAlert,
  XCircle,
  Loader2,
  Download,
} from "lucide-react";
import { cn } from "../../lib/utils";
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
import { useDashboardCardTheme } from "../../contexts/dashboardCardTheme";

// ============================================================================
// TYPES
// ============================================================================

interface SafetyIncidentsListProps {
  onLogIncident: () => void;
  className?: string;
}

// OSHA 300 preview table columns
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
    color: "amber",
    bgClass: "bg-amber-500/20",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-300",
    dotClass: "bg-amber-400",
  },
  first_aid: {
    label: "First Aid",
    color: "blue",
    bgClass: "bg-blue-500/20",
    borderClass: "border-blue-500/30",
    textClass: "text-blue-300",
    dotClass: "bg-blue-400",
  },
  recordable: {
    label: "Recordable",
    color: "orange",
    bgClass: "bg-orange-500/20",
    borderClass: "border-orange-500/30",
    textClass: "text-orange-300",
    dotClass: "bg-orange-400",
  },
  lost_time: {
    label: "Lost Time",
    color: "red",
    bgClass: "bg-red-500/20",
    borderClass: "border-red-500/30",
    textClass: "text-red-300",
    dotClass: "bg-red-400",
  },
  fatality: {
    label: "Fatality",
    color: "red",
    bgClass: "bg-red-600/30",
    borderClass: "border-red-600/50",
    textClass: "text-red-200",
    dotClass: "bg-red-500",
  },
};

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
}

// ============================================================================
// SUB-COMPONENTS
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

  // Fetch employee names for involved users
  useEffect(() => {
    async function fetchEmployeeNames() {
      if (!incident.involved_user_ids || incident.involved_user_ids.length === 0) return;
      
      setLoadingEmployees(true);
      try {
        const { data } = await supabase
          .from('app_users')
          .select('user_id, full_name')
          .in('user_id', incident.involved_user_ids);
        
        if (data) {
          setInvolvedEmployees(data);
        }
      } catch (error) {
        logger.error('[SafetyIncidentsList] Error fetching employee names:', error);
      } finally {
        setLoadingEmployees(false);
      }
    }
    
    fetchEmployeeNames();
  }, [incident.involved_user_ids]);

  // Map user IDs to names
  const getEmployeeName = (userId: string): string => {
    const employee = involvedEmployees.find(e => e.user_id === userId);
    return employee?.full_name || `User: ${userId.slice(0, 8)}...`;
  };

  const { modalRef, zIndex } = useModalOverlay({ isOpen: true, onClose, zIndex: 100 });

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm"
      style={{ zIndex }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      aria-hidden
    >
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-detail-modal-title"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-md max-h-[85vh] overflow-hidden rounded-xl border",
          severityConfig.borderClass,
          "bg-gradient-to-br from-[#140a0a] via-[#0a0505] to-[#020205]"
        )}
      >
        {/* Compact Header */}
        <div className={cn("flex items-center justify-between px-3 py-2 border-b border-white/10", severityConfig.bgClass)}>
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-md", severityConfig.bgClass, severityConfig.textClass)}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 id="incident-detail-modal-title" className="text-xs font-semibold text-white">Incident Details</h2>
              <p className="text-[9px] text-white/50">ID: {incident.id.slice(0, 8)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            aria-label="Close incident details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Content */}
        <div className="p-3 overflow-y-auto max-h-[calc(85vh-48px)] space-y-3">
          {/* Top Info Row - Compact Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                severityConfig.bgClass,
                severityConfig.borderClass,
                severityConfig.textClass
              )}
            >
              <span className={cn("w-1 h-1 rounded-full", severityConfig.dotClass)} />
              {severityConfig.label}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70 border border-white/20">
              {INCIDENT_TYPE_LABELS[incident.incident_type] || incident.incident_type}
            </span>
            {incident.preventable && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-300 border border-red-500/20">
                <XCircle className="w-2.5 h-2.5" />
                Preventable
              </span>
            )}
            {incident.was_forecasted_high_risk && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                <ShieldAlert className="w-2.5 h-2.5" />
                High Risk
              </span>
            )}
          </div>

          {/* Date, Time, Location - Compact Grid */}
          <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-white/40 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[8px] text-white/40 uppercase">Date</p>
                <p className="text-[10px] text-white/80 font-medium truncate">{formatDate(incident.incident_date)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-white/40 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[8px] text-white/40 uppercase">Reported</p>
                <p className="text-[10px] text-white/80 font-medium truncate">{getRelativeTime(incident.reported_at)}</p>
              </div>
            </div>
            {incident.work_site_name && (
              <div className="flex items-center gap-1.5 col-span-2">
                <MapPin className="w-3 h-3 text-white/40 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[8px] text-white/40 uppercase">Site</p>
                  <p className="text-[10px] text-white/80 font-medium truncate">{incident.work_site_name}</p>
                </div>
              </div>
            )}
          </div>

          {/* Description - Compact */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="w-3 h-3 text-white/40" />
              <p className="text-[9px] text-white/40 uppercase font-medium">Description</p>
            </div>
            <p className="text-[10px] text-white/80 leading-relaxed bg-white/5 rounded-lg p-2 border border-white/10">
              {incident.description}
            </p>
          </div>

          {/* Contributing Factors - Compact */}
          {incident.contributing_factors && incident.contributing_factors.length > 0 && (
            <div>
              <p className="text-[9px] text-white/40 uppercase font-medium mb-1.5">Contributing Factors</p>
              <div className="flex flex-wrap gap-1">
                {incident.contributing_factors.map((factor) => (
                  <span
                    key={factor}
                    className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-red-500/10 text-red-300 border border-red-500/20"
                  >
                    {CONTRIBUTING_FACTOR_LABELS[factor] || factor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Involved Employees - Compact */}
          {incident.involved_user_ids && incident.involved_user_ids.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-3 h-3 text-white/40" />
                <p className="text-[9px] text-white/40 uppercase font-medium">
                  Involved ({incident.involved_user_ids.length})
                </p>
              </div>
              {loadingEmployees ? (
                <div className="flex items-center gap-1.5 text-white/40 text-[9px]">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {incident.involved_user_ids.map((userId) => (
                    <span
                      key={userId}
                      className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20"
                    >
                      {getEmployeeName(userId)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Calculate date range outside component to avoid render-time impure function calls
function getInitialDateRange() {
  const now = Date.now();
  const end = new Date(now).toISOString().split("T")[0];
  const start = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return { start, end };
}

const ITEMS_PER_PAGE = 5;

const LIST_CARD_BASE = "rounded-xl sm:rounded-2xl p-4 sm:p-5";
const LIST_CARD_COMPACT = "rounded-xl sm:rounded-2xl p-2.5 sm:p-3 overflow-visible";

export default function SafetyIncidentsList({ onLogIncident, className }: SafetyIncidentsListProps) {
  const { cardClass } = useDashboardCardTheme();
  const { user, role } = useAuth();
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncident | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showOsha300Preview, setShowOsha300Preview] = useState(false);
  const [osha300PreviewData, setOsha300PreviewData] = useState<{
    rows: Osha300Row[];
    dateTo: string;
  } | null>(null);
  const [osha300PreviewLoading, setOsha300PreviewLoading] = useState(false);

  // Fetch incidents for the last 90 days
  // Date range is calculated once per component instance via useState initializer
  const [dateRange] = useState(getInitialDateRange);

  const { data: incidents, isLoading, error } = useSafetyIncidents(dateRange);

  // Handler to change filter and reset page in one action (avoids useEffect anti-pattern)
  const handleFilterChange = (newSeverity: string) => {
    setFilterSeverity(newSeverity);
    setCurrentPage(1);
  };

  // Filter incidents
  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];
    if (filterSeverity === "all") return incidents;
    return incidents.filter((i) => i.severity === filterSeverity);
  }, [incidents, filterSeverity]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredIncidents.length / ITEMS_PER_PAGE);
  const paginatedIncidents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredIncidents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredIncidents, currentPage]);

  // Stats
  const stats = useMemo(() => {
    if (!incidents) return { total: 0, bySeverity: {} };
    const bySeverity: Record<string, number> = {};
    incidents.forEach((i) => {
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
    });
    return { total: incidents.length, bySeverity };
  }, [incidents]);

  if (isLoading) {
    return (
      <div className={cn(cardClass, LIST_CARD_BASE, className)}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-red-400" />
          <span className="ml-2 text-sm text-white/60">Loading incidents...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(cardClass, LIST_CARD_BASE, className)}>
        <div className="flex items-center justify-center py-8 text-red-400">
          <AlertTriangle className="w-5 h-5 mr-2" />
          Failed to load incidents
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn(cardClass, LIST_CARD_COMPACT, className)}>
        {/* Row 1: Icon + Title at top */}
        <div className="flex items-center gap-2 mb-2 overflow-visible">
          <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0 overflow-visible">
            <img 
              src="/assets/safety-incidents.png" 
              alt="" 
              className="absolute left-0 top-1/2 -translate-y-1/2 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]" 
              style={{ width: 52, height: 64, minWidth: 52, minHeight: 64 }}
            />
          </div>
          <div className="min-w-0 flex-1 ml-6">
            <h3 className="text-xs sm:text-sm font-semibold text-white truncate">Safety Incidents</h3>
            <p className="text-[9px] text-white/50">{stats.total} logged</p>
          </div>
        </div>

        {/* Row 2: Export + Log buttons */}
        <div className="flex items-center gap-1.5 mb-2">
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
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-[9px] font-medium text-white/70 disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-400/50"
          >
            <Download className="w-2.5 h-2.5" aria-hidden />
            OSHA 300
          </button>
          <button
            type="button"
            onClick={onLogIncident}
            aria-label="Log new safety incident"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[9px] font-medium transition-colors"
          >
            Log Incident
          </button>
        </div>

        {/* Row 3: Filter pills */}
        {stats.total > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {Object.entries(SEVERITY_CONFIG).map(([key, config]) => {
              const count = stats.bySeverity[key] || 0;
              return (
                <button
                  key={key}
                  onClick={() => handleFilterChange(filterSeverity === key ? "all" : key)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all",
                    filterSeverity === key
                      ? cn(config.bgClass, config.borderClass, config.textClass)
                      : count > 0
                      ? "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                      : "bg-white/5 border-white/5 text-white/30"
                  )}
                >
                  {config.label}
                  <span className="ml-0.5 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Compact Incidents List */}
        {filteredIncidents.length === 0 ? (
          <div className="text-center py-4">
            <AlertTriangle className="w-5 h-5 text-white/20 mx-auto mb-1" />
            <p className="text-[10px] text-white/40">
              {stats.total === 0 ? "No incidents logged" : "No matches"}
            </p>
            {stats.total === 0 && (
              <button
                onClick={onLogIncident}
                className="mt-1.5 text-[9px] text-red-400 hover:text-red-300 transition-colors"
              >
                Log first incident
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {paginatedIncidents.map((incident) => {
              const severityConfig = SEVERITY_CONFIG[incident.severity];
              return (
                <motion.button
                  key={incident.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSelectedIncident(incident)}
                  className="w-full flex items-center justify-between p-1.5 rounded-md border bg-white/5 border-white/10 hover:bg-white/10 text-left transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", severityConfig.dotClass)} />
                    <span className={cn("text-[9px] font-medium flex-shrink-0", severityConfig.textClass)}>
                      {severityConfig.label}
                    </span>
                    <p className="text-[9px] text-white/50 truncate">
                      {incident.description}
                    </p>
                  </div>
                  <ChevronRight className="w-2.5 h-2.5 text-white/30 flex-shrink-0 ml-1" />
                </motion.button>
              );
            })}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    currentPage === 1
                      ? "text-white/30 cursor-not-allowed"
                      : "text-white/60 hover:text-white hover:bg-white/10"
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
                        "w-6 h-6 rounded text-[10px] font-medium transition-colors",
                        page === currentPage
                          ? "bg-red-500/30 text-red-300 border border-red-500/40"
                          : "text-white/50 hover:text-white hover:bg-white/10"
                      )}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    currentPage === totalPages
                      ? "text-white/30 cursor-not-allowed"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                >
                  Next
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Items indicator */}
            {filteredIncidents.length > ITEMS_PER_PAGE && (
              <p className="text-[9px] text-white/40 text-center">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredIncidents.length)} of {filteredIncidents.length}
              </p>
            )}
          </div>
        )}
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

      {/* OSHA 300 Preview Modal — preview report before downloading or closing */}
      {showOsha300Preview &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowOsha300Preview(false);
                  setOsha300PreviewData(null);
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-red-500/30 bg-gradient-to-br from-[#140a0a] via-[#0a0505] to-[#020205] shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div>
                    <h3 className="text-base font-semibold text-white">OSHA 300 Log Preview</h3>
                    <p className="text-[10px] text-white/50 mt-0.5">
                      Review the report below, then download CSV or close.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowOsha300Preview(false);
                      setOsha300PreviewData(null);
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                    aria-label="Close preview"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-auto min-h-0 p-4">
                  {osha300PreviewLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/60">
                      <Loader2 className="w-8 h-8 animate-spin text-red-400 mb-3" />
                      <span className="text-sm">Loading OSHA 300 log...</span>
                    </div>
                  ) : osha300PreviewData?.rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/50 text-center max-w-sm mx-auto">
                      <FileText className="w-10 h-10 mb-3 opacity-50" />
                      <p className="text-sm font-medium text-white/70">No recordable incidents in the last 366 days</p>
                      <p className="text-xs mt-2">
                        The OSHA 300 log only includes <strong className="text-white/60">Recordable</strong>, <strong className="text-white/60">Lost Time</strong>, and <strong className="text-white/60">Fatality</strong>. Near-miss and first-aid are not listed here.
                      </p>
                      <p className="text-[10px] mt-3 text-white/40">You can still download a CSV with headers.</p>
                    </div>
                  ) : osha300PreviewData ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-white/60">
                            {OSHA_300_PREVIEW_COLUMNS.map((col) => (
                              <th key={col.key} className="py-2 px-2 font-medium whitespace-nowrap">
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {osha300PreviewData.rows.map((row, idx) => (
                            <tr
                              key={row.case_number ?? idx}
                              className="border-b border-white/5 hover:bg-white/[0.02]"
                            >
                              {OSHA_300_PREVIEW_COLUMNS.map((col) => (
                                <td key={col.key} className="py-2 px-2 text-white/80 max-w-[180px] truncate" title={String(row[col.key] ?? "")}>
                                  {row[col.key] != null ? String(row[col.key]) : "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10 bg-black/20">
                  <button
                    type="button"
                    onClick={() => {
                      setShowOsha300Preview(false);
                      setOsha300PreviewData(null);
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:pointer-events-none"
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
