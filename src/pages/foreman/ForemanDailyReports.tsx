import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  MapPin,
  Plus,
  Ruler,
  TrendingUp,
  Users,
  Wrench,
  Zap,
  Activity,
  Check,
  User,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { cn } from "../../lib/utils";
import { logger } from "../../lib/logger";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { ScrollReveal } from "../../motion";
import { toast } from "../../lib/toast";
import {
  SPAN_LENGTH_PRESETS,
  type Equipment,
  type JobProgressTracker,
  type JobProgressUpdate,
  type JobProgressUpdateFormData,
} from "../../types/jobs";
import { getTodayDateString, formatDateForDisplay } from "../../lib/jobProgressUtils";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
} from "date-fns";

// ============================================================================
// Types & Constants
// ============================================================================

type DateRangeOption = "today" | "last7" | "last30" | "all";
type ViewTab = "submit" | "history" | "analytics";

interface EnrichedUpdate extends JobProgressUpdate {
  job_name?: string;
}

interface JobAnalytics {
  jobId: string;
  jobName: string;
  circuit: string | null;
  totalSpans: number;
  totalFeet: number;
  reportsCount: number;
  avgSpansPerReport: number;
  equipmentBreakdown: Record<string, { spans: number; feet: number }>;
  lastReportDate: string | null;
}

const PAGE_SIZE = 6;

// Blue theme input styling
const baseInput =
  "w-full bg-[#020810]/80 border border-[#3b82f6]/25 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/40 disabled:opacity-50 disabled:cursor-not-allowed min-h-[42px] touch-manipulation transition-all";

const labelClass =
  "text-[10px] uppercase tracking-widest text-[#bfdbfe]/60 flex items-center gap-1.5 mb-1 font-medium";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 500,
      damping: 30,
    },
  },
};

// ============================================================================
// Submit Form Component
// ============================================================================

interface SubmitFormProps {
  assignedJobs: JobProgressTracker[];
  onSubmitSuccess: () => void;
}

function SubmitProgressForm({ assignedJobs, onSubmitSuccess }: SubmitFormProps) {
  const { user } = useAuth();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [formData, setFormData] = useState<JobProgressUpdateFormData>({
    date: getTodayDateString(),
    spans_completed: 1,
    span_length_category: "general",
    equipment: "bucket",
    job_title: "Foreman",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => assignedJobs.find((j) => j.id === selectedJobId),
    [assignedJobs, selectedJobId]
  );

  const userFullName =
    (user?.user_metadata as Record<string, string | undefined>)?.full_name ||
    (user?.user_metadata as Record<string, string | undefined>)?.name ||
    "Unknown User";
  const userEmail = user?.email || "unknown@atts.com";

  const spanLengthFeet = useMemo(() => {
    return SPAN_LENGTH_PRESETS[formData.span_length_category];
  }, [formData.span_length_category]);

  const totalFeet = useMemo(
    () => spanLengthFeet * Math.max(0, formData.spans_completed),
    [spanLengthFeet, formData.spans_completed]
  );

  const validate = (): boolean => {
    if (!user?.id) {
      toast.error("You must be signed in to submit progress");
      return false;
    }
    if (!selectedJobId) {
      setError("Please select a job");
      return false;
    }
    if (!formData.date) {
      setError("Date is required");
      return false;
    }
    if (!formData.spans_completed || formData.spans_completed <= 0) {
      setError("Spans completed must be > 0");
      return false;
    }
    if (!formData.job_title.trim()) {
      setError("Role is required");
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !selectedJob) return;

    setSubmitting(true);
    setError(null);

    const payload = {
      job_id: selectedJobId,
      user_id: user?.id,
      full_name: userFullName,
      email: userEmail,
      circuit: selectedJob.circuit || selectedJob.job_location || "",
      date: formData.date,
      spans_completed: formData.spans_completed,
      span_length_feet: spanLengthFeet,
      span_length_category: formData.span_length_category,
      equipment: formData.equipment,
      job_title: formData.job_title,
      notes: formData.notes || null,
    };

    const { error: insertError } = await supabase.from("job_progress_updates").insert(payload);

    if (insertError) {
      logger.error("Progress update error:", insertError);
      if (insertError.code === "23503") {
        toast.error("Job no longer exists");
      } else if (insertError.code === "42501") {
        toast.error("No permission to update");
      } else {
        toast.error(`Failed: ${insertError.message}`);
      }
      setSubmitting(false);
      return;
    }

    toast.success("Progress report submitted!");
    setFormData({
      date: getTodayDateString(),
      spans_completed: 1,
      span_length_category: "general",
      equipment: "bucket",
      job_title: "Foreman",
      notes: "",
    });
    setSubmitting(false);
    onSubmitSuccess();
  };

  const equipmentOptions: { value: Equipment; label: string }[] = [
    { value: "jerraff", label: "Jarraff" },
    { value: "bucket", label: "Bucket" },
    { value: "mulcher", label: "Mulcher" },
  ];

  // Filter to span-based jobs only
  const spanBasedJobs = useMemo(
    () => assignedJobs.filter((j) => j.tracking_type === "job_progress"),
    [assignedJobs]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 via-[#060d18]/90 to-[#020408]/90 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3b82f6]/15 bg-[#0a1628]/50">
        <div className="p-2 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/30">
          <Plus className="w-5 h-5 text-[#bfdbfe]" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Submit Progress Report</h3>
          <p className="text-xs text-[#bfdbfe]/50">Log your daily work progress</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs"
          >
            {error}
          </motion.div>
        )}

        {/* Job Selection */}
        <div>
          <label className={labelClass}>
            <ClipboardList className="w-3 h-3" /> Select Job
          </label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className={cn(baseInput, "pr-8 appearance-none cursor-pointer")}
            disabled={submitting}
          >
            <option value="" className="bg-[#0a1628]">
              -- Select a job --
            </option>
            {spanBasedJobs.map((job) => (
              <option key={job.id} value={job.id} className="bg-[#0a1628]">
                {job.job_name} {job.circuit ? `(${job.circuit})` : ""}
              </option>
            ))}
          </select>
          {spanBasedJobs.length === 0 && (
            <p className="text-xs text-amber-400/70 mt-1.5">
              No span-based jobs assigned. Contact your supervisor.
            </p>
          )}
        </div>

        {selectedJob && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="rounded-xl border border-[#3b82f6]/20 bg-[#3b82f6]/5 p-3"
          >
            <div className="flex items-center gap-2 text-xs text-[#bfdbfe]/70">
              <MapPin className="w-3.5 h-3.5" />
              <span>{selectedJob.circuit || selectedJob.job_location || "No location"}</span>
            </div>
          </motion.div>
        )}

        {/* Row: Date & Role */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              <Calendar className="w-3 h-3" /> Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
              max={getTodayDateString()}
              className={cn(baseInput, "[color-scheme:dark]")}
              disabled={submitting}
            />
          </div>
          <div>
            <label className={labelClass}>
              <User className="w-3 h-3" /> Role
            </label>
            <input
              type="text"
              value={formData.job_title}
              onChange={(e) => setFormData((prev) => ({ ...prev, job_title: e.target.value }))}
              placeholder="e.g., Foreman"
              className={baseInput}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Equipment Selection */}
        <div>
          <label className={labelClass}>
            <Wrench className="w-3 h-3" /> Equipment Used
          </label>
          <div className="grid grid-cols-3 gap-2">
            {equipmentOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, equipment: opt.value }))}
                disabled={submitting}
                className={cn(
                  "px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  formData.equipment === opt.value
                    ? "bg-[#3b82f6]/25 text-[#bfdbfe] border border-[#3b82f6]/50 ring-1 ring-[#3b82f6]/30"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spans Input */}
        <div className="rounded-xl border border-[#3b82f6]/20 bg-[#3b82f6]/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <label className={labelClass}>
                <Ruler className="w-3 h-3" /> Spans Completed
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={formData.spans_completed}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, spans_completed: Number(e.target.value) || 0 }))
                }
                className={cn(baseInput, "text-center text-lg font-bold py-2")}
                disabled={submitting}
              />
            </div>
            <div className="text-center px-2">
              <span className="text-white/40 text-lg">×</span>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-widest text-[#bfdbfe]/60 mb-1">Per Span</p>
              <p className="text-xl font-bold text-[#3b82f6]">{spanLengthFeet}</p>
              <p className="text-[10px] text-white/40">feet</p>
            </div>
            <div className="text-center px-2">
              <span className="text-white/40 text-lg">=</span>
            </div>
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-widest text-[#bfdbfe]/60 mb-1">Total</p>
              <p className="text-xl font-bold text-white">{totalFeet.toLocaleString()}</p>
              <p className="text-[10px] text-white/40">feet</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            rows={2}
            placeholder="Any additional context..."
            className={cn(baseInput, "resize-none min-h-[60px]")}
            disabled={submitting}
          />
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={submitting || !selectedJobId}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold min-h-[48px] touch-manipulation",
            "bg-gradient-to-r from-[#3b82f6] via-[#60a5fa] to-[#3b82f6] text-white",
            "shadow-lg shadow-[#3b82f6]/25",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "hover:shadow-[#3b82f6]/40 transition-shadow"
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Submit Progress Report
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}

// ============================================================================
// Report History Component
// ============================================================================

interface ReportHistoryProps {
  reports: EnrichedUpdate[];
  loading: boolean;
  dateRange: DateRangeOption;
  setDateRange: (range: DateRangeOption) => void;
  selectedJobId: string;
  setSelectedJobId: (id: string) => void;
  jobOptions: Array<[string, string]>;
}

function ReportHistory({
  reports,
  loading,
  dateRange,
  setDateRange,
  selectedJobId,
  setSelectedJobId,
  jobOptions,
}: ReportHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Filter reports
  const filteredReports = useMemo(() => {
    let result = [...reports];
    
    if (selectedJobId) {
      result = result.filter((r) => r.job_id === selectedJobId);
    }

    const now = new Date();
    if (dateRange === "today") {
      const today = getTodayDateString();
      result = result.filter((r) => r.date === today);
    } else if (dateRange === "last7") {
      const start = subDays(now, 7);
      result = result.filter((r) => isWithinInterval(new Date(r.date), { start, end: now }));
    } else if (dateRange === "last30") {
      const start = subDays(now, 30);
      result = result.filter((r) => isWithinInterval(new Date(r.date), { start, end: now }));
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reports, selectedJobId, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  
  // Clamp current page to valid range (handles when filters reduce results)
  const effectivePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedReports = filteredReports.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE);

  // Wrapped handlers that also reset page to 1
  const handleDateRangeChange = (range: DateRangeOption) => {
    setCurrentPage(1);
    setDateRange(range);
  };

  const handleJobFilterChange = (jobId: string) => {
    setCurrentPage(1);
    setSelectedJobId(jobId);
  };

  const equipmentColors: Record<string, string> = {
    jerraff: "text-orange-400 bg-orange-500/15 border-orange-500/30",
    bucket: "text-blue-400 bg-blue-500/15 border-blue-500/30",
    mulcher: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 via-[#060d18]/90 to-[#020408]/90 overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#3b82f6]/15 bg-[#0a1628]/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/30">
            <ClipboardList className="w-5 h-5 text-[#bfdbfe]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Report History</h3>
            <p className="text-xs text-[#bfdbfe]/50">{filteredReports.length} reports</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 py-3 border-b border-[#3b82f6]/10 space-y-3">
        {/* Date Range Pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: "today" as const, label: "Today" },
            { value: "last7" as const, label: "7 Days" },
            { value: "last30" as const, label: "30 Days" },
            { value: "all" as const, label: "All Time" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleDateRangeChange(opt.value)}
              aria-label={`Filter by ${opt.label}`}
              aria-pressed={dateRange === opt.value}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]",
                dateRange === opt.value
                  ? "bg-[#3b82f6]/25 text-[#bfdbfe] border border-[#3b82f6]/50"
                  : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Job Filter */}
        <select
          value={selectedJobId}
          onChange={(e) => handleJobFilterChange(e.target.value)}
          className={cn(baseInput, "text-xs py-2")}
        >
          <option value="" className="bg-[#0a1628]">
            All Jobs
          </option>
          {jobOptions.map(([id, name]) => (
            <option key={id} value={id} className="bg-[#0a1628]">
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* Reports List */}
      <div className="divide-y divide-white/5">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6] mx-auto mb-2" />
            <p className="text-xs text-white/40">Loading reports...</p>
          </div>
        ) : pagedReports.length === 0 ? (
          <div className="p-8 text-center">
            <ClipboardList className="w-8 h-8 text-white/20 mx-auto mb-2" />
            <p className="text-sm text-white/60">No reports found</p>
            <p className="text-xs text-white/40 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          pagedReports.map((report) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-5 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-white truncate">
                      {report.job_name || "Unknown Job"}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                        equipmentColors[report.equipment] || "text-gray-400 bg-gray-500/15 border-gray-500/30"
                      )}
                    >
                      {report.equipment}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/50">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDateForDisplay(report.date)}
                    </span>
                    {report.circuit && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {report.circuit}
                      </span>
                    )}
                  </div>
                  {report.notes && (
                    <p className="text-xs text-white/40 mt-1.5 line-clamp-1">{report.notes}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-[#3b82f6]">{report.spans_completed}</p>
                  <p className="text-[10px] text-white/40">spans</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {report.total_feet_completed?.toLocaleString()} ft
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 bg-black/20">
          <span className="text-[11px] text-white/40">
            {filteredReports.length} reports
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
            </button>
            <span className="text-[11px] text-white/50 px-2 min-w-[50px] text-center" aria-live="polite">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
              className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-1"
            >
              <ChevronRight className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Analytics Component
// ============================================================================

interface AnalyticsProps {
  analytics: JobAnalytics[];
  loading: boolean;
}

function JobProgressAnalytics({ analytics, loading }: AnalyticsProps) {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 via-[#060d18]/90 to-[#020408]/90 p-8"
      >
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#3b82f6]" />
        </div>
      </motion.div>
    );
  }

  if (analytics.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 via-[#060d18]/90 to-[#020408]/90 p-8 text-center"
      >
        <BarChart3 className="w-10 h-10 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/60">No analytics data yet</p>
        <p className="text-xs text-white/40 mt-1">Submit progress reports to see job analytics</p>
      </motion.div>
    );
  }

  // Calculate totals
  const totals = analytics.reduce(
    (acc, job) => ({
      spans: acc.spans + job.totalSpans,
      feet: acc.feet + job.totalFeet,
      reports: acc.reports + job.reportsCount,
    }),
    { spans: 0, feet: 0, reports: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-3 gap-3"
      >
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 to-[#020408]/90 p-4 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/30 flex items-center justify-center mx-auto mb-2">
            <Ruler className="w-5 h-5 text-[#bfdbfe]" />
          </div>
          <p className="text-2xl font-bold text-white">{totals.spans.toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Total Spans</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 to-[#020408]/90 p-4 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{totals.feet.toLocaleString()}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Total Feet</p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 to-[#020408]/90 p-4 text-center"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center mx-auto mb-2">
            <ClipboardList className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white">{totals.reports}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">Reports</p>
        </motion.div>
      </motion.div>

      {/* Job Analytics Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 via-[#060d18]/90 to-[#020408]/90 overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3b82f6]/15 bg-[#0a1628]/50">
          <div className="p-2 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/30">
            <BarChart3 className="w-5 h-5 text-[#bfdbfe]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Job Progress Analytics</h3>
            <p className="text-xs text-[#bfdbfe]/50">Overall job performance stats</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-white/80">
            <thead className="text-[10px] uppercase tracking-wider text-white/40 bg-black/20">
              <tr>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 text-right font-medium">Spans</th>
                <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">Feet</th>
                <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Reports</th>
                <th className="px-4 py-3 text-right font-medium">Avg/Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analytics.map((job) => (
                <tr key={job.jobId} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 max-w-[150px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white font-medium truncate" title={job.jobName}>
                        {job.jobName}
                      </span>
                      {job.circuit && (
                        <span className="text-[9px] text-white/40 flex items-center gap-0.5 truncate">
                          <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                          {job.circuit}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-[#3b82f6]">{job.totalSpans.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">
                    <span className="text-white/70">{job.totalFeet.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    <span className="text-white/60">{job.reportsCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">
                      <Zap className="w-2.5 h-2.5" />
                      {job.avgSpansPerReport.toFixed(1)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Equipment Breakdown */}
        <div className="px-5 py-4 border-t border-[#3b82f6]/10">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Equipment Usage (All Jobs)</p>
          <div className="grid grid-cols-3 gap-3">
            {["jerraff", "bucket", "mulcher"].map((equip) => {
              const totals = analytics.reduce(
                (acc, job) => ({
                  spans: acc.spans + (job.equipmentBreakdown[equip]?.spans || 0),
                  feet: acc.feet + (job.equipmentBreakdown[equip]?.feet || 0),
                }),
                { spans: 0, feet: 0 }
              );
              const colors: Record<string, { bg: string; text: string; border: string }> = {
                jerraff: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
                bucket: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
                mulcher: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
              };
              const c = colors[equip];
              return (
                <div
                  key={equip}
                  className={cn("rounded-xl border p-3 text-center", c.bg, c.border)}
                >
                  <Wrench className={cn("w-4 h-4 mx-auto mb-1", c.text)} />
                  <p className="text-xs capitalize font-medium text-white">{equip === "jerraff" ? "Jarraff" : equip}</p>
                  <p className={cn("text-lg font-bold", c.text)}>{totals.spans}</p>
                  <p className="text-[10px] text-white/40">spans</p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ForemanDailyReports() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  // State
  const [activeTab, setActiveTab] = useState<ViewTab>("submit");
  const [assignedJobs, setAssignedJobs] = useState<JobProgressTracker[]>([]);
  const [reports, setReports] = useState<EnrichedUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeOption>("last7");
  const [selectedJobFilter, setSelectedJobFilter] = useState<string>("");

  // Fetch assigned jobs
  const fetchAssignedJobs = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("job_crew_assignments")
        .select(`
          job:job_progress_trackers(
            id,
            job_name,
            job_location,
            circuit,
            status,
            tracking_type,
            estimated_total_spans,
            estimated_total_feet,
            span_progress_metric
          )
        `)
        .eq("user_id", user.id);

      if (error) {
        logger.error("Failed to fetch assigned jobs:", error);
        return;
      }

      const jobs = (data || [])
        .map((item) => {
          const jobData = item.job;
          return Array.isArray(jobData) ? jobData[0] : jobData;
        })
        .filter(
          (job): job is NonNullable<typeof job> => job !== null && job !== undefined && job.status === "active"
        ) as JobProgressTracker[];

      setAssignedJobs(jobs);
    } catch (err) {
      logger.error("Unexpected error fetching assigned jobs:", err);
    }
  }, [user?.id]);

  // Fetch reports (user's own reports)
  const fetchReports = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("job_progress_updates")
        .select(`
          *,
          job:job_progress_trackers(id, job_name, circuit)
        `)
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        logger.error("Failed to fetch reports:", error);
        return;
      }

      type ReportRow = EnrichedUpdate & {
        job?: { job_name?: string; circuit?: string } | null;
      };

      const enriched: EnrichedUpdate[] = ((data || []) as ReportRow[]).map((row) => ({
        ...row,
        job_name: row.job?.job_name ?? "Unknown Job",
        circuit: row.job?.circuit ?? row.circuit,
      }));

      setReports(enriched);
    } catch (err) {
      logger.error("Unexpected error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAssignedJobs();
    fetchReports();
  }, [fetchAssignedJobs, fetchReports]);

  // Calculate job analytics from reports
  const jobAnalytics = useMemo<JobAnalytics[]>(() => {
    const map = new Map<string, JobAnalytics>();

    reports.forEach((report) => {
      const existing = map.get(report.job_id) || {
        jobId: report.job_id,
        jobName: report.job_name || "Unknown Job",
        circuit: report.circuit || null,
        totalSpans: 0,
        totalFeet: 0,
        reportsCount: 0,
        avgSpansPerReport: 0,
        equipmentBreakdown: {},
        lastReportDate: null,
      };

      existing.totalSpans += report.spans_completed;
      existing.totalFeet += report.total_feet_completed || 0;
      existing.reportsCount += 1;

      // Equipment breakdown
      const equip = report.equipment;
      if (!existing.equipmentBreakdown[equip]) {
        existing.equipmentBreakdown[equip] = { spans: 0, feet: 0 };
      }
      existing.equipmentBreakdown[equip].spans += report.spans_completed;
      existing.equipmentBreakdown[equip].feet += report.total_feet_completed || 0;

      // Last report date
      if (!existing.lastReportDate || new Date(report.date) > new Date(existing.lastReportDate)) {
        existing.lastReportDate = report.date;
      }

      map.set(report.job_id, existing);
    });

    // Calculate averages
    return Array.from(map.values()).map((job) => ({
      ...job,
      avgSpansPerReport: job.reportsCount > 0 ? job.totalSpans / job.reportsCount : 0,
    })).sort((a, b) => b.totalSpans - a.totalSpans);
  }, [reports]);

  // Job options for filter dropdown
  const jobOptions = useMemo<Array<[string, string]>>(() => {
    const map = new Map<string, string>();
    reports.forEach((r) => {
      if (r.job_id) {
        map.set(r.job_id, r.job_name || "Unknown Job");
      }
    });
    return Array.from(map.entries());
  }, [reports]);

  // Access control
  if (role !== "foreman" && role !== "admin") {
    return (
      <DashboardLayout title="Access Denied">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Users className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400 mb-6">You don't have permission to view this page.</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const tabs: { id: ViewTab; label: string; icon: typeof Plus }[] = [
    { id: "submit", label: "Submit Report", icon: Plus },
    { id: "history", label: "My Reports", icon: ClipboardList },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <DashboardLayout title="Daily Reports">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Premium Glass Header - Blue Theme */}
        <div className="mb-5 md:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div
              className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(59, 130, 246, 0.1) 0%, rgba(10, 22, 40, 0.65) 40%, rgba(2, 4, 8, 0.75) 100%)",
                backdropFilter: "blur(24px) saturate(1.6)",
                WebkitBackdropFilter: "blur(24px) saturate(1.6)",
              }}
            >
              {/* Glass effects */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(125deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, transparent 50%)",
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%)" }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 25% 0%, rgba(59, 130, 246, 0.2) 0%, transparent 45%)",
                }}
              />
              <div
                className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)",
                }}
              />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />
              <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-l-[inherit]" />

              <div className="relative px-5 py-4 md:px-7 md:py-5">
                {/* Badges */}
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/30"
                  >
                    <ClipboardList className="w-3.5 h-3.5 text-[#bfdbfe]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f0f9ff]">
                      Foreman • Reports
                    </span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a1628]/60 border border-[#3b82f6]/20"
                  >
                    <Activity className="w-3 h-3 text-[#bfdbfe]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#f0f9ff]/70">
                      {reports.length} Reports
                    </span>
                  </motion.div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Accent Line */}
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#bfdbfe] via-[#3b82f6] to-[#1d4ed8] origin-top flex-shrink-0"
                    style={{
                      boxShadow: "0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.25)",
                    }}
                  />

                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect
                        as="h1"
                        preset="blurSlide"
                        per="char"
                        delay={0.15}
                        className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight"
                        segmentWrapperClassName="bg-gradient-to-r from-white via-[#bfdbfe] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(59,130,246,0.35)]"
                      >
                        Daily Progress Reports
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#bfdbfe] to-white/90 bg-clip-text text-transparent">
                        Daily Progress Reports
                      </h1>
                    )}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7, ease: "easeOut" }}
                      className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#bfdbfe]/50 font-medium leading-relaxed max-w-xl"
                    >
                      Submit and track your daily job progress reports
                    </motion.p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        {/* Tab Navigation */}
        <ScrollReveal variant="fadeUp" delay={0}>
          <div className="mb-5">
            <div className="flex gap-2 p-1 rounded-xl bg-[#0a1628]/60 border border-[#3b82f6]/20 backdrop-blur-sm">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? "bg-[#3b82f6]/25 text-[#bfdbfe] border border-[#3b82f6]/40 shadow-lg shadow-[#3b82f6]/10"
                      : "text-white/60 hover:text-white/80 hover:bg-white/5"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "submit" && (
            <ScrollReveal key="submit" variant="fadeUp" delay={0.05}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <SubmitProgressForm
                  assignedJobs={assignedJobs}
                  onSubmitSuccess={() => {
                    fetchReports();
                  }}
                />

                {/* Quick Stats */}
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 via-[#060d18]/90 to-[#020408]/90 p-5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">This Week's Progress</h3>
                        <p className="text-xs text-[#bfdbfe]/50">
                          {format(startOfWeek(new Date(), { weekStartsOn: 1 }), "MMM d")} -{" "}
                          {format(endOfWeek(new Date(), { weekStartsOn: 1 }), "MMM d")}
                        </p>
                      </div>
                    </div>

                    {(() => {
                      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
                      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
                      const weekReports = reports.filter((r) =>
                        isWithinInterval(new Date(r.date), { start: weekStart, end: weekEnd })
                      );
                      const weekSpans = weekReports.reduce((sum, r) => sum + r.spans_completed, 0);
                      const weekFeet = weekReports.reduce((sum, r) => sum + (r.total_feet_completed || 0), 0);

                      return (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-xl border border-[#3b82f6]/20 bg-[#3b82f6]/5 p-4 text-center">
                            <p className="text-3xl font-bold text-[#3b82f6]">{weekSpans}</p>
                            <p className="text-xs text-white/50 mt-1">Spans</p>
                          </div>
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
                            <p className="text-3xl font-bold text-emerald-400">{weekFeet.toLocaleString()}</p>
                            <p className="text-xs text-white/50 mt-1">Feet</p>
                          </div>
                        </div>
                      );
                    })()}
                  </motion.div>

                  {/* Recent Activity */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl border border-[#3b82f6]/25 bg-gradient-to-br from-[#0a1628]/90 via-[#060d18]/90 to-[#020408]/90 overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3b82f6]/15">
                      <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30">
                        <Activity className="w-5 h-5 text-purple-400" />
                      </div>
                      <h3 className="text-base font-bold text-white">Recent Activity</h3>
                    </div>
                    <div className="divide-y divide-white/5">
                      {reports.slice(0, 3).map((report) => (
                        <div key={report.id} className="px-5 py-3 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{report.job_name}</p>
                            <p className="text-xs text-white/40">{formatDateForDisplay(report.date)}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <p className="text-sm font-bold text-[#3b82f6]">{report.spans_completed} spans</p>
                          </div>
                        </div>
                      ))}
                      {reports.length === 0 && (
                        <div className="px-5 py-6 text-center">
                          <p className="text-sm text-white/50">No recent activity</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              </div>
            </ScrollReveal>
          )}

          {activeTab === "history" && (
            <ScrollReveal key="history" variant="fadeUp" delay={0.05}>
              <ReportHistory
                reports={reports}
                loading={loading}
                dateRange={dateRange}
                setDateRange={setDateRange}
                selectedJobId={selectedJobFilter}
                setSelectedJobId={setSelectedJobFilter}
                jobOptions={jobOptions}
              />
            </ScrollReveal>
          )}

          {activeTab === "analytics" && (
            <ScrollReveal key="analytics" variant="fadeUp" delay={0.05}>
              <JobProgressAnalytics analytics={jobAnalytics} loading={loading} />
            </ScrollReveal>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

