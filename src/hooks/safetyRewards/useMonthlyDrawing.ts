import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';

export interface DrawingWinner {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export interface MonthlyDrawing {
  id: string;
  reward_id: string;
  month: number;
  year: number;
  grand_prize_winner: DrawingWinner | null;
  runner_up_1_winner: DrawingWinner | null;
  runner_up_2_winner: DrawingWinner | null;
  total_entries: number;
  total_participants: number;
  drawn_at: string;
  drawn_by: string | null;
}

async function fetchMonthlyDrawing(
  year: number,
  month: number,
): Promise<MonthlyDrawing | null> {
  const { data, error } = await supabase
    .from('monthly_reward_drawings')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const winnerIds = [
    data.grand_prize_winner_id,
    data.runner_up_1_winner_id,
    data.runner_up_2_winner_id,
  ].filter(Boolean) as string[];

  const winnerMap = new Map<string, { full_name: string | null; email: string | null }>();

  if (winnerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, email')
      .in('user_id', winnerIds);

    if (profiles) {
      for (const p of profiles) {
        winnerMap.set(p.user_id, { full_name: p.full_name, email: p.email });
      }
    }
  }

  function resolveWinner(userId: string | null): DrawingWinner | null {
    if (!userId) return null;
    const profile = winnerMap.get(userId);
    return {
      user_id: userId,
      full_name: profile?.full_name ?? 'Former employee',
      email: profile?.email ?? null,
    };
  }

  return {
    id: data.id,
    reward_id: data.reward_id,
    month: data.month,
    year: data.year,
    grand_prize_winner: resolveWinner(data.grand_prize_winner_id),
    runner_up_1_winner: resolveWinner(data.runner_up_1_winner_id),
    runner_up_2_winner: resolveWinner(data.runner_up_2_winner_id),
    total_entries: data.total_entries,
    total_participants: data.total_participants,
    drawn_at: data.drawn_at,
    drawn_by: data.drawn_by,
  };
}

export function useMonthlyDrawing(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.safetyRewards.drawing(year, month),
    queryFn: () => fetchMonthlyDrawing(year, month),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });
}
