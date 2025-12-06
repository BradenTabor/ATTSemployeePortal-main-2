import { useEffect, useState, useCallback, memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, Search, Filter, Mail, Calendar, Shield, Sparkles } from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToTableChanges } from "../lib/realtime";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import TableSkeleton from "../components/skeletons/TableSkeleton";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
  type AdminStat,
} from "../components/admin/AdminPremiumScaffold";
import { toast } from "../lib/toast";

interface AppUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

const getRoleBadgeClass = (role: string) => {
  if (role === "admin") {
    return "bg-[#2a0b02] text-[#ffb199] border border-[#ff6b4a]/40";
  }
  if (role === "mechanic") {
    return "bg-[#0d1d2c] text-[#9cd7ff] border border-[#4c95c9]/40";
  }
  if (role === "employee") {
    return "bg-[#23102a] text-[#deb2ff] border border-[#b57ae3]/40";
  }
  return "bg-white/5 text-[#fdf4db] border border-white/15";
};

const formatJoinedDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatJoinedTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

const MobileUserCard = ({ user }: { user: AppUser }) => (
  <motion.article
    layout
    className="rounded-2xl border border-[#f6dcb2]/25 bg-[#0c0a07]/90 p-4 space-y-4 shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
  >
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] font-semibold">
        {user.email.charAt(0).toUpperCase()}
      </div>
      <div>
        <p className="font-semibold text-white text-base">{user.email}</p>
        <p className="text-[0.65rem] text-[#c7b696] tracking-wide">
          ID: {user.id.slice(0, 8)}…
        </p>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span
        className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${getRoleBadgeClass(
          user.role
        )}`}
      >
        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
      </span>
      <div className="text-xs text-[#f0e2c7] text-right">
        <p>{formatJoinedDate(user.created_at)}</p>
        <p className="text-[0.7rem] text-[#c7b696]">{formatJoinedTime(user.created_at)}</p>
      </div>
    </div>
  </motion.article>
);

const MobileLoadingSkeleton = () => (
  <div className="md:hidden space-y-3 p-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="rounded-2xl border border-white/5 bg-white/5 h-28 animate-pulse"
      />
    ))}
  </div>
);

function AdminUsers() {
  const { role: currentUserRole } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const pageSize = 25;

  const totalPages =
    totalUsers && totalUsers > 0 ? Math.max(1, Math.ceil(totalUsers / pageSize)) : 1;

  const heroStats = useMemo<AdminStat[]>(
    () => [
      {
        label: "Total Users",
        value: String(totalUsers ?? users.length),
        hint: "All records in Supabase",
      },
      {
        label: "Visible on Page",
        value: String(users.length),
        hint: "After filters & pagination",
      },
      {
        label: "Role Filter",
        value: roleFilter ? roleFilter.toUpperCase() : "ALL",
        hint: roleFilter ? "Scoped to a role" : "All roles shown",
      },
    ],
    [totalUsers, users.length, roleFilter]
  );

  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Admin • Directory",
      eyebrowIcon: <Sparkles className="w-4 h-4 text-[#f8dda7]" />,
      heading: "User Management Console",
      description:
        "Search, filter, and audit every account from one premium gold control surface.",
      badges: [
        {
          label: `${debouncedSearchQuery ? "Filtered" : "Live"} view`,
          icon: <Users className="w-4 h-4 text-[#f4c979]" />,
        },
        {
          label: roleFilter ? `Role · ${roleFilter}` : "All roles",
          variant: "outline",
        },
      ],
    }),
    [debouncedSearchQuery, roleFilter]
  );

  const sidePanel = (
    <div className="space-y-4 text-sm text-[#fdf4db]/80">
      <p className="text-xs uppercase tracking-[0.35em] text-[#f7e7c3]">Quick guardrails</p>
      <ul className="space-y-2 text-xs">
        <li className="flex gap-2">
          <span className="text-[#f4c979]">•</span>Keep at least one admin in the system before demoting roles.
        </li>
        <li className="flex gap-2">
          <span className="text-[#f4c979]">•</span>Search is debounced so you can paste full emails without extra queries.
        </li>
        <li className="flex gap-2">
          <span className="text-[#f4c979]">•</span>Use the role filter for quick compliance snapshots before audits.
        </li>
      </ul>
    </div>
  );

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("user_profiles")
        .select("id, email, role, created_at", { count: "exact" })
        .order("created_at", { ascending: false });

      if (debouncedSearchQuery.trim()) {
        query = query.ilike("email", `%${debouncedSearchQuery}%`);
      }

      if (roleFilter) {
        query = query.eq("role", roleFilter);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        console.error("Supabase error:", error.message, error.details);
        toast.error(error.message || "Failed to load users");
        setUsers([]);
        return;
      }

      type SupabaseUserRow = {
        id: string;
        email: string | null;
        role: string;
        created_at: string;
      };

      const formattedUsers = (data || []).map((user: SupabaseUserRow) => ({
        id: user.id,
        email: user.email || "N/A",
        role: user.role,
        created_at: user.created_at,
      }));

      setUsers(formattedUsers);
      if (typeof count === "number") {
        setTotalUsers(count);
      }
    } catch (err: unknown) {
      console.error("Unexpected error:", err);
      toast.error("Unexpected error loading users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearchQuery, roleFilter]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await fetchUsers();
    };

    load();

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
          <p className="text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout title="User Management">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-[#b59d72] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by email..."
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
                  value={roleFilter || ""}
                  onChange={(e) => {
                    setRoleFilter(e.target.value || null);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-11 pr-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 appearance-none cursor-pointer"
                >
                  <option value="">All Roles</option>
                  <option value="user">User</option>
                  <option value="employee">Employee</option>
                  <option value="mechanic">Mechanic</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {(searchQuery || roleFilter) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex flex-wrap gap-2 pt-2"
              >
                {searchQuery && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f4c979]/30 bg-[#f4c979]/10 text-xs text-[#fef3d1]">
                    <span>Email: {searchQuery}</span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="hover:text-white"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {roleFilter && (
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f6dcb2]/30 bg-[#f6dcb2]/10 text-xs text-[#fef3d1]">
                    <span>Role: {roleFilter}</span>
                    <button
                      type="button"
                      onClick={() => setRoleFilter(null)}
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
              <>
                <div className="hidden md:block">
                  <TableSkeleton rows={6} columns={4} variant="gold" />
                </div>
                <MobileLoadingSkeleton />
              </>
            ) : users.length === 0 ? (
              <div className="text-center py-24 space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#211c15] border border-[#f6dcb2]/30 mx-auto">
                  <Users className="w-7 h-7 text-[#f4c979]" />
                </div>
                <h3 className="text-xl font-semibold text-white">No Users Found</h3>
                <p className="text-sm text-[#f8e5bb]/70 max-w-sm mx-auto">
                  {searchQuery || roleFilter
                    ? "Adjust your filters or keywords to see additional records."
                    : "No users are currently registered."}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-[#2b251b] to-[#1b1812] border-b border-[#f6dcb2]/15 text-[0.65rem] uppercase tracking-[0.3em] text-[#f4c979]/80">
                      <tr>
                        <th className="px-6 py-4 text-left">
                          <span className="inline-flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email
                          </span>
                        </th>
                        <th className="px-6 py-4 text-left">Role</th>
                        <th className="px-6 py-4 text-left">
                          <span className="inline-flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Joined
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm text-[#fdf4db]/90">
                      {users.map((user, index) => (
                        <motion.tr
                          key={user.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] font-semibold">
                                {user.email.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{user.email}</p>
                                <p className="text-[0.65rem] text-[#c7b696]">ID: {user.id.slice(0, 8)}…</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span
                              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${getRoleBadgeClass(
                                user.role
                              )}`}
                            >
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <p className="text-[#f0e2c7]">
                              {formatJoinedDate(user.created_at)}
                            </p>
                            <p className="text-xs text-[#c7b696]">
                              {formatJoinedTime(user.created_at)}
                            </p>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-3 p-4">
                  {users.map((user) => (
                    <MobileUserCard key={user.id} user={user} />
                  ))}
                </div>
                <div className="border-t border-[#f6dcb2]/15 bg-[#0c0a08]/80">
                  <div className="flex items-center justify-between px-6 py-4 text-sm text-[#f0e2c7]">
                    <div>
                      <span className="text-[#f4c979]">{(currentPage - 1) * pageSize + 1}</span> –
                      <span className="text-[#f4c979]">
                        {" "}
                        {Math.min(currentPage * pageSize, totalUsers || 0)}
                      </span>{" "}
                      of
                      <span className="text-[#f4c979]"> {totalUsers || 0}</span> users
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={currentPage === 1 || loading}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className="px-4 py-2 rounded-2xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] disabled:opacity-40"
                      >
                        ← Previous
                      </button>
                      <button
                        disabled={currentPage >= totalPages || loading}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className="px-4 py-2 rounded-2xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] disabled:opacity-40"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </AdminPremiumScaffold>
    </DashboardLayout>
  );
}

export default memo(AdminUsers);
