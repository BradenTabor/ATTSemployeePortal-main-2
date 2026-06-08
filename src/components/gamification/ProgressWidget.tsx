/**
 * ProgressWidget — compact dashboard gamification card.
 * Tier + sub-level bar, weekly streak, next milestone. Reads get_user_level (lifetime earned).
 */

import { memo, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Target, TreePine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserLevel, useWeeklyStreak } from '@/hooks/gamification';
import { getDeviceCapabilities } from '@/lib/mobilePerf';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';
import { formatTierLabel, getTierTheme, GROWTH_TEXTURE_STYLE } from '@/lib/gamification/tiers';
import { TierProgressBar } from './TierProgressBar';
import { WeeklyStreakChip } from './WeeklyStreakChip';

const Phase2DashboardChallengeStrip = lazy(
  () => import('./Phase2DashboardChallengeStrip'),
);

export interface ProgressWidgetProps {
  theme?: 'emerald' | 'blue';
  className?: string;
}

const themeBorder = {
  emerald: 'border-emerald-400/20',
  blue: 'border-blue-400/20',
};

function ProgressWidgetSkeleton({ theme = 'emerald' }: { theme?: 'emerald' | 'blue' }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl border p-4',
        themeBorder[theme],
        glass.subtle,
      )}
      aria-busy="true"
      aria-label="Loading progress"
    >
      <div className="flex gap-3">
        <div className="h-12 w-12 rounded-xl bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="h-2.5 w-full rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  );
}

function ProgressWidgetComponent({ theme = 'emerald', className }: ProgressWidgetProps) {
  const { user } = useAuth();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const reducedMotion = caps.prefersReducedMotion;

  const { data: level, isLoading, isError } = useUserLevel(user?.id);
  const { data: streak } = useWeeklyStreak(user?.id);

  if (isLoading) return <ProgressWidgetSkeleton theme={theme} />;
  if (isError || !level) {
    return (
      <div
        className={cn('rounded-2xl border p-4 text-sm text-red-300/90', themeBorder[theme], className)}
        role="alert"
      >
        Could not load your progress. Try again shortly.
      </div>
    );
  }

  const tierTheme = getTierTheme(level.tierKey);
  const nextThing =
    level.nextThreshold != null
      ? `${level.nextThreshold - level.lifetimeEarned} pts to next sub-level`
      : 'Top of the ladder — hold the line';

  return (
    <motion.section
      initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border p-3 sm:p-4',
        themeBorder[theme],
        className,
      )}
      style={{
        ...GROWTH_TEXTURE_STYLE,
        boxShadow: `0 8px 32px ${tierTheme.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
        backgroundColor: 'rgba(8, 12, 10, 0.92)',
      }}
      data-testid="progress-widget"
      aria-labelledby="progress-widget-heading"
    >
      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
            tierTheme.ringClass,
          )}
          style={{ background: `linear-gradient(145deg, ${tierTheme.glow}, rgba(0,0,0,0.5))` }}
        >
          <TreePine className={cn('h-5 w-5', tierTheme.accentClass)} aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2
              id="progress-widget-heading"
              className={cn('text-sm font-bold tracking-tight sm:text-base', tierTheme.accentClass)}
            >
              {formatTierLabel(level.tierName, level.subLevelLabel)}
            </h2>
            <WeeklyStreakChip weeks={streak?.currentStreakWeeks ?? 0} />
          </div>

          <TierProgressBar level={level} compact showLabels={false} className="mb-2" />

          <div className="flex items-start gap-1.5 text-[11px] text-white/55 sm:text-xs">
            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
            <span>{nextThing}</span>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <Phase2DashboardChallengeStrip />
      </Suspense>

      <Link
        to="/my-points"
        className={cn(
          glass.subtle,
          'mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-white/90 transition-colors hover:border-emerald-400/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
        )}
        data-testid="progress-widget-my-progress-link"
      >
        <span className="text-xs font-semibold sm:text-sm">My Progress</span>
        <ChevronRight className="h-4 w-4 text-emerald-400/70" aria-hidden />
      </Link>
    </motion.section>
  );
}

export const ProgressWidget = memo(ProgressWidgetComponent);
export default ProgressWidget;
