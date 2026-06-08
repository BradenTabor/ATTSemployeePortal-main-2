import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapPhase2GamificationFlags } from '@/lib/gamification/mappers';
import type { Phase2GamificationFlags } from '@/lib/gamification/types';

const PHASE2_FLAG_KEYS = ['phase2_enabled', 'seasons_enabled', 'challenges_enabled'] as const;

const DEFAULT_FLAGS: Phase2GamificationFlags = {
  phase2Enabled: false,
  seasonsEnabled: false,
  challengesEnabled: false,
  showChallenges: false,
  showSeasons: false,
};

/** Player-facing Phase 2 flags — reads gamification_settings directly, not admin RPC. */
export function usePhase2GamificationFlags() {
  return useQuery({
    queryKey: queryKeys.gamification.phase2Flags,
    queryFn: async (): Promise<Phase2GamificationFlags> => {
      const { data, error } = await supabase
        .from('gamification_settings')
        .select('key, value')
        .in('key', [...PHASE2_FLAG_KEYS]);
      if (error) throw new Error(error.message);
      return mapPhase2GamificationFlags(
        (data ?? []).map((r) => ({ key: r.key, value: r.value })),
      );
    },
    staleTime: 60_000,
    placeholderData: DEFAULT_FLAGS,
  });
}
