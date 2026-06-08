/**
 * SeasonFinaleStrip — rich rendering for season finale recognition events.
 * Most Improved surfaces here only — never on a ranked list.
 */

import { memo } from 'react';
import { Crown, Medal, TrendingUp } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';
import type { RecognitionFeedItem } from '@/lib/gamification/types';

interface SeasonFinaleStripProps {
  item: RecognitionFeedItem;
}

function podiumLabel(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `#${rank}`;
}

export const SeasonFinaleStrip = memo(function SeasonFinaleStrip({
  item,
}: SeasonFinaleStripProps) {
  const name = item.subjectName ?? 'A crew member';
  const payload = item.payload;
  const isPodium = item.eventType === 'season_podium';
  const isMostImproved = item.eventType === 'season_most_improved';

  const headline = isPodium
    ? `${name} finished ${podiumLabel(Number(payload.rank ?? 0))} this season`
    : `${name} earned Most Improved`;

  const detail = isPodium
    ? `${Number(payload.season_score ?? 0)} season pts`
    : `+${Number(payload.delta ?? 0)} vs baseline · ${Number(payload.current_score ?? 0)} season pts`;

  return (
    <article
      className={cn(
        glass.subtle,
        'relative overflow-hidden rounded-xl border p-3',
        isPodium ? 'border-amber-400/25' : 'border-emerald-400/25',
      )}
      style={{
        background: isPodium
          ? 'linear-gradient(135deg, rgba(180, 83, 9, 0.12) 0%, rgba(8, 12, 10, 0.95) 60%)'
          : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(8, 12, 10, 0.95) 60%)',
      }}
      data-testid={`season-finale-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1',
            isPodium
              ? 'bg-amber-500/15 ring-amber-400/30'
              : 'bg-emerald-500/15 ring-emerald-400/30',
          )}
        >
          {isPodium ? (
            <Crown className="h-4 w-4 text-amber-300" aria-hidden />
          ) : (
            <TrendingUp className="h-4 w-4 text-emerald-300" aria-hidden />
          )}
        </div>
        <UserAvatar avatarUrl={item.subjectAvatarUrl} name={item.subjectName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
            {isMostImproved && <Medal className="h-3.5 w-3.5 text-emerald-300" aria-hidden />}
            {headline}
          </p>
          <p className="mt-0.5 text-xs text-white/55">{detail}</p>
          <time
            className="mt-1 block text-[10px] tabular-nums text-white/40"
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
      </div>
    </article>
  );
});
