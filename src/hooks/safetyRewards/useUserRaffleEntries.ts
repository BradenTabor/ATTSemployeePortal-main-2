import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';

async function fetchUserRaffleEntries(
  userId: string,
  year: number,
  month: number,
): Promise<number> {
  const { data, error } = await supabase.rpc('get_user_raffle_entries', {
    target_user_id: userId,
    p_year: year,
    p_month: month,
  });

  if (error) throw error;
  return Number(data ?? 0);
}

export function useUserRaffleEntries(
  userId: string | undefined,
  year: number,
  month: number,
) {
  return useQuery({
    queryKey: queryKeys.safetyRewards.userRaffleEntries(userId ?? '', year, month),
    queryFn: () => fetchUserRaffleEntries(userId!, year, month),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}
