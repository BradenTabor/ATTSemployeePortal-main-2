import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapGamificationProgramSettings } from '@/lib/gamification/mappers';
import type { GamificationProgramSettings } from '@/lib/gamification/types';

const PROGRAM_KEYS = ['program_owner_user_id', 'program_backup_user_id'] as const;

export function useGamificationProgramSettings() {
  return useQuery({
    queryKey: queryKeys.gamification.programSettings,
    queryFn: async (): Promise<GamificationProgramSettings> => {
      const { data, error } = await supabase
        .from('gamification_settings')
        .select('key, value')
        .in('key', [...PROGRAM_KEYS]);
      if (error) throw new Error(error.message);
      return mapGamificationProgramSettings(
        (data ?? []).map((r) => ({ key: r.key, value: r.value })),
      );
    },
    staleTime: 5 * 60_000,
  });
}

export function useUpdateGamificationProgramSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<GamificationProgramSettings>) => {
      const updates: Array<{ key: string; value: unknown }> = [];
      if (settings.programOwnerUserId !== undefined) {
        updates.push({
          key: 'program_owner_user_id',
          value: settings.programOwnerUserId,
        });
      }
      if (settings.programBackupUserId !== undefined) {
        updates.push({
          key: 'program_backup_user_id',
          value: settings.programBackupUserId,
        });
      }

      for (const row of updates) {
        const { error } = await supabase
          .from('gamification_settings')
          .update({ value: row.value })
          .eq('key', row.key);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gamification.programSettings });
    },
  });
}
