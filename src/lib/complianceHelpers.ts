/**
 * Compliance Date/Time Helpers
 * 
 * Pure utility functions for compliance-related date/time calculations.
 * All functions use America/Chicago timezone for ATTS operations.
 * Uses date-fns-tz for proper DST handling.
 * 
 * Extracted from TodayComplianceStatus.tsx for testability.
 */

import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const TIMEZONE = 'America/Chicago';
const CUTOFF_HOUR = 9; // 9:00 AM
const CUTOFF_MINUTE = 0;

/**
 * Get today's date string in YYYY-MM-DD format (Chicago timezone)
 */
export function getTodayDateString(now: Date = new Date()): string {
  const chicagoDate = toZonedTime(now, TIMEZONE);
  return formatInTimeZone(chicagoDate, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Calculate time remaining until or past the 9:00 AM cutoff
 */
export function getTimeUntilCutoff(now: Date = new Date()): { 
  hours: number; 
  minutes: number; 
  isPast: boolean;
  totalMinutes: number;
} {
  const chicagoNow = toZonedTime(now, TIMEZONE);
  
  // Cutoff is 9:00 AM Chicago time
  const cutoff = new Date(chicagoNow);
  cutoff.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);
  
  const diff = cutoff.getTime() - chicagoNow.getTime();
  const isPast = diff <= 0;
  
  const absDiff = Math.abs(diff);
  const totalMinutes = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return { hours, minutes, isPast, totalMinutes };
}

/**
 * Check if a date falls on a weekend (Saturday or Sunday)
 */
export function isWeekend(now: Date = new Date()): boolean {
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const day = chicagoDate.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Get the day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(now: Date = new Date()): number {
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  return chicagoDate.getDay();
}

/**
 * Get the Monday-Friday date range for the current week
 */
export function getWeekDateRange(now: Date = new Date()): { 
  startDate: string; 
  endDate: string;
} {
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const day = chicagoDate.getDay();
  
  // Get Monday of this week (or last Monday if today is weekend)
  const monday = new Date(chicagoDate);
  const daysToSubtract = day === 0 ? 6 : day - 1;
  monday.setDate(chicagoDate.getDate() - daysToSubtract);
  
  // Get Friday of this week
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayNum = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayNum}`;
  };
  
  return {
    startDate: formatDate(monday),
    endDate: formatDate(friday),
  };
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(hours: number, minutes: number, isPast: boolean): string {
  if (isPast) {
    if (hours === 0 && minutes === 0) {
      return 'Just passed';
    }
    return `${hours > 0 ? `${hours}h ` : ''}${minutes}m past cutoff`;
  }
  
  if (hours === 0 && minutes === 0) {
    return 'Less than a minute';
  }
  
  return `${hours > 0 ? `${hours}h ` : ''}${minutes}m remaining`;
}

/**
 * Determine urgency level based on time until cutoff
 */
export function getUrgencyLevel(totalMinutes: number, isPast: boolean): 'critical' | 'warning' | 'normal' | 'past' {
  if (isPast) return 'past';
  if (totalMinutes <= 30) return 'critical';
  if (totalMinutes <= 60) return 'warning';
  return 'normal';
}

/**
 * Check if submissions are still allowed (before cutoff on weekday)
 */
export function isSubmissionAllowed(now: Date = new Date()): boolean {
  if (isWeekend(now)) return false;
  const { isPast } = getTimeUntilCutoff(now);
  return !isPast;
}

/**
 * Get the next business day date string
 */
export function getNextBusinessDay(now: Date = new Date()): string {
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const day = chicagoDate.getDay();
  
  let daysToAdd = 1;
  if (day === 5) daysToAdd = 3; // Friday -> Monday
  if (day === 6) daysToAdd = 2; // Saturday -> Monday
  if (day === 0) daysToAdd = 1; // Sunday -> Monday
  
  const nextDay = new Date(chicagoDate);
  nextDay.setDate(chicagoDate.getDate() + daysToAdd);
  
  const year = nextDay.getFullYear();
  const month = String(nextDay.getMonth() + 1).padStart(2, '0');
  const dayNum = String(nextDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${dayNum}`;
}
