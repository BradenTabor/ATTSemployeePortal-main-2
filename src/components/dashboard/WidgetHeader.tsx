/**
 * WidgetHeader — shared premium header for dashboard widget cards.
 *
 * Standardizes the icon chip + title (+ optional trailing action/value) row so
 * every card on a dashboard reads with the same hierarchy. Defaults to the
 * Safety Officer rose accent; pass `iconClassName` / `chipClassName` to retint
 * for other roles. Keeps the title in an <h3> so existing text-based tests and
 * the accessibility tree are unchanged.
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface WidgetHeaderProps {
  title: string;
  icon?: LucideIcon;
  /** Tailwind text color for the icon (default rose). */
  iconClassName?: string;
  /** Tailwind bg/border classes for the icon chip (default rose). */
  chipClassName?: string;
  /** Optional right-aligned content (value, badge, button). */
  action?: ReactNode;
  /** Extra classes for the wrapper. */
  className?: string;
}

export default function WidgetHeader({
  title,
  icon: Icon,
  iconClassName = 'text-rose-300',
  chipClassName = 'bg-rose-500/10 border-rose-500/20',
  action,
  className = '',
}: WidgetHeaderProps) {
  return (
    <div className={`flex items-center gap-2.5 mb-4 ${className}`}>
      {Icon && (
        <div
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${chipClassName}`}
          aria-hidden
        >
          <Icon className={`w-4 h-4 ${iconClassName}`} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-white truncate min-w-0 flex-1">{title}</h3>
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  );
}
