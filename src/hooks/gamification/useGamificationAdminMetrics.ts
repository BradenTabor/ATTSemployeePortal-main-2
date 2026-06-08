import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import {
  mapBaselineCaptureResult,
  mapGamificationAdminMetrics,
} from '@/lib/gamification/mappers';
import type { BaselineCaptureResult, GamificationAdminMetrics } from '@/lib/gamification/types';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function useGamificationAdminMetrics(days = 30) {
  return useQuery({
    queryKey: queryKeys.gamification.adminMetrics(days),
    queryFn: async (): Promise<GamificationAdminMetrics> => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - days);

      const { data, error } = await supabase.rpc('get_gamification_admin_metrics', {
        p_start_date: toIsoDate(start),
        p_end_date: toIsoDate(end),
      });
      if (error) throw new Error(error.message);
      return mapGamificationAdminMetrics((data as Record<string, unknown>) ?? {});
    },
    staleTime: 60_000,
  });
}

export function useCaptureBaselineCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<BaselineCaptureResult> => {
      const { data, error } = await supabase.rpc('capture_gamification_baseline_cohort');
      if (error) throw new Error(error.message);
      return mapBaselineCaptureResult((data as Record<string, unknown>) ?? {});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.all });
    },
  });
}
