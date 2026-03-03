import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';

export interface MonthlyRaffleStats {
  totalParticipants: number;
  totalClaims: number;
}

async function fetchTotalMonthlyEntries(
  year: number,
  month: number,
): Promise<MonthlyRaffleStats> {
  const { data, error } = await supabase.rpc('get_monthly_raffle_stats', {
    p_year: year,
    p_month: month,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalParticipants: Number(row?.total_participants ?? 0),
    totalClaims: Number(row?.total_claim_count ?? 0),
  };
}

export function useTotalMonthlyEntries(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.safetyRewards.totalEntries(year, month),
    queryFn: () => fetchTotalMonthlyEntries(year, month),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });
}
