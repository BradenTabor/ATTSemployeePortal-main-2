/**
 * useBriefingCompliance – React Query hook for briefing compliance dashboard.
 * Wraps get_briefing_compliance_summary RPC.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";

export interface BriefingComplianceRow {
  user_id: string;
  full_name: string | null;
  role: string | null;
  crew_name: string | null;
  supervisor_name: string | null;
  briefing_date: string;
  completed: boolean;
  reward_claimed: boolean;
  suppressed: boolean;
  suppression_reason: string | null;
}

export function useBriefingCompliance(startDate: string, endDate: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.briefingCompliance.summary(startDate, endDate),
    queryFn: async (): Promise<BriefingComplianceRow[]> => {
      const { data, error } = await supabase.rpc("get_briefing_compliance_summary", {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        user_id: row.user_id as string,
        full_name: (row.full_name as string) ?? null,
        role: (row.role as string) ?? null,
        crew_name: (row.crew_name as string) ?? null,
        supervisor_name: (row.supervisor_name as string) ?? null,
        briefing_date: String(row.briefing_date).slice(0, 10),
        completed: Boolean(row.completed),
        reward_claimed: Boolean(row.reward_claimed),
        suppressed: Boolean(row.suppressed),
        suppression_reason: (row.suppression_reason as string) ?? null,
      }));
    },
    enabled: enabled && !!startDate && !!endDate,
    staleTime: 1000 * 60 * 2,
  });
}
