/**
 * ChallengeCard — active weekly/campaign challenge strip.
 * Returns null when Phase 2 challenges are off or no active challenge.
 */

import { memo } from 'react';
import { CheckCircle2, Crosshair, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useActiveChallenge,
  usePhase2GamificationFlags,
} from '@/hooks/gamification';
import { glass } from '@/lib/glass';
import { formatChicagoWeekLabel } from '@/lib/gamification/chicagoWeek';
import { cn } from '@/lib/utils';

export interface ChallengeCardProps {
  compact?: boolean;
  className?: string;
}

function ChallengeCardSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl border border-violet-400/15 bg-violet-500/[0.04]',
        compact ? 'h-14' : 'h-24',
        glass.subtle,
      )}
      aria-busy="true"
      aria-label="Loading challenge"
    />
  );
}

export const ChallengeCard = memo(function ChallengeCard({
  compact = false,
  className,
}: ChallengeCardProps) {
  const { user } = useAuth();
  const { data: flags } = usePhase2GamificationFlags();
  const showChallenges = flags?.showChallenges ?? false;

  const { data: challenge, isLoading, isError } = useActiveChallenge(
    user?.id,
    showChallenges,
  );

  if (!showChallenges) return null;
  if (isLoading) return <ChallengeCardSkeleton compact={compact} />;
  if (isError || !challenge) return null;

  const weekLabel = formatChicagoWeekLabel();
  const hasMultiplier = challenge.multiplier > 1;

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border border-violet-400/20',
        compact ? 'px-3 py-2.5' : 'p-4',
        className,
      )}
      style={{
        background:
          'linear-gradient(135deg, rgba(88, 28, 135, 0.18) 0%, rgba(8, 12, 10, 0.92) 55%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      data-testid="challenge-card"
      aria-labelledby="challenge-card-heading"
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-400/25',
            compact ? 'h-8 w-8' : 'h-10 w-10',
          )}
        >
          <Crosshair
            className={cn('text-violet-300', compact ? 'h-4 w-4' : 'h-5 w-5')}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              id="challenge-card-heading"
              className={cn('font-bold text-violet-100', compact ? 'text-xs' : 'text-sm')}
            >
              {challenge.title}
            </h3>
            {hasMultiplier && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                <Zap className="h-3 w-3" aria-hidden />
                {challenge.multiplier}x
              </span>
            )}
            {challenge.completedThisWindow && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Done
              </span>
            )}
          </div>

          {!compact && challenge.description && (
            <p className="mt-1 text-xs leading-relaxed text-white/55">{challenge.description}</p>
          )}

          <p className={cn('text-white/45', compact ? 'mt-0.5 text-[10px]' : 'mt-2 text-xs')}>
            <span className="text-violet-300/80">{weekLabel}</span>
            {' · '}
            {challenge.rewardPoints} pts
            {challenge.campaignKey ? ' · campaign boost' : ' · weekly challenge'}
          </p>
        </div>
      </div>
    </article>
  );
});
