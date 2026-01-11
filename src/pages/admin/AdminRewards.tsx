import { useState, useMemo, memo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Search,
  Shield,
  Sparkles,
  Star,
  Users,
  TrendingUp,
  Gift,
  ChevronRight,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import {
  useAdminRewardsGrouped,
  useAdminRewardsStats,
  type GroupedUserReward,
} from "../../hooks/queries/useAdminRewards";
import { UserRewardsDetailModal } from "../../components/admin/UserRewardsDetailModal";

// User card component - shows consolidated user info
interface UserRewardCardProps {
  user: GroupedUserReward;
  index: number;
  onClick: () => void;
}

const UserRewardCard = memo(({ user, index, onClick }: UserRewardCardProps) => (
  <motion.button
    type="button"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.04, duration: 0.3 }}
    onClick={onClick}
    className="w-full text-left group"
  >
    <div className="relative rounded-2xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#1b1914]/80 to-[#120f0c]/60 p-4 hover:border-[#f6dcb2]/35 hover:bg-[#1b1914]/90 transition-all duration-300 overflow-hidden">
      {/* Subtle hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-[#f4c979]/5 to-transparent" />
      </div>

      <div className="relative flex items-center gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] font-bold text-lg flex-shrink-0 shadow-[0_4px_15px_rgba(244,201,121,0.25)]">
          {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate group-hover:text-[#fff6dd] transition-colors">
            {user.full_name || "Unknown User"}
          </p>
          <p className="text-xs text-[#f4c979]/80 truncate">
            {user.email || "No email"}
          </p>
          <p className="text-[0.65rem] text-[#c7b696] mt-0.5">
            {user.claim_count} {user.claim_count === 1 ? "claim" : "claims"}
          </p>
        </div>

        {/* Points badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30">
            <Trophy className="w-4 h-4 text-[#f4c979]" />
            <span className="text-lg font-bold text-[#fef3d1]">{user.total_points}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#f4c979]/40 group-hover:text-[#f4c979]/80 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </div>
  </motion.button>
));

UserRewardCard.displayName = "UserRewardCard";

// Mobile user card
const MobileUserCard = memo(({ user, index, onClick }: UserRewardCardProps) => (
  <motion.button
    type="button"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.03 }}
    onClick={onClick}
    className="w-full text-left"
  >
    <div className="rounded-2xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#1b1914]/80 to-[#120f0c]/60 p-4 active:scale-[0.98] transition-transform">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] font-semibold flex-shrink-0">
          {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">
            {user.full_name || "Unknown User"}
          </p>
          <p className="text-xs text-[#f4c979]/80 truncate">
            {user.email || "No email"}
          </p>
        </div>

        {/* Points badge */}
        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#f4c979]/20 border border-[#f4c979]/40 flex-shrink-0">
          <Star className="w-3.5 h-3.5 text-[#f4c979]" />
          <span className="text-sm font-bold text-[#fef3d1]">{user.total_points}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-[#c7b696]">
          {user.claim_count} {user.claim_count === 1 ? "claim" : "claims"}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-[#f4c979]/70">
          View details
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  </motion.button>
));

MobileUserCard.displayName = "MobileUserCard";

// Loading skeleton
const LoadingSkeleton = () => (
  <div className="space-y-3 p-4">
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        key={index}
        className="rounded-2xl border border-white/5 bg-white/5 h-20 animate-pulse"
      />
    ))}
  </div>
);

// Stat card component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}

const StatCard = ({ icon, label, value, subtext }: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914]/80 to-[#120f0c]/60 p-4 flex items-center gap-4"
  >
    <div className="w-12 h-12 rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30 flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div>
      <p className="text-xs uppercase tracking-wider text-[#f4c979]/70">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {subtext && <p className="text-xs text-[#c7b696]">{subtext}</p>}
    </div>
  </motion.div>
);

function AdminRewards() {
  const { role: currentUserRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Modal state
  const [selectedUser, setSelectedUser] = useState<GroupedUserReward | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  // Fetch grouped rewards data
  const {
    data: rewardsData,
    isLoading: loading,
    isError,
  } = useAdminRewardsGrouped({
    page: currentPage,
    pageSize,
    searchQuery: debouncedSearchQuery || undefined,
  });

  // Fetch aggregate stats
  const { data: stats } = useAdminRewardsStats();

  const users = rewardsData?.users || [];
  const totalUsers = rewardsData?.totalUsers || 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Modal handlers
  const openModal = useCallback((user: GroupedUserReward) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    // Delay clearing selectedUser to allow exit animation
    setTimeout(() => setSelectedUser(null), 200);
  }, []);

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
    <DashboardLayout title="Safety Rewards">
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
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%)",
                }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 25% 0%, rgba(244, 201, 121, 0.2) 0%, transparent 45%)",
                }}
              />
              <div
                className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0%, transparent 50%)",
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
                      Admin • Rewards
                    </span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1c1c1f]/60 border border-[#f4c979]/20"
                  >
                    <Users className="w-3 h-3 text-[#f4c979]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#f8e5bb]/70">
                      {debouncedSearchQuery ? "Filtered" : "All Users"}
                    </span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f7e4bd] via-[#f4c979] to-[#d79a32] origin-top flex-shrink-0"
                    style={{
                      boxShadow:
                        "0 0 20px rgba(244, 201, 121, 0.5), 0 0 40px rgba(244, 201, 121, 0.25)",
                    }}
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
                        Safety Rewards Dashboard
                      </TextEffect>
                    ) : (
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f8e5bb] to-white/90 bg-clip-text text-transparent">
                        Safety Rewards Dashboard
                      </h1>
                    )}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7 }}
                      className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#f8e5bb]/50 font-medium leading-relaxed max-w-xl"
                    >
                      Track reward claims from Safety AI announcements
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={<Gift className="w-6 h-6 text-[#f4c979]" />}
              label="Total Claims"
              value={stats?.totalClaims ?? 0}
              subtext="All-time rewards claimed"
            />
            <StatCard
              icon={<TrendingUp className="w-6 h-6 text-[#f4c979]" />}
              label="Total Points"
              value={stats?.totalPoints ?? 0}
              subtext="Points awarded to users"
            />
            <StatCard
              icon={<Users className="w-6 h-6 text-[#f4c979]" />}
              label="Unique Users"
              value={stats?.uniqueUsers ?? 0}
              subtext="Users who claimed rewards"
            />
          </div>

          {/* Search Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] p-5 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
          >
            <div className="relative">
              <Search className="w-4 h-4 text-[#b59d72] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full rounded-2xl bg-[#050402]/70 border border-[#f4c979]/20 pl-11 pr-4 py-3 text-sm text-[#fdf4db] placeholder:text-[#bfa984] focus:outline-none focus:ring-2 focus:ring-[#f4c979]/60"
              />
            </div>

            {/* Active search filter */}
            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-2 mt-3"
              >
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#f4c979]/30 bg-[#f4c979]/10 text-xs text-[#fef3d1]">
                  <span>Search: {searchQuery}</span>
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="hover:text-white"
                  >
                    ✕
                  </button>
                </span>
              </motion.div>
            )}
          </motion.div>

          {/* Users Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="rounded-3xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.65)]"
          >
            {loading ? (
              <LoadingSkeleton />
            ) : isError ? (
              <div className="text-center py-24 space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 mx-auto">
                  <Shield className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Error Loading Rewards</h3>
                <p className="text-sm text-[#f8e5bb]/70 max-w-sm mx-auto">
                  Failed to load rewards data. Please try again later.
                </p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-24 space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#211c15] border border-[#f6dcb2]/30 mx-auto">
                  <Trophy className="w-7 h-7 text-[#f4c979]" />
                </div>
                <h3 className="text-xl font-semibold text-white">No Users Found</h3>
                <p className="text-sm text-[#f8e5bb]/70 max-w-sm mx-auto">
                  {searchQuery
                    ? "No users match your search. Try a different name or email."
                    : "No reward claims have been recorded yet."}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Grid */}
                <div className="hidden md:block p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {users.map((user, index) => (
                      <UserRewardCard
                        key={user.user_id}
                        user={user}
                        index={index}
                        onClick={() => openModal(user)}
                      />
                    ))}
                  </div>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3 p-4">
                  {users.map((user, index) => (
                    <MobileUserCard
                      key={user.user_id}
                      user={user}
                      index={index}
                      onClick={() => openModal(user)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalUsers > pageSize && (
                  <div className="border-t border-[#f6dcb2]/15 bg-[#0c0a08]/80">
                    <div className="flex items-center justify-between px-6 py-4 text-sm text-[#f0e2c7]">
                      <div>
                        <span className="text-[#f4c979]">
                          {(currentPage - 1) * pageSize + 1}
                        </span>{" "}
                        –
                        <span className="text-[#f4c979]">
                          {" "}
                          {Math.min(currentPage * pageSize, totalUsers)}
                        </span>{" "}
                        of
                        <span className="text-[#f4c979]"> {totalUsers}</span> users
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={currentPage === 1 || loading}
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          className="px-4 py-2 rounded-2xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] disabled:opacity-40 hover:bg-white/5 transition-colors"
                        >
                          ← Previous
                        </button>
                        <button
                          disabled={currentPage >= totalPages || loading}
                          onClick={() =>
                            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                          }
                          className="px-4 py-2 rounded-2xl border border-[#f6dcb2]/25 text-xs font-semibold text-[#fdf4db] disabled:opacity-40 hover:bg-white/5 transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Detail Modal */}
      <UserRewardsDetailModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={closeModal}
      />
    </DashboardLayout>
  );
}

export default memo(AdminRewards);
