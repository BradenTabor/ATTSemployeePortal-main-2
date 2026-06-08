import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapPublicProfile, mapStandingsEntry } from '@/lib/gamification/mappers';
import type { GamificationStandingsEntry, PublicGamificationProfile } from '@/lib/gamification/types';

export function useGamificationStandings(limit = 25) {
  return useQuery({
    queryKey: queryKeys.gamification.standings(limit),
    queryFn: async (): Promise<GamificationStandingsEntry[]> => {
      const { data, error } = await supabase.rpc('get_gamification_standings', {
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      const rows = (data as Record<string, unknown>[] | null) ?? [];
      return rows.map(mapStandingsEntry);
    },
    staleTime: 60_000,
  });
}

export function usePublicGamificationProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gamification.publicProfile(userId ?? ''),
    queryFn: async (): Promise<PublicGamificationProfile | null> => {
      const { data, error } = await supabase.rpc('get_public_gamification_profile', {
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      if (!data) return null;
      return mapPublicProfile(data as Record<string, unknown>);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
