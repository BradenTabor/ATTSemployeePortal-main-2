/**
 * PendingDefectsWidget Component
 * 
 * Displays a summary of pending equipment defects that need mechanic attention.
 * Queries DVIR reports and daily equipment inspections for failed items.
 * 
 * Part of the Jidoka Maintenance Automation feature.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Wrench, ChevronRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../../lib/utils";
import { usePendingDefects } from "../../../hooks/mechanic/usePendingDefects";
import type { DefectItem } from "../../../hooks/mechanic/usePendingDefects";

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

export default function PendingDefectsWidget() {
  const navigate = useNavigate();
  // ARCH-018: Use hook instead of inline API calls
  const { summary, loading, error, refetch } = usePendingDefects();
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // PERF-019: refetch is now a function that returns a promise
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };
  
  const hasCritical = useMemo(() => (summary?.critical ?? 0) > 0, [summary]);
  
  // QA-001: Display error state to user if hook returns error
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-red-500/30 bg-red-900/10 p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-200">Failed to Load Defects</h3>
            <p className="text-xs text-red-300/70 mt-0.5">{error}</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={refreshing ? "Retrying..." : "Retry loading defects"}
            className="px-3 py-1.5 text-xs font-medium text-red-200 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
          >
            {refreshing ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </motion.div>
    );
  }
  
  if (loading) {
    return (
      <div className="rounded-xl border border-orange-500/15 bg-[#1a0c08]/60 p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20" />
          <div className="h-4 w-32 bg-white/10 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-12 rounded-lg bg-white/5" />
          <div className="h-12 rounded-lg bg-white/5" />
        </div>
      </div>
    );
  }
  
  // No defects - show success state
  if (!summary || summary.total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-emerald-500/20 bg-emerald-900/10 p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-200">All Clear!</h3>
            <p className="text-xs text-emerald-300/50">No pending defects in the last 7 days</p>
          </div>
        </div>
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border p-4 transition-colors",
        hasCritical 
          ? "border-red-500/30 bg-gradient-to-br from-red-900/20 to-[#1a0c08]"
          : "border-orange-500/20 bg-gradient-to-br from-[#1a0c08] to-[#0f0705]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            hasCritical ? "bg-red-500/20" : "bg-orange-500/20"
          )}>
            <AlertTriangle className={cn(
              "w-4 h-4",
              hasCritical ? "text-red-400" : "text-orange-400"
            )} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white/90">Pending Defects</h3>
            <p className="text-[10px] text-white/40">Last 7 days</p>
          </div>
        </div>
        
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label={refreshing ? "Refreshing defects" : "Refresh pending defects"}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
        >
          <RefreshCw className={cn(
            "w-3.5 h-3.5 text-white/40 hover:text-white/60",
            refreshing && "animate-spin"
          )} aria-hidden />
        </button>
      </div>
      
      {/* Summary Badges */}
      <div className="flex gap-2 mb-3">
        {summary.critical > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/30">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[10px] font-bold text-red-300">{summary.critical} Critical</span>
          </div>
        )}
        {summary.warning > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] font-bold text-amber-300">{summary.warning} Warning</span>
          </div>
        )}
      </div>
      
      {/* Defect Items */}
      <div className="space-y-1.5 mb-3">
        <AnimatePresence mode="popLayout">
          {summary.items.map((item: DefectItem, idx: number) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border transition-colors",
                item.severity === 'critical'
                  ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
                  : "bg-amber-500/5 border-amber-500/15 hover:border-amber-500/30"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
                item.severity === 'critical' ? "bg-red-500/15" : "bg-amber-500/10"
              )}>
                <Wrench className={cn(
                  "w-3 h-3",
                  item.severity === 'critical' ? "text-red-400" : "text-amber-400"
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white/90 truncate">
                    {item.source === 'dvir' ? `Truck ${item.truck_number}` : item.equipment_type}
                  </span>
                  {item.severity === 'critical' && (
                    <span className="px-1 py-0.5 text-[8px] font-bold uppercase bg-red-500/20 text-red-300 rounded">
                      Critical
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-white/40">
                  <span className="truncate">{item.defect_items.slice(0, 2).join(', ')}</span>
                  {item.defect_items.length > 2 && (
                    <span className="text-white/30">+{item.defect_items.length - 2}</span>
                  )}
                  <span className="text-white/20 mx-0.5">•</span>
                  <span>{formatRelativeTime(item.reported_at)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* View All Button */}
      {summary.total > 5 && (
        <button
          type="button"
          onClick={() => navigate('/mechanic/equipment-logs')}
          aria-label={`View all ${summary.total} defects in equipment logs`}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
        >
          <span className="text-xs font-medium text-white/60 group-hover:text-white/80">
            View all {summary.total} defects
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" aria-hidden />
        </button>
      )}
    </motion.div>
  );
}
