/**
 * Briefing design tokens.
 * Mapped onto the Canopy system (ink / bone / verdant). Do not use type-display
 * or 0.22em instrument tracking on this page — both produced ghosted, unreadable
 * type on the previous briefing.
 */

export const briefingFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-verdant-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950';

export const briefing = {
  page: 'relative min-h-dvh-safe bg-ink-950 text-bone-50',
  label: 'text-xs font-medium text-verdant-300',
  title: 'text-[1.5rem] sm:text-[1.75rem] font-semibold text-bone-50 tracking-tight leading-tight',
  subtitle: 'text-sm text-bone-200/70 leading-relaxed',
  body: 'text-[15px] text-bone-100/85 leading-relaxed',
  cardPad: 'p-5',
  option:
    'w-full flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm min-h-[48px] transition-colors duration-150',
  optionIdle:
    'border-bone-50/10 bg-ink-900/80 text-bone-100/85 hover:border-bone-50/20 hover:bg-ink-800',
  optionSelected: 'border-verdant-400/40 bg-verdant-500/10 text-bone-50',
  optionCorrect: 'border-verdant-400/50 bg-verdant-500/15 text-bone-50',
  optionWrong: 'border-red-400/45 bg-red-500/10 text-bone-50',
  cta:
    'w-full inline-flex items-center justify-center gap-2 rounded-xl bg-verdant-400 px-5 py-4 min-h-[52px] text-sm font-semibold text-ink-950 ' +
    'hover:bg-lime-400 active:scale-[0.98] transition-[transform,background-color] duration-150 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  ctaGhost:
    'w-full inline-flex items-center justify-center gap-2 rounded-xl border border-bone-50/14 bg-ink-900/70 px-5 py-4 min-h-[52px] text-sm font-semibold text-bone-50 ' +
    'hover:border-verdant-400/40 hover:bg-ink-800 active:scale-[0.98] transition-[transform,border-color,background-color] duration-150 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
} as const;
