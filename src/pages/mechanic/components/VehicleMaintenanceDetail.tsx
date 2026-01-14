/**
 * Vehicle Maintenance Detail Component
 * 
 * Shows comprehensive maintenance information for a selected vehicle:
 * - Current status and mileage
 * - Maintenance status cards (oil, tires)
 * - Mileage history chart
 * - Service timeline
 * - AI-powered recommendations
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Droplet,
  RefreshCw,
  Circle,
  AlertTriangle,
  Plus,
  TrendingUp,
  History,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  RefreshCcw,
  AlertCircle,
  Copy,
  Check,
  Download,
  FileSpreadsheet,
  Table,
  FileDown,
} from 'lucide-react';
import type {
  VehicleMaintenanceInfo,
  MaintenanceLogEntry,
  MileageHistoryEntry,
} from '../types/maintenance.types';
import {
  formatMileage,
  formatDate,
  getUrgencyConfig,
  MAINTENANCE_TYPE_CONFIG,
} from '../utils/maintenanceConstants';
import { 
  fetchMileageHistory, 
  fetchMaintenanceLogs,
  generateAiSummary,
  isAiSummaryStale,
  type AiSummaryResponse,
} from '../hooks/useMaintenanceData';
import { logger } from '../../../lib/logger';
import {
  DataExporter,
  formatDateForExport,
  formatCurrency,
  formatMileage as formatMileageExport,
  formatPartsList,
  generateFilename,
  type ExportColumn,
  type ExportMetadata,
} from '../../../lib/exportUtils';

// =============================================================================
// EXPORT COLUMN DEFINITIONS
// =============================================================================

const serviceLogColumns: ExportColumn<MaintenanceLogEntry>[] = [
  {
    header: 'Service Date',
    key: 'service_date',
    format: (value) => formatDateForExport(value as string),
    width: 14,
  },
  {
    header: 'Type',
    key: 'maintenance_type',
    format: (value) => {
      const config = MAINTENANCE_TYPE_CONFIG[value as keyof typeof MAINTENANCE_TYPE_CONFIG];
      return config?.label || String(value);
    },
    width: 18,
  },
  {
    header: 'Description',
    key: 'description',
    format: (value) => (value as string) || 'N/A',
    width: 40,
  },
  {
    header: 'Parts Used',
    key: 'parts_used',
    format: (value) =>
      formatPartsList(
        value as Array<{ part_name: string; quantity: number; part_number?: string }> | null
      ),
    width: 35,
  },
  {
    header: 'Mileage',
    key: 'mileage_at_service',
    format: (value) => formatMileageExport(value as number | null),
    width: 12,
  },
  {
    header: 'Cost',
    key: 'cost',
    format: (value) => formatCurrency(value as number | null),
    width: 12,
  },
  {
    header: 'Performed By',
    key: 'performed_by_name',
    format: (value) => (value as string) || 'Unknown',
    width: 20,
  },
  {
    header: 'Notes',
    key: 'notes',
    format: (value) => (value as string) || 'N/A',
    width: 30,
  },
];

// =============================================================================
// MILEAGE HISTORY CHART
// =============================================================================

interface MileageHistoryChartProps {
  history: MileageHistoryEntry[];
  isLoading: boolean;
}

function MileageHistoryChart({ history, isLoading }: MileageHistoryChartProps) {
  if (isLoading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-white/30" />
      </div>
    );
  }
  
  if (history.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-white/40 text-xs">
        No mileage history available
      </div>
    );
  }
  
  // Sort by date ascending for chart
  const sortedHistory = [...history].reverse();
  
  // Calculate chart bounds
  const mileages = sortedHistory.map(h => h.mileage);
  const minMileage = Math.min(...mileages);
  const maxMileage = Math.max(...mileages);
  const range = maxMileage - minMileage || 1;
  
  // Generate points for SVG path
  const width = 100;
  const height = 60;
  const padding = 4;
  
  const points = sortedHistory.map((entry, index) => {
    const x = padding + ((width - 2 * padding) / (sortedHistory.length - 1 || 1)) * index;
    const y = height - padding - ((entry.mileage - minMileage) / range) * (height - 2 * padding);
    return { x, y, entry };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  // Gradient area path
  const areaPath = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;
  
  return (
    <div className="relative">
      {/* Chart */}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" preserveAspectRatio="none">
        <defs>
          <linearGradient id="mileageGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(251, 146, 60)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="rgb(251, 146, 60)" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <path d={areaPath} fill="url(#mileageGradient)" />
        
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="rgb(251, 146, 60)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Points */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="2"
            fill="rgb(251, 146, 60)"
            className="hover:r-3 transition-all"
          />
        ))}
      </svg>
      
      {/* Labels */}
      <div className="flex justify-between mt-1 text-[9px] text-white/30">
        <span>{formatDate(sortedHistory[0]?.created_at)}</span>
        <span>{formatMileage(maxMileage)} mi</span>
      </div>
    </div>
  );
}

// =============================================================================
// SERVICE TIMELINE
// =============================================================================

interface ServiceTimelineProps {
  logs: MaintenanceLogEntry[];
  isLoading: boolean;
}

function ServiceTimeline({ logs, isLoading }: ServiceTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const displayLogs = expanded ? logs : logs.slice(0, 3);
  
  if (isLoading) {
    return (
      <div className="py-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-white/30" />
      </div>
    );
  }
  
  if (logs.length === 0) {
    return (
      <div className="py-6 text-center">
        <History className="w-8 h-8 text-white/20 mx-auto mb-2" />
        <p className="text-xs text-white/40">No service history yet</p>
      </div>
    );
  }
  
  return (
    <div>
      <div className="space-y-3">
        {displayLogs.map((log, index) => {
          const typeConfig = MAINTENANCE_TYPE_CONFIG[log.maintenance_type];
          return (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex gap-3"
            >
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full bg-amber-500`} />
                {index < displayLogs.length - 1 && (
                  <div className="w-px flex-1 bg-white/10 my-1" />
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1 pb-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-white">
                    {typeConfig.label}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {formatDate(log.service_date)}
                  </span>
                </div>
                <p className="text-[11px] text-white/60 line-clamp-2">
                  {log.description}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                  <span>{formatMileage(log.mileage_at_service)} mi</span>
                  {log.cost && <span>${log.cost.toFixed(2)}</span>}
                  <span>{log.performed_by_name}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
      
      {logs.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 py-2 text-xs text-amber-400/70 hover:text-amber-400 flex items-center justify-center gap-1 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Show {logs.length - 3} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// MAINTENANCE STATUS CARD
// =============================================================================

interface MaintenanceStatusCardProps {
  status: VehicleMaintenanceInfo['oilChangeStatus'];
  icon: typeof Droplet;
  label: string;
}

function MaintenanceStatusCard({ status, icon: Icon, label }: MaintenanceStatusCardProps) {
  const config = getUrgencyConfig(status.urgency);
  
  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.iconColor}`} />
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${config.textColor}`}>
          {config.label}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-white/50">Miles since last</span>
          <span className="text-white/80">{formatMileage(status.milesSinceLast)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/50">Last service</span>
          <span className="text-white/80">{formatDate(status.lastServiceDate) || 'Never'}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/50">Interval</span>
          <span className="text-white/80">{formatMileage(status.intervalMiles)} mi</span>
        </div>
      </div>
      {/* Progress bar */}
      <div className="mt-3 h-1.5 bg-black/30 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${
            status.urgency === 'overdue' ? 'bg-red-400' :
            status.urgency === 'due_soon' ? 'bg-amber-400' :
            status.urgency === 'upcoming' ? 'bg-blue-400' :
            'bg-emerald-400'
          }`}
          style={{ width: `${Math.min(status.percentageUsed, 100)}%` }}
        />
      </div>
      <p className={`mt-1 text-[10px] ${config.textColor}`}>{status.message}</p>
    </div>
  );
}

// =============================================================================
// AI SUMMARY SECTION
// =============================================================================

interface AiSummarySectionProps {
  truckNumber: string;
  existingSummary?: string | null;
  summaryGeneratedAt?: string | null;
  lastMaintenanceDate?: string | null;
}

function AiSummarySection({ 
  truckNumber, 
  existingSummary, 
  summaryGeneratedAt,
  lastMaintenanceDate,
}: AiSummarySectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AiSummaryResponse | null>(
    existingSummary ? {
      success: true,
      summary: existingSummary,
      cached: true,
      generated_at: summaryGeneratedAt || new Date().toISOString(),
    } : null
  );
  const [copied, setCopied] = useState(false);
  
  // Check if summary is stale
  const isStale = summary && isAiSummaryStale(summary.generated_at, lastMaintenanceDate);
  
  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };
  
  const handleGenerate = async (forceRegenerate = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await generateAiSummary(truckNumber, forceRegenerate);
      setSummary(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate summary';
      setError(message);
      logger.error('AI summary generation failed:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCopy = async () => {
    if (!summary?.summary) return;
    
    const formattedText = `Maintenance Summary - Truck ${truckNumber}
Generated: ${new Date(summary.generated_at).toLocaleString()}

${summary.summary}`;
    
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      logger.error('Failed to copy to clipboard');
    }
  };
  
  return (
    <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-sm font-medium text-white">AI Maintenance Summary</span>
        </div>
        
        {summary && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40">
              {summary.cached && '📦 '}
              {formatTimeAgo(summary.generated_at)}
            </span>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
              title="Copy summary"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => handleGenerate(true)}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Refresh summary"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="px-4 py-3">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="text-sm text-white/60">Generating AI summary...</span>
          </div>
        )}
        
        {/* Error State */}
        {error && !isLoading && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-300">Generation Failed</span>
            </div>
            <p className="text-xs text-red-300/70 mb-3">{error}</p>
            <button
              onClick={() => handleGenerate(true)}
              className="text-xs text-red-400 hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        )}
        
        {/* Staleness Warning */}
        {summary && isStale && !isLoading && !error && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-300">
                ⚠️ Summary may be outdated
              </span>
              <button
                onClick={() => handleGenerate(true)}
                className="text-xs text-amber-400 hover:text-amber-300 underline"
              >
                Refresh
              </button>
            </div>
          </div>
        )}
        
        {/* Summary Display */}
        {summary && !isLoading && !error && (
          <p className="text-xs text-white/70 leading-relaxed">
            {summary.summary}
          </p>
        )}
        
        {/* No Summary State */}
        {!summary && !isLoading && !error && (
          <div className="text-center py-4">
            <Sparkles className="w-8 h-8 text-purple-400/30 mx-auto mb-2" />
            <p className="text-xs text-white/50 mb-3">
              Generate an AI-powered maintenance recommendation
            </p>
            <button
              onClick={() => handleGenerate(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-semibold transition-all hover:shadow-lg hover:shadow-purple-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Summary
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface VehicleMaintenanceDetailProps {
  vehicle: VehicleMaintenanceInfo;
  onLogRepair: () => void;
}

export default function VehicleMaintenanceDetail({ vehicle, onLogRepair }: VehicleMaintenanceDetailProps) {
  const [mileageHistory, setMileageHistory] = useState<MileageHistoryEntry[]>([]);
  const [serviceLogs, setServiceLogs] = useState<MaintenanceLogEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  
  // Export handler
  const handleExport = useCallback(async (exportFormat: 'csv' | 'excel' | 'pdf') => {
    if (serviceLogs.length === 0) return;
    
    setIsExporting(true);
    setExportSuccess(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const exporter = new DataExporter<MaintenanceLogEntry>();
      const metadata: ExportMetadata = {
        reportType: `Service History - Truck ${vehicle.truckNumber}`,
        generatedAt: new Date(),
        exportedBy: 'Mechanic Portal',
        filters: {
          'Truck': vehicle.truckNumber,
          'Current Mileage': formatMileage(vehicle.currentMileage),
        },
        totalRecords: serviceLogs.length,
      };
      
      const filename = generateFilename('Service_History', vehicle.truckNumber);
      
      switch (exportFormat) {
        case 'csv':
          exporter.exportCSV({
            data: serviceLogs,
            columns: serviceLogColumns,
            filename,
            metadata,
          });
          setExportSuccess('Service history exported to CSV!');
          break;
        case 'excel':
          exporter.exportExcel({
            data: serviceLogs,
            columns: serviceLogColumns,
            filename: filename.replace('.csv', '.xlsx'),
            metadata,
          });
          setExportSuccess('Service history exported to Excel!');
          break;
        case 'pdf':
          exporter.exportPDF({
            data: serviceLogs,
            columns: serviceLogColumns,
            filename: filename.replace('.csv', '.pdf'),
            metadata,
            companyName: 'All Terrain Tree Service',
            subtitle: `Current Mileage: ${formatMileage(vehicle.currentMileage)}`,
            orientation: 'landscape',
          });
          setExportSuccess('Service history exported to PDF!');
          break;
      }
      
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err) {
      logger.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [serviceLogs, vehicle.truckNumber, vehicle.currentMileage]);
  
  // Fetch mileage history callback
  const loadMileageHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await fetchMileageHistory(vehicle.truckNumber, 10);
      setMileageHistory(data);
    } catch (err) {
      logger.error('Failed to fetch mileage history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [vehicle.truckNumber]);
  
  // Fetch service logs callback
  const loadServiceLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const { data } = await fetchMaintenanceLogs({ truck_number: vehicle.truckNumber }, 1, 20);
      setServiceLogs(data);
    } catch (err) {
      logger.error('Failed to fetch service logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [vehicle.truckNumber]);
  
  // Load data on mount and when truck changes
  useEffect(() => {
    loadMileageHistory();
    loadServiceLogs();
  }, [loadMileageHistory, loadServiceLogs]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Header Card */}
      <div className="rounded-xl border border-white/10 bg-[#050302] overflow-hidden">
        <div className="bg-gradient-to-r from-[#ff9350]/8 to-transparent border-b border-white/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff9350]/20 to-[#e87830]/10 border border-[#ff9350]/20 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-[#ff9350]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-white truncate">
                  Truck {vehicle.truckNumber}
                </h3>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span>{formatMileage(vehicle.currentMileage)} mi</span>
                  {vehicle.currentMileageDate && (
                    <>
                      <span className="text-white/20">•</span>
                      <span>Updated {formatDate(vehicle.currentMileageDate)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Export Dropdown */}
              <div className="relative group">
                <button
                  disabled={isExporting || isLoadingLogs || serviceLogs.length === 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  Export
                </button>
                <div className="absolute right-0 top-full mt-1 w-28 bg-[#0c0402] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
                  <button onClick={() => handleExport('csv')} disabled={isExporting} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors rounded-t-lg">
                    <FileSpreadsheet className="w-3 h-3" /> CSV
                  </button>
                  <button onClick={() => handleExport('excel')} disabled={isExporting} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                    <Table className="w-3 h-3" /> Excel
                  </button>
                  <button onClick={() => handleExport('pdf')} disabled={isExporting} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors rounded-b-lg">
                    <FileDown className="w-3 h-3" /> PDF
                  </button>
                </div>
              </div>
              <button
                onClick={onLogRepair}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#ff9350] to-[#e87830] text-white text-xs font-semibold transition-all hover:shadow-lg hover:shadow-[#ff9350]/20"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Repair
              </button>
            </div>
          </div>
          {/* Export Success Message */}
          <AnimatePresence>
            {exportSuccess && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mt-2 text-[10px] text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> {exportSuccess}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Mileage Chart */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#ff9350]" />
            <span className="text-xs font-medium text-white/70">Mileage History</span>
            <span className="text-[10px] text-white/40">
              ({mileageHistory.length} records)
            </span>
          </div>
          <MileageHistoryChart history={mileageHistory} isLoading={isLoadingHistory} />
          
          {/* Recent readings */}
          {mileageHistory.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
{mileageHistory.slice(0, 3).map((entry) => (
                <div
                  key={entry.dvir_id}
                  className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5 text-center"
                >
                  <p className="text-xs font-medium text-white">{formatMileage(entry.mileage)}</p>
                  <p className="text-[9px] text-white/40">{formatDate(entry.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Maintenance Statuses */}
        <div className="p-4">
          <div className="space-y-3">
            <MaintenanceStatusCard 
              status={vehicle.oilChangeStatus} 
              icon={Droplet} 
              label="Oil Change" 
            />
            <MaintenanceStatusCard 
              status={vehicle.tireRotationStatus} 
              icon={RefreshCw} 
              label="Tire Rotation" 
            />
            
            {/* Tire Replacement - Collapsible */}
            <AnimatePresence>
              {showAllStatuses && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <MaintenanceStatusCard 
                    status={vehicle.tireReplacementStatus} 
                    icon={Circle} 
                    label="Tire Replacement" 
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            <button
              onClick={() => setShowAllStatuses(!showAllStatuses)}
              className="w-full py-2 text-xs text-white/40 hover:text-white/60 flex items-center justify-center gap-1 transition-colors"
            >
              {showAllStatuses ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Show tire replacement
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Recent DVIR Failures */}
      {vehicle.recentDvirFailures.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-300">Recent DVIR Failures</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {vehicle.recentDvirFailures.map((failure, idx) => (
              <span 
                key={idx}
                className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-300"
              >
                {failure}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* AI Summary Section */}
      <AiSummarySection
        truckNumber={vehicle.truckNumber}
        existingSummary={vehicle.aiSummary}
        summaryGeneratedAt={vehicle.aiSummaryGeneratedAt}
        lastMaintenanceDate={serviceLogs[0]?.service_date}
      />
      
      {/* Service Timeline */}
      <div className="rounded-xl border border-white/10 bg-[#050302] p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-[#ff9350]" />
          <span className="text-xs font-medium text-white/70">Service History</span>
          <span className="text-[10px] text-white/40">({serviceLogs.length} records)</span>
        </div>
        <ServiceTimeline logs={serviceLogs} isLoading={isLoadingLogs} />
      </div>
    </motion.div>
  );
}
