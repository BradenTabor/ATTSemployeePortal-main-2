import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Sparkles,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { subscribeToTableChanges } from "../../lib/realtime";
import { logger } from "../../lib/logger";
import TableSkeleton from "../../components/skeletons/TableSkeleton";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";

interface RTORequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "Pending" | "Approved" | "Denied";
  submitted_at: string;
  email: string;
  full_name: string;
}

interface StatusConfig {
  label: string;
  color: "amber" | "emerald" | "red";
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: React.ReactNode;
  glowColor: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  Pending: {
    label: "Pending",
    color: "amber",
    bgColor: "bg-[#f7dca8]/15",
    borderColor: "border-[#f4c979]/40",
    textColor: "text-[#fef3d1]",
    icon: <Clock className="w-3.5 h-3.5" />,
    glowColor: "shadow-[0_0_12px_rgba(244,201,121,0.2)]",
  },
  Approved: {
    label: "Approved",
    color: "emerald",
    bgColor: "bg-emerald-500/15",
    borderColor: "border-emerald-400/35",
    textColor: "text-emerald-300",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    glowColor: "shadow-[0_0_12px_rgba(52,211,153,0.2)]",
  },
  Denied: {
    label: "Denied",
    color: "red",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-400/30",
    textColor: "text-red-300",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    glowColor: "shadow-[0_0_12px_rgba(248,113,113,0.15)]",
  },
};

// ============================================================================
// ENHANCED GOLD PAGINATION COMPONENT
// ============================================================================

interface EnhancedPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number | null;
  loading: boolean;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const EnhancedPagination = memo(function EnhancedPagination({
  currentPage,
  totalPages,
  totalItems,
  loading,
  pageSize,
  onPageChange,
}: EnhancedPaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems || 0);

  // Generate page numbers to display - fewer on mobile
  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 3; // Reduced for mobile

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4">
      {/* Item count */}
      <div className="text-[10px] sm:text-sm text-[#f8e5bb]/70 order-2 sm:order-1">
        <span className="font-semibold text-[#f4c979]">{startItem}</span>
        <span className="text-[#f8e5bb]/50"> – </span>
        <span className="font-semibold text-[#f4c979]">{endItem}</span>
        <span className="text-[#f8e5bb]/50"> of </span>
        <span className="font-semibold text-[#f4c979]">{totalItems || 0}</span>
        <span className="text-[#f8e5bb]/50 ml-1 hidden xs:inline">requests</span>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1 sm:gap-1.5 order-1 sm:order-2">
        {/* Previous button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={currentPage === 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#f4c979]/10 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/20 hover:border-[#f4c979]/40 active:bg-[#f4c979]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all min-h-[32px] sm:min-h-[36px]"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </motion.button>

        {/* Page numbers - Hidden on smallest screens, show current/total instead */}
        <div className="hidden xs:flex items-center gap-1">
          {pageNumbers.map((page, idx) =>
            page === "ellipsis" ? (
              <span
                key={`ellipsis-${idx}`}
                className="w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center text-[#f4c979]/50 text-xs sm:text-sm"
              >
                ⋯
              </span>
            ) : (
              <motion.button
                key={page}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                disabled={loading}
                onClick={() => onPageChange(page)}
                className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all min-h-[28px] sm:min-h-[36px] ${
                  currentPage === page
                    ? "bg-gradient-to-br from-[#f4c979] to-[#d89d3e] text-[#1a1408] shadow-[0_4px_20px_rgba(244,201,121,0.35)]"
                    : "bg-[#f4c979]/10 border border-[#f4c979]/20 text-[#f4c979] hover:bg-[#f4c979]/20 hover:border-[#f4c979]/35 active:bg-[#f4c979]/30"
                }`}
              >
                {page}
              </motion.button>
            )
          )}
        </div>

        {/* Mobile: Simple current/total display */}
        <div className="xs:hidden flex items-center gap-1 px-2">
          <span className="text-xs font-semibold text-[#f4c979]">{currentPage}</span>
          <span className="text-[10px] text-[#f8e5bb]/50">/</span>
          <span className="text-xs text-[#f8e5bb]/70">{totalPages}</span>
        </div>

        {/* Next button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={currentPage >= totalPages || loading}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-[#f4c979]/10 border border-[#f4c979]/25 text-[#f4c979] hover:bg-[#f4c979]/20 hover:border-[#f4c979]/40 active:bg-[#f4c979]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all min-h-[32px] sm:min-h-[36px]"
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </motion.button>
      </div>
    </div>
  );
});

// ============================================================================
// COMPACT REQUEST ROW (GOLD THEME)
// ============================================================================

interface CompactRequestRowProps {
  request: RTORequest;
  statusConfig: StatusConfig;
  formatDateRange: (start: string, end: string) => string;
  calculateInclusiveDays: (start: string, end: string) => number | null;
  formatDateTime: (value: string) => string;
  index: number;
}

const CompactRequestRow = memo(function CompactRequestRow({
  request,
  statusConfig,
  formatDateRange,
  calculateInclusiveDays,
  formatDateTime,
  index,
}: CompactRequestRowProps) {
  const days = calculateInclusiveDays(request.start_date, request.end_date);
  const initials = request.full_name
    ? request.full_name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : request.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02, duration: 0.25 }}
      className="group hover:bg-[#f4c979]/5 transition-colors border-b border-[#f6dcb2]/10 last:border-b-0"
    >
      {/* Employee */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[0.7rem] font-bold text-[#1a1408] shadow-[0_2px_10px_rgba(244,201,121,0.25)]">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate max-w-[140px]">
              {request.full_name || "Unknown"}
            </p>
            <p className="text-[0.65rem] text-[#c7b696] truncate max-w-[140px]">
              {request.email || "—"}
            </p>
          </div>
        </div>
      </td>

      {/* Dates */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-[#f4c979]/60 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {formatDateRange(request.start_date, request.end_date)}
            </p>
            {days && (
              <p className="text-[0.65rem] text-[#c7b696]">
                {days} day{days !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Reason */}
      <td className="px-4 py-3 max-w-[200px]">
        <p className="text-sm text-[#fdf4db]/80 truncate">
          {request.reason || "—"}
        </p>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.7rem] font-semibold ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor} border ${statusConfig.glowColor}`}
        >
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </td>

      {/* Submitted */}
      <td className="px-4 py-3">
        <p className="text-sm text-[#f0e2c7]">
          {formatDateTime(request.submitted_at)}
        </p>
      </td>
    </motion.tr>
  );
});

// ============================================================================
// COMPACT MOBILE CARD (GOLD THEME)
// ============================================================================

interface CompactMobileCardProps {
  request: RTORequest;
  statusConfig: StatusConfig;
  formatDateRange: (start: string, end: string) => string;
  calculateInclusiveDays: (start: string, end: string) => number | null;
  formatDateTime: (value: string) => string;
  index: number;
}

const CompactMobileCard = memo(function CompactMobileCard({
  request,
  statusConfig,
  formatDateRange,
  calculateInclusiveDays,
  formatDateTime,
  index,
}: CompactMobileCardProps) {
  const days = calculateInclusiveDays(request.start_date, request.end_date);
  const initials = request.full_name
    ? request.full_name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : request.email?.charAt(0).toUpperCase() ?? "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="rounded-xl sm:rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914]/90 via-[#120f0c]/95 to-[#070605]/95 p-3 sm:p-4 shadow-[0_8px_25px_rgba(0,0,0,0.4)] active:bg-[#f4c979]/5 transition-colors"
    >
      {/* Header: Avatar + Name + Status */}
      <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2.5 sm:mb-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-xs sm:text-sm font-bold text-[#1a1408] shadow-[0_4px_15px_rgba(244,201,121,0.3)] flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-white truncate">
              {request.full_name || "Unknown"}
            </p>
            <p className="text-[10px] sm:text-xs text-[#c7b696] truncate">
              {request.email || "—"}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[0.65rem] font-semibold ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor} border flex-shrink-0`}
        >
          <span className="[&>svg]:w-2.5 [&>svg]:h-2.5 sm:[&>svg]:w-3.5 sm:[&>svg]:h-3.5">{statusConfig.icon}</span>
          <span className="hidden xs:inline">{statusConfig.label}</span>
        </span>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
        <div className="flex items-start gap-1.5 sm:gap-2">
          <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4c979]/70 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[0.65rem] uppercase tracking-wider text-[#d0bfa0] mb-0.5">
              Dates
            </p>
            <p className="text-white font-medium text-[10px] sm:text-xs truncate">
              {formatDateRange(request.start_date, request.end_date)}
            </p>
            {days && (
              <p className="text-[9px] sm:text-[0.6rem] text-[#c7b696] mt-0.5">
                {days} day{days !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-1.5 sm:gap-2">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4c979]/70 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[0.65rem] uppercase tracking-wider text-[#d0bfa0] mb-0.5">
              Submitted
            </p>
            <p className="text-white font-medium text-[10px] sm:text-xs truncate">
              {formatDateTime(request.submitted_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Reason */}
      {request.reason && (
        <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-[#f6dcb2]/15">
          <p className="text-[9px] sm:text-[0.65rem] uppercase tracking-wider text-[#d0bfa0] mb-0.5 sm:mb-1">
            Reason
          </p>
          <p className="text-[10px] sm:text-xs text-[#fdf4db]/80 line-clamp-2">
            {request.reason}
          </p>
        </div>
      )}
    </motion.div>
  );
});

// ============================================================================
// FILTER CHIP (GOLD THEME)
// ============================================================================

interface FilterChipProps {
  label: string;
  value: string;
  onClear: () => void;
}

const FilterChip = memo(function FilterChip({ label, value, onClear }: FilterChipProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4c979]/15 border border-[#f4c979]/25 text-xs text-[#fef3d1]"
    >
      <span className="text-[#f4c979]/70">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear filter"
        title="Clear filter"
        className="ml-1 hover:text-white transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </motion.span>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// WF-020: State persistence key for AdminRTO filters/pagination
const ADMIN_RTO_STATE_KEY = 'atts:admin:rto:state';

interface AdminRTOState {
  searchQuery: string;
  statusFilter: string | null;
  monthFilter: string | null;
  currentPage: number;
}

function getPersistedAdminRTOState(): Partial<AdminRTOState> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(ADMIN_RTO_STATE_KEY);
    if (stored) {
      return JSON.parse(stored) as Partial<AdminRTOState>;
    }
  } catch { /* ignore */ }
  return {};
}

function persistAdminRTOState(state: Partial<AdminRTOState>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADMIN_RTO_STATE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export default function AdminRTO() {
  const { role: currentUserRole, user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<RTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // WF-020: Initialize state from localStorage
  const persistedState = getPersistedAdminRTOState();
  const [searchQuery, setSearchQuery] = useState(persistedState.searchQuery ?? "");
  const [statusFilter, setStatusFilter] = useState<string | null>(persistedState.statusFilter ?? null);
  const [monthFilter, setMonthFilter] = useState<string | null>(persistedState.monthFilter ?? null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // Pagination State
  const pageSize = 15;
  const [currentPage, setCurrentPage] = useState(persistedState.currentPage ?? 1);
  const [totalRequests, setTotalRequests] = useState<number | null>(null);

  const totalPages =
    totalRequests && totalRequests > 0
      ? Math.max(1, Math.ceil(totalRequests / pageSize))
      : 1;

  // WF-020: Persist state changes to localStorage
  useEffect(() => {
    persistAdminRTOState({
      searchQuery,
      statusFilter,
      monthFilter,
      currentPage,
    });
  }, [searchQuery, statusFilter, monthFilter, currentPage]);

  // Fetch RTO requests with pagination
  const fetchRTORequests = useCallback(
    async (showSpinner: boolean = true) => {
      if (!user) return;

      if (showSpinner) setLoading(true);

      try {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        // PERF-018: Select only needed columns instead of SELECT *
        let query = supabase
          .from("rto_requests")
          .select("id, user_id, start_date, end_date, reason, status, submitted_at, email, full_name", { count: "exact" })
          .order("submitted_at", { ascending: false });

        if (debouncedSearchQuery.trim()) {
          const term = debouncedSearchQuery.trim();
          query = query.or(
            `email.ilike.%${term}%,full_name.ilike.%${term}%`
          );
        }

        if (statusFilter) {
          query = query.eq("status", statusFilter);
        }

        if (monthFilter) {
          const [yearStr, monthStr] = monthFilter.split("-");
          const year = Number(yearStr);
          const month = Number(monthStr);
          if (!Number.isNaN(year) && !Number.isNaN(month)) {
            const monthStart = new Date(year, month - 1, 1);
            const nextMonthStart = new Date(year, month, 1);
            query = query
              .gte("start_date", monthStart.toISOString())
              .lt("start_date", nextMonthStart.toISOString());
          }
        }

        const { data, error, count } = await query.range(from, to);

        if (error) {
          logger.error("Error fetching RTO requests:", error);
          setRequests([]);
          return;
        }

        setRequests((data || []) as RTORequest[]);
        if (typeof count === "number") {
          setTotalRequests(count);
        }
      } catch (err) {
        logger.error("Unexpected error loading RTO requests:", err);
        setRequests([]);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [currentPage, pageSize, debouncedSearchQuery, statusFilter, monthFilter, user]
  );

  // Load + Realtime subscribe
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchRTORequests(true);
    };

    load();

    const unsubscribe = subscribeToTableChanges({
      channelName: "rto-requests-admin",
      table: "rto_requests",
      onInsert: () => {
        if (!cancelled) fetchRTORequests(false);
      },
      onUpdate: () => {
        if (!cancelled) fetchRTORequests(false);
      },
      onDelete: () => {
        if (!cancelled) fetchRTORequests(false);
      },
      onError: (error) => {
        logger.error("Realtime subscription error:", error);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authLoading, user, fetchRTORequests]);

  const filteredRequests = useMemo(() => {
    let filtered = requests;

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.email?.toLowerCase().includes(query) ||
          r.full_name?.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    return filtered;
  }, [requests, debouncedSearchQuery, statusFilter]);

  const requestStats = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "Pending").length,
      approved: requests.filter((r) => r.status === "Approved").length,
      denied: requests.filter((r) => r.status === "Denied").length,
      total: totalRequests || requests.length,
    }),
    [requests, totalRequests]
  );

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateWithWeekday = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateRange = (startDate: string, endDate: string): string => {
    const startFormatted = formatDateWithWeekday(startDate);
    const endFormatted = formatDateWithWeekday(endDate);

    if (!startFormatted && !endFormatted) return "—";
    if (startFormatted && !endFormatted) return startFormatted;
    if (!startFormatted && endFormatted) return endFormatted;
    if (startFormatted && endFormatted && startFormatted === endFormatted) return startFormatted;
    return `${startFormatted ?? ""} → ${endFormatted ?? ""}`;
  };

  const calculateInclusiveDays = (startDate: string, endDate: string): number | null => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end.getTime() < start.getTime()) return null;

    const diffInDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diffInDays, 1);
  };

  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return {
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      };
    });
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const hasActiveFilters = searchQuery || statusFilter || monthFilter;

  if (currentUserRole !== "admin") {
    return (
      <DashboardLayout title="RTO Management">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">
              You do not have permission to view this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="RTO Management">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
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
                background: 'linear-gradient(145deg, rgba(244, 201, 121, 0.1) 0%, rgba(28, 28, 31, 0.65) 40%, rgba(15, 13, 9, 0.75) 100%)',
                backdropFilter: 'blur(24px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 25%, transparent 50%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%)' }} />
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.2) 0%, transparent 45%)' }} />
              <div className="absolute top-0 left-0 w-32 h-32 pointer-events-none" style={{ background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)' }} />
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-white/5 via-white/25 to-white/5 rounded-t-[inherit]" />
              <div className="absolute top-0 left-0 bottom-0 w-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-l-[inherit]" />

              <div className="relative px-5 py-4 md:px-7 md:py-5">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
                    <Sparkles className="w-3.5 h-3.5 text-[#f4c979]" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f8e5bb]">Admin • Time Off</span>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20">
                    <Clock className="w-3 h-3 text-[#f4c979]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">{requestStats.pending} pending</span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-4">
                  <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(244, 201, 121, 0.5), 0 0 40px rgba(244, 201, 121, 0.25)' }} />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,201,121,0.35)]">
                        Request Time Off Control
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">Request Time Off Control</h1>
                    )}
                    <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium leading-relaxed max-w-xl">
                      Filter, triage, and approve requests with every status at your fingertips
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        <div className="space-y-5">
          {/* Filters Section - Gold Theme */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-xl sm:rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914]/95 via-[#120f0c]/95 to-[#070605]/95 p-3 sm:p-4 shadow-[0_15px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative sm:col-span-1">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg sm:rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 focus:border-[#f4c979]/50 transition-all min-h-[40px] sm:min-h-[44px]"
                />
              </div>

              {/* Status & Month - side by side on mobile */}
              <div className="grid grid-cols-2 gap-2 sm:contents">
                {/* Status Filter */}
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    aria-label="Filter by status"
                    title="Filter by status"
                    value={statusFilter || ""}
                    onChange={(e) => {
                      setStatusFilter(e.target.value || null);
                      setCurrentPage(1);
                    }}
                    className="w-full rounded-lg sm:rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 pl-9 sm:pl-10 pr-6 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 appearance-none cursor-pointer min-h-[40px] sm:min-h-[44px]"
                  >
                    <option value="">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Denied">Denied</option>
                  </select>
                </div>

                {/* Month Filter */}
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    aria-label="Filter by month"
                    title="Filter by month"
                    value={monthFilter || ""}
                    onChange={(e) => {
                      setMonthFilter(e.target.value || null);
                      setCurrentPage(1);
                    }}
                    className="w-full rounded-lg sm:rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 pl-9 sm:pl-10 pr-6 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/50 appearance-none cursor-pointer min-h-[40px] sm:min-h-[44px]"
                  >
                    <option value="">All Months</option>
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Active Filters */}
            <AnimatePresence>
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#f6dcb2]/15"
                >
                  {searchQuery && (
                    <FilterChip
                      label="Search"
                      value={searchQuery}
                      onClear={() => setSearchQuery("")}
                    />
                  )}
                  {statusFilter && (
                    <FilterChip
                      label="Status"
                      value={statusFilter}
                      onClear={() => setStatusFilter(null)}
                    />
                  )}
                  {monthFilter && (
                    <FilterChip
                      label="Month"
                      value={monthOptions.find((o) => o.value === monthFilter)?.label || monthFilter}
                      onClear={() => setMonthFilter(null)}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Requests Table/Cards - Gold Theme */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d]/95 via-[#0b0906]/95 to-[#050403]/95 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
          >
            {loading ? (
              <TableSkeleton rows={6} columns={5} variant="gold" />
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#211c15] border border-[#f6dcb2]/30 mx-auto">
                  <Calendar className="w-6 h-6 text-[#f4c979]" />
                </div>
                <h3 className="text-lg font-semibold text-white">No Requests Found</h3>
                <p className="text-sm text-[#f8e5bb]/70 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? "Adjust your filters to see more results."
                    : "No time-off requests have been submitted yet."}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-[#2b251b] to-[#1b1812] border-b border-[#f6dcb2]/15">
                      <tr className="text-[0.65rem] uppercase tracking-[0.25em] text-[#f4c979]/80">
                        <th className="px-4 py-3 text-left font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            Employee
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5" />
                            Dates
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left font-semibold">Reason</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-left font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Submitted
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((request, index) => {
                        const statusConfig =
                          STATUS_CONFIG[request.status] || STATUS_CONFIG.Pending;
                        return (
                          <CompactRequestRow
                            key={request.id}
                            request={request}
                            statusConfig={statusConfig}
                            formatDateRange={formatDateRange}
                            calculateInclusiveDays={calculateInclusiveDays}
                            formatDateTime={formatDateTime}
                            index={index}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden space-y-3 p-4">
                  {filteredRequests.map((request, index) => {
                    const statusConfig =
                      STATUS_CONFIG[request.status] || STATUS_CONFIG.Pending;
                    return (
                      <CompactMobileCard
                        key={request.id}
                        request={request}
                        statusConfig={statusConfig}
                        formatDateRange={formatDateRange}
                        calculateInclusiveDays={calculateInclusiveDays}
                        formatDateTime={formatDateTime}
                        index={index}
                      />
                    );
                  })}
                </div>

                {/* Enhanced Gold Pagination */}
                <div className="border-t border-[#f6dcb2]/15 bg-[#0c0a08]/80">
                  <EnhancedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalRequests}
                    loading={loading}
                    pageSize={pageSize}
                    onPageChange={handlePageChange}
                  />
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
