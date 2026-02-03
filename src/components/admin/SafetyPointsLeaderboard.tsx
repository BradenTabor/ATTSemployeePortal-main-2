/**
 * SafetyPointsLeaderboard Component
 * 
 * Compact leaderboard widget for dashboards showing top safety performers.
 * Uses the unified useSafetyAnalytics hook for consistent data.
 * 
 * Features:
 * - Unified safety score (compliance + announcement engagement)
 * - Period filters (week, month, all-time)
 * - Expandable/collapsible
 * - Theme support (amber, purple)
 * - Compact mode for tighter layouts
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Star, ChevronDown, ChevronUp, Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { useSafetyAnalytics, type Period } from "../../hooks/queries/useSafetyAnalytics";
import { cn } from "../../lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export type LeaderboardTheme = 'amber' | 'purple';

interface SafetyPointsLeaderboardProps {
  theme?: LeaderboardTheme;
  compact?: boolean;
  maxEntries?: number;
  showAnalyticsLink?: boolean;
  className?: string;
}

// ============================================================================
// THEME CONFIG
// ============================================================================

const themeConfig = {
  amber: {
    container: "border-[#f6dcb2]/20 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403]",
    headerIcon: "from-amber-400/20 to-amber-600/10 border-amber-500/20",
    headerIconColor: "text-amber-400",
    subtitle: "text-[#f6dcb2]/50",
    activeTab: "bg-amber-500/20 text-amber-200 border border-amber-500/30",
    inactiveTab: "text-[#f6dcb2]/40 hover:text-[#f6dcb2]/70",
    points: "text-amber-300",
    border: "border-[#f6dcb2]/10",
    statBg: "from-amber-500/5",
    linkBg: "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/15",
    roleText: "text-[#f6dcb2]/40",
    muted: "text-[#f6dcb2]/20",
  },
  purple: {
    container: "border-[#c084fc]/20 bg-gradient-to-br from-[#1a0d2e] via-[#0d0516] to-[#050208]",
    headerIcon: "from-purple-400/20 to-purple-600/10 border-purple-500/20",
    headerIconColor: "text-purple-400",
    subtitle: "text-[#e9d5ff]/50",
    activeTab: "bg-purple-500/20 text-purple-200 border border-purple-500/30",
    inactiveTab: "text-[#e9d5ff]/40 hover:text-[#e9d5ff]/70",
    points: "text-purple-300",
    border: "border-[#c084fc]/10",
    statBg: "from-purple-500/5",
    linkBg: "bg-purple-500/10 border-purple-500/20 text-purple-300 hover:bg-purple-500/15",
    roleText: "text-[#e9d5ff]/40",
    muted: "text-[#e9d5ff]/20",
  },
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function RankBadge({ rank, compact }: { rank: number; compact?: boolean }) {
  const size = compact ? "w-6 h-6" : "w-7 h-7";
  const iconSize = compact ? "w-3 h-3" : "w-3.5 h-3.5";
  
  if (rank === 1) {
    return (
      <div className={cn(size, "rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-amber-500/30")}>
        <Trophy className={cn(iconSize, "text-amber-900")} />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className={cn(size, "rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center")}>
        <Medal className={cn(iconSize, "text-gray-700")} />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className={cn(size, "rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center")}>
        <Medal className={cn(iconSize, "text-amber-200")} />
      </div>
    );
  }
  return (
    <div className={cn(size, "rounded-full bg-white/5 border border-white/10 flex items-center justify-center")}>
      <span className="text-[10px] font-bold text-white/40">{rank}</span>
    </div>
  );
}

function formatRole(role: string): string {
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SafetyPointsLeaderboard({
  theme = 'amber',
  compact = false,
  maxEntries = 5,
  showAnalyticsLink = true,
  className,
}: SafetyPointsLeaderboardProps) {
  const [period, setPeriod] = useState<Period>('week');
  const [expanded, setExpanded] = useState(true);
  
  const { data, isLoading } = useSafetyAnalytics(period, maxEntries);
  const leaderboard = data?.leaderboard || [];
  const stats = data?.stats;
  const t = themeConfig[theme];
  
  const periodLabels: Record<Period, string> = {
    week: '7d', month: '30d', quarter: '90d', all: 'All'
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "rounded-xl sm:rounded-2xl border overflow-hidden",
        t.container,
        className
      )}
    >
      {/* Compact Header */}
      <div className={cn("px-3 py-2.5", compact ? "" : "sm:px-4 sm:py-3", "border-b", t.border)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              compact ? "w-7 h-7" : "w-8 h-8",
              "rounded-lg bg-gradient-to-br flex items-center justify-center border overflow-hidden",
              t.headerIcon
            )}>
              <img src="/assets/safety-leaderboard.png" alt="" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className={cn(compact ? "text-xs" : "text-sm", "font-semibold text-white/90")}>Safety Leaderboard</h3>
              <p className={cn("text-[9px]", t.subtitle)}>Top performers</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-white/5 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/40" /> : <ChevronDown className="w-3.5 h-3.5 text-white/40" />}
          </button>
        </div>
        
        {/* Period Pills - Inline */}
        <div className="flex gap-1 mt-2">
          {(['week', 'month', 'quarter', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] font-medium transition-all",
                period === p ? t.activeTab : t.inactiveTab
              )}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <AnimatePresence mode="wait">
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {isLoading ? (
              <div className="p-3 space-y-1.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 rounded animate-pulse">
                    <div className="w-6 h-6 rounded-full bg-white/5" />
                    <div className="flex-1 h-3 bg-white/5 rounded" />
                    <div className="w-8 h-3 bg-white/5 rounded" />
                  </div>
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-4 text-center">
                <Star className="w-5 h-5 text-white/10 mx-auto mb-1" />
                <p className={cn("text-[10px]", t.subtitle)}>No data yet</p>
              </div>
            ) : (
              <>
                {/* Stats Row - Ultra Compact */}
                {stats && (
                  <div className={cn("px-3 py-1.5 bg-gradient-to-r to-transparent border-b", t.statBg, t.border)}>
                    <div className="flex items-center justify-between text-[9px]">
                      <span className={t.roleText}>Pts: <span className={cn("font-bold", t.points)}>{stats.total_combined_points}</span></span>
                      <span className={t.roleText}>Avg: <span className="font-bold text-emerald-300">{stats.avg_compliance_rate}%</span></span>
                    </div>
                  </div>
                )}
                
                {/* Leaderboard List - Compact */}
                <div className="p-2 space-y-1">
                  {leaderboard.map((entry, idx) => (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className={cn(
                        "flex items-center gap-2 p-1.5 rounded-lg border transition-colors",
                        entry.rank <= 3
                          ? "bg-gradient-to-r from-amber-500/5 to-transparent border-amber-500/10"
                          : "bg-white/[0.02] border-white/5"
                      )}
                    >
                      <RankBadge rank={entry.rank} compact={compact} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-medium text-white/90 truncate">{entry.full_name}</span>
                          {entry.rank === 1 && (
                            <span className="px-1 py-0.5 text-[7px] font-bold uppercase bg-amber-500/20 text-amber-300 rounded">★</span>
                          )}
                          {entry.current_streak >= 3 && (
                            <Flame className="w-2.5 h-2.5 text-orange-400" />
                          )}
                        </div>
                        <span className={cn("text-[9px]", t.roleText)}>{formatRole(entry.role)} • {entry.compliance_rate}%</span>
                      </div>
                      
                      <div className="text-right">
                        <span className={cn("text-xs font-bold", t.points)}>{entry.total_points}</span>
                        <span className={cn("text-[8px] ml-0.5", t.muted)}>pts</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                {/* Analytics Link - Compact */}
                {showAnalyticsLink && (
                  <div className={cn("px-2 py-2 border-t", t.border)}>
                    <Link
                      to="/admin/safety-analytics"
                      className={cn("flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all", t.linkBg)}
                    >
                      View Analytics →
                    </Link>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
