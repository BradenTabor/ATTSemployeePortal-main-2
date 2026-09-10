/**
 * Chicago-timezone period windows for safety analytics.
 * Weekdays only — ATTS does not run a Saturday/Sunday safety packet.
 */

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import type { DateWindow, Period, PeriodWindows } from './types';

const TZ = 'America/Chicago';

export function chicagoToday(now: Date = new Date()): string {
  return formatInTimeZone(now, TZ, 'yyyy-MM-dd');
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function weekdayIndex(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWeekday(isoDate: string): boolean {
  const day = weekdayIndex(isoDate);
  return day !== 0 && day !== 6;
}

export function previousWeekday(isoDate: string): string {
  let cursor = addCalendarDays(isoDate, -1);
  while (!isWeekday(cursor)) {
    cursor = addCalendarDays(cursor, -1);
  }
  return cursor;
}

export function countWeekdays(start: string, end: string): number {
  if (start > end) return 0;
  let count = 0;
  let cursor = start;
  while (cursor <= end) {
    if (isWeekday(cursor)) count += 1;
    cursor = addCalendarDays(cursor, 1);
  }
  return count;
}

export function eachDate(start: string, end: string): string[] {
  if (start > end) return [];
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addCalendarDays(cursor, 1);
  }
  return dates;
}

function windowOf(start: string, end: string, label: string): DateWindow {
  return {
    start,
    end,
    weekdayCount: countWeekdays(start, end),
    label,
  };
}

/**
 * Rolling windows ending on Chicago today.
 * `all` uses `allStart` when provided (earliest data date), else 365 days back.
 */
export function getPeriodWindows(
  period: Period,
  now: Date = new Date(),
  allStart?: string | null,
): PeriodWindows {
  const end = chicagoToday(now);
  let lookback: number;
  let label: string;

  switch (period) {
    case 'week':
      lookback = 6;
      label = 'Last 7 days';
      break;
    case 'quarter':
      lookback = 89;
      label = 'Last 90 days';
      break;
    case 'all': {
      const start = allStart && allStart <= end ? allStart : addCalendarDays(end, -364);
      const days = Math.max(0, dateDiffDays(start, end));
      const prevEnd = addCalendarDays(start, -1);
      const prevStart = addCalendarDays(prevEnd, -days);
      return {
        current: windowOf(start, end, 'All time'),
        previous: windowOf(prevStart, prevEnd, 'Prior span'),
      };
    }
    case 'month':
    default:
      lookback = 29;
      label = 'Last 30 days';
      break;
  }

  const start = addCalendarDays(end, -lookback);
  const prevEnd = addCalendarDays(start, -1);
  const prevStart = addCalendarDays(prevEnd, -lookback);
  return {
    current: windowOf(start, end, label),
    previous: windowOf(prevStart, prevEnd, `Prior ${label.toLowerCase()}`),
  };
}

export function dateDiffDays(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  return Math.round((b - a) / 86_400_000);
}

export function chicagoDayOfWeek(now: Date = new Date()): number {
  return toZonedTime(now, TZ).getDay();
}

export function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
