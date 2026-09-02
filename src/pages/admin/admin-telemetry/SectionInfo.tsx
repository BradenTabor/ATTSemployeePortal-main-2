/**
 * SectionInfo — small "(i)" toggle that reveals a plain-language explanation of
 * a telemetry section so non-technical admins understand what they're looking at.
 *
 * Self-contained: renders the trigger button plus an animated popover and a
 * click-away backdrop. The popover anchors to the nearest positioned ancestor
 * (mark the section header `relative`) and spans its full width via
 * `left-0 right-0`, which keeps it on-screen on every viewport without manual
 * positioning math. Closes on the trigger, the backdrop, or Escape.
 */

import { useEffect, useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SectionInfoTone = 'emerald' | 'blue' | 'amber' | 'red' | 'purple' | 'neutral';

const TONE: Record<SectionInfoTone, { button: string; border: string; title: string }> = {
  emerald: {
    button: 'text-emerald-300/70 border-emerald-500/25 hover:text-emerald-200 hover:bg-emerald-500/10',
    border: 'border-emerald-500/30',
    title: 'text-emerald-200',
  },
  blue: {
    button: 'text-blue-300/70 border-blue-500/25 hover:text-blue-200 hover:bg-blue-500/10',
    border: 'border-blue-500/30',
    title: 'text-blue-200',
  },
  amber: {
    button: 'text-amber-300/70 border-amber-500/25 hover:text-amber-200 hover:bg-amber-500/10',
    border: 'border-amber-500/30',
    title: 'text-amber-200',
  },
  red: {
    button: 'text-red-300/70 border-red-500/25 hover:text-red-200 hover:bg-red-500/10',
    border: 'border-red-500/30',
    title: 'text-red-200',
  },
  purple: {
    button: 'text-purple-300/70 border-purple-500/25 hover:text-purple-200 hover:bg-purple-500/10',
    border: 'border-purple-500/30',
    title: 'text-purple-200',
  },
  neutral: {
    button: 'text-white/50 border-white/15 hover:text-white/80 hover:bg-white/10',
    border: 'border-white/15',
    title: 'text-white/80',
  },
};

interface SectionInfoProps {
  /** Heading shown at the top of the popover (also used for the trigger's aria-label). */
  title: string;
  /** Plain-language explanation. */
  children: ReactNode;
  tone?: SectionInfoTone;
  /** Override the trigger's accessible label (defaults to `About <title>`). */
  label?: string;
  className?: string;
}

export function SectionInfo({ title, children, tone = 'neutral', label, className }: SectionInfoProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const t = TONE[tone];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label ?? `About ${title}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          'tap-44 relative shrink-0 inline-flex items-center justify-center w-5 h-5 sm:w-[1.375rem] sm:h-[1.375rem] rounded-full border transition-colors',
          'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400',
          t.button,
          open && 'ring-1 ring-white/20',
          className,
        )}
      >
        <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-away backdrop */}
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <motion.div
              id={panelId}
              role="region"
              aria-label={title}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
              className={cn(
                'absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border p-3 shadow-xl shadow-black/50',
                'bg-[#0B100D]/95 backdrop-blur-md',
                t.border,
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className={cn('text-[11px] sm:text-xs font-semibold uppercase tracking-wide', t.title)}>
                  {title}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="shrink-0 -mt-0.5 -mr-0.5 p-0.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-400"
                >
                  <X className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
              <div className="text-[11px] sm:text-xs leading-relaxed text-white/70 space-y-1.5 [&_b]:text-white/90 [&_b]:font-semibold">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default SectionInfo;
