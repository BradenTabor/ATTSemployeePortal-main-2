/**
 * Shared Central <-> UTC timezone conversion utilities.
 * Uses date-fns-tz for correct DST handling.
 *
 * "Central" always means America/Chicago (CST/CDT).
 * All functions accept an optional referenceDate to anchor the DST calculation;
 * defaults to tomorrow so schedule pickers reflect the next occurrence.
 */

import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TZ = 'America/Chicago';

function defaultRef(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Convert a Central-time hour:minute to the equivalent UTC hour:minute,
 * accounting for the DST offset active on `referenceDate`.
 */
export function centralHourToUtc(
  centralHour: number,
  centralMinute = 0,
  referenceDate: Date = defaultRef(),
): { hour: number; minute: number } {
  const zoned = toZonedTime(referenceDate, TZ);
  zoned.setHours(centralHour, centralMinute, 0, 0);
  const utc = fromZonedTime(zoned, TZ);
  return { hour: utc.getUTCHours(), minute: utc.getUTCMinutes() };
}

/**
 * Convert a UTC hour:minute to the equivalent Central-time hour:minute,
 * accounting for the DST offset active on `referenceDate`.
 */
export function utcToCentralHour(
  utcHour: number,
  utcMinute = 0,
  referenceDate: Date = defaultRef(),
): { hour: number; minute: number } {
  const d = new Date(referenceDate);
  d.setUTCHours(utcHour, utcMinute, 0, 0);
  const zoned = toZonedTime(d, TZ);
  return { hour: zoned.getHours(), minute: zoned.getMinutes() };
}

/**
 * Build a cron expression from UTC hour/minute and day-of-week array.
 * Days: "mon"->1, "tue"->2, ... "sun"->0 (pg_cron uses 0-based Sun).
 */
const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export function buildCronExpression(
  utcHour: number,
  utcMinute: number,
  days: string[],
): string {
  const dayNums = days.map((d) => DAY_MAP[d.toLowerCase()] ?? 1).sort((a, b) => a - b);
  return `${utcMinute} ${utcHour} * * ${dayNums.join(',')}`;
}

/**
 * Format a 24h hour to a human-readable Central time label, e.g. "5:00 AM CT".
 */
export function formatCentralTime(hour: number, minute = 0): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const m = String(minute).padStart(2, '0');
  return `${h12}:${m} ${period} CT`;
}
