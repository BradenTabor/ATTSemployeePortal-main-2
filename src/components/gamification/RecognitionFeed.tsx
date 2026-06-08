import { memo, lazy, Suspense } from 'react';
import { Megaphone } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { usePhase2GamificationFlags, useRecognitionFeed } from '@/hooks/gamification';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';
import type { RecognitionFeedItem } from '@/lib/gamification/types';
import { getPrestigeLabel } from '@/lib/gamification/tiers';

const SeasonFinaleStrip = lazy(() =>
  import('./SeasonFinaleStrip').then((m) => ({ default: m.SeasonFinaleStrip })),
);

function formatFeedLine(item: RecognitionFeedItem): string {
  const name = item.subjectName ?? 'A crew member';
  const payload = item.payload;

  switch (item.eventType) {
    case 'tier_promotion':
      return `${name} reached ${String(payload.tier_name ?? 'a new tier')} ${String(payload.sub_level_label ?? '')}`.trim();
    case 'badge_awarded':
      return `${name} earned ${String(payload.title ?? 'a badge')}`;
    case 'tenure_milestone':
      return `${name} hit tenure milestone — ${String(payload.title ?? '')}`;
    case 'streak_milestone':
      return `${name} hit a weekly streak milestone — Lit badge ${getPrestigeLabel(Number(payload.prestige_tier ?? 1))}`;
    case 'season_podium':
      return `${name} finished on the season podium — ${String(payload.rank ?? '')} place`;
    case 'season_most_improved':
      return `${name} earned Most Improved — +${String(payload.delta ?? 0)} vs baseline`;
    default:
      return `${name} earned recognition`;
  }
}

function isSeasonFinaleEvent(eventType: RecognitionFeedItem['eventType']): boolean {
  return eventType === 'season_podium' || eventType === 'season_most_improved';
}

interface RecognitionFeedProps {
  limit?: number;
  className?: string;
}

export const RecognitionFeed = memo(function RecognitionFeed({
  limit = 20,
  className,
}: RecognitionFeedProps) {
  const { data: items = [], isLoading, isError } = useRecognitionFeed(limit);
  const { data: flags } = usePhase2GamificationFlags();
  const showSeasons = flags?.showSeasons ?? false;

  return (
    <section
      className={cn('space-y-3', className)}
      aria-labelledby="recognition-feed-heading"
      data-testid="recognition-feed"
    >
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-emerald-400" aria-hidden />
        <h3 id="recognition-feed-heading" className="text-sm font-semibold text-white">
          Recognition feed
        </h3>
      </div>
      <p className="text-xs text-white/45">Curated wins from the crew — majors, milestones, and prestige badges only.</p>

      {isLoading && (
        <ul className="space-y-2" aria-busy="true" aria-label="Loading recognition feed">
          {[1, 2, 3].map((i) => (
            <li key={i} className={cn('h-14 animate-pulse rounded-xl', glass.subtle)} />
          ))}
        </ul>
      )}

      {isError && (
        <p className="text-sm text-red-300/90" role="alert">
          Could not load the recognition feed.
        </p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className={cn(glass.subtle, 'rounded-xl p-6 text-center text-sm text-white/50')}>
          No recognition events yet — first major tier-ups and milestones land here.
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) =>
          showSeasons && isSeasonFinaleEvent(item.eventType) ? (
            <li key={item.id}>
              <Suspense fallback={null}>
                <SeasonFinaleStrip item={item} />
              </Suspense>
            </li>
          ) : (
            <li
              key={item.id}
              className={cn(
                glass.subtle,
                'flex items-start gap-3 rounded-xl border border-white/10 p-3',
              )}
              data-testid={`recognition-feed-item-${item.id}`}
            >
              <UserAvatar
                avatarUrl={item.subjectAvatarUrl}
                name={item.subjectName}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/85">{formatFeedLine(item)}</p>
                <time
                  className="text-[10px] tabular-nums text-white/40"
                  dateTime={item.createdAt}
                >
                  {new Date(item.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'America/Chicago',
                  })}
                </time>
              </div>
            </li>
          ),
        )}
      </ul>
    </section>
  );
});
