import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useDashboardCardTheme } from '../../contexts/dashboardCardTheme';
import {
  WAYS_TO_EARN_CATEGORY_LABELS,
  WAYS_TO_EARN_CATEGORY_ORDER,
  getRulesByCategory,
} from './waysToEarnRules';

interface WaysToEarnProps {
  className?: string;
}

function PointsBadge({ points }: { points: number }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 shrink-0 tabular-nums">
      <span className="text-base sm:text-lg font-bold text-amber-300">{points}</span>
      <span className="text-[10px] font-medium text-amber-400/60 uppercase">pt{points === 1 ? '' : 's'}</span>
    </span>
  );
}

export default function WaysToEarn({ className }: WaysToEarnProps) {
  const shouldReduce = useReducedMotion();
  const { cardClass, subtleClass } = useDashboardCardTheme();

  return (
    <motion.section
      aria-labelledby="ways-to-earn-heading"
      initial={shouldReduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        cardClass,
        'overflow-hidden border-[#f6dcb2]/15 bg-gradient-to-br from-[#14110d] via-[#0b0906] to-[#050403]',
        className,
      )}
    >
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-[#f6dcb2]/10">
        <div className="flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-400/20 to-amber-600/10 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2
              id="ways-to-earn-heading"
              className="text-base sm:text-lg font-semibold text-white leading-snug"
            >
              Ways to Earn
            </h2>
            <p className="text-xs sm:text-sm text-[#f6dcb2]/50 mt-0.5">
              Safety points you can earn across daily work, reporting, and certifications.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-6">
        {WAYS_TO_EARN_CATEGORY_ORDER.map((category) => {
          const rules = getRulesByCategory(category);

          return (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#f6dcb2]/70 mb-3">
                {WAYS_TO_EARN_CATEGORY_LABELS[category]}
              </h3>
              <ul className="space-y-2" aria-label={WAYS_TO_EARN_CATEGORY_LABELS[category]}>
                {rules.map((rule) => (
                  <li
                    key={rule.id}
                    className={cn(subtleClass, 'p-3 sm:p-3.5 border-[#f6dcb2]/10')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white/90">{rule.name}</p>
                        <p className="text-xs sm:text-sm text-white/60 mt-0.5 leading-relaxed">
                          {rule.description}
                        </p>
                        {rule.caveat ? (
                          <p className="text-xs text-amber-200/70 mt-1.5 leading-relaxed">
                            {rule.caveat}
                          </p>
                        ) : null}
                      </div>
                      <PointsBadge points={rule.points} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-[#f6dcb2]/10">
        <Link
          to="/my-points"
          className="flex items-center justify-between gap-2 py-2 text-xs sm:text-sm text-[#f6dcb2]/70 hover:text-[#f6dcb2] transition-colors"
        >
          <span>View your points balance & activity</span>
          <ChevronRight className="w-4 h-4 shrink-0" aria-hidden />
        </Link>
      </div>
    </motion.section>
  );
}
