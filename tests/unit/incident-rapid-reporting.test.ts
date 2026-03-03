/**
 * Unit tests: Rapid reporting (deadline, urgency, timezone)
 */

import { describe, it, expect } from 'vitest';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'America/Chicago';

// Simulate deadline calculation logic
function getDeadlineHours(severity: string): number {
  if (severity === 'fatality') return 8;
  return 24;
}

function computeElapsedHours(reportedAt: string, now: Date): number {
  const reported = toZonedTime(new Date(reportedAt), TZ);
  const nowZoned = toZonedTime(now, TZ);
  return (nowZoned.getTime() - reported.getTime()) / (1000 * 60 * 60);
}

function computeUrgency(
  remainingHours: number,
  deadlineHours: number
): 'green' | 'yellow' | 'red' | 'overdue' {
  if (remainingHours <= 0) return 'overdue';
  const pctRemaining = remainingHours / deadlineHours;
  if (pctRemaining > 0.5) return 'green';
  if (pctRemaining >= 0.25) return 'yellow';
  return 'red';
}

describe('incident-rapid-reporting', () => {
  describe('deadline calculation', () => {
    it('fatality: 8 hours', () => {
      expect(getDeadlineHours('fatality')).toBe(8);
    });
    it('hospitalization and others: 24 hours', () => {
      expect(getDeadlineHours('recordable')).toBe(24);
      expect(getDeadlineHours('lost_time')).toBe(24);
    });
  });

  describe('urgency levels', () => {
    it('green when >50% time remaining', () => {
      expect(computeUrgency(5, 8)).toBe('green');
      expect(computeUrgency(15, 24)).toBe('green');
    });
    it('yellow when 25-50% remaining', () => {
      expect(computeUrgency(2, 8)).toBe('yellow');
      expect(computeUrgency(8, 24)).toBe('yellow');
    });
    it('red when <25% remaining', () => {
      expect(computeUrgency(1, 8)).toBe('red');
      expect(computeUrgency(4, 24)).toBe('red');
    });
    it('overdue when remaining <= 0', () => {
      expect(computeUrgency(0, 8)).toBe('overdue');
      expect(computeUrgency(-2, 8)).toBe('overdue');
    });
  });

  describe('elapsed time computation', () => {
    it('computes hours since reported_at', () => {
      const reportedAt = '2026-02-16T10:00:00Z';
      const now = new Date('2026-02-16T12:00:00Z');
      const elapsed = computeElapsedHours(reportedAt, now);
      expect(elapsed).toBeGreaterThanOrEqual(1);
      expect(elapsed).toBeLessThanOrEqual(3);
    });
  });
});
