/**
 * Timezone and time utilities for the Safety + Compliance Agent
 * 
 * Handles America/Chicago timezone conversions and cutoff calculations
 * with proper DST handling.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export const DEFAULT_TIMEZONE = 'America/Chicago';
export const DEFAULT_CUTOFF = '09:00';

// =============================================================================
// TIMEZONE HELPERS
// =============================================================================

/**
 * Get today's date in the specified timezone as YYYY-MM-DD
 */
export function getTodayInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // Returns YYYY-MM-DD format
}

/**
 * Build a UTC timestamp from a local date and time in a specific timezone.
 * 
 * @param dateFor - Date in YYYY-MM-DD format
 * @param timeLocal - Time in HH:MM format (24-hour)
 * @param timezone - IANA timezone (e.g., 'America/Chicago')
 * @returns Date object representing the moment in UTC
 * 
 * @example
 * // Get 9:00 AM Chicago time on Jan 8, 2026 as UTC
 * const cutoff = buildCutoffTimestamp('2026-01-08', '09:00', 'America/Chicago');
 * // Returns Date representing 2026-01-08T15:00:00.000Z (CST is UTC-6)
 */
export function buildCutoffTimestamp(
  dateFor: string,
  timeLocal: string = DEFAULT_CUTOFF,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  // Parse the date components
  const [year, month, day] = dateFor.split('-').map(Number);
  const [hours, minutes] = timeLocal.split(':').map(Number);
  
  // Calculate offset by comparing local time to UTC
  // Create a date in UTC with our desired local time components
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  
  // Find what time it would be in the target timezone if we treated utcDate as local
  const tzFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  // Parse the formatted string to get the timezone's representation
  const formatted = tzFormatter.format(utcDate);
  const [datePart, timePart] = formatted.split(', ');
  const [tzYear, tzMonth, tzDay] = datePart.split('-').map(Number);
  const [tzHour, tzMin] = timePart.split(':').map(Number);
  
  // Calculate the offset in milliseconds
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const tzMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, 0, 0);
  const offsetMs = tzMs - utcMs;
  
  // The actual UTC time is our target local time minus the offset
  return new Date(utcMs - offsetMs);
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDateYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a Date as ISO string for database/API use
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Check if a timestamp is before the cutoff
 */
export function isBeforeCutoff(timestamp: string | Date, cutoff: Date): boolean {
  const ts = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return ts < cutoff;
}

/**
 * Get current timestamp as ISO string
 */
export function nowISO(): string {
  return new Date().toISOString();
}

