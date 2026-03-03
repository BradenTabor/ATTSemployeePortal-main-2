/**
 * RequestTimeOff Date Calculation Tests
 * 
 * Tests the date and duration calculation logic for time-off requests:
 * - Day count calculation (inclusive of start and end dates)
 * - Daily time span calculation
 * - Overnight time span handling
 * - Total duration calculation
 * - Edge cases (same day, invalid dates, missing fields)
 */

import { describe, it, expect } from 'vitest';

/**
 * Calculate total duration for time-off request
 * Extracted from RequestTimeOff.tsx for testing
 */
function calculateTotalDuration(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string
): string {
  // Need all four fields to calculate a proper total
  if (!startTime || !endTime || !startDate || !endDate) {
    return "";
  }

  // Parse dates using split-and-construct to avoid UTC midnight off-by-one
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);

  if ([sy, sm, sd, ey, em, ed].some((v) => isNaN(v))) {
    return "";
  }

  const startDay = new Date(sy, sm - 1, sd);
  const endDay = new Date(ey, em - 1, ed);

  const oneDayMs = 24 * 60 * 60 * 1000;
  let diffDays =
    Math.floor((endDay.getTime() - startDay.getTime()) / oneDayMs) + 1; // inclusive of both start & end dates

  if (diffDays < 1) diffDays = 1;

  // Daily time span
  const startTimeDate = new Date(`1970-01-01T${startTime}:00`);
  const endTimeDate = new Date(`1970-01-01T${endTime}:00`);

  let dailyMs = endTimeDate.getTime() - startTimeDate.getTime();
  // Handle overnight spans (e.g. 22:00 → 06:00 next day)
  if (dailyMs < 0) dailyMs += oneDayMs;

  const totalMs = dailyMs * diffDays;

  const totalHours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor(
    (totalMs % (1000 * 60 * 60)) / (1000 * 60)
  );

  return `${diffDays} day${diffDays > 1 ? "s" : ""} · ${totalHours}h ${minutes}m`;
}

describe('RequestTimeOff Date Calculation', () => {
  describe('Day count calculation', () => {
    it('should calculate 1 day for same start and end date', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-15',
        '09:00',
        '17:00'
      );
      expect(result).toContain('1 day');
    });

    it('should calculate 2 days for consecutive dates', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-16',
        '09:00',
        '17:00'
      );
      expect(result).toContain('2 days');
    });

    it('should calculate 7 days for a week', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-21',
        '09:00',
        '17:00'
      );
      expect(result).toContain('7 days');
    });

    it('should handle month boundaries correctly', () => {
      const result = calculateTotalDuration(
        '2024-01-30',
        '2024-02-02',
        '09:00',
        '17:00'
      );
      expect(result).toContain('4 days');
    });

    it('should handle year boundaries correctly', () => {
      const result = calculateTotalDuration(
        '2023-12-30',
        '2024-01-02',
        '09:00',
        '17:00'
      );
      expect(result).toContain('4 days');
    });
  });

  describe('Daily time span calculation', () => {
    it('should calculate 8 hours for 9am to 5pm', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-15',
        '09:00',
        '17:00'
      );
      expect(result).toContain('8h 0m');
    });

    it('should calculate 4 hours for 1pm to 5pm', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-15',
        '13:00',
        '17:00'
      );
      expect(result).toContain('4h 0m');
    });

    it('should calculate hours and minutes correctly', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-15',
        '09:30',
        '17:45'
      );
      expect(result).toContain('8h 15m');
    });

    it('should handle overnight spans (22:00 to 06:00)', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-15',
        '22:00',
        '06:00'
      );
      // Should be 8 hours (22:00 to 06:00 next day)
      expect(result).toContain('8h 0m');
    });

    it('should handle overnight spans with minutes', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-15',
        '22:30',
        '06:15'
      );
      // Should be 7 hours 45 minutes
      expect(result).toContain('7h 45m');
    });
  });

  describe('Multi-day duration calculation', () => {
    it('should calculate total for 2 days with 8 hours each', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-16',
        '09:00',
        '17:00'
      );
      expect(result).toContain('2 days');
      expect(result).toContain('16h 0m');
    });

    it('should calculate total for 5 days with 8 hours each', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-19',
        '09:00',
        '17:00'
      );
      expect(result).toContain('5 days');
      expect(result).toContain('40h 0m');
    });

    it('should calculate total for multiple days with overnight spans', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-17',
        '22:00',
        '06:00'
      );
      expect(result).toContain('3 days');
      expect(result).toContain('24h 0m'); // 8 hours × 3 days
    });
  });

  describe('Edge cases', () => {
    it('should return empty string when startDate is missing', () => {
      const result = calculateTotalDuration(
        '',
        '2024-01-16',
        '09:00',
        '17:00'
      );
      expect(result).toBe('');
    });

    it('should return empty string when endDate is missing', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '',
        '09:00',
        '17:00'
      );
      expect(result).toBe('');
    });

    it('should return empty string when startTime is missing', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-16',
        '',
        '17:00'
      );
      expect(result).toBe('');
    });

    it('should return empty string when endTime is missing', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-16',
        '09:00',
        ''
      );
      expect(result).toBe('');
    });

    it('should return empty string for invalid start date', () => {
      const result = calculateTotalDuration(
        'invalid-date',
        '2024-01-16',
        '09:00',
        '17:00'
      );
      expect(result).toBe('');
    });

    it('should return empty string for invalid end date', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        'invalid-date',
        '09:00',
        '17:00'
      );
      expect(result).toBe('');
    });

    it('should handle end date before start date (minimum 1 day)', () => {
      const result = calculateTotalDuration(
        '2024-01-16',
        '2024-01-15',
        '09:00',
        '17:00'
      );
      // Should still calculate as 1 day minimum
      expect(result).toContain('1 day');
    });
  });

  describe('Real-world scenarios', () => {
    it('should calculate a typical work week (Mon-Fri, 9-5)', () => {
      const result = calculateTotalDuration(
        '2024-01-15', // Monday
        '2024-01-19', // Friday
        '09:00',
        '17:00'
      );
      expect(result).toContain('5 days');
      expect(result).toContain('40h 0m');
    });

    it('should calculate a long weekend (Fri-Mon)', () => {
      const result = calculateTotalDuration(
        '2024-01-19', // Friday
        '2024-01-22', // Monday
        '09:00',
        '17:00'
      );
      expect(result).toContain('4 days');
      expect(result).toContain('32h 0m');
    });

    it('should calculate partial day with minutes', () => {
      const result = calculateTotalDuration(
        '2024-01-15',
        '2024-01-15',
        '09:15',
        '13:45'
      );
      expect(result).toContain('1 day');
      expect(result).toContain('4h 30m');
    });
  });

  describe('Timezone boundary safety', () => {
    it('Feb 19 should produce a 1-day result, not roll back to Feb 18', () => {
      const result = calculateTotalDuration(
        '2026-02-19',
        '2026-02-19',
        '09:00',
        '17:00'
      );
      expect(result).toContain('1 day');
      expect(result).toContain('8h 0m');
    });

    it('date strings should not be affected by local timezone offset', () => {
      const [y, m, d] = '2026-02-19'.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      expect(date.getDate()).toBe(19);
      expect(date.getMonth()).toBe(1); // February = 1
      expect(date.getFullYear()).toBe(2026);
    });
  });
});
