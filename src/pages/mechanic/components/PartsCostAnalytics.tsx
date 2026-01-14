/**
 * Parts Cost Analytics Component
 * 
 * Displays cost analytics for the Parts view:
 * - Cost trends over time (line chart)
 * - Cost breakdown by maintenance type (donut chart)
 * - Top 10 most expensive vehicles to maintain
 * - Recurring issues detection
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Truck,
  AlertTriangle,
  BarChart3,
  PieChart,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import type { UnifiedFix, AssetFixStats } from '../types/maintenance.types';

// =============================================================================
// TYPES
// =============================================================================

interface PartsCostAnalyticsProps {
  fixes: UnifiedFix[];
  assetStats: AssetFixStats[];
}

interface MonthlyData {
  month: string;
  monthLabel: string;
  cost: number;
  fixCount: number;
}

interface MaintenanceTypeBreakdown {
  type: string;
  cost: number;
  count: number;
  percentage: number;
  color: string;
}

interface RecurringIssue {
  assetNumber: string;
  assetType: string;
  issue: string;
  occurrences: number;
  totalCost: number;
  dates: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TYPE_COLORS: Record<string, string> = {
  'oil_change': '#f59e0b',
  'tire_rotation': '#3b82f6',
  'tire_replacement': '#8b5cf6',
  'repair': '#ef4444',
  'part_replacement': '#10b981',
  'inspection': '#06b6d4',
  'upgrade': '#ec4899',
  'dvir_fix': '#6366f1',
  'equipment_fix': '#14b8a6',
  'other': '#6b7280',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getEffectiveCost(fix: UnifiedFix): number {
  return fix.cost || fix.estimated_cost || 100;
}

// =============================================================================
// MINI BAR CHART COMPONENT
// =============================================================================

interface MiniBarChartProps {
  data: MonthlyData[];
  maxValue: number;
}

function MiniBarChart({ data, maxValue }: MiniBarChartProps) {
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => {
        const height = maxValue > 0 ? (d.cost / maxValue) * 100 : 0;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(height, 2)}%` }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t"
              title={`${d.monthLabel}: ${formatCurrency(d.cost)} (${d.fixCount} fixes)`}
            />
            <span className="text-[8px] text-white/30 -rotate-45 origin-center whitespace-nowrap">
              {d.monthLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// DONUT CHART COMPONENT
// =============================================================================

interface DonutChartProps {
  data: MaintenanceTypeBreakdown[];
  total: number;
}

function DonutChart({ data, total }: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Calculate SVG paths for donut segments
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  
  const segments = useMemo(() => {
    return data.reduce<Array<typeof data[0] & { offset: number; length: number }>>((acc, d) => {
      const segmentLength = (d.percentage / 100) * circumference;
      const currentOffset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].length : 0;
      acc.push({
        ...d,
        offset: currentOffset,
        length: segmentLength,
      });
      return acc;
    }, []);
  }, [data, circumference]);
  
  return (
    <div className="relative">
      <svg viewBox="0 0 100 100" className="w-32 h-32 -rotate-90">
        {segments.map((seg, i) => (
          <circle
            key={seg.type}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={hoveredIndex === i ? 14 : 12}
            strokeDasharray={`${seg.length} ${circumference - seg.length}`}
            strokeDashoffset={-seg.offset}
            className="transition-all duration-200 cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold text-white">{formatCurrency(total)}</p>
          <p className="text-[10px] text-white/40">Total</p>
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-3 space-y-1">
        {data.slice(0, 5).map((d, i) => (
          <div
            key={d.type}
            className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${
              hoveredIndex === i ? 'bg-white/5' : ''
            }`}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-[10px] text-white/60 flex-1 truncate capitalize">
              {d.type.replace(/_/g, ' ')}
            </span>
            <span className="text-[10px] font-medium text-white/80">{d.percentage.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// TOP EXPENSIVE VEHICLES COMPONENT
// =============================================================================

interface TopExpensiveVehiclesProps {
  assets: AssetFixStats[];
}

function TopExpensiveVehicles({ assets }: TopExpensiveVehiclesProps) {
  const topTen = assets.slice(0, 10);
  const maxCost = topTen[0]?.total_cost + topTen[0]?.estimated_cost || 1;
  
  return (
    <div className="space-y-2">
      {topTen.map((asset, i) => {
        const totalCost = asset.total_cost + asset.estimated_cost;
        const barWidth = (totalCost / maxCost) * 100;
        
        return (
          <motion.div
            key={`${asset.asset_type}-${asset.asset_number}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-white/30 w-4">{i + 1}</span>
              <span className="text-xs font-medium text-white flex-1">{asset.asset_number}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase">
                {asset.asset_type}
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {formatCurrency(totalCost)}
              </span>
            </div>
            <div className="ml-6 h-1.5 bg-black/30 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ delay: i * 0.03 + 0.2, duration: 0.4 }}
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
              />
            </div>
            <div className="ml-6 flex items-center gap-3 mt-1">
              <span className="text-[10px] text-white/40">{asset.total_fixes} fixes</span>
              {asset.most_common_issues.length > 0 && (
                <span className="text-[10px] text-white/30 truncate max-w-[150px]">
                  {asset.most_common_issues[0]}
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// =============================================================================
// RECURRING ISSUES COMPONENT
// =============================================================================

interface RecurringIssuesProps {
  issues: RecurringIssue[];
}

function RecurringIssues({ issues }: RecurringIssuesProps) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-4">
        <RefreshCw className="w-8 h-8 text-emerald-400/40 mx-auto mb-2" />
        <p className="text-sm text-white/60">No recurring issues detected</p>
        <p className="text-[10px] text-white/30">All assets have unique issues</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {issues.slice(0, 5).map((issue, i) => (
        <motion.div
          key={`${issue.assetNumber}-${issue.issue}`}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-white">{issue.assetNumber}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">
                  {issue.assetType}
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mb-1">{issue.issue}</p>
              <div className="flex items-center gap-3 text-[10px] text-white/40">
                <span className="font-medium text-amber-400">{issue.occurrences}× recurring</span>
                <span>{formatCurrency(issue.totalCost)} spent</span>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function PartsCostAnalytics({ fixes, assetStats }: PartsCostAnalyticsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Calculate monthly cost trends (last 6 months)
  const monthlyData = useMemo(() => {
    const months: MonthlyData[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toISOString().slice(0, 7); // YYYY-MM
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
      
      const monthFixes = fixes.filter(f => f.fix_date.startsWith(monthStr));
      const cost = monthFixes.reduce((sum, f) => sum + getEffectiveCost(f), 0);
      
      months.push({
        month: monthStr,
        monthLabel,
        cost,
        fixCount: monthFixes.length,
      });
    }
    
    return months;
  }, [fixes]);
  
  const maxMonthlyCost = useMemo(() => 
    Math.max(...monthlyData.map(d => d.cost), 1),
  [monthlyData]);
  
  // Calculate cost breakdown by maintenance type
  const typeBreakdown = useMemo(() => {
    const typeMap = new Map<string, { cost: number; count: number }>();
    
    for (const fix of fixes) {
      const type = fix.deficiencies_corrected?.[0]?.toLowerCase().replace(/ /g, '_') || 'other';
      const existing = typeMap.get(type);
      const cost = getEffectiveCost(fix);
      
      if (existing) {
        existing.cost += cost;
        existing.count++;
      } else {
        typeMap.set(type, { cost, count: 1 });
      }
    }
    
    const total = Array.from(typeMap.values()).reduce((sum, t) => sum + t.cost, 0);
    
    return Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        cost: data.cost,
        count: data.count,
        percentage: total > 0 ? (data.cost / total) * 100 : 0,
        color: TYPE_COLORS[type] || TYPE_COLORS.other,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [fixes]);
  
  const totalCost = useMemo(() => 
    typeBreakdown.reduce((sum, t) => sum + t.cost, 0),
  [typeBreakdown]);
  
  // Detect recurring issues (same issue on same asset 2+ times)
  const recurringIssues = useMemo(() => {
    const issueMap = new Map<string, RecurringIssue>();
    
    for (const fix of fixes) {
      if (!fix.deficiencies_corrected) continue;
      
      for (const issue of fix.deficiencies_corrected) {
        const key = `${fix.asset_number}_${issue}`;
        const existing = issueMap.get(key);
        
        if (existing) {
          existing.occurrences++;
          existing.totalCost += getEffectiveCost(fix);
          existing.dates.push(fix.fix_date);
        } else {
          issueMap.set(key, {
            assetNumber: fix.asset_number,
            assetType: fix.asset_type,
            issue,
            occurrences: 1,
            totalCost: getEffectiveCost(fix),
            dates: [fix.fix_date],
          });
        }
      }
    }
    
    return Array.from(issueMap.values())
      .filter(i => i.occurrences >= 2)
      .sort((a, b) => b.occurrences - a.occurrences);
  }, [fixes]);
  
  // Calculate month-over-month change
  const monthlyChange = useMemo(() => {
    if (monthlyData.length < 2) return 0;
    const current = monthlyData[monthlyData.length - 1].cost;
    const previous = monthlyData[monthlyData.length - 2].cost;
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }, [monthlyData]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl sm:rounded-2xl border border-[#ff9350]/20 bg-gradient-to-br from-[#1a0c05]/60 to-[#0a0402]/80 overflow-hidden mb-4 sm:mb-5"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors min-h-[56px] sm:min-h-[60px]"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5 sm:gap-2">
              <span className="truncate">Cost Analytics</span>
              {monthlyChange !== 0 && (
                <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0 ${
                  monthlyChange > 0 
                    ? 'bg-red-500/20 text-red-300' 
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {monthlyChange > 0 ? <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                  {Math.abs(monthlyChange).toFixed(0)}%
                </span>
              )}
            </h3>
            <p className="text-[10px] sm:text-xs text-white/50 truncate">
              {formatCurrency(totalCost)} • {recurringIssues.length} recurring
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-white/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
        )}
      </button>
      
      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 sm:px-4 pb-3 sm:pb-4">
              {/* Main Grid */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {/* Cost Trends */}
                <div className="rounded-lg sm:rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                    <span className="text-[10px] sm:text-xs font-medium text-white/80">6-Month Trend</span>
                  </div>
                  <MiniBarChart data={monthlyData} maxValue={maxMonthlyCost} />
                </div>
                
                {/* Cost by Type */}
                <div className="rounded-lg sm:rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    <PieChart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
                    <span className="text-[10px] sm:text-xs font-medium text-white/80">By Type</span>
                  </div>
                  <DonutChart data={typeBreakdown} total={totalCost} />
                </div>
                
                {/* Recurring Issues */}
                <div className="rounded-lg sm:rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                    <span className="text-[10px] sm:text-xs font-medium text-white/80">Recurring Issues</span>
                    {recurringIssues.length > 0 && (
                      <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        {recurringIssues.length}
                      </span>
                    )}
                  </div>
                  <RecurringIssues issues={recurringIssues} />
                </div>
              </div>
              
              {/* Top 10 Most Expensive Vehicles */}
              <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                  <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
                  <span className="text-[10px] sm:text-xs font-medium text-white/80">Top 10 Most Expensive</span>
                  <DollarSign className="w-3 h-3 text-emerald-400/50 ml-auto hidden sm:block" />
                </div>
                <TopExpensiveVehicles assets={assetStats} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
