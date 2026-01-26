/**
 * usePendingDefects Hook
 * 
 * ARCH-018: Extracted API calls from PendingDefectsWidget component
 * to follow separation of concerns pattern.
 * 
 * Fetches pending equipment defects from DVIR reports and equipment inspections
 * for the last 7 days, sorted by severity.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { logger } from '../../lib/logger';

// Critical defect keywords (same as detectDefects.ts)
const CRITICAL_KEYWORDS = [
  'brake', 'steering', 'hydraulic', 'boom', 'outrigger',
  'emergency', 'pto', 'safety', 'chain', 'fuel'
];

export interface DefectItem {
  id: string;
  source: 'dvir' | 'equipment';
  truck_number?: string;
  equipment_type?: string;
  defect_items: string[];
  severity: 'critical' | 'warning';
  reporter_name: string;
  reported_at: string;
}

export interface DefectSummary {
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

/**
 * Fetch pending defects from the last 7 days
 */
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
        const vehicleDefects = extractFailedItems(dvir.vehicle_trailer_checklist as Record<string, string | boolean> | null);
        const aerialDefects = extractFailedItems(dvir.aerial_checklist as Record<string, string | boolean> | null);
        const allDefects = [...vehicleDefects, ...aerialDefects];
        
        if (allDefects.length > 0) {
          items.push({
            id: dvir.id,
            source: 'dvir',
            truck_number: dvir.truck_number,
            defect_items: allDefects,
            severity: isCritical(allDefects) ? 'critical' : 'warning',
            reporter_name: (() => {
              const u = Array.isArray(dvir.app_users) ? dvir.app_users[0] : dvir.app_users;
              return (u as { full_name?: string } | null)?.full_name ?? 'Unknown';
            })(),
            reported_at: dvir.created_at,
          });
        }
      }
    }
  } catch (error) {
    logger.error('[usePendingDefects] Failed to fetch DVIR defects', error);
  }
  
  // Fetch Equipment Inspection defects (any false values in checklist)
  try {
    const { data: equipData, error: equipError } = await supabase
      .from('daily_equipment_inspections')
      .select('id, equipment_number, equipment_type, general_checklist, specific_checklist, notes, created_at, user_id, app_users(full_name)')
      .gte('inspection_date', cutoffDate)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (equipError) throw equipError;
    
    if (equipData) {
      for (const equip of equipData) {
        const generalDefects = extractFailedItems(equip.general_checklist as Record<string, string | boolean> | null);
        const specificDefects = extractFailedItems(equip.specific_checklist as Record<string, string | boolean> | null);
        const allDefects = [...generalDefects, ...specificDefects];
        
        if (allDefects.length > 0) {
          items.push({
            id: equip.id,
            source: 'equipment',
            equipment_type: equip.equipment_type || equip.equipment_number || 'Equipment',
            defect_items: allDefects,
            severity: isCritical(allDefects) ? 'critical' : 'warning',
            reporter_name: (() => {
              const u = Array.isArray(equip.app_users) ? equip.app_users[0] : equip.app_users;
              return (u as { full_name?: string } | null)?.full_name ?? 'Unknown';
            })(),
            reported_at: equip.created_at,
          });
        }
      }
    }
  } catch (error) {
    logger.error('[usePendingDefects] Failed to fetch equipment defects', error);
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

export function usePendingDefects() {
  // PERF-019: Use React Query for caching and automatic refetching
  const query = useQuery({
    queryKey: queryKeys.pendingDefects(),
    queryFn: fetchPendingDefects,
    
    // Cache strategy for pending defects:
    // - staleTime: 2min - Data considered fresh for 2min (defects don't change frequently)
    // - gcTime: 10min - Keep in cache for 10 min after unmount
    // - refetchInterval: 5min - Poll for updates every 5min when mounted
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 5,
    
    // Show cached data immediately while revalidating
    placeholderData: (previousData: DefectSummary | undefined) => previousData,
    
    // Refetch on window focus to catch new defects
    refetchOnWindowFocus: true,
    
    // Retry on failure
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    summary: query.data ?? {
      total: 0,
      critical: 0,
      warning: 0,
      items: [],
    },
    loading: query.isLoading && !query.data, // Only show loading if no cached data
    isRefetching: query.isFetching && !!query.data, // Background refresh indicator
    error: query.error?.message ?? null,
    refetch: query.refetch,
  };
}
