import { describe, it, expect } from 'vitest';
import { computeRaffleStanding } from '@/lib/raffleStanding';

describe('computeRaffleStanding', () => {
  it('formats single vs plural entry labels', () => {
    expect(computeRaffleStanding({ userEntries: 1, totalPoolEntries: 10, totalParticipants: 5 }).entriesLabel).toBe(
      '1 entry this month',
    );
    expect(computeRaffleStanding({ userEntries: 3, totalPoolEntries: 10, totalParticipants: 5 }).entriesLabel).toBe(
      '3 entries this month',
    );
  });

  it('clamps share to 100% when user entries exceed pool denominator', () => {
    const standing = computeRaffleStanding({
      userEntries: 12,
      totalPoolEntries: 10,
      totalParticipants: 4,
    });
    expect(standing.oddsLabel).toContain('10 of 10 total entries');
    expect(standing.oddsLabel).toContain('100.0% share');
  });

  it('clamps user entries to pool when computing odds', () => {
    const standing = computeRaffleStanding({
      userEntries: 50,
      totalPoolEntries: 200,
      totalParticipants: 20,
    });
    expect(standing.oddsLabel).toBe('You have 50 of 200 total entries (25.0% share)');
  });

  it('shows participants label when pool has entrants', () => {
    expect(
      computeRaffleStanding({ userEntries: 0, totalPoolEntries: 0, totalParticipants: 1 }).participantsLabel,
    ).toBe('1 participant this month');
    expect(
      computeRaffleStanding({ userEntries: 0, totalPoolEntries: 0, totalParticipants: 3 }).participantsLabel,
    ).toBe('3 participants this month');
  });
});
