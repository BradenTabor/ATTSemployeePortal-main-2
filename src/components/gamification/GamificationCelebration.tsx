/**
 * GamificationCelebration — tier-ups, badges, First Light welcome.
 * Mirrors RewardPointsCelebration patterns; calm fallback when prefers-reduced-motion.
 */

import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Sparkles, TreePine, ArrowRight } from 'lucide-react';
import { useGamificationCelebration } from '@/contexts/GamificationCelebrationContext';
import { getDeviceCapabilities } from '@/lib/mobilePerf';
import { Z } from '@/lib/zIndex';
import { getPrestigeLabel } from '@/lib/gamification/tiers';

const AUTO_DISMISS_MS = 7000;

export function GamificationCelebration() {
  const { state, dismissGamificationCelebration } = useGamificationCelebration();
  const isVisible = state.show;
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const reducedMotion = caps.prefersReducedMotion;
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissGamificationCelebration();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isVisible, dismissGamificationCelebration]);

  useEffect(() => {
    if (!isVisible) return;
    const body = document.body;
    const prev = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prev;
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    autoDismissRef.current = setTimeout(() => {
      dismissGamificationCelebration();
      autoDismissRef.current = null;
    }, AUTO_DISMISS_MS);
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [isVisible, dismissGamificationCelebration]);

  if (!isVisible) return null;

  const Icon =
    state.kind === 'first_light' ? TreePine : state.kind === 'tier_up' ? Sparkles : Award;

  const prestigeNote =
    state.prestigeTier != null
      ? getPrestigeLabel(state.prestigeTier)
      : null;

  const content = (
    <AnimatePresence>
      <motion.div
        style={{ zIndex: Z.modal }}
        className="fixed inset-0 flex items-center justify-center overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0.01 : 0.3 }}
        role="alertdialog"
        aria-modal="true"
        aria-label={state.title}
      >
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center"
          initial={reducedMotion ? { opacity: 0 } : { scale: 0.92, y: 16 }}
          animate={reducedMotion ? { opacity: 1 } : { scale: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { scale: 0.92, y: 16 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        >
          <div aria-live="assertive" aria-atomic="true" className="sr-only">
            {state.title}. {state.subtitle}
          </div>

          <div
            className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-700 via-emerald-700 to-teal-600 shadow-2xl shadow-emerald-900/40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), transparent 55%)',
            }}
          >
            <Icon className="h-8 w-8 text-white" aria-hidden />
          </div>

          <h2 className="mb-2 text-2xl font-bold tracking-tight text-white">{state.title}</h2>
          <p className="mb-2 text-sm text-white/65">{state.subtitle}</p>
          {prestigeNote && (
            <p className="mb-6 text-xs font-semibold uppercase tracking-wider text-amber-300/90">
              {prestigeNote} tier
            </p>
          )}
          {!prestigeNote && <div className="mb-6" />}

          <button
            type="button"
            onClick={dismissGamificationCelebration}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-600 px-8 py-3.5 font-bold text-white shadow-xl shadow-emerald-950/40 transition-all hover:from-emerald-600 hover:to-teal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 active:scale-[0.98]"
          >
            Continue
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

export default GamificationCelebration;
