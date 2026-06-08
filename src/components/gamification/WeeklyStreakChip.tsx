import { memo } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeeklyStreakChipProps {
  weeks: number;
  className?: string;
  size?: 'sm' | 'md';
}

/** Weekly streak — never bare "Streak" in UI copy. */
export const WeeklyStreakChip = memo(function WeeklyStreakChip({
  weeks,
  className,
  size = 'sm',
}: WeeklyStreakChipProps) {
  if (weeks <= 0) return null;

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const textSize = size === 'sm' ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-orange-400/30 bg-orange-500/10 px-2 py-0.5 font-medium text-orange-200',
        textSize,
        className,
      )}
      title={`${weeks}-week weekly streak`}
    >
      <Flame className={cn(iconSize, 'text-orange-400')} aria-hidden />
      <span>
        {weeks}-week weekly streak
      </span>
    </span>
  );
});
