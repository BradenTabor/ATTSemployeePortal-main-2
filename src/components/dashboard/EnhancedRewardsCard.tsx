/**
 * EnhancedRewardsCard — dashboard wrapper around ProgressWidget + hub links.
 * Legacy export kept for ForemanDashboard; tier ladder reads get_user_level (not wallet).
 */

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ProgressWidget } from '@/components/gamification/ProgressWidget';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';

interface EnhancedRewardsCardProps {
  theme?: 'emerald' | 'blue';
  /** @deprecated Wallet balance no longer drives tier display; kept for API compat. */
  onPointsChange?: (points: number) => void;
}

function EnhancedRewardsCardComponent({
  theme = 'emerald',
}: EnhancedRewardsCardProps) {
  const linkBorder =
    theme === 'blue' ? 'hover:border-blue-400/30' : 'hover:border-emerald-400/30';

  return (
    <div className="space-y-2" data-testid="enhanced-rewards-card">
      <ProgressWidget theme={theme} />

      <Link
        to="/safety-rewards"
        className={cn(
          glass.subtle,
          'flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
          linkBorder,
        )}
      >
        <span className="text-xs font-medium sm:text-sm">Monthly raffle & prizes</span>
        <ChevronRight className="h-4 w-4 text-emerald-400/70" aria-hidden />
      </Link>
      <Link
        to="/rewards-store"
        className={cn(
          glass.subtle,
          'flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-white/90 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
          linkBorder,
        )}
      >
        <span className="text-xs font-medium sm:text-sm">Rewards store</span>
        <ChevronRight className="h-4 w-4 text-emerald-400/70" aria-hidden />
      </Link>
    </div>
  );
}

export const EnhancedRewardsCard = memo(EnhancedRewardsCardComponent);
export default EnhancedRewardsCard;
