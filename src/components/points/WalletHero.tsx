import { motion } from 'framer-motion';
import { Trophy, Wallet } from 'lucide-react';
import { glass } from '@/lib/glass';
import { cn } from '@/lib/utils';

const pageEnter = { duration: 0.2 };

export interface WalletHeroProps {
  balance: number;
  isLoading?: boolean;
  label?: string;
  subtitle: string;
  headingId: string;
  testId: string;
  className?: string;
  /** lg = text-4xl (default). md = text-3xl for denser pages e.g. Rewards Store catalog. */
  size?: 'lg' | 'md';
}

export function WalletHero({
  balance,
  isLoading = false,
  label = 'Your balance',
  subtitle,
  headingId,
  testId,
  className,
  size = 'lg',
}: WalletHeroProps) {
  const isLarge = size === 'lg';

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...pageEnter, delay: 0.05 }}
      aria-labelledby={headingId}
      className={cn(glass.cardGold, 'p-5', className)}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f4c979]/15">
          <Wallet className="h-5 w-5 text-[#f4c979]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-xs uppercase tracking-wider text-white/50">
            {label}
          </h2>
          {isLoading ? (
            <div className={cn('mt-1 h-10 w-28 animate-pulse rounded-lg', glass.subtleGold)} />
          ) : (
            <p
              className={cn(
                'mt-0.5 flex items-center gap-2 font-bold tabular-nums text-[#f4c979]',
                isLarge ? 'text-4xl' : 'text-3xl',
              )}
            >
              <Trophy
                className={cn('text-amber-400', isLarge ? 'h-8 w-8' : 'h-7 w-7')}
                aria-hidden
              />
              {balance}
              <span
                className={cn(
                  'font-semibold text-amber-400/70',
                  isLarge ? 'text-lg' : 'text-base',
                )}
              >
                pts
              </span>
            </p>
          )}
          <p className="mt-1 text-xs text-white/50">{subtitle}</p>
        </div>
      </div>
    </motion.section>
  );
}
