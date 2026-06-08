import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapSeasonStandingsEntry } from '@/lib/gamification/mappers';
import type { SeasonStandingsEntry } from '@/lib/gamification/types';

export function useSeasonStandings(seasonKey: string | undefined, enabled: boolean, limit = 10) {
  return useQuery({
    queryKey: queryKeys.gamification.seasonStandings(seasonKey ?? '', limit),
    queryFn: async (): Promise<SeasonStandingsEntry[]> => {
      const { data, error } = await supabase.rpc('get_gamification_season_standings', {
        p_season_key: seasonKey,
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      const raw = data as unknown;
      const rows = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
          ? (JSON.parse(raw) as Record<string, unknown>[])
          : [];
      return rows.map((row) => mapSeasonStandingsEntry(row as Record<string, unknown>));
    },
    enabled: enabled && !!seasonKey,
    staleTime: 60_000,
  });
}
