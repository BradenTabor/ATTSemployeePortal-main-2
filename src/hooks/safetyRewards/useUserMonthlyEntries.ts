import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { queryKeys } from '../../lib/queryKeys';
import { calculateStreakBonuses, type StreakResult } from '../../lib/streakCalculation';
import { getNextStreakMilestone } from '../../config/safetyRewards';

export interface UserMonthlyEntries extends StreakResult {
  claimedDays: string[];
  announcementDays: string[];
  baseEntries: number;
  totalEntries: number;
  nextMilestone: { daysNeeded: number; bonusEntries: number } | null;
}

async function fetchUserMonthlyEntries(
  userId: string,
  year: number,
  month: number,
): Promise<UserMonthlyEntries> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const [claimsResult, announcementsResult] = await Promise.all([
    supabase
      .from('announcement_rewards')
      .select('claimed_at')
      .eq('user_id', userId)
      .gte('claimed_at', startDate)
      .lt('claimed_at', endDate)
      .order('claimed_at', { ascending: true }),
    supabase
      .from('announcements')
      .select('date')
      .gte('date', startDate)
      .lt('date', endDate)
      .order('date', { ascending: true }),
  ]);

  if (claimsResult.error) throw claimsResult.error;
  if (announcementsResult.error) throw announcementsResult.error;

  const claimedDays = Array.from(
    new Set(
      (claimsResult.data ?? []).map((r) => {
        const d = new Date(r.claimed_at);
        const chicago = new Date(d.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        return `${chicago.getFullYear()}-${String(chicago.getMonth() + 1).padStart(2, '0')}-${String(chicago.getDate()).padStart(2, '0')}`;
      }),
    ),
  ).sort();

  const announcementDays = Array.from(
    new Set(
      (announcementsResult.data ?? []).map((r) => r.date as string),
    ),
  ).sort();

  const streakResult = calculateStreakBonuses(claimedDays, announcementDays);
  const baseEntries = claimedDays.length;
  const nextMilestone = getNextStreakMilestone(
    streakResult.currentStreak,
    streakResult.milestonesHit,
  );

  return {
    claimedDays,
    announcementDays,
    baseEntries,
    totalEntries: baseEntries + streakResult.totalBonus,
    nextMilestone,
    ...streakResult,
  };
}

export function useUserMonthlyEntries(
  userId: string | undefined,
  year: number,
  month: number,
) {
  return useQuery({
    queryKey: queryKeys.safetyRewards.userEntries(userId ?? '', year, month),
    queryFn: () => fetchUserMonthlyEntries(userId!, year, month),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });
}
