import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FolderOpen,
  FileEdit,
  CheckCircle2,
  Loader2,
  MapPin,
  Calendar,
  Plus,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import type { DailyJsaRecord } from "../../pages/forms/DailyJSAForm";

interface JsaPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectJsa: (id: string) => void;
  onCreateNew: () => void;
  currentJsaId?: string;
}

type StatusFilter = "all" | "draft" | "completed";

const statusChips: Record<string, string> = {
  draft: "bg-yellow-500/15 text-yellow-200 border border-yellow-500/40",
  completed: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/40",
};

function formatDate(value?: string | null) {
  if (!value) return "Date TBD";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function summarizeJobs(
  jobs?: Array<{ key: string; label?: string }> | null
): string {
  if (!jobs || jobs.length === 0) return "No job info";
  const labels = jobs.map((job) => job.label || job.key || "Job");
  return labels.slice(0, 2).join(", ") + (labels.length > 2 ? "..." : "");
}

export function JsaPickerDrawer({
  isOpen,
  onClose,
  onSelectJsa,
  onCreateNew,
  currentJsaId,
}: JsaPickerDrawerProps) {
  const { user, isAdmin } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [records, setRecords] = useState<DailyJsaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!user && !isAdmin) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("daily_jsa")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(50);

      if (!isAdmin) {
        query = query.eq("user_id", user?.id ?? "");
      }

      if (statusFilter === "draft") {
        query = query.or("status.eq.draft,status.is.null");
      } else if (statusFilter === "completed") {
        query = query.eq("status", "completed");
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setRecords((data as DailyJsaRecord[]) || []);
    } catch (err) {
      console.error("Failed to load JSAs:", err);
      setError("Failed to load JSAs");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, statusFilter]);

  useEffect(() => {
    if (isOpen) {
      fetchRecords();
    }
  }, [isOpen, fetchRecords]);

  const handleSelect = (id: string) => {
    onSelectJsa(id);
    onClose();
  };

  const handleCreateNew = () => {
    onCreateNew();
    onClose();
  };

  // Backdrop animation
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  // Drawer animation - slides up on mobile, slides in from right on desktop
  const drawerVariants = {
    hidden: {
      y: "100%",
      opacity: 0.5,
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        damping: 30,
        stiffness: 300,
      },
    },
    exit: {
      y: "100%",
      opacity: 0.5,
      transition: {
        duration: 0.2,
      },
    },
  };

  const draftCount = records.filter(
    (r) => r.status === "draft" || !r.status
  ).length;
  const completedCount = records.filter((r) => r.status === "completed").length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl border-t border-white/10 bg-gradient-to-b from-[#0a1a10] to-black overflow-hidden sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[400px] sm:max-h-none sm:rounded-none sm:rounded-l-3xl sm:border-l sm:border-t-0"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="sticky top-0 z-10 px-5 py-4 border-b border-white/10 bg-black/80 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">My JSAs</h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition touch-manipulation"
                  aria-label="Close JSA picker"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2">
                {(
                  [
                    { value: "all", label: "All", count: records.length },
                    { value: "draft", label: "Drafts", count: draftCount },
                    {
                      value: "completed",
                      label: "Completed",
                      count: completedCount,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setStatusFilter(tab.value)}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all touch-manipulation min-h-[44px]",
                      statusFilter === tab.value
                        ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-200"
                        : "bg-white/5 border border-white/10 text-white/60 hover:text-white"
                    )}
                  >
                    {tab.value === "draft" && <FileEdit className="w-3.5 h-3.5" />}
                    {tab.value === "completed" && (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {tab.label}
                    <span className="text-[10px] opacity-70">({tab.count})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div 
              className="overflow-y-auto max-h-[calc(85vh-180px)] sm:max-h-[calc(100vh-180px)]"
              style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1.5rem)" }}
            >
              {/* Create New Button */}
              <div className="p-4">
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition touch-manipulation min-h-[52px]"
                >
                  <Plus className="w-5 h-5" />
                  Start New JSA
                </button>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading JSAs...
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="mx-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {error}
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && records.length === 0 && (
                <div className="text-center py-8 px-4">
                  <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    No JSAs found. Create your first one!
                  </p>
                </div>
              )}

              {/* JSA List */}
              {!loading && !error && records.length > 0 && (
                <div className="px-4 space-y-2 pb-6">
                  {records.map((record) => {
                    const isSelected = record.id === currentJsaId;
                    const statusKey = record.status || "draft";

                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => handleSelect(record.id)}
                        className={cn(
                          "w-full text-left rounded-xl border p-4 transition-all touch-manipulation",
                          isSelected
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-white/10 bg-white/5 hover:bg-white/10 active:bg-white/15"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(record.job_date || record.created_at)}
                          </div>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                              statusChips[statusKey] || statusChips.draft
                            )}
                          >
                            {statusKey}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin className="w-4 h-4 text-emerald-400" />
                          <p className="text-sm font-semibold text-white truncate">
                            {record.work_location || "Location TBD"}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 truncate pl-6">
                          {summarizeJobs(
                            record.jobs_performed as Array<{
                              key: string;
                              label?: string;
                            }>
                          )}
                        </p>
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-xs text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Currently editing
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

