/**
 * Full Compliance Celebration Component
 * 
 * A premium full-page celebration overlay shown when a user completes
 * ALL THREE daily safety forms (DVIR, Equipment, JSA).
 * 
 * Features:
 * - Personalized greeting with user's name
 * - Spectacular confetti animation
 * - Animated progress ring
 * - Emerald-themed premium design
 * - Haptic feedback on mobile
 * 
 * @module FullComplianceCelebration
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  CheckCircle2, 
  Sparkles, 
  Trophy,
  Star,
  ArrowRight,
  Truck,
  Wrench,
  ClipboardCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleDashboard } from '../../lib/navigation';
import { Z } from "@/lib/zIndex";

interface FullComplianceCelebrationProps {
  /** Whether to show the celebration */
  isVisible: boolean;
  /** User's display name for personalization */
  userName: string;
  /** Callback when celebration is dismissed */
  onDismiss: () => void;
}

// Emerald-themed confetti colors
const CONFETTI_COLORS = [
  '#10b981', // emerald-500
  '#34d399', // emerald-400
  '#6ee7b7', // emerald-300
  '#fbbf24', // amber-400
  '#f59e0b', // amber-500
  '#ffffff', // white
  '#a7f3d0', // emerald-200
];

// Pre-generate confetti particles to avoid runtime calculations
function generateConfettiParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.8,
    x: Math.random() * 100,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotation: Math.random() > 0.5 ? 1 : -1,
    duration: 2.5 + Math.random() * 1.5,
    size: 6 + Math.random() * 6,
    shape: (Math.random() > 0.5 ? 'square' : 'circle') as 'square' | 'circle',
  }));
}

// Generate floating sparkle positions
function generateSparkles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    delay: Math.random() * 2,
    scale: 0.5 + Math.random() * 0.5,
  }));
}

// Single confetti particle
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
        backgroundColor: color,
        position: 'absolute',
        left: `${x}%`,
        top: -20,
        width: size,
        height: size,
      }}
      initial={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ 
        y: [0, 800],
        opacity: [1, 1, 0.8, 0],
        rotate: [0, 360 * rotation * 3],
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

// Floating sparkle animation
function FloatingSparkle({ x, y, delay, scale }: { x: number; y: number; delay: number; scale: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: [0, 1, 0],
        scale: [0, scale, 0],
      }}
      transition={{ 
        duration: 2,
        delay,
        repeat: Infinity,
        repeatDelay: 1,
      }}
    >
      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
    </motion.div>
  );
}

// Animated progress ring
function ProgressRing() {
  return (
    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
      {/* Background ring */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="rgba(16, 185, 129, 0.15)"
        strokeWidth="6"
      />
      {/* Animated progress ring */}
      <motion.circle
        cx="50"
        cy="50"
        r="45"
        fill="none"
        stroke="url(#progressGradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="283"
        initial={{ strokeDashoffset: 283 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 1.5, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
      />
      <defs>
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Form completion badge
function FormBadge({ 
  icon: Icon, 
  label, 
  delay 
}: { 
  icon: typeof Truck; 
  label: string; 
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 20 }}
      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full"
    >
      <Icon className="w-3.5 h-3.5 text-emerald-400" />
      <span className="text-xs font-medium text-emerald-300">{label}</span>
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    </motion.div>
  );
}

export function FullComplianceCelebration({
  isVisible,
  userName,
  onDismiss,
}: FullComplianceCelebrationProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Generate particles on mount
  const confettiParticles = useMemo(() => generateConfettiParticles(80), []);
  const sparkles = useMemo(() => generateSparkles(12), []);
  
  // Extract first name for more personal greeting
  const firstName = useMemo(() => {
    if (!userName) return 'Champion';
    const parts = userName.trim().split(' ');
    return parts[0] || 'Champion';
  }, [userName]);

  // Trigger confetti when visible
  useEffect(() => {
    if (isVisible) {
      // Use requestAnimationFrame to defer state update and avoid synchronous setState warning
      const rafId = requestAnimationFrame(() => {
        setShowConfetti(true);
      });
      
      // Haptic feedback
      if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        window.navigator.vibrate([15, 10, 25, 10, 50]); // Celebration pattern
      }
      
      // Stop confetti after 4 seconds
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timer);
      };
    }
  }, [isVisible]);

  const handleContinue = useCallback(() => {
    onDismiss();
    navigate(getRoleDashboard(role));
  }, [onDismiss, navigate, role]);

  // Don't render if not visible
  if (!isVisible) return null;

  const content = (
    <AnimatePresence>
      {isVisible && (
        <motion.div style={{ zIndex: Z.modal }}
          className="fixed inset-0 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Premium backdrop with gradient */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: `
                radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 80%, rgba(251, 191, 36, 0.1) 0%, transparent 40%),
                radial-gradient(ellipse at 20% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 40%),
                rgba(0, 0, 0, 0.92)
              `,
              backdropFilter: 'blur(12px)',
            }}
          />

          {/* Confetti layer */}
          {showConfetti && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {confettiParticles.map((particle) => (
                <ConfettiParticle
                  key={particle.id}
                  delay={particle.delay}
                  x={particle.x}
                  color={particle.color}
                  rotation={particle.rotation}
                  duration={particle.duration}
                  size={particle.size}
                  shape={particle.shape}
                />
              ))}
            </div>
          )}

          {/* Floating sparkles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {sparkles.map((sparkle) => (
              <FloatingSparkle
                key={sparkle.id}
                x={sparkle.x}
                y={sparkle.y}
                delay={sparkle.delay}
                scale={sparkle.scale}
              />
            ))}
          </div>

          {/* Main content */}
          <motion.div
            className="relative z-10 flex flex-col items-center text-center px-6 max-w-md"
            initial={{ scale: 0.8, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 30 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }}
          >
            {/* Trophy icon with animated ring */}
            <motion.div
              className="relative w-32 h-32 mb-6"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
            >
              {/* Progress ring */}
              <ProgressRing />
              
              {/* Pulsing glow */}
              <motion.div
                className="absolute inset-4 rounded-full bg-emerald-500/20"
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.2, 0.5],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              
              {/* Icon container */}
              <div className="absolute inset-6 bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.5 }}
                >
                  <Trophy className="w-10 h-10 text-white" strokeWidth={2} />
                </motion.div>
              </div>
              
              {/* Sparkle accents */}
              <motion.div
                className="absolute -top-1 -right-1"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.8, type: 'spring' }}
              >
                <Sparkles className="w-6 h-6 text-amber-400" />
              </motion.div>
            </motion.div>

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-2"
            >
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                100% Compliant!
              </h2>
            </motion.div>

            {/* Personalized greeting */}
            <motion.p
              className="text-lg text-emerald-300 font-semibold mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Outstanding work, {firstName}! 🎉
            </motion.p>

            {/* Message */}
            <motion.p
              className="text-white/60 mb-6 text-sm leading-relaxed max-w-xs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              You've completed all three daily safety forms. Your commitment to safety helps keep everyone protected.
            </motion.p>

            {/* Form badges */}
            <motion.div
              className="flex flex-wrap justify-center gap-2 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <FormBadge icon={Truck} label="DVIR" delay={0.8} />
              <FormBadge icon={Wrench} label="Equipment" delay={0.9} />
              <FormBadge icon={ClipboardCheck} label="JSA" delay={1.0} />
            </motion.div>

            {/* Shield badge */}
            <motion.div
              className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-amber-500/10 border border-emerald-500/40 rounded-2xl mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.1, type: 'spring' }}
            >
              <Shield className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-bold text-white">Safety Champion</span>
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            </motion.div>

            {/* Thank you message */}
            <motion.p
              className="text-xs text-white/40 mb-6 max-w-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              Thank you for prioritizing safety. Your diligence makes a real difference.
            </motion.p>

            {/* Continue button */}
            <motion.button
              onClick={handleContinue}
              className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-xl shadow-emerald-900/40 active:scale-[0.98]"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Return to Dashboard
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render via portal to ensure it's above everything
  return createPortal(content, document.body);
}

export default FullComplianceCelebration;
