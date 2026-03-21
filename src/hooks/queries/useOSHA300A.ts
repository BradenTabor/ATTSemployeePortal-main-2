/**
 * Hooks for OSHA 300A Annual Summary and certification.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { OSHA300ASummary, OSHA300ACertification } from '../../types/osha300a';

export function useOSHA300ASummary(year: number) {
  return useQuery({
    queryKey: queryKeys.osha300a.summary(year),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_osha_300a_summary', {
        p_year: year,
        p_total_employees_avg: null,
        p_total_hours_worked: null,
      });
      if (error) throw new Error(error.message);
      return data as OSHA300ASummary;
    },
    enabled: year > 0,
  });
}

export function useCertify300A() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      year: number;
      certified_by_name: string;
      certified_by_title: string;
      certified_at: string;
      signature: string;
      total_employees_avg: number | null;
      total_hours_worked: number | null;
      summary_data: OSHA300ASummary;
    }) => {
      const { data, error } = await supabase
        .from('osha_300a_certifications')
        .insert(payload)
        .select('id, year, certified_at')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.osha300a.all });
    },
  });
}

export function use300ACertification(year: number) {
  return useQuery({
    queryKey: queryKeys.osha300a.certification(year),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('osha_300a_certifications')
        .select('*')
        .eq('year', year)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as OSHA300ACertification | null;
    },
    enabled: year > 0,
  });
}

export function useMark300APosted(year: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postedDate: string) => {
      const { error } = await supabase
        .from('osha_300a_certifications')
        .update({ posted_date: postedDate })
        .eq('year', year);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.osha300a.all });
    },
  });
}
