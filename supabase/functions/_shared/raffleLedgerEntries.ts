/**
 * Ledger raffle entry aggregation — mirrors public.point_tx_matches_raffle_month.
 * KEEP IN SYNC: src/lib/raffleLedgerEntries.ts
 */

export interface RaffleLedgerRow {
  user_id: string;
  amount: number;
  counts_toward_raffle: boolean;
  created_at: string;
}

export function pointTxMatchesRaffleMonth(
  countsTowardRaffle: boolean,
  amount: number,
  createdAt: string,
  year: number,
  month: number,
): boolean {
  if (!countsTowardRaffle || amount <= 0) return false;
  const chicago = new Date(
    new Date(createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' }),
  );
  return chicago.getFullYear() === year && chicago.getMonth() + 1 === month;
}

export function buildUserEntriesFromLedger(
  rows: RaffleLedgerRow[],
  year: number,
  month: number,
): { userEntries: Map<string, number>; grandTotalEntries: number; totalParticipants: number } {
  const userEntries = new Map<string, number>();
  let grandTotalEntries = 0;

  for (const row of rows) {
    if (!pointTxMatchesRaffleMonth(row.counts_toward_raffle, row.amount, row.created_at, year, month)) {
      continue;
    }
    const next = (userEntries.get(row.user_id) ?? 0) + row.amount;
    userEntries.set(row.user_id, next);
    grandTotalEntries += row.amount;
  }

  return {
    userEntries,
    grandTotalEntries,
    totalParticipants: userEntries.size,
  };
}
