import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ClipboardList,
  Search,
  User,
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
  ChevronsLeft,
  ChevronsRight,
  Users,
  TrendingUp,
  Filter,
  ChevronDown,
  ArrowUpDown,
  FileSpreadsheet,
  Table,
  FileDown,
  MapPin,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import type { DailyJsaRecord } from "../forms/DailyJSAForm";
import TableSkeleton from "../../components/skeletons/TableSkeleton";
import CardListSkeleton from "../../components/skeletons/CardListSkeleton";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import {
  DataExporter,
  generateFilename,
  type ExportMetadata,
} from "../../lib/exportUtils";
import { logger } from "../../lib/logger";

// Import from extracted module
import {
  type AdminJsaRow,
  type UserProfileMeta,
  type SortField,
  type SortDirection,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  STATUS_FILTERS,
  STATUS_BADGE,
  JSA_EXPORT_COLUMNS,
  formatDate,
  formatDateTime,
  StatCard,
  MobileJsaCard,
  SelectedJsaDetail,
} from "./admin-jsa";

// Use STATUS_FILTERS from module
const statusFilters = STATUS_FILTERS;

// Use imported constants from module
const jsaExportColumns = JSA_EXPORT_COLUMNS;
const statusBadge = STATUS_BADGE;

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

  // Helper function to fetch user profiles in batches for large datasets
  const fetchUserProfilesInBatches = useCallback(
    async (
      userIds: string[],
      batchSize = 100
    ): Promise<Array<{ user_id: string; email: string | null; role: string | null; full_name: string | null }>> => {
      if (userIds.length === 0) return [];

      // For small datasets, use single query
      if (userIds.length <= batchSize) {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("user_id, email, role, full_name")
          .in("user_id", userIds);

        if (error) {
          logger.error("Failed to fetch user profiles", { error, userIds: userIds.length });
          return [];
        }
        return data || [];
      }

      // For large datasets, batch queries
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

      return results.flatMap((r) => {
        if (r.error) {
          logger.error("Failed to fetch user profile batch", { error: r.error, batchSize: 0 });
          return [];
        }
        return (r.data as unknown as Array<{ user_id: string; email: string | null; role: string | null; full_name: string | null }>) || [];
      });
    },
    []
  );

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
        const profiles = await fetchUserProfilesInBatches(userIds);
        profiles.forEach((profile) => {
          userMap.set(profile.user_id, {
            email: profile.email,
            role: profile.role,
            full_name: profile.full_name,
          });
        });
      }

      const enriched = rows.map((row) => {
        const meta = userMap.get(row.user_id) || ({} as UserProfileMeta);
        return {
          ...row,
          user_email: meta.email || null,
          user_name: meta.full_name || meta.email || "Unknown User",
          user_role: meta.role || "No role assigned",
          user_id: row.user_id, // Keep UUID for debugging/admin purposes
        };
      });

      // Log missing user profiles for ops visibility
      const unknownUserCount = enriched.filter((r) => r.user_name === "Unknown User").length;
      if (unknownUserCount > 0) {
        logger.warn("admin_jsa_unknown_users", {
          count: unknownUserCount,
          total_jsas: enriched.length,
          percentage: ((unknownUserCount / enriched.length) * 100).toFixed(2),
          affected_user_ids: enriched
            .filter((r) => r.user_name === "Unknown User")
            .map((r) => r.user_id)
            .slice(0, 10), // Limit to first 10 for log size
        });
      }

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
  }, [isAdmin, page, pageSize, searchQuery, statusFilter, dateFilter, dateEndFilter, signatureFilter, userFilter, sortField, sortDirection, fetchUserProfilesInBatches]);

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

  // Export JSA records
  const handleExport = useCallback(async (exportFormat: "csv" | "excel" | "pdf") => {
    setIsExporting(true);
    try {
      // Map user_name to user_id since user_name is a computed field from join
      const dbSortField = sortField === "user_name" ? "user_id" : sortField;
      let query = supabase.from("daily_jsa").select("*").order(dbSortField, { ascending: sortDirection === "asc" });

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
      if (!data || data.length === 0) return;

      // Enrich with user names
      const enrichedData: AdminJsaRow[] = data.map((record) => {
        const userMeta = allUsers.find((u) => u.id === record.user_id);
        return {
          ...record,
          user_name: userMeta?.name || "Unknown",
          user_email: userMeta?.email || null,
        };
      });

      const exporter = new DataExporter<AdminJsaRow>();
      const metadata: ExportMetadata = {
        reportType: "Daily JSA Records Export",
        generatedAt: new Date(),
        exportedBy: "Admin Portal",
        filters: {
          "Status": statusFilter === "all" ? "All" : statusFilter === "completed" ? "Completed" : "Draft",
          "Date Range": dateFilter || dateEndFilter ? `${dateFilter || "Start"} to ${dateEndFilter || "End"}` : "All Time",
          "Search": searchQuery.trim() || "None",
        },
        totalRecords: enrichedData.length,
      };

      const dateContext = dateFilter || dateEndFilter ? `${dateFilter || "start"}_to_${dateEndFilter || "now"}` : undefined;
      const filename = generateFilename("JSA_Records_Export", dateContext);

      switch (exportFormat) {
        case "csv":
          exporter.exportCSV({
            data: enrichedData,
            columns: jsaExportColumns,
            filename,
            metadata,
          });
          break;
        case "excel":
          // Must await async export methods to ensure loading state and error handling work correctly
          await exporter.exportExcel({
            data: enrichedData,
            columns: jsaExportColumns,
            filename: filename.replace(".csv", ".xlsx"),
            metadata,
          });
          break;
        case "pdf":
          // Must await async export methods to ensure loading state and error handling work correctly
          await exporter.exportPDF({
            data: enrichedData,
            columns: jsaExportColumns,
            filename: filename.replace(".csv", ".pdf"),
            metadata,
            companyName: "All Terrain Tree Service",
            subtitle: `Status: ${statusFilter === "all" ? "All" : statusFilter === "completed" ? "Completed" : "Draft"}`,
            orientation: "landscape",
          });
          break;
      }
    } finally {
      setIsExporting(false);
    }
  }, [sortField, sortDirection, statusFilter, dateFilter, dateEndFilter, searchQuery, signatureFilter, userFilter, allUsers]);

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
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-5"
        >
          <StatCard icon={<FileText />} label="Total JSAs" value={stats.total} color="gold" />
          <StatCard icon={<FileEdit />} label="Drafts" value={stats.drafts} color="amber" />
          <StatCard icon={<CheckCircle2 />} label="Completed" value={stats.completed} color="emerald" />
          <StatCard icon={<Calendar />} label="Today" value={stats.todayCount} color="blue" />
          <StatCard icon={<TrendingUp />} label="This Week" value={stats.weekCount} color="purple" />
        </motion.div>

        <div className="space-y-4">
          {/* Status Tabs & Actions */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            {/* Status Filter Buttons - Scrollable on mobile */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-thin scrollbar-thumb-[#f4c979]/20">
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
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 min-h-[40px] sm:min-h-[44px] flex-shrink-0 ${
                      isActive
                        ? "bg-gradient-to-r from-[#f7e4bd] via-[#f4c979] to-[#d79a32] text-[#2e1b02] shadow-[0_8px_25px_rgba(244,201,121,0.35)]"
                        : "bg-[#0c0a08]/70 border border-[#f6dcb2]/20 text-[#f8e5bb]/80 hover:border-[#f4c979]/40 hover:text-white active:bg-[#f4c979]/10"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">{filter.label}</span>
                    <span className="xs:hidden">{filter.label.slice(0, 3)}</span>
                    <span
                      className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs ${
                        isActive ? "bg-[#2e1b02]/20 text-[#2e1b02]" : "bg-white/10 text-[#f8e5bb]"
                      }`}
                    >
                      {count}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium bg-[#0c0a08]/70 border border-[#f6dcb2]/20 text-[#f8e5bb]/80 hover:border-[#f4c979]/40 hover:text-white active:bg-[#f4c979]/10 transition-all min-h-[40px] sm:min-h-[44px]"
              >
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{showFilters ? "Hide" : "Show"} Filters</span>
                <span className="sm:hidden">Filter</span>
                <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </motion.button>

              {/* Export Dropdown */}
              <div className="relative group">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium bg-[#0c0a08]/70 border border-[#f6dcb2]/20 text-[#f8e5bb]/80 hover:border-[#f4c979]/40 hover:text-white active:bg-[#f4c979]/10 transition-all disabled:opacity-50 min-h-[40px] sm:min-h-[44px]"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{isExporting ? "Exporting..." : "Export"}</span>
                </motion.button>
                <div className="absolute right-0 top-full mt-1 w-28 sm:w-32 bg-[#0c0a08] border border-[#f6dcb2]/20 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                  <button onClick={() => handleExport("csv")} disabled={isExporting} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[#f8e5bb]/70 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors rounded-t-xl min-h-[40px]">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button onClick={() => handleExport("excel")} disabled={isExporting} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[#f8e5bb]/70 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors min-h-[40px]">
                    <Table className="w-3.5 h-3.5" /> Excel
                  </button>
                  <button onClick={() => handleExport("pdf")} disabled={isExporting} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[#f8e5bb]/70 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors rounded-b-xl min-h-[40px]">
                    <FileDown className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>
              </div>
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
                <div className="rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-3 sm:p-5 space-y-3 sm:space-y-4 shadow-[0_25px_50px_rgba(0,0,0,0.55)]">
                  {/* Filter Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#f4c979]">
                      <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden xs:inline">Search & Filter</span>
                      <span className="xs:hidden">Filters</span>
                    </div>
                    <AnimatePresence>
                      {hasActiveFilters && (
                        <motion.button
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          type="button"
                          onClick={clearAllFilters}
                          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold text-[#f8e5bb]/80 hover:text-white active:text-white bg-white/5 border border-white/10 hover:border-[#f4c979]/40 active:bg-[#f4c979]/10 transition-all min-h-[32px] sm:min-h-[36px]"
                        >
                          <X className="w-3 h-3" />
                          <span className="hidden sm:inline">Clear all</span>
                          <span className="sm:hidden">Clear</span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="grid gap-2 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {/* Search Input */}
                    <div className="relative sm:col-span-2 lg:col-span-2">
                      <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Location, circuit, notes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl sm:rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 min-h-[40px] sm:min-h-[44px]"
                      />
                    </div>

                    {/* User Filter Dropdown */}
                    <div className="relative">
                      <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                      <select
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        aria-label="Filter by user"
                        title="Filter by user"
                        className="w-full rounded-xl sm:rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-8 sm:pl-10 pr-8 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 appearance-none cursor-pointer min-h-[40px] sm:min-h-[44px]"
                      >
                        <option value="">All Users</option>
                        {allUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    {/* Date Filters - Side by side on mobile */}
                    <div className="grid grid-cols-2 gap-2 sm:contents">
                      {/* Date Start Filter */}
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                        <input
                          type="date"
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                          title="Start date"
                          className="w-full rounded-xl sm:rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-8 sm:pl-10 pr-2 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 [color-scheme:dark] min-h-[40px] sm:min-h-[44px]"
                        />
                      </div>

                      {/* Date End Filter */}
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                        <input
                          type="date"
                          value={dateEndFilter}
                          onChange={(e) => setDateEndFilter(e.target.value)}
                          title="End date"
                          className="w-full rounded-xl sm:rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-8 sm:pl-10 pr-2 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 [color-scheme:dark] min-h-[40px] sm:min-h-[44px]"
                        />
                      </div>
                    </div>

                    {/* Signer Filter */}
                    <div className="relative">
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Signer name…"
                        value={signatureFilter}
                        onChange={(e) => setSignatureFilter(e.target.value)}
                        className="w-full rounded-xl sm:rounded-2xl bg-[#050402]/70 border border-[#f4c979]/25 pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 min-h-[40px] sm:min-h-[44px]"
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
        <div className="mt-6">
          {/* Table Section */}
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

                  {/* Enhanced Pagination - Mobile optimized */}
                  <div className="border-t border-[#f6dcb2]/20 p-3 sm:p-4">
                    <div className="flex flex-col gap-3 sm:gap-4">
                      {/* Mobile: Compact info row */}
                      <div className="flex items-center justify-between sm:hidden">
                        <span className="text-[10px] sm:text-xs text-[#c7b696]">
                          <span className="text-[#f4c979] font-semibold">
                            {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}
                          </span>{" "}
                          of {total}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            aria-label="Items per page"
                            title="Items per page"
                            className="rounded-md bg-[#050402]/70 border border-[#f4c979]/25 px-2 py-1 text-[10px] text-[#fdf4db] focus:outline-none"
                          >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                              <option key={size} value={size}>
                                {size}
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-[#c7b696]">/ page</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:gap-4">
                        {/* Desktop: Page Size & Info */}
                        <div className="hidden sm:flex items-center gap-4">
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-[#c7b696]">
                            <span>Show</span>
                            <select
                              value={pageSize}
                              onChange={(e) => setPageSize(Number(e.target.value))}
                              aria-label="Items per page"
                              title="Items per page"
                              className="rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 px-2 py-1 text-xs sm:text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                            >
                              {PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                            <span>per page</span>
                          </div>
                          <span className="text-xs sm:text-sm text-[#c7b696]">
                            Showing{" "}
                            <span className="text-[#f4c979] font-semibold">
                              {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)}
                            </span>{" "}
                            of <span className="text-[#f4c979] font-semibold">{total}</span>
                          </span>
                        </div>

                        {/* Navigation - responsive */}
                        <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center sm:justify-end">
                          <button
                            type="button"
                            onClick={() => setPage(1)}
                            disabled={page === 1 || loading}
                            className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/10 active:bg-[#f4c979]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all min-h-[36px] sm:min-h-[40px] min-w-[36px] sm:min-w-[40px] flex items-center justify-center"
                            title="First page"
                          >
                            <ChevronsLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/10 active:bg-[#f4c979]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all min-h-[36px] sm:min-h-[40px] min-w-[36px] sm:min-w-[40px] flex items-center justify-center"
                            title="Previous page"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>

                          {/* Page Number Display / Jump */}
                          <div className="flex items-center gap-1 sm:gap-2">
                            <span className="text-[10px] sm:text-sm text-[#c7b696] hidden xs:inline">Page</span>
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
                              className="w-10 sm:w-12 rounded-md sm:rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 px-1 sm:px-2 py-1 text-xs sm:text-sm text-[#fdf4db] text-center focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 min-h-[36px] sm:min-h-[40px]"
                            />
                            <span className="text-[10px] sm:text-sm text-[#c7b696]">/ {totalPages}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                            className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/10 active:bg-[#f4c979]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all min-h-[36px] sm:min-h-[40px] min-w-[36px] sm:min-w-[40px] flex items-center justify-center"
                            title="Next page"
                          >
                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPage(totalPages)}
                            disabled={page >= totalPages || loading}
                            className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-[#050402]/70 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/10 active:bg-[#f4c979]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all min-h-[36px] sm:min-h-[40px] min-w-[36px] sm:min-w-[40px] flex items-center justify-center"
                            title="Last page"
                          >
                            <ChevronsRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
        </div>

        {/* Detail Panel - Overlay Modal */}
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
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              />
              {/* Modal */}
              <motion.div
                key={isDetailFullscreen ? "fullscreen" : "modal"}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={`fixed z-50 rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#070605] backdrop-blur-xl shadow-[0_35px_60px_rgba(0,0,0,0.6)] overflow-auto ${
                  isDetailFullscreen
                    ? "inset-2 sm:inset-4"
                    : "inset-3 sm:inset-6 md:inset-8 lg:inset-12 xl:inset-x-[15%] xl:inset-y-8 max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)]"
                }`}
              >
                {loading ? (
                  <div className="p-4 sm:p-6">
                    <CardListSkeleton rows={2} variant="gold" />
                  </div>
                ) : (
                  <SelectedJsaDetail
                    record={selectedRecord}
                    onClose={() => setSelectedId(null)}
                    isFullscreen={isDetailFullscreen}
                    onToggleFullscreen={() => setIsDetailFullscreen(!isDetailFullscreen)}
                  />
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Keyboard shortcut hint - Desktop only */}
        <div className="hidden sm:block mt-4 text-center text-[10px] sm:text-xs text-[#c7b696]/60">
          Use <kbd className="px-1 sm:px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20 text-[9px] sm:text-xs">←</kbd>{" "}
          <kbd className="px-1 sm:px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20 text-[9px] sm:text-xs">→</kbd> for pages,{" "}
          <kbd className="px-1 sm:px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20 text-[9px] sm:text-xs">↑</kbd>{" "}
          <kbd className="px-1 sm:px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20 text-[9px] sm:text-xs">↓</kbd> for rows,{" "}
          <kbd className="px-1 sm:px-1.5 py-0.5 rounded bg-[#1b1914] border border-[#f6dcb2]/20 text-[9px] sm:text-xs">Esc</kbd> to exit fullscreen
        </div>
      </div>
    </DashboardLayout>
  );
}
