import { memo } from 'react';
import { Award, Lock } from 'lucide-react';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { getPrestigeLabel } from '@/lib/gamification/tiers';
import type { BadgeProgressItem } from '@/lib/gamification/types';

interface BadgeCaseProps {
  items: BadgeProgressItem[];
  isLoading?: boolean;
  className?: string;
}

function BadgeCaseSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading badges">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={cn('h-28 animate-pulse rounded-xl', glass.subtle)} />
      ))}
    </div>
  );
}

export const BadgeCase = memo(function BadgeCase({ items, isLoading, className }: BadgeCaseProps) {
  if (isLoading) return <BadgeCaseSkeleton />;

  if (!items.length) {
    return (
      <div className={cn(glass.subtle, 'rounded-xl p-8 text-center', className)}>
        <Award className="mx-auto mb-3 h-10 w-10 text-amber-400/40" aria-hidden />
        <p className="text-sm font-medium text-white/70">Badges unlock as you work</p>
        <p className="mt-1 text-xs text-white/45">Certs, near-misses, and weekly streaks all count.</p>
      </div>
    );
  }

  return (
    <ul className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)} data-testid="badge-case">
      {items.map((item) => {
        const maxEarned = item.earnedTiers.length > 0 ? Math.max(...item.earnedTiers) : 0;
        const fullyEarned = maxEarned >= item.prestigeMax;
        const progressPct =
          item.nextThreshold != null && item.nextThreshold > 0
            ? Math.min((item.currentValue / item.nextThreshold) * 100, 100)
            : fullyEarned
              ? 100
              : 0;

        return (
          <li
            key={item.badgeKey}
            className={cn(glass.subtle, 'rounded-xl border border-white/10 p-4')}
            data-testid={`badge-case-${item.badgeKey}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-white/45">{item.description}</p>
              </div>
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  fullyEarned ? 'bg-amber-500/15' : 'bg-white/5',
                )}
                aria-hidden
              >
                {fullyEarned ? (
                  <Award className="h-4 w-4 text-amber-300" />
                ) : (
                  <Lock className="h-4 w-4 text-white/30" />
                )}
              </div>
            </div>

            {maxEarned > 0 && (
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-emerald-300/90">
                Earned · {getPrestigeLabel(maxEarned)}
                {item.prestigeMax > 1 && ` (${maxEarned}/${item.prestigeMax})`}
              </p>
            )}

            {!fullyEarned && item.remainingToNext != null && item.nextPrestigeLabel && (
              <>
                <p className="mb-1.5 text-xs text-white/60">
                  <span className="font-semibold text-amber-200">{item.remainingToNext}</span>
                  {' '}from {item.nextPrestigeLabel}
                </p>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-black/40"
                  role="progressbar"
                  aria-valuenow={Math.round(progressPct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progress toward ${item.nextPrestigeLabel} ${item.title}`}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-300 transition-[width] duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </>
            )}

            {fullyEarned && (
              <p className="text-xs font-medium text-amber-200/90">Max prestige — locked in</p>
            )}
          </li>
        );
      })}
    </ul>
  );
});
