/**
 * Unit tests: Duplicate incident check (180-day window, body part overlap, injury type match)
 */

import { describe, it, expect } from 'vitest';
import { subDays } from 'date-fns';

// Simulate duplicate matching logic
function hasOverlappingBodyParts(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  return a.some((p) => b.includes(p));
}

function sameInjuryType(a: string, b: string): boolean {
  return Boolean(a && b && a === b);
}

function within180Days(dateStr: string): boolean {
  const cutoff = subDays(new Date(), 180).toISOString().split('T')[0];
  return dateStr >= cutoff;
}

describe('incident-duplicate-check', () => {
  describe('180-day window', () => {
    it('filters out dates older than 180 days', () => {
      const oldDate = subDays(new Date(), 200).toISOString().split('T')[0];
      expect(within180Days(oldDate)).toBe(false);
    });
    it('includes dates within 180 days', () => {
      const recentDate = subDays(new Date(), 50).toISOString().split('T')[0];
      expect(within180Days(recentDate)).toBe(true);
    });
  });

  describe('body part overlap', () => {
    it('matches when arrays overlap', () => {
      expect(hasOverlappingBodyParts(['hand', 'arm'], ['hand', 'leg'])).toBe(true);
      expect(hasOverlappingBodyParts(['hand'], ['hand'])).toBe(true);
    });
    it('no match when no overlap', () => {
      expect(hasOverlappingBodyParts(['hand', 'arm'], ['leg', 'foot'])).toBe(false);
    });
    it('no match when one array empty', () => {
      expect(hasOverlappingBodyParts([], ['hand'])).toBe(false);
      expect(hasOverlappingBodyParts(['hand'], [])).toBe(false);
    });
  });

  describe('injury type match', () => {
    it('matches same type', () => {
      expect(sameInjuryType('injury', 'injury')).toBe(true);
    });
    it('no match different types', () => {
      expect(sameInjuryType('injury', 'skin_disorder')).toBe(false);
    });
    it('no match when empty', () => {
      expect(sameInjuryType('', 'injury')).toBe(false);
      expect(sameInjuryType('injury', '')).toBe(false);
    });
  });
});
