/**
 * Maintenance Data Hook
 * 
 * Fetches and manages maintenance data from Supabase:
 * - Maintenance schedules for all vehicles
 * - Maintenance logs
 * - Mileage anomalies
 * - Mileage history from DVIRs
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { logger } from '../../../lib/logger';
import type {
  MaintenanceSchedule,
  MaintenanceLogEntry,
  MileageAnomaly,
  MileageHistoryEntry,
  CreateMaintenanceLogInput,
  MaintenanceLogFilters,
} from '../types/maintenance.types';
import { normalizeTruckNumber } from '../utils/maintenanceConstants';

// =============================================================================
// FETCH FUNCTIONS
// =============================================================================

/**
 * Fetch all maintenance schedules
 */
export async function fetchMaintenanceSchedules(): Promise<MaintenanceSchedule[]> {
  const { data, error } = await supabase
    .from('maintenance_schedules')
    .select('*')
    .order('truck_number', { ascending: true });
  
  if (error) {
    logger.error('Failed to fetch maintenance schedules:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Fetch maintenance logs with optional filters
 */
export async function fetchMaintenanceLogs(
  filters?: MaintenanceLogFilters,
  page = 1,
  pageSize = 15
): Promise<{ data: MaintenanceLogEntry[]; count: number }> {
  let query = supabase
    .from('vehicle_maintenance_log')
    .select('*', { count: 'exact' });
  
  // Apply filters
  if (filters?.truck_number) {
    query = query.eq('truck_number', normalizeTruckNumber(filters.truck_number));
  }
  if (filters?.maintenance_type) {
    query = query.eq('maintenance_type', filters.maintenance_type);
  }
  if (filters?.date_from) {
    query = query.gte('service_date', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('service_date', filters.date_to);
  }
  if (filters?.search) {
    const search = `%${filters.search}%`;
    query = query.or(`truck_number.ilike.${search},description.ilike.${search},performed_by_name.ilike.${search}`);
  }
  
  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  const { data, error, count } = await query
    .order('service_date', { ascending: false })
    .range(from, to);
  
  if (error) {
    logger.error('Failed to fetch maintenance logs:', error);
    throw error;
  }
  
  return { data: data || [], count: count || 0 };
}

/**
 * Fetch unresolved mileage anomalies
 */
export async function fetchUnresolvedAnomalies(): Promise<MileageAnomaly[]> {
  const { data, error } = await supabase
    .from('mileage_anomalies')
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false });
  
  if (error) {
    logger.error('Failed to fetch mileage anomalies:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Fetch mileage history for a truck from DVIRs
 */
export async function fetchMileageHistory(
  truckNumber: string,
  limit = 10
): Promise<MileageHistoryEntry[]> {
  const { data, error } = await supabase
    .from('dvir_reports')
    .select('id, mileage, created_at, drivers_name, truck_number')
    .eq('truck_number', normalizeTruckNumber(truckNumber))
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    logger.error('Failed to fetch mileage history:', error);
    throw error;
  }
  
  return (data || []).map(d => ({
    dvir_id: d.id,
    mileage: d.mileage,
    created_at: d.created_at,
    drivers_name: d.drivers_name,
    truck_number: d.truck_number,
  }));
}

/**
 * Fetch recent DVIR failures for a truck that have NOT been fixed yet
 * Only returns failures from DVIRs where no mechanic fix has been recorded
 */
export async function fetchRecentDvirFailures(
  truckNumber: string,
  limit = 5
): Promise<string[]> {
  // Only fetch DVIRs that have NOT been fixed by a mechanic
  // A DVIR is considered "fixed" if deficiency_corrected is not null/empty
  const { data, error } = await supabase
    .from('dvir_reports')
    .select('vehicle_trailer_checklist, aerial_checklist, deficiency_corrected, mechanic_date')
    .eq('truck_number', normalizeTruckNumber(truckNumber))
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    logger.error('Failed to fetch DVIR failures:', error);
    return [];
  }
  
  const failures: string[] = [];
  for (const report of data || []) {
    // Skip DVIRs that have been fixed by a mechanic
    const hasBeenFixed = Boolean(
      report.deficiency_corrected?.trim() || 
      report.mechanic_date
    );
    if (hasBeenFixed) {
      continue; // Skip this DVIR - it's been fixed
    }
    
    // Check vehicle_trailer_checklist for failures
    if (report.vehicle_trailer_checklist) {
      for (const [key, value] of Object.entries(report.vehicle_trailer_checklist)) {
        if (value === 'F') {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          if (!failures.includes(label)) {
            failures.push(label);
          }
        }
      }
    }
    // Check aerial_checklist for failures
    if (report.aerial_checklist) {
      for (const [key, value] of Object.entries(report.aerial_checklist)) {
        if (value === 'F') {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          if (!failures.includes(label)) {
            failures.push(label);
          }
        }
      }
    }
  }
  
  return failures.slice(0, 10); // Limit to top 10
}

// =============================================================================
// AI SUMMARY FUNCTIONS
// =============================================================================

/**
 * AI Summary response from edge function
 */
export interface AiSummaryResponse {
  success: boolean;
  summary: string;
  cached: boolean;
  generated_at: string;
  fallback?: boolean;
  tokens_used?: number;
  error?: string;
}

/**
 * Generate AI maintenance summary for a truck
 * Calls the Supabase Edge Function: generate-maintenance-summary
 */
export async function generateAiSummary(
  truckNumber: string,
  forceRegenerate = false
): Promise<AiSummaryResponse> {
  // Get current session for auth
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    throw new Error('Not authenticated. Please log in to generate summaries.');
  }
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }
  
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
  
  if (!response.ok) {
    throw new Error(result.error || `Failed to generate summary (${response.status})`);
  }
  
  return result;
}

/**
 * Check if AI summary is stale and should be refreshed
 * Stale if: > 7 days old OR maintenance was logged after summary generation
 */
export function isAiSummaryStale(
  summaryGeneratedAt: string | null | undefined,
  lastMaintenanceDate?: string | null
): boolean {
  if (!summaryGeneratedAt) return true;
  
  const summaryDate = new Date(summaryGeneratedAt);
  const now = new Date();
  const daysSinceGeneration = (now.getTime() - summaryDate.getTime()) / (1000 * 60 * 60 * 24);
  
  // Stale if older than 7 days
  if (daysSinceGeneration > 7) return true;
  
  // Stale if maintenance was logged after summary was generated
  if (lastMaintenanceDate) {
    const maintDate = new Date(lastMaintenanceDate);
    if (maintDate > summaryDate) return true;
  }
  
  return false;
}

// =============================================================================
// MUTATION FUNCTIONS
// =============================================================================

/**
 * Create a new maintenance log entry
 */
export async function createMaintenanceLog(
  input: CreateMaintenanceLogInput,
  userId?: string
): Promise<MaintenanceLogEntry> {
  const { data, error } = await supabase
    .from('vehicle_maintenance_log')
    .insert({
      truck_number: normalizeTruckNumber(input.truck_number),
      maintenance_type: input.maintenance_type,
      description: input.description,
      parts_used: input.parts_used || [],
      mileage_at_service: input.mileage_at_service,
      next_service_due_mileage: input.next_service_due_mileage,
      cost: input.cost,
      performed_by_user_id: userId,
      performed_by_name: input.performed_by_name,
      approved_by: input.approved_by,
      service_date: input.service_date,
      notes: input.notes,
      attachments: input.attachments || [],
      warranty_info: input.warranty_info,
    })
    .select()
    .single();
  
  if (error) {
    logger.error('Failed to create maintenance log:', error);
    throw error;
  }
  
  return data;
}

/**
 * Resolve a mileage anomaly
 */
export async function resolveAnomaly(
  anomalyId: string,
  resolutionNotes: string,
  userId?: string
): Promise<void> {
  const { error } = await supabase
    .from('mileage_anomalies')
    .update({
      resolved: true,
      resolution_notes: resolutionNotes,
      resolved_by_user_id: userId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', anomalyId);
  
  if (error) {
    logger.error('Failed to resolve anomaly:', error);
    throw error;
  }
}

/**
 * Update maintenance schedule for a truck
 */
export async function updateMaintenanceSchedule(
  truckNumber: string,
  updates: Partial<MaintenanceSchedule>
): Promise<void> {
  const { error } = await supabase
    .from('maintenance_schedules')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('truck_number', normalizeTruckNumber(truckNumber));
  
  if (error) {
    logger.error('Failed to update maintenance schedule:', error);
    throw error;
  }
}

// =============================================================================
// REACT HOOK
// =============================================================================

interface UseMaintenanceDataResult {
  // Data
  schedules: MaintenanceSchedule[];
  logs: MaintenanceLogEntry[];
  anomalies: MileageAnomaly[];
  logsCount: number;
  
  // Loading states
  isLoading: boolean;
  isLoadingLogs: boolean;
  
  // Error states
  error: string | null;
  
  // Actions
  refetchSchedules: () => Promise<void>;
  refetchLogs: (filters?: MaintenanceLogFilters, page?: number) => Promise<void>;
  refetchAnomalies: () => Promise<void>;
  createLog: (input: CreateMaintenanceLogInput) => Promise<MaintenanceLogEntry>;
  resolveAnomalyById: (id: string, notes: string) => Promise<void>;
  generateSummaryForTruck: (truckNumber: string, forceRegenerate?: boolean) => Promise<AiSummaryResponse>;
  
  // Computed data
  anomalyCountsByTruck: Record<string, number>;
}

export function useMaintenanceData(): UseMaintenanceDataResult {
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [logs, setLogs] = useState<MaintenanceLogEntry[]>([]);
  const [logsCount, setLogsCount] = useState(0);
  const [anomalies, setAnomalies] = useState<MileageAnomaly[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Compute anomaly counts by truck
  const anomalyCountsByTruck = anomalies.reduce((acc, anomaly) => {
    acc[anomaly.truck_number] = (acc[anomaly.truck_number] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const refetchSchedules = useCallback(async () => {
    try {
      const data = await fetchMaintenanceSchedules();
      setSchedules(data);
    } catch (err) {
      logger.error('Failed to fetch schedules:', err);
      setError('Failed to load maintenance schedules');
    }
  }, []);
  
  const refetchLogs = useCallback(async (filters?: MaintenanceLogFilters, page = 1) => {
    try {
      setIsLoadingLogs(true);
      const { data, count } = await fetchMaintenanceLogs(filters, page);
      setLogs(data);
      setLogsCount(count);
    } catch (err) {
      logger.error('Failed to fetch logs:', err);
      setError('Failed to load maintenance logs');
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);
  
  const refetchAnomalies = useCallback(async () => {
    try {
      const data = await fetchUnresolvedAnomalies();
      setAnomalies(data);
    } catch (err) {
      logger.error('Failed to fetch anomalies:', err);
    }
  }, []);
  
  const createLog = useCallback(async (input: CreateMaintenanceLogInput) => {
    const newLog = await createMaintenanceLog(input);
    // Refresh data after creating
    await Promise.all([refetchSchedules(), refetchLogs()]);
    return newLog;
  }, [refetchSchedules, refetchLogs]);
  
  const resolveAnomalyById = useCallback(async (id: string, notes: string) => {
    await resolveAnomaly(id, notes);
    await refetchAnomalies();
  }, [refetchAnomalies]);
  
  const generateSummaryForTruck = useCallback(async (
    truckNumber: string,
    forceRegenerate = false
  ): Promise<AiSummaryResponse> => {
    const result = await generateAiSummary(truckNumber, forceRegenerate);
    // Refresh schedules to get the updated AI summary in the data
    await refetchSchedules();
    return result;
  }, [refetchSchedules]);
  
  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([
          refetchSchedules(),
          refetchLogs(),
          refetchAnomalies(),
        ]);
      } catch (err) {
        logger.error('Failed to load initial data:', err);
        setError('Failed to load maintenance data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitialData();
  }, [refetchSchedules, refetchLogs, refetchAnomalies]);
  
  return {
    schedules,
    logs,
    anomalies,
    logsCount,
    isLoading,
    isLoadingLogs,
    error,
    refetchSchedules,
    refetchLogs,
    refetchAnomalies,
    createLog,
    resolveAnomalyById,
    generateSummaryForTruck,
    anomalyCountsByTruck,
  };
}

export default useMaintenanceData;
