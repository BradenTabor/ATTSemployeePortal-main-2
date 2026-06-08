import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapActiveSeason } from '@/lib/gamification/mappers';
import type { ActiveSeason } from '@/lib/gamification/types';

export function useActiveSeason(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.gamification.activeSeason,
    queryFn: async (): Promise<ActiveSeason | null> => {
      const { data, error } = await supabase.rpc('get_active_season');
      if (error) throw new Error(error.message);
      const rows = (data as Record<string, unknown>[] | null) ?? [];
      if (rows.length === 0) return null;
      return mapActiveSeason(rows[0]);
    },
    enabled,
    staleTime: 60_000,
  });
}
