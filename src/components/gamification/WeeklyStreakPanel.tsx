import { memo } from 'react';
import { Flame, Snowflake } from 'lucide-react';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';
import type { WeeklyStreakState } from '@/lib/gamification/types';

interface WeeklyStreakPanelProps {
  streak: WeeklyStreakState | undefined;
  isLoading?: boolean;
  className?: string;
}

export const WeeklyStreakPanel = memo(function WeeklyStreakPanel({
  streak,
  isLoading,
  className,
}: WeeklyStreakPanelProps) {
  if (isLoading) {
    return (
      <div
        className={cn(glass.subtle, 'h-36 animate-pulse rounded-xl', className)}
        aria-busy="true"
        aria-label="Loading weekly streak"
      />
    );
  }

  const current = streak?.currentStreakWeeks ?? 0;
  const longest = streak?.longestStreak ?? 0;
  const freezes = streak?.freezesRemaining ?? 0;

  return (
    <section
      className={cn(glass.subtle, 'rounded-xl border border-orange-500/20 p-4', className)}
      aria-labelledby="weekly-streak-heading"
      data-testid="weekly-streak-panel"
    >
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-4 w-4 text-orange-400" aria-hidden />
        <h3 id="weekly-streak-heading" className="text-sm font-semibold text-white">
          Weekly streak
        </h3>
      </div>

      <p className="text-3xl font-bold tabular-nums text-orange-300">
        {current}
        <span className="ml-1.5 text-base font-semibold text-white/50">weeks</span>
      </p>
      <p className="mt-1 text-xs text-white/50">
        Meaningful safety actions each ISO week (Mon–Fri, Central). RTO weeks auto-protect.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className={cn(glass.subtle, 'rounded-lg p-2.5')}>
          <dt className="text-white/45">Longest run</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-white">{longest} wks</dd>
        </div>
        <div className={cn(glass.subtle, 'rounded-lg p-2.5')}>
          <dt className="flex items-center gap-1 text-white/45">
            <Snowflake className="h-3 w-3 text-sky-300" aria-hidden />
            Freezes left
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-white">{freezes}</dd>
        </div>
      </dl>

      <p className="mt-3 text-[10px] leading-relaxed text-white/40">
        Lit badge tracks weekly streak milestones. Briefing streak (raffle bonuses) is separate.
      </p>
    </section>
  );
});
