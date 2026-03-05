import {
  format,
  formatDistance,
  differenceInDays,
  isToday,
  isTomorrow,
  isYesterday,
  isPast,
  isFuture,
  addDays,
  subDays,
  startOfDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWeekend,
  parseISO,
} from 'date-fns';

/**
 * Format date for display
 * @example formatDate('2025-12-05') => 'Dec 5, 2025'
 */
export function formatDate(date: string | Date, formatStr = 'MMM d, yyyy'): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(parsed, formatStr);
}

/**
 * Format date and time
 * @example formatDateTime('2025-12-05T14:30:00') => 'Dec 5, 2025 at 2:30 PM'
 */
export function formatDateTime(date: string | Date): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(parsed, "MMM d, yyyy 'at' h:mm a");
}

/**
 * Format time only
 * @example formatTime('2025-12-05T14:30:00') => '2:30 PM'
 */
export function formatTime(date: string | Date): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(parsed, 'h:mm a');
}

/**
 * Get relative time
 * @example getRelativeTime('2025-12-03') => '2 days ago'
 */
export function getRelativeTime(date: string | Date): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return formatDistance(parsed, new Date(), { addSuffix: true });
}

/**
 * Get days between two dates
 */
export function getDaysBetween(start: string | Date, end: string | Date): number {
  const startParsed = typeof start === 'string' ? parseISO(start) : start;
  const endParsed = typeof end === 'string' ? parseISO(end) : end;
  return differenceInDays(endParsed, startParsed);
}

/**
 * Check if date is in the past
 */
export function isDatePast(date: string | Date): boolean {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return isPast(startOfDay(parsed));
}

/**
 * Check if date is in the future
 */
export function isDateFuture(date: string | Date): boolean {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return isFuture(startOfDay(parsed));
}

/**
 * Get a friendly date label
 * @example getFriendlyDate('2025-12-05') => 'Today' | 'Tomorrow' | 'Yesterday' | 'Dec 5'
 */
export function getFriendlyDate(date: string | Date): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date;

  if (isToday(parsed)) return 'Today';
  if (isTomorrow(parsed)) return 'Tomorrow';
  if (isYesterday(parsed)) return 'Yesterday';

  return format(parsed, 'MMM d');
}

/**
 * Format a date range
 * @example formatDateRange('2025-12-01', '2025-12-05') => 'Dec 1 - 5, 2025'
 */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const startParsed = typeof start === 'string' ? parseISO(start) : start;
  const endParsed = typeof end === 'string' ? parseISO(end) : end;

  const startYear = format(startParsed, 'yyyy');
  const endYear = format(endParsed, 'yyyy');
  const startMonth = format(startParsed, 'MMM');
  const endMonth = format(endParsed, 'MMM');

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${format(startParsed, 'MMM d')} - ${format(endParsed, 'd, yyyy')}`;
    }
    return `${format(startParsed, 'MMM d')} - ${format(endParsed, 'MMM d, yyyy')}`;
  }

  return `${format(startParsed, 'MMM d, yyyy')} - ${format(endParsed, 'MMM d, yyyy')}`;
}

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function formatDateForInput(date: string | Date): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(parsed, 'yyyy-MM-dd');
}

/**
 * Get the start of today
 */
export function getStartOfToday(): Date {
  return startOfDay(new Date());
}

/**
 * Get the Monday of the week containing the given date (ISO week, Mon=1).
 * Returns 'yyyy-MM-dd' string.
 */
export function getWeekStartString(date: string | Date): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(startOfWeek(parsed, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * Get the Friday of the week containing the given date.
 * Returns 'yyyy-MM-dd' string.
 */
export function getWeekEndString(date: string | Date): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return format(endOfWeek(parsed, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

/**
 * Get weekday dates (Mon-Fri) for the week containing the given date.
 */
export function getWeekdayDates(date: string | Date): Date[] {
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  const weekStart = startOfWeek(parsed, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(parsed, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(
    (d) => !isWeekend(d)
  );
}

// Re-export commonly used functions for direct use
export {
  isToday,
  isPast,
  isFuture,
  addDays,
  subDays,
  parseISO,
  startOfWeek,
  format,
};

