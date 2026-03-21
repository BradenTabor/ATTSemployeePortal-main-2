import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ClipboardList,
  Search,
  MapPin,
  User,
  Users,
  UserPlus,
  Clock,
  AlignLeft,
  Thermometer,
  Wind,
  AlertTriangle,
  ChevronRight,
  FileText,
  CheckCircle2,
  FileEdit,
  Calendar,
  SortDesc,
  X,
  Maximize2,
  Minimize2,
  Info,
  Download,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { PaginationControls } from "../../components/PaginationControls";
import type { DailyJsaRecord, JsaSpan, ObserverSignature, SharedUser } from "../forms/DailyJSAForm";
import TableSkeleton from "../../components/skeletons/TableSkeleton";
import CardListSkeleton from "../../components/skeletons/CardListSkeleton";
import { glass } from "../../lib/glass";
import { logger } from "../../lib/logger";
import JsaExportModal from "./JsaExportModal";
import type { AdminJsaRow } from "../admin/admin-jsa/types";

type GFJsaRow = DailyJsaRecord & {
  user_email?: string | null;
  user_name?: string | null;
  user_role?: string | null;
};

type UserProfileMeta = {
  email?: string | null;
  role?: string | null;
  full_name?: string | null;
};

const pageSize = 20;

type JobSelection = {
  key: string;
  label?: string;
};

type WeatherPayload = {
  conditions?: Record<string, boolean>;
  modifiers?: Record<string, boolean>;
};

const WEATHER_CONDITIONS = [
  { key: "sunny", label: "Sunny" },
  { key: "rain", label: "Rain" },
  { key: "overcast", label: "Overcast" },
  { key: "windy", label: "Windy" },
];

const WEATHER_MODIFIERS = [
  { key: "hot_dry", label: "Hot / Dry" },
  { key: "wet", label: "Wet" },
  { key: "cold", label: "Cold" },
  { key: "ice_snow", label: "Ice / Snow" },
];

const HAZARD_ITEMS = [
  { key: "lines_energized", label: "Lines energized" },
  { key: "secondary_voltage", label: "Secondary voltage" },
  { key: "open_wire_secondary", label: "Open-wire secondary" },
  { key: "guy_wire_present", label: "Guy wire present" },
  { key: "rotten_poles", label: "Rotten poles" },
  { key: "broken_poles", label: "Broken/damaged poles" },
  { key: "line_clearances_signed", label: "Line clearances needed & signed" },
  { key: "voltages_grounded", label: "Voltages grounded" },
  { key: "voltages_verified", label: "Grounds verified" },
];

const TRAFFIC_HAZARDS = [
  { key: "hills", label: "Hills" },
  { key: "curves", label: "Curves" },
  { key: "heavy_traffic", label: "Heavy traffic" },
  { key: "construction_zone", label: "Construction zone" },
  { key: "school_zone", label: "School zone" },
  { key: "closing_lane", label: "Closing a lane" },
  { key: "flagger_needed", label: "Flagger needed" },
  { key: "flagger_trained", label: "Flagger trained" },
  { key: "has_stop_paddles", label: "Stop/Slow paddles ready" },
  { key: "has_radios", label: "Required radios ready" },
];

const TRAFFIC_SETUP = [
  { key: "warning_signs_used", label: "Proper warning signs used" },
  { key: "warning_signs_distance", label: "Signs at correct distance" },
  { key: "reflective_cones", label: "Reflective cones placed" },
  { key: "cone_separation", label: "Cone separation correct" },
  { key: "buffer_zone", label: "Buffer/Taper zone correct" },
];

const statusFilters = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Completed", value: "completed" },
];

// Purple-themed status badges
const statusBadge: Record<string, string> = {
  draft: "bg-[#2d1b4e]/80 text-[#e9d5ff] border border-[#c084fc]/40",
  completed: "bg-[#0f2218]/80 text-[#9cf6d2] border border-[#6fe9b7]/35",
};

export default function GeneralForemanSafetyCompliance() {
  const { role } = useAuth();
  const hasAccess = role === "general_foreman" || role === "admin";
  
  const [records, setRecords] = useState<GFJsaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "completed">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [signatureFilter, setSignatureFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);

  // Export state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportRecords, setExportRecords] = useState<AdminJsaRow[] | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchRecords = useCallback(async () => {
    if (!hasAccess) return;
    setLoading(true);
    setError(null);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      // ARCH-015: Select only needed columns instead of SELECT *
      // Fields used in list view and detail view
      let query = supabase
        .from("daily_jsa")
        .select(`
          id,
          user_id,
          job_date,
          work_location,
          circuit_number,
          status,
          employee_signature,
          nearest_hospital,
          nearest_clinic,
          notes,
          updated_at,
          created_at,
          jobs_performed,
          weather_conditions,
          hazards_present,
          traffic_hazards,
          traffic_setup,
          spans,
          observer_signatures,
          shared_with_users,
          call_in_time,
          call_out_time,
          oc_contact,
          doc_contact,
          gf_contact,
          safety_contact,
          weather_hazards,
          jsa_photo_paths,
          submission_type
        `, { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (dateFilter) {
        query = query.eq("job_date", dateFilter);
      }

      if (searchQuery.trim()) {
        const pattern = `%${searchQuery.trim()}%`;
        query = query.or(
          `work_location.ilike.${pattern},circuit_number.ilike.${pattern},notes.ilike.${pattern}`
        );
      }

      if (signatureFilter.trim()) {
        query = query.ilike("employee_signature", `%${signatureFilter.trim()}%`);
      }

      const { data, error: listError, count } = await query;

      if (listError) {
        throw listError;
      }

      const rows = (data as DailyJsaRecord[]) || [];
      const userIds = Array.from(
        new Set(rows.map((row) => row.user_id).filter(Boolean))
      );
      const userMap = new Map<string, UserProfileMeta>();

      if (userIds.length > 0) {
        // Batch query for large datasets
        const batchSize = 100;
        const batches = [];
        for (let i = 0; i < userIds.length; i += batchSize) {
          batches.push(userIds.slice(i, i + batchSize));
        }

        const results = await Promise.all(
          batches.map((batch) =>
            supabase
              .from("user_profiles")
              .select("user_id, email, role, full_name")
              .in("user_id", batch)
          )
        );

        results.forEach((result) => {
          if (result.error) {
            logger.warn("[GeneralForemanSafetyCompliance] Failed to load user metadata:", result.error.message);
          } else {
            (result.data as Array<UserProfileMeta & { user_id: string }> | null)?.forEach(
              (profile) => {
                userMap.set(profile.user_id, {
                  email: profile.email,
                  role: profile.role,
                  full_name: profile.full_name,
                });
              }
            );
          }
        });
      }

      const enriched = rows.map((row) => {
        const meta = userMap.get(row.user_id) || ({} as UserProfileMeta);
        return {
          ...row,
          user_email: meta.email || null,
          user_name: meta.full_name || meta.email || "Unknown User",
          user_role: meta.role || "No role assigned",
        };
      });

      setRecords(enriched);
      setSelectedId((prev) => {
        if (prev && enriched.some((row) => row.id === prev)) {
          return prev;
        }
        return enriched[0]?.id ?? null;
      });
      setTotal(typeof count === "number" ? count : enriched.length);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to load JSAs.";
      logger.error("[GeneralForemanSafetyCompliance] Failed to load JSAs:", err);
      setError(message);
      setRecords([]);
      setTotal(0);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [hasAccess, page, searchQuery, statusFilter, dateFilter, signatureFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, dateFilter, signatureFilter]);

  const selectedRecord = useMemo(
    () => records.find((row) => row.id === selectedId) || null,
    [records, selectedId]
  );

  // Lock background scroll when detail modal is open
  useEffect(() => {
    if (!selectedRecord) return;
    const scrollContainer = document.querySelector('.scroll-container');
    if (scrollContainer) (scrollContainer as HTMLElement).style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      if (scrollContainer) (scrollContainer as HTMLElement).style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [selectedRecord]);

  // ── Batch selection helpers ───────────────────────────────
  const toggleSelectRecord = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedIds(prev => {
      const pageIds = records.map(r => r.id);
      const allSelected = pageIds.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      }
      return new Set([...prev, ...pageIds]);
    });
  }, [records]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const allOnPageSelected = records.length > 0 && records.every(r => selectedIds.has(r.id));

  const openBatchExport = useCallback(() => {
    const rows = records.filter(r => selectedIds.has(r.id)) as AdminJsaRow[];
    if (rows.length === 0) return;
    setExportRecords(rows);
  }, [records, selectedIds]);

  const openSingleExport = useCallback((record: GFJsaRow) => {
    setExportRecords([record as AdminJsaRow]);
  }, []);

  if (!hasAccess) {
    return (
      <DashboardLayout title="Safety Compliance">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-[#c084fc]/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-[#c084fc]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Count drafts and completed for tab badges
  const draftCount = records.filter((row) => row.status === "draft").length;
  const completedCount = records.filter((row) => row.status === "completed").length;

  // Check if any filters are active
  const hasActiveFilters = searchQuery.trim() || dateFilter || signatureFilter.trim();

  const clearAllFilters = () => {
    setSearchQuery("");
    setDateFilter("");
    setSignatureFilter("");
    setStatusFilter("all");
  };

  return (
    <DashboardLayout title="Safety Compliance">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Compact header — solid premium surface */}
        <header className="mb-4 sm:mb-5">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`${glass.cardPurple} px-5 py-4 sm:px-6 sm:py-5`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-400/25 text-[10px] font-semibold uppercase tracking-wider text-purple-200">
                <Shield className="w-3.5 h-3.5" aria-hidden />
                General Foreman &middot; Safety
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/20 border border-purple-500/15 text-[10px] font-medium text-purple-200/70">
                <ClipboardList className="w-3 h-3" aria-hidden />
                {statusFilter === "all" ? "All statuses" : statusFilter}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1 h-10 sm:h-12 rounded-full bg-gradient-to-b from-purple-400 via-violet-500 to-purple-600 flex-shrink-0" aria-hidden />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Safety Compliance Review
                </h1>
                <p className="text-xs sm:text-sm text-white/50 mt-0.5 max-w-xl">
                  Review crew JSA submissions and ensure field safety compliance
                </p>
              </div>
            </div>
          </motion.div>
        </header>

        <div className="space-y-6">
          {/* Status Tabs - Purple Theme */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap items-center gap-2"
          >
            {statusFilters.map((filter) => {
              const isActive = statusFilter === filter.value;
              const count = filter.value === "all" ? total : filter.value === "draft" ? draftCount : completedCount;
              const Icon = filter.value === "draft" ? FileEdit : filter.value === "completed" ? CheckCircle2 : FileText;
              
              return (
                <motion.button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value as "all" | "draft" | "completed")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#7c3aed] text-white shadow-[0_8px_25px_rgba(192,132,252,0.35)]"
                      : "bg-[#0a0513]/70 border border-[#c084fc]/20 text-[#e9d5ff]/80 hover:border-[#c084fc]/40 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {filter.label}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    isActive 
                      ? "bg-white/20 text-white" 
                      : "bg-white/10 text-[#e9d5ff]"
                  }`}>
                    {count}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Search & Filters Bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className={`${glass.card} p-4 sm:p-5 space-y-4`}
          >
            {/* Filter Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[#c084fc]">
                <Search className="w-4 h-4" />
                Search & Filter
              </div>
              <AnimatePresence>
                {hasActiveFilters && (
                  <motion.button
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#e9d5ff]/80 hover:text-white bg-white/5 border border-white/10 hover:border-[#c084fc]/40 transition-all"
                  >
                    <X className="w-3 h-3" />
                    Clear all filters
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#a78bfa] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Location, circuit, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl bg-[#0a0513]/70 border border-[#c084fc]/25 pl-10 pr-4 py-2.5 text-sm text-[#f3e8ff] placeholder:text-[#a78bfa]/60 focus:outline-none focus:ring-2 focus:ring-[#c084fc]/60"
                />
              </div>

              {/* Date Filter */}
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#a78bfa] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full rounded-2xl bg-[#0a0513]/70 border border-[#c084fc]/25 pl-10 pr-4 py-2.5 text-sm text-[#f3e8ff] focus:outline-none focus:ring-2 focus:ring-[#c084fc]/60 [color-scheme:dark]"
                />
              </div>

              {/* Signer Filter */}
              <div className="relative">
                <User className="w-4 h-4 text-[#a78bfa] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by signer name…"
                  value={signatureFilter}
                  onChange={(e) => setSignatureFilter(e.target.value)}
                  className="w-full rounded-2xl bg-[#0a0513]/70 border border-[#c084fc]/25 pl-10 pr-4 py-2.5 text-sm text-[#f3e8ff] placeholder:text-[#a78bfa]/60 focus:outline-none focus:ring-2 focus:ring-[#c084fc]/60"
                />
              </div>

              {/* Results Summary */}
              <div className="flex items-center justify-center lg:justify-end gap-3 text-sm text-[#e9d5ff]">
                <div className="flex items-center gap-2">
                  <SortDesc className="w-4 h-4 text-[#c084fc]" />
                  <span className="text-xs text-[#a78bfa]">Most recent first</span>
                </div>
                <span className="text-[#c084fc] font-semibold">
                  {page}/{totalPages}
                </span>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-[#ff8a65]/40 bg-[#2b120b]/70 text-[#ffb199] px-4 py-3 text-sm">
                {error}
              </div>
            )}
          </motion.div>
        </div>

        {/* Main Content */}
        <div className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className={`${glass.card} p-4 sm:p-6`}
          >
            {loading ? (
              <TableSkeleton rows={6} columns={6} variant="purple" />
            ) : records.length === 0 ? (
              <div className="p-12 text-center text-[#e9d5ff]/80 text-sm">
                No JSAs match your filters yet.
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[0.65rem] uppercase tracking-[0.3em] text-[#c084fc]/80 border-b border-[#c084fc]/20">
                        <th className="px-3 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allOnPageSelected}
                            onChange={toggleSelectAllOnPage}
                            className="w-3.5 h-3.5 accent-[#c084fc] rounded cursor-pointer"
                            aria-label="Select all on page"
                          />
                        </th>
                        <th className="px-6 py-3 text-left">Job Date</th>
                        <th className="px-6 py-3 text-left">Location</th>
                        <th className="px-6 py-3 text-left">Owner</th>
                        <th className="px-6 py-3 text-left">Driver Signature</th>
                        <th className="px-6 py-3 text-left">Status</th>
                        <th className="px-6 py-3 text-left">Updated</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => {
                        const isSelected = record.id === selectedId;
                        return (
                          <tr
                            key={record.id}
                            onClick={() => setSelectedId(record.id)}
                            className={`border-b border-[#c084fc]/15 text-sm text-[#f3e8ff]/85 transition cursor-pointer ${
                              isSelected ? "bg-[#c084fc]/10 border-l-2 border-l-[#c084fc]" : "hover:bg-white/5"
                            }`}
                          >
                            <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(record.id)}
                                onChange={() => toggleSelectRecord(record.id)}
                                className="w-3.5 h-3.5 accent-[#c084fc] rounded cursor-pointer"
                                aria-label={`Select JSA for ${record.work_location || 'unknown location'}`}
                              />
                            </td>
                            <td className="px-6 py-4">{formatDate(record.job_date)}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-[#c084fc]" />
                                <span className="font-semibold text-white">
                                  {record.work_location || "N/A"}
                                </span>
                              </div>
                              <p className="text-xs text-[#a78bfa]">{record.circuit_number || "—"}</p>
                            </td>
                            <td className="px-6 py-4">
                              {(() => {
                                const ownerName =
                                  record.user_name || record.employee_signature?.trim() || "Unknown User";
                                const ownerEmail = record.user_email || "Not available";
                                return (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4 text-[#c084fc]" />
                                      <span>{ownerName}</span>
                                    </div>
                                    <p className="text-xs text-[#a78bfa] mt-1">
                                      {ownerEmail} · {record.user_role || "employee"}
                                    </p>
                                  </>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-sm text-white">
                                <User className="w-3.5 h-3.5 text-[#c084fc]" />
                                <span className="font-medium">
                                  {record.employee_signature?.trim() || "—"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                                    statusBadge[record.status || "draft"] || statusBadge.draft
                                  }`}
                                >
                                  {record.status || "draft"}
                                </span>
                                {record.submission_type === "paper" && (
                                  <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Paper
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-[#a78bfa]">
                              {formatDateTime(record.updated_at || record.created_at)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedId(record.id);
                                }}
                                className={`text-sm font-semibold ${
                                  isSelected ? "text-[#f3e8ff]" : "text-[#c084fc] hover:text-[#f3e8ff]"
                                }`}
                              >
                                {isSelected ? (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </span>
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="lg:hidden space-y-4">
                  {records.map((record) => (
                    <MobileJsaCard
                      key={record.id}
                      record={record}
                      isSelected={record.id === selectedId}
                      onSelect={() => setSelectedId(record.id)}
                      isChecked={selectedIds.has(record.id)}
                      onCheckToggle={() => toggleSelectRecord(record.id)}
                    />
                  ))}
                </div>

                {total > pageSize && (
                  <div className="pt-4">
                    <PaginationControls
                      currentPage={page}
                      totalPages={totalPages}
                      totalItems={total}
                      loading={loading}
                      pageSize={pageSize}
                      onPreviousClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      onNextClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      label="JSAs"
                    />
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>

        {/* Detail Panel - Portaled to body to escape scroll containers */}
        {createPortal(
          <AnimatePresence mode="wait">
            {selectedRecord && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setSelectedId(null)}
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998]"
                />
                {/* Modal */}
                <motion.div
                  key={isDetailFullscreen ? "fullscreen" : "modal"}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className={`fixed z-[9999] ${glass.elevated} overflow-auto ${
                    isDetailFullscreen
                      ? "inset-2 sm:inset-4"
                      : "inset-3 sm:inset-6 md:inset-8 lg:inset-12 xl:inset-x-[15%] xl:inset-y-8 max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)]"
                  }`}
                >
                  {loading ? (
                    <div className="p-4 sm:p-6">
                      <CardListSkeleton rows={2} variant="purple" />
                    </div>
                  ) : (
                    <SelectedJsaDetail 
                      record={selectedRecord} 
                      onClose={() => setSelectedId(null)}
                      isFullscreen={isDetailFullscreen}
                      onToggleFullscreen={() => setIsDetailFullscreen(!isDetailFullscreen)}
                      onExport={() => openSingleExport(selectedRecord)}
                    />
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* Floating Batch Export Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 pb-safe"
            >
              <div className={`${glass.elevated} flex items-center gap-3 px-4 py-3`}>
                <span className="text-xs text-[#e9d5ff] font-semibold whitespace-nowrap">
                  {selectedIds.size} selected
                </span>
                <motion.button
                  type="button"
                  onClick={openBatchExport}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#c084fc] via-[#a855f7] to-[#7c3aed] text-white text-xs font-semibold shadow-[0_4px_12px_rgba(192,132,252,0.3)] transition min-h-[36px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </motion.button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs text-[#a78bfa]/70 hover:text-[#e9d5ff] transition font-medium"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Export Modal */}
        {exportRecords && (
          <JsaExportModal
            records={exportRecords}
            onClose={() => setExportRecords(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between text-xs text-[#a78bfa]">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="text-white font-semibold">{value || "—"}</span>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SelectedJsaDetail({
  record,
  onClose,
  isFullscreen,
  onToggleFullscreen,
  onExport,
}: {
  record: GFJsaRow;
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onExport: () => void;
}) {
  // Use employee_signature as fallback for name if profile data unavailable
  const ownerName = record.user_name || record.employee_signature?.trim() || "Unknown User";
  const ownerEmail = record.user_email || "Not available";
  const ownerRole = record.user_role || "—";
  const jobs = (record.jobs_performed as JobSelection[] | undefined) ?? [];
  const weather = (record.weather_conditions as WeatherPayload | undefined) || {
    conditions: {},
    modifiers: {},
  };
  const weatherConditions = getActiveLabels(weather.conditions, WEATHER_CONDITIONS);
  const weatherModifiers = getActiveLabels(weather.modifiers, WEATHER_MODIFIERS);
  const hazardLabels = getActiveLabels(record.hazards_present, HAZARD_ITEMS);
  const trafficHazards = getActiveLabels(record.traffic_hazards, TRAFFIC_HAZARDS);
  const trafficSetup = getActiveLabels(record.traffic_setup, TRAFFIC_SETUP);
  const spanEntries = (record.spans as JsaSpan[] | undefined) ?? [];
  const observers = (Array.isArray(record.observer_signatures) ? record.observer_signatures : []) as ObserverSignature[];
  const sharedUsers = (Array.isArray(record.shared_with_users) ? record.shared_with_users : []) as SharedUser[];

  return (
    <div className={`space-y-5 text-sm text-[#f3e8ff]/90 ${isFullscreen ? "p-6 max-w-4xl mx-auto" : "p-6"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#2d1b4e] rounded-2xl border border-[#c084fc]/30">
            <ClipboardList className="w-5 h-5 text-[#c084fc]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#a78bfa]">JSA Details</p>
            <p className="text-lg font-semibold text-white">
              {record.work_location || "Untitled location"}
            </p>
            <p className="text-xs text-[#a78bfa]">{record.circuit_number || "No circuit noted"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            className="p-2 rounded-lg bg-[#0a0513]/70 border border-[#c084fc]/25 text-[#c084fc] hover:bg-[#c084fc]/10 transition-all"
            title="Export JSA"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-2 rounded-lg bg-[#0a0513]/70 border border-[#c084fc]/25 text-[#c084fc] hover:bg-[#c084fc]/10 transition-all"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#0a0513]/70 border border-[#c084fc]/25 text-[#a78bfa] hover:text-white hover:bg-[#c084fc]/10 transition-all"
            aria-label="Close compliance overview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`space-y-4 ${isFullscreen ? "grid md:grid-cols-2 gap-4 space-y-0" : ""}`}>
        <DetailCard title="Owner & Job" icon={<User className="w-4 h-4" />}>
          <div className="grid grid-cols-1 gap-1 text-xs text-[#e9d5ff]">
            <div className="flex items-center justify-between text-xs text-[#c7b696] py-1">
              <span className="uppercase tracking-wide">Owner</span>
              <div className="flex items-center gap-1.5 text-white font-semibold text-right max-w-[60%]">
                <span className="truncate">{ownerName}</span>
                {ownerName === "Unknown User" && record.user_id && (
                  <Info
                    className="w-3 h-3 text-[#c7b696] flex-shrink-0 cursor-help"
                    aria-label={`User ID: ${record.user_id}`}
                  />
                )}
              </div>
            </div>
            <DetailRow label="Email" value={ownerEmail} />
            <DetailRow label="Role" value={ownerRole} />
            <DetailRow label="Job Date" value={formatDate(record.job_date)} />
            <DetailRow label="Call Times" value={`${record.call_in_time || "—"} → ${record.call_out_time || "—"}`} />
            <DetailRow label="Status" value={record.status} />
            <DetailRow label="Type" value={record.submission_type === "paper" ? "Paper" : "Digital"} />
            <DetailRow label="Updated" value={formatDateTime(record.updated_at)} />
            <DetailRow label="Driver Signature" value={record.employee_signature?.trim() || "—"} />
          </div>
        </DetailCard>

        <DetailCard title="Observers" icon={<Users className="w-4 h-4" />}>
          {observers.length === 0 ? (
            <p className="text-xs text-[#a78bfa]">No observers for this JSA.</p>
          ) : (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {observers.map((obs, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#c084fc]/15 bg-[#1a0f2e]/50 p-3 space-y-1.5 text-xs"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-white truncate">{obs.name}</span>
                    <span className="text-[10px] text-[#a78bfa] shrink-0">
                      {obs.timestamp ? new Date(obs.timestamp).toLocaleDateString() : "—"}
                    </span>
                  </div>
                  {obs.role && <p className="text-[#a78bfa]">{obs.role}</p>}
                  {obs.signature_data && (
                    <p
                      className="text-base text-[#e9d5ff] break-words pt-1"
                      style={{ fontFamily: "Caveat, cursive" }}
                    >
                      {obs.signature_data}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Shared with" icon={<UserPlus className="w-4 h-4" />}>
          {sharedUsers.length === 0 ? (
            <p className="text-xs text-[#a78bfa]">Not shared with any users.</p>
          ) : (
            <div className="space-y-2">
              {sharedUsers.map((u) => (
                <div
                  key={u.id}
                  className="rounded-xl border border-[#c084fc]/15 bg-[#1a0f2e]/50 p-2.5 space-y-1 text-xs text-[#e9d5ff]"
                >
                  <div className="font-semibold text-white truncate">{u.full_name || "Unknown"}</div>
                  <div className="text-[#a78bfa] truncate">{u.email || "—"}</div>
                  {u.role ? <div className="text-[#a78bfa]">{u.role}</div> : null}
                </div>
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Emergency & Supervisors" icon={<Shield className="w-4 h-4" />}>
          <div className="grid grid-cols-1 gap-1 text-xs text-[#e9d5ff]">
            <DetailRow label="Nearest Hospital" value={record.nearest_hospital || "—"} />
            <DetailRow label="Nearest Clinic" value={record.nearest_clinic || "—"} />
            <DetailRow label="OC Contact" value={record.oc_contact || "—"} />
            <DetailRow label="DOC Contact" value={record.doc_contact || "—"} />
            <DetailRow label="GF Contact" value={record.gf_contact || "—"} />
            <DetailRow label="Safety Contact" value={record.safety_contact || "—"} />
          </div>
        </DetailCard>

        <DetailCard title="Jobs & Weather" icon={<Thermometer className="w-4 h-4" />}>
          <ChipSection title="Jobs Performed" chips={jobs.map((job) => job.label ?? job.key)} emptyText="No jobs selected." />
          <ChipSection title="Conditions" chips={weatherConditions} />
          <ChipSection title="Surface" chips={weatherModifiers} />
          <p className="text-xs text-[#e9d5ff] pt-2">
            <span className="font-semibold text-white">Weather hazards: </span>
            {record.weather_hazards?.trim() || "None provided."}
          </p>
        </DetailCard>

        <DetailCard title="Hazards & Traffic" icon={<AlertTriangle className="w-4 h-4" />}>
          <ChipSection title="Electrical / Structural" chips={hazardLabels} emptyText="No hazards flagged." />
          <ChipSection title="Traffic Hazards" chips={trafficHazards} emptyText="No traffic hazards flagged." />
          <ChipSection title="Work Zone Setup" chips={trafficSetup} emptyText="No setup details flagged." />
        </DetailCard>

        <DetailCard title="Span Walk-through" icon={<Wind className="w-4 h-4" />} className={isFullscreen ? "md:col-span-2" : ""}>
          {spanEntries.length === 0 ? (
            <p className="text-xs text-[#a78bfa]">No spans documented.</p>
          ) : (
            <div className={`grid gap-3 ${isFullscreen ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
              {spanEntries.map((span) => (
                <div
                  key={span.spanNumber}
                  className="rounded-2xl border border-[#c084fc]/20 bg-[#1a0f2e]/70 p-3 text-xs text-[#f3e8ff]/85 space-y-1"
                >
                  <div className="flex items-center justify-between text-[#e9d5ff]">
                    <span className="font-semibold text-white">Span #{span.spanNumber}</span>
                    <span className="text-[#a78bfa]">{span.location || "No location"}</span>
                  </div>
                  <p>
                    <span className="text-[#a78bfa] uppercase tracking-wide">Hazards:</span>{" "}
                    {span.hazards?.trim() || "None"}
                  </p>
                  <p>
                    <span className="text-[#a78bfa] uppercase tracking-wide">Mitigation:</span>{" "}
                    {span.mitigation?.trim() || "None"}
                  </p>
                  {span.initials && (
                    <p className="text-[#a78bfa]">
                      Initials: <span className="text-white">{span.initials}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Notes & Signature" icon={<AlignLeft className="w-4 h-4" />} className={isFullscreen ? "md:col-span-2" : ""}>
          <p className="text-xs text-[#e9d5ff]">
            <span className="font-semibold text-white">Signature:</span>{" "}
            {record.employee_signature || "Not captured"}
          </p>
          <p className="text-xs text-[#a78bfa] mt-2">
            <span className="font-semibold text-white">Notes:</span>{" "}
            {record.notes?.trim() || "No notes provided for this JSA."}
          </p>
        </DetailCard>
      </div>
    </div>
  );
}

function MobileJsaCard({
  record,
  onSelect,
  isSelected,
  isChecked,
  onCheckToggle,
}: {
  record: GFJsaRow;
  onSelect: () => void;
  isSelected: boolean;
  isChecked: boolean;
  onCheckToggle: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border ${
        isSelected ? "border-[#c084fc]" : "border-[#c084fc]/20"
      } bg-[#1a0f2e]/70 p-4 space-y-3 shadow-lg shadow-black/30`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={onCheckToggle}
            className="w-4 h-4 accent-[#c084fc] rounded cursor-pointer mt-1 flex-shrink-0"
            aria-label={`Select JSA for ${record.work_location || 'unknown location'}`}
          />
          <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#c084fc]/80 mb-1">
            {formatDate(record.job_date)}
          </p>
          <p className="text-base font-semibold text-white">
            {record.work_location || "Untitled location"}
          </p>
          <p className="text-xs text-[#a78bfa]">
            {record.circuit_number || "Circuit pending"}
          </p>
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[0.65rem] font-semibold ${
              statusBadge[record.status || "draft"] || statusBadge.draft
            }`}
          >
            {record.status || "draft"}
          </span>
          {record.submission_type === "paper" && (
            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Paper
            </span>
          )}
        </div>
      </div>

      <div className="text-xs text-[#a78bfa] space-y-1.5">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#c084fc]" />
          <span className="text-white/90">
            {record.user_name || record.employee_signature?.trim() || "Unknown User"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#9cf6d2]" />
          <span className="text-white/80">
            Signer: {record.employee_signature?.trim() || "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#9cf6d2]" />
          <span>{formatDateTime(record.updated_at || record.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#c084fc] hover:text-[#f3e8ff]"
        >
          View detail
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[#c084fc]/20 bg-[#1a0f2e]/70 p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#c084fc]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function ChipSection({
  title,
  chips,
  emptyText = "No data provided.",
}: {
  title: string;
  chips: string[];
  emptyText?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-[#c084fc]">{title}</p>
      {chips.length === 0 ? (
        <p className="text-xs text-[#a78bfa]">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] text-[#f3e8ff] bg-[#2d1b4e]/80 border border-[#c084fc]/30"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function getActiveLabels(
  map: Record<string, boolean> | null | undefined,
  catalog: { key: string; label: string }[]
) {
  if (!map) return [];
  return catalog.filter((item) => map[item.key]).map((item) => item.label);
}

