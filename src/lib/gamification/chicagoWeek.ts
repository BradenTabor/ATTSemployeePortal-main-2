import { formatInTimeZone } from 'date-fns-tz';
import { getWeekDateRange } from '@/lib/complianceHelpers';

const TIMEZONE = 'America/Chicago';

/** Human-readable Chicago ISO week label for challenge windows. */
export function formatChicagoWeekLabel(now: Date = new Date()): string {
  const { startDate, endDate } = getWeekDateRange(now);
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const startLabel = formatInTimeZone(start, TIMEZONE, 'MMM d');
  const endLabel = formatInTimeZone(end, TIMEZONE, 'MMM d');
  return `${startLabel} – ${endLabel}`;
}

/** Compact season date range for standings header. */
export function formatSeasonDateRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const startLabel = formatInTimeZone(start, TIMEZONE, 'MMM d, yyyy');
  const endLabel = formatInTimeZone(end, TIMEZONE, 'MMM d, yyyy');
  return `${startLabel} – ${endLabel}`;
}
