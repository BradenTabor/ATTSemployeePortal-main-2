import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapWelcomeResult } from '@/lib/gamification/mappers';
import type { WelcomeGamificationResult } from '@/lib/gamification/types';
import { useAuth } from '@/contexts/AuthContext';

export function useWelcomeGamification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<WelcomeGamificationResult> => {
      const { data, error } = await supabase.rpc('welcome_gamification');
      if (error) throw new Error(error.message);
      return mapWelcomeResult((data ?? {}) as Record<string, unknown>);
    },
    onSuccess: () => {
      if (!user?.id) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.gamification.level(user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.gamification.userBadges(user.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.gamification.weeklyStreak(user.id) });
    },
  });
}
