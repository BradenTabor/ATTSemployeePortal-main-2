import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';

export interface MonthlyReward {
  id: string;
  month: number;
  year: number;
  grand_prize_name: string;
  grand_prize_description: string | null;
  grand_prize_image_url: string | null;
  runner_up_1_name: string | null;
  runner_up_1_description: string | null;
  runner_up_1_image_url: string | null;
  runner_up_2_name: string | null;
  runner_up_2_description: string | null;
  runner_up_2_image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchMonthlyReward(
  year: number,
  month: number,
): Promise<MonthlyReward | null> {
  const { data, error } = await supabase
    .from('monthly_safety_rewards')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function useMonthlyReward(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.safetyRewards.reward(year, month),
    queryFn: () => fetchMonthlyReward(year, month),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });
}
