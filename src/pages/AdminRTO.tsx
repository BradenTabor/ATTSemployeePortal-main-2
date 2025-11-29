import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  User,
  Mail,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToTableChanges } from "../lib/realtime";
import { PaginationControls } from "../components/PaginationControls";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { logger } from "../lib/logger";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

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
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-200",
    icon: <Clock className="w-4 h-4" />,
  },
  Approved: {
    label: "Approved",
    color: "emerald",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    textColor: "text-emerald-200",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  Denied: {
    label: "Denied",
    color: "red",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    textColor: "text-red-200",
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
      if (! currentUser) return;

      if (showSpinner) setLoading(true);

      try {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          . from("rto_requests")
          .select("*", { count: "exact" })
          .order("submitted_at", { ascending: false });

        // Apply search filter (email or name)
        if (searchQuery.trim()) {
          query = query.or(
            `email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`
          );
        }

        // Apply status filter
        if (statusFilter) {
          query = query.eq("status", statusFilter);
        }

        const { data, error, count } = await query.range(from, to);

        if (error) {
          console.error("Error fetching RTO requests:", error);
          setRequests([]);
          return;
        }

        setRequests((data || []) as RTORequest[]);
        if (typeof count === "number") {
          setTotalRequests(count);
        }
      } catch (err) {
        console.error("Unexpected error loading RTO requests:", err);
        setRequests([]);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [currentPage, pageSize, searchQuery, statusFilter, currentUser]
  );

  // 🔁 Load + Realtime subscribe
  useEffect(() => {
    if (authLoading) return;

    if (! currentUser) {
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

    // ✅ Realtime subscription using enhanced helper
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
        console.error("Realtime subscription error:", error);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authLoading, currentUser, fetchRTORequests]);

  // Filter and compute stats
  const filteredRequests = useMemo(() => {
    let filtered = requests;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.email?. toLowerCase().includes(query) ||
          r.full_name?.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    return filtered;
  }, [requests, searchQuery, statusFilter]);

  const stats = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "Pending").length,
      approved: requests.filter((r) => r.status === "Approved").length,
      denied: requests.filter((r) => r.status === "Denied").length,
      total: requests.length,
    }),
    [requests]
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
      Math.floor(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

    return Math.max(diffInDays, 1);
  };

  const formatDurationLabel = (days: number | null) => {
    if (!days) {
      return "Estimated: —";
    }
    return `Estimated: ${days} day${days === 1 ? "" : "s"}`;
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        . slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return "? ";
  };

  if (currentUserRole !== "admin") {
    return (
      <DashboardLayout title="RTO Management">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Access Denied
            </h2>
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        {/* ===== HEADER ===== */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-gradient-to-r from-green-600/10 to-green-500/5 backdrop-blur-sm rounded-3xl border border-green-500/20 p-8 shadow-lg mb-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-600/20 rounded-2xl border border-green-500/30">
                  <img
                    src={logo}
                    alt="ATTS Logo"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">
                    RTO Management
                  </h1>
                  <p className="text-gray-400 text-sm">
                    Review and manage employee time-off requests
                  </p>
                </div>
              </div>
              <div className="hidden lg:flex p-4 bg-green-600/10 rounded-2xl border border-green-500/20">
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </div>
          </motion.div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-4"
            >
              <div className="text-gray-400 text-xs font-medium mb-1">
                Total Requests
              </div>
              <div className="text-2xl font-bold text-white">{stats.total}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-amber-600/10 backdrop-blur-md rounded-xl border border-amber-500/20 p-4"
            >
              <div className="text-amber-400 text-xs font-medium mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Pending
              </div>
              <div className="text-2xl font-bold text-amber-300">
                {stats.pending}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-emerald-600/10 backdrop-blur-md rounded-xl border border-emerald-500/20 p-4"
            >
              <div className="text-emerald-400 text-xs font-medium mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Approved
              </div>
              <div className="text-2xl font-bold text-emerald-300">
                {stats.approved}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-red-600/10 backdrop-blur-md rounded-xl border border-red-500/20 p-4"
            >
              <div className="text-red-400 text-xs font-medium mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Denied
              </div>
              <div className="text-2xl font-bold text-red-300">
                {stats.denied}
              </div>
            </motion.div>
          </div>
        </div>

        {/* ===== FILTERS & SEARCH ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-8 shadow-lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-neutral-800/50 border border-green-700/40 text-white rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all placeholder:text-gray-500"
                />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Filter className="w-5 h-5 text-gray-500" />
                </div>
                <select
                  value={statusFilter || ""}
                  onChange={(e) => {
                    setStatusFilter(e.target.value || null);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-neutral-800/50 border border-green-700/40 text-white rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all appearance-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Denied">Denied</option>
                </select>
              </div>
            </div>

            {/* Active Filters Display */}
            {(searchQuery || statusFilter) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-2 pt-2"
              >
                {searchQuery && (
                    <span className="inline-flex items-center space-x-2 px-3 py-1 bg-green-600/20 border border-green-500/30 text-green-400 rounded-full text-sm">
                    <span>Search: {searchQuery}</span>
                    <button
                      onClick={() => setSearchQuery("")}
                        className="hover:text-green-300 transition-colors"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {statusFilter && (
                  <span className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-600/20 border border-amber-500/30 text-amber-400 rounded-full text-sm">
                    <span>Status: {statusFilter}</span>
                    <button
                      onClick={() => setStatusFilter(null)}
                      className="hover:text-amber-300 transition-colors"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ===== REQUESTS TABLE ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-xl"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4"></div>
              <p className="text-gray-400 text-sm">Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-24">
              <div className="p-3 bg-gray-600/10 rounded-full inline-block mb-4">
                <Calendar className="w-12 h-12 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No Requests Found
              </h3>
              <p className="text-gray-400 max-w-sm mx-auto">
                {searchQuery || statusFilter
                  ? "Try adjusting your search or filter criteria"
                  : "No RTO requests at this time"}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  {/* Table Header */}
                  <thead className="bg-gradient-to-r from-green-600/20 to-green-500/10 border-b border-green-500/20">
                    <tr>
                      <th className="px-6 py-4 text-left">
                        <span className="inline-flex items-center space-x-2 text-xs font-semibold text-green-400 uppercase tracking-wider">
                          <User className="w-4 h-4" />
                          <span>Employee</span>
                        </span>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <span className="inline-flex items-center space-x-2 text-xs font-semibold text-green-400 uppercase tracking-wider">
                          <Mail className="w-4 h-4" />
                          <span>Email</span>
                        </span>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <span className="inline-flex items-center space-x-2 text-xs font-semibold text-green-400 uppercase tracking-wider">
                          <Calendar className="w-4 h-4" />
                          <span>Dates</span>
                        </span>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                          Reason
                        </span>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                          Status
                        </span>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <span className="inline-flex items-center space-x-2 text-xs font-semibold text-green-400 uppercase tracking-wider">
                          <Clock className="w-4 h-4" />
                          <span>Submitted</span>
                        </span>
                      </th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-white/5">
                    {filteredRequests.map((request, index) => {
                      const statusConfig =
                        STATUS_CONFIG[request.status] || STATUS_CONFIG.Pending;

                      return (
                        <motion.tr
                          key={request.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="hover:bg-white/5 transition-all duration-200 group"
                        >
                          {/* Employee Name Cell */}
                          <td className="px-6 py-5">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center ring-2 ring-green-500/20">
                                  <span className="text-white font-semibold text-sm">
                                    {getInitials(request.full_name, request.email)}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="text-white font-medium truncate">
                                  {request.full_name || "Unknown"}
                                </p>
                                <p className="text-gray-500 text-xs truncate">
                                  ID: {request.id.slice(0, 8)}... 
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Email Cell */}
                          <td className="px-6 py-5">
                            <p className="text-gray-300 text-sm truncate">
                              {request.email || "—"}
                            </p>
                          </td>

                          {/* Dates Cell */}
                          <td className="px-6 py-5">
                            <div className="flex flex-col text-sm">
                              <span className="text-white font-semibold">
                                {formatDateRange(
                                  request.start_date,
                                  request.end_date
                                )}
                              </span>
                              <span className="text-xs text-green-200 mt-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDurationLabel(
                                  calculateInclusiveDays(
                                    request.start_date,
                                    request.end_date
                                  )
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Reason Cell */}
                          <td className="px-6 py-5">
                            <p className="text-gray-300 text-sm truncate max-w-xs">
                              {request.reason || "—"}
                            </p>
                          </td>

                          {/* Status Cell */}
                          <td className="px-6 py-5">
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${statusConfig.bgColor} ${statusConfig.borderColor} ${statusConfig.textColor}`}
                            >
                              {statusConfig.icon}
                              {statusConfig.label}
                            </span>
                          </td>

                          {/* Submitted Cell */}
                          <td className="px-6 py-5">
                            <p className="text-gray-300 text-sm">
                              {formatDateTime(request.submitted_at)}
                            </p>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ===== PAGINATION ===== */}
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
            </>
          )}
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}