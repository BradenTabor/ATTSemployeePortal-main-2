import { describe, it, expect } from 'vitest';
import { calculateStreakBonuses } from '@/lib/streakCalculation';

/** Gate fixture mirrors (F1–F5 + F6 adversarial) — expected totals hand-verified vs SQL compute_streak_bonus_total */
describe('calculateStreakBonuses gate fixtures', () => {
  const ann = (...days: number[]) => days.map((d) => `2026-06-${String(d).padStart(2, '0')}`);

  it('F1 clean 5: +2 only (day 6 unclaimed → no full month)', () => {
    const announcements = ann(1, 2, 3, 4, 5, 6);
    const claimed = ann(1, 2, 3, 4, 5);
    expect(calculateStreakBonuses(claimed, announcements).totalBonus).toBe(2);
  });

  it('F2 gap rebuild: +2 once; tail streak 4', () => {
    const announcements = ann(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    const claimed = [...ann(1, 2, 3, 4, 5), ...ann(7, 8, 9, 10)];
    expect(calculateStreakBonuses(claimed, announcements).totalBonus).toBe(2);
  });

  it('F3 clean 10: +2 and +5; day 11 unclaimed', () => {
    const announcements = ann(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11);
    const claimed = ann(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    expect(calculateStreakBonuses(claimed, announcements).totalBonus).toBe(7);
  });

  it('F4 full month: +2 +5 +15', () => {
    const announcements = ann(...Array.from({ length: 20 }, (_, i) => i + 1));
    const claimed = [...announcements];
    expect(calculateStreakBonuses(claimed, announcements).totalBonus).toBe(22);
  });

  it('F5 full month short: +15 only (streak 4)', () => {
    const announcements = ann(1, 2, 3, 4);
    const claimed = [...announcements];
    expect(calculateStreakBonuses(claimed, announcements).totalBonus).toBe(15);
  });

  it('F6 adversarial matches F2', () => {
    const announcements = ann(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    const claimed = [...ann(1, 2, 3, 4, 5), ...ann(7, 8, 9, 10)];
    expect(calculateStreakBonuses(claimed, announcements).totalBonus).toBe(2);
  });
});
