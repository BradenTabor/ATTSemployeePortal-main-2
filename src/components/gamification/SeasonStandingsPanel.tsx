/**
 * SeasonStandingsPanel — Track A season leaderboard (top eligible only).
 * Track B improvement delta appears only on the signed-in user's personal card.
 */

import { memo } from 'react';
import { Crown, TrendingUp } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveSeason,
  usePhase2GamificationFlags,
  useSeasonStandings,
  useUserSeasonProgress,
} from '@/hooks/gamification';
import { glass } from '@/lib/glass';
import { formatSeasonDateRange } from '@/lib/gamification/chicagoWeek';
import { formatTierLabel, getTierTheme } from '@/lib/gamification/tiers';
import { cn } from '@/lib/utils';

interface SeasonStandingsPanelProps {
  limit?: number;
  className?: string;
}

export const SeasonStandingsPanel = memo(function SeasonStandingsPanel({
  limit = 10,
  className,
}: SeasonStandingsPanelProps) {
  const { user } = useAuth();
  const { data: flags } = usePhase2GamificationFlags();
  const showSeasons = flags?.showSeasons ?? false;

  const { data: season, isLoading: seasonLoading } = useActiveSeason(showSeasons);
  const seasonKey = season?.seasonKey;

  const { data: standings = [], isLoading: standingsLoading, isError } = useSeasonStandings(
    seasonKey,
    showSeasons && !!seasonKey,
    limit,
  );

  const { data: ownProgress } = useUserSeasonProgress(
    user?.id,
    seasonKey,
    showSeasons && !!seasonKey && !!user?.id,
  );

  if (!showSeasons) return null;
  if (seasonLoading) {
    return (
      <div
        className={cn('h-32 animate-pulse rounded-xl', glass.subtle, className)}
        aria-busy="true"
        aria-label="Loading season standings"
      />
    );
  }
  if (!season) return null;

  const showImprovement =
    season.mostImprovedEnabled && (ownProgress?.improvementDelta ?? 0) > 0;

  return (
    <section
      className={cn('space-y-3', className)}
      aria-labelledby="season-standings-heading"
      data-testid="season-standings-panel"
    >
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-violet-300" aria-hidden />
        <h3 id="season-standings-heading" className="text-sm font-semibold text-white">
          {season.name}
        </h3>
      </div>
      <p className="text-xs text-white/45">
        Season score · {formatSeasonDateRange(season.startAt, season.endAt)}
      </p>

      {user && ownProgress != null && (
        <div
          className={cn(
            glass.subtle,
            'rounded-xl border border-violet-400/20 p-3',
          )}
          data-testid="season-standings-own-card"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-violet-300/70">
            Your season
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-100">
            {ownProgress.seasonScore}
            <span className="ml-1.5 text-sm font-semibold text-white/45">pts</span>
          </p>
          {showImprovement && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-300/90">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              +{ownProgress.improvementDelta} vs your baseline — personal growth track
            </p>
          )}
        </div>
      )}

      {standingsLoading && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading season standings">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn('h-16 animate-pulse rounded-xl', glass.subtle)} />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-300/90" role="alert">
          Could not load season standings.
        </p>
      )}

      {!standingsLoading && !isError && standings.length === 0 && (
        <div className={cn(glass.subtle, 'rounded-xl p-6 text-center text-sm text-white/50')}>
          Season standings populate as crew members earn points this season.
        </div>
      )}

      <ol className="space-y-2">
        {standings.map((entry, index) => {
          const theme = getTierTheme(entry.tierKey);
          const isSelf = entry.userId === user?.id;
          return (
            <li key={entry.userId}>
              <article
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-white/10 p-3',
                  isSelf && 'border-violet-400/25 bg-violet-500/[0.06]',
                )}
                data-testid={`season-standing-${index + 1}`}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-amber-300"
                  aria-label={`Rank ${index + 1}`}
                >
                  #{index + 1}
                </div>
                <UserAvatar avatarUrl={entry.avatarUrl} name={entry.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {entry.fullName ?? 'Crew member'}
                    {isSelf && (
                      <span className="ml-1.5 text-[10px] font-medium text-violet-300/80">(you)</span>
                    )}
                  </p>
                  <p className={cn('text-[11px] font-medium', theme.accentClass)}>
                    {formatTierLabel(entry.tierName, entry.subLevelLabel)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-violet-200">
                  {entry.seasonScore}
                  <span className="ml-0.5 text-[10px] font-medium text-white/40">pts</span>
                </p>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
});
