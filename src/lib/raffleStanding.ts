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
  const entriesLabel =
    userEntries === 1
      ? '1 entry this month'
      : `${userEntries} entries this month`;

  let oddsLabel: string | null = null;
  if (totalPoolEntries > 0 && userEntries > 0) {
    const pct = (userEntries / totalPoolEntries) * 100;
    oddsLabel = `You have ${userEntries} of ${totalPoolEntries} total entries (${pct < 0.1 && pct > 0 ? '<0.1' : pct.toFixed(1)}% share)`;
  } else if (userEntries > 0) {
    oddsLabel = `You have ${userEntries} ${userEntries === 1 ? 'entry' : 'entries'} so far`;
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
