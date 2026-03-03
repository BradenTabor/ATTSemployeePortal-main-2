/**
 * useDuplicateIncidentCheck - OSHA 29 CFR 1904.6 duplicate case assessment
 *
 * Checks for potential duplicate incidents within 180 days for the same employee.
 * Matches on overlapping body_parts_affected OR same injury_illness_type.
 *
 * @example
 * // Usage (for Agent 2 to integrate into IncidentLoggingModal):
 * const { checkForDuplicates, result, isChecking } = useDuplicateIncidentCheck();
 * // Call when employee and body parts are selected:
 * await checkForDuplicates({ employeeId, bodyParts, injuryType });
 */
import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { subDays } from 'date-fns';

export interface DuplicateMatch {
  id: string;
  case_number: string;
  incident_date: string;
  body_parts_affected: string[];
  injury_illness_type: string;
  severity: string;
}

export interface DuplicateCheckResult {
  hasPotentialDuplicates: boolean;
  matches: DuplicateMatch[];
}

export interface DuplicateCheckParams {
  employeeId: string;
  bodyParts: string[];
  injuryType: string;
}

export function useDuplicateIncidentCheck() {
  const [result, setResult] = useState<DuplicateCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForDuplicates = useCallback(async (params: DuplicateCheckParams) => {
    const { employeeId, bodyParts, injuryType } = params;

    if (!employeeId) {
      setResult({ hasPotentialDuplicates: false, matches: [] });
      return;
    }

    setIsChecking(true);
    setResult(null);

    try {
      const cutoff = subDays(new Date(), 180).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('safety_incidents')
        .select('id, case_number, incident_date, body_parts_affected, injury_illness_type, severity')
        .contains('involved_user_ids', [employeeId])
        .gte('incident_date', cutoff)
        .order('incident_date', { ascending: false });

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as Array<{
        id: string;
        case_number: string | null;
        incident_date: string;
        body_parts_affected: string[] | null;
        injury_illness_type: string | null;
        severity: string;
      }>;

      const matches: DuplicateMatch[] = [];

      for (const row of rows) {
        const existingParts = (row.body_parts_affected ?? []) as string[];
        const hasOverlap =
          bodyParts.length > 0 &&
          existingParts.length > 0 &&
          bodyParts.some((p) => existingParts.includes(p));
        const sameInjury =
          injuryType &&
          row.injury_illness_type &&
          injuryType === row.injury_illness_type;

        if (hasOverlap || sameInjury) {
          matches.push({
            id: row.id,
            case_number: row.case_number ?? 'N/A',
            incident_date: row.incident_date,
            body_parts_affected: existingParts,
            injury_illness_type: row.injury_illness_type ?? '',
            severity: row.severity,
          });
        }
      }

      setResult({
        hasPotentialDuplicates: matches.length > 0,
        matches,
      });
    } catch (e) {
      setResult({ hasPotentialDuplicates: false, matches: [] });
      throw e;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return { checkForDuplicates, result, isChecking, clearResult };
}
