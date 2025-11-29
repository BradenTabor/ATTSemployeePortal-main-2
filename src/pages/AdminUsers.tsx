import { useEffect, useState, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Filter, Mail, Calendar, Shield } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToTableChanges } from "../lib/realtime";
import logo from "../assets/ATTS_Logo-removebg-preview.png";

interface AppUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface ToastMessage {
  id: string;
  type: "success" | "error";
  message: string;
}

function AdminUsers() {
  const { role: currentUserRole } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 🔍 Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);

  // 🔢 Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const pageSize = 25;

  const totalPages =
    totalUsers && totalUsers > 0
      ? Math.max(1, Math.ceil(totalUsers / pageSize))
      : 1;

  const showToast = useCallback((type: "success" | "error", message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [... prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("user_profiles")
        .select("id, email, role, created_at", { count: "exact" })
        .order("created_at", { ascending: false });

      // Apply search filter (email)
      if (searchQuery. trim()) {
        query = query. ilike("email", `%${searchQuery}%`);
      }

      // Apply role filter
      if (roleFilter) {
        query = query.eq("role", roleFilter);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        console.error("Supabase error:", error. message, error.details);
        showToast("error", error.message || "Failed to load users");
        setUsers([]);
        return;
      }

      const formattedUsers = (data || []).map((user: any) => ({
        id: user.id,
        email: user.email || "N/A",
        role: user.role,
        created_at: user. created_at,
      }));

      setUsers(formattedUsers);
      if (typeof count === "number") {
        setTotalUsers(count);
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      showToast("error", "Unexpected error loading users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, roleFilter, showToast]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchUsers();
    };

    load();

    // ✅ Realtime subscription using enhanced helper
    const unsubscribe = subscribeToTableChanges({
      channelName: "app-users-admin",
      table: "app_users",
      onInsert: () => {
        if (!cancelled) fetchUsers();
      },
      onUpdate: () => {
        if (!cancelled) fetchUsers();
      },
      onDelete: () => {
        if (!cancelled) fetchUsers();
      },
      onError: (error) => {
        console.error("Realtime subscription error:", error);
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchUsers]);

  if (currentUserRole !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">
            You do not have permission to view this page. 
          </p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="User Management">
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
            className="bg-gradient-to-r from-green-600/10 to-green-500/5 backdrop-blur-sm rounded-3xl border border-green-500/20 p-8 shadow-lg"
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
                    User Management
                  </h1>
                  <p className="text-gray-400 text-sm">
                    View and monitor all registered users
                  </p>
                </div>
              </div>
              <div className="hidden lg:flex p-4 bg-green-600/10 rounded-2xl border border-green-500/20">
                <Users className="w-8 h-8 text-green-400" />
              </div>
            </div>
          </motion. div>
        </div>

        {/* ===== FILTERS & SEARCH ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 mb-8 shadow-lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search by email..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-neutral-800/50 border border-green-700/40 text-white rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all placeholder:text-gray-500"
              />
            </div>

            {/* Role Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Filter className="w-5 h-5 text-gray-500" />
              </div>
              <select
                value={roleFilter || ""}
                onChange={(e) => {
                  setRoleFilter(e.target.value || null);
                  setCurrentPage(1);
                }}
                className="w-full bg-neutral-800/50 border border-green-700/40 text-white rounded-lg pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="employee">Employee</option>
                <option value="mechanic">Mechanic</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || roleFilter) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex flex-wrap gap-2"
            >
              {searchQuery && (
                <span className="inline-flex items-center space-x-2 px-3 py-1 bg-green-600/20 border border-green-500/30 text-green-400 rounded-full text-sm">
                  <span>Email: {searchQuery}</span>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="hover:text-green-300 transition-colors"
                  >
                    ✕
                  </button>
                </span>
              )}
              {roleFilter && (
                <span className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-full text-sm">
                  <span>Role: {roleFilter}</span>
                  <button
                    onClick={() => setRoleFilter(null)}
                    className="hover:text-blue-300 transition-colors"
                  >
                    ✕
                  </button>
                </span>
              )}
            </motion. div>
          )}
        </motion.div>

        {/* ===== USERS TABLE ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-xl"
        >
          {loading ?  (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4"></div>
              <p className="text-gray-400 text-sm">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-24">
              <div className="p-3 bg-gray-600/10 rounded-full inline-block mb-4">
                <Users className="w-12 h-12 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No Users Found
              </h3>
              <p className="text-gray-400 max-w-sm mx-auto">
                {searchQuery || roleFilter
                  ? "Try adjusting your search or filter criteria"
                  : "No users are currently registered"}
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
                          <Mail className="w-4 h-4" />
                          <span>Email</span>
                        </span>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                          Role
                        </span>
                      </th>
                      <th className="px-6 py-4 text-left">
                        <span className="inline-flex items-center space-x-2 text-xs font-semibold text-green-400 uppercase tracking-wider">
                          <Calendar className="w-4 h-4" />
                          <span>Joined</span>
                        </span>
                      </th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-white/5">
                    {users.map((user, index) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="hover:bg-white/5 transition-all duration-200 group"
                      >
                        {/* Email Cell */}
                        <td className="px-6 py-5">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center">
                                <span className="text-white font-semibold text-sm">
                                  {user. email.charAt(0). toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div>
                              <p className="text-white font-medium truncate">
                                {user.email}
                              </p>
                              <p className="text-gray-500 text-xs">
                                User ID: {user.id. slice(0, 8)}... 
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role Cell */}
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center px-3 py-1. 5 rounded-full text-xs font-semibold ${
                              user.role === "admin"
                                ? "bg-red-600/20 text-red-400 border border-red-500/30"
                                : user.role === "mechanic"
                                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                : user.role === "employee"
                                ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                                : "bg-gray-600/20 text-gray-400 border border-gray-500/30"
                            }`}
                          >
                            {user. role. charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </td>

                        {/* Joined Cell */}
                        <td className="px-6 py-5">
                          <p className="text-gray-300 text-sm">
                            {new Date(user.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {new Date(user.created_at). toLocaleTimeString(
                              "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </p>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ===== PAGINATION ===== */}
              <div className="flex items-center justify-between px-6 py-5 border-t border-white/10 bg-gradient-to-r from-black/40 to-black/20">
                <div className="text-sm text-gray-300">
                  <span className="font-semibold text-green-400">
                    {(currentPage - 1) * pageSize + 1}
                  </span>
                  {" - "}
                  <span className="font-semibold text-green-400">
                    {Math.min(currentPage * pageSize, totalUsers || 0)}
                  </span>
                  {" of "}
                  <span className="font-semibold text-green-400">
                    {totalUsers || 0}
                  </span>
                  <span className="text-gray-400"> users</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    disabled={currentPage === 1 || loading}
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-white/10 hover:border-white/20"
                  >
                    ← Previous
                  </button>

                  <div className="px-3 py-2 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-gray-300">
                    Page <span className="font-semibold text-white">{currentPage}</span> of{" "}
                    <span className="font-semibold text-white">{totalPages}</span>
                  </div>

                  <button
                    disabled={currentPage >= totalPages || loading}
                    onClick={() =>
                      setCurrentPage((prev) =>
                        Math.min(totalPages, prev + 1)
                      )
                    }
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-white/10 hover:border-white/20"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* ===== TOAST NOTIFICATIONS ===== */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 100, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: 100, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`flex items-center space-x-3 px-6 py-4 rounded-xl shadow-xl backdrop-blur-md border ${
                  toast.type === "success"
                    ? "bg-green-600/90 border-green-500/50"
                    : "bg-red-600/90 border-red-500/50"
                }`}
              >
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full ${
                    toast.type === "success" ? "bg-green-400/30" : "bg-red-400/30"
                  }`}
                />
                <span className="text-white font-medium text-sm">
                  {toast.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

export default memo(AdminUsers);