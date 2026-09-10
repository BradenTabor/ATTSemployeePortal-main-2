import { isWeekday, previousWeekday } from './dates';

/**
 * Current streak: consecutive weekdays ending at `asOf` (or the last weekday
 * on/before `asOf`) that appear in `fullPacketDates`.
 * Weekends are skipped. A missing weekday breaks the streak.
 */
export function currentWeekdayStreak(fullPacketDates: Iterable<string>, asOf: string): number {
  const set = new Set(fullPacketDates);
  let cursor = isWeekday(asOf) ? asOf : previousWeekday(asOf);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = previousWeekday(cursor);
    if (streak > 400) break;
  }
  return streak;
}

/** Longest run of consecutive weekdays in `fullPacketDates`. */
export function longestWeekdayStreak(fullPacketDates: Iterable<string>): number {
  const dates = Array.from(new Set(fullPacketDates)).filter(isWeekday).sort();
  if (dates.length === 0) return 0;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i += 1) {
    const expected = previousWeekday(dates[i]);
    if (expected === dates[i - 1]) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}
