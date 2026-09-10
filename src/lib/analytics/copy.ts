export const ANALYTICS_COPY = {
  title: 'Safety Analytics',
  subtitle: 'Weekday form packet · morning announcements · who is falling behind',
  heroEyebrow: 'Form fill',
  heroHint:
    'Completed DVIR, equipment, and JSA slots divided by field crew × weekdays × 3. Empty attendance rows do not count as work done.',
  instruments: {
    formFill: {
      label: 'Form fill',
      hint: 'Forms filed ÷ forms owed. Owed = field crew × weekdays × DVIR + equipment + JSA.',
    },
    fullPacket: {
      label: 'Full packet',
      hint: 'Days a field worker filed all three forms ÷ field crew × weekdays.',
    },
    reach: {
      label: 'Announcement reach',
      hint: 'Field workers who claimed at least one announcement ÷ field crew. Not “anyone who was active.”',
    },
    points: {
      label: 'Points issued',
      hint: 'Ledger total for the window. Forms + announcements + other sources must add up.',
    },
  },
  coverageTitle: 'Form coverage vs owed',
  coverageHint: 'Each bar is that form’s count against the same owed weekday slots — not a share of the mix.',
  pointsTitle: 'Points integrity',
  pointsHint: 'If the three parts do not equal the ledger, a source is missing or a deduction landed in Other.',
  trendTitle: 'Daily form fill',
  atRiskTitle: 'Needs a nudge',
  atRiskHint:
    'Field crew under 50% form fill, or zero full packets. On All time this list uses the last 30 days so it stays actionable.',
  leaderboardTitle: 'Crew board',
  recordedFootnote: 'Full-packet rate among recorded attendance rows (includes empty 0-form days).',
  emptyLeaderboard: 'No crew activity in this window.',
  emptyFilter: 'No names match that search.',
  emptyAtRisk: 'Nobody is under the 50% fill line this window.',
  daysWithForms: 'Days with a form',
  fullPacketDays: 'Full-packet days',
  emptyRows: 'Empty attendance rows',
  owedSlots: 'Form slots owed',
  fieldCrew: 'Field crew',
} as const;
