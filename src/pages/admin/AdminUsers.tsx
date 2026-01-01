import { useEffect, useState, useCallback, memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, Search, Filter, Mail, Calendar, Shield, Sparkles } from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { subscribeToTableChanges } from "../../lib/realtime";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import TableSkeleton from "../../components/skeletons/TableSkeleton";
import { toast } from "../../lib/toast";
import { logger } from "../../lib/logger";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";

interface AppUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

const getRoleBadgeClass = (role: string): string => {
  const badgeClasses: Record<string, string> = {
    // Existing roles
    admin: "bg-[#2a0b02] text-[#ffb199] border border-[#ff6b4a]/40",
    mechanic: "bg-[#0d1d2c] text-[#9cd7ff] border border-[#4c95c9]/40",
    employee: "bg-[#23102a] text-[#deb2ff] border border-[#b57ae3]/40",
    manager: "bg-[#1a2a1a] text-[#a8e6a8] border border-[#4caf50]/40",
    // New roles - aligned with dashboard themes
    general_foreman: "bg-[#2d1b4e]/30 text-[#e9d5ff] border border-[#c084fc]/40",
    safety_officer: "bg-[#450a0a]/30 text-[#fef2f2] border border-[#fecaca]/40",
    foreman: "bg-[#03150f]/30 text-[#e5fff6] border border-[#7de1b4]/35",
  };
  return badgeClasses[role] || "bg-white/5 text-[#fdf4db] border border-white/15";
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

interface MobileUserCardProps {
  user: AppUser;
  editingRoleUserId: string | null;
  pendingRole: string;
  savingRole: boolean;
  onEditRole: (userId: string, currentRole: string) => void;
  onSaveRole: (userId: string, email: string) => void;
  onCancelEdit: () => void;
  onRoleChange: (role: string) => void;
}

const MobileUserCard = ({
  user,
  editingRoleUserId,
  pendingRole,
  savingRole,
  onEditRole,
  onSaveRole,
  onCancelEdit,
  onRoleChange,
}: MobileUserCardProps) => (
  <motion.article
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#1b1914]/80 to-[#120f0c]/60 p-4 space-y-3"
  >
    {/* User Avatar & Email */}
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] font-semibold flex-shrink-0">
        {user.email.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate">{user.email}</p>
        <p className="text-[0.65rem] text-[#c7b696]">ID: {user.id.slice(0, 8)}…</p>
      </div>
    </div>

    {/* Role Section */}
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wider text-[#f4c979]/70">Role</p>
      
      {editingRoleUserId === user.id ? (
        <div className="space-y-2">
          {/* Role Dropdown */}
          <select
            value={pendingRole}
            onChange={(e) => onRoleChange(e.target.value)}
            disabled={savingRole}
            className="w-full rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 px-3 py-2 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="mechanic">Mechanic</option>
            <option value="general_foreman">General Foreman</option>
            <option value="safety_officer">Safety Officer</option>
            <option value="foreman">Foreman</option>
          </select>
          
          {/* Save/Cancel Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => onSaveRole(user.id, user.email)}
              disabled={savingRole}
              className="flex-1 px-3 py-2 rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 text-xs font-semibold text-[#fef3d1] hover:bg-[#f4c979]/30 disabled:opacity-50 transition-colors"
            >
              {savingRole ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onCancelEdit}
              disabled={savingRole}
              className="flex-1 px-3 py-2 rounded-xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] hover:bg-white/5 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${getRoleBadgeClass(user.role)}`}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ')}
          </span>
          <button
            onClick={() => onEditRole(user.id, user.role)}
            className="px-3 py-1.5 rounded-xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] hover:bg-white/5 transition-colors"
          >
            Edit
          </button>
        </div>
      )}
    </div>

    {/* Joined Date */}
    <div className="pt-2 border-t border-white/5">
      <p className="text-xs text-[#f0e2c7]">{formatJoinedDate(user.created_at)}</p>
      <p className="text-[0.7rem] text-[#c7b696]">{formatJoinedTime(user.created_at)}</p>
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
  const { role: currentUserRole, user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const pageSize = 25;

  // Role editing state
  const [editingRoleUserId, setEditingRoleUserId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);

  const totalPages =
    totalUsers && totalUsers > 0 ? Math.max(1, Math.ceil(totalUsers / pageSize)) : 1;

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  // Update user role function
  const updateUserRole = useCallback(
    async (
      userId: string,
      newRole: string,
      targetEmail: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // Safety check: prevent self-demotion from admin
        if (user?.email === targetEmail && newRole !== 'admin') {
          return {
            success: false,
            error: 'You cannot demote yourself from admin role',
          };
        }

        const { error } = await supabase
          .from('app_users')
          .update({ role: newRole })
          .eq('id', userId);

        if (error) {
          logger.error('Failed to update user role:', error);
          return { success: false, error: error.message };
        }

        return { success: true };
      } catch (err) {
        logger.error('Unexpected error updating role:', err);
        return { success: false, error: 'Unexpected error occurred' };
      }
    },
    [user?.email]
  );

  // Handle role change with save
  const handleRoleChange = useCallback(
    async (userId: string, email: string) => {
      const currentRole = users.find(u => u.id === userId)?.role;
      if (!pendingRole || pendingRole === currentRole) {
        setEditingRoleUserId(null);
        setPendingRole("");
        return;
      }

      setSavingRole(true);
      const result = await updateUserRole(userId, pendingRole, email);
      setSavingRole(false);

      if (result.success) {
        toast.success(`Role updated to ${pendingRole.replace('_', ' ')}`);
        setEditingRoleUserId(null);
        setPendingRole("");
      } else {
        toast.error(result.error || 'Failed to update role');
      }
    },
    [pendingRole, users, updateUserRole]
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
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#f8e5bb]">Admin • Directory</span>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20">
                    <Users className="w-3 h-3 text-[#f4c979]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">{debouncedSearchQuery ? "Filtered" : "Live"} view</span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-4">
                  <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(244, 201, 121, 0.5), 0 0 40px rgba(244, 201, 121, 0.25)' }} />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,201,121,0.35)]">
                        User Management Console
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">User Management Console</h1>
                    )}
                    <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium leading-relaxed max-w-xl">
                      Search, filter, and audit every account from one control surface
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

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
                  <option value="employee">Employee</option>
                  <option value="mechanic">Mechanic</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="general_foreman">General Foreman</option>
                  <option value="safety_officer">Safety Officer</option>
                  <option value="foreman">Foreman</option>
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
                        <th className="px-6 py-4 text-left">Actions</th>
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
                          {/* Actions Column */}
                          <td className="px-6 py-5">
                            {editingRoleUserId === user.id ? (
                              <div className="flex items-center gap-2">
                                {/* Role Dropdown */}
                                <select
                                  value={pendingRole}
                                  onChange={(e) => setPendingRole(e.target.value)}
                                  disabled={savingRole}
                                  className="rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 px-3 py-1.5 text-xs text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                                >
                                  <option value="employee">Employee</option>
                                  <option value="admin">Admin</option>
                                  <option value="manager">Manager</option>
                                  <option value="mechanic">Mechanic</option>
                                  <option value="general_foreman">General Foreman</option>
                                  <option value="safety_officer">Safety Officer</option>
                                  <option value="foreman">Foreman</option>
                                </select>
                                
                                {/* Save Button */}
                                <button
                                  onClick={() => handleRoleChange(user.id, user.email)}
                                  disabled={savingRole}
                                  className="px-3 py-1.5 rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 text-xs font-semibold text-[#fef3d1] hover:bg-[#f4c979]/30 disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                  {savingRole ? 'Saving...' : 'Save'}
                                </button>
                                
                                {/* Cancel Button */}
                                <button
                                  onClick={() => {
                                    setEditingRoleUserId(null);
                                    setPendingRole("");
                                  }}
                                  disabled={savingRole}
                                  className="px-3 py-1.5 rounded-xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] hover:bg-white/5 disabled:opacity-50 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingRoleUserId(user.id);
                                  setPendingRole(user.role);
                                }}
                                className="px-3 py-1.5 rounded-xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] hover:bg-white/5 transition-colors"
                              >
                                Edit Role
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-3 p-4">
                  {users.map((user) => (
                    <MobileUserCard
                      key={user.id}
                      user={user}
                      editingRoleUserId={editingRoleUserId}
                      pendingRole={pendingRole}
                      savingRole={savingRole}
                      onEditRole={(userId, currentRole) => {
                        setEditingRoleUserId(userId);
                        setPendingRole(currentRole);
                      }}
                      onSaveRole={handleRoleChange}
                      onCancelEdit={() => {
                        setEditingRoleUserId(null);
                        setPendingRole("");
                      }}
                      onRoleChange={setPendingRole}
                    />
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
      </div>
    </DashboardLayout>
  );
}

export default memo(AdminUsers);
