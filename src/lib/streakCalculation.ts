// KEEP IN SYNC:
// - supabase/functions/_shared/streakCalculation.ts (TS mirror for edge display)
// - public.compute_streak_milestones / compute_streak_bonus_total (authoritative SQL writer)
// TS calculateStreakBonuses is display-only post Option A cutover — not raffle odds or drawing.

export const STREAK_BONUSES = [
  { consecutiveDays: 5, bonusEntries: 2 },
  { consecutiveDays: 10, bonusEntries: 5 },
  { consecutiveDays: 0, bonusEntries: 15, fullMonth: true },
] as const;

export type StreakBonus = (typeof STREAK_BONUSES)[number];

export interface StreakResult {
  totalBonus: number;
  currentStreak: number;
  longestStreak: number;
  milestonesHit: number[];
}

/**
 * Calculate streak bonuses from claimed and announcement dates within a single month.
 *
 * @param claimedDates  Sorted ISO date strings (YYYY-MM-DD) the user claimed
 * @param announcementDates  Sorted ISO date strings of days announcements existed
 *
 * Milestones are independent and cumulative:
 *   - hitting 5 consecutive days awards +2
 *   - continuing to 10 consecutive days awards an additional +5
 *   - claiming every announcement day in the month awards an additional +15
 */
export function calculateStreakBonuses(
  claimedDates: string[],
  announcementDates: string[],
): StreakResult {
  const claimedSet = new Set(claimedDates);

  let currentStreak = 0;
  let longestStreak = 0;
  let totalBonus = 0;
  const milestonesHit: number[] = [];

  for (const date of announcementDates) {
    if (claimedSet.has(date)) {
      currentStreak++;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }

      for (const bonus of STREAK_BONUSES) {
        if ("fullMonth" in bonus && bonus.fullMonth) continue;
        if (
          currentStreak === bonus.consecutiveDays &&
          !milestonesHit.includes(bonus.consecutiveDays)
        ) {
          totalBonus += bonus.bonusEntries;
          milestonesHit.push(bonus.consecutiveDays);
        }
      }
    } else {
      currentStreak = 0;
    }
  }

  const fullMonthBonus = STREAK_BONUSES.find((b) => "fullMonth" in b && b.fullMonth);
  if (
    fullMonthBonus &&
    announcementDates.length > 0 &&
    announcementDates.every((d) => claimedSet.has(d))
  ) {
    totalBonus += fullMonthBonus.bonusEntries;
    milestonesHit.push(0);
  }

  return { totalBonus, currentStreak, longestStreak, milestonesHit };
}
