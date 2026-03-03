import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { MonthlyReward } from './useMonthlyReward';

async function fetchAllMonthlyRewards(): Promise<MonthlyReward[]> {
  const { data, error } = await supabase
    .from('monthly_safety_rewards')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useAllMonthlyRewards() {
  return useQuery({
    queryKey: queryKeys.safetyRewards.allRewards,
    queryFn: fetchAllMonthlyRewards,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}
