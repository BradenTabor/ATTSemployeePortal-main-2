/**
 * ProgressWidget — compact dashboard gamification card.
 * Tier + sub-level bar, weekly streak, next milestone. Reads get_user_level (lifetime earned).
 */

import { memo, useMemo, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Target, TreePine } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserLevel, useWeeklyStreak } from '@/hooks/gamification';
import { getDeviceCapabilities } from '@/lib/mobilePerf';
import { canopy } from '@/lib/glass';
import { Eyebrow } from '@/components/canopy/Eyebrow';
import { LeafGlyph } from '@/components/canopy/LeafGlyph';
import { EASE_CANOPY } from '@/motion/presets';
import { cn } from '@/lib/utils';
import { formatTierLabel, getTierTheme, GROWTH_TEXTURE_STYLE } from '@/lib/gamification/tiers';
import { TierProgressBar } from './TierProgressBar';
import { WeeklyStreakChip } from './WeeklyStreakChip';

const Phase2DashboardChallengeStrip = lazy(
  () => import('./Phase2DashboardChallengeStrip'),
);

export interface ProgressWidgetProps {
  /** Retained for API compatibility — the widget renders in Canopy tones. */
  theme?: 'emerald' | 'blue';
  className?: string;
}

function ProgressWidgetSkeleton() {
  return (
    <div
      className={cn('animate-pulse p-4', canopy.instrument)}
      aria-busy="true"
      aria-label="Loading progress"
    >
      <div className="flex gap-3">
        <div className="h-12 w-12 rounded-leaf-xs bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-white/10" />
          <div className="h-2.5 w-full rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  );
}

function ProgressWidgetComponent({ className }: ProgressWidgetProps) {
  const { user } = useAuth();
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const reducedMotion = caps.prefersReducedMotion;

  const { data: level, isLoading, isError } = useUserLevel(user?.id);
  const { data: streak } = useWeeklyStreak(user?.id);

  if (isLoading) return <ProgressWidgetSkeleton />;
  if (isError || !level) {
    return (
      <div
        className={cn(canopy.instrument, 'p-4 text-sm text-red-300/90', className)}
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
      initial={reducedMotion ? undefined : { opacity: 0, y: 12 }}
      animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_CANOPY }}
      className={cn(canopy.instrument, 'p-4 sm:p-5', className)}
      style={{ ...GROWTH_TEXTURE_STYLE, boxShadow: `0 18px 40px -20px ${tierTheme.glow}` }}
      data-testid="progress-widget"
      aria-labelledby="progress-widget-heading"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <Eyebrow tone="verdant" rule={false}>Growth</Eyebrow>
        <WeeklyStreakChip weeks={streak?.currentStreakWeeks ?? 0} />
      </div>

      <div className="relative flex items-start gap-3.5">
        <LeafGlyph tone="verdant" size={44} live>
          <TreePine className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </LeafGlyph>

        <div className="min-w-0 flex-1">
          <h2 id="progress-widget-heading" className="type-display text-xl leading-none text-bone-50 sm:text-2xl">
            {formatTierLabel(level.tierName, level.subLevelLabel)}
          </h2>

          <TierProgressBar level={level} compact showLabels={false} className="mb-2 mt-3" />

          <div className="flex items-start gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-bone-400">
            <Target className="mt-px h-3 w-3 shrink-0 text-verdant-300" aria-hidden />
            <span>{nextThing}</span>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
        <Phase2DashboardChallengeStrip />
      </Suspense>

      <Link
        to="/my-points"
        className="group mt-4 flex items-center justify-between gap-2 rounded-leaf-xs border border-bone-50/[0.1] bg-ink-950/60 px-3.5 py-2.5 transition-[border-color,background-color] duration-500 ease-canopy hover:border-verdant-400/50 hover:bg-ink-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
        data-testid="progress-widget-my-progress-link"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-200">My progress</span>
        <ArrowUpRight className="h-4 w-4 text-bone-50/40 transition-all duration-300 ease-canopy group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-verdant-300" aria-hidden />
      </Link>
    </motion.section>
  );
}

export const ProgressWidget = memo(ProgressWidgetComponent);
export default ProgressWidget;
