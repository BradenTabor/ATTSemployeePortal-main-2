/**
 * Admin Parts & Fixes Overview Page
 * 
 * Comprehensive admin-level view of all fleet maintenance and repairs:
 * - Fleet-wide fix analytics and trends
 * - Cost breakdown and budgeting insights
 * - Mechanic performance tracking
 * - Recurring issues detection
 * - Export capabilities for accounting
 * - All data from repairs log, DVIR fixes, and equipment fixes
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Filter,
  FileSpreadsheet,
  Calendar,
  Truck,
  BarChart3,
  Sparkles,
  RefreshCw,
  Loader2,
  Shield,
  Crown,
  Cog,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAuth } from '../../contexts/AuthContext';
import { TextEffect } from '../../components/ui/TextEffect';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import TableSkeleton from '../../components/skeletons/TableSkeleton';

// Import from mechanic module
import { useUnifiedFixes } from '../mechanic/hooks/useUnifiedFixes';
import type { 
  UnifiedFix, 
  UnifiedFixFilters, 
  AssetFixStats, 
  AssetType, 
  FixSource,
  FixesAiSummary,
} from '../mechanic/types/maintenance.types';

// Import from extracted module
import {
  SOURCE_CONFIG,
  ASSET_TYPE_CONFIG,
  formatCurrency,
  formatDate,
  formatMileage,
  getEffectiveCost,
} from './admin-parts-fixes';

// =============================================================================
// SCROLL REVEAL COMPONENT
// =============================================================================

function ScrollRevealSection({ 
  children, 
  delay = 0,
  className = '' 
}: { 
  children: React.ReactNode; 
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// STAT CARD COMPONENT (Gold Theme)
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: number;
  onClick?: () => void;
}

function StatCard({ label, value, subValue, icon, trend, onClick }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl sm:rounded-2xl border border-[#f4c979]/20 bg-gradient-to-br from-[#1a1408]/60 to-[#0a0804]/80 p-2.5 sm:p-4 text-left transition-all ${
        onClick ? 'hover:border-[#f4c979]/40 hover:bg-[#1a1408]/70 cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
        <div className="text-[#f4c979]">{icon}</div>
        <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-[#f4c979]/50 truncate">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div className="min-w-0">
          <p className="text-lg sm:text-2xl font-bold text-white truncate">{value}</p>
          {subValue && <p className="text-[9px] sm:text-[10px] text-white/40 mt-0.5 truncate">{subValue}</p>}
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium flex-shrink-0 ${
            trend > 0 ? 'text-red-400' : 'text-emerald-400'
          }`}>
            {trend > 0 ? <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
      </div>
    </button>
  );
}

// =============================================================================
// ADMIN AI INSIGHTS PANEL
// =============================================================================

interface AdminAiInsightsPanelProps {
  summary: FixesAiSummary | null;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
  fixes: UnifiedFix[];
}

function AdminAiInsightsPanel({
  summary,
  isLoading,
  error,
  onGenerate,
  fixes,
}: AdminAiInsightsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasTriggeredRef = useRef(false);
  
  // Auto-generate on first mount if no summary exists
  useEffect(() => {
    if (!summary && !isLoading && !error && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      // Delay to allow data to load first
      const timer = setTimeout(() => {
        onGenerate();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [summary, isLoading, error, onGenerate]);
  
  // Calculate additional admin metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];
    
    // Current 30 days
    const currentPeriod = fixes.filter(f => f.fix_date >= thirtyDaysAgoStr);
    const currentCost = currentPeriod.reduce((sum, f) => sum + getEffectiveCost(f), 0);
    
    // Previous 30 days
    const previousPeriod = fixes.filter(f => f.fix_date >= sixtyDaysAgoStr && f.fix_date < thirtyDaysAgoStr);
    const previousCost = previousPeriod.reduce((sum, f) => sum + getEffectiveCost(f), 0);
    
    const costChange = previousCost > 0 ? ((currentCost - previousCost) / previousCost) * 100 : 0;
    
    // By source breakdown
    const bySource = fixes.reduce((acc, f) => {
      acc[f.source] = (acc[f.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Recurring issues (same asset + same issue 2+ times)
    const recurringMap = new Map<string, number>();
    for (const fix of fixes) {
      for (const issue of fix.deficiencies_corrected || []) {
        const key = `${fix.asset_number}_${issue}`;
        recurringMap.set(key, (recurringMap.get(key) || 0) + 1);
      }
    }
    const recurringCount = Array.from(recurringMap.values()).filter(c => c >= 2).length;
    
    return {
      currentPeriodFixes: currentPeriod.length,
      currentPeriodCost: currentCost,
      previousPeriodFixes: previousPeriod.length,
      previousPeriodCost: previousCost,
      costChange,
      bySource,
      recurringCount,
      avgCostPerFix: fixes.length > 0 ? fixes.reduce((sum, f) => sum + getEffectiveCost(f), 0) / fixes.length : 0,
    };
  }, [fixes]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl overflow-hidden"
    >
      {/* Premium Animated Border */}
      <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-[#f4c979]/60 via-[#ffd700]/40 to-[#f4c979]/60 animate-[shimmer_3s_ease-in-out_infinite]" />
      
      {/* Gold Shimmer Overlay */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-30 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s ease-in-out infinite',
        }}
      />
      
      {/* Main Content Container */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#1a1408]/95 via-[#0f0a04]/95 to-[#0a0804]/95 backdrop-blur-xl">
        {/* Floating Gold Coins Background - hidden on mobile for performance */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none hidden sm:block">
          {/* Gold coin 1 - positioned on left side */}
          <motion.div
            animate={{ y: [0, -8, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-4 left-[35%] w-6 h-6 rounded-full bg-gradient-to-br from-[#ffd700] via-[#f4c979] to-[#c9a227] shadow-lg shadow-[#ffd700]/20 flex items-center justify-center"
          >
            <span className="text-[8px] font-bold text-[#1a1408]">$</span>
          </motion.div>
          {/* Gold coin 2 - positioned center-left */}
          <motion.div
            animate={{ y: [0, -6, 0], rotate: [0, -3, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute top-12 left-[45%] w-4 h-4 rounded-full bg-gradient-to-br from-[#ffd700] via-[#f4c979] to-[#c9a227] shadow-md shadow-[#ffd700]/15 flex items-center justify-center opacity-70"
          >
            <span className="text-[6px] font-bold text-[#1a1408]">$</span>
          </motion.div>
          {/* Gold coin 3 - positioned below header area */}
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-24 left-[40%] w-5 h-5 rounded-full bg-gradient-to-br from-[#ffd700] via-[#f4c979] to-[#c9a227] shadow-md shadow-[#ffd700]/20 flex items-center justify-center opacity-50"
          >
            <span className="text-[7px] font-bold text-[#1a1408]">$</span>
          </motion.div>
          
          {/* Ambient Gold Glow */}
          <div className="absolute top-0 left-1/3 w-64 h-64 bg-[#ffd700]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-[#f4c979]/5 rounded-full blur-3xl" />
        </div>
        
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative w-full flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-5 py-3 sm:py-4 hover:bg-white/[0.02] transition-colors z-10 gap-3 sm:gap-0"
        >
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            {/* Premium AI Icon with Glow */}
            <div className="relative flex-shrink-0">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#ffd700] to-[#f4c979] blur-lg opacity-50"
              />
              <div className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#ffd700] via-[#f4c979] to-[#c9a227] flex items-center justify-center shadow-xl shadow-[#ffd700]/30 border border-[#ffd700]/50">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles className="w-5 h-5 sm:w-7 sm:h-7 text-[#1a1408]" />
                </motion.div>
              </div>
              {/* Orbiting dot - hidden on mobile */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 hidden sm:block"
              >
                <div className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-[#ffd700] shadow-lg shadow-[#ffd700]/50" />
              </motion.div>
            </div>
            
            <div className="text-left min-w-0 flex-1">
              <h3 className="text-sm sm:text-lg font-bold bg-gradient-to-r from-[#ffd700] via-[#f4c979] to-[#ffd700] bg-clip-text text-transparent flex items-center gap-1 sm:gap-2 flex-wrap">
                <span>Fleet Maintenance Intelligence</span>
                {isLoading && <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-[#ffd700]" />}
              </h3>
              <p className="text-[10px] sm:text-xs text-[#f4c979]/60 flex items-center gap-1 sm:gap-1.5 mt-0.5">
                <span className="inline-block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-[#ffd700] animate-pulse flex-shrink-0" />
                <span className="sm:hidden">AI insights</span>
                <span className="hidden sm:inline">AI-powered insights • Executive summary</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto hover:scale-105">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onGenerate();
              }}
              disabled={isLoading}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-[#ffd700]/20 to-[#f4c979]/20 border border-[#ffd700]/40 text-[#ffd700] text-[10px] sm:text-xs font-semibold hover:from-[#ffd700]/30 hover:to-[#f4c979]/30 hover:border-[#ffd700]/60 disabled:opacity-50 transition-all flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-[#ffd700]/10"
            >
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="sm:hidden">Refresh</span>
              <span className="hidden sm:inline">Refresh AI</span>
            </motion.button>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-[#f4c979]/60" />
            </motion.div>
          </div>
        </button>
        
        {/* Expandable Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 sm:px-5 pb-3 sm:pb-5 space-y-3 sm:space-y-5">
                {/* Premium Key Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  {/* 30-Day Fixes */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative rounded-lg sm:rounded-xl overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#f4c979]/10 to-transparent" />
                    <div className="relative border border-[#f4c979]/20 rounded-lg sm:rounded-xl p-2 sm:p-3 backdrop-blur-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-[#f4c979]/20 flex items-center justify-center">
                          <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#f4c979]" />
                        </div>
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-[#f4c979]/60 font-medium">30-Day Fixes</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-black text-white">{metrics.currentPeriodFixes}</p>
                      <p className="text-[9px] sm:text-[10px] text-white/40">vs {metrics.previousPeriodFixes} prior</p>
                    </div>
                  </motion.div>
                  
                  {/* 30-Day Spend - Gold Money Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="relative rounded-lg sm:rounded-xl overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[#ffd700]/15 via-[#f4c979]/10 to-transparent" />
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute top-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-[#ffd700] to-[#c9a227] hidden sm:flex items-center justify-center shadow-lg shadow-[#ffd700]/30"
                    >
                      <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#1a1408]" />
                    </motion.div>
                    <div className="relative border border-[#ffd700]/30 rounded-lg sm:rounded-xl p-2 sm:p-3 backdrop-blur-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-gradient-to-br from-[#ffd700]/30 to-[#f4c979]/20 flex items-center justify-center">
                          <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#ffd700]" />
                        </div>
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-[#ffd700]/70 font-medium truncate">30-Day Spend</span>
                      </div>
                      <p className="text-lg sm:text-2xl font-black bg-gradient-to-r from-[#ffd700] to-[#f4c979] bg-clip-text text-transparent truncate">
                        {formatCurrency(metrics.currentPeriodCost)}
                      </p>
                      <div className={`text-[9px] sm:text-[10px] flex items-center gap-0.5 ${metrics.costChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {metrics.costChange > 0 ? <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                        <span className="truncate">{Math.abs(metrics.costChange).toFixed(0)}% vs prior</span>
                      </div>
                    </div>
                  </motion.div>
                  
                  {/* Avg Cost/Fix */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative rounded-lg sm:rounded-xl overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
                    <div className="relative border border-blue-500/20 rounded-lg sm:rounded-xl p-2 sm:p-3 backdrop-blur-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400" />
                        </div>
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-blue-400/70 font-medium truncate">Avg Cost/Fix</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-black text-white truncate">{formatCurrency(metrics.avgCostPerFix)}</p>
                    </div>
                  </motion.div>
                  
                  {/* Recurring Issues */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="relative rounded-lg sm:rounded-xl overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />
                    <div className="relative border border-amber-500/20 rounded-lg sm:rounded-xl p-2 sm:p-3 backdrop-blur-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-amber-500/20 flex items-center justify-center">
                          <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                        </div>
                        <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-amber-400/70 font-medium">Recurring</span>
                      </div>
                      <p className="text-xl sm:text-2xl font-black text-amber-400">{metrics.recurringCount}</p>
                      <p className="text-[9px] sm:text-[10px] text-white/40">issues</p>
                    </div>
                  </motion.div>
                </div>
                
                {/* Error State */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-lg sm:rounded-xl border border-red-500/30 bg-red-500/10 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3"
                  >
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
                    <p className="text-xs sm:text-sm text-red-200">{error}</p>
                  </motion.div>
                )}
                
                {/* Premium Loading State */}
                {isLoading && !summary && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative rounded-lg sm:rounded-xl border border-[#ffd700]/20 bg-gradient-to-br from-[#ffd700]/5 to-transparent p-4 sm:p-8"
                  >
                    <div className="flex flex-col items-center justify-center">
                      {/* AI Processing Animation */}
                      <div className="relative mb-3 sm:mb-4">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                          className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-[#ffd700]/20 border-t-[#ffd700] border-r-[#ffd700]"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-[#ffd700]" />
                          </motion.div>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-[#f4c979] text-center">Analyzing fleet maintenance...</p>
                      <p className="text-[10px] sm:text-xs text-white/40 mt-1">AI is processing</p>
                      
                      {/* Animated dots */}
                      <div className="flex gap-1 mt-2 sm:mt-3">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                            className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ffd700]"
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
                
                {/* Premium Empty State */}
                {!summary && !isLoading && !error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative rounded-lg sm:rounded-xl border border-[#ffd700]/20 bg-gradient-to-br from-[#ffd700]/5 via-transparent to-[#f4c979]/5 p-4 sm:p-8 text-center overflow-hidden"
                  >
                    {/* Background gold coins - hidden on mobile */}
                    <div className="absolute inset-0 pointer-events-none hidden sm:block">
                      <motion.div
                        animate={{ y: [0, -5, 0], opacity: [0.2, 0.4, 0.2] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute top-4 left-8 w-4 h-4 rounded-full bg-gradient-to-br from-[#ffd700] to-[#c9a227]"
                      />
                      <motion.div
                        animate={{ y: [0, -8, 0], opacity: [0.15, 0.3, 0.15] }}
                        transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
                        className="absolute bottom-6 right-12 w-3 h-3 rounded-full bg-gradient-to-br from-[#ffd700] to-[#c9a227]"
                      />
                      <motion.div
                        animate={{ y: [0, -6, 0], opacity: [0.1, 0.25, 0.1] }}
                        transition={{ duration: 3.5, repeat: Infinity, delay: 1 }}
                        className="absolute top-1/2 right-8 w-5 h-5 rounded-full bg-gradient-to-br from-[#ffd700] to-[#c9a227]"
                      />
                    </div>
                    
                    <div className="relative">
                      <motion.div
                        animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#ffd700]/20 to-[#f4c979]/10 border border-[#ffd700]/30 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-xl shadow-[#ffd700]/10"
                      >
                        <Sparkles className="w-7 h-7 sm:w-10 sm:h-10 text-[#ffd700]" />
                      </motion.div>
                      
                      <h4 className="text-base sm:text-lg font-bold bg-gradient-to-r from-[#ffd700] to-[#f4c979] bg-clip-text text-transparent mb-1.5 sm:mb-2">
                        Ready to Analyze
                      </h4>
                      <p className="text-xs sm:text-sm text-white/50 mb-3 sm:mb-5 max-w-sm mx-auto">
                        Generate an AI-powered summary of your fleet maintenance
                      </p>
                      
                      <motion.button
                        whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(255, 215, 0, 0.3)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={onGenerate}
                        className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-gradient-to-r from-[#ffd700] via-[#f4c979] to-[#ffd700] text-[#1a1408] text-xs sm:text-sm font-bold shadow-xl shadow-[#ffd700]/30 transition-all"
                      >
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                        Generate AI Summary
                      </motion.button>
                    </div>
                  </motion.div>
                )}
                
                {/* Premium AI Summary Display */}
                {summary && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative rounded-lg sm:rounded-xl overflow-hidden"
                  >
                    {/* Gold gradient border */}
                    <div className="absolute inset-0 rounded-lg sm:rounded-xl p-[1px] bg-gradient-to-r from-[#ffd700]/50 via-[#f4c979]/30 to-[#ffd700]/50" />
                    
                    <div className="relative rounded-lg sm:rounded-xl bg-gradient-to-br from-[#ffd700]/10 via-[#1a1408] to-[#f4c979]/5 p-3 sm:p-5">
                      <div className="flex items-start gap-2.5 sm:gap-4">
                        {/* AI Avatar */}
                        <div className="relative flex-shrink-0">
                          <motion.div
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#ffd700] via-[#f4c979] to-[#c9a227] flex items-center justify-center shadow-lg shadow-[#ffd700]/30"
                          >
                            <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-[#1a1408]" />
                          </motion.div>
                          <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-emerald-500 border-2 border-[#1a1408] flex items-center justify-center">
                            <span className="text-[6px] sm:text-[8px] text-white">✓</span>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <span className="text-[10px] sm:text-xs font-semibold text-[#ffd700]">AI Analysis</span>
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-[#ffd700]/20 text-[#ffd700] text-[8px] sm:text-[9px] font-medium">
                              GPT-4o
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-white/90 leading-relaxed">{summary.summary}</p>
                          <p className="text-[9px] sm:text-[10px] text-[#f4c979]/50 mt-2 sm:mt-3 flex items-center gap-1">
                            <span className="inline-block w-1 h-1 rounded-full bg-[#ffd700]/50" />
                            {new Date(summary.generated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                
                {/* Premium Source Breakdown */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 hover:scale-[1.02]">
                  {Object.entries(SOURCE_CONFIG).map(([source, config], index) => (
                    <motion.div
                      key={source}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      className={`rounded-lg sm:rounded-xl border ${config.bgColor} p-2.5 sm:p-4 flex flex-col sm:flex-row items-center gap-2 sm:gap-4 transition-all hover:shadow-lg`}
                    >
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border ${config.bgColor} flex items-center justify-center`}>
                        {config.icon}
                      </div>
                      <div className="text-center sm:text-left">
                        <p className={`text-[9px] sm:text-xs font-medium ${config.color} opacity-70`}>{config.label}</p>
                        <p className="text-lg sm:text-xl font-black text-white">
                          {metrics.bySource[source as FixSource] || 0}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 200% 0; }
          50% { background-position: -200% 0; }
        }
      `}</style>
    </motion.div>
  );
}

// =============================================================================
// TOP ASSETS TABLE
// =============================================================================

interface TopAssetsTableProps {
  assets: AssetFixStats[];
  title: string;
}

function TopAssetsTable({ assets, title }: TopAssetsTableProps) {
  // Sort by total cost (recorded + estimated) to match "Expensive Assets" title
  const sortedByCost = useMemo(() => 
    [...assets].sort((a, b) => {
      const costA = a.total_cost + a.estimated_cost;
      const costB = b.total_cost + b.estimated_cost;
      return costB - costA; // Descending by cost
    }).slice(0, 10),
    [assets]
  );
  
  if (sortedByCost.length === 0) {
    return (
      <div className="rounded-lg sm:rounded-xl border border-white/10 bg-[#0a0804] p-4 sm:p-6 text-center">
        <Truck className="w-6 h-6 sm:w-8 sm:h-8 text-white/20 mx-auto mb-2" />
        <p className="text-xs sm:text-sm text-white/40">No data available</p>
      </div>
    );
  }
  
  // Now maxCost is correctly the highest since we sorted by cost
  const maxCost = sortedByCost[0]?.total_cost + sortedByCost[0]?.estimated_cost || 1;
  
  return (
    <div className="rounded-lg sm:rounded-xl border border-white/10 bg-[#0a0804] overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
        <h3 className="text-xs sm:text-sm font-medium text-white flex items-center gap-1.5 sm:gap-2">
          <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4c979]" />
          <span className="truncate">{title}</span>
        </h3>
      </div>
      <div className="divide-y divide-white/[0.03] max-h-[350px] sm:max-h-none overflow-y-auto">
        {sortedByCost.map((asset, i) => {
          const totalCost = asset.total_cost + asset.estimated_cost;
          const barWidth = (totalCost / maxCost) * 100;
          
          return (
            <div key={`${asset.asset_type}-${asset.asset_number}`} className="px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="text-[9px] sm:text-[10px] font-bold text-white/30 w-4 sm:w-5 flex-shrink-0">{i + 1}</span>
                  <span className="text-xs sm:text-sm font-medium text-white truncate">{asset.asset_number}</span>
                  <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded border ${ASSET_TYPE_CONFIG[asset.asset_type].color} bg-white/5 border-current/30 uppercase flex-shrink-0`}>
                    {asset.asset_type.slice(0, 3)}
                  </span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs sm:text-sm font-semibold text-emerald-400">{formatCurrency(totalCost)}</p>
                  <p className="text-[9px] sm:text-[10px] text-white/40">{asset.total_fixes} fixes</p>
                </div>
              </div>
              <div className="ml-5 sm:ml-7 h-1 sm:h-1.5 bg-black/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="h-full bg-gradient-to-r from-[#f4c979] to-[#d4a94d] rounded-full"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// RECENT FIXES TABLE
// =============================================================================

interface RecentFixesTableProps {
  fixes: UnifiedFix[];
  onSelectFix: (fix: UnifiedFix) => void;
  selectedFixId: string | null;
}

function RecentFixesTable({ fixes, onSelectFix, selectedFixId }: RecentFixesTableProps) {
  return (
    <div className="rounded-lg sm:rounded-xl border border-white/10 bg-[#0a0804] overflow-hidden">
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
        <h3 className="text-xs sm:text-sm font-medium text-white flex items-center gap-1.5 sm:gap-2">
          <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#f4c979]" />
          Recent Fixes
        </h3>
      </div>
      <div className="max-h-[300px] sm:max-h-[400px] overflow-y-auto divide-y divide-white/[0.03]">
        {fixes.slice(0, 20).map((fix, index) => {
          const sourceConfig = SOURCE_CONFIG[fix.source];
          // Use getEffectiveCost for consistency with aggregate metrics
          const effectiveCost = getEffectiveCost(fix);
          // Use == null to correctly handle $0 costs (warranty/no-charge repairs)
          const isEstimated = fix.cost == null;
          
          return (
            <motion.button
              key={fix.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.2) }}
              onClick={() => onSelectFix(fix)}
              className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 transition-all hover:bg-white/[0.02] active:bg-white/[0.04] ${
                selectedFixId === fix.id ? 'bg-[#f4c979]/10 border-l-2 border-l-[#f4c979]' : 'border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center border ${sourceConfig.bgColor} flex-shrink-0`}>
                  {sourceConfig.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                    <span className="text-xs sm:text-sm font-medium text-white truncate">{fix.asset_number}</span>
                    <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded ${ASSET_TYPE_CONFIG[fix.asset_type].color} bg-white/5 uppercase flex-shrink-0`}>
                      {fix.asset_type.slice(0, 3)}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-white/50 line-clamp-1">{fix.description}</p>
                  <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1">
                    <span className="text-[9px] sm:text-[10px] text-white/30">{formatDate(fix.fix_date)}</span>
                    <span className={`text-[9px] sm:text-[10px] font-medium ${isEstimated ? 'text-white/40' : 'text-emerald-400'}`}>
                      {formatCurrency(effectiveCost)}{isEstimated && '*'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/20 flex-shrink-0" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// FIX DETAIL PANEL
// =============================================================================

interface FixDetailPanelProps {
  fix: UnifiedFix | null;
}

function FixDetailPanel({ fix }: FixDetailPanelProps) {
  if (!fix) {
    return (
      <div className="h-full min-h-[200px] sm:min-h-[400px] rounded-lg sm:rounded-xl border border-white/5 bg-[#050302] p-4 sm:p-6 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-[#f4c979]/10 border border-[#f4c979]/20 mb-3 sm:mb-4">
          <Package className="w-5 h-5 sm:w-6 sm:h-6 text-[#f4c979]/70" />
        </div>
        <p className="text-xs sm:text-sm font-medium text-white/80 mb-1">Select a Fix</p>
        <p className="text-[10px] sm:text-xs text-white/40 max-w-xs">
          Choose a fix from the list to view details
        </p>
      </div>
    );
  }
  
  const sourceConfig = SOURCE_CONFIG[fix.source];
  // Use getEffectiveCost for consistency with aggregate metrics
  const effectiveCost = getEffectiveCost(fix);
  // Use == null to correctly handle $0 costs (warranty/no-charge repairs)
  const isEstimated = fix.cost == null;
  
  return (
    <motion.div
      key={fix.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg sm:rounded-xl border border-white/10 bg-[#050302] overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg flex items-center justify-center border ${sourceConfig.bgColor} flex-shrink-0`}>
            {sourceConfig.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:font-semibold text-white truncate">{fix.asset_number}</span>
              <span className={`text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded ${ASSET_TYPE_CONFIG[fix.asset_type].color} bg-white/5 uppercase flex-shrink-0`}>
                {fix.asset_type}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-white/50">{formatDate(fix.fix_date)}</p>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Description */}
        <div>
          <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1">Description</label>
          <p className="text-xs sm:text-sm text-white/80">{fix.description}</p>
        </div>
        
        {/* Deficiencies */}
        {fix.deficiencies_corrected && fix.deficiencies_corrected.length > 0 && (
          <div>
            <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1.5 sm:mb-2">Issues Corrected</label>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {fix.deficiencies_corrected.map((def, i) => (
                <span key={i} className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  ✓ {def}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Parts */}
        {fix.parts_used && fix.parts_used.length > 0 && (
          <div>
            <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1.5 sm:mb-2">Parts Used</label>
            <div className="space-y-1 sm:space-y-1.5">
              {fix.parts_used.map((part, i) => (
                <div key={i} className="flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-black/30 border border-white/5">
                  <span className="text-xs sm:text-sm text-white truncate">{part.part_name}</span>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                    <span className="text-[10px] sm:text-xs text-white/50">×{part.quantity}</span>
                    {part.cost && <span className="text-[10px] sm:text-xs font-medium text-emerald-400">{formatCurrency(part.cost)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="rounded-md sm:rounded-lg border border-white/10 bg-black/20 p-2 sm:p-3">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
              <DollarSign className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
              <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-white/40">
                {isEstimated ? 'Est. Cost' : 'Cost'}
              </span>
            </div>
            <p className={`text-base sm:text-lg font-bold ${isEstimated ? 'text-white/50' : 'text-emerald-400'}`}>
              {formatCurrency(effectiveCost)}
            </p>
          </div>
          
          <div className="rounded-md sm:rounded-lg border border-white/10 bg-black/20 p-2 sm:p-3">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
              <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#f4c979]" />
              <span className="text-[8px] sm:text-[10px] uppercase tracking-wider text-white/40">Mileage</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-white">{formatMileage(fix.mileage_at_fix)}</p>
          </div>
        </div>
        
        {/* Notes */}
        {fix.notes && (
          <div>
            <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1">Notes</label>
            <p className="text-[10px] sm:text-xs text-white/60 p-2 sm:p-3 rounded-md sm:rounded-lg bg-black/30 border border-white/5">{fix.notes}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// EXPORT PANEL
// =============================================================================

interface ExportPanelProps {
  fixes: UnifiedFix[];
}

function ExportPanel({ fixes }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExportCSV = useCallback(async () => {
    setIsExporting(true);
    try {
      // Helper to properly escape CSV fields - handles commas, quotes, and newlines
      const escapeCSV = (value: string | null | undefined): string => {
        if (value == null || value === '') return '';
        const str = String(value);
        // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      const headers = ['Date', 'Asset', 'Type', 'Source', 'Description', 'Cost', 'Mileage', 'Performed By'];
      const rows = fixes.map(fix => [
        escapeCSV(fix.fix_date),
        escapeCSV(fix.asset_number),
        escapeCSV(fix.asset_type),
        escapeCSV(fix.source),
        escapeCSV(fix.description),
        fix.cost?.toFixed(2) || '',
        fix.mileage_at_fix?.toString() || '',
        escapeCSV(fix.performed_by),
      ]);
      
      // Add UTF-8 BOM for Excel compatibility
      const csv = '\ufeff' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `parts-fixes-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [fixes]);
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCSV}
        disabled={isExporting || fixes.length === 0}
        className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] sm:text-xs font-medium hover:bg-emerald-500/30 active:bg-emerald-500/40 disabled:opacity-50 transition-colors"
      >
        {isExporting ? <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
        <span className="hidden sm:inline">Export CSV</span>
        <span className="sm:hidden">CSV</span>
      </button>
    </div>
  );
}

// =============================================================================
// FILTER BAR
// =============================================================================

interface FilterBarProps {
  filters: UnifiedFixFilters;
  onFiltersChange: (filters: UnifiedFixFilters) => void;
  onClear: () => void;
}

function FilterBar({ filters, onFiltersChange, onClear }: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Include cost filters to ensure Clear button appears when cost range is set
  const hasActiveFilters = filters.search || filters.asset_type !== 'all' || filters.source !== 'all' || filters.date_from || filters.date_to || filters.cost_min !== undefined || filters.cost_max !== undefined;
  
  return (
    <div className="rounded-lg sm:rounded-xl border border-[#f4c979]/15 bg-gradient-to-r from-[#0c0804] to-[#120a05] p-2.5 sm:p-3">
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Search - full width on mobile */}
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search asset #, description..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-full bg-black/30 border border-white/10 rounded-md sm:rounded-lg pl-8 pr-3 py-2 text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f4c979]/50 transition-all"
          />
        </div>
        
        {/* Filters row */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {/* Asset Type */}
          <select
            value={filters.asset_type || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, asset_type: e.target.value as AssetType | 'all' })}
            className="flex-1 min-w-[100px] bg-black/30 border border-white/10 rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f4c979]/50"
          >
            <option value="all">All Assets</option>
            <option value="truck">Trucks</option>
            <option value="chipper">Chippers</option>
            <option value="trailer">Trailers</option>
            <option value="equipment">Equipment</option>
          </select>
          
          {/* Source */}
          <select
            value={filters.source || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, source: e.target.value as FixSource | 'all' })}
            className="flex-1 min-w-[100px] bg-black/30 border border-white/10 rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f4c979]/50"
          >
            <option value="all">All Sources</option>
            <option value="repairs_log">Repair Logs</option>
            <option value="dvir">DVIR</option>
            <option value="equipment">Equipment</option>
          </select>
          
          {/* More Filters */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
              showAdvanced ? 'bg-[#f4c979]/20 text-[#f4c979]' : 'text-white/50 hover:text-white hover:bg-white/5 active:bg-white/10'
            }`}
          >
            <Filter className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">More</span>
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium text-[#f4c979]/80 hover:text-[#f4c979] hover:bg-[#f4c979]/10 active:bg-[#f4c979]/20 border border-[#f4c979]/20 transition-colors"
            >
              <X className="w-3 h-3" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Advanced Filters */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 pt-2 sm:pt-3 mt-2 sm:mt-3 border-t border-white/5">
              <div>
                <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1">From</label>
                <input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => onFiltersChange({ ...filters, date_from: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f4c979]/50 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1">To</label>
                <input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => onFiltersChange({ ...filters, date_to: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f4c979]/50 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1">Min Cost</label>
                <input
                  type="number"
                  min="0"
                  placeholder="$0"
                  value={filters.cost_min || ''}
                  onChange={(e) => onFiltersChange({ ...filters, cost_min: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-black/30 border border-white/10 rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f4c979]/50"
                />
              </div>
              <div>
                <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1">Max Cost</label>
                <input
                  type="number"
                  min="0"
                  placeholder="$∞"
                  value={filters.cost_max || ''}
                  onChange={(e) => onFiltersChange({ ...filters, cost_max: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-black/30 border border-white/10 rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f4c979]/50"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AdminPartsFixesContent() {
  const { role } = useAuth();
  const hasAccess = role === 'admin';
  
  // Data hook
  const {
    fixes,
    filteredFixes,
    assetStats,
    aiSummary,
    isLoadingAi,
    aiError,
    filters,
    setFilters,
    clearFilters,
    isLoading,
    error,
    generateAiSummary,
    totalEstimatedCost,
    fixesThisMonth,
  } = useUnifiedFixes();
  
  const [selectedFix, setSelectedFix] = useState<UnifiedFix | null>(null);
  
  // Device capabilities
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;
  
  // Calculated stats
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    
    const recentFixes = fixes.filter(f => f.fix_date >= thirtyDaysAgoStr);
    const recentCost = recentFixes.reduce((sum, f) => sum + getEffectiveCost(f), 0);
    
    return {
      totalFixes: fixes.length,
      totalCost: totalEstimatedCost,
      fixesThisMonth,
      recentCost,
      avgCostPerFix: fixes.length > 0 ? totalEstimatedCost / fixes.length : 0,
      trucksCount: assetStats.filter(a => a.asset_type === 'truck').length,
      equipmentCount: assetStats.filter(a => a.asset_type !== 'truck').length,
    };
  }, [fixes, totalEstimatedCost, fixesThisMonth, assetStats]);
  
  // Access check
  if (!hasAccess) {
    return (
      <div className="min-h-[50vh] sm:min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-[#f4c979]/10 flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <Shield className="w-7 h-7 sm:w-10 sm:h-10 text-[#f4c979]" />
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-white mb-1.5 sm:mb-2">Admin Access Required</h2>
          <p className="text-sm sm:text-base text-gray-400">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 pb-4 pt-3 sm:pt-4 md:pt-6">
        {/* Premium Glass Header - Gold Theme */}
        <div className="mb-4 sm:mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div 
              className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              style={{
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                background: 'linear-gradient(145deg, rgba(26, 20, 8, 0.6) 0%, rgba(10, 8, 4, 0.5) 50%, rgba(5, 3, 2, 0.4) 100%)',
                boxShadow: 'inset 0 0 15px rgba(244, 201, 121, 0.08), 0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {/* Decorative elements - hidden on mobile for performance */}
              <div className="absolute inset-0 opacity-70 pointer-events-none hidden sm:block" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)' }} />
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full opacity-30 pointer-events-none hidden sm:block" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(244, 201, 121, 0.3) 0%, transparent 70%)', filter: 'blur(15px)' }} />
              
              <div className="relative px-3 py-3 sm:px-5 sm:py-4 md:px-7 md:py-5">
                {/* Badges row - more compact on mobile */}
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-[#f4c979]/15 border border-[#f4c979]/30"
                  >
                    <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#f4c979]" />
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-bold text-[#f4c979]">Admin</span>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a0804]/60 border border-[#f4c979]/20"
                  >
                    <Package className="w-3 h-3 text-[#f4c979]" />
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-[#f4c979]/70">Fleet Overview</span>
                  </motion.div>
                </div>
                
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                    <motion.div
                      initial={{ scaleY: 0, opacity: 0 }}
                      animate={{ scaleY: 1, opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="w-1 h-10 sm:h-14 md:h-16 rounded-full bg-gradient-to-b from-[#f4c979] via-[#d4a94d] to-[#a67c3d] origin-top flex-shrink-0"
                      style={{ boxShadow: '0 0 20px rgba(244, 201, 121, 0.4), 0 0 40px rgba(244, 201, 121, 0.2)' }}
                    />
                    <div className="min-w-0">
                      {enableAnimations ? (
                        <TextEffect
                          as="h1"
                          preset="blurSlide"
                          per="char"
                          delay={0.15}
                          className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight"
                          segmentWrapperClassName="bg-gradient-to-r from-white via-[#f4c979] to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(244,201,121,0.3)]"
                        >
                          Parts & Fixes
                        </TextEffect>
                      ) : (
                        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-[#f4c979] to-white/90 bg-clip-text text-transparent">
                          Parts & Fixes
                        </h1>
                      )}
                      <motion.p
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.7 }}
                        className="mt-0.5 sm:mt-1.5 text-[10px] sm:text-xs md:text-sm text-[#f4c979]/50 font-medium"
                      >
                        <span className="hidden sm:inline">Fleet-wide maintenance analytics and cost tracking</span>
                        <span className="sm:hidden">Fleet maintenance & costs</span>
                      </motion.p>
                    </div>
                  </div>
                  
                  {/* Export Button */}
                  <div className="flex-shrink-0">
                    <ExportPanel fixes={filteredFixes} />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Stats Summary - 3 cols on mobile, 6 on larger */}
        <ScrollRevealSection delay={0}>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 mb-4 sm:mb-6">
            <StatCard
              label="Total Fixes"
              value={stats.totalFixes}
              icon={<Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            />
            <StatCard
              label="This Month"
              value={stats.fixesThisMonth}
              icon={<Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            />
            <StatCard
              label="Total Cost"
              value={formatCurrency(stats.totalCost)}
              icon={<DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            />
            <StatCard
              label="Avg/Fix"
              value={formatCurrency(stats.avgCostPerFix)}
              icon={<BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            />
            <StatCard
              label="Trucks"
              value={stats.trucksCount}
              icon={<Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            />
            <StatCard
              label="Equipment"
              value={stats.equipmentCount}
              icon={<Cog className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            />
          </div>
        </ScrollRevealSection>
        
        {/* AI Insights Panel */}
        <ScrollRevealSection delay={0.05}>
          <div className="mb-4 sm:mb-6">
            <AdminAiInsightsPanel
              summary={aiSummary}
              isLoading={isLoadingAi}
              error={aiError}
              onGenerate={generateAiSummary}
              fixes={fixes}
            />
          </div>
        </ScrollRevealSection>
        
        {/* Filter Bar */}
        <ScrollRevealSection delay={0.1}>
          <div className="mb-4 sm:mb-6">
            <FilterBar
              filters={filters}
              onFiltersChange={setFilters}
              onClear={clearFilters}
            />
          </div>
        </ScrollRevealSection>
        
        {/* Main Content */}
        <ScrollRevealSection delay={0.15}>
          {isLoading && (
            <TableSkeleton rows={5} columns={4} variant="gold" />
          )}
          
          {error && (
            <div className="rounded-lg sm:rounded-xl border border-red-500/30 bg-red-500/10 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-red-200">{error}</p>
            </div>
          )}
          
          {!isLoading && !error && (
            <div className="space-y-4 sm:space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6">
              {/* Top Assets - full width on mobile, 1/3 on lg */}
              <div>
                <TopAssetsTable
                  assets={assetStats}
                  title="Top 10 Expensive Assets"
                />
              </div>
              
              {/* Recent Fixes - full width on mobile, 1/3 on lg */}
              <div>
                <RecentFixesTable
                  fixes={filteredFixes}
                  onSelectFix={setSelectedFix}
                  selectedFixId={selectedFix?.id || null}
                />
              </div>
              
              {/* Fix Detail - full width on mobile, 1/3 on lg */}
              <div>
                <FixDetailPanel fix={selectedFix} />
              </div>
            </div>
          )}
        </ScrollRevealSection>
        
        {/* Footer Note */}
        <p className="text-[9px] sm:text-[10px] text-white/30 text-center mt-4 sm:mt-6">
          * Estimated costs used when actual costs not recorded
        </p>
      </div>
  );
}

export default function AdminPartsFixesOverview() {
  return (
    <DashboardLayout title="Parts & Fixes Overview" pageHeading>
      <AdminPartsFixesContent />
    </DashboardLayout>
  );
}
