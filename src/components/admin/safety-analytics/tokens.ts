/** Readable analytics type. Never use type-display, type-instrument, or text-glow here. */
export const analyticsFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950';

export const analytics = {
  page: 'relative w-full max-w-6xl mx-auto space-y-4 sm:space-y-5',
  eyebrow: 'text-xs font-medium uppercase tracking-wide text-verdant-300/80',
  title: 'text-[1.5rem] sm:text-[1.75rem] font-semibold text-bone-50 tracking-tight leading-tight',
  subtitle: 'text-sm text-bone-200/65 leading-relaxed',
  label: 'text-xs font-medium text-bone-200/60',
  value: 'font-mono tabular-nums text-bone-50',
  hint: 'text-xs text-bone-200/50 leading-relaxed',
  chip:
    'inline-flex items-center gap-1.5 rounded-full border border-bone-50/10 bg-ink-950/70 px-2.5 py-1 text-[11px] text-bone-200/70',
} as const;

export function fillTone(value: number): string {
  if (value >= 80) return 'text-verdant-300';
  if (value >= 50) return 'text-amber-300';
  return 'text-rose-300';
}

export function fillBar(value: number): string {
  if (value >= 80) return 'bg-verdant-400';
  if (value >= 50) return 'bg-amber-400';
  return 'bg-rose-400';
}

export function scoreTone(score: number): string {
  if (score >= 80) return 'border-verdant-500/30 bg-verdant-500/15 text-verdant-200';
  if (score >= 50) return 'border-amber-500/30 bg-amber-500/15 text-amber-200';
  return 'border-rose-500/30 bg-rose-500/15 text-rose-200';
}
