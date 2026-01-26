import { useEffect, useState, useCallback, memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Filter, Mail, Calendar, Shield, Sparkles, X, Clock, Award } from "lucide-react";
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
import { UserAvatar } from "../../components/ui/UserAvatar";
import { differenceInMonths } from "date-fns";

interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  hire_date: string | null;
  experience_level: 'apprentice' | 'journeyman' | 'expert' | null;
}

interface TenureInfo {
  months: number;
  isNewHire: boolean;
  displayText: string;
}

function getTenure(hireDate: string | null): TenureInfo | null {
  if (!hireDate) return null;
  const months = differenceInMonths(new Date(), new Date(hireDate));
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return {
    months,
    isNewHire: months < 12,
    displayText: months < 12 ? `New Hire (${months}mo)` : `${years}y ${remainingMonths}mo`
  };
}

const getExperienceBadgeClass = (level: string | null): string => {
  switch (level) {
    case 'expert':
      return 'bg-[#0d2818] text-[#6ee7b7] border border-emerald-500/40';
    case 'journeyman':
      return 'bg-[#1e1b4b] text-[#a5b4fc] border border-indigo-400/40';
    case 'apprentice':
      return 'bg-[#2d1f0f] text-[#fcd34d] border border-amber-400/40';
    default:
      return 'bg-white/5 text-[#9ca3af] border border-white/10';
  }
};

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
  onEditExperience: (user: AppUser) => void;
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
  onEditExperience,
}: MobileUserCardProps) => {
  const tenure = getTenure(user.hire_date);
  
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl sm:rounded-2xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#1b1914]/80 to-[#120f0c]/60 p-3 sm:p-4 space-y-2.5 sm:space-y-3 active:bg-[#f4c979]/5 transition-colors"
    >
      {/* User Avatar & Email */}
      <div className="flex items-start gap-2.5 sm:gap-3">
        <UserAvatar
          avatarUrl={user.avatar_url}
          name={user.full_name}
          email={user.email}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-xs sm:text-sm truncate">
            {user.full_name || user.email}
          </p>
          {user.full_name && (
            <p className="text-[9px] sm:text-[0.65rem] text-[#c7b696] truncate">{user.email}</p>
          )}
          <p className="text-[9px] sm:text-[0.65rem] text-[#c7b696]/60">ID: {user.id.slice(0, 8)}…</p>
        </div>
      </div>

      {/* Role Section */}
      <div className="space-y-1.5 sm:space-y-2">
        <p className="text-[9px] sm:text-xs uppercase tracking-wider text-[#f4c979]/70">Role</p>
        
        {editingRoleUserId === user.id ? (
          <div className="space-y-2">
            {/* Role Dropdown */}
            <select
              value={pendingRole}
              onChange={(e) => onRoleChange(e.target.value)}
              disabled={savingRole}
              className="w-full rounded-lg sm:rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 min-h-[40px] sm:min-h-[44px]"
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
                className="flex-1 px-2.5 sm:px-3 py-2 rounded-lg sm:rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 text-[10px] sm:text-xs font-semibold text-[#fef3d1] hover:bg-[#f4c979]/30 active:bg-[#f4c979]/40 disabled:opacity-50 transition-colors min-h-[40px] sm:min-h-[44px]"
              >
                {savingRole ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={onCancelEdit}
                disabled={savingRole}
                className="flex-1 px-2.5 sm:px-3 py-2 rounded-lg sm:rounded-xl border border-[#f6dcb2]/25 text-[10px] sm:text-xs font-semibold text-[#fdf4db] hover:bg-white/5 active:bg-white/10 disabled:opacity-50 transition-colors min-h-[40px] sm:min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold ${getRoleBadgeClass(user.role)}`}>
              {user.role.charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ')}
            </span>
            <button
              onClick={() => onEditRole(user.id, user.role)}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-[#f6dcb2]/25 text-[10px] sm:text-xs font-semibold text-[#fdf4db] hover:bg-white/5 active:bg-white/10 transition-colors min-h-[36px] sm:min-h-[40px]"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Experience Section */}
      <div className="space-y-1.5 sm:space-y-2">
        <p className="text-[9px] sm:text-xs uppercase tracking-wider text-[#f4c979]/70">Experience</p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {tenure && (
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
                tenure.isNewHire 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                  : 'bg-[#1a2a1a] text-[#a8e6a8] border border-green-500/30'
              }`}>
                <Clock className="w-3 h-3" />
                {tenure.displayText}
              </span>
            )}
            {user.experience_level && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold ${getExperienceBadgeClass(user.experience_level)}`}>
                {user.experience_level.charAt(0).toUpperCase() + user.experience_level.slice(1)}
              </span>
            )}
            {!tenure && !user.experience_level && (
              <span className="text-[10px] text-[#c7b696]/60">Not set</span>
            )}
          </div>
          <button
            onClick={() => onEditExperience(user)}
            className="px-2.5 py-1.5 rounded-lg border border-[#f6dcb2]/25 text-[10px] font-semibold text-[#fdf4db] hover:bg-white/5 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Joined Date */}
      <div className="pt-1.5 sm:pt-2 border-t border-white/5">
        <p className="text-[10px] sm:text-xs text-[#f0e2c7]">{formatJoinedDate(user.created_at)}</p>
        <p className="text-[9px] sm:text-[0.7rem] text-[#c7b696]">{formatJoinedTime(user.created_at)}</p>
      </div>
    </motion.article>
  );
};

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

// Experience Edit Modal
interface ExperienceEditModalProps {
  user: AppUser;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, hireDate: string | null, experienceLevel: 'apprentice' | 'journeyman' | 'expert' | null) => Promise<void>;
  saving: boolean;
}

const ExperienceEditModal = ({ user, isOpen, onClose, onSave, saving }: ExperienceEditModalProps) => {
  const [hireDate, setHireDate] = useState(user.hire_date || '');
  const [experienceLevel, setExperienceLevel] = useState<'apprentice' | 'journeyman' | 'expert' | ''>(user.experience_level || '');

  useEffect(() => {
    // Defer state updates to avoid cascading renders during effect execution
    requestAnimationFrame(() => {
      setHireDate(user.hire_date || '');
      setExperienceLevel(user.experience_level || '');
    });
  }, [user]);

  const handleSave = async () => {
    await onSave(
      user.id, 
      hireDate || null, 
      experienceLevel as 'apprentice' | 'journeyman' | 'expert' | null
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30 flex items-center justify-center">
                  <Award className="w-5 h-5 text-[#f4c979]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Edit Experience</h3>
                  <p className="text-xs text-[#c7b696]">{user.full_name || user.email}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Close user form"
              >
                <X className="w-5 h-5 text-[#c7b696]" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Hire Date */}
              <div>
                <label className="block text-xs font-semibold text-[#f4c979]/80 uppercase tracking-wider mb-2">
                  Hire Date
                </label>
                <input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="w-full rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 px-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                />
                {hireDate && (
                  <p className="mt-1.5 text-xs text-[#c7b696]">
                    Tenure: {getTenure(hireDate)?.displayText || 'N/A'}
                  </p>
                )}
              </div>

              {/* Experience Level */}
              <div>
                <label className="block text-xs font-semibold text-[#f4c979]/80 uppercase tracking-wider mb-2">
                  Experience Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as 'apprentice' | 'journeyman' | 'expert' | '')}
                  className="w-full rounded-xl bg-[#050402]/70 border border-[#f4c979]/20 px-4 py-3 text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
                >
                  <option value="">Not Set</option>
                  <option value="apprentice">Apprentice (&lt;1 year)</option>
                  <option value="journeyman">Journeyman (1-5 years)</option>
                  <option value="expert">Expert (5+ years)</option>
                </select>
                <p className="mt-1.5 text-xs text-[#c7b696]">
                  Used for Safety Forecast crew risk scoring
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-xl border border-[#f6dcb2]/25 text-sm font-semibold text-[#fdf4db] hover:bg-white/5 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 text-sm font-semibold text-[#fef3d1] hover:bg-[#f4c979]/30 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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

  // Experience editing state
  const [experienceModalUser, setExperienceModalUser] = useState<AppUser | null>(null);
  const [savingExperience, setSavingExperience] = useState(false);

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

  // Handle experience update
  const handleExperienceUpdate = useCallback(
    async (userId: string, hireDate: string | null, experienceLevel: 'apprentice' | 'journeyman' | 'expert' | null) => {
      setSavingExperience(true);
      try {
        const { error } = await supabase
          .from('app_users')
          .update({ 
            hire_date: hireDate || null,
            experience_level: experienceLevel || null
          })
          .eq('id', userId);

        if (error) {
          logger.error('Failed to update experience:', error);
          toast.error(error.message || 'Failed to update experience');
          return;
        }

        toast.success('Experience updated successfully');
        setExperienceModalUser(null);
      } catch (err) {
        logger.error('Unexpected error updating experience:', err);
        toast.error('Unexpected error occurred');
      } finally {
        setSavingExperience(false);
      }
    },
    []
  );

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("user_profiles")
        .select("id, email, full_name, role, avatar_url, created_at, hire_date, experience_level", { count: "exact" })
        .order("created_at", { ascending: false });

      if (debouncedSearchQuery.trim()) {
        query = query.ilike("email", `%${debouncedSearchQuery}%`);
      }

      if (roleFilter) {
        query = query.eq("role", roleFilter);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        logger.error("[AdminUsers] Supabase error:", error.message, error.details);
        toast.error(error.message || "Failed to load users");
        setUsers([]);
        return;
      }

      type SupabaseUserRow = {
        id: string;
        email: string | null;
        full_name: string | null;
        role: string;
        avatar_url: string | null;
        created_at: string;
        hire_date: string | null;
        experience_level: 'apprentice' | 'journeyman' | 'expert' | null;
      };

      // Helper to convert avatar storage path to public URL
      const getAvatarPublicUrl = (avatarPath: string | null): string | null => {
        if (!avatarPath) return null;
        const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
        return data.publicUrl ?? null;
      };

      const formattedUsers = (data || []).map((user: SupabaseUserRow) => ({
        id: user.id,
        email: user.email || "N/A",
        full_name: user.full_name,
        role: user.role,
        avatar_url: getAvatarPublicUrl(user.avatar_url),
        created_at: user.created_at,
        hire_date: user.hire_date,
        experience_level: user.experience_level,
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
        logger.error("[AdminUsers] Realtime subscription error:", error);
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

        <div className="space-y-4 sm:space-y-6 md:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl sm:rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
              <div className="relative">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-3 sm:left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl sm:rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 text-xs sm:text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 min-h-[42px] sm:min-h-[48px]"
                />
              </div>
              <div className="relative">
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#b59d72] absolute left-3 sm:left-4 top-1/2 -translate-y-1/2" />
                <select
                  value={roleFilter || ""}
                  onChange={(e) => {
                    setRoleFilter(e.target.value || null);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl sm:rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-9 sm:pl-11 pr-8 sm:pr-4 py-2.5 sm:py-3 text-xs sm:text-sm text-[#fdf4db] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60 appearance-none cursor-pointer min-h-[42px] sm:min-h-[48px]"
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
                className="flex flex-wrap gap-1.5 sm:gap-2 pt-1.5 sm:pt-2"
              >
                {searchQuery && (
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full border border-[#f4c979]/30 bg-[#f4c979]/10 text-[10px] sm:text-xs text-[#fef3d1]">
                    <span className="truncate max-w-[120px] sm:max-w-none">Email: {searchQuery}</span>
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="hover:text-white active:text-white/80 min-w-[16px] min-h-[16px] flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {roleFilter && (
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full border border-[#f6dcb2]/30 bg-[#f6dcb2]/10 text-[10px] sm:text-xs text-[#fef3d1]">
                    <span>Role: {roleFilter.replace('_', ' ')}</span>
                    <button
                      type="button"
                      onClick={() => setRoleFilter(null)}
                      className="hover:text-white active:text-white/80 min-w-[16px] min-h-[16px] flex items-center justify-center"
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
                            <Award className="w-4 h-4" />
                            Experience
                          </span>
                        </th>
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
                              <UserAvatar
                                avatarUrl={user.avatar_url}
                                name={user.full_name}
                                email={user.email}
                                size="md"
                              />
                              <div>
                                <p className="font-semibold text-white">
                                  {user.full_name || user.email}
                                </p>
                                {user.full_name && (
                                  <p className="text-[0.65rem] text-[#c7b696]">{user.email}</p>
                                )}
                                <p className="text-[0.65rem] text-[#c7b696]/60">ID: {user.id.slice(0, 8)}…</p>
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
                            {(() => {
                              const tenure = getTenure(user.hire_date);
                              return (
                                <div className="flex flex-col gap-1.5">
                                  {tenure && (
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold w-fit ${
                                      tenure.isNewHire 
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                                        : 'bg-[#1a2a1a] text-[#a8e6a8] border border-green-500/30'
                                    }`}>
                                      <Clock className="w-3 h-3" />
                                      {tenure.displayText}
                                    </span>
                                  )}
                                  {user.experience_level && (
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold w-fit ${getExperienceBadgeClass(user.experience_level)}`}>
                                      {user.experience_level.charAt(0).toUpperCase() + user.experience_level.slice(1)}
                                    </span>
                                  )}
                                  {!tenure && !user.experience_level && (
                                    <span className="text-xs text-[#c7b696]/60">Not set</span>
                                  )}
                                </div>
                              );
                            })()}
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
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingRoleUserId(user.id);
                                    setPendingRole(user.role);
                                  }}
                                  className="px-3 py-1.5 rounded-xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] hover:bg-white/5 transition-colors"
                                >
                                  Edit Role
                                </button>
                                <button
                                  onClick={() => setExperienceModalUser(user)}
                                  className="px-3 py-1.5 rounded-xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] hover:bg-white/5 transition-colors"
                                >
                                  Edit Experience
                                </button>
                              </div>
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
                      onEditExperience={setExperienceModalUser}
                    />
                  ))}
                </div>
                <div className="border-t border-[#f6dcb2]/15 bg-[#0c0a08]/80">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#f0e2c7]">
                    <div className="text-[10px] sm:text-sm">
                      <span className="text-[#f4c979]">{(currentPage - 1) * pageSize + 1}</span> –
                      <span className="text-[#f4c979]">
                        {" "}
                        {Math.min(currentPage * pageSize, totalUsers || 0)}
                      </span>{" "}
                      of
                      <span className="text-[#f4c979]"> {totalUsers || 0}</span> users
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        disabled={currentPage === 1 || loading}
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-[#f6dcb2]/25 text-[10px] sm:text-xs font-semibold text-[#fdf4db] disabled:opacity-40 hover:bg-white/5 active:bg-white/10 transition-colors min-h-[36px] sm:min-h-[40px]"
                      >
                        <span className="hidden xs:inline">←</span> Prev
                      </button>
                      <span className="text-[10px] sm:text-xs text-[#c7b696] px-1 sm:px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        disabled={currentPage >= totalPages || loading}
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-[#f6dcb2]/25 text-[10px] sm:text-xs font-semibold text-[#fdf4db] disabled:opacity-40 hover:bg-white/5 active:bg-white/10 transition-colors min-h-[36px] sm:min-h-[40px]"
                      >
                        Next <span className="hidden xs:inline">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Experience Edit Modal */}
      {experienceModalUser && (
        <ExperienceEditModal
          user={experienceModalUser}
          isOpen={!!experienceModalUser}
          onClose={() => setExperienceModalUser(null)}
          onSave={handleExperienceUpdate}
          saving={savingExperience}
        />
      )}
    </DashboardLayout>
  );
}

export default memo(AdminUsers);
