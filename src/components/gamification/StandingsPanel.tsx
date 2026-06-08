import { memo } from 'react';
import { Trophy } from 'lucide-react';
import { useGamificationStandings } from '@/hooks/gamification';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { PublicRankCard } from './PublicRankCard';
import type { PublicGamificationProfile } from '@/lib/gamification/types';

interface StandingsPanelProps {
  limit?: number;
  className?: string;
}

function standingsToProfile(entry: {
  userId: string;
  fullName: string | null;
  avatarUrl: string | null;
  lifetimeEarned: number;
  tierKey: string;
  tierName: string;
  tierOrder: number;
  subLevel: number;
  subLevelLabel: string;
  currentStreakWeeks: number;
  longestStreak: number;
}): PublicGamificationProfile {
  return {
    userId: entry.userId,
    eligible: true,
    fullName: entry.fullName,
    avatarUrl: entry.avatarUrl,
    hireDate: null,
    level: {
      tierKey: entry.tierKey,
      tierName: entry.tierName,
      tierOrder: entry.tierOrder,
      subLevel: entry.subLevel,
      subLevelLabel: entry.subLevelLabel,
      lifetimeEarned: entry.lifetimeEarned,
      currentThreshold: 0,
      nextThreshold: null,
      progressPct: 100,
    },
    weeklyStreak: {
      currentStreakWeeks: entry.currentStreakWeeks,
      longestStreak: entry.longestStreak,
      freezesRemaining: 0,
      lastActiveWeek: null,
    },
    badges: [],
  };
}

/** Top standings only — no bottom-ranking screen. */
export const StandingsPanel = memo(function StandingsPanel({
  limit = 10,
  className,
}: StandingsPanelProps) {
  const { data: standings = [], isLoading, isError } = useGamificationStandings(limit);

  return (
    <section
      className={cn('space-y-3', className)}
      aria-labelledby="standings-heading"
      data-testid="gamification-standings"
    >
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-400" aria-hidden />
        <h3 id="standings-heading" className="text-sm font-semibold text-white">
          Top crew standings
        </h3>
      </div>
      <p className="text-xs text-white/45">Lifetime earned · eligible field roles only</p>

      {isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading standings">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn('h-24 animate-pulse rounded-xl', glass.subtle)} />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-300/90" role="alert">
          Could not load standings.
        </p>
      )}

      {!isLoading && !isError && standings.length === 0 && (
        <div className={cn(glass.subtle, 'rounded-xl p-6 text-center text-sm text-white/50')}>
          Standings populate as crew members earn points.
        </div>
      )}

      <ol className="space-y-2">
        {standings.map((entry, index) => (
          <li key={entry.userId}>
            <PublicRankCard
              profile={standingsToProfile(entry)}
              rank={index + 1}
            />
          </li>
        ))}
      </ol>
    </section>
  );
});
