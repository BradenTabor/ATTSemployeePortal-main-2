/**
 * PendingDefectsWidget Component
 * 
 * Displays a summary of pending equipment defects that need mechanic attention.
 * Queries DVIR reports and daily equipment inspections for failed items.
 * 
 * Part of the Jidoka Maintenance Automation feature.
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Wrench, ChevronRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { logger } from "../../../lib/logger";
import { cn } from "../../../lib/utils";

// Critical defect keywords (same as detectDefects.ts)
const CRITICAL_KEYWORDS = [
  'brake', 'steering', 'hydraulic', 'boom', 'outrigger',
  'emergency', 'pto', 'safety', 'chain', 'fuel'
];

interface DefectItem {
  id: string;
  source: 'dvir' | 'equipment';
  truck_number?: string;
  equipment_type?: string;
  defect_items: string[];
  severity: 'critical' | 'warning';
  reporter_name: string;
  reported_at: string;
}

interface DefectSummary {
  total: number;
  critical: number;
  warning: number;
  items: DefectItem[];
}

// Extract failed items from checklist JSON
function extractFailedItems(checklist: Record<string, string | boolean> | null): string[] {
  if (!checklist) return [];
  
  const failed: string[] = [];
  for (const [key, value] of Object.entries(checklist)) {
    // "F" for fail in DVIR, false for equipment inspections
    if (value === 'F' || value === false) {
      // Convert snake_case to Title Case
      const label = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      failed.push(label);
    }
  }
  return failed;
}

// Determine if defect is critical based on keywords
function isCritical(items: string[]): boolean {
  const combined = items.join(' ').toLowerCase();
  return CRITICAL_KEYWORDS.some(kw => combined.includes(kw));
}

// Fetch pending defects from the last 7 days
async function fetchPendingDefects(): Promise<DefectSummary> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];
  
  const items: DefectItem[] = [];
  
  // Fetch DVIR defects (vehicle_trailer_checklist or aerial_checklist with "F" values)
  try {
    const { data: dvirData, error: dvirError } = await supabase
      .from('dvir_reports')
      .select('id, truck_number, vehicle_trailer_checklist, aerial_checklist, notes, created_at, user_id, app_users(full_name)')
      .gte('report_date', cutoffDate)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (dvirError) throw dvirError;
    
    if (dvirData) {
      for (const dvir of dvirData) {
        const vehicleDefects = extractFailedItems(dvir.vehicle_trailer_checklist);
        const aerialDefects = extractFailedItems(dvir.aerial_checklist);
        const allDefects = [...vehicleDefects, ...aerialDefects];
        
        if (allDefects.length > 0) {
          items.push({
            id: dvir.id,
            source: 'dvir',
            truck_number: dvir.truck_number,
            defect_items: allDefects,
            severity: isCritical(allDefects) ? 'critical' : 'warning',
            reporter_name: (dvir.app_users as unknown as { full_name: string } | null)?.full_name || 'Unknown',
            reported_at: dvir.created_at,
          });
        }
      }
    }
  } catch (error) {
    logger.error('[PendingDefectsWidget] Failed to fetch DVIR defects', error);
  }
  
  // Fetch Equipment Inspection defects (any false values in checklist)
  try {
    const { data: equipData, error: equipError } = await supabase
      .from('daily_equipment_inspections')
      .select('id, equipment_number, equipment_type, checklist, notes, created_at, user_id, app_users(full_name)')
      .gte('inspection_date', cutoffDate)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (equipError) throw equipError;
    
    if (equipData) {
      for (const equip of equipData) {
        const defects = extractFailedItems(equip.checklist);
        
        if (defects.length > 0) {
          items.push({
            id: equip.id,
            source: 'equipment',
            equipment_type: equip.equipment_type || equip.equipment_number || 'Equipment',
            defect_items: defects,
            severity: isCritical(defects) ? 'critical' : 'warning',
            reporter_name: (equip.app_users as unknown as { full_name: string } | null)?.full_name || 'Unknown',
            reported_at: equip.created_at,
          });
        }
      }
    }
  } catch (error) {
    logger.error('[PendingDefectsWidget] Failed to fetch equipment defects', error);
  }
  
  // Sort by severity (critical first) then by date (newest first)
  items.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime();
  });
  
  const critical = items.filter(i => i.severity === 'critical').length;
  const warning = items.filter(i => i.severity === 'warning').length;
  
  return {
    total: items.length,
    critical,
    warning,
    items: items.slice(0, 5), // Show top 5 most urgent
  };
}

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
  const [summary, setSummary] = useState<DefectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const loadDefects = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const data = await fetchPendingDefects();
      setSummary(data);
    } catch (error) {
      logger.error('[PendingDefectsWidget] Failed to load defects', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    loadDefects();
    // Refresh every 5 minutes
    const interval = setInterval(() => loadDefects(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  const hasCritical = useMemo(() => (summary?.critical ?? 0) > 0, [summary]);
  
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
          onClick={() => loadDefects(true)}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
        >
          <RefreshCw className={cn(
            "w-3.5 h-3.5 text-white/40 hover:text-white/60",
            refreshing && "animate-spin"
          )} />
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
          {summary.items.map((item, idx) => (
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
          onClick={() => navigate('/mechanic/equipment-logs')}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
        >
          <span className="text-xs font-medium text-white/60 group-hover:text-white/80">
            View all {summary.total} defects
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-white/40 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all" />
        </button>
      )}
    </motion.div>
  );
}
