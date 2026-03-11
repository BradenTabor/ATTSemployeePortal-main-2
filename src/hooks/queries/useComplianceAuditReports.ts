/**
 * React Query hooks for Compliance Audit report RPCs.
 * Replaces direct supabase.rpc() in AdminComplianceAudit.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';

export interface ComplianceSummaryRow {
  date: string;
  dvir_count: number;
  dvir_users: number;
  equipment_count: number;
  equipment_users: number;
  jsa_count: number;
  jsa_users: number;
}

export interface IncidentLogRow {
  case_number: string | null;
  incident_date: string;
  incident_time: string | null;
  employee_name: string | null;
  employee_job_title: string | null;
  work_site_name: string | null;
  description: string | null;
  what_doing_before: string | null;
  object_substance_harmed: string | null;
  body_parts_affected: string | null;
  injury_illness_type: string | null;
  severity: string | null;
  days_away_from_work: number | null;
  days_restricted_duty: number | null;
  emergency_room_treatment: string | boolean | null;
  hospitalized_overnight: string | boolean | null;
  physician_name: string | null;
  treatment_facility: string | null;
  time_began_work: string | null;
  employee_hire_date: string | null;
  osha_reportable: string | boolean | null;
  osha_reported: string | boolean | null;
  osha_report_date: string | null;
  job_name: string | null;
  crew_name: string | null;
  supervisor_name: string | null;
  corrective_actions_taken: string | null;
  corrective_actions_at: string | null;
  reported_at: string | null;
}

function normalizeIncidentRow(row: Record<string, unknown>): IncidentLogRow {
  return {
    ...row,
    incident_date: row.incident_date != null ? String(row.incident_date).slice(0, 10) : '',
    incident_time: row.incident_time != null ? String(row.incident_time) : null,
    time_began_work: row.time_began_work != null ? String(row.time_began_work) : null,
    employee_hire_date: row.employee_hire_date != null ? String(row.employee_hire_date).slice(0, 10) : null,
    osha_report_date: row.osha_report_date != null ? String(row.osha_report_date).slice(0, 10) : null,
    corrective_actions_at: row.corrective_actions_at != null ? String(row.corrective_actions_at) : null,
    reported_at: row.reported_at != null ? String(row.reported_at) : null,
  } as IncidentLogRow;
}

export function useComplianceSummaryByDay(
  dateFrom: string,
  dateTo: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: queryKeys.complianceAudit.summaryByDay(dateFrom, dateTo),
    queryFn: async (): Promise<ComplianceSummaryRow[]> => {
      const { data, error } = await supabase.rpc('get_compliance_summary_by_day', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: { date: string } & Record<string, number>) => ({
        ...row,
        date: String(row.date).slice(0, 10),
      })) as ComplianceSummaryRow[];
    },
    enabled: enabled && !!dateFrom && !!dateTo,
    staleTime: 60 * 1000,
  });
}

export function useIncidentLogOsha300301(
  dateFrom: string,
  dateTo: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: queryKeys.complianceAudit.incidentLogOsha(dateFrom, dateTo),
    queryFn: async (): Promise<IncidentLogRow[]> => {
      const { data, error } = await supabase.rpc('get_incident_log_osha_300_301', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map(normalizeIncidentRow) as IncidentLogRow[];
    },
    enabled: enabled && !!dateFrom && !!dateTo,
    staleTime: 60 * 1000,
  });
}
