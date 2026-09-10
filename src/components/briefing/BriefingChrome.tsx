import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Loader2, Shield } from 'lucide-react';
import { createPortal } from 'react-dom';
import { glass } from '@/lib/glass';
import { Z } from '@/lib/zIndex';
import { cn } from '@/lib/utils';
import {
  BRIEFING_COPY,
  BRIEFING_STEPS,
  STEP_COPY,
  briefing,
  briefingFocusRing,
  type BriefingStepId,
  type KnowledgeScore,
} from '@/lib/briefing';

const STEP_TRANS = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] };

export function BriefingAtmosphere() {
  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ zIndex: -1 }}
      aria-hidden="true"
    >
      <div className="absolute -top-24 -right-16 h-80 w-80 rounded-full bg-verdant-400/[0.09] blur-[60px]" />
      <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-amber-500/[0.05] blur-[50px]" />
    </div>
  );
}

export function BriefingLoadingState() {
  return (
    <div className={cn(briefing.page, 'overflow-hidden')}>
      <BriefingAtmosphere />
      <main className="relative z-10 flex min-h-dvh-safe flex-col items-center justify-center p-6" aria-busy="true">
        <h1 className="sr-only">{BRIEFING_COPY.pageTitle}</h1>
        <div className={cn(glass.card, 'w-full max-w-sm px-6 py-10 text-center')}>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-verdant-400/25 bg-verdant-500/10">
            <Shield className="h-7 w-7 text-verdant-300" aria-hidden />
          </div>
          <p className="text-sm font-semibold text-bone-50">{BRIEFING_COPY.loadingTitle}</p>
          <p className="mt-2 text-xs text-bone-200/60 leading-relaxed">{BRIEFING_COPY.loadingBody}</p>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-bone-50/10" role="status" aria-label="Loading">
            <div className="h-full w-2/5 rounded-full bg-verdant-400 animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}

export function BriefingHeader({
  step,
  progress,
}: {
  step: BriefingStepId;
  progress: number;
}) {
  const stepIndex = BRIEFING_STEPS.indexOf(step);

  return (
    <header
      className="sticky top-0 border-b border-bone-50/[0.06] bg-ink-950/95 pt-[env(safe-area-inset-top)]"
      style={{ zIndex: Z.sticky }}
    >
      <a href="#briefing-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-ink-800 focus:px-3 focus:py-2 focus:text-sm focus:text-bone-50">
        {BRIEFING_COPY.skipToContent}
      </a>
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-verdant-400/25 bg-verdant-500/10">
          <Shield className="h-5 w-5 text-verdant-300" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-bone-50 tracking-tight">{BRIEFING_COPY.pageTitle}</h1>
          <p className="truncate text-xs text-bone-200/55">{BRIEFING_COPY.pageSubtitle}</p>
        </div>
        <p className="shrink-0 font-mono text-[11px] tabular-nums text-bone-200/45">
          {String(stepIndex + 1).padStart(2, '0')}/04
        </p>
      </div>

      <nav aria-label="Briefing steps" className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-4 pb-3">
        {BRIEFING_STEPS.map((id, i) => {
          const active = i === stepIndex;
          const done = i < stepIndex;
          return (
            <div key={id} className="min-w-0">
              <div
                className={cn(
                  'h-1 rounded-full',
                  done || active ? 'bg-verdant-400' : 'bg-bone-50/10',
                )}
                aria-hidden
              />
              <p
                className={cn(
                  'mt-1.5 truncate text-[11px] font-medium',
                  active ? 'text-verdant-300' : done ? 'text-bone-200/55' : 'text-bone-200/35',
                )}
              >
                {STEP_COPY[id].label}
              </p>
            </div>
          );
        })}
      </nav>

      <div className="h-0.5 bg-bone-50/5" aria-hidden>
        <div
          className="h-full bg-verdant-400 transition-[width] duration-150"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>
    </header>
  );
}

export function BriefingSuccessOverlay({
  claimed,
  rememberLine,
  score,
  countdown,
  onGo,
}: {
  claimed: boolean;
  rememberLine: string;
  score: KnowledgeScore;
  countdown: number;
  onGo: () => void;
}) {
  const reduce = useReducedMotion();

  return createPortal(
    <motion.div
      style={{ zIndex: Z.modal }}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex flex-col items-center justify-center bg-ink-950/92 p-6"
      role="alertdialog"
      aria-labelledby="briefing-success-title"
      aria-modal="true"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={STEP_TRANS}
        className={cn(glass.success, 'w-full max-w-sm p-6 text-center')}
      >
        <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border border-verdant-400/30 bg-verdant-500/15">
          <CheckCircle2 className="h-8 w-8 text-verdant-300" aria-hidden />
        </div>
        <h2 id="briefing-success-title" className="text-lg font-semibold text-bone-50">
          {claimed ? BRIEFING_COPY.successClaimed : BRIEFING_COPY.successTitle}
        </h2>
        {score.total > 0 && (
          <p className="mt-2 font-mono text-sm tabular-nums text-verdant-200">
            {score.correct}/{score.total} knowledge checks
          </p>
        )}
        <p className="mt-3 text-sm font-medium text-verdant-100/90">
          {BRIEFING_COPY.successRemember}: {rememberLine}
        </p>
        {countdown > 0 && (
          <p className="mt-3 font-mono text-xs tabular-nums text-bone-200/45">
            {BRIEFING_COPY.dashboardIn} {countdown}…
          </p>
        )}
        <button type="button" onClick={onGo} className={cn(briefing.cta, briefingFocusRing, 'mt-5')}>
          {BRIEFING_COPY.goDashboard}
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function BriefingFooterCta({
  label,
  disabled,
  pending,
  onClick,
  variant = 'primary',
}: {
  label: string;
  disabled?: boolean;
  pending?: boolean;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
}) {
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={onClick}
      className={cn(variant === 'primary' ? briefing.cta : briefing.ctaGhost, briefingFocusRing)}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {pending ? BRIEFING_COPY.submitting : label}
    </button>
  );
}
