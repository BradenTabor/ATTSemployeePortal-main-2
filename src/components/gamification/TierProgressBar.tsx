import { memo } from 'react';
import { cn } from '@/lib/utils';
import { formatTierLabel, getTierTheme } from '@/lib/gamification/tiers';
import type { UserLevel } from '@/lib/gamification/types';

interface TierProgressBarProps {
  level: UserLevel;
  className?: string;
  showLabels?: boolean;
  compact?: boolean;
}

export const TierProgressBar = memo(function TierProgressBar({
  level,
  className,
  showLabels = true,
  compact = false,
}: TierProgressBarProps) {
  const theme = getTierTheme(level.tierKey);
  const pct = Math.min(Math.max(level.progressPct, 0), 100);
  const atMax = level.nextThreshold == null;

  return (
    <div className={cn('w-full', className)}>
      {showLabels && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className={cn('font-semibold tracking-tight text-white', compact ? 'text-xs' : 'text-sm')}>
            <span className={theme.accentClass}>
              {formatTierLabel(level.tierName, level.subLevelLabel)}
            </span>
          </span>
          <span className="text-[10px] tabular-nums text-white/50 sm:text-xs">
            {level.lifetimeEarned} earned
            {!atMax && level.nextThreshold != null && (
              <> · {level.nextThreshold - level.lifetimeEarned} to next</>
            )}
          </span>
        </div>
      )}
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10"
        role="progressbar"
        aria-valuenow={atMax ? 100 : pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress toward next sub-level: ${pct}%`}
      >
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-[width] duration-500', theme.barClass)}
          style={{ width: `${atMax ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
});
