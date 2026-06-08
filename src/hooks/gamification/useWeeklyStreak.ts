import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapWeeklyStreak } from '@/lib/gamification/mappers';
import type { WeeklyStreakState } from '@/lib/gamification/types';

export function useWeeklyStreak(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gamification.weeklyStreak(userId ?? ''),
    queryFn: async (): Promise<WeeklyStreakState> => {
      const { data, error } = await supabase
        .from('streak_state')
        .select('current_streak_weeks, longest_streak, freezes_remaining, last_active_week')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return mapWeeklyStreak(data as Record<string, unknown> | null);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
