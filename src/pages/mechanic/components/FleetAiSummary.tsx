/**
 * Fleet AI Summary Component
 * 
 * Premium AI-themed fleet maintenance overview optimized for mobile.
 * Compact design with vibrant colors and smooth animations.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Wrench,
  Droplet,
  RefreshCw,
  Circle,
  Truck,
  Info,
  Copy,
  Check,
  Zap,
  Brain,
  AlertCircle,
  Timer,
  Shield,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { logger } from '../../../lib/logger';

// =============================================================================
// ANIMATED AI TEXT
// =============================================================================

function AnimatedAiText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <span className="bg-gradient-to-r from-lime-200 via-lime-400 to-glacier-300 bg-clip-text text-transparent font-semibold italic font-display">
        {children}
      </span>
    </span>
  );
}

// =============================================================================
// TYPES
// =============================================================================

interface MaintenanceSchedule {
  truck_number: string;
  current_mileage: number | null;
  last_oil_change_mileage: number | null;
  last_tire_rotation_mileage: number | null;
  last_tire_replacement_mileage: number | null;
  oil_change_interval_miles: number;
  tire_rotation_interval_miles: number;
  tire_replacement_interval_miles: number;
  ai_summary: string | null;
  ai_summary_generated_at: string | null;
}

interface FleetStats {
  totalTrucks: number;
  overdueCount: number;
  dueSoonCount: number;
  healthyCount: number;
  priorityTrucks: {
    truckNumber: string;
    urgency: 'overdue' | 'due_soon';
    issues: string[];
    mileage: number;
    aiSummary: string | null;
    aiSummaryGeneratedAt: string | null;
  }[];
}

interface AiSummaryResponse {
  success: boolean;
  summary: string;
  cached: boolean;
  generated_at: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function calculateTruckUrgency(schedule: MaintenanceSchedule): {
  urgency: 'overdue' | 'due_soon' | 'ok';
  issues: string[];
} {
  const issues: string[] = [];
  let hasOverdue = false;
  let hasDueSoon = false;
  
  const currentMileage = schedule.current_mileage || 0;
  
  const milesSinceOil = currentMileage - (schedule.last_oil_change_mileage || 0);
  if (milesSinceOil >= schedule.oil_change_interval_miles) {
    issues.push('Oil');
    hasOverdue = true;
  } else if (milesSinceOil >= schedule.oil_change_interval_miles * 0.8) {
    issues.push('Oil');
    hasDueSoon = true;
  }
  
  const milesSinceTireRotation = currentMileage - (schedule.last_tire_rotation_mileage || 0);
  if (milesSinceTireRotation >= schedule.tire_rotation_interval_miles) {
    issues.push('Rotation');
    hasOverdue = true;
  } else if (milesSinceTireRotation >= schedule.tire_rotation_interval_miles * 0.8) {
    issues.push('Rotation');
    hasDueSoon = true;
  }
  
  const milesSinceTireReplacement = currentMileage - (schedule.last_tire_replacement_mileage || 0);
  if (milesSinceTireReplacement >= schedule.tire_replacement_interval_miles) {
    issues.push('Tires');
    hasOverdue = true;
  } else if (milesSinceTireReplacement >= schedule.tire_replacement_interval_miles * 0.8) {
    issues.push('Tires');
    hasDueSoon = true;
  }
  
  return { urgency: hasOverdue ? 'overdue' : hasDueSoon ? 'due_soon' : 'ok', issues };
}

async function generateAiSummary(truckNumber: string, forceRegenerate = false): Promise<AiSummaryResponse> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('Not authenticated');
  }
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL not configured');
  
  const response = await fetch(
    `${supabaseUrl}/functions/v1/generate-maintenance-summary`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        truck_number: truckNumber.toUpperCase().trim(),
        force_regenerate: forceRegenerate,
      }),
    }
  );
  
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Failed to generate summary');
  return result;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function FleetAiSummary() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  
  const [selectedTruck, setSelectedTruck] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [currentSummary, setCurrentSummary] = useState<AiSummaryResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchSchedules = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('maintenance_schedules')
        .select('*')
        .order('truck_number');
      
      if (fetchError) throw fetchError;
      setSchedules(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      logger.error('Failed to fetch maintenance schedules:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const fleetStats = useMemo((): FleetStats => {
    let overdueCount = 0, dueSoonCount = 0, healthyCount = 0;
    const priorityTrucks: FleetStats['priorityTrucks'] = [];

    for (const schedule of schedules) {
      const { urgency, issues } = calculateTruckUrgency(schedule);
      
      if (urgency === 'overdue') {
        overdueCount++;
        priorityTrucks.push({
          truckNumber: schedule.truck_number,
          urgency: 'overdue',
          issues,
          mileage: schedule.current_mileage || 0,
          aiSummary: schedule.ai_summary,
          aiSummaryGeneratedAt: schedule.ai_summary_generated_at,
        });
      } else if (urgency === 'due_soon') {
        dueSoonCount++;
        priorityTrucks.push({
          truckNumber: schedule.truck_number,
          urgency: 'due_soon',
          issues,
          mileage: schedule.current_mileage || 0,
          aiSummary: schedule.ai_summary,
          aiSummaryGeneratedAt: schedule.ai_summary_generated_at,
        });
      } else {
        healthyCount++;
      }
    }

    priorityTrucks.sort((a, b) => {
      if (a.urgency === 'overdue' && b.urgency !== 'overdue') return -1;
      if (a.urgency !== 'overdue' && b.urgency === 'overdue') return 1;
      return a.truckNumber.localeCompare(b.truckNumber);
    });

    return { totalTrucks: schedules.length, overdueCount, dueSoonCount, healthyCount, priorityTrucks: priorityTrucks.slice(0, 5) };
  }, [schedules]);

  const handleTruckSelect = useCallback((truckNumber: string) => {
    if (selectedTruck === truckNumber) {
      setSelectedTruck(null);
      setCurrentSummary(null);
      setSummaryError(null);
    } else {
      setSelectedTruck(truckNumber);
      setSummaryError(null);
      const truck = fleetStats.priorityTrucks.find(t => t.truckNumber === truckNumber);
      if (truck?.aiSummary) {
        setCurrentSummary({
          success: true,
          summary: truck.aiSummary,
          cached: true,
          generated_at: truck.aiSummaryGeneratedAt || new Date().toISOString(),
        });
      } else {
        setCurrentSummary(null);
      }
    }
  }, [selectedTruck, fleetStats.priorityTrucks]);

  const handleGenerateSummary = useCallback(async (forceRegenerate = false) => {
    if (!selectedTruck) return;
    setIsGenerating(true);
    setSummaryError(null);
    
    try {
      const result = await generateAiSummary(selectedTruck, forceRegenerate);
      setCurrentSummary(result);
      await fetchSchedules();
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate');
      logger.error('AI summary generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTruck, fetchSchedules]);

  const handleCopy = useCallback(async () => {
    if (!currentSummary?.summary || !selectedTruck) return;
    try {
      await navigator.clipboard.writeText(`${selectedTruck}: ${currentSummary.summary}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      logger.error('Failed to copy');
    }
  }, [currentSummary, selectedTruck]);

  const formatTimeAgo = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const toggleInfo = useCallback(() => {
    setShowInfo(prev => !prev);
  }, []);

  return (
    <div className="relative overflow-hidden">
      {/* Container */}
      <div className="relative rounded-leaf border border-bone-50/[0.1] bg-ink-900/80 overflow-hidden shadow-slab">
        <div aria-hidden className="vein absolute inset-x-0 top-0" />
        {/* Ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-verdant-500/15 rounded-full blur-[60px]" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-lime-400/10 rounded-full blur-[60px]" />
        </div>
        
        {/* Header - Compact */}
        <div className="relative flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-leaf-sm bg-[linear-gradient(135deg,#F4F7F2_0%,#D2FFA3_100%)] flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
              <Brain className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-ink-950" />
            </div>
            <div>
              <h3 className="font-display text-lg sm:text-xl font-light text-bone-50 flex items-center gap-1.5">
                Fleet <AnimatedAiText>AI</AnimatedAiText>
              </h3>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-400 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-lime-400" />
                <span className="hidden sm:inline">Maintenance tracking</span>
                <span className="sm:hidden">Tracking</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleInfo}
            className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all ${
              showInfo 
                ? 'bg-verdant-500/25 text-lime-200' 
                : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-lime-200 active:bg-verdant-500/20'
            }`}
            aria-label={showInfo ? 'Hide info' : 'Show info'}
            aria-expanded={showInfo}
          >
            {showInfo ? <X className="w-4 h-4" /> : <Info className="w-4 h-4" />}
          </button>
        </div>

        {/* Info Panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 sm:px-4 py-3 bg-verdant-500/10 border-b border-bone-50/[0.06]">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-lime-300 mt-0.5 flex-shrink-0" />
                  <div className="text-xs sm:text-sm text-white/70 space-y-1.5">
                    <p className="font-semibold text-white">
                      How does Fleet <AnimatedAiText className="text-xs sm:text-sm">AI</AnimatedAiText> work?
                    </p>
                    <p className="leading-relaxed">
                      Analyzes DVIR data to track maintenance. 
                      <span className="text-lime-300 font-medium"> Tap any truck</span> to generate an 
                      <AnimatedAiText className="text-xs sm:text-sm mx-1">AI</AnimatedAiText> summary.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="relative p-3 sm:p-4">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 text-lime-300 animate-spin" />
              <span className="text-sm text-bone-300">Loading...</span>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="rounded-lg bg-red-600/20 border border-red-500/30 p-3 text-center">
              <AlertTriangle className="w-5 h-5 text-red-400 mx-auto mb-1" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Main */}
          {!isLoading && !error && (
            <div className="space-y-3 sm:space-y-4">
              {/* Stats - Compact Grid */}
              <div className="grid grid-cols-3 gap-2">
                {/* Overdue */}
                <motion.div 
                  className="relative rounded-leaf-sm overflow-hidden"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 border border-red-400/30 bg-red-500/[0.12] rounded-leaf-sm" />
                  <div className="relative p-2 sm:p-3 text-center">
                    <AlertCircle className="w-4 h-4 text-red-300 mx-auto mb-1" />
                    <div className="font-display text-2xl sm:text-3xl font-light tabular-nums text-red-200">{fleetStats.overdueCount}</div>
                    <div className="font-mono text-[9px] text-bone-400 uppercase tracking-[0.18em]">Overdue</div>
                  </div>
                </motion.div>

                {/* Due Soon */}
                <motion.div 
                  className="relative rounded-leaf-sm overflow-hidden"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 border border-sap-400/30 bg-sap-400/[0.12] rounded-leaf-sm" />
                  <div className="relative p-2 sm:p-3 text-center">
                    <Timer className="w-4 h-4 text-sap-300 mx-auto mb-1" />
                    <div className="font-display text-2xl sm:text-3xl font-light tabular-nums text-sap-200">{fleetStats.dueSoonCount}</div>
                    <div className="font-mono text-[9px] text-bone-400 uppercase tracking-[0.18em]">Soon</div>
                  </div>
                </motion.div>

                {/* Healthy */}
                <motion.div 
                  className="relative rounded-leaf-sm overflow-hidden"
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 border border-verdant-400/30 bg-verdant-500/[0.12] rounded-leaf-sm" />
                  <div className="relative p-2 sm:p-3 text-center">
                    <Shield className="w-4 h-4 text-verdant-300 mx-auto mb-1" />
                    <div className="font-display text-2xl sm:text-3xl font-light tabular-nums text-verdant-200">{fleetStats.healthyCount}</div>
                    <div className="font-mono text-[9px] text-bone-400 uppercase tracking-[0.18em]">OK</div>
                  </div>
                </motion.div>
              </div>

              {/* Priority Trucks - Compact */}
              {fleetStats.priorityTrucks.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-lime-300" />
                    Tap truck for <AnimatedAiText className="text-[10px]">AI</AnimatedAiText> summary
                  </p>
                  <div className="space-y-1.5">
                    {fleetStats.priorityTrucks.map((truck) => (
                      <div key={truck.truckNumber}>
                        <motion.button
                          onClick={() => handleTruckSelect(truck.truckNumber)}
                          className={`w-full flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-leaf-sm border transition-all text-left ${
                            selectedTruck === truck.truckNumber
                              ? 'bg-verdant-500/15 border-lime-400/50'
                              : truck.urgency === 'overdue'
                              ? 'bg-ink-950/60 border-red-400/25 active:bg-red-500/10'
                              : 'bg-ink-950/60 border-sap-400/25 active:bg-sap-400/10'
                          }`}
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* Icon */}
                          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            selectedTruck === truck.truckNumber
                              ? 'bg-[linear-gradient(135deg,#F4F7F2_0%,#D2FFA3_100%)] text-ink-950'
                              : truck.urgency === 'overdue' 
                              ? 'bg-red-500/20 text-red-200 border border-red-400/30' 
                              : 'bg-sap-400/20 text-sap-200 border border-sap-400/30'
                          }`}>
                            <Truck className="w-4 h-4" />
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-bone-50">{truck.truckNumber}</span>
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                truck.urgency === 'overdue'
                                  ? 'bg-red-500/20 text-red-200'
                                  : 'bg-sap-400/20 text-sap-200'
                              }`}>
                                {truck.urgency === 'overdue' ? 'Overdue' : 'Soon'}
                              </span>
                              {truck.aiSummary && (
                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-verdant-500/25 text-lime-200">
                                  <AnimatedAiText className="text-[9px]">AI</AnimatedAiText>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-white/60">
                              {truck.issues.map((issue, idx) => (
                                <span key={idx} className="flex items-center gap-0.5">
                                  {issue === 'Oil' && <Droplet className="w-2.5 h-2.5 text-glacier-300" />}
                                  {issue === 'Rotation' && <RefreshCw className="w-2.5 h-2.5 text-lime-300" />}
                                  {issue === 'Tires' && <Circle className="w-2.5 h-2.5 text-bone-300" />}
                                  {issue}
                                  {idx < truck.issues.length - 1 && <span className="text-white/30 mx-0.5">·</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {/* Chevron */}
                          <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${
                            selectedTruck === truck.truckNumber ? 'rotate-180 text-lime-300' : 'text-bone-500'
                          }`} />
                        </motion.button>
                        
                        {/* AI Summary Panel - Compact */}
                        <AnimatePresence>
                          {selectedTruck === truck.truckNumber && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-1.5 rounded-leaf-sm border border-verdant-400/30 bg-verdant-500/10 p-3 sm:p-4">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-2.5">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-lime-300" />
                                    <span className="text-xs font-bold text-white">
                                      <AnimatedAiText className="text-xs">AI</AnimatedAiText> Summary
                                    </span>
                                  </div>
                                  {currentSummary && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] text-bone-400">
                                        {formatTimeAgo(currentSummary.generated_at)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={handleCopy}
                                        aria-label={copied ? "Copied" : "Copy summary"}
                                        className="p-1.5 rounded-md bg-white/5 text-white/50 hover:text-lime-200 active:bg-verdant-500/20 focus-visible:outline focus-visible:ring-2 focus-visible:ring-verdant-400/50 focus-visible:ring-offset-1"
                                      >
                                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleGenerateSummary(true)}
                                        disabled={isGenerating}
                                        aria-label={isGenerating ? "Regenerating summary" : "Regenerate summary"}
                                        className="p-1.5 rounded-md bg-white/5 text-white/50 hover:text-lime-200 active:bg-verdant-500/20 disabled:opacity-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-verdant-400/50 focus-visible:ring-offset-1"
                                      >
                                        <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} aria-hidden />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                
                                {/* States */}
                                {isGenerating && (
                                  <div className="flex items-center gap-2 py-2">
                                    <Loader2 className="w-4 h-4 text-lime-300 animate-spin" />
                                    <span className="text-xs text-bone-300">Generating...</span>
                                  </div>
                                )}
                                
                                {summaryError && !isGenerating && (
                                  <div className="rounded-md bg-red-500/20 border border-red-500/30 p-2 text-xs text-red-300 flex items-center justify-between">
                                    <span>{summaryError}</span>
                                    <button type="button" onClick={() => handleGenerateSummary(true)} aria-label="Retry generating summary" className="text-red-400 underline ml-2 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-400/50 focus-visible:ring-offset-1 rounded">
                                      Retry
                                    </button>
                                  </div>
                                )}
                                
                                {currentSummary && !isGenerating && !summaryError && (
                                  <div className="relative pl-3">
                                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-lime-300 via-verdant-400 to-glacier-400 rounded-full" />
                                    <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
                                      {currentSummary.summary}
                                    </p>
                                  </div>
                                )}
                                
                                {!currentSummary && !isGenerating && !summaryError && (
                                  <div className="text-center py-2">
                                    <motion.button
                                      onClick={() => handleGenerateSummary(false)}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-leaf-sm bg-[linear-gradient(135deg,#F4F7F2_0%,#D2FFA3_100%)] text-ink-950 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                                      whileTap={{ scale: 0.95 }}
                                    >
                                      <Sparkles className="w-3.5 h-3.5" />
                                      Generate <AnimatedAiText className="text-xs">AI</AnimatedAiText> Summary
                                    </motion.button>
                                  </div>
                                )}
                                
                                {/* Link */}
                                <button
                                  type="button"
                                  onClick={() => navigate(`/mechanic/parts-repairs?truck=${encodeURIComponent(truck.truckNumber)}`)}
                                  aria-label={`View details and log repairs for truck ${truck.truckNumber}`}
                                  className="mt-2.5 pt-2.5 border-t border-bone-50/[0.08] text-xs text-lime-300 hover:text-lime-200 flex items-center gap-1 w-full focus-visible:outline focus-visible:ring-2 focus-visible:ring-verdant-400/50 focus-visible:ring-offset-1 rounded"
                                >
                                  <Wrench className="w-3 h-3" aria-hidden />
                                  View details & log repairs
                                  <ChevronRight className="w-3 h-3 ml-auto" aria-hidden />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </div>
              ) : fleetStats.totalTrucks > 0 ? (
                <div className="rounded-lg sm:rounded-xl bg-emerald-600/20 border border-emerald-500/30 p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-emerald-200">All healthy!</p>
                  <p className="text-xs text-emerald-300/60">No maintenance needed</p>
                </div>
              ) : (
                <div className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                  <Wrench className="w-6 h-6 text-white/30 mx-auto mb-1" />
                  <p className="text-sm text-white/50">No trucks yet</p>
                </div>
              )}

              {/* View All */}
              {fleetStats.totalTrucks > 0 && (
                <motion.button
                  onClick={() => navigate('/mechanic/parts-repairs')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-leaf-sm bg-ink-950/60 border border-bone-50/[0.1] text-bone-100 font-mono text-[10px] uppercase tracking-[0.18em] hover:border-lime-400/50 hover:bg-ink-900/80 transition-colors"
                  whileTap={{ scale: 0.98 }}
                >
                  <Wrench className="w-4 h-4" />
                  View All {fleetStats.totalTrucks} Trucks
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
