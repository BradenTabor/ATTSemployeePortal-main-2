/**
 * Mileage Anomaly Card Component
 * 
 * Displays detected mileage anomalies and provides resolution workflow.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type { MileageAnomaly, AnomalyType } from '../types/maintenance.types';
import { formatMileage, formatDateTime, ANOMALY_SEVERITY_CONFIG } from '../utils/maintenanceConstants';

// =============================================================================
// TYPES
// =============================================================================

interface MileageAnomalyCardProps {
  anomaly: MileageAnomaly;
  onResolve: (id: string, notes: string) => Promise<void>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getAnomalyIcon(type: AnomalyType) {
  switch (type) {
    case 'decrease':
      return TrendingDown;
    case 'large_jump':
      return TrendingUp;
    case 'stale_data':
      return Clock;
    case 'impossible_reading':
    default:
      return AlertCircle;
  }
}

function getAnomalyTitle(type: AnomalyType): string {
  switch (type) {
    case 'decrease':
      return 'Mileage Decreased';
    case 'large_jump':
      return 'Unusual Mileage Jump';
    case 'stale_data':
      return 'Stale Data';
    case 'impossible_reading':
      return 'Invalid Reading';
    default:
      return 'Anomaly Detected';
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MileageAnomalyCard({ anomaly, onResolve }: MileageAnomalyCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const severityConfig = ANOMALY_SEVERITY_CONFIG[anomaly.severity];
  const Icon = getAnomalyIcon(anomaly.anomaly_type);
  
  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      setError('Please enter resolution notes');
      return;
    }
    
    try {
      setIsResolving(true);
      setError(null);
      await onResolve(anomaly.id, resolutionNotes.trim());
    } catch {
      setError('Failed to resolve. Please try again.');
    } finally {
      setIsResolving(false);
    }
  };
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-xl border ${severityConfig.borderColor} ${severityConfig.bgColor} overflow-hidden`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        <div className={`w-9 h-9 rounded-lg ${severityConfig.bgColor} border ${severityConfig.borderColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${severityConfig.textColor}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${severityConfig.textColor}`}>
              {getAnomalyTitle(anomaly.anomaly_type)}
            </span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${severityConfig.bgColor} ${severityConfig.textColor} border ${severityConfig.borderColor}`}>
              {severityConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5">
            <span>Truck {anomaly.truck_number}</span>
            <span>•</span>
            <span>{formatMileage(anomaly.reported_mileage)} mi</span>
            <span>•</span>
            <span>{formatDateTime(anomaly.created_at)}</span>
          </div>
        </div>
        
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>
      
      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-black/20 px-3 py-2">
                  <span className="text-white/40 block mb-0.5">Reported</span>
                  <span className="text-white font-medium">{formatMileage(anomaly.reported_mileage)} mi</span>
                </div>
                {anomaly.previous_mileage && (
                  <div className="rounded-lg bg-black/20 px-3 py-2">
                    <span className="text-white/40 block mb-0.5">Previous</span>
                    <span className="text-white font-medium">{formatMileage(anomaly.previous_mileage)} mi</span>
                  </div>
                )}
                {anomaly.expected_range_low !== null && anomaly.expected_range_high !== null && (
                  <div className="col-span-2 rounded-lg bg-black/20 px-3 py-2">
                    <span className="text-white/40 block mb-0.5">Expected Range</span>
                    <span className="text-white font-medium">
                      {formatMileage(anomaly.expected_range_low)} - {formatMileage(anomaly.expected_range_high)} mi
                    </span>
                  </div>
                )}
              </div>
              
              {/* Resolution Form */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
                  Resolution Notes
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-white/30" />
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Explain why this reading is valid or how it was corrected..."
                    rows={2}
                    className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 transition-all resize-none"
                  />
                </div>
              </div>
              
              {/* Error */}
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-white/10 text-white/60 text-xs font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={isResolving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isResolving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Resolving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Resolved
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// ANOMALIES LIST COMPONENT
// =============================================================================

interface MileageAnomaliesListProps {
  anomalies: MileageAnomaly[];
  onResolve: (id: string, notes: string) => Promise<void>;
}

export function MileageAnomaliesList({ anomalies, onResolve }: MileageAnomaliesListProps) {
  if (anomalies.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
        <p className="text-sm font-medium text-emerald-300">No Anomalies</p>
        <p className="text-xs text-white/40">All mileage readings look good</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-white">Mileage Anomalies</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] font-bold text-amber-300">
          {anomalies.length}
        </span>
      </div>
      
      <AnimatePresence>
        {anomalies.map(anomaly => (
          <MileageAnomalyCard
            key={anomaly.id}
            anomaly={anomaly}
            onResolve={onResolve}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
