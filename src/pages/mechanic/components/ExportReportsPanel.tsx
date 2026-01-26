/**
 * Export Reports Panel Component
 * 
 * Provides export functionality for fix/parts data:
 * - CSV export (UTF-8 with BOM for Excel compatibility)
 * - Excel export with styled headers and metadata
 * - PDF export with company header
 * - Summary report (text format)
 * - Date range filtering for exports
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Table,
} from 'lucide-react';
import { format } from 'date-fns';
import type { UnifiedFix, AssetFixStats } from '../types/maintenance.types';
import {
  DataExporter,
  formatDateForExport,
  formatCurrency,
  formatMileage,
  formatPartsList,
  formatStringArray,
  generateFilename,
  type ExportColumn,
  type ExportMetadata,
} from '../../../lib/exportUtils';
import { useAuth } from '../../../contexts/AuthContext';
import { formToast } from '../../../lib/formToast';
import { logger } from '../../../lib/logger';

// =============================================================================
// TYPES
// =============================================================================

interface ExportReportsPanelProps {
  fixes: UnifiedFix[];
  assetStats: AssetFixStats[];
  totalCost: number;
  totalEstimatedCost: number;
}

type ExportFormat = 'csv' | 'excel' | 'pdf' | 'summary';

// =============================================================================
// COLUMN DEFINITIONS
// =============================================================================

const fixesColumns: ExportColumn<UnifiedFix>[] = [
  {
    header: 'Date',
    key: 'fix_date',
    format: (value) => formatDateForExport(value as string),
    width: 14,
  },
  {
    header: 'Asset Number',
    key: 'asset_number',
    width: 15,
  },
  {
    header: 'Asset Type',
    key: 'asset_type',
    format: (value) => {
      const types: Record<string, string> = {
        truck: 'Truck',
        chipper: 'Chipper',
        trailer: 'Trailer',
        equipment: 'Equipment',
      };
      return types[value as string] || String(value);
    },
    width: 12,
  },
  {
    header: 'Source',
    key: 'source',
    format: (value) => {
      const sources: Record<string, string> = {
        repairs_log: 'Repairs Log',
        dvir: 'DVIR',
        equipment: 'Equipment',
      };
      return sources[value as string] || String(value);
    },
    width: 14,
  },
  {
    header: 'Description',
    key: 'description',
    format: (value) => (value as string) || 'N/A',
    width: 40,
  },
  {
    header: 'Issues Fixed',
    key: 'deficiencies_corrected',
    format: (value) => formatStringArray(value as string[] | null, 'None'),
    width: 35,
  },
  {
    header: 'Parts Used',
    key: 'parts_used',
    format: (value) =>
      formatPartsList(
        value as Array<{ part_name: string; quantity: number; part_number?: string }> | null
      ),
    width: 40,
  },
  {
    header: 'Cost',
    key: 'cost',
    format: (value, row) => {
      const cost = value as number | null;
      const estimated = row.estimated_cost;
      if (cost != null) return formatCurrency(cost);
      if (estimated != null) return `${formatCurrency(estimated)} (est.)`;
      return '$0.00';
    },
    width: 14,
  },
  {
    header: 'Mileage',
    key: 'mileage_at_fix',
    format: (value) => formatMileage(value as number | null),
    width: 12,
  },
  {
    header: 'Performed By',
    key: 'performed_by',
    format: (value) => (value as string) || 'Unknown',
    width: 20,
  },
];

// =============================================================================
// SUMMARY REPORT GENERATOR (Specialized Text Format)
// =============================================================================

function generateSummaryReport(
  fixes: UnifiedFix[],
  assetStats: AssetFixStats[],
  totalCost: number,
  totalEstimatedCost: number,
  dateFrom?: string,
  dateTo?: string
): string {
  const now = format(new Date(), "EEEE, MMMM do, yyyy 'at' h:mm a");
  
  // Calculate stats
  const bySource = fixes.reduce((acc, f) => {
    acc[f.source] = (acc[f.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const byAssetType = fixes.reduce((acc, f) => {
    acc[f.asset_type] = (acc[f.asset_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const partsCount = fixes.reduce((sum, f) => sum + (f.parts_used?.length || 0), 0);
  
  const topAssets = assetStats.slice(0, 10);
  
  // Common issues
  const issueMap = new Map<string, number>();
  for (const fix of fixes) {
    for (const issue of fix.deficiencies_corrected || []) {
      issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
    }
  }
  const topIssues = Array.from(issueMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  const dateRange = dateFrom && dateTo 
    ? `${formatDateForExport(dateFrom)} to ${formatDateForExport(dateTo)}`
    : dateFrom 
    ? `From ${formatDateForExport(dateFrom)}`
    : dateTo 
    ? `Through ${formatDateForExport(dateTo)}`
    : 'All Time';
  
  return `
================================================================================
                    ATTS FLEET MAINTENANCE REPORT
================================================================================

Generated: ${now}
Date Range: ${dateRange}

================================================================================
                           EXECUTIVE SUMMARY
================================================================================

Total Fixes Recorded:    ${fixes.length}
Total Recorded Cost:     ${formatCurrency(totalCost)}
Total Estimated Cost:    ${formatCurrency(totalEstimatedCost)}
Parts Used:              ${partsCount} items

--------------------------------------------------------------------------------
                           BREAKDOWN BY SOURCE
--------------------------------------------------------------------------------

Repairs Log:             ${bySource.repairs_log || 0} fixes
DVIR Corrections:        ${bySource.dvir || 0} fixes
Equipment Fixes:         ${bySource.equipment || 0} fixes

--------------------------------------------------------------------------------
                         BREAKDOWN BY ASSET TYPE
--------------------------------------------------------------------------------

Trucks:                  ${byAssetType.truck || 0} fixes
Chippers:                ${byAssetType.chipper || 0} fixes
Trailers:                ${byAssetType.trailer || 0} fixes
Other Equipment:         ${byAssetType.equipment || 0} fixes

================================================================================
                    TOP 10 MOST EXPENSIVE ASSETS
================================================================================

${topAssets.length > 0 ? topAssets.map((a, i) => 
  `${(i + 1).toString().padStart(2)}. ${a.asset_number.padEnd(15)} ${a.asset_type.padEnd(10)} ${a.total_fixes.toString().padStart(3)} fixes   ${formatCurrency(a.total_cost + a.estimated_cost).padStart(12)}`
).join('\n') : '(No data available)'}

================================================================================
                       TOP 10 COMMON ISSUES
================================================================================

${topIssues.length > 0 ? topIssues.map((issue, i) => 
  `${(i + 1).toString().padStart(2)}. ${issue[0].substring(0, 40).padEnd(42)} ${issue[1].toString().padStart(4)} occurrences`
).join('\n') : '(No issues recorded)'}

================================================================================
                            DETAILED LOG
================================================================================

${fixes.map(f => `
Date: ${formatDateForExport(f.fix_date)}
Asset: ${f.asset_number} (${f.asset_type})
Source: ${f.source === 'repairs_log' ? 'Repairs Log' : f.source === 'dvir' ? 'DVIR' : 'Equipment'}
Description: ${f.description || 'N/A'}
Issues Fixed: ${f.deficiencies_corrected?.join(', ') || 'N/A'}
Parts Used: ${f.parts_used?.map(p => `${p.part_name} (x${p.quantity})`).join(', ') || 'None'}
Cost: ${f.cost ? formatCurrency(f.cost) : 'Not recorded'} ${f.estimated_cost ? `(Est: ${formatCurrency(f.estimated_cost)})` : ''}
Mileage: ${f.mileage_at_fix?.toLocaleString() || 'N/A'}
${f.performed_by ? `Performed By: ${f.performed_by}` : ''}
---`).join('\n')}

================================================================================
                           END OF REPORT
================================================================================
`.trim();
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ExportReportsPanel({
  fixes,
  assetStats,
  totalCost,
  totalEstimatedCost,
}: ExportReportsPanelProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Filter fixes by date range
  const filteredFixes = useMemo(() => {
    let result = fixes;
    if (dateFrom) {
      result = result.filter(f => f.fix_date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(f => f.fix_date <= dateTo);
    }
    return result;
  }, [fixes, dateFrom, dateTo]);
  
  // Build metadata for exports
  const buildMetadata = useCallback((): ExportMetadata => {
    const filters: Record<string, string> = {};
    if (dateFrom) filters['From'] = formatDateForExport(dateFrom);
    if (dateTo) filters['To'] = formatDateForExport(dateTo);
    
    return {
      reportType: 'ATTS Fleet Fixes Report',
      generatedAt: new Date(),
      exportedBy: user?.email || 'Unknown User',
      filters,
      totalRecords: filteredFixes.length,
    };
  }, [dateFrom, dateTo, filteredFixes.length, user?.email]);
  
  const handleExport = useCallback(async (exportFormat: ExportFormat) => {
    setIsExporting(true);
    setExportSuccess(null);
    
    try {
      // Brief processing delay for UX
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const exporter = new DataExporter<UnifiedFix>();
      const metadata = buildMetadata();
      const dateContext = dateFrom || dateTo 
        ? `${dateFrom || 'start'}_to_${dateTo || 'now'}`
        : undefined;
      
      switch (exportFormat) {
        case 'csv': {
          const filename = generateFilename('ATTS_Fixes_Export', dateContext, 'csv');
          exporter.exportCSV({
            data: filteredFixes,
            columns: fixesColumns,
            filename,
            metadata,
          });
          setExportSuccess('CSV exported successfully!');
          break;
        }
        
        case 'excel': {
          const filename = generateFilename('ATTS_Fixes_Export', dateContext, 'xlsx');
          exporter.exportExcel({
            data: filteredFixes,
            columns: fixesColumns,
            filename,
            metadata,
          });
          setExportSuccess('Excel file exported successfully!');
          break;
        }
        
        case 'pdf': {
          const filename = generateFilename('ATTS_Fixes_Export', dateContext, 'pdf');
          exporter.exportPDF({
            data: filteredFixes,
            columns: fixesColumns,
            filename,
            metadata,
            companyName: 'All Terrain Tree Service',
            subtitle: dateFrom || dateTo 
              ? `Date Range: ${formatDateForExport(dateFrom) || 'Start'} to ${formatDateForExport(dateTo) || 'Present'}`
              : 'All Time Data',
            orientation: 'landscape',
          });
          setExportSuccess('PDF exported successfully!');
          break;
        }
        
        case 'summary': {
          const report = generateSummaryReport(
            filteredFixes,
            assetStats,
            totalCost,
            totalEstimatedCost,
            dateFrom || undefined,
            dateTo || undefined
          );
          const filename = generateFilename('ATTS_Maintenance_Report', dateContext, 'txt');
          downloadTextFile(report, filename);
          setExportSuccess('Summary report exported successfully!');
          break;
        }
      }
      
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (error) {
      logger.error('[ExportReportsPanel] Export failed:', error);
      formToast.error('Export Failed', 'Export failed. Please try again.');
      setExportSuccess(null);
    } finally {
      setIsExporting(false);
    }
  }, [filteredFixes, assetStats, totalCost, totalEstimatedCost, dateFrom, dateTo, buildMetadata]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-lg sm:rounded-xl border border-white/10 bg-gradient-to-r from-[#0c0402] to-[#120805] overflow-hidden mb-4 sm:mb-5"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors min-h-[56px] sm:min-h-[60px]"
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-xs sm:text-sm font-medium text-white">Export Reports</h3>
            <p className="text-[9px] sm:text-[10px] text-white/40 truncate">CSV, Excel, PDF, Summary</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {exportSuccess && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-[9px] sm:text-[10px] text-emerald-400 flex items-center gap-1 hidden xs:flex"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span className="hidden sm:inline">{exportSuccess}</span>
              <span className="sm:hidden">Done</span>
            </motion.span>
          )}
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
            <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 sm:space-y-4">
              {/* Date Range Filter */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/30" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-lg pl-7 sm:pl-9 pr-2 sm:pr-3 py-2.5 sm:py-2 text-xs sm:text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 [color-scheme:dark] min-h-[44px] sm:min-h-[38px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] sm:text-[10px] uppercase tracking-wider text-white/40 mb-1">
                    To Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2 sm:left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/30" />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full bg-black/30 border border-white/10 rounded-lg pl-7 sm:pl-9 pr-2 sm:pr-3 py-2.5 sm:py-2 text-xs sm:text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50 [color-scheme:dark] min-h-[44px] sm:min-h-[38px]"
                    />
                  </div>
                </div>
              </div>
              
              {/* Record Count */}
              <p className="text-[10px] sm:text-xs text-white/50">
                {filteredFixes.length} fixes
                {(dateFrom || dateTo) && ` (of ${fixes.length})`}
              </p>
              
              {/* Export Buttons - Grid Layout */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {/* CSV Export */}
                <button
                  onClick={() => handleExport('csv')}
                  disabled={isExporting || filteredFixes.length === 0}
                  className="inline-flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2.5 sm:py-3 rounded-md sm:rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] sm:text-xs font-medium hover:bg-emerald-500/30 active:bg-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[56px] sm:min-h-[64px]"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span>CSV</span>
                </button>
                
                {/* Excel Export */}
                <button
                  onClick={() => handleExport('excel')}
                  disabled={isExporting || filteredFixes.length === 0}
                  className="inline-flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2.5 sm:py-3 rounded-md sm:rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-[10px] sm:text-xs font-medium hover:bg-green-500/30 active:bg-green-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[56px] sm:min-h-[64px]"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <Table className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span>Excel</span>
                </button>
                
                {/* PDF Export */}
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={isExporting || filteredFixes.length === 0}
                  className="inline-flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2.5 sm:py-3 rounded-md sm:rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] sm:text-xs font-medium hover:bg-red-500/30 active:bg-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[56px] sm:min-h-[64px]"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span>PDF</span>
                </button>
                
                {/* Summary Report Export */}
                <button
                  onClick={() => handleExport('summary')}
                  disabled={isExporting || filteredFixes.length === 0}
                  className="inline-flex flex-col items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2.5 sm:py-3 rounded-md sm:rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] sm:text-xs font-medium hover:bg-blue-500/30 active:bg-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[56px] sm:min-h-[64px]"
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                  <span>Summ</span>
                </button>
              </div>
              
              {/* Help Text - Hidden on mobile */}
              <div className="hidden sm:block text-[10px] text-white/30 space-y-1">
                <p>• <strong>CSV:</strong> Spreadsheet-compatible with formatted data</p>
                <p>• <strong>Excel:</strong> Styled spreadsheet with metadata sheet</p>
                <p>• <strong>PDF:</strong> Print-ready document with company header</p>
                <p>• <strong>Summary:</strong> Text report with statistics and analysis</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
