/**
 * Parts View Component
 * 
 * Unified view for tracking all fixes and parts usage across:
 * - Repairs log entries
 * - DVIR deficiency corrections
 * - Equipment inspection fixes
 * 
 * Features:
 * - Fixes AI summary panel
 * - Filterable fix history
 * - Per-asset cost tracking
 * - Pagination
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Filter,
  ChevronRight,
  ChevronLeft,
  Truck,
  Wrench,
  Package,
  DollarSign,
  FileText,
  ClipboardCheck,
  Cog,
  AlertCircle,
} from 'lucide-react';
import { useUnifiedFixes } from '../hooks/useUnifiedFixes';
import FixesAiPanel from './FixesAiPanel';
import PartsCostAnalytics from './PartsCostAnalytics';
import ExportReportsPanel from './ExportReportsPanel';
import type { UnifiedFix, UnifiedFixFilters, AssetType, FixSource } from '../types/maintenance.types';
import TableSkeleton from '../../../components/skeletons/TableSkeleton';

// =============================================================================
// CONSTANTS
// =============================================================================

const SOURCE_CONFIG: Record<FixSource, { label: string; color: string; icon: React.ReactNode }> = {
  repairs_log: { label: 'Repair Log', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: <Wrench className="w-3 h-3" /> },
  dvir: { label: 'DVIR', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: <ClipboardCheck className="w-3 h-3" /> },
  equipment: { label: 'Equipment', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: <Cog className="w-3 h-3" /> },
};

const ASSET_TYPE_CONFIG: Record<AssetType, { label: string; color: string }> = {
  truck: { label: 'Truck', color: 'text-amber-400' },
  chipper: { label: 'Chipper', color: 'text-emerald-400' },
  trailer: { label: 'Trailer', color: 'text-blue-400' },
  equipment: { label: 'Equipment', color: 'text-purple-400' },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(amount: number | null | undefined): string {
  if (!amount) return '$0';
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
    year: 'numeric',
  });
}

function formatMileage(mileage: number | null | undefined): string {
  if (!mileage) return '—';
  return mileage.toLocaleString() + ' mi';
}

// =============================================================================
// FIX ROW COMPONENT
// =============================================================================

interface FixRowProps {
  fix: UnifiedFix;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}

function FixRow({ fix, isSelected, onSelect, index }: FixRowProps) {
  const sourceConfig = SOURCE_CONFIG[fix.source];
  const assetConfig = ASSET_TYPE_CONFIG[fix.asset_type];
  const effectiveCost = fix.cost || fix.estimated_cost || 0;
  const isEstimated = !fix.cost && fix.estimated_cost;
  
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.15), duration: 0.2 }}
      onClick={onSelect}
      className={`w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 transition-all duration-150 flex items-start gap-2 sm:gap-3 group border-b border-white/[0.03] active:bg-white/[0.05] min-h-[64px] ${
        isSelected
          ? 'bg-gradient-to-r from-[#ff9350]/20 to-[#ff9350]/5 border-l-2 border-l-[#ff9350]'
          : 'border-l-2 border-l-transparent hover:bg-white/[0.03]'
      }`}
    >
      {/* Source Badge */}
      <div className={`mt-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0 border ${sourceConfig.color}`}>
        {sourceConfig.icon}
      </div>
      
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Asset & Date Row */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
          <span className="font-semibold text-xs sm:text-sm text-white truncate">{fix.asset_number}</span>
          <span className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded border ${ASSET_TYPE_CONFIG[fix.asset_type].color} bg-white/5 border-current/30 flex-shrink-0`}>
            {assetConfig.label}
          </span>
          <span className="text-[9px] sm:text-[10px] text-white/30 ml-auto flex-shrink-0">{formatDate(fix.fix_date)}</span>
        </div>
        
        {/* Description */}
        <p className="text-[10px] sm:text-xs text-white/60 line-clamp-2 mb-0.5 sm:mb-1">{fix.description}</p>
        
        {/* Meta Row */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Source - hidden on mobile to save space */}
          <span className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded border ${sourceConfig.color}`}>
            {sourceConfig.label}
          </span>
          
          {/* Cost */}
          <span className={`text-[9px] sm:text-[10px] font-medium ${isEstimated ? 'text-white/40' : 'text-emerald-400'}`}>
            {formatCurrency(effectiveCost)}{isEstimated && '*'}
          </span>
          
          {/* Mileage - hidden on mobile */}
          {fix.mileage_at_fix && (
            <span className="hidden sm:inline text-[10px] text-white/40">{formatMileage(fix.mileage_at_fix)}</span>
          )}
          
          {/* Parts count */}
          {fix.parts_used && fix.parts_used.length > 0 && (
            <span className="text-[9px] sm:text-[10px] text-purple-400">
              {fix.parts_used.length} <span className="hidden xs:inline">part{fix.parts_used.length !== 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
      </div>
      
      <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all flex-shrink-0 mt-1.5 sm:mt-2 ${
        isSelected ? 'text-[#ff9350]' : 'text-white/20 group-hover:text-white/40'
      }`} />
    </motion.button>
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
      <div className="h-full min-h-[400px] rounded-xl border border-white/5 bg-[#050302] p-6 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#ff9350]/10 border border-[#ff9350]/20 mb-4">
          <Package className="w-6 h-6 text-[#ff9350]/70" />
        </div>
        <p className="text-sm font-medium text-white/80 mb-1">Select a Fix Record</p>
        <p className="text-xs text-white/40 max-w-xs">
          Choose a fix from the list to view details, parts used, and cost breakdown
        </p>
      </div>
    );
  }
  
  const sourceConfig = SOURCE_CONFIG[fix.source];
  const assetConfig = ASSET_TYPE_CONFIG[fix.asset_type];
  const effectiveCost = fix.cost || fix.estimated_cost || 0;
  const isEstimated = !fix.cost && fix.estimated_cost;
  
  return (
    <motion.div
      key={fix.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-white/10 bg-[#050302] overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${sourceConfig.color}`}>
            {sourceConfig.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{fix.asset_number}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${assetConfig.color} bg-white/5 border-current/30`}>
                {assetConfig.label}
              </span>
            </div>
            <p className="text-xs text-white/50">{formatDate(fix.fix_date)}</p>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Description */}
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
            Fix Description
          </label>
          <p className="text-sm text-white/80">{fix.description}</p>
        </div>
        
        {/* Deficiencies Corrected */}
        {fix.deficiencies_corrected && fix.deficiencies_corrected.length > 0 && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">
              Issues Corrected
            </label>
            <div className="flex flex-wrap gap-1.5">
              {fix.deficiencies_corrected.map((def, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                >
                  ✓ {def}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Parts Used */}
        {fix.parts_used && fix.parts_used.length > 0 && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">
              Parts Used
            </label>
            <div className="space-y-1.5">
              {fix.parts_used.map((part, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/30 border border-white/5"
                >
                  <div>
                    <span className="text-sm text-white">{part.part_name}</span>
                    {part.part_number && (
                      <span className="text-[10px] text-white/40 ml-2">#{part.part_number}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/50">×{part.quantity}</span>
                    {part.cost && (
                      <span className="text-xs font-medium text-emerald-400">{formatCurrency(part.cost)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Cost */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] uppercase tracking-wider text-white/40">
                {isEstimated ? 'Est. Cost' : 'Cost'}
              </span>
            </div>
            <p className={`text-lg font-bold ${isEstimated ? 'text-white/50' : 'text-emerald-400'}`}>
              {formatCurrency(effectiveCost)}
            </p>
          </div>
          
          {/* Mileage */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] uppercase tracking-wider text-white/40">Mileage</span>
            </div>
            <p className="text-lg font-bold text-white">{formatMileage(fix.mileage_at_fix)}</p>
          </div>
          
          {/* Source */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] uppercase tracking-wider text-white/40">Source</span>
            </div>
            <p className="text-sm font-medium text-white">{sourceConfig.label}</p>
          </div>
          
          {/* Performed By */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] uppercase tracking-wider text-white/40">Performed By</span>
            </div>
            <p className="text-sm font-medium text-white truncate">{fix.performed_by || 'Unknown'}</p>
          </div>
        </div>
        
        {/* Notes */}
        {fix.notes && (
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Notes</label>
            <p className="text-xs text-white/60 p-3 rounded-lg bg-black/30 border border-white/5">{fix.notes}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// FILTER BAR COMPONENT
// =============================================================================

interface FilterBarProps {
  filters: UnifiedFixFilters;
  onFiltersChange: (filters: UnifiedFixFilters) => void;
  onClear: () => void;
}

function FilterBar({ filters, onFiltersChange, onClear }: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const hasActiveFilters = filters.search || filters.asset_type !== 'all' || filters.source !== 'all' || 
    filters.date_from || filters.date_to;
  
  return (
    <div className="rounded-lg sm:rounded-xl border border-[#ff9350]/15 bg-gradient-to-r from-[#0c0402] to-[#120805] p-2.5 sm:p-3 mb-4 sm:mb-5">
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search by asset #, description..."
            value={filters.search || ''}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 sm:pl-9 pr-8 py-2.5 sm:py-2 text-xs sm:text-sm text-white placeholder:text-white/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff9350]/50 transition-all min-h-[44px] sm:min-h-[38px]"
          />
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white active:text-white/60 transition-colors p-1"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
        
        {/* Filters Row */}
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3">
          {/* Asset Type Filter */}
          <select
            value={filters.asset_type || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, asset_type: e.target.value as AssetType | 'all' })}
            className="bg-black/30 border border-white/10 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff9350]/50 min-h-[44px] sm:min-h-[38px]"
          >
            <option value="all">All Assets</option>
            <option value="truck">Trucks</option>
            <option value="chipper">Chippers</option>
            <option value="trailer">Trailers</option>
            <option value="equipment">Equipment</option>
          </select>
          
          {/* Source Filter */}
          <select
            value={filters.source || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, source: e.target.value as FixSource | 'all' })}
            className="bg-black/30 border border-white/10 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff9350]/50 min-h-[44px] sm:min-h-[38px]"
          >
            <option value="all">All Sources</option>
            <option value="repairs_log">Repair Logs</option>
            <option value="dvir">DVIR Fixes</option>
            <option value="equipment">Equipment</option>
          </select>
          
          {/* Advanced Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-colors min-h-[44px] sm:min-h-[38px] ${
              showAdvanced ? 'bg-amber-500/20 text-amber-300' : 'text-white/50 hover:text-white active:text-white hover:bg-white/5 active:bg-white/10'
            }`}
          >
            <Filter className="w-3 h-3" />
            <span className="hidden xs:inline">More</span>
          </button>
          
          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-medium text-amber-400/80 hover:text-amber-300 active:text-amber-200 hover:bg-amber-500/10 active:bg-amber-500/20 border border-amber-500/20 transition-all min-h-[44px] sm:min-h-[38px]"
            >
              <X className="w-3 h-3" />
              <span className="hidden xs:inline">Clear</span>
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 mt-3 border-t border-white/5">
              {/* Date From */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">From</label>
                <input
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => onFiltersChange({ ...filters, date_from: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff9350]/50 [color-scheme:dark]"
                />
              </div>
              
              {/* Date To */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">To</label>
                <input
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => onFiltersChange({ ...filters, date_to: e.target.value })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff9350]/50 [color-scheme:dark]"
                />
              </div>
              
              {/* Min Cost */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Min Cost</label>
                <input
                  type="number"
                  min="0"
                  placeholder="$0"
                  value={filters.cost_min || ''}
                  onChange={(e) => onFiltersChange({ ...filters, cost_min: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff9350]/50"
                />
              </div>
              
              {/* Max Cost */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Max Cost</label>
                <input
                  type="number"
                  min="0"
                  placeholder="$∞"
                  value={filters.cost_max || ''}
                  onChange={(e) => onFiltersChange({ ...filters, cost_max: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff9350]/50"
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

export default function PartsView() {
  const {
    fixes,
    filteredFixes,
    paginatedFixes,
    assetStats,
    aiSummary,
    isLoadingAi,
    aiError,
    currentPage,
    totalPages,
    totalCount,
    setCurrentPage,
    filters,
    setFilters,
    clearFilters,
    isLoading,
    error,
    generateAiSummary,
    totalCost,
    totalEstimatedCost,
    fixesThisMonth,
  } = useUnifiedFixes();
  
  const [selectedFixId, setSelectedFixId] = useState<string | null>(null);
  
  const selectedFix = useMemo(() => 
    fixes.find(f => f.id === selectedFixId) || null,
  [fixes, selectedFixId]);
  
  const handleSelectFix = useCallback((fixId: string) => {
    setSelectedFixId(prev => prev === fixId ? null : fixId);
  }, []);
  
  return (
    <div className="space-y-5">
      {/* Fixes AI Panel */}
      <FixesAiPanel
        summary={aiSummary}
        isLoading={isLoadingAi}
        error={aiError}
        onGenerate={generateAiSummary}
        totalCost={totalCost}
        totalEstimatedCost={totalEstimatedCost}
        fixesThisMonth={fixesThisMonth}
      />
      
      {/* Cost Analytics Panel */}
      {!isLoading && fixes.length > 0 && (
        <PartsCostAnalytics
          fixes={fixes}
          assetStats={assetStats}
        />
      )}
      
      {/* Export Reports Panel */}
      {!isLoading && fixes.length > 0 && (
        <ExportReportsPanel
          fixes={filteredFixes}
          assetStats={assetStats}
          totalCost={totalCost}
          totalEstimatedCost={totalEstimatedCost}
        />
      )}
      
      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onClear={clearFilters}
      />
      
      {/* Loading State */}
      {isLoading && (
        <TableSkeleton rows={5} columns={4} variant="ember" />
      )}
      
      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}
      
      {/* Main Content */}
      {!isLoading && !error && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Fix List */}
          <div className="rounded-xl border border-white/10 bg-[#080403] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#ff9350]" />
                <span className="text-xs font-medium text-white/80">Fix History</span>
                <span className="text-[10px] text-white/40">({totalCount})</span>
              </div>
              {/* Pagination */}
              {totalCount > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-white/50 min-w-[40px] text-center">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            
            {/* List */}
            <div className="max-h-[600px] overflow-y-auto flex-1">
              {paginatedFixes.length === 0 ? (
                <div className="p-6 text-center text-white/50">
                  <Package className="w-10 h-10 text-white/20 mx-auto mb-2" />
                  <p className="text-sm">
                    {filters.search || filters.asset_type !== 'all' || filters.source !== 'all'
                      ? 'No fixes match your filters'
                      : 'No fixes recorded yet'}
                  </p>
                </div>
              ) : (
                paginatedFixes.map((fix, index) => (
                  <FixRow
                    key={fix.id}
                    fix={fix}
                    isSelected={fix.id === selectedFixId}
                    onSelect={() => handleSelectFix(fix.id)}
                    index={index}
                  />
                ))
              )}
            </div>
          </div>
          
          {/* Detail Panel */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <FixDetailPanel fix={selectedFix} />
            </AnimatePresence>
          </div>
        </div>
      )}
      
      {/* Estimated Cost Note */}
      <p className="text-[10px] text-white/30 text-center">
        * Estimated costs are used when actual costs are not recorded
      </p>
    </div>
  );
}
