import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapActiveChallenge } from '@/lib/gamification/mappers';
import type { ActiveChallenge } from '@/lib/gamification/types';

export function useActiveChallenge(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.gamification.activeChallenge(userId ?? ''),
    queryFn: async (): Promise<ActiveChallenge | null> => {
      const { data: activeRows, error: activeError } = await supabase.rpc(
        'get_active_challenge_for_activity',
        { p_activity_at: new Date().toISOString() },
      );
      if (activeError) throw new Error(activeError.message);

      const active = ((activeRows as Record<string, unknown>[] | null) ?? [])[0];
      if (!active) return null;

      const challengeKey = String(active.challenge_key ?? '');
      const windowKey = String(active.window_key ?? '');

      const [{ data: challengeRow, error: challengeError }, { data: completions, error: completionError }] =
        await Promise.all([
          supabase
            .from('challenges')
            .select('challenge_key, title, description, reward_spec, cadence')
            .eq('challenge_key', challengeKey)
            .maybeSingle(),
          supabase
            .from('challenge_completions')
            .select('id')
            .eq('user_id', userId!)
            .eq('challenge_key', challengeKey)
            .eq('window_key', windowKey)
            .limit(1),
        ]);

      if (challengeError) throw new Error(challengeError.message);
      if (completionError) throw new Error(completionError.message);
      if (!challengeRow) return null;

      return mapActiveChallenge(
        active,
        challengeRow as Record<string, unknown>,
        (completions ?? []).length > 0,
      );
    },
    enabled: enabled && !!userId,
    staleTime: 60_000,
  });
}
