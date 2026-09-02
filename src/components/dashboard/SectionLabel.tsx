/**
 * SectionLabel — Canopy eyebrow heading for dashboard zones.
 *
 * Mono, uppercase, tracked instrument label with a hairline leader that runs to
 * the trailing action slot. Optional count chip. The `tone` prop keeps the
 * legacy role names but resolves them to Canopy tokens.
 */

import type { ReactNode } from 'react';

export type SectionLabelTone =
  | 'rose'
  | 'gold'
  | 'emerald'
  | 'blue'
  | 'purple'
  | 'neutral';

const TONE_TEXT: Record<SectionLabelTone, string> = {
  rose: 'text-red-200/80',
  gold: 'text-lime-300/90',
  emerald: 'text-verdant-300/90',
  blue: 'text-glacier-300/90',
  purple: 'text-moss-300/90',
  neutral: 'text-bone-400',
};

const TONE_DOT: Record<SectionLabelTone, string> = {
  rose: 'bg-red-300',
  gold: 'bg-lime-300',
  emerald: 'bg-verdant-300',
  blue: 'bg-glacier-300',
  purple: 'bg-moss-300',
  neutral: 'bg-bone-400',
};

interface SectionLabelProps {
  children: ReactNode;
  /** Optional small count chip rendered after the label. */
  count?: number;
  /** Optional trailing content (right-aligned). */
  action?: ReactNode;
  className?: string;
  /** Accent tone for the label text. Defaults to rose (Safety Officer). */
  tone?: SectionLabelTone;
}

export default function SectionLabel({
  children,
  count,
  action,
  className = '',
  tone = 'rose',
}: SectionLabelProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      <p className={`font-mono text-[10px] uppercase tracking-[0.22em] ${TONE_TEXT[tone]}`}>
        {children}
      </p>
      {count != null && (
        <span className="rounded-md border border-bone-50/[0.08] bg-bone-50/[0.04] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-bone-400">
          {count}
        </span>
      )}
      <span aria-hidden className="h-px flex-1 bg-bone-50/[0.08]" />
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  );
}
