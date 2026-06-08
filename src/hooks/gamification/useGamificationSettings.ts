import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapGamificationSettings } from '@/lib/gamification/mappers';
import type { GamificationSettings } from '@/lib/gamification/types';

const SETTINGS_KEYS = [
  'streak_milestone_weeks',
  'sharp_eye_prestige_counts',
  'cert_stacked_prestige_counts',
] as const;

export function useGamificationSettings() {
  return useQuery({
    queryKey: queryKeys.gamification.settings,
    queryFn: async (): Promise<GamificationSettings> => {
      const { data, error } = await supabase
        .from('gamification_settings')
        .select('key, value')
        .in('key', [...SETTINGS_KEYS]);
      if (error) throw new Error(error.message);
      return mapGamificationSettings(
        (data ?? []).map((r) => ({ key: r.key, value: r.value })),
      );
    },
    staleTime: 5 * 60_000,
  });
}
