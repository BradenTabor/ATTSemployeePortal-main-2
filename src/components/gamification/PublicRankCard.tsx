import { memo } from 'react';
import { Medal, Sparkles } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { formatTierLabel, getPrestigeLabel, getTierTheme } from '@/lib/gamification/tiers';
import { TierProgressBar } from './TierProgressBar';
import { WeeklyStreakChip } from './WeeklyStreakChip';
import type { PublicGamificationProfile } from '@/lib/gamification/types';

interface PublicRankCardProps {
  profile: PublicGamificationProfile | null | undefined;
  isLoading?: boolean;
  rank?: number;
  className?: string;
}

function topBadges(profile: PublicGamificationProfile, limit = 4) {
  return [...profile.badges]
    .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
    .slice(0, limit);
}

export const PublicRankCard = memo(function PublicRankCard({
  profile,
  isLoading,
  rank,
  className,
}: PublicRankCardProps) {
  if (isLoading) {
    return (
      <div className={cn(glass.subtle, 'h-40 animate-pulse rounded-xl', className)} aria-busy="true" />
    );
  }

  if (!profile?.eligible || !profile.level) {
    return (
      <div className={cn(glass.subtle, 'rounded-xl p-4 text-sm text-white/50', className)} role="status">
        Profile not available for standings.
      </div>
    );
  }

  const theme = getTierTheme(profile.level.tierKey);
  const badges = topBadges(profile);
  const tenureBadge = profile.badges.find((b) =>
    ['one_ring', 'five_rings', 'old_timber'].includes(b.badgeKey),
  );

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 p-4',
        className,
      )}
      style={{
        boxShadow: `0 4px 24px ${theme.glow}`,
        backgroundColor: 'rgba(6, 10, 8, 0.95)',
      }}
      data-testid={rank != null ? `rank-card-${rank}` : 'public-rank-card'}
    >
      <div className="flex items-start gap-3">
        {rank != null && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-amber-300"
            aria-label={`Rank ${rank}`}
          >
            #{rank}
          </div>
        )}
        <UserAvatar
          avatarUrl={profile.avatarUrl}
          name={profile.fullName}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{profile.fullName ?? 'Crew member'}</p>
          <p className={cn('text-xs font-semibold', theme.accentClass)}>
            {formatTierLabel(profile.level.tierName, profile.level.subLevelLabel)}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <WeeklyStreakChip weeks={profile.weeklyStreak?.currentStreakWeeks ?? 0} />
            {tenureBadge?.title && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                <Medal className="h-3 w-3" aria-hidden />
                {tenureBadge.title}
              </span>
            )}
          </div>
        </div>
      </div>

      <TierProgressBar level={profile.level} compact className="mt-3" showLabels={false} />

      {badges.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Top badges">
          {badges.map((b) => (
            <li
              key={`${b.badgeKey}-${b.prestigeTier}`}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/75"
            >
              <Sparkles className="h-3 w-3 text-amber-300/80" aria-hidden />
              {b.title}
              {(b.prestigeMax ?? 1) > 1 && (
                <span className="text-amber-300/90">{getPrestigeLabel(b.prestigeTier)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
});
