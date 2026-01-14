/**
 * Fixes AI Panel Component
 * 
 * AI-generated summary panel for the Parts view showing:
 * - Recent fixed trucks and equipment
 * - Parts used
 * - Deficiencies corrected
 * - All-time estimated cost per vehicle
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Wrench,
  Package,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { FixesAiSummary } from '../types/maintenance.types';

// =============================================================================
// TYPES
// =============================================================================

interface FixesAiPanelProps {
  summary: FixesAiSummary | null;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
  totalCost: number;
  totalEstimatedCost: number;
  fixesThisMonth: number;
}

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="rounded-md sm:rounded-lg border border-white/10 bg-black/20 p-2 sm:p-3">
      <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
        <div className={`${color} [&>svg]:w-3 [&>svg]:h-3 sm:[&>svg]:w-3.5 sm:[&>svg]:h-3.5`}>{icon}</div>
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 truncate">{label}</span>
      </div>
      <p className="text-sm sm:text-lg font-bold text-white truncate">{value}</p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function FixesAiPanel({
  summary,
  isLoading,
  error,
  onGenerate,
  totalCost,
  totalEstimatedCost,
  fixesThisMonth,
}: FixesAiPanelProps) {
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
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl sm:rounded-2xl border border-[#ff9350]/30 bg-gradient-to-br from-[#2d1409]/60 to-[#0a0402]/80 overflow-hidden mb-4 sm:mb-5"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors min-h-[56px] sm:min-h-[60px]"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-[#ff9350] to-[#e87830] flex items-center justify-center shadow-lg shadow-[#ff9350]/20 flex-shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1.5 sm:gap-2">
              Fixes AI
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
            </h3>
            <p className="text-[10px] sm:text-xs text-white/50 truncate">
              {summary?.cached ? `Generated ${formatDate(summary.generated_at)}` : 'AI insights'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onGenerate();
            }}
            disabled={isLoading}
            className="p-2.5 sm:p-2 rounded-lg text-amber-400/60 hover:text-amber-400 active:text-amber-300 hover:bg-amber-500/10 active:bg-amber-500/20 disabled:opacity-50 transition-colors min-h-[40px] sm:min-h-[36px] min-w-[40px] sm:min-w-[36px] flex items-center justify-center"
            title="Regenerate summary"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </div>
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
            <div className="px-4 pb-4 space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard
                  label="This Month"
                  value={fixesThisMonth}
                  icon={<Wrench className="w-3.5 h-3.5" />}
                  color="text-amber-400"
                />
                <StatCard
                  label="Recorded Cost"
                  value={formatCurrency(totalCost)}
                  icon={<DollarSign className="w-3.5 h-3.5" />}
                  color="text-emerald-400"
                />
                <StatCard
                  label="Est. Total"
                  value={formatCurrency(totalEstimatedCost)}
                  icon={<TrendingUp className="w-3.5 h-3.5" />}
                  color="text-blue-400"
                />
                <StatCard
                  label="Parts Used"
                  value={summary?.parts_breakdown?.reduce((sum, p) => sum + p.total_quantity, 0) || 0}
                  icon={<Package className="w-3.5 h-3.5" />}
                  color="text-purple-400"
                />
              </div>
              
              {/* Error State */}
              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-200">{error}</p>
                </div>
              )}
              
              {/* Loading State */}
              {isLoading && !summary && (
                <div className="flex items-center justify-center py-6">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-white/60">Analyzing fix history...</p>
                  </div>
                </div>
              )}
              
              {/* AI Summary Content */}
              {summary && (
                <div className="space-y-4">
                  {/* Main Summary */}
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-sm text-white/80 leading-relaxed">{summary.summary}</p>
                  </div>
                  
                  {/* Top Fixed Assets */}
                  {summary.top_fixed_assets && summary.top_fixed_assets.length > 0 && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                        Most Maintained Assets
                      </h4>
                      <div className="grid gap-2">
                        {summary.top_fixed_assets.slice(0, 5).map((asset, index) => (
                          <div
                            key={`${asset.asset_type}-${asset.asset_number}`}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20 border border-white/5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-white/30 w-4">{index + 1}</span>
                              <span className="text-sm font-medium text-white">{asset.asset_number}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase">
                                {asset.asset_type}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-emerald-400">{formatCurrency(asset.total_cost)}</p>
                              <p className="text-[10px] text-white/40">{asset.fix_count} fixes</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Common Deficiencies & Parts Breakdown Side by Side */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Common Deficiencies */}
                    {summary.common_deficiencies && summary.common_deficiencies.length > 0 && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                          Common Issues Fixed
                        </h4>
                        <div className="space-y-1">
                          {summary.common_deficiencies.slice(0, 5).map((def) => (
                            <div
                              key={def.issue}
                              className="flex items-center justify-between px-2 py-1.5 rounded bg-black/20"
                            >
                              <span className="text-xs text-white/70 truncate max-w-[70%]">{def.issue}</span>
                              <span className="text-[10px] font-medium text-amber-400">{def.count}x</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Parts Breakdown */}
                    {summary.parts_breakdown && summary.parts_breakdown.length > 0 && (
                      <div>
                        <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                          Parts Used
                        </h4>
                        <div className="space-y-1">
                          {summary.parts_breakdown.slice(0, 5).map((part) => (
                            <div
                              key={part.part_name}
                              className="flex items-center justify-between px-2 py-1.5 rounded bg-black/20"
                            >
                              <span className="text-xs text-white/70 truncate max-w-[60%]">{part.part_name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-white/40">x{part.total_quantity}</span>
                                <span className="text-[10px] font-medium text-emerald-400">
                                  {formatCurrency(part.total_cost)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Cost Summary */}
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-0.5">
                          30-Day Spend
                        </p>
                        <p className="text-lg font-bold text-emerald-400">
                          {formatCurrency(summary.total_cost_30_days)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">
                          All-Time Total
                        </p>
                        <p className="text-lg font-bold text-white">
                          {formatCurrency(summary.total_cost_all_time)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Empty State - No Summary & Not Loading */}
              {!summary && !isLoading && !error && (
                <div className="text-center py-4">
                  <Sparkles className="w-8 h-8 text-amber-400/40 mx-auto mb-2" />
                  <p className="text-sm text-white/60 mb-2">No summary generated yet</p>
                  <button
                    onClick={onGenerate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-amber-500/20 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Summary
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
