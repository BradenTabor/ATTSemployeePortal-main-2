/**
 * Safety Analytics section for Safety & Compliance Hub.
 * Body-only content from SafetyAnalyticsDashboard (no DashboardLayout).
 */

import { useState, useMemo, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Search,
  Users,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  Calendar,
  ClipboardCheck,
  Megaphone,
  ChevronRight,
  Medal,
  Flame,
  RefreshCw,
  Filter,
  X,
  Download,
  FileText,
  Shield,
} from "lucide-react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useModalOverlay } from "../../../hooks/useModalOverlay";
import { cn } from "../../../lib/utils";
import {
  useSafetyAnalytics,
  useUserSafetyDetail,
  type Period,
  type UnifiedLeaderboardEntry,
} from "../../../hooks/queries/useSafetyAnalytics";
import { toast } from "../../../lib/toast";
import { exportOsha300Csv } from "../../../lib/osha300Export";
import { exportAnalyticsPdf } from "../../../lib/analyticsPdfExport";

const CircularProgress = memo(function CircularProgress({
  value,
  size = 64,
  strokeWidth = 5,
  color = "#f4c979",
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white font-mono tabular-nums">{Math.round(value)}</span>
      </div>
    </div>
  );
});

const StatPill = memo(function StatPill({
  icon: Icon,
  label,
  value,
  trend,
  color = "gold",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  trend?: number;
  color?: "gold" | "emerald" | "purple" | "amber";
}) {
  const colors = {
    gold: "text-[#f4c979] bg-[#f4c979]/10 border-[#f4c979]/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
      <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0", colors[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-bold text-white font-mono tabular-nums">{value}</span>
          {trend !== undefined && trend !== 0 && (
            <span className={cn("flex items-center text-[10px] font-mono tabular-nums", trend > 0 ? "text-emerald-400" : "text-red-400")}>
              {trend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

const RankBadge = memo(function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
        <Trophy className="w-3 h-3 text-amber-900" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
        <Medal className="w-3 h-3 text-gray-700" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center">
        <Medal className="w-3 h-3 text-amber-200" />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-[#1a1408]/60 border border-[#f6dcb2]/20 flex items-center justify-center text-[10px] font-bold text-[#f6dcb2]/50">
      {rank}
    </div>
  );
});

const SafetyScoreBadge = memo(function SafetyScoreBadge({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return "bg-emerald-500/20 border-emerald-500/30 text-emerald-300";
    if (score >= 60) return "bg-amber-500/20 border-amber-500/30 text-amber-300";
    return "bg-red-500/20 border-red-500/30 text-red-300";
  };

  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-0.5", getColor())}>
      <Shield className="w-2.5 h-2.5" />
      {score}
    </span>
  );
});

const LeaderboardRow = memo(function LeaderboardRow({
  entry,
  index,
  onClick,
}: {
  entry: UnifiedLeaderboardEntry;
  index: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left group",
        entry.rank <= 3
          ? "bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/15 hover:border-amber-500/30"
          : "bg-white/[0.02] border-white/5 hover:border-[#f6dcb2]/15 hover:bg-white/[0.03]"
      )}
    >
      <RankBadge rank={entry.rank} />
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] text-xs font-bold flex-shrink-0">
        {entry.full_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white truncate group-hover:text-[#fff6dd]">
            {entry.full_name}
          </span>
          {entry.current_streak >= 3 && (
            <span className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-500/20 border border-orange-500/30">
              <Flame className="w-2.5 h-2.5 text-orange-400" />
              <span className="text-[8px] font-bold text-orange-300">{entry.current_streak}</span>
            </span>
          )}
        </div>
        <div className="text-[9px] text-[#f6dcb2]/40">
          {entry.compliance_rate}% • {entry.total_points} pts
        </div>
      </div>
      <SafetyScoreBadge score={entry.safety_score} />
      <ChevronRight className="w-3 h-3 text-[#f6dcb2]/20 group-hover:text-[#f6dcb2]/40 transition-colors" />
    </motion.button>
  );
});

const PeriodSelector = memo(function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const periods: Array<{ key: Period; label: string }> = [
    { key: "week", label: "7D" },
    { key: "month", label: "30D" },
    { key: "quarter", label: "90D" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-black/30 border border-white/5" role="tablist" aria-label="Time period">
      {periods.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "px-2 py-1 rounded text-[10px] font-medium transition-all focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-1",
            value === key
              ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
              : "text-[#f6dcb2]/40 hover:text-[#f6dcb2]/70"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
});

const UserDetailModal = memo(function UserDetailModal({
  userId,
  isOpen,
  onClose,
  period,
}: {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  period: Period;
}) {
  const { data: userDetail, isLoading } = useUserSafetyDetail(userId || "", period);
  const { modalRef, zIndex } = useModalOverlay({ isOpen, onClose, zIndex: 100 });

  if (!isOpen) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        style={{ zIndex }}
        onClick={onClose}
        aria-hidden
      >
        <motion.div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="safety-user-detail-title"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-[#f6dcb2]/20 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#080705] shadow-2xl"
        >
          {isLoading || !userDetail ? (
            <div className="p-6 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-white/5 animate-pulse mb-3" />
              <p className="text-white/50 text-sm">Loading...</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-[#f6dcb2]/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f4c979] to-[#d89d3e] flex items-center justify-center text-[#2d1c04] font-bold">
                  {userDetail.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h2 id="safety-user-detail-title" className="text-sm font-bold text-white">
                    {userDetail.full_name}
                  </h2>
                  <p className="text-[10px] text-[#f6dcb2]/50 capitalize">{userDetail.role.replace("_", " ")}</p>
                </div>
                <SafetyScoreBadge score={userDetail.safety_score} />
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                  aria-label="Close user detail"
                >
                  <X className="w-4 h-4 text-white/40" aria-hidden />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                    <ClipboardCheck className="w-4 h-4 text-emerald-400 mx-auto mb-0.5" />
                    <div className="text-sm font-bold text-white">{userDetail.compliance_points}</div>
                    <div className="text-[8px] text-white/50 uppercase">Forms</div>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                    <Megaphone className="w-4 h-4 text-amber-400 mx-auto mb-0.5" />
                    <div className="text-sm font-bold text-white">{userDetail.announcement_points}</div>
                    <div className="text-[8px] text-white/50 uppercase">Announce</div>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-center">
                    <Trophy className="w-4 h-4 text-amber-400 mx-auto mb-0.5" />
                    <div className="text-sm font-bold text-amber-300">{userDetail.total_points}</div>
                    <div className="text-[8px] text-amber-300/70 uppercase">Total</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 rounded-xl border border-[#f6dcb2]/10 bg-white/[0.02]">
                  <CircularProgress value={userDetail.compliance_rate} color="#10b981" />
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-lg font-bold text-white">{userDetail.full_compliance_days}</div>
                      <div className="text-[9px] text-white/50">Full compliance</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">{userDetail.compliance_days}</div>
                      <div className="text-[9px] text-white/50">Days tracked</div>
                    </div>
                  </div>
                </div>
                {userDetail.current_streak > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <Flame className="w-5 h-5 text-orange-400" />
                    <div>
                      <div className="text-sm font-bold text-orange-300">{userDetail.current_streak} Day Streak</div>
                      <div className="text-[10px] text-orange-300/60">Longest: {userDetail.longest_streak} days</div>
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-[#f6dcb2]/10 bg-white/[0.02] p-3">
                  <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#f4c979]" />
                    Recent Activity
                  </h3>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                    {userDetail.activity_timeline.slice(0, 8).map((activity, idx) => (
                      <div key={idx} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                        <div
                          className={cn(
                            "w-5 h-5 rounded flex items-center justify-center",
                            activity.type === "compliance" ? "bg-emerald-500/20" : "bg-amber-500/20"
                          )}
                        >
                          {activity.type === "compliance" ? (
                            <ClipboardCheck className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Megaphone className="w-2.5 h-2.5 text-amber-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-white truncate">{activity.details}</p>
                          <p className="text-[9px] text-white/40">{activity.date}</p>
                        </div>
                        <span className="text-[10px] font-medium text-[#f4c979]">+{activity.points}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
});

const FormBreakdownMini = memo(function FormBreakdownMini({
  data,
}: {
  data: Array<{ form_type: string; submissions: number; percentage: number }>;
}) {
  const formConfig = {
    dvir: { name: "DVIR", color: "#10b981" },
    equipment: { name: "Equip", color: "#f59e0b" },
    jsa: { name: "JSA", color: "#8b5cf6" },
  };

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const config = formConfig[item.form_type as keyof typeof formConfig];
        return (
          <div key={item.form_type} className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-white/60 w-10">{config?.name || item.form_type}</span>
            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.percentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: config?.color || "#888" }}
              />
            </div>
            <span className="text-[9px] text-white/40 w-8 text-right">{item.submissions}</span>
          </div>
        );
      })}
    </div>
  );
});

export default function SafetyAnalyticsSection() {
  const [period, setPeriod] = useState<Period>("month");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const { data, isLoading, isError, refetch } = useSafetyAnalytics(period, 50);

  const handleExportOsha300 = useCallback(async () => {
    setExporting("csv");
    try {
      await exportOsha300Csv();
      toast.success("OSHA 300 log downloaded");
    } catch (e) {
      toast.error("Export failed", (e as Error)?.message ?? "Could not download OSHA 300 log");
    } finally {
      setExporting(null);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (!data?.stats || !data?.leaderboard) return;
    setExporting("pdf");
    try {
      await exportAnalyticsPdf({
        stats: data.stats,
        leaderboard: data.leaderboard,
        period: period === "all" ? "All time" : period.charAt(0).toUpperCase() + period.slice(1),
        generatedAt: new Date().toLocaleString(),
      });
    } catch (e) {
      toast.error("Export failed", (e as Error)?.message ?? "Could not generate PDF");
    } finally {
      setExporting(null);
    }
  }, [data?.stats, data?.leaderboard, period]);

  const leaderboard = data?.leaderboard;
  const filteredLeaderboard = useMemo(() => {
    if (!leaderboard) return [];
    if (!debouncedSearch) return leaderboard;
    const search = debouncedSearch.toLowerCase();
    return leaderboard.filter(
      (entry) =>
        entry.full_name.toLowerCase().includes(search) || entry.email?.toLowerCase().includes(search)
    );
  }, [leaderboard, debouncedSearch]);

  const handleUserClick = useCallback((userId: string) => setSelectedUserId(userId), []);
  const closeModal = useCallback(() => setSelectedUserId(null), []);

  return (
    <>
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 pb-4">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f4c979]/20 to-amber-600/10 border border-[#f4c979]/30 flex items-center justify-center">
                <Award className="w-5 h-5 text-[#f4c979]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white">Safety Analytics</h2>
                <p className="text-[10px] text-[#f8e5bb]/40">Form compliance & engagement</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <PeriodSelector value={period} onChange={setPeriod} />
              <button
                type="button"
                onClick={handleExportOsha300}
                disabled={!!exporting}
                aria-label="Export OSHA 300 log (CSV)"
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-white/80 disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
              >
                <Download className="w-3.5 h-3.5" aria-hidden />
                <span className="hidden sm:inline">OSHA 300 (CSV)</span>
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={!!exporting || !data}
                aria-label="Export analytics report (PDF)"
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-white/80 disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden />
                <span className="hidden sm:inline">Report (PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                aria-label={isLoading ? "Refreshing analytics" : "Refresh safety analytics"}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 text-white/50", isLoading && "animate-spin")} aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {isError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <Shield className="w-10 h-10 text-red-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white mb-1">Error Loading Analytics</h3>
            <button
              type="button"
              onClick={() => refetch()}
              aria-label="Try again to load analytics"
              className="mt-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium hover:bg-red-500/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatPill
                icon={Users}
                label="Active"
                value={`${data?.stats.active_users || 0}/${data?.stats.total_users || 0}`}
                color="gold"
              />
              <StatPill
                icon={Trophy}
                label="Points"
                value={(data?.stats.total_combined_points || 0).toLocaleString()}
                color="amber"
              />
              <StatPill
                icon={Target}
                label="Compliance"
                value={`${data?.stats.avg_compliance_rate || 0}%`}
                color="emerald"
              />
              <StatPill
                icon={Megaphone}
                label="Engagement"
                value={`${data?.stats.announcement_engagement_rate || 0}%`}
                color="purple"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-3">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-[#f6dcb2]/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-white">Safety Leaderboard</span>
                      <span className="text-[9px] text-[#f6dcb2]/40">({filteredLeaderboard.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSearch(!showSearch)}
                      aria-label={showSearch ? "Hide search" : "Show search"}
                      aria-pressed={showSearch}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-1",
                        showSearch ? "bg-amber-500/20 text-amber-300" : "hover:bg-white/5 text-[#f6dcb2]/40"
                      )}
                    >
                      {showSearch ? <X className="w-3.5 h-3.5" aria-hidden /> : <Filter className="w-3.5 h-3.5" aria-hidden />}
                    </button>
                  </div>
                  <AnimatePresence>
                    {showSearch && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-3 py-2 border-b border-[#f6dcb2]/5 bg-black/20"
                      >
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#f6dcb2]/40" />
                          <input
                            type="text"
                            placeholder="Search users..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/30"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="p-2 space-y-1.5 max-h-[420px] overflow-y-auto">
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
                      ))
                    ) : filteredLeaderboard.length === 0 ? (
                      <div className="py-8 text-center">
                        <Award className="w-8 h-8 text-[#f6dcb2]/20 mx-auto mb-2" />
                        <p className="text-xs text-[#f6dcb2]/50">{searchQuery ? "No matches" : "No data yet"}</p>
                      </div>
                    ) : (
                      filteredLeaderboard.map((entry, idx) => (
                        <LeaderboardRow
                          key={entry.user_id}
                          entry={entry}
                          index={idx}
                          onClick={() => handleUserClick(entry.user_id)}
                        />
                      ))
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="space-y-3">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-3"
                >
                  <div className="text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-2">Points</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] text-white/60">Forms</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-300 font-mono tabular-nums">{data?.stats.total_compliance_points || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-[10px] text-white/60">Announce</span>
                      </div>
                      <span className="text-xs font-bold text-amber-300 font-mono tabular-nums">{data?.stats.total_announcement_points || 0}</span>
                    </div>
                    <div className="h-px bg-white/10 my-1" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="w-3.5 h-3.5 text-[#f4c979]" />
                        <span className="text-[10px] text-white/80 font-medium">Total</span>
                      </div>
                      <span className="text-sm font-bold text-[#f4c979] font-mono tabular-nums">{data?.stats.total_combined_points || 0}</span>
                    </div>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-3"
                >
                  <div className="text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-2">Form Breakdown</div>
                  {isLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-4 bg-white/5 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : (data?.formBreakdown && (data.formBreakdown[0]?.submissions ?? 0) + (data.formBreakdown[1]?.submissions ?? 0) + (data.formBreakdown[2]?.submissions ?? 0) === 0 ? (
                    <p className="text-[10px] text-white/40 italic">No compliance data for this period</p>
                  ) : (
                    <FormBreakdownMini data={data?.formBreakdown || []} />
                  ))}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl border border-[#f6dcb2]/15 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403] p-3"
                >
                  <div className="text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-2">Stats</div>
                  {(data?.stats.total_compliance_days ?? 0) === 0 && (data?.stats.full_compliance_users ?? 0) === 0 && !isLoading ? (
                    <p className="text-[10px] text-white/40 italic">No compliance days in this period</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="text-lg font-bold text-white font-mono tabular-nums">{data?.stats.total_compliance_days || 0}</div>
                        <div className="text-[8px] text-white/40 uppercase">Days</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="text-lg font-bold text-white font-mono tabular-nums">{data?.stats.full_compliance_users || 0}</div>
                        <div className="text-[8px] text-white/40 uppercase">100%</div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </div>

      <UserDetailModal userId={selectedUserId} isOpen={!!selectedUserId} onClose={closeModal} period={period} />
    </>
  );
}
