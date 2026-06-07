import { describe, it, expect } from 'vitest';
import { buildUserEntriesFromLedger, pointTxMatchesRaffleMonth } from '@/lib/raffleLedgerEntries';

describe('raffleLedgerEntries', () => {
  it('matches Chicago month boundary on created_at', () => {
    expect(
      pointTxMatchesRaffleMonth(true, 1, '2026-05-31T05:00:00.000Z', 2026, 5),
    ).toBe(true);
    expect(
      pointTxMatchesRaffleMonth(true, 1, '2026-06-01T04:59:59.000Z', 2026, 5),
    ).toBe(true);
    expect(
      pointTxMatchesRaffleMonth(true, 1, '2026-06-01T05:00:00.000Z', 2026, 6),
    ).toBe(true);
  });

  it('excludes non-raffle and non-positive amounts', () => {
    expect(pointTxMatchesRaffleMonth(false, 5, '2026-06-15T12:00:00.000Z', 2026, 6)).toBe(false);
    expect(pointTxMatchesRaffleMonth(true, 0, '2026-06-15T12:00:00.000Z', 2026, 6)).toBe(false);
  });

  it('aggregates per-user ledger rows for drawing pool', () => {
    const { userEntries, grandTotalEntries, totalParticipants } = buildUserEntriesFromLedger(
      [
        { user_id: 'u1', amount: 3, counts_toward_raffle: true, created_at: '2026-05-10T12:00:00.000Z' },
        { user_id: 'u1', amount: 2, counts_toward_raffle: true, created_at: '2026-05-20T12:00:00.000Z' },
        { user_id: 'u2', amount: 4, counts_toward_raffle: true, created_at: '2026-05-15T12:00:00.000Z' },
        { user_id: 'u3', amount: 1, counts_toward_raffle: false, created_at: '2026-05-15T12:00:00.000Z' },
        { user_id: 'u4', amount: 5, counts_toward_raffle: true, created_at: '2026-06-01T12:00:00.000Z' },
      ],
      2026,
      5,
    );

    expect(userEntries.get('u1')).toBe(5);
    expect(userEntries.get('u2')).toBe(4);
    expect(userEntries.has('u3')).toBe(false);
    expect(userEntries.has('u4')).toBe(false);
    expect(grandTotalEntries).toBe(9);
    expect(totalParticipants).toBe(2);
  });
});
