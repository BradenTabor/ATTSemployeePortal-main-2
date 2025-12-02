import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Mail,
  Sparkles,
  Shield,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToTableChanges } from "../lib/realtime";
import { PaginationControls } from "../components/PaginationControls";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { logger } from "../lib/logger";
import TableSkeleton from "../components/skeletons/TableSkeleton";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";

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
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  Pending: {
    label: "Pending",
    color: "amber",
    bgColor: "bg-[#f7dca8]/15",
    borderColor: "border-[#f4c979]/30",
    textColor: "text-[#fef3d1]",
    icon: <Clock className="w-4 h-4" />,
  },
  Approved: {
    label: "Approved",
    color: "emerald",
    bgColor: "bg-[#1d2b1f]",
    borderColor: "border-[#8ff2c7]/25",
    textColor: "text-[#8ff2c7]",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  Denied: {
    label: "Denied",
    color: "red",
    bgColor: "bg-[#2a0b02]",
    borderColor: "border-[#ff8a65]/35",
    textColor: "text-[#ffc7b8]",
    icon: <AlertCircle className="w-4 h-4" />,
  },
};

export default function AdminRTO() {
  const { role: currentUserRole } = useAuth();
  const [requests, setRequests] = useState<RTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // 🔢 Pagination State
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRequests, setTotalRequests] = useState<number | null>(null);

  const totalPages =
    totalRequests && totalRequests > 0
      ?  Math.max(1, Math.ceil(totalRequests / pageSize))
      : 1;

  // 🔒 Load auth user
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setAuthLoading(true);
      const { data, error } = await supabase.auth.getUser();

      if (! isMounted) return;

      if (error) {
        logger.error("Error loading auth user in AdminRTO:", error);
      }

      setCurrentUser(data?. user ??  null);
      setAuthLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (! isMounted) return;
      setCurrentUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // 📥 Fetch RTO requests with pagination
  const fetchRTORequests = useCallback(
    async (showSpinner: boolean = true) => {
      if (!currentUser) return;

      if (showSpinner) setLoading(true);

      try {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from("rto_requests")
          .select("*", { count: "exact" })
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
    [
      currentPage,
      pageSize,
      debouncedSearchQuery,
      statusFilter,
      monthFilter,
      currentUser,
    ]
  );

  // 🔁 Load + Realtime subscribe
  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
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
  }, [authLoading, currentUser, fetchRTORequests]);

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
      total: requests.length,
    }),
    [requests]
  );

  const heroStats = useMemo<AdminStat[]>(
    () => [
      {
        label: "Pending",
        value: String(requestStats.pending),
        hint: "Awaiting action",
      },
      {
        label: "Approved",
        value: String(requestStats.approved),
        hint: "Cleared PTO",
      },
      {
        label: "Denied",
        value: String(requestStats.denied),
        hint: "Requires follow-up",
      },
    ],
    [requestStats]
  );

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Admin • Time Off",
      eyebrowIcon: <Sparkles className="w-4 h-4 text-[#f8dda7]" />,
      heading: "Request Time Off Control",
      description:
        "Filter, triage, and approve requests with a polished gold console that keeps every status at your fingertips.",
      badges: [
        {
          label: `${requestStats.pending} pending`,
          icon: <Clock className="w-4 h-4 text-[#f4c979]" />,
        },
        {
          label: `${requestStats.total} total`,
          icon: <Calendar className="w-4 h-4 text-[#f4c979]" />,
          variant: "outline",
        },
      ],
    }),
    [requestStats]
  );

  const sidePanel = (
    <div className="space-y-5 text-sm text-[#fdf4db]/80">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-[#1b1812] border border-[#f6dcb2]/30">
          <Shield className="w-5 h-5 text-[#f8dda7]" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#f7e7c3]">
            Guardrails
          </p>
          <p className="text-[#fdf4db] font-semibold">RTO review checklist</p>
        </div>
      </div>
      <ul className="space-y-3 text-xs text-[#f5e3c0]/80">
        <li className="flex gap-2">
          <span className="text-[#f6dcb2]">•</span>Confirm dates are within PTO policy and do not overlap critical projects.
        </li>
        <li className="flex gap-2">
          <span className="text-[#f6dcb2]">•</span>Use the status filter to batch approvals or denials in one pass.
        </li>
        <li className="flex gap-2">
          <span className="text-[#f6dcb2]">•</span>Export decisions weekly so payroll and scheduling stay in sync.
        </li>
      </ul>
    </div>
  );

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateWithWeekday = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const startFormatted = formatDateWithWeekday(startDate);
    const endFormatted = formatDateWithWeekday(endDate);

    if (!startFormatted && !endFormatted) {
      return "—";
    }

    if (startFormatted && !endFormatted) {
      return startFormatted;
    }

    if (!startFormatted && endFormatted) {
      return endFormatted;
    }

    return `${startFormatted} → ${endFormatted}`;
  };

  const calculateInclusiveDays = (
    startDate: string,
    endDate: string
  ): number | null => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }

    if (end.getTime() < start.getTime()) {
      return null;
    }

    const diffInDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
      1;

    return Math.max(diffInDays, 1);
  };

  const formatDurationLabel = (days: number | null) => {
    if (!days) {
      return "Estimated: —";
    }
    return `Estimated: ${days} day${days === 1 ? "" : "s"}`;
  };

  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return {
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        label: date.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
      };
    });
  }, []);

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return "?";
  };

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
      <AdminPremiumScaffold
        hero={heroConfig}
        stats={heroStats}
        sidePanel={sidePanel}
        theme="gold"
      >
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-6 space-y-4 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-[#b59d72] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search email or name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-11 pr-4 py-3 text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                />
              </div>
              <div className="relative">
                <Filter className="w-4 h-4 text-[#b59d72] absolute left-4 top-1/2 -translate-y-1/2" />
                <select
                  value={statusFilter || ""}
                  onChange={(e) => {
                    setStatusFilter(e.target.value || null);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-11 pr-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 appearance-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Denied">Denied</option>
                </select>
              </div>
              <div className="relative">
                <Calendar className="w-4 h-4 text-[#b59d72] absolute left-4 top-1/2 -translate-y-1/2" />
                <select
                  value={monthFilter || ""}
                  onChange={(e) => {
                    setMonthFilter(e.target.value || null);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-11 pr-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 appearance-none cursor-pointer"
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
            {(searchQuery || statusFilter || monthFilter) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex flex-wrap gap-2 pt-2"
              >
                {searchQuery && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f4c979]/30 bg-[#f4c979]/10 text-xs text-[#fef3d1]">
                    <span>Search: {searchQuery}</span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {statusFilter && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f6dcb2]/30 bg-[#f6dcb2]/10 text-xs text-[#fef3d1]">
                    <span>Status: {statusFilter}</span>
                    <button
                      type="button"
                      onClick={() => setStatusFilter(null)}
                      className="hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {monthFilter && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f4c979]/30 bg-[#f4c979]/10 text-xs text-[#fef3d1]">
                    <span>
                      Month:{" "}
                      {
                        monthOptions.find((option) => option.value === monthFilter)
                          ?.label
                      }
                    </span>
                    <button
                      type="button"
                      onClick={() => setMonthFilter(null)}
                      className="hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </motion.div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.65)]"
          >
            {loading ? (
              <TableSkeleton rows={6} columns={5} variant="gold" />
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-24 space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#211c15] border border-[#f6dcb2]/30 mx-auto">
                  <Calendar className="w-7 h-7 text-[#f4c979]" />
                </div>
                <h3 className="text-xl font-semibold text-white">No Requests Found</h3>
                <p className="text-sm text-[#f8e5bb]/70 max-w-sm mx-auto">
                  {searchQuery || statusFilter
                    ? "Adjust your filters or keywords to see additional records."
                    : "No time-off requests are waiting at the moment."}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-[#2b251b] to-[#1b1812] border-b border-[#f6dcb2]/15 text-[0.65rem] uppercase tracking-[0.3em] text-[#f4c979]/80">
                      <tr>
                        <th className="px-6 py-4 text-left">
                          <span className="inline-flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Employee
                          </span>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <span className="inline-flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email
                          </span>
                        </th>
                        <th className="px-6 py-4 text-left">
                          <span className="inline-flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Dates
                          </span>
                        </th>
                        <th className="px-6 py-4 text-left">Reason</th>
                        <th className="px-6 py-4 text-left">Status</th>
                        <th className="px-6 py-4 text-left">
                          <span className="inline-flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Submitted
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm text-[#fdf4db]/90">
                      {filteredRequests.map((request, index) => {
                        const statusConfig =
                          STATUS_CONFIG[request.status] || STATUS_CONFIG.Pending;
                        return (
                          <motion.tr
                            key={request.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="hover:bg-white/5 transition-colors"
                          >
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] font-semibold">
                                  {getInitials(request.full_name, request.email)}
                                </div>
                                <div>
                                  <p className="font-semibold text-white">
                                    {request.full_name || "Unknown"}
                                  </p>
                                  <p className="text-[0.65rem] text-[#c7b696]">
                                    ID: {request.id.slice(0, 8)}…
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-[#f0e2c7]">
                              {request.email || "—"}
                            </td>
                            <td className="px-6 py-5">
                              <div className="text-white font-semibold">
                                {formatDateRange(request.start_date, request.end_date)}
                              </div>
                              <div className="text-xs text-[#f6dcb2]/80 flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {formatDurationLabel(
                                  calculateInclusiveDays(
                                    request.start_date,
                                    request.end_date
                                  )
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5 text-[#f0e2c7] truncate max-w-sm">
                              {request.reason || "—"}
                            </td>
                            <td className="px-6 py-5">
                              <span
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor}`}
                              >
                                {statusConfig.icon}
                                {statusConfig.label}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-[#f0e2c7]">
                              {formatDateTime(request.submitted_at)}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="lg:hidden space-y-4 px-4 pb-6 pt-2">
                  {filteredRequests.map((request, index) => {
                    const statusConfig =
                      STATUS_CONFIG[request.status] || STATUS_CONFIG.Pending;
                    return (
                      <MobileRequestCard
                        key={request.id}
                        request={request}
                        statusConfig={statusConfig}
                        formatDateRange={formatDateRange}
                        formatDurationLabel={formatDurationLabel}
                        calculateInclusiveDays={calculateInclusiveDays}
                        formatDateTime={formatDateTime}
                        index={index}
                      />
                    );
                  })}
                </div>
                <div className="border-t border-[#f6dcb2]/15 bg-[#0c0a08]/80">
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalRequests}
                    loading={loading}
                    pageSize={pageSize}
                    onPreviousClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    onNextClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    label="requests"
                  />
                </div>
              </>
            )}
          </motion.div>
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}

type MobileRequestCardProps = {
  request: RTORequest;
  statusConfig: StatusConfig;
  formatDateRange: (start: string, end: string) => string;
  formatDurationLabel: (days: number | null) => string;
  calculateInclusiveDays: (start: string, end: string) => number | null;
  formatDateTime: (value: string) => string;
  index: number;
};

function MobileRequestCard({
  request,
  statusConfig,
  formatDateRange,
  formatDurationLabel,
  calculateInclusiveDays,
  formatDateTime,
  index,
}: MobileRequestCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-3xl border border-[#f6dcb2]/25 bg-gradient-to-br from-[#1b1914] via-[#0f0c09] to-[#050403] p-4 space-y-4 shadow-[0_12px_30px_rgba(0,0,0,0.55)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] font-semibold">
            {request.full_name
              ? request.full_name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()
              : request.email?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white">{request.full_name || "Unknown"}</p>
            <p className="text-xs text-[#c7b696] truncate">{request.email || "—"}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor}`}
        >
          {statusConfig.icon}
          {statusConfig.label}
        </span>
      </div>
      <div className="space-y-3 text-sm text-[#fdf4db]/85">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-2xl bg-[#251f16] border border-[#f6dcb2]/20">
            <Calendar className="w-4 h-4 text-[#f4c979]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#d0bfa0] mb-1">
              Dates
            </p>
            <p className="font-semibold text-white">{formatDateRange(request.start_date, request.end_date)}</p>
            <p className="text-xs text-[#c7b696]">
              {formatDurationLabel(calculateInclusiveDays(request.start_date, request.end_date))}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-2xl bg-[#251f16] border border-[#f6dcb2]/20">
            <Clock className="w-4 h-4 text-[#f4c979]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#d0bfa0] mb-1">
              Submitted
            </p>
            <p className="font-semibold text-white">{formatDateTime(request.submitted_at)}</p>
          </div>
        </div>
        {request.reason && (
          <div className="rounded-2xl border border-[#f6dcb2]/20 bg-[#0c0906]/70 p-3">
            <p className="text-xs uppercase tracking-[0.25em] text-[#d0bfa0] mb-1">
              Reason
            </p>
            <p className="text-sm text-[#fdf4db]/90">{request.reason}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}