export {
  STREAK_BONUSES,
  calculateStreakBonuses,
  type StreakBonus,
  type StreakResult,
} from '../lib/streakCalculation';

export { FIELD_ROLES, isFieldRole } from './safetyBriefing';

export function getNextStreakMilestone(
  currentStreak: number,
  milestonesHit: number[],
): { daysNeeded: number; bonusEntries: number } | null {
  const milestones = [
    { consecutiveDays: 5, bonusEntries: 2 },
    { consecutiveDays: 10, bonusEntries: 5 },
  ];

  for (const m of milestones) {
    if (!milestonesHit.includes(m.consecutiveDays) && currentStreak < m.consecutiveDays) {
      return {
        daysNeeded: m.consecutiveDays - currentStreak,
        bonusEntries: m.bonusEntries,
      };
    }
  }
  return null;
}
