/**
 * Form Success Celebration Component
 *
 * A premium full-screen success overlay with confetti animation
 * displayed after successful form submission.
 *
 * Enhanced Features:
 * - Shows remaining compliance forms as CTAs
 * - Personalized nudge messaging
 * - Quick navigation to next form
 *
 * IMPORTANT – Full-screen overlay behavior (recurring bug fix):
 * This overlay must (1) be rendered via createPortal(..., document.body) so it is
 * outside DashboardLayout's scroll container, and (2) lock both document.body and
 * [data-scroll-container] overflow when visible. Otherwise the user can scroll
 * the page behind the overlay. See docs/ModalsAndOverlays.md for the full pattern.
 *
 * @module FormSuccessCelebration
 */

import { useEffect, useState, useMemo } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  ArrowRight, 
  FileCheck, 
  Truck, 
  Wrench, 
  ClipboardCheck,
  ChevronRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { Z } from "@/lib/zIndex";

interface FormStats {
  hazardsCount?: number;
  ppeCount?: number;
  spansCount?: number;
  checklistItemsCount?: number;
}

interface RemainingForm {
  type: 'dvir' | 'equipment' | 'jsa';
  label: string;
  shortLabel: string;
  path: string;
}

interface FormSuccessCelebrationProps {
  /** Whether to show the celebration */
  isVisible: boolean;
  /** Form type for contextual messaging */
  formType: 'jsa' | 'dvir' | 'equipment' | 'incident' | 'near_miss' | 'rto';
  /** Callback when user clicks to continue */
  onContinue: () => void;
  /** Optional custom title */
  title?: string;
  /** Optional custom message */
  message?: string;
  /** Optional form completion stats */
  stats?: FormStats;
  /** Remaining forms to complete (for nudge) */
  remainingForms?: RemainingForm[];
  /** User's first name for personalization */
  userName?: string;
}

const FORM_LABELS: Record<string, string> = {
  jsa: 'Job Safety Analysis',
  dvir: 'Vehicle Inspection',
  equipment: 'Equipment Inspection',
  incident: 'Safety Incident Report',
  near_miss: 'Near-Miss Report',
  rto: 'Time-Off Request',
};

// Pre-generate random values for confetti particles
function generateParticleData(count: number, colors: string[]) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotateDirection: Math.random() > 0.5 ? 1 : -1,
    durationExtra: Math.random(),
  }));
}

// Confetti particle component - all random values passed as props
function ConfettiParticle({ 
  delay, 
  x, 
  color, 
  rotateDirection, 
  durationExtra 
}: { 
  delay: number; 
  x: number; 
  color: string;
  rotateDirection: number;
  durationExtra: number;
}) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-sm"
      style={{ 
        backgroundColor: color,
        left: `${x}%`,
        top: -10,
      }}
      initial={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ 
        y: [0, 600],
        opacity: [1, 1, 0],
        rotate: [0, 360 * rotateDirection],
        scale: [1, 0.5],
      }}
      transition={{ 
        duration: 2.5 + durationExtra,
        delay: delay,
        ease: 'easeIn',
      }}
    />
  );
}

// Inner component that handles confetti timing - mounts fresh each time parent becomes visible
function ConfettiController({ children }: { children: (showConfetti: boolean) => React.ReactNode }) {
  const [showConfetti, setShowConfetti] = useState(true);
  
  useEffect(() => {
    // Timer to hide confetti after 3 seconds
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);
  
  return <>{children(showConfetti)}</>;
}

// Icon mapping for form types
const FORM_ICONS: Record<string, typeof Truck> = {
  dvir: Truck,
  equipment: Wrench,
  jsa: ClipboardCheck,
  incident: AlertTriangle,
};

// Gradient styles for remaining form cards
const FORM_GRADIENTS: Record<string, string> = {
  dvir: 'from-emerald-500/15 to-emerald-600/10',
  equipment: 'from-amber-500/15 to-amber-600/10',
  jsa: 'from-sky-500/15 to-sky-600/10',
  incident: 'from-red-500/15 to-red-600/10',
};

const FORM_BORDER_COLORS: Record<string, string> = {
  dvir: 'border-emerald-500/30 hover:border-emerald-400/50',
  equipment: 'border-amber-500/30 hover:border-amber-400/50',
  jsa: 'border-sky-500/30 hover:border-sky-400/50',
  incident: 'border-red-500/30 hover:border-red-400/50',
  near_miss: 'border-amber-500/30 hover:border-amber-400/50',
};

const FORM_ICON_COLORS: Record<string, string> = {
  dvir: 'text-emerald-400',
  equipment: 'text-amber-400',
  jsa: 'text-sky-400',
  incident: 'text-red-400',
  near_miss: 'text-amber-400',
};

// Theme colors based on form type
const THEME_COLORS: Record<string, { confetti: string[], glow: string, icon: string, badge: string, badgeText: string }> = {
  dvir: {
    confetti: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b', '#ffffff'],
    glow: 'bg-emerald-500',
    icon: 'from-emerald-500 to-emerald-600',
    badge: 'bg-emerald-500/15 border-emerald-500/30',
    badgeText: 'text-emerald-300',
  },
  equipment: {
    confetti: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b', '#ffffff'],
    glow: 'bg-emerald-500',
    icon: 'from-emerald-500 to-emerald-600',
    badge: 'bg-emerald-500/15 border-emerald-500/30',
    badgeText: 'text-emerald-300',
  },
  jsa: {
    confetti: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b', '#ffffff'],
    glow: 'bg-emerald-500',
    icon: 'from-emerald-500 to-emerald-600',
    badge: 'bg-emerald-500/15 border-emerald-500/30',
    badgeText: 'text-emerald-300',
  },
  incident: {
    confetti: ['#ef4444', '#f87171', '#fca5a5', '#fbbf24', '#f59e0b', '#ffffff'],
    glow: 'bg-red-500',
    icon: 'from-red-500 to-red-600',
    badge: 'bg-red-500/15 border-red-500/30',
    badgeText: 'text-red-300',
  },
  near_miss: {
    confetti: ['#f59e0b', '#fbbf24', '#fcd34d', '#10b981', '#34d399', '#ffffff'],
    glow: 'bg-amber-500',
    icon: 'from-amber-500 to-amber-600',
    badge: 'bg-amber-500/15 border-amber-500/30',
    badgeText: 'text-amber-300',
  },
};

export function FormSuccessCelebration({
  isVisible,
  formType,
  onContinue,
  title,
  message,
  stats,
  remainingForms = [],
}: FormSuccessCelebrationProps) {
  // Note: userName is available in props for future personalization

  // Get theme colors for this form type
  const theme = THEME_COLORS[formType] || THEME_COLORS.jsa;

  // Generate confetti particles - memoized to avoid recalculation
  const confettiColors = useMemo(() => theme.confetti, [theme.confetti]);
  const confettiParticles = useMemo(() => generateParticleData(50, confettiColors), [confettiColors]);
  
  useEffect(() => {
    if (!isVisible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onContinue();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isVisible, onContinue]);

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

  // Calculate progress
  const completedCount = 3 - remainingForms.length;
  const hasRemaining = remainingForms.length > 0;
  
  // Check if we have meaningful stats to show
  const hasStats = stats && (
    (stats.hazardsCount !== undefined && stats.hazardsCount > 0) ||
    (stats.ppeCount !== undefined && stats.ppeCount > 0) ||
    (stats.spansCount !== undefined && stats.spansCount > 0) ||
    (stats.checklistItemsCount !== undefined && stats.checklistItemsCount > 0)
  );

  const content = (
    <AnimatePresence>
      {isVisible && (
        <ConfettiController>
          {(showConfetti) => (
            <motion.div style={{ zIndex: Z.modal }}
              className="fixed inset-0 flex items-center justify-center overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              role="dialog"
              aria-modal="true"
              aria-label="Form submitted successfully"
            >
              {/* Backdrop */}
              <motion.div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />

              {/* Confetti */}
              {showConfetti && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {confettiParticles.map((particle) => (
                    <ConfettiParticle
                      key={particle.id}
                      delay={particle.delay}
                      x={particle.x}
                      color={particle.color}
                      rotateDirection={particle.rotateDirection}
                      durationExtra={particle.durationExtra}
                    />
                  ))}
                </div>
              )}

          {/* Content */}
          <motion.div
            className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm"
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Success icon with glow */}
            <motion.div
              className="relative mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
            >
              {/* Glow rings */}
              <motion.div
                className={`absolute inset-0 ${theme.glow}/20 rounded-full`}
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 120, height: 120, marginLeft: -24, marginTop: -24 }}
              />
              <motion.div
                className={`absolute inset-0 ${theme.glow}/10 rounded-full`}
                animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                style={{ width: 120, height: 120, marginLeft: -24, marginTop: -24 }}
              />

              {/* Icon */}
              <div className={`relative w-[72px] h-[72px] bg-gradient-to-br ${theme.icon} rounded-full flex items-center justify-center shadow-2xl ${theme.glow}/40`}>
                {formType === 'incident' ? (
                  <AlertTriangle className="w-10 h-10 text-white" strokeWidth={2.5} />
                ) : (
                  <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
                )}
              </div>
            </motion.div>

            {/* Title */}
            <motion.h2
              className="text-2xl font-bold text-white mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {title || 'Submitted Successfully!'}
            </motion.h2>

            {/* Message */}
            <motion.p
              className="text-white/60 mb-8 text-sm leading-relaxed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {message || `Your ${FORM_LABELS[formType]} has been saved and submitted. Great work keeping the team safe!`}
            </motion.p>

            {/* Summary badge */}
            <motion.div
              className={`flex items-center gap-2 px-4 py-2 ${theme.badge} border rounded-xl mb-4`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
            >
              {formType === 'incident' ? (
                <AlertTriangle className={`w-4 h-4 ${theme.badgeText}`} />
              ) : (
                <FileCheck className={`w-4 h-4 ${theme.badgeText}`} />
              )}
              <span className={`text-sm font-medium ${theme.badgeText}`}>
                {formType === 'incident' ? 'Incident Logged' : `${FORM_LABELS[formType]} Complete`}
              </span>
            </motion.div>

            {/* Stats grid - only show if we have meaningful stats */}
            {hasStats && (
              <motion.div
                className="grid grid-cols-2 gap-2 w-full max-w-xs mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {stats.hazardsCount !== undefined && stats.hazardsCount > 0 && (
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-emerald-400">{stats.hazardsCount}</p>
                    <p className="text-[10px] text-white/50 uppercase">Hazards Logged</p>
                  </div>
                )}
                {stats.ppeCount !== undefined && stats.ppeCount > 0 && (
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-amber-400">{stats.ppeCount}</p>
                    <p className="text-[10px] text-white/50 uppercase">PPE Required</p>
                  </div>
                )}
                {stats.spansCount !== undefined && stats.spansCount > 0 && (
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-sky-400">{stats.spansCount}</p>
                    <p className="text-[10px] text-white/50 uppercase">Spans Reviewed</p>
                  </div>
                )}
                {stats.checklistItemsCount !== undefined && stats.checklistItemsCount > 0 && (
                  <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-purple-400">{stats.checklistItemsCount}</p>
                    <p className="text-[10px] text-white/50 uppercase">Items Checked</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ============================================ */}
            {/* REMAINING FORMS NUDGE SECTION */}
            {/* ============================================ */}
            {hasRemaining && (
              <motion.div
                className="w-full max-w-sm mb-6"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
              >
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full transition-colors ${
                          i <= completedCount ? 'bg-emerald-400' : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-white/50">
                    {completedCount}/3 forms done
                  </span>
                </div>

                {/* Nudge message */}
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-xs text-amber-300 font-medium">
                    {remainingForms.length === 1 
                      ? "Just one more form to go!" 
                      : `${remainingForms.length} more forms to complete today`
                    }
                  </p>
                </div>

                {/* Remaining forms cards */}
                <div className="space-y-2">
                  {remainingForms.map((form, index) => {
                    const Icon = FORM_ICONS[form.type];
                    return (
                      <motion.div
                        key={form.type}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.1 }}
                      >
                        <Link
                          to={form.path}
                          className={`
                            flex items-center gap-3 px-4 py-3 rounded-xl
                            bg-gradient-to-r ${FORM_GRADIENTS[form.type]}
                            border ${FORM_BORDER_COLORS[form.type]}
                            transition-all duration-200
                            hover:scale-[1.02] active:scale-[0.98]
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50
                            group
                          `}
                        >
                          <div className={`w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${FORM_ICON_COLORS[form.type]}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{form.shortLabel}</p>
                            <p className="text-[10px] text-white/40">Tap to complete</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all hover:scale-[1.02]" />
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Continue button */}
            <motion.button
              onClick={onContinue}
              className={`
                flex items-center gap-2 px-8 py-3 
                ${hasRemaining 
                  ? 'bg-white/10 hover:bg-white/15 border border-white/20' 
                  : 'bg-emerald-600 hover:bg-emerald-500'
                }
                text-white font-semibold rounded-xl transition-all 
                ${hasRemaining ? 'shadow-lg' : 'shadow-lg shadow-emerald-900/30'} 
                active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
              `}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: hasRemaining ? 0.8 : 0.5 }}
              whileTap={{ scale: 0.98 }}
            >
              {hasRemaining ? 'Return to Dashboard' : 'Return to Dashboard'}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
            </motion.div>
          </motion.div>
          )}
        </ConfettiController>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

export default FormSuccessCelebration;
