/**
 * Raffle standing copy — mirrors Safety Rewards page (entries / pool / participants).
 * Reuses the same inputs as useUserMonthlyEntries + useTotalMonthlyEntries.
 */

export interface RaffleStandingInput {
  userEntries: number;
  totalPoolEntries: number;
  totalParticipants: number;
}

export interface RaffleStanding {
  entriesLabel: string;
  oddsLabel: string | null;
  participantsLabel: string | null;
}

export function computeRaffleStanding({
  userEntries,
  totalPoolEntries,
  totalParticipants,
}: RaffleStandingInput): RaffleStanding {
  const clampedUserEntries =
    totalPoolEntries > 0 ? Math.min(userEntries, totalPoolEntries) : userEntries;
  const clampedPool = Math.max(totalPoolEntries, clampedUserEntries);

  const entriesLabel =
    clampedUserEntries === 1
      ? '1 entry this month'
      : `${clampedUserEntries} entries this month`;

  let oddsLabel: string | null = null;
  if (clampedPool > 0 && clampedUserEntries > 0) {
    const pct = Math.min(100, (clampedUserEntries / clampedPool) * 100);
    oddsLabel = `You have ${clampedUserEntries} of ${clampedPool} total entries (${pct < 0.1 && pct > 0 ? '<0.1' : pct.toFixed(1)}% share)`;
  } else if (clampedUserEntries > 0) {
    oddsLabel = `You have ${clampedUserEntries} ${clampedUserEntries === 1 ? 'entry' : 'entries'} so far`;
  }

  let participantsLabel: string | null = null;
  if (totalParticipants > 0) {
    participantsLabel =
      totalParticipants === 1
        ? '1 participant this month'
        : `${totalParticipants} participants this month`;
  }

  return { entriesLabel, oddsLabel, participantsLabel };
}
