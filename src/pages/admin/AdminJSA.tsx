import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ClipboardList,
  Search,
  MapPin,
  User,
  Clock,
  AlignLeft,
  Thermometer,
  Wind,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  FileText,
  CheckCircle2,
  FileEdit,
  Calendar,
  SortDesc,
  SortAsc,
  X,
  Download,
  Maximize2,
  Minimize2,
  ChevronsLeft,
  ChevronsRight,
  Users,
  TrendingUp,
  Filter,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import type { DailyJsaRecord, JsaSpan } from "../forms/DailyJSAForm";
import TableSkeleton from "../../components/skeletons/TableSkeleton";
import CardListSkeleton from "../../components/skeletons/CardListSkeleton";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";

type AdminJsaRow = DailyJsaRecord & {
  user_email?: string | null;
  user_name?: string | null;
  user_role?: string | null;
};

type UserProfileMeta = {
  email?: string | null;
  role?: string | null;
  full_name?: string | null;
};

type SortField = "job_date" | "updated_at" | "work_location" | "user_name" | "status";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const DEFAULT_PAGE_SIZE = 20;

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

const statusBadge: Record<string, string> = {
  draft: "bg-[#2b1a07]/80 text-[#fcdca1] border border-[#f4c979]/40",
  completed: "bg-[#0f2218]/80 text-[#9cf6d2] border border-[#6fe9b7]/35",
};

export default function AdminJSA() {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState<AdminJsaRow[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "completed">("all");
  const [dateFilter, setDateFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [signatureFilter, setSignatureFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isDetailFullscreen, setIsDetailFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [jumpToPage, setJumpToPage] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    drafts: 0,
    completed: 0,
    todayCount: 0,
    weekCount: 0,
  });

  const tableRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Fetch stats on mount
  useEffect(() => {
    if (!isAdmin) return;
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [totalRes, draftsRes, completedRes, todayRes, weekRes] = await Promise.all([
        supabase.from("daily_jsa").select("*", { count: "exact", head: true }),
        supabase.from("daily_jsa").select("*", { count: "exact", head: true }).eq("status", "draft"),
        supabase.from("daily_jsa").select("*", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("daily_jsa").select("*", { count: "exact", head: true }).eq("job_date", today),
        supabase.from("daily_jsa").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
      ]);

      setStats({
        total: totalRes.count || 0,
        drafts: draftsRes.count || 0,
        completed: completedRes.count || 0,
        todayCount: todayRes.count || 0,
        weekCount: weekRes.count || 0,
      });
    };
    fetchStats();
  }, [isAdmin]);

  // Fetch all users for the filter dropdown
  useEffect(() => {
    if (!isAdmin) return;
    const fetchUsers = async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, email, full_name")
        .order("full_name", { ascending: true });

      if (data) {
        setAllUsers(
          data.map((u) => ({
            id: u.id,
            name: u.full_name || u.email || u.id,
            email: u.email || "",
          }))
        );
      }
    };
    fetchUsers();
  }, [isAdmin]);

  const fetchRecords = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase
        .from("daily_jsa")
        .select("*", { count: "exact" })
        .order(sortField === "user_name" ? "user_id" : sortField, { ascending: sortDirection === "asc" })
        .range(from, to);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (dateFilter) {
        query = query.gte("job_date", dateFilter);
      }

      if (dateEndFilter) {
        query = query.lte("job_date", dateEndFilter);
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

      if (userFilter) {
        query = query.eq("user_id", userFilter);
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
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("id, email, role, full_name")
          .in("id", userIds);

        if (profileError) {
          console.warn("Failed to load user metadata:", profileError.message);
        } else {
          (profileData as Array<UserProfileMeta & { id: string }> | null)?.forEach(
            (profile) => {
              userMap.set(profile.id, {
                email: profile.email,
                role: profile.role,
                full_name: profile.full_name,
              });
            }
          );
        }
      }

      const enriched = rows.map((row) => {
        const meta = userMap.get(row.user_id) || ({} as UserProfileMeta);
        return {
          ...row,
          user_email: meta.email || row.user_id,
          user_name: meta.full_name || meta.email || row.user_id,
          user_role: meta.role || "employee",
        };
      });

      // Sort by user_name if needed (since we can't sort by it directly in the query)
      if (sortField === "user_name") {
        enriched.sort((a, b) => {
          const nameA = (a.user_name || "").toLowerCase();
          const nameB = (b.user_name || "").toLowerCase();
          return sortDirection === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
      }

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
      console.error("Failed to load JSAs:", err);
      setError(message);
      setRecords([]);
      setTotal(0);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, page, pageSize, searchQuery, statusFilter, dateFilter, dateEndFilter, signatureFilter, userFilter, sortField, sortDirection]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, dateFilter, dateEndFilter, signatureFilter, userFilter, pageSize]);

  const selectedRecord = useMemo(
    () => records.find((row) => row.id === selectedId) || null,
    [records, selectedId]
  );

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Handle page jump
  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum);
      setJumpToPage("");
    }
  };

  // Export to CSV
  const handleExport = async () => {
    setIsExporting(true);
    try {
      let query = supabase.from("daily_jsa").select("*").order(sortField, { ascending: sortDirection === "asc" });

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (dateFilter) query = query.gte("job_date", dateFilter);
      if (dateEndFilter) query = query.lte("job_date", dateEndFilter);
      if (searchQuery.trim()) {
        const pattern = `%${searchQuery.trim()}%`;
        query = query.or(`work_location.ilike.${pattern},circuit_number.ilike.${pattern},notes.ilike.${pattern}`);
      }
      if (signatureFilter.trim()) query = query.ilike("employee_signature", `%${signatureFilter.trim()}%`);
      if (userFilter) query = query.eq("user_id", userFilter);

      const { data } = await query;
      if (!data) return;

      const headers = ["ID", "Job Date", "Location", "Circuit", "Status", "Updated", "Signer", "Notes"];
      const csvContent = [
        headers.join(","),
        ...data.map((r) =>
          [
            r.id,
            r.job_date || "",
            `"${(r.work_location || "").replace(/"/g, '""')}"`,
            `"${(r.circuit_number || "").replace(/"/g, '""')}"`,
            r.status || "",
            r.updated_at || "",
            `"${(r.employee_signature || "").replace(/"/g, '""')}"`,
            `"${(r.notes || "").replace(/"/g, '""')}"`,
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `jsa_export_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowLeft" && page > 1) {
        e.preventDefault();
        setPage((p) => p - 1);
      } else if (e.key === "ArrowRight" && page < totalPages) {
        e.preventDefault();
        setPage((p) => p + 1);
      } else if (e.key === "ArrowDown" && records.length > 0) {
        e.preventDefault();
        const currentIndex = records.findIndex((r) => r.id === selectedId);
        if (currentIndex < records.length - 1) {
          setSelectedId(records[currentIndex + 1].id);
        }
      } else if (e.key === "ArrowUp" && records.length > 0) {
        e.preventDefault();
        const currentIndex = records.findIndex((r) => r.id === selectedId);
        if (currentIndex > 0) {
          setSelectedId(records[currentIndex - 1].id);
        }
      } else if (e.key === "Escape" && isDetailFullscreen) {
        e.preventDefault();
        setIsDetailFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [page, totalPages, records, selectedId, isDetailFullscreen]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  // Check if any filters are active
  const hasActiveFilters = searchQuery.trim() || dateFilter || dateEndFilter || signatureFilter.trim() || userFilter;

  const clearAllFilters = () => {
    setSearchQuery("");
    setDateFilter("");
    setDateEndFilter("");
    setSignatureFilter("");
    setUserFilter("");
    setStatusFilter("all");
  };

  const SortableHeader = ({
    field,
    children,
    className = "",
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => {
    const isActive = sortField === field;
    return (
      <th
        className={`px-4 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors group ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1.5">
          <span>{children}</span>
          {isActive ? (
            sortDirection === "asc" ? (
              <SortAsc className="w-3.5 h-3.5 text-[#f4c979]" />
            ) : (
              <SortDesc className="w-3.5 h-3.5 text-[#f4c979]" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-[#c7b696]/50 group-hover:text-[#f4c979] transition-colors" />
          )}
        </div>
      </th>
    );
  };

  return (
    <DashboardLayout title="Daily JSA Oversight">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
        {/* Premium Glass Header - Gold Theme */}
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
                  "linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)",
                backdropFilter: "blur(24px) saturate(1.6)",
                WebkitBackdropFilter: "blur(24px) saturate(1.6)",
              }}
            >
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
                  background: "radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.2) 0%, transparent 45%)",
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
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#f4c979]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f8e5bb]">
                      Admin • Safety
                    </span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20"
                  >
                    <ClipboardList className="w-3 h-3 text-[#f4c979]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">
                      {statusFilter === "all" ? "All statuses" : statusFilter}
                    </span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0"
                    style={{ boxShadow: "0 0 20px rgba(244, 201, 121, 0.5), 0 0 40px rgba(244, 201, 121, 0.25)" }}
                  />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect
                        as="h1"
                        preset="blurSlide"
                        per="char"
                        delay={0.15}
                        className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight"
                        segmentWrapperClassName="bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,201,121,0.35)]"
                      >
                        Job Safety Analysis Oversight
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">
                        Job Safety Analysis Oversight
                      </h1>
                    )}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7 }}
                      className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium leading-relaxed max-w-xl"
                    >
                      Audit crew submissions, manage drafts, and surface field hazards • Use arrow keys to navigate
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        {/* Quick Stats Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"
        >
          <StatCard icon={<FileText className="w-5 h-5" />} label="Total JSAs" value={stats.total} color="gold" />
          <StatCard icon={<FileEdit className="w-5 h-5" />} label="Drafts" value={stats.drafts} color="amber" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Completed" value={stats.completed} color="emerald" />
          <StatCard icon={<Calendar className="w-5 h-5" />} label="Today" value={stats.todayCount} color="blue" />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="This Week" value={stats.weekCount} color="purple" />
        </motion.div>

        <div className="space-y-4">
          {/* Status Tabs & Actions */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              {statusFilters.map((filter) => {
                const isActive = statusFilter === filter.value;
                const count =
                  filter.value === "all" ? stats.total : filter.value === "draft" ? stats.drafts : stats.completed;
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
                        ? "bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] shadow-[0_8px_25px_rgba(244,201,121,0.35)]"
                        : "bg-[#0c0a08]/70 border border-[#f6dcb2]/20 text-[#f8e5bb]/80 hover:border-[#f4c979]/40 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {filter.label}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        isActive ? "bg-[#2e1b02]/20 text-[#2e1b02]" : "bg-white/10 text-[#f8e5bb]"
                      }`}
                    >
                      {count}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-[#0c0a08]/70 border border-[#f6dcb2]/20 text-[#f8e5bb]/80 hover:border-[#f4c979]/40 hover:text-white transition-all"
              >
                <Filter className="w-4 h-4" />
                {showFilters ? "Hide" : "Show"} Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-[#0c0a08]/70 border border-[#f6dcb2]/20 text-[#f8e5bb]/80 hover:border-[#f4c979]/40 hover:text-white transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {isExporting ? "Exporting..." : "Export CSV"}
              </motion.button>
            </div>
          </motion.div>

          {/* Search & Filters Bar */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-5 space-y-4 shadow-[0_25px_50px_rgba(0,0,0,0.55)]">
                  {/* Filter Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[#f4c979]">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#f8e5bb]/80 hover:text-white bg-white/5 border border-white/10 hover:border-[#f4c979]/40 transition-all"
                        >
                          <X className="w-3 h-3" />
                          Clear all filters
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {/* Search Input */}
                    <div className="relative lg:col-span-2">
                      <Search className="w-4 h-4 text-[#b59d72] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Location, circuit, notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-10 pr-4 py-2.5 text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                      />
                    </div>

                    {/* User Filter Dropdown */}
                    <div className="relative">
                      <Users className="w-4 h-4 text-[#b59d72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                      <select
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        aria-label="Filter by user"
                        title="Filter by user"
                        className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-10 pr-4 py-2.5 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 appearance-none cursor-pointer"
                      >
                        <option value="">All Users</option>
                        {allUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-[#b59d72] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Date Start Filter */}
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-[#b59d72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                      <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        title="Start date"
                        className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-10 pr-4 py-2.5 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 [color-scheme:dark]"
                      />
                    </div>

                    {/* Date End Filter */}
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-[#b59d72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                      <input
                        type="date"
                        value={dateEndFilter}
                        onChange={(e) => setDateEndFilter(e.target.value)}
                        title="End date"
                        className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-10 pr-4 py-2.5 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 [color-scheme:dark]"
                      />
                    </div>

                    {/* Signer Filter */}
                    <div className="relative">
                      <User className="w-4 h-4 text-[#b59d72] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Filter by signer name…"
                        value={signatureFilter}
                        onChange={(e) => setSignatureFilter(e.target.value)}
                        className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-10 pr-4 py-2.5 text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-[#ff8a65]/40 bg-[#2b120b]/70 text-[#ffb199] px-4 py-3 text-sm">
                      {error}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main Content Grid */}
        <div className={`grid gap-6 mt-6 ${isDetailFullscreen ? "" : "lg:grid-cols-[1fr,400px] xl:grid-cols-[1fr,450px]"}`}>
          {/* Table Section */}
          {!isDetailFullscreen && (
            <motion.div
              ref={tableRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] backdrop-blur-xl shadow-[0_35px_60px_rgba(0,0,0,0.6)] flex flex-col"
            >
              {loading ? (
                <div className="p-4 sm:p-6">
                  <TableSkeleton rows={6} columns={6} variant="gold" />
                </div>
              ) : records.length === 0 ? (
                <div className="p-12 text-center text-[#f8e5bb]/80 text-sm flex-1 flex items-center justify-center">
                  <div>
                    <ClipboardList className="w-12 h-12 text-[#f4c979]/40 mx-auto mb-3" />
                    <p>No JSAs match your filters yet.</p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="mt-3 text-[#f4c979] hover:text-[#fef3d1] underline text-sm"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto flex-1">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[0.65rem] uppercase tracking-[0.2em] text-[#f4c979]/80 border-b border-[#f6dcb2]/20">
                          <SortableHeader field="job_date">Job Date</SortableHeader>
                          <SortableHeader field="work_location">Location</SortableHeader>
                          <SortableHeader field="user_name">Owner</SortableHeader>
                          <th className="px-4 py-3 text-left">Signer</th>
                          <SortableHeader field="status">Status</SortableHeader>
                          <SortableHeader field="updated_at">Updated</SortableHeader>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record, index) => {
                          const isSelected = record.id === selectedId;
                          return (
                            <tr
                              key={record.id}
                              onClick={() => setSelectedId(record.id)}
                              className={`border-b border-[#f6dcb2]/10 text-sm text-[#fdf4db]/85 transition cursor-pointer ${
                                isSelected
                                  ? "bg-[#f4c979]/10 border-l-2 border-l-[#f4c979]"
                                  : "hover:bg-white/5"
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-[#c7b696] text-xs w-5">{(page - 1) * pageSize + index + 1}</span>
                                  <span className="font-medium">{formatDate(record.job_date)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-[#f4c979] flex-shrink-0" />
                                  <div className="min-w-0">
                                    <span className="font-semibold text-white block truncate max-w-[200px]">
                                      {record.work_location || "N/A"}
                                    </span>
                                    <p className="text-xs text-[#c7b696] truncate max-w-[200px]">
                                      {record.circuit_number || "—"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-[#f4c979] flex-shrink-0" />
                                  <div className="min-w-0">
                                    <span className="block truncate max-w-[140px]">
                                      {record.user_name || record.user_email || record.user_id}
                                    </span>
                                    <p className="text-xs text-[#c7b696]">{record.user_role || "employee"}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-white truncate block max-w-[120px]">
                                  {record.employee_signature?.trim() || "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    statusBadge[record.status || "draft"] || statusBadge.draft
                                  }`}
                                >
                                  {record.status === "completed" ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                  ) : (
                                    <FileEdit className="w-3 h-3" />
                                  )}
                                  {record.status || "draft"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-[#c7b696]">
                                {formatDateTime(record.updated_at || record.created_at)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(record.id);
                                  }}
                                  className={`text-sm font-semibold ${
                                    isSelected ? "text-[#fef3d1]" : "text-[#f4c979] hover:text-[#fef3d1]"
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

                  {/* Mobile Cards */}
                  <div className="lg:hidden space-y-3 p-4">
                    {records.map((record) => (
                      <MobileJsaCard
                        key={record.id}
                        record={record}
                        isSelected={record.id === selectedId}
                        onSelect={() => setSelectedId(record.id)}
                      />
                    ))}
                  </div>

                  {/* Enhanced Pagination */}
                  <div className="border-t border-[#f6dcb2]/20 p-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      {/* Left: Page Size & Info */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-[#c7b696]">
                          <span>Show</span>
                          <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            aria-label="Items per page"
                            title="Items per page"
                            className="rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 px-2 py-1 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                          >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                          <span>per page</span>
                        </div>
                        <span className="text-sm text-[#c7b696] hidden sm:inline">
                          Showing{" "}
                          <span className="text-[#f4c979] font-semibold">
                            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}
                          </span>{" "}
                          of <span className="text-[#f4c979] font-semibold">{total}</span>
                        </span>
                      </div>

                      {/* Right: Navigation */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage(1)}
                          disabled={page === 1 || loading}
                          className="p-2 rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          title="First page"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1 || loading}
                          className="p-2 rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          title="Previous page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        {/* Page Number Display / Jump */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-[#c7b696]">Page</span>
                          <input
                            type="text"
                            value={jumpToPage || page}
                            onChange={(e) => setJumpToPage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleJumpToPage();
                              }
                            }}
                            onBlur={handleJumpToPage}
                            aria-label="Jump to page"
                            title="Jump to page"
                            className="w-12 rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 px-2 py-1 text-sm text-[#fdf4db] text-center focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                          />
                          <span className="text-sm text-[#c7b696]">of {totalPages}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages || loading}
                          className="p-2 rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          title="Next page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage(totalPages)}
                          disabled={page >= totalPages || loading}
                          className="p-2 rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          title="Last page"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Detail Panel */}
          <AnimatePresence mode="wait">
            {(selectedRecord || isDetailFullscreen) && (
              <motion.div
                key={isDetailFullscreen ? "fullscreen" : "panel"}
                initial={{ opacity: 0, x: isDetailFullscreen ? 0 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isDetailFullscreen ? 0 : 20 }}
                transition={{ duration: 0.3 }}
                className={`rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#070605] backdrop-blur-xl shadow-[0_35px_60px_rgba(0,0,0,0.6)] ${
                  isDetailFullscreen
                    ? "fixed inset-4 z-50 overflow-auto"
                    : "p-6 min-h-[500px] max-h-[calc(100vh-200px)] overflow-auto sticky top-24"
                }`}
              >
                {loading ? (
                  <div className={isDetailFullscreen ? "p-6" : ""}>
                    <CardListSkeleton rows={2} variant="gold" />
                  </div>
                ) : selectedRecord ? (
                  <SelectedJsaDetail
                    record={selectedRecord}
                    onClose={() => setSelectedId(null)}
                    isFullscreen={isDetailFullscreen}
                    onToggleFullscreen={() => setIsDetailFullscreen(!isDetailFullscreen)}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-[#f8e5bb]/70 gap-3 py-12">
                    <ClipboardList className="w-10 h-10 text-[#f4c979]" />
                    <p className="text-sm">Select a JSA to view its details.</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-4 text-center text-xs text-[#c7b696]/60">
          <span className="hidden sm:inline">
            Use <kbd className="px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20">←</kbd>{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20">→</kbd> for pages,{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20">↑</kbd>{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20">↓</kbd> for rows,{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20">Esc</kbd> to exit fullscreen
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "gold" | "amber" | "emerald" | "blue" | "purple";
}) {
  const colorClasses = {
    gold: "from-[#f4c979]/20 to-[#d79a32]/10 border-[#f4c979]/30 text-[#f4c979]",
    amber: "from-[#fbbf24]/20 to-[#d97706]/10 border-[#fbbf24]/30 text-[#fbbf24]",
    emerald: "from-[#34d399]/20 to-[#059669]/10 border-[#34d399]/30 text-[#34d399]",
    blue: "from-[#60a5fa]/20 to-[#2563eb]/10 border-[#60a5fa]/30 text-[#60a5fa]",
    purple: "from-[#a78bfa]/20 to-[#7c3aed]/10 border-[#a78bfa]/30 text-[#a78bfa]",
  };

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br ${colorClasses[color]} p-4 flex items-center gap-3`}
    >
      <div className={`p-2 rounded-xl bg-black/20`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
        <p className="text-xs text-[#c7b696]">{label}</p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between text-xs text-[#c7b696] py-1">
      <span className="uppercase tracking-wide">{label}</span>
      <span className="text-white font-semibold text-right max-w-[60%] truncate">{value || "—"}</span>
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
}: {
  record: AdminJsaRow;
  onClose: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const ownerName = record.user_name || record.user_email || record.user_id;
  const ownerEmail = record.user_email || record.user_id || "Unknown";
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

  return (
    <div className={`space-y-5 text-sm text-[#fdf4db]/90 ${isFullscreen ? "p-6 max-w-4xl mx-auto" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#211c15] rounded-2xl border border-[#f6dcb2]/30">
            <ClipboardList className="w-5 h-5 text-[#f4c979]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[#c7b696]">JSA Details</p>
            <p className="text-lg font-semibold text-white">{record.work_location || "Untitled location"}</p>
            <p className="text-xs text-[#c7b696]">{record.circuit_number || "No circuit noted"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-2 rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/10 transition-all"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#c7b696] hover:text-white hover:bg-[#f4c979]/10 transition-all"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={`space-y-4 ${isFullscreen ? "grid md:grid-cols-2 gap-4 space-y-0" : ""}`}>
        <DetailCard title="Owner & Job" icon={<User className="w-4 h-4" />}>
          <div className="grid grid-cols-1 gap-1 text-xs text-[#f0e2c7]">
            <DetailRow label="Owner" value={ownerName} />
            <DetailRow label="Email" value={ownerEmail} />
            <DetailRow label="Job Date" value={formatDate(record.job_date)} />
            <DetailRow label="Call Times" value={`${record.call_in_time || "—"} → ${record.call_out_time || "—"}`} />
            <DetailRow label="Status" value={record.status} />
            <DetailRow label="Updated" value={formatDateTime(record.updated_at)} />
            <DetailRow label="Driver Signature" value={record.employee_signature?.trim() || "—"} />
          </div>
        </DetailCard>

        <DetailCard title="Emergency & Supervisors" icon={<Shield className="w-4 h-4" />}>
          <div className="grid grid-cols-1 gap-1 text-xs text-[#f0e2c7]">
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
          <p className="text-xs text-[#f0e2c7] pt-2">
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
            <p className="text-xs text-[#c7b696]">No spans documented.</p>
          ) : (
            <div className={`grid gap-3 ${isFullscreen ? "md:grid-cols-2 lg:grid-cols-3" : ""}`}>
              {spanEntries.map((span) => (
                <div
                  key={span.spanNumber}
                  className="rounded-2xl border border-[#f6dcb2]/20 bg-[#120f0c]/70 p-3 text-xs text-[#fdf4db]/85 space-y-1"
                >
                  <div className="flex items-center justify-between text-[#f0e2c7]">
                    <span className="font-semibold text-white">Span #{span.spanNumber}</span>
                    <span className="text-[#c7b696]">{span.location || "No location"}</span>
                  </div>
                  <p>
                    <span className="text-[#c7b696] uppercase tracking-wide">Hazards:</span> {span.hazards?.trim() || "None"}
                  </p>
                  <p>
                    <span className="text-[#c7b696] uppercase tracking-wide">Mitigation:</span>{" "}
                    {span.mitigation?.trim() || "None"}
                  </p>
                  {span.initials && (
                    <p className="text-[#c7b696]">
                      Initials: <span className="text-white">{span.initials}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DetailCard>

        <DetailCard title="Notes & Signature" icon={<AlignLeft className="w-4 h-4" />} className={isFullscreen ? "md:col-span-2" : ""}>
          <p className="text-xs text-[#f0e2c7]">
            <span className="font-semibold text-white">Signature:</span> {record.employee_signature || "Not captured"}
          </p>
          <p className="text-xs text-[#c7b696] mt-2">
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
}: {
  record: AdminJsaRow;
  onSelect: () => void;
  isSelected: boolean;
}) {
  return (
    <div
      onClick={onSelect}
      className={`rounded-2xl border ${
        isSelected ? "border-[#f4c979] bg-[#f4c979]/5" : "border-[#f6dcb2]/20"
      } bg-[#120f0c]/70 p-4 space-y-3 shadow-lg shadow-black/30 cursor-pointer transition-all active:scale-[0.98]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#f4c979]/80 mb-1">{formatDate(record.job_date)}</p>
          <p className="text-base font-semibold text-white">{record.work_location || "Untitled location"}</p>
          <p className="text-xs text-[#c7b696]">{record.circuit_number || "Circuit pending"}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.65rem] font-semibold ${
            statusBadge[record.status || "draft"] || statusBadge.draft
          }`}
        >
          {record.status === "completed" ? <CheckCircle2 className="w-3 h-3" /> : <FileEdit className="w-3 h-3" />}
          {record.status || "draft"}
        </span>
      </div>

      <div className="text-xs text-[#c7b696] space-y-1.5">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#f4c979]" />
          <span className="text-white/90">{record.user_name || record.user_email || record.user_id}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-[#9cf6d2]" />
          <span className="text-white/80">Signer: {record.employee_signature?.trim() || "—"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#9cf6d2]" />
          <span>{formatDateTime(record.updated_at || record.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#f4c979]">
          {isSelected ? "Selected" : "View detail"}
          <ChevronRight className="w-4 h-4" />
        </span>
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
    <div className={`rounded-2xl border border-[#f6dcb2]/20 bg-[#120f0c]/70 p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[#d3c2a1]">
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
      <p className="text-[0.65rem] uppercase tracking-wide text-[#d3c2a1]">{title}</p>
      {chips.length === 0 ? (
        <p className="text-xs text-[#c7b696]">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] text-[#fef3d1] bg-[#2b251b]/80 border border-[#f6dcb2]/30"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function getActiveLabels(map: Record<string, boolean> | null | undefined, catalog: { key: string; label: string }[]) {
  if (!map) return [];
  return catalog.filter((item) => map[item.key]).map((item) => item.label);
}
