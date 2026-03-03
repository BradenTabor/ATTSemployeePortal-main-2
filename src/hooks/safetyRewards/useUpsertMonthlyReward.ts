import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import type { MonthlyReward } from './useMonthlyReward';

export type UpsertRewardInput = Omit<
  MonthlyReward,
  'id' | 'created_by' | 'created_at' | 'updated_at'
> & { id?: string };

async function upsertMonthlyReward(input: UpsertRewardInput): Promise<MonthlyReward> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    ...input,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from('monthly_safety_rewards')
    .upsert(payload, { onConflict: 'year,month' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function useUpsertMonthlyReward() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: upsertMonthlyReward,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.safetyRewards.allRewards });
      qc.invalidateQueries({
        queryKey: queryKeys.safetyRewards.reward(data.year, data.month),
      });
    },
  });
}
