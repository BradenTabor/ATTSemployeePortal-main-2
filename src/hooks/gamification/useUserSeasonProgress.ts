import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import type { UserSeasonProgress } from '@/lib/gamification/types';

export function useUserSeasonProgress(
  userId: string | undefined,
  seasonKey: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.gamification.userSeasonProgress(userId ?? '', seasonKey ?? ''),
    queryFn: async (): Promise<UserSeasonProgress> => {
      const [scoreRes, deltaRes] = await Promise.all([
        supabase.rpc('get_user_season_score', {
          p_user_id: userId,
          p_season_key: seasonKey,
        }),
        supabase.rpc('get_user_season_improvement_delta', {
          p_user_id: userId,
          p_season_key: seasonKey,
        }),
      ]);

      if (scoreRes.error) throw new Error(scoreRes.error.message);
      if (deltaRes.error) throw new Error(deltaRes.error.message);

      return {
        seasonScore: Number(scoreRes.data ?? 0),
        improvementDelta: Number(deltaRes.data ?? 0),
      };
    },
    enabled: enabled && !!userId && !!seasonKey,
    staleTime: 60_000,
  });
}
