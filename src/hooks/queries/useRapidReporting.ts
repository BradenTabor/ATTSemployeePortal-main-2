/**
 * useRapidReporting - React Query hook for OSHA rapid-reporting countdown
 *
 * OSHA 29 CFR 1904.39: Fatality within 8 hours; hospitalization/amputation/eye loss within 24 hours.
 * Queries unreported OSHA events, computes elapsed/remaining time, and provides mark-as-reported mutation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Chicago';

export interface RapidReportingEvent {
  id: string;
  case_number: string;
  severity: string;
  reported_at: string;
  osha_reported: boolean;
  osha_report_date: string | null;
  deadline_hours: number;
  elapsed_hours: number;
  remaining_hours: number;
  urgency: 'green' | 'yellow' | 'red' | 'overdue';
}

interface RawIncident {
  id: string;
  case_number: string | null;
  severity: string;
  reported_at: string;
  osha_reported: boolean | null;
  osha_report_date: string | null;
  hospitalized_overnight: boolean | null;
}

function getDeadlineHours(incident: RawIncident): number {
  if (incident.severity === 'fatality') return 8;
  return 24; // hospitalization, amputation, eye loss
}

function computeElapsedHours(reportedAt: string): number {
  const reported = toZonedTime(new Date(reportedAt), TIMEZONE);
  const now = toZonedTime(new Date(), TIMEZONE);
  return (now.getTime() - reported.getTime()) / (1000 * 60 * 60);
}

function computeUrgency(
  remainingHours: number,
  deadlineHours: number
): RapidReportingEvent['urgency'] {
  if (remainingHours <= 0) return 'overdue';
  const pctRemaining = remainingHours / deadlineHours;
  if (pctRemaining > 0.5) return 'green';
  if (pctRemaining >= 0.25) return 'yellow';
  return 'red';
}

function toRapidReportingEvent(incident: RawIncident): RapidReportingEvent {
  const deadlineHours = getDeadlineHours(incident);
  const elapsedHours = computeElapsedHours(incident.reported_at);
  const actualRemaining = deadlineHours - elapsedHours;
  const urgency = computeUrgency(actualRemaining, deadlineHours);

  return {
    id: incident.id,
    case_number: incident.case_number ?? 'N/A',
    severity: incident.severity,
    reported_at: incident.reported_at,
    osha_reported: incident.osha_reported ?? false,
    osha_report_date: incident.osha_report_date,
    deadline_hours: deadlineHours,
    elapsed_hours: elapsedHours,
    remaining_hours: Math.max(0, actualRemaining),
    urgency,
  };
}

/** Filter to incidents requiring rapid reporting: fatality (8hr) or hospitalization/amputation/eye (24hr) */
function requiresRapidReporting(incident: RawIncident): boolean {
  if (incident.severity === 'fatality') return true;
  if (incident.hospitalized_overnight === true) return true;
  return false;
}

export function useUnreportedOshaEvents() {
  return useQuery({
    queryKey: queryKeys.rapidReporting,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_incidents')
        .select('id, case_number, severity, reported_at, osha_reported, osha_report_date, hospitalized_overnight')
        .eq('osha_reportable', true)
        .eq('osha_reported', false);

      if (error) throw new Error(error.message);

      const raw = (data ?? []) as RawIncident[];
      const rapid = raw.filter(requiresRapidReporting).map(toRapidReportingEvent);
      return rapid;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

export function useMarkAsReported() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase
        .from('safety_incidents')
        .update({
          osha_reported: true,
          osha_report_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString(),
        })
        .eq('id', incidentId);

      if (error) throw new Error(error.message);
      return { incidentId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rapidReporting });
      queryClient.invalidateQueries({ queryKey: queryKeys.safetyIncidents.all });
    },
  });
}
