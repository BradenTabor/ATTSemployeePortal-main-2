/**
 * RewardPointsCelebration
 *
 * Full-screen animated overlay shown when the user claims announcement/briefing
 * reward points. Replaces the corner toast with a premium celebration.
 *
 * - Portal to document.body, scroll lock
 * - Confetti capped at 20–30 particles; will-change: transform; prefers-reduced-motion
 * - role="alertdialog" + aria-live for screen readers
 * - Dismiss: Continue button, Escape; backdrop does not dismiss
 * - Auto-dismiss after 6s
 */

import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Sparkles, ArrowRight } from 'lucide-react';
import { useRewardCelebration } from '../../contexts/RewardCelebrationContext';
import { getDeviceCapabilities } from '../../lib/mobilePerf';
import { Z } from "@/lib/zIndex";

const CONFETTI_COLORS = [
  '#10b981',
  '#34d399',
  '#6ee7b7',
  '#fbbf24',
  '#f59e0b',
  '#ffffff',
  '#a7f3d0',
];

const PARTICLE_COUNT = 25;
const AUTO_DISMISS_MS = 6000;

function generateParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: Math.random() * 100,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotation: Math.random() > 0.5 ? 1 : -1,
    duration: 2.2 + Math.random() * 1,
    size: 5 + Math.random() * 5,
    shape: (Math.random() > 0.5 ? 'square' : 'circle') as 'square' | 'circle',
  }));
}

function ConfettiParticle({
  delay,
  x,
  color,
  rotation,
  duration,
  size,
  shape,
}: {
  delay: number;
  x: number;
  color: string;
  rotation: number;
  duration: number;
  size: number;
  shape: 'square' | 'circle';
}) {
  return (
    <motion.div
      className={shape === 'circle' ? 'rounded-full' : 'rounded-sm'}
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: -16,
        width: size,
        height: size,
        backgroundColor: color,
        willChange: 'transform',
      }}
      initial={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{
        y: [0, 700],
        opacity: [1, 1, 0.8, 0],
        rotate: [0, 360 * rotation * 2],
        scale: [1, 0.8, 0.5],
      }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    />
  );
}

export function RewardPointsCelebration() {
  const { state, dismissRewardCelebration } = useRewardCelebration();
  const isVisible = state.show;
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const showConfetti = !caps.prefersReducedMotion && !caps.isLowEnd;
  const particles = useMemo(
    () => (showConfetti ? generateParticles(PARTICLE_COUNT) : []),
    [showConfetti]
  );
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissRewardCelebration();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isVisible, dismissRewardCelebration]);

  useEffect(() => {
    if (!isVisible) return;
    const body = document.body;
    const scrollEl = document.querySelector('[data-scroll-container]') as HTMLElement | null;
    const prevBody = body.style.overflow;
    const prevScroll = scrollEl?.style.overflow ?? '';
    body.style.overflow = 'hidden';
    if (scrollEl) scrollEl.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevBody;
      if (scrollEl) scrollEl.style.overflow = prevScroll;
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    autoDismissRef.current = setTimeout(() => {
      dismissRewardCelebration();
      autoDismissRef.current = null;
    }, AUTO_DISMISS_MS);
    return () => {
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
        autoDismissRef.current = null;
      }
    };
  }, [isVisible, dismissRewardCelebration]);

  useEffect(() => {
    if (isVisible && typeof window !== 'undefined' && window.navigator?.vibrate) {
      window.navigator.vibrate([15, 10, 25]);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const points = state.points;
  const headline =
    points === 1 ? '+1 Point collected!' : `+${points} Points collected!`;

  const content = (
    <AnimatePresence>
      <motion.div style={{ zIndex: Z.modal }}
        className="fixed inset-0 flex items-center justify-center overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        role="alertdialog"
        aria-modal="true"
        aria-label="Reward claimed"
      >
        {/* Backdrop — no onClick; dismiss only via Continue or Escape */}
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {showConfetti && particles.length > 0 && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
              <ConfettiParticle
                key={p.id}
                delay={p.delay}
                x={p.x}
                color={p.color}
                rotation={p.rotation}
                duration={p.duration}
                size={p.size}
                shape={p.shape}
              />
            ))}
          </div>
        )}

        <motion.div
          className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm"
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Live region for screen readers — announces reward immediately */}
          <div aria-live="assertive" aria-atomic="true" className="sr-only">
            {headline}
          </div>

          <motion.div
            className="relative mb-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
          >
            <motion.div
              className="absolute inset-0 bg-emerald-500/20 rounded-full"
              style={{ width: 100, height: 100, marginLeft: -18, marginTop: -18 }}
              animate={
                caps.prefersReducedMotion
                  ? undefined
                  : { scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }
              }
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-500 via-emerald-600 to-amber-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30">
              <Gift className="w-8 h-8 text-white" strokeWidth={2} />
              <Sparkles className="absolute -top-0.5 -right-0.5 w-5 h-5 text-amber-300" />
            </div>
          </motion.div>

          <motion.h2
            className="text-2xl font-bold text-white mb-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {headline}
          </motion.h2>

          <motion.p
            className="text-white/60 mb-8 text-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Safety reward added to your total.
          </motion.p>

          <motion.button
            onClick={dismissRewardCelebration}
            className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-xl shadow-emerald-900/40 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.03 }}
            whileTap={caps.prefersReducedMotion ? undefined : { scale: 0.97 }}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

export default RewardPointsCelebration;
