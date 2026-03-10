/**
 * Compliance Helpers Unit Tests
 * 
 * Tests for date/time utility functions used in compliance checking.
 * All tests use fixed dates to ensure deterministic results.
 */

import { describe, it, expect } from 'vitest';
import {
  getTodayDateString,
  getTimeUntilCutoff,
  isWeekend,
  getDayOfWeek,
  getWeekDateRange,
  formatTimeRemaining,
  getUrgencyLevel,
  isSubmissionAllowed,
  getNextBusinessDay,
  isWithinRewardClaimWindow,
  getRewardClaimWindowMessage,
  getTimeUntilClaimWindowOpens,
} from '@/lib/complianceHelpers';

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Create a date in America/Chicago timezone
 * Note: JS Date objects are UTC internally, so we adjust for testing
 */
function createChicagoDate(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number = 12,
  minute: number = 0
): Date {
  // Chicago is UTC-6 in winter, UTC-5 in summer (DST)
  // For simplicity in tests, we create dates that work correctly
  // when converted back via toLocaleString
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

// Fixed test dates (Chicago timezone)
const MONDAY_8AM = createChicagoDate(2026, 1, 19, 8, 0);     // Monday 8:00 AM - before cutoff
const MONDAY_9AM = createChicagoDate(2026, 1, 19, 9, 0);     // Monday 9:00 AM - at cutoff
const MONDAY_10AM = createChicagoDate(2026, 1, 19, 10, 0);   // Monday 10:00 AM - after cutoff
const TUESDAY_NOON = createChicagoDate(2026, 1, 20, 12, 0);  // Tuesday noon
const FRIDAY_5PM = createChicagoDate(2026, 1, 23, 17, 0);    // Friday 5:00 PM
const SATURDAY_NOON = createChicagoDate(2026, 1, 24, 12, 0); // Saturday noon
const SUNDAY_NOON = createChicagoDate(2026, 1, 25, 12, 0);   // Sunday noon

// Reward claim window: 5:00–8:00 AM Central
const MONDAY_459 = createChicagoDate(2026, 1, 19, 4, 59);
const MONDAY_5AM = createChicagoDate(2026, 1, 19, 5, 0);
const MONDAY_559 = createChicagoDate(2026, 1, 19, 5, 59);
const MONDAY_6AM = createChicagoDate(2026, 1, 19, 6, 0);
const MONDAY_659 = createChicagoDate(2026, 1, 19, 6, 59);
const MONDAY_730 = createChicagoDate(2026, 1, 19, 7, 30);
const MONDAY_759 = createChicagoDate(2026, 1, 19, 7, 59);

// =============================================================================
// TEST SUITES
// =============================================================================

describe('getTodayDateString', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const result = getTodayDateString(MONDAY_8AM);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns correct date for Monday', () => {
    const result = getTodayDateString(MONDAY_8AM);
    expect(result).toBe('2026-01-19');
  });

  it('returns correct date for Friday', () => {
    const result = getTodayDateString(FRIDAY_5PM);
    expect(result).toBe('2026-01-23');
  });

  it('returns correct date for Saturday', () => {
    const result = getTodayDateString(SATURDAY_NOON);
    expect(result).toBe('2026-01-24');
  });

  it('pads single-digit months and days', () => {
    const jan5 = createChicagoDate(2026, 1, 5, 12, 0);
    const result = getTodayDateString(jan5);
    expect(result).toBe('2026-01-05');
  });

  it('handles December dates correctly', () => {
    const dec25 = createChicagoDate(2026, 12, 25, 12, 0);
    const result = getTodayDateString(dec25);
    expect(result).toBe('2026-12-25');
  });
});

describe('getTimeUntilCutoff', () => {
  it('returns time before cutoff correctly', () => {
    const result = getTimeUntilCutoff(MONDAY_8AM);
    expect(result.isPast).toBe(false);
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(0);
  });

  it('returns isPast=true when at cutoff time', () => {
    // At exactly 9:00 AM, cutoff is considered past (diff <= 0)
    const result = getTimeUntilCutoff(MONDAY_9AM);
    expect(result.isPast).toBe(true);
  });

  it('returns time after cutoff correctly', () => {
    const result = getTimeUntilCutoff(MONDAY_10AM);
    expect(result.isPast).toBe(true);
    expect(result.hours).toBe(1);
    expect(result.minutes).toBe(0);
  });

  it('calculates totalMinutes correctly', () => {
    const result = getTimeUntilCutoff(MONDAY_8AM);
    expect(result.totalMinutes).toBe(60); // 1 hour = 60 minutes
  });

  it('handles early morning times', () => {
    const early = createChicagoDate(2026, 1, 19, 6, 30); // 6:30 AM
    const result = getTimeUntilCutoff(early);
    expect(result.isPast).toBe(false);
    expect(result.hours).toBe(2);
    expect(result.minutes).toBe(30);
  });

  it('handles late afternoon times', () => {
    const late = createChicagoDate(2026, 1, 19, 17, 0); // 5:00 PM
    const result = getTimeUntilCutoff(late);
    expect(result.isPast).toBe(true);
    expect(result.hours).toBe(8); // 8 hours past 9 AM
  });
});

describe('isWeekend', () => {
  it('returns false for Monday', () => {
    expect(isWeekend(MONDAY_8AM)).toBe(false);
  });

  it('returns false for Tuesday', () => {
    expect(isWeekend(TUESDAY_NOON)).toBe(false);
  });

  it('returns false for Friday', () => {
    expect(isWeekend(FRIDAY_5PM)).toBe(false);
  });

  it('returns true for Saturday', () => {
    expect(isWeekend(SATURDAY_NOON)).toBe(true);
  });

  it('returns true for Sunday', () => {
    expect(isWeekend(SUNDAY_NOON)).toBe(true);
  });
});

describe('getDayOfWeek', () => {
  it('returns 0 for Sunday', () => {
    expect(getDayOfWeek(SUNDAY_NOON)).toBe(0);
  });

  it('returns 1 for Monday', () => {
    expect(getDayOfWeek(MONDAY_8AM)).toBe(1);
  });

  it('returns 5 for Friday', () => {
    expect(getDayOfWeek(FRIDAY_5PM)).toBe(5);
  });

  it('returns 6 for Saturday', () => {
    expect(getDayOfWeek(SATURDAY_NOON)).toBe(6);
  });
});

describe('getWeekDateRange', () => {
  it('returns Monday-Friday range for weekday', () => {
    const result = getWeekDateRange(TUESDAY_NOON);
    expect(result.startDate).toBe('2026-01-19'); // Monday
    expect(result.endDate).toBe('2026-01-23');   // Friday
  });

  it('returns correct range when called on Monday', () => {
    const result = getWeekDateRange(MONDAY_8AM);
    expect(result.startDate).toBe('2026-01-19'); // Same Monday
    expect(result.endDate).toBe('2026-01-23');   // Friday
  });

  it('returns correct range when called on Friday', () => {
    const result = getWeekDateRange(FRIDAY_5PM);
    expect(result.startDate).toBe('2026-01-19'); // Monday
    expect(result.endDate).toBe('2026-01-23');   // Same Friday
  });

  it('returns last week range when called on Saturday', () => {
    const result = getWeekDateRange(SATURDAY_NOON);
    // Saturday Jan 24 -> Monday Jan 19 (subtract 5 days)
    expect(result.startDate).toBe('2026-01-19');
    expect(result.endDate).toBe('2026-01-23');
  });

  it('returns last week range when called on Sunday', () => {
    const result = getWeekDateRange(SUNDAY_NOON);
    // Sunday Jan 25 -> Monday Jan 19 (subtract 6 days)
    expect(result.startDate).toBe('2026-01-19');
    expect(result.endDate).toBe('2026-01-23');
  });

  it('returns dates in YYYY-MM-DD format', () => {
    const result = getWeekDateRange(MONDAY_8AM);
    expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatTimeRemaining', () => {
  it('formats time before cutoff', () => {
    const result = formatTimeRemaining(1, 30, false);
    expect(result).toBe('1h 30m remaining');
  });

  it('formats time past cutoff', () => {
    const result = formatTimeRemaining(2, 15, true);
    expect(result).toBe('2h 15m past cutoff');
  });

  it('handles zero hours before cutoff', () => {
    const result = formatTimeRemaining(0, 45, false);
    expect(result).toBe('45m remaining');
  });

  it('handles zero hours past cutoff', () => {
    const result = formatTimeRemaining(0, 30, true);
    expect(result).toBe('30m past cutoff');
  });

  it('handles zero minutes', () => {
    const result = formatTimeRemaining(2, 0, false);
    expect(result).toBe('2h 0m remaining');
  });

  it('handles zero time remaining', () => {
    const result = formatTimeRemaining(0, 0, false);
    expect(result).toBe('Less than a minute');
  });

  it('handles just passed cutoff', () => {
    const result = formatTimeRemaining(0, 0, true);
    expect(result).toBe('Just passed');
  });
});

describe('getUrgencyLevel', () => {
  it('returns "past" when isPast is true', () => {
    expect(getUrgencyLevel(60, true)).toBe('past');
    expect(getUrgencyLevel(0, true)).toBe('past');
  });

  it('returns "critical" when <= 30 minutes remaining', () => {
    expect(getUrgencyLevel(30, false)).toBe('critical');
    expect(getUrgencyLevel(15, false)).toBe('critical');
    expect(getUrgencyLevel(1, false)).toBe('critical');
  });

  it('returns "warning" when 31-60 minutes remaining', () => {
    expect(getUrgencyLevel(31, false)).toBe('warning');
    expect(getUrgencyLevel(45, false)).toBe('warning');
    expect(getUrgencyLevel(60, false)).toBe('warning');
  });

  it('returns "normal" when > 60 minutes remaining', () => {
    expect(getUrgencyLevel(61, false)).toBe('normal');
    expect(getUrgencyLevel(120, false)).toBe('normal');
    expect(getUrgencyLevel(480, false)).toBe('normal');
  });

  it('boundary: 30 minutes is critical', () => {
    expect(getUrgencyLevel(30, false)).toBe('critical');
  });

  it('boundary: 31 minutes is warning', () => {
    expect(getUrgencyLevel(31, false)).toBe('warning');
  });

  it('boundary: 60 minutes is warning', () => {
    expect(getUrgencyLevel(60, false)).toBe('warning');
  });

  it('boundary: 61 minutes is normal', () => {
    expect(getUrgencyLevel(61, false)).toBe('normal');
  });
});

describe('isSubmissionAllowed', () => {
  it('returns true on weekday before cutoff', () => {
    expect(isSubmissionAllowed(MONDAY_8AM)).toBe(true);
  });

  it('returns false on weekday at cutoff', () => {
    expect(isSubmissionAllowed(MONDAY_9AM)).toBe(false);
  });

  it('returns false on weekday after cutoff', () => {
    expect(isSubmissionAllowed(MONDAY_10AM)).toBe(false);
  });

  it('returns false on Saturday', () => {
    expect(isSubmissionAllowed(SATURDAY_NOON)).toBe(false);
  });

  it('returns false on Sunday', () => {
    expect(isSubmissionAllowed(SUNDAY_NOON)).toBe(false);
  });

  it('returns false on Friday after cutoff', () => {
    expect(isSubmissionAllowed(FRIDAY_5PM)).toBe(false);
  });
});

describe('getNextBusinessDay', () => {
  it('returns next day for Monday-Thursday', () => {
    expect(getNextBusinessDay(MONDAY_8AM)).toBe('2026-01-20'); // Tuesday
  });

  it('returns Tuesday for Monday', () => {
    expect(getNextBusinessDay(MONDAY_8AM)).toBe('2026-01-20');
  });

  it('returns Monday for Friday', () => {
    expect(getNextBusinessDay(FRIDAY_5PM)).toBe('2026-01-26'); // Next Monday
  });

  it('returns Monday for Saturday', () => {
    expect(getNextBusinessDay(SATURDAY_NOON)).toBe('2026-01-26'); // Next Monday
  });

  it('returns Monday for Sunday', () => {
    expect(getNextBusinessDay(SUNDAY_NOON)).toBe('2026-01-26'); // Next Monday
  });

  it('returns date in YYYY-MM-DD format', () => {
    const result = getNextBusinessDay(MONDAY_8AM);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('isWithinRewardClaimWindow', () => {
  it('returns false at 4:59 AM', () => {
    expect(isWithinRewardClaimWindow(MONDAY_459)).toBe(false);
  });

  it('returns true at 5:00 AM', () => {
    expect(isWithinRewardClaimWindow(MONDAY_5AM)).toBe(true);
  });

  it('returns true at 5:59 AM', () => {
    expect(isWithinRewardClaimWindow(MONDAY_559)).toBe(true);
  });

  it('returns true at 6:00 AM', () => {
    expect(isWithinRewardClaimWindow(MONDAY_6AM)).toBe(true);
  });

  it('returns true at 6:59 AM', () => {
    expect(isWithinRewardClaimWindow(MONDAY_659)).toBe(true);
  });

  it('returns true during window (7:30 AM)', () => {
    expect(isWithinRewardClaimWindow(MONDAY_730)).toBe(true);
  });

  it('returns true at 7:59 AM (last valid minute)', () => {
    expect(isWithinRewardClaimWindow(MONDAY_759)).toBe(true);
  });

  it('returns false at 8:00 AM', () => {
    expect(isWithinRewardClaimWindow(MONDAY_8AM)).toBe(false);
  });

  it('returns false at 9:00 AM', () => {
    expect(isWithinRewardClaimWindow(MONDAY_9AM)).toBe(false);
  });

  it('returns false after window (10:00 AM)', () => {
    expect(isWithinRewardClaimWindow(MONDAY_10AM)).toBe(false);
  });
});

describe('getRewardClaimWindowMessage', () => {
  it('returns null when inside window', () => {
    expect(getRewardClaimWindowMessage(MONDAY_5AM)).toBe(null);
    expect(getRewardClaimWindowMessage(MONDAY_730)).toBe(null);
    expect(getRewardClaimWindowMessage(MONDAY_759)).toBe(null);
  });

  it('returns "Claim opens at 5 AM Central" before 5 AM', () => {
    expect(getRewardClaimWindowMessage(MONDAY_459)).toBe('Claim opens at 5 AM Central');
  });

  it('returns "Claim window closed (5–8 AM Central)" after 8 AM', () => {
    expect(getRewardClaimWindowMessage(MONDAY_8AM)).toBe('Claim window closed (5–8 AM Central)');
    expect(getRewardClaimWindowMessage(MONDAY_9AM)).toBe('Claim window closed (5–8 AM Central)');
    expect(getRewardClaimWindowMessage(MONDAY_10AM)).toBe('Claim window closed (5–8 AM Central)');
  });
});

describe('getTimeUntilClaimWindowOpens', () => {
  it('returns null at 5:00 AM', () => {
    expect(getTimeUntilClaimWindowOpens(MONDAY_5AM)).toBe(null);
  });

  it('returns null during window', () => {
    expect(getTimeUntilClaimWindowOpens(MONDAY_730)).toBe(null);
    expect(getTimeUntilClaimWindowOpens(MONDAY_759)).toBe(null);
  });

  it('returns null after window', () => {
    expect(getTimeUntilClaimWindowOpens(MONDAY_8AM)).toBe(null);
    expect(getTimeUntilClaimWindowOpens(MONDAY_9AM)).toBe(null);
  });

  it('returns time until 5 AM when before window', () => {
    const result = getTimeUntilClaimWindowOpens(MONDAY_459);
    expect(result).not.toBe(null);
    expect(result!.minutes).toBe(1);
    expect(result!.hours).toBe(0);
  });

  it('returns correct span 1 hour before 5 AM', () => {
    const oneHourBefore = createChicagoDate(2026, 1, 19, 4, 0);
    const result = getTimeUntilClaimWindowOpens(oneHourBefore);
    expect(result).toEqual({ hours: 1, minutes: 0 });
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  describe('Year boundaries', () => {
    it('handles December 31 correctly', () => {
      const dec31 = createChicagoDate(2025, 12, 31, 12, 0);
      expect(getTodayDateString(dec31)).toBe('2025-12-31');
    });

    it('handles January 1 correctly', () => {
      const jan1 = createChicagoDate(2026, 1, 1, 12, 0);
      expect(getTodayDateString(jan1)).toBe('2026-01-01');
    });

    it('gets next business day across year boundary', () => {
      // December 31, 2025 is a Wednesday
      const dec31Wed = createChicagoDate(2025, 12, 31, 12, 0);
      expect(getNextBusinessDay(dec31Wed)).toBe('2026-01-01');
    });
  });

  describe('Month boundaries', () => {
    it('handles February 28 in non-leap year', () => {
      const feb28 = createChicagoDate(2025, 2, 28, 12, 0);
      expect(getTodayDateString(feb28)).toBe('2025-02-28');
    });

    it('handles February 29 in leap year', () => {
      const feb29 = createChicagoDate(2024, 2, 29, 12, 0);
      expect(getTodayDateString(feb29)).toBe('2024-02-29');
    });
  });

  describe('Midnight handling', () => {
    it('handles midnight correctly', () => {
      const midnight = createChicagoDate(2026, 1, 19, 0, 0);
      const result = getTimeUntilCutoff(midnight);
      expect(result.isPast).toBe(false);
      expect(result.hours).toBe(9);
      expect(result.minutes).toBe(0);
    });

    it('handles 11:59 PM correctly', () => {
      const lateNight = createChicagoDate(2026, 1, 19, 23, 59);
      const result = getTimeUntilCutoff(lateNight);
      expect(result.isPast).toBe(true);
    });
  });

  describe('Time precision', () => {
    it('handles minutes just before cutoff', () => {
      const justBefore = createChicagoDate(2026, 1, 19, 8, 59);
      const result = getTimeUntilCutoff(justBefore);
      expect(result.isPast).toBe(false);
      expect(result.minutes).toBe(1);
    });

    it('handles minutes just after cutoff', () => {
      const justAfter = createChicagoDate(2026, 1, 19, 9, 1);
      const result = getTimeUntilCutoff(justAfter);
      expect(result.isPast).toBe(true);
      expect(result.minutes).toBe(1);
    });
  });
});
