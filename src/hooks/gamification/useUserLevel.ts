import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { queryKeys } from '@/lib/queryKeys';
import { mapUserLevel } from '@/lib/gamification/mappers';
import type { UserLevel } from '@/lib/gamification/types';

export function useUserLevel(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gamification.level(userId ?? ''),
    queryFn: async (): Promise<UserLevel> => {
      const { data, error } = await supabase.rpc('get_user_level', {
        target_user_id: userId,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('No level data returned');
      return mapUserLevel(row as Record<string, unknown>);
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
