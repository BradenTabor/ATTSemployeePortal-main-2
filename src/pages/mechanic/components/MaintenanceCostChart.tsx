/**
 * Maintenance Cost Chart Component (Phase 3)
 * 
 * Shows spending trends over time for maintenance costs.
 * Helps track budget and identify cost patterns.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react';
import type { MaintenanceLogEntry } from '../types/maintenance.types';
import { formatCost, MAINTENANCE_TYPE_CONFIG } from '../utils/maintenanceConstants';

// =============================================================================
// TYPES
// =============================================================================

interface MaintenanceCostChartProps {
  logs: MaintenanceLogEntry[];
  isLoading?: boolean;
}

type TimeRange = '7d' | '30d' | '90d' | '1y';

interface MonthlyData {
  month: string;
  total: number;
  byType: Record<string, number>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function aggregateByMonth(logs: MaintenanceLogEntry[]): MonthlyData[] {
  const monthlyMap = new Map<string, MonthlyData>();
  
  for (const log of logs) {
    if (!log.cost) continue;
    
    const date = new Date(log.service_date);
    const monthKey = getMonthKey(date);
    
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        month: monthKey,
        total: 0,
        byType: {},
      });
    }
    
    const monthData = monthlyMap.get(monthKey)!;
    monthData.total += log.cost;
    monthData.byType[log.maintenance_type] = (monthData.byType[log.maintenance_type] || 0) + log.cost;
  }
  
  // Sort by month and return last 12 months
  return Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MaintenanceCostChart({ logs, isLoading }: MaintenanceCostChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d');
  
  // Filter logs by time range
  const filteredLogs = useMemo(() => {
    const now = new Date();
    let cutoff: Date;
    
    switch (timeRange) {
      case '7d':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
    }
    
    return logs.filter(log => new Date(log.service_date) >= cutoff);
  }, [logs, timeRange]);
  
  // Aggregate data
  const monthlyData = useMemo(() => aggregateByMonth(filteredLogs), [filteredLogs]);
  
  // Calculate stats
  const stats = useMemo(() => {
    const totalCost = filteredLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
    const avgPerMonth = monthlyData.length > 0 ? totalCost / monthlyData.length : 0;
    
    // Calculate trend (compare last month to previous month)
    const lastMonth = monthlyData[monthlyData.length - 1]?.total || 0;
    const prevMonth = monthlyData[monthlyData.length - 2]?.total || 0;
    const trend = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;
    
    // Cost by type
    const byType: Record<string, number> = {};
    for (const log of filteredLogs) {
      if (log.cost) {
        byType[log.maintenance_type] = (byType[log.maintenance_type] || 0) + log.cost;
      }
    }
    
    return { totalCost, avgPerMonth, trend, byType };
  }, [filteredLogs, monthlyData]);
  
  // Chart dimensions
  const maxValue = Math.max(...monthlyData.map(d => d.total), 1);
  
  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#050302] p-4">
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="rounded-xl border border-white/10 bg-[#050302] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-500/8 to-transparent border-b border-white/5">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Maintenance Costs</h3>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex gap-1 p-0.5 bg-black/30 rounded-lg">
          {([['7d', '7D'], ['30d', '30D'], ['90d', '90D'], ['1y', '1Y']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                timeRange === value
                  ? 'bg-emerald-500 text-white'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 p-3 border-b border-white/5">
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5 text-center">
          <p className="text-lg font-bold text-white">{formatCost(stats.totalCost)}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Total</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5 text-center">
          <p className="text-lg font-bold text-white">{formatCost(stats.avgPerMonth)}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Avg/Month</p>
        </div>
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-2.5 text-center">
          <div className="flex items-center justify-center gap-1">
            {stats.trend > 0 ? (
              <TrendingUp className="w-4 h-4 text-red-400" />
            ) : stats.trend < 0 ? (
              <TrendingDown className="w-4 h-4 text-emerald-400" />
            ) : null}
            <p className={`text-lg font-bold ${
              stats.trend > 0 ? 'text-red-400' : stats.trend < 0 ? 'text-emerald-400' : 'text-white'
            }`}>
              {stats.trend > 0 ? '+' : ''}{stats.trend.toFixed(1)}%
            </p>
          </div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Trend</p>
        </div>
      </div>
      
      {/* Bar Chart */}
      <div className="p-4">
        {monthlyData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-white/40 text-xs">
            <div className="text-center">
              <BarChart3 className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p>No cost data in selected period</p>
            </div>
          </div>
        ) : (
          <>
            {/* Bars */}
            <div className="flex items-end gap-1 h-32">
              {monthlyData.map((data, index) => {
                const height = (data.total / maxValue) * 100;
                return (
                  <div
                    key={data.month}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                      className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t"
                      style={{ minHeight: height > 0 ? 4 : 0 }}
                    />
                  </div>
                );
              })}
            </div>
            
            {/* Labels */}
            <div className="flex gap-1 mt-2">
              {monthlyData.map(data => (
                <div key={data.month} className="flex-1 text-center">
                  <p className="text-[9px] text-white/40">{formatMonthLabel(data.month)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Cost by Type */}
      {Object.keys(stats.byType).length > 0 && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">By Type</p>
          <div className="space-y-1.5">
            {Object.entries(stats.byType)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([type, cost]) => {
                const config = MAINTENANCE_TYPE_CONFIG[type as keyof typeof MAINTENANCE_TYPE_CONFIG];
                const percentage = (cost / stats.totalCost) * 100;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/60 w-24 truncate">
                      {config?.shortLabel || type}
                    </span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500/60 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white/40 w-16 text-right">
                      {formatCost(cost)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
