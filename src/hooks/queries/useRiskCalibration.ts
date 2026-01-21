/**
 * useRiskCalibration - React Query hooks for the Risk Calibration Dashboard
 * 
 * Provides hooks for:
 * - Auto-tuning configuration
 * - Accuracy statistics
 * - Tuning decisions/timeline
 * - Risk score history
 * - Safety incidents
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface AutoTuningConfig {
  id: string;
  enabled: boolean;
  min_accuracy_threshold: number;
  rollback_threshold: number;
  max_multiplier_increase: number;
  max_multiplier_decrease: number;
  max_adjustments_per_run: number;
  evaluation_period_days: number;
  min_sample_size: number;
  rollback_evaluation_days: number;
  last_updated_at: string;
}

export interface TuningDecision {
  id: string;
  tuning_run_id: string | null;
  decision_type: 'adjustment' | 'activation' | 'rollback' | 'no_action' | 'disabled';
  decision_maker: 'auto_tuner' | 'admin' | 'rollback_checker';
  factor_adjusted: string | null;
  old_value: number | null;
  new_value: number | null;
  adjustment_reason: string | null;
  supporting_metrics: Record<string, unknown> | null;
  confidence_score: number | null;
  decision_at: string;
  admin_user_id: string | null;
}

export interface TuningRun {
  id: string;
  config_version: string;
  previous_version: string | null;
  started_at: string;
  completed_at: string | null;
  days_elapsed: number;
  total_predictions: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  true_negatives: number;
  current_accuracy: number | null;
  baseline_accuracy: number | null;
  improvement_delta: number | null;
  status: 'running' | 'completed' | 'rolled_back' | 'failed';
  decision_reason: string | null;
  auto_approved: boolean;
  triggered_by: 'auto' | 'manual' | 'scheduled';
}

export interface AccuracyStats {
  total_days: number;
  high_risk_predicted: number;
  incidents_occurred: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  true_negatives: number;
  accuracy_rate: number | null;
}

export interface RiskScoreHistory {
  id: string;
  date_for: string;
  work_site_id: string | null;
  work_site_name: string | null;
  total_score: number;
  risk_level: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  weather_factors: Record<string, unknown>;
  crew_factors: Record<string, unknown>;
  equipment_factors: Record<string, unknown>;
  temporal_factors: Record<string, unknown>;
  top_drivers: string[];
  recommendations: string[];
  algorithm_version: string;
  created_at: string;
}

export interface SafetyIncident {
  id: string;
  case_number: string | null;
  
  // Basic Information
  incident_date: string;
  incident_time: string | null;
  work_site_id: string | null;
  work_site_name: string | null;
  
  // Classification
  severity: 'near_miss' | 'first_aid' | 'recordable' | 'lost_time' | 'fatality';
  incident_type: string;
  injury_illness_type: string | null;
  
  // Narrative
  description: string;
  what_doing_before: string | null;
  object_substance_harmed: string | null;
  body_parts_affected: string[] | null;
  
  // Days Tracking
  days_away_from_work: number | null;
  days_restricted_duty: number | null;
  
  // Medical Treatment
  emergency_room_treatment: boolean | null;
  hospitalized_overnight: boolean | null;
  physician_name: string | null;
  treatment_facility: string | null;
  
  // Employee Information
  involved_user_ids: string[];
  employee_job_title: string | null;
  employee_hire_date: string | null;
  time_began_work: string | null;
  experience_levels: string[] | null;
  
  // Internal Tracking
  contributing_factors: string[];
  preventable: boolean;
  weather_conditions: Record<string, unknown> | null;
  
  // OSHA Tracking
  osha_reportable: boolean | null;
  osha_reported: boolean | null;
  osha_report_date: string | null;
  
  // Risk Calibration Links
  predicted_risk_score_id: string | null;
  was_forecasted_high_risk: boolean;
  
  // Audit Fields
  reported_by: string | null;
  reported_at: string;
  updated_at: string;
}

export interface AlgorithmConfig {
  id: string;
  version: string;
  is_active: boolean;
  wind_threshold_mph: number;
  wind_multiplier_per_mph: number;
  heat_index_moderate_threshold: number;
  heat_index_extreme_threshold: number;
  heat_moderate_multiplier: number;
  heat_extreme_multiplier: number;
  monday_multiplier: number;
  post_holiday_multiplier: number;
  // ... other fields
  created_at: string;
  notes: string | null;
}

export interface IncidentFormData {
  // Basic Information
  incident_date: string;
  incident_time: string | null;  // OSHA 301: Time of incident (HH:MM)
  work_site_id: string | null;
  work_site_name: string | null;
  
  // Classification (OSHA 300)
  severity: 'near_miss' | 'first_aid' | 'recordable' | 'lost_time' | 'fatality';
  incident_type: string;
  injury_illness_type: 'injury' | 'skin_disorder' | 'respiratory' | 'poisoning' | 'hearing_loss' | 'other_illness';
  
  // Narrative (OSHA 300/301)
  description: string;
  what_doing_before: string;           // OSHA 301: Activity before incident
  object_substance_harmed: string;     // OSHA 301: What directly caused harm
  body_parts_affected: string[];       // OSHA 300: Body part(s) affected
  
  // Days Tracking (OSHA 300)
  days_away_from_work: number | null;        // Calendar days away
  days_restricted_duty: number | null;       // Calendar days restricted/transferred
  
  // Medical Treatment (OSHA 301)
  emergency_room_treatment: boolean;   // Was treated in ER?
  hospitalized_overnight: boolean;     // Triggers 24-hour OSHA reporting
  physician_name: string | null;       // Healthcare provider
  treatment_facility: string | null;   // Hospital/clinic name
  
  // Employee Information (OSHA 300/301)
  involved_user_ids: string[];
  employee_job_title: string | null;   // OSHA 300: Required for recordable
  employee_hire_date: string | null;   // OSHA 301: Required
  time_began_work: string | null;      // OSHA 301: Time started work that day
  
  // Internal Use
  contributing_factors: string[];
  preventable: boolean;
  
  // OSHA Tracking
  case_number: string | null;          // OSHA 300: Unique case identifier
  osha_reportable: boolean;            // Requires OSHA notification?
  osha_reported: boolean;              // Has been reported to OSHA?
  osha_report_date: string | null;     // When reported to OSHA
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Fetch auto-tuning configuration
 */
export function useAutoTuningConfig() {
  return useQuery({
    queryKey: queryKeys.riskCalibration.autoTuningConfig,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_tuning_config')
        .select('*')
        .single();
      
      if (error) throw new Error(error.message);
      return data as AutoTuningConfig;
    },
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Toggle auto-tuning enabled/disabled
 */
export function useToggleAutoTuning() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('auto_tuning_config')
        .update({ 
          enabled, 
          last_updated_at: new Date().toISOString() 
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');
      
      if (error) throw new Error(error.message);
      return { enabled };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.riskCalibration.autoTuningConfig 
      });
    },
  });
}

/**
 * Fetch recent tuning decisions (timeline)
 */
export function useRecentTuningDecisions(limit: number = 10) {
  return useQuery({
    queryKey: queryKeys.riskCalibration.tuningDecisions(limit),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tuning_decisions_log')
        .select('*')
        .order('decision_at', { ascending: false })
        .limit(limit);
      
      if (error) throw new Error(error.message);
      return data as TuningDecision[];
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refresh every minute
  });
}

/**
 * Fetch tuning runs
 */
export function useTuningRuns() {
  return useQuery({
    queryKey: queryKeys.riskCalibration.tuningRuns,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('algorithm_tuning_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);
      
      if (error) throw new Error(error.message);
      return data as TuningRun[];
    },
    staleTime: 1000 * 60,
  });
}

/**
 * Fetch accuracy statistics for a given number of days
 */
export function useAccuracyStats(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.riskCalibration.accuracyStats(days),
    queryFn: async () => {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      
      const { data, error } = await supabase
        .rpc('calculate_prediction_accuracy', {
          p_start_date: startDate,
          p_end_date: endDate,
        });
      
      if (error) throw new Error(error.message);
      return (data?.[0] || {
        total_days: 0,
        high_risk_predicted: 0,
        incidents_occurred: 0,
        true_positives: 0,
        false_positives: 0,
        false_negatives: 0,
        true_negatives: 0,
        accuracy_rate: null,
      }) as AccuracyStats;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch risk score history for a date range
 */
export function useRiskScoreHistory(dateRange: { start: string; end: string }) {
  return useQuery({
    queryKey: queryKeys.riskCalibration.riskHistory(dateRange),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_score_history')
        .select('*')
        .gte('date_for', dateRange.start)
        .lte('date_for', dateRange.end)
        .order('date_for', { ascending: true });
      
      if (error) throw new Error(error.message);
      return data as RiskScoreHistory[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch active algorithm configuration
 */
export function useActiveAlgorithmConfig() {
  return useQuery({
    queryKey: queryKeys.riskCalibration.activeConfig,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_algorithm_config')
        .select('*')
        .eq('is_active', true)
        .single();
      
      if (error) throw new Error(error.message);
      return data as AlgorithmConfig;
    },
    staleTime: 1000 * 60,
  });
}

/**
 * Fetch safety incidents for a date range
 */
export function useSafetyIncidents(dateRange: { start: string; end: string }) {
  return useQuery({
    queryKey: queryKeys.safetyIncidents.list(dateRange),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_incidents')
        .select('*')
        .gte('incident_date', dateRange.start)
        .lte('incident_date', dateRange.end)
        .order('incident_date', { ascending: false });
      
      if (error) throw new Error(error.message);
      return data as SafetyIncident[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Generate OSHA-compliant case number (YYYY-###)
 */
async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  
  // Get count of incidents this year
  const { count } = await supabase
    .from('safety_incidents')
    .select('*', { count: 'exact', head: true })
    .gte('incident_date', `${year}-01-01`)
    .lte('incident_date', `${year}-12-31`);
  
  const nextNumber = (count || 0) + 1;
  return `${year}-${String(nextNumber).padStart(3, '0')}`;
}

/**
 * Determine if incident requires OSHA reporting (within 8-24 hours)
 */
function determineOshaReportable(incident: IncidentFormData): boolean {
  // Fatality requires 8-hour reporting
  if (incident.severity === 'fatality') return true;
  
  // Hospitalization, amputation, loss of eye require 24-hour reporting
  if (incident.hospitalized_overnight) return true;
  
  // Lost time and recordable incidents go on OSHA 300 log
  if (['recordable', 'lost_time'].includes(incident.severity)) return true;
  
  return false;
}

/**
 * Log a new safety incident
 */
export function useLogIncident() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (incident: IncidentFormData) => {
      // Generate case number for recordable incidents
      let caseNumber = incident.case_number;
      if (!caseNumber && ['recordable', 'lost_time', 'fatality'].includes(incident.severity)) {
        caseNumber = await generateCaseNumber();
      }
      
      // Determine if OSHA reportable
      const oshaReportable = determineOshaReportable(incident);
      
      // Find matching risk prediction for auto-linking
      const { data: riskScore } = await supabase
        .from('risk_score_history')
        .select('id, risk_level')
        .eq('date_for', incident.incident_date)
        .eq('work_site_id', incident.work_site_id)
        .maybeSingle();
      
      const wasHighRisk = riskScore && 
        ['HIGH', 'CRITICAL', 'ELEVATED'].includes(riskScore.risk_level);
      
      const { data, error } = await supabase
        .from('safety_incidents')
        .insert({
          ...incident,
          case_number: caseNumber,
          osha_reportable: oshaReportable,
          predicted_risk_score_id: riskScore?.id || null,
          was_forecasted_high_risk: wasHighRisk || false,
        })
        .select('id, case_number, osha_reportable')
        .single();
      
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.safetyIncidents.all });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.riskCalibration.accuracyStats(30) 
      });
    },
  });
}

/**
 * Invalidate all risk calibration queries
 */
export function useInvalidateRiskCalibration() {
  const queryClient = useQueryClient();
  
  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['riskCalibration'] });
    queryClient.invalidateQueries({ queryKey: ['safetyIncidents'] });
  }, [queryClient]);
}
