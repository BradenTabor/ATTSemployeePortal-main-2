import { useState, useMemo, memo, useCallback } from "react";
import { Link } from "react-router-dom";
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
  ScrollText,
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
import { AwardPointsModal } from "../../components/admin/manual-awards/AwardPointsModal";
import { useManualAwardsModal } from "../../hooks/useManualAwardsModal";

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
    <div className="relative rounded-leaf-sm border border-[#E4EAE1]/15 bg-gradient-to-br from-[#121A15]/80 to-[#0B100D]/60 p-4 hover:border-[#E4EAE1]/35 hover:bg-[#121A15]/90 transition-all duration-300 overflow-hidden">
      {/* Subtle hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-[#F4F7F2]/5 to-transparent" />
      </div>

      <div className="relative flex items-center gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F4F7F2] to-[#8DF5A8] flex items-center justify-center text-[#040605] font-bold text-lg flex-shrink-0 shadow-[0_4px_15px_rgba(221,255,133,0.25)]">
          {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
        </div>

        {/* User info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate group-hover:text-[#F4F7F2] transition-colors">
            {user.full_name || "Unknown User"}
          </p>
          <p className="text-xs text-[#F4F7F2]/80 truncate">
            {user.email || "No email"}
          </p>
          <p className="text-[0.65rem] text-[#B8C4B6] mt-0.5">
            {user.claim_count} {user.claim_count === 1 ? "claim" : "claims"}
          </p>
        </div>

        {/* Points badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F4F7F2]/15 border border-[#F4F7F2]/30">
            <Trophy className="w-4 h-4 text-[#F4F7F2]" />
            <span className="text-lg font-bold text-[#F4F7F2]">{user.total_points}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#F4F7F2]/40 group-hover:text-[#F4F7F2]/80 group-hover:translate-x-0.5 transition-all" />
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
    <div className="rounded-xl sm:rounded-leaf-sm border border-[#E4EAE1]/15 bg-gradient-to-br from-[#121A15]/80 to-[#0B100D]/60 p-3 sm:p-4 active:scale-[0.98] active:bg-[#F4F7F2]/5 transition-all">
      <div className="flex items-start gap-2.5 sm:gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#F4F7F2] to-[#8DF5A8] flex items-center justify-center text-[#040605] font-semibold text-sm sm:text-base flex-shrink-0">
          {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-xs sm:text-sm truncate">
            {user.full_name || "Unknown User"}
          </p>
          <p className="text-[10px] sm:text-xs text-[#F4F7F2]/80 truncate">
            {user.email || "No email"}
          </p>
        </div>

        {/* Points badge */}
        <div className="flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#F4F7F2]/20 border border-[#F4F7F2]/40 flex-shrink-0">
          <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#F4F7F2]" />
          <span className="text-xs sm:text-sm font-bold text-[#F4F7F2]">{user.total_points}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] sm:text-xs text-[#B8C4B6]">
          {user.claim_count} {user.claim_count === 1 ? "claim" : "claims"}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-[#F4F7F2]/70">
          View
          <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
        className="rounded-leaf-sm border border-white/5 bg-white/5 h-20 animate-pulse"
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
    className="rounded-xl sm:rounded-leaf-sm border border-[#E4EAE1]/20 bg-gradient-to-br from-[#121A15]/80 to-[#0B100D]/60 p-3 sm:p-4 flex items-center gap-2.5 sm:gap-4"
  >
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-[#F4F7F2]/15 border border-[#F4F7F2]/30 flex items-center justify-center flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[9px] sm:text-xs uppercase text-[#F4F7F2]/70 truncate font-mono font-medium tracking-[0.14em]">{label}</p>
      <p className="text-xl sm:text-2xl font-bold text-white">{value}</p>
      {subtext && <p className="text-[9px] sm:text-xs text-[#B8C4B6] truncate hidden xs:block">{subtext}</p>}
    </div>
  </motion.div>
);

function AdminRewards() {
  const { role: currentUserRole } = useAuth();
  const {
    canAward,
    isOpen: awardModalOpen,
    initialRecipient,
    openAwardModal,
    closeAwardModal,
  } = useManualAwardsModal();
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

  const handleAwardFromUser = useCallback(
    (user: GroupedUserReward) => {
      openAwardModal({
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email ?? '',
        role: '',
      });
    },
    [openAwardModal]
  );

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
    <DashboardLayout title="Safety Rewards" pageHeading>
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
              className="relative overflow-hidden rounded-leaf-sm md:rounded-leaf border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(221,255,133, 0.1) 0%, rgba(30,42,35, 0.65) 40%, rgba(11,16,13, 0.75) 100%)",
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
                    "radial-gradient(ellipse at 25% 0%, rgba(221,255,133, 0.2) 0%, transparent 45%)",
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
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F4F7F2]/15 border border-[#F4F7F2]/30"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#F4F7F2]" />
                    <span className="text-[10px] uppercase text-[#E4EAE1] font-mono font-medium tracking-[0.14em]">
                      Admin • Rewards
                    </span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121A15]/60 border border-[#F4F7F2]/20"
                  >
                    <Users className="w-3 h-3 text-[#F4F7F2]" />
                    <span className="text-[9px] uppercase text-[#E4EAE1]/70 font-mono font-medium tracking-[0.14em]">
                      {debouncedSearchQuery ? "Filtered" : "All Users"}
                    </span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-[#E4EAE1] via-[#F4F7F2] to-[#8DF5A8] origin-top flex-shrink-0"
                    style={{
                      boxShadow:
                        "0 0 20px rgba(221,255,133, 0.5), 0 0 40px rgba(221,255,133, 0.25)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect
                        as="h1"
                        preset="blurSlide"
                        per="char"
                        delay={0.15}
                        className="type-display font-light text-bone-50 text-[clamp(1.6rem,3.8vw,2.6rem)]"
                        segmentWrapperClassName="text-glow"
                      >
                        Safety Rewards Dashboard
                      </TextEffect>
                    ) : (
                      <h1 className="type-display font-light text-bone-50 text-[clamp(1.6rem,3.8vw,2.6rem)]">
                        Safety Rewards Dashboard
                      </h1>
                    )}
                    <motion.p
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.7 }}
                      className="mt-1.5 md:mt-2 text-xs sm:text-sm text-[#E4EAE1]/50 font-medium leading-relaxed max-w-xl"
                    >
                      Track reward claims from Safety AI announcements
                    </motion.p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {canAward && (
                        <button
                          type="button"
                          onClick={() => openAwardModal()}
                          className="inline-flex min-h-[44px] items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F4F7F2]/20 border border-[#F4F7F2]/40 text-xs font-semibold text-[#F4F7F2] hover:bg-[#F4F7F2]/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                        >
                          <Gift className="w-3.5 h-3.5" aria-hidden />
                          Award Points
                        </button>
                      )}
                      <Link
                        to="/admin/manual-awards"
                        className="inline-flex min-h-[44px] items-center gap-2 px-3 py-1.5 rounded-xl border border-white/15 text-xs font-semibold text-[#B8C4B6] hover:text-[#F4F7F2] hover:border-[#F4F7F2]/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400"
                      >
                        <ScrollText className="w-3.5 h-3.5" aria-hidden />
                        Grants &amp; Audit
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/30 to-transparent" />
              <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-black/20 to-transparent" />
            </div>
          </motion.div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <StatCard
              icon={<Gift className="text-[#F4F7F2]" />}
              label="Claims"
              value={stats?.totalClaims ?? 0}
              subtext="All-time rewards claimed"
            />
            <StatCard
              icon={<TrendingUp className="text-[#F4F7F2]" />}
              label="Points"
              value={stats?.totalPoints ?? 0}
              subtext="Points awarded to users"
            />
            <StatCard
              icon={<Users className="text-[#F4F7F2]" />}
              label="Users"
              value={stats?.uniqueUsers ?? 0}
              subtext="Users who claimed rewards"
            />
          </div>

          {/* Search Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-leaf-sm sm:rounded-leaf border border-[#E4EAE1]/20 bg-gradient-to-br from-[#121A15] via-[#0B100D] to-[#040605] p-3 sm:p-5 shadow-[0_25px_50px_rgba(0,0,0,0.55)]"
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8A9A8E] absolute left-3 sm:left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full rounded-xl sm:rounded-leaf-sm bg-[#040605]/70 border border-[#F4F7F2]/20 pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 text-xs sm:text-sm text-[#F4F7F2] placeholder:text-[#8A9A8E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F7F2]/60 min-h-[42px] sm:min-h-[48px]"
              />
            </div>

            {/* Active search filter */}
            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-center gap-2 mt-2.5 sm:mt-3"
              >
                <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full border border-[#F4F7F2]/30 bg-[#F4F7F2]/10 text-[10px] sm:text-xs text-[#F4F7F2]">
                  <span className="truncate max-w-[150px] sm:max-w-none">Search: {searchQuery}</span>
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="hover:text-white active:text-white/80 min-w-[16px] min-h-[16px] flex items-center justify-center"
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
            className="rounded-leaf border border-[#E4EAE1]/20 bg-gradient-to-br from-[#0B100D] via-[#040605] to-[#040605] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.65)]"
          >
            {loading ? (
              <LoadingSkeleton />
            ) : isError ? (
              <div className="text-center py-24 space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-leaf-sm bg-red-500/10 border border-red-500/30 mx-auto">
                  <Shield className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white">Error Loading Rewards</h3>
                <p className="text-sm text-[#E4EAE1]/70 max-w-sm mx-auto">
                  Failed to load rewards data. Please try again later.
                </p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-24 space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-leaf-sm bg-[#121A15] border border-[#E4EAE1]/30 mx-auto">
                  <Trophy className="w-7 h-7 text-[#F4F7F2]" />
                </div>
                <h3 className="text-xl font-semibold text-white">No Users Found</h3>
                <p className="text-sm text-[#E4EAE1]/70 max-w-sm mx-auto">
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
                  <div className="border-t border-[#E4EAE1]/15 bg-[#0B100D]/80">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#D3DCD1]">
                      <div className="text-[10px] sm:text-sm">
                        <span className="text-[#F4F7F2]">
                          {(currentPage - 1) * pageSize + 1}
                        </span>{" "}
                        –
                        <span className="text-[#F4F7F2]">
                          {" "}
                          {Math.min(currentPage * pageSize, totalUsers)}
                        </span>{" "}
                        of
                        <span className="text-[#F4F7F2]"> {totalUsers}</span> users
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                          disabled={currentPage === 1 || loading}
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-leaf-sm border border-[#E4EAE1]/25 text-[10px] sm:text-xs font-semibold text-[#F4F7F2] disabled:opacity-40 hover:bg-white/5 active:bg-white/10 transition-colors min-h-[36px] sm:min-h-[40px]"
                        >
                          <span className="hidden xs:inline">←</span> Prev
                        </button>
                        <span className="text-[10px] sm:text-xs text-[#B8C4B6] px-1 sm:px-2">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          disabled={currentPage >= totalPages || loading}
                          onClick={() =>
                            setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                          }
                          className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-leaf-sm border border-[#E4EAE1]/25 text-[10px] sm:text-xs font-semibold text-[#F4F7F2] disabled:opacity-40 hover:bg-white/5 active:bg-white/10 transition-colors min-h-[36px] sm:min-h-[40px]"
                        >
                          Next <span className="hidden xs:inline">→</span>
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
        onAwardPoints={
          canAward && selectedUser
            ? () => handleAwardFromUser(selectedUser)
            : undefined
        }
      />
      <AwardPointsModal
        isOpen={awardModalOpen}
        onClose={closeAwardModal}
        initialRecipient={initialRecipient}
      />
    </DashboardLayout>
  );
}

export default memo(AdminRewards);
