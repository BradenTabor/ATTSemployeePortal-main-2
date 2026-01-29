import { Link } from "react-router-dom";
import { CheckCircle, XCircle, Clock, Award, ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { SubmitTestResult } from "../../types/certifications";

// Cubic-bezier easing tuple for framer-motion (type-safe Easing)
const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";

interface TestResultsProps {
  result: SubmitTestResult;
  certName: string;
}

type ConfettiSeed = { x: number; rotate: number; duration: number };

// Animated confetti particle (receives precomputed seeds from parent to keep render pure)
function ConfettiParticle({
  delay,
  color,
  seed,
}: {
  delay: number;
  color: string;
  seed: ConfettiSeed;
}) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-sm"
      style={{ 
        backgroundColor: color,
        left: '50%',
        top: '30%',
      }}
      initial={{ 
        opacity: 1, 
        scale: 0,
        x: 0,
        y: 0,
        rotate: 0,
      }}
      animate={{ 
        opacity: [1, 1, 0],
        scale: [0, 1, 0.5],
        x: seed.x,
        y: [0, -80, 300],
        rotate: seed.rotate,
      }}
      transition={{ 
        duration: seed.duration,
        delay: delay,
        ease: EASE_OUT_EXPO,
      }}
    />
  );
}

// Animated progress ring
function ProgressRing({ 
  progress, 
  size = 140, 
  strokeWidth = 8,
  passed,
}: { 
  progress: number; 
  size?: number;
  strokeWidth?: number;
  passed: boolean | null;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  
  const gradientId = passed ? 'progressGradientPass' : passed === false ? 'progressGradientFail' : 'progressGradientPending';
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="progressGradientPass" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="progressGradientFail" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <linearGradient id="progressGradientPending" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="50%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, delay: 0.3, ease: EASE_OUT_EXPO }}
          style={{ filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))' }}
        />
      </svg>
    </div>
  );
}

// Animated counter
function AnimatedCounter({ value, suffix = "", delay = 0.5 }: { value: number; suffix?: string; delay?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      const duration = 1500;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayValue(Math.round(value * eased * 10) / 10);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }, delay * 1000);
    
    return () => clearTimeout(timeout);
  }, [value, delay]);
  
  return <>{displayValue.toFixed(1)}{suffix}</>;
}

// Floating particles background
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-emerald-400/30"
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.3,
          }}
        />
      ))}
    </div>
  );
}

const CONFETTI_COLORS = ['#34d399', '#10b981', '#fbbf24', '#60a5fa', '#a78bfa', '#f472b6'];

export function TestResults({ result, certName }: TestResultsProps) {
  const isPendingReview = result.pending_review_count > 0;
  const passed = result.passed;
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiSeeds, setConfettiSeeds] = useState<ConfettiSeed[]>([]);

  useEffect(() => {
    if (!passed) return;
    const id = requestAnimationFrame(() => {
      setConfettiSeeds(
        Array.from({ length: 30 }, () => ({
          x: Math.random() * 300 - 150,
          rotate: Math.random() * 720 - 360,
          duration: 2 + Math.random() * 2,
        }))
      );
      setShowConfetti(true);
    });
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timer);
    };
  }, [passed]);

  // Container animation variants (ease as tuple for motion Variants type)
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: EASE_OUT_EXPO,
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: EASE_OUT_EXPO },
    },
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: "spring" as const,
        stiffness: 200,
        damping: 15,
        delay: 0.3,
      },
    },
  };

  // Calculate auto-graded score for pending reviews
  const autoGradedTotal = result.total_questions - result.pending_review_count;
  const autoGradedPercent = autoGradedTotal > 0 
    ? (result.correct_answers / autoGradedTotal) * 100 
    : 0;

  // If pending review, show different UI
  if (isPendingReview) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-blue-500/20 backdrop-blur-sm p-6 sm:p-8 text-center shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, rgba(30, 58, 138, 0.3) 0%, rgba(15, 23, 42, 0.8) 50%, rgba(5, 15, 35, 0.95) 100%)',
        }}
      >
        <FloatingParticles />
        
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        
        {/* Top shimmer line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden">
          <motion.div
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
          />
        </div>

        <motion.div variants={itemVariants} className="relative flex justify-center">
          {/* Progress ring with icon */}
          <div className="relative mb-6" style={{ width: 140, height: 140 }}>
            <ProgressRing progress={autoGradedPercent} passed={null} />
            <motion.div 
              className="absolute inset-0 flex items-center justify-center"
              variants={iconVariants}
            >
              <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                <Clock className="w-8 h-8 text-blue-300" />
              </div>
            </motion.div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <motion.div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 mb-4"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Clock className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Pending Review</span>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-1 mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Test Submitted
          </h2>
          <p className="text-sm font-medium text-blue-200/80">{certName}</p>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="rounded-xl border border-blue-500/30 bg-blue-950/40 px-4 py-4 shadow-lg mb-4"
        >
          <p className="text-sm text-blue-100/90 leading-relaxed">
            Your test has been submitted successfully. <br />
            <span className="font-semibold text-blue-200">
              {result.pending_review_count} written response{result.pending_review_count > 1 ? "s" : ""}
            </span>{" "}
            {result.pending_review_count === 1 ? "needs" : "need"} to be reviewed by an administrator.
          </p>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 shadow-lg mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Auto-Graded Questions</span>
            <span className="text-xs text-emerald-300 font-semibold">
              {result.correct_answers}/{autoGradedTotal}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div 
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${autoGradedPercent}%` }}
              transition={{ duration: 1, delay: 0.5, ease: EASE_OUT_EXPO }}
            />
          </div>
          <p className="mt-2 text-xs text-white/60">
            + {result.pending_review_count} question{result.pending_review_count > 1 ? "s" : ""} awaiting manual review
          </p>
        </motion.div>

        <motion.p 
          variants={itemVariants}
          className="text-sm text-blue-200/70 mb-6 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          You'll be notified when grading is complete
        </motion.p>

        <motion.div variants={itemVariants}>
          <Link
            to="/resources"
            className={`group inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-[1.02] ${focusRing}`}
          >
            Back to Resources
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  // Passed or Failed UI
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative mx-auto max-w-md overflow-hidden rounded-2xl border backdrop-blur-sm p-6 sm:p-8 text-center shadow-2xl"
      style={{
        background: passed 
          ? 'linear-gradient(145deg, rgba(6, 78, 59, 0.4) 0%, rgba(5, 46, 22, 0.6) 50%, rgba(2, 20, 10, 0.95) 100%)'
          : 'linear-gradient(145deg, rgba(127, 29, 29, 0.3) 0%, rgba(55, 15, 15, 0.6) 50%, rgba(20, 5, 5, 0.95) 100%)',
        borderColor: passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      }}
    >
      <FloatingParticles />
      
      {/* Confetti explosion for passing */}
      <AnimatePresence>
        {showConfetti && passed && confettiSeeds.length > 0 && (
          <>
            {confettiSeeds.map((seed, i) => (
              <ConfettiParticle
                key={i}
                delay={i * 0.05}
                color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                seed={seed}
              />
            ))}
          </>
        )}
      </AnimatePresence>
      
      {/* Decorative glows */}
      <motion.div 
        className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none"
        style={{ background: passed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.2)' }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full blur-3xl pointer-events-none"
        style={{ background: passed ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      
      {/* Top shimmer line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden">
        <motion.div
          className="h-full w-1/3"
          style={{ 
            background: passed 
              ? 'linear-gradient(90deg, transparent, rgba(52, 211, 153, 0.6), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(248, 113, 113, 0.6), transparent)'
          }}
          animate={{ x: ['-100%', '400%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
        />
      </div>

      <motion.div variants={itemVariants} className="relative flex justify-center">
        {/* Progress ring with icon */}
        <div className="relative mb-6" style={{ width: 140, height: 140 }}>
          <ProgressRing progress={result.score_percentage} passed={passed} />
          <motion.div 
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.5, duration: 0.5, ease: EASE_OUT_EXPO }}
          >
            <span className="text-3xl sm:text-4xl font-black text-white">
              <AnimatedCounter value={result.score_percentage} suffix="%" delay={0.8} />
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/60 font-medium">Score</span>
          </motion.div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        {passed ? (
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-400/30 mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.5 }}
          >
            <CheckCircle className="w-5 h-5 text-emerald-300" />
            <span className="text-sm font-bold text-emerald-200 uppercase tracking-wider">Passed</span>
          </motion.div>
        ) : (
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-400/30 mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.5 }}
          >
            <XCircle className="w-5 h-5 text-red-300" />
            <span className="text-sm font-bold text-red-200 uppercase tracking-wider">Not Passed</span>
          </motion.div>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1 mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center justify-center gap-2">
          {passed && <Award className="w-7 h-7 text-amber-400" />}
          {passed ? "Congratulations!" : "Keep Going!"}
        </h2>
        <p className="text-sm font-medium text-emerald-100/80">{certName}</p>
      </motion.div>

      <motion.div 
        variants={itemVariants}
        className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 shadow-lg mb-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{result.correct_answers}</p>
            <p className="text-xs text-white/60 uppercase tracking-wider">Correct</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{result.total_questions}</p>
            <p className="text-xs text-white/60 uppercase tracking-wider">Total</p>
          </div>
        </div>
      </motion.div>

      {!passed && (
        <motion.div 
          variants={itemVariants}
          className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 mb-6"
        >
          <p className="text-sm text-amber-200/90 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            You can retake this test after 24 hours
          </p>
        </motion.div>
      )}

      {passed && (
        <motion.div 
          variants={itemVariants}
          className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 mb-6"
        >
          <p className="text-sm text-emerald-200/90 flex items-center justify-center gap-2">
            <Award className="w-4 h-4" />
            Your certification has been recorded!
          </p>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to="/resources"
          className={`group w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] ${
            passed 
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-emerald-500/25 hover:shadow-emerald-500/40'
              : 'bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 shadow-red-500/25 hover:shadow-red-500/40'
          } ${focusRing}`}
        >
          Back to Resources
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
        {!passed && (
          <Link
            to="/resources"
            className={`group w-full sm:w-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-6 py-3 text-sm font-semibold text-emerald-200 shadow-lg transition-all hover:scale-[1.02] ${focusRing}`}
          >
            <BookOpen className="w-4 h-4" />
            Study Guides
          </Link>
        )}
      </motion.div>
    </motion.div>
  );
}
