/**
 * EnhancedRewardsCard Component - Premium Edition
 * 
 * A luxurious, highly-polished gamified rewards card with exceptional UX.
 * Features stunning visuals, engaging animations, and compelling gamification.
 * 
 * Design Philosophy:
 * - Premium glassmorphism with depth and dimension
 * - Celebration-driven micro-interactions
 * - Crystal-clear progress visualization
 * - Compelling CTAs with urgency and reward preview
 * - Social proof and achievement systems
 */

import { memo, useMemo, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Star,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Flame,
  Zap,
  Gift,
  Crown,
  Target,
  Award,
  Medal,
  Shield,
  Gem,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// TYPES
// ============================================================================

interface RewardData {
  totalPoints: number;
  claimsCount: number;
  recentClaims: number;
  loading: boolean;
  error: string | null;
}

interface EnhancedRewardsCardProps {
  theme?: 'emerald' | 'blue';
  onPointsChange?: (points: number) => void;
}

interface Level {
  name: string;
  minPoints: number;
  maxPoints: number;
  icon: typeof Trophy;
  color: string;
  textGradient: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  ringColor: string;
  badgeGradient: string;
}

// ============================================================================
// LEVEL CONFIGURATION - Premium Gamification Tiers
// ============================================================================

const LEVELS: Level[] = [
  { 
    name: 'Newcomer', 
    minPoints: 0, 
    maxPoints: 4,
    icon: Star,
    color: 'text-slate-300',
    textGradient: 'bg-gradient-to-r from-slate-200 to-slate-400',
    bgColor: 'bg-slate-500/8',
    borderColor: 'border-slate-400/20',
    glowColor: 'rgba(148, 163, 184, 0.2)',
    ringColor: 'ring-slate-400/30',
    badgeGradient: 'from-slate-300 via-slate-200 to-slate-400',
  },
  { 
    name: 'Getting Started', 
    minPoints: 5, 
    maxPoints: 9,
    icon: Zap,
    color: 'text-sky-300',
    textGradient: 'bg-gradient-to-r from-sky-300 to-cyan-400',
    bgColor: 'bg-sky-500/8',
    borderColor: 'border-sky-400/25',
    glowColor: 'rgba(56, 189, 248, 0.25)',
    ringColor: 'ring-sky-400/40',
    badgeGradient: 'from-sky-300 via-cyan-200 to-sky-400',
  },
  { 
    name: 'Safety Aware', 
    minPoints: 10, 
    maxPoints: 24,
    icon: Shield,
    color: 'text-emerald-300',
    textGradient: 'bg-gradient-to-r from-emerald-300 to-teal-400',
    bgColor: 'bg-emerald-500/8',
    borderColor: 'border-emerald-400/25',
    glowColor: 'rgba(52, 211, 153, 0.25)',
    ringColor: 'ring-emerald-400/40',
    badgeGradient: 'from-emerald-300 via-teal-200 to-emerald-400',
  },
  { 
    name: 'Safety Pro', 
    minPoints: 25, 
    maxPoints: 49,
    icon: Award,
    color: 'text-amber-300',
    textGradient: 'bg-gradient-to-r from-amber-300 to-yellow-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-400/30',
    glowColor: 'rgba(251, 191, 36, 0.3)',
    ringColor: 'ring-amber-400/50',
    badgeGradient: 'from-amber-300 via-yellow-200 to-amber-400',
  },
  { 
    name: 'Safety Champion', 
    minPoints: 50, 
    maxPoints: 99,
    icon: Medal,
    color: 'text-orange-300',
    textGradient: 'bg-gradient-to-r from-orange-300 to-rose-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-400/30',
    glowColor: 'rgba(251, 146, 60, 0.35)',
    ringColor: 'ring-orange-400/50',
    badgeGradient: 'from-orange-300 via-amber-200 to-rose-400',
  },
  { 
    name: 'Safety Legend', 
    minPoints: 100, 
    maxPoints: Infinity,
    icon: Crown,
    color: 'text-violet-300',
    textGradient: 'bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-400',
    bgColor: 'bg-violet-500/12',
    borderColor: 'border-violet-400/35',
    glowColor: 'rgba(167, 139, 250, 0.4)',
    ringColor: 'ring-violet-400/60',
    badgeGradient: 'from-violet-300 via-fuchsia-200 to-pink-400',
  },
];

// ============================================================================
// THEME CONFIG
// ============================================================================

const themeConfig = {
  emerald: {
    border: 'border-emerald-400/20',
    bgGradientCSS: 'linear-gradient(135deg, rgba(5, 5, 5, 0.3) 0%, rgba(2, 24, 16, 0.4) 50%, rgba(1, 13, 8, 1) 100%)',
    glassOverlay: 'bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent',
    accentGlow: 'rgba(16, 185, 129, 0.15)',
    shimmer: 'from-transparent via-emerald-300/20 to-transparent',
    orbColor: 'from-emerald-400/20 via-emerald-500/10 to-transparent',
    primaryAccent: 'emerald',
  },
  blue: {
    border: 'border-blue-400/20',
    bgGradientCSS: 'linear-gradient(to bottom right, #0a1628, #061220, #030810)',
    glassOverlay: 'bg-gradient-to-br from-blue-500/5 via-transparent to-blue-400/3',
    accentGlow: 'rgba(59, 130, 246, 0.15)',
    shimmer: 'from-transparent via-blue-300/20 to-transparent',
    orbColor: 'from-blue-400/20 via-blue-500/10 to-transparent',
    primaryAccent: 'blue',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCurrentLevel(points: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

function getNextLevel(points: number): Level | null {
  const currentLevelIndex = LEVELS.findIndex(l => points >= l.minPoints && points <= l.maxPoints);
  if (currentLevelIndex < LEVELS.length - 1) {
    return LEVELS[currentLevelIndex + 1];
  }
  return null;
}

function getLevelProgress(points: number, currentLevel: Level, nextLevel: Level | null): number {
  if (!nextLevel) return 1;
  const range = nextLevel.minPoints - currentLevel.minPoints;
  const progress = points - currentLevel.minPoints;
  return Math.min(progress / range, 1);
}

function getMotivationalMessage(points: number, recentClaims: number): { text: string; emoji: string } {
  if (points === 0) return { text: "Start your safety journey today!", emoji: "🚀" };
  if (recentClaims >= 5) return { text: "You're on fire this week!", emoji: "🔥" };
  if (points < 5) return { text: `${5 - points} more to level up!`, emoji: "⚡" };
  if (points < 10) return { text: "You're making great progress!", emoji: "✨" };
  if (points < 25) return { text: "Keep the momentum going!", emoji: "💪" };
  if (points < 50) return { text: "You're a safety rockstar!", emoji: "🎸" };
  if (points < 100) return { text: "Almost legendary status!", emoji: "👑" };
  return { text: "You're a Safety Legend!", emoji: "🏆" };
}

// ============================================================================
// FLOATING PARTICLES - Ambient decoration
// ============================================================================

const FloatingParticle = memo(function FloatingParticle({ 
  delay, 
  size, 
  x, 
  duration,
  color 
}: { 
  delay: number; 
  size: number; 
  x: number; 
  duration: number;
  color: string;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        bottom: '-10%',
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: 'blur(1px)',
      }}
      animate={{
        y: [0, -300],
        opacity: [0, 0.8, 0],
        scale: [0.5, 1, 0.5],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
});

// ============================================================================
// CELEBRATION BURST - For level-ups and milestones
// ============================================================================

const CelebrationBurst = memo(function CelebrationBurst({ active }: { active: boolean }) {
  if (!active) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(16)].map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const dist = 60 + (i % 4) * 15;
        const colors = ['#fbbf24', '#34d399', '#f472b6', '#60a5fa'];
        
        return (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{ 
              left: '50%', 
              top: '30%',
              background: colors[i % colors.length],
              boxShadow: `0 0 8px ${colors[i % colors.length]}`,
            }}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{
              scale: [0, 1.5, 0],
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: 0.8,
              delay: i * 0.02,
              ease: 'easeOut',
            }}
          />
        );
      })}
      
      {/* Central flash */}
      <motion.div
        className="absolute left-1/2 top-[30%] -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, transparent 70%)',
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 2, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 0.6 }}
      />
    </div>
  );
});

// ============================================================================
// PREMIUM LEVEL BADGE
// ============================================================================

interface LevelBadgeProps {
  level: Level;
  points: number;
  avatarUrl?: string | null;
  fullName?: string | null;
  enableAnimations: boolean;
}

const LevelBadge = memo(function LevelBadge({ 
  level, 
  points, 
  avatarUrl, 
  fullName,
  enableAnimations 
}: LevelBadgeProps) {
  // Note: level.icon is available if needed for future enhancements
  
  const initials = useMemo(() => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0]?.toUpperCase() || '?';
  }, [fullName]);
  
  return (
    <div className="relative">
      {/* Multi-layer glow effect - reduced on mobile */}
      <motion.div
        className="absolute -inset-2 sm:-inset-3 rounded-2xl sm:rounded-3xl blur-lg sm:blur-xl"
        style={{ background: level.glowColor }}
        animate={enableAnimations ? {
          opacity: [0.4, 0.7, 0.4],
          scale: [1, 1.1, 1],
        } : undefined}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      <motion.div
        className="absolute -inset-1 sm:-inset-1.5 rounded-xl sm:rounded-2xl blur-sm sm:blur-md"
        style={{ background: level.glowColor }}
      />
      
      {/* Main badge container */}
      <motion.div
        className={`
          relative w-14 h-14 sm:w-[72px] sm:h-[72px] md:w-20 md:h-20 rounded-xl sm:rounded-2xl
          ${level.bgColor} backdrop-blur-sm
          border-2 ${level.borderColor}
          ring-2 ${level.ringColor} ring-offset-1 ring-offset-black/50
          overflow-hidden
        `}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        whileHover={enableAnimations ? { scale: 1.05 } : undefined}
      >
        {/* Inner gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
        
        {/* Avatar or initials */}
        {avatarUrl ? (
          <motion.img
            src={avatarUrl}
            alt={fullName || 'User'}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-base sm:text-xl md:text-2xl font-bold ${level.color} drop-shadow-lg`}>
              {initials}
            </span>
          </div>
        )}
        
        {/* Premium shine sweep */}
        {enableAnimations && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
          />
        )}
      </motion.div>
      
      {/* XP Badge - Floating */}
      <motion.div
        className="absolute -bottom-1.5 -right-1.5 sm:-bottom-2 sm:-right-2 z-20"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
      >
        {/* Badge glow */}
        <motion.div
          className="absolute inset-0 rounded-full blur-md"
          style={{ background: `linear-gradient(135deg, ${level.glowColor}, transparent)` }}
          animate={enableAnimations ? {
            scale: [1, 1.3, 1],
            opacity: [0.6, 1, 0.6],
          } : undefined}
          transition={{ duration: 2, repeat: Infinity }}
        />
        
        {/* Main XP badge */}
        <div className={`
          relative flex items-center gap-0.5 sm:gap-1 
          bg-gradient-to-br ${level.badgeGradient}
          rounded-full px-1.5 py-0.5 sm:px-2 sm:py-1 md:px-2.5 md:py-1.5
          shadow-lg shadow-black/30
          border border-white/30
        `}>
          <Gem className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-black/70" />
          <span className="text-[9px] sm:text-[10px] md:text-xs font-black text-black/80">
            {points}
          </span>
        </div>
      </motion.div>
      
      {/* Level icon sparkle for high levels */}
      {points >= 25 && enableAnimations && (
        <motion.div
          className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 z-10"
          animate={{ 
            rotate: 360,
            scale: [1, 1.2, 1],
          }}
          transition={{ 
            rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
            scale: { duration: 2, repeat: Infinity }
          }}
        >
          <Sparkles className={`w-4 h-4 sm:w-5 sm:h-5 ${level.color} drop-shadow-lg`} />
        </motion.div>
      )}
    </div>
  );
});

// ============================================================================
// PREMIUM PROGRESS BAR
// ============================================================================

interface ProgressBarProps {
  progress: number;
  currentLevel: Level;
  nextLevel: Level | null;
  points: number;
  enableAnimations: boolean;
}

const ProgressBar = memo(function ProgressBar({ 
  progress, 
  currentLevel, 
  nextLevel,
  points,
  enableAnimations
}: ProgressBarProps) {
  const pointsToNext = nextLevel ? nextLevel.minPoints - points : 0;
  const NextIcon = nextLevel?.icon || Target;
  
  return (
    <div className="space-y-1.5 sm:space-y-2">
      {/* Progress bar container */}
      <div className="relative">
        {/* Track */}
        <div className="relative h-2.5 sm:h-3 md:h-3.5 rounded-full bg-black/30 overflow-hidden border border-white/5">
          {/* Track inner glow */}
          <div 
            className="absolute inset-0 rounded-full opacity-30"
            style={{
              background: `linear-gradient(90deg, ${currentLevel.glowColor}, transparent)`,
            }}
          />
          
          {/* Progress fill */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${currentLevel.glowColor}, ${nextLevel?.glowColor || currentLevel.glowColor})`,
              boxShadow: `0 0 12px ${currentLevel.glowColor}`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
          />
          
          {/* Animated shimmer on progress */}
          {enableAnimations && progress < 1 && progress > 0 && (
            <motion.div
              className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/40 to-transparent"
              style={{ left: `${Math.max(0, progress * 100 - 20)}%` }}
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          
          {/* Percentage marker */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{ left: `${Math.max(8, Math.min(progress * 100, 92))}%` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="text-[7px] sm:text-[8px] md:text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {Math.round(progress * 100)}%
            </span>
          </motion.div>
        </div>
        
        {/* Level markers */}
        <div className="flex justify-between items-center mt-1 sm:mt-1.5">
          <div className="flex items-center gap-1">
            <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${currentLevel.bgColor} border ${currentLevel.borderColor}`} />
            <span className={`text-[8px] sm:text-[9px] md:text-[10px] font-semibold ${currentLevel.color}`}>
              {currentLevel.name}
            </span>
          </div>
          
          {nextLevel && (
            <div className="flex items-center gap-1">
              <span className={`text-[8px] sm:text-[9px] md:text-[10px] font-medium text-white/40 hidden xs:inline`}>
                {nextLevel.name}
              </span>
              <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white/10 border border-white/20`} />
            </div>
          )}
        </div>
      </div>
      
      {/* Points to next level - Premium display */}
      {nextLevel && pointsToNext > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`
            flex items-center justify-between gap-1.5 sm:gap-2 
            px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl
            bg-gradient-to-r from-white/5 to-transparent
            border border-white/5
          `}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <motion.div
              animate={enableAnimations ? { scale: [1, 1.2, 1] } : undefined}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Zap className={`w-3 h-3 sm:w-4 sm:h-4 ${nextLevel.color}`} />
            </motion.div>
            <div>
              <span className="text-[9px] sm:text-[10px] md:text-xs text-white/60">
                <span className="font-bold text-white">{pointsToNext}</span> XP to unlock
              </span>
              <span className={`ml-1 sm:ml-1.5 text-[9px] sm:text-[10px] md:text-xs font-semibold ${nextLevel.color}`}>
                {nextLevel.name}
              </span>
            </div>
          </div>
          
          <div className={`
            flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg
            ${nextLevel.bgColor} border ${nextLevel.borderColor}
          `}>
            <NextIcon className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${nextLevel.color}`} />
          </div>
        </motion.div>
      )}
    </div>
  );
});

// ============================================================================
// STREAK INDICATOR - Enhanced
// ============================================================================

interface StreakIndicatorProps {
  recentClaims: number;
  enableAnimations: boolean;
}

const StreakIndicator = memo(function StreakIndicator({ 
  recentClaims, 
  enableAnimations 
}: StreakIndicatorProps) {
  const isOnFire = recentClaims >= 5;
  const isWarm = recentClaims >= 3;
  const isCold = recentClaims === 0;
  
  const config = isCold 
    ? { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', glow: 'rgba(148,163,184,0.2)' }
    : isOnFire 
    ? { color: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-400/30', glow: 'rgba(251,146,60,0.4)' }
    : isWarm
    ? { color: 'text-amber-300', bg: 'bg-amber-500/12', border: 'border-amber-400/25', glow: 'rgba(251,191,36,0.3)' }
    : { color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-400/25', glow: 'rgba(52,211,153,0.25)' };
  
  return (
    <motion.div
      className={`
        relative flex items-center gap-1 sm:gap-1.5 px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl
        ${config.bg} border ${config.border}
        backdrop-blur-sm
      `}
      animate={enableAnimations && isOnFire ? {
        boxShadow: [
          `0 0 0 ${config.glow}`,
          `0 0 20px ${config.glow}`,
          `0 0 0 ${config.glow}`,
        ],
      } : undefined}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      {/* Flame icon with animation */}
      <motion.div
        animate={enableAnimations && !isCold ? {
          scale: isOnFire ? [1, 1.3, 1] : [1, 1.1, 1],
          rotate: isOnFire ? [-5, 5, -5] : 0,
        } : undefined}
        transition={{ duration: isOnFire ? 0.4 : 0.8, repeat: Infinity }}
      >
        <Flame className={`w-3 h-3 sm:w-4 sm:h-4 ${config.color} ${isOnFire ? 'drop-shadow-[0_0_6px_rgba(251,146,60,0.8)]' : ''}`} />
      </motion.div>
      
      {/* Streak text */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        <span className={`text-[10px] sm:text-xs font-bold ${config.color}`}>
          {isCold ? 'Start' : recentClaims}
        </span>
        <span className="text-[9px] sm:text-[10px] text-white/40">
          {isCold ? 'a streak!' : 'this week'}
        </span>
      </div>
      
      {/* Fire emoji for hot streak */}
      {isOnFire && (
        <motion.span
          className="text-xs sm:text-sm"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          🔥
        </motion.span>
      )}
    </motion.div>
  );
});

// ============================================================================
// STATS PILLS
// ============================================================================

interface StatPillProps {
  icon: typeof Trophy;
  value: number | string;
  label: string;
  color: string;
  enableAnimations: boolean;
}

const StatPill = memo(function StatPill({ 
  icon: Icon, 
  value, 
  label, 
  color,
  enableAnimations 
}: StatPillProps) {
  return (
    <motion.div
      className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
      whileHover={enableAnimations ? { scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Icon className={`w-3 h-3 sm:w-4 sm:h-4 ${color}`} />
      <div className="flex items-baseline gap-0.5 sm:gap-1">
        <span className="text-xs sm:text-sm font-semibold tabular-nums text-white">{value}</span>
        <span className="text-[10px] sm:text-[11px] text-white/35 font-medium">{label}</span>
      </div>
    </motion.div>
  );
});

// ============================================================================
// PREMIUM CTA BUTTON
// ============================================================================

interface CTAButtonProps {
  currentLevel: Level;
  enableAnimations: boolean;
}

const CTAButton = memo(function CTAButton({ currentLevel, enableAnimations }: CTAButtonProps) {
  return (
    <motion.div
      whileHover={enableAnimations ? { scale: 1.01 } : undefined}
      whileTap={enableAnimations ? { scale: 0.99 } : undefined}
    >
      <Link
        to="/announcements"
        className={`
          relative flex items-center justify-between gap-2 sm:gap-3 
          px-2.5 py-2.5 sm:px-4 sm:py-3 md:py-3.5 rounded-lg sm:rounded-xl
          ${currentLevel.bgColor} 
          border ${currentLevel.borderColor}
          backdrop-blur-sm
          group overflow-hidden
          transition-all duration-300
          hover:border-opacity-50
        `}
      >
        {/* Background gradient animation */}
        {enableAnimations && (
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: `linear-gradient(135deg, ${currentLevel.glowColor} 0%, transparent 50%)`,
            }}
          />
        )}
        
        {/* Shimmer effect */}
        {enableAnimations && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
          />
        )}
        
        {/* Content */}
        <div className="relative flex items-center gap-2 sm:gap-3">
          <motion.div
            className={`
              flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl
              bg-gradient-to-br ${currentLevel.badgeGradient}
              shadow-lg
            `}
            animate={enableAnimations ? {
              rotate: [0, 5, -5, 0],
              scale: [1, 1.05, 1],
            } : undefined}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
          >
            <Gift className="w-4 h-4 sm:w-5 sm:h-5 text-black/70" />
          </motion.div>
          
          <div>
            <span className="text-xs sm:text-sm font-bold text-white block">
              Collect More Points
            </span>
            <span className="text-[10px] sm:text-[11px] text-white/50 block mt-0.5">
              Read announcements to earn XP & level up
            </span>
          </div>
        </div>
        
        {/* Arrow with animation */}
        <motion.div
          className={`
            relative flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-md sm:rounded-lg
            bg-white/5 border border-white/10
            group-hover:bg-white/10 transition-colors
          `}
          animate={enableAnimations ? { x: [0, 3, 0] } : undefined}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 ${currentLevel.color}`} />
        </motion.div>
      </Link>
    </motion.div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function EnhancedRewardsCardComponent({ 
  theme = 'emerald',
  onPointsChange,
}: EnhancedRewardsCardProps) {
  const { user, avatarUrl, fullName } = useAuth();
  const themeStyles = themeConfig[theme];
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isLowEnd;
  
  const [rewards, setRewards] = useState<RewardData>({
    totalPoints: 0,
    claimsCount: 0,
    recentClaims: 0,
    loading: true,
    error: null,
  });
  
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousPoints, setPreviousPoints] = useState(0);

  // Fetch reward points
  const fetchRewards = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Displayed total = ledger balance (single source of truth: announcement
      // claims + compliance forms + future sources). Claim counts stay sourced
      // from announcement_rewards since they describe announcement engagement.
      const [balanceResult, claimsResult] = await Promise.all([
        supabase.rpc('get_user_point_balance', { target_user_id: user.id }),
        supabase
          .from('announcement_rewards')
          .select('points_awarded, claimed_at')
          .eq('user_id', user.id),
      ]);

      if (balanceResult.error) throw balanceResult.error;
      if (claimsResult.error) throw claimsResult.error;

      const data = claimsResult.data;
      const totalPoints = (balanceResult.data as number) ?? 0;
      const claimsCount = data?.length ?? 0;
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentClaims = data?.filter(r => 
        r.claimed_at && new Date(r.claimed_at) >= weekAgo
      ).length ?? 0;

      setRewards({
        totalPoints,
        claimsCount,
        recentClaims,
        loading: false,
        error: null,
      });
      
      // Trigger celebration
      if (totalPoints > previousPoints && previousPoints > 0) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 2000);
      }
      setPreviousPoints(totalPoints);
      
      onPointsChange?.(totalPoints);
    } catch {
      setRewards(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load rewards',
      }));
    }
  }, [user?.id, onPointsChange, previousPoints]);

  useEffect(() => {
    fetchRewards();
    const interval = setInterval(fetchRewards, 30000);
    return () => clearInterval(interval);
  }, [fetchRewards]);

  const currentLevel = useMemo(() => getCurrentLevel(rewards.totalPoints), [rewards.totalPoints]);
  const nextLevel = useMemo(() => getNextLevel(rewards.totalPoints), [rewards.totalPoints]);
  const progress = useMemo(
    () => getLevelProgress(rewards.totalPoints, currentLevel, nextLevel), 
    [rewards.totalPoints, currentLevel, nextLevel]
  );
  const motivation = useMemo(
    () => getMotivationalMessage(rewards.totalPoints, rewards.recentClaims),
    [rewards.totalPoints, rewards.recentClaims]
  );

  // Loading state
  if (rewards.loading) {
    return (
      <div className={`rounded-xl sm:rounded-2xl border ${themeStyles.border} p-3 sm:p-4 animate-pulse`} style={{ background: themeStyles.bgGradientCSS }}>
        <div className="flex items-start gap-2.5 sm:gap-4">
          <div className="w-14 h-14 sm:w-[72px] sm:h-[72px] md:w-20 md:h-20 rounded-xl sm:rounded-2xl bg-white/5" />
          <div className="flex-1 space-y-2 sm:space-y-3">
            <div className="h-4 sm:h-5 w-24 sm:w-32 bg-white/10 rounded" />
            <div className="h-3 sm:h-4 w-36 sm:w-48 bg-white/5 rounded" />
            <div className="h-2.5 sm:h-3 w-full bg-white/5 rounded-full mt-3 sm:mt-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className={`
        relative overflow-hidden rounded-2xl border ${themeStyles.border}
      `}
      style={{ 
        background: themeStyles.bgGradientCSS,
        boxShadow: `0 8px 40px ${themeStyles.accentGlow}, 0 0 0 1px rgba(255,255,255,0.03) inset`,
      }}
    >
      {/* Glass overlay */}
      <div className={`absolute inset-0 ${themeStyles.glassOverlay} pointer-events-none`} />
      
      {/* Top border shine */}
      <motion.div 
        className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${themeStyles.shimmer}`}
        animate={enableAnimations ? { opacity: [0.3, 0.8, 0.3] } : undefined}
        transition={{ duration: 3, repeat: Infinity }}
      />
      
      {/* Floating particles */}
      {enableAnimations && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <FloatingParticle
              key={i}
              delay={i * 2}
              size={4 + (i % 3) * 2}
              x={15 + i * 20}
              duration={8 + i * 2}
              color={currentLevel.glowColor}
            />
          ))}
        </div>
      )}
      
      {/* Decorative orb */}
      {enableAnimations && (
        <motion.div
          className={`absolute -top-16 -right-16 w-48 h-48 rounded-full bg-gradient-to-br ${themeStyles.orbColor} pointer-events-none`}
          style={{ filter: 'blur(40px)' }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      
      {/* Celebration burst */}
      <AnimatePresence>
        {showCelebration && enableAnimations && <CelebrationBurst active={showCelebration} />}
      </AnimatePresence>
      
      {/* Content */}
      <div className="relative p-3 sm:p-4 md:p-5">
        {/* Header section */}
        <div className="flex items-start gap-2.5 sm:gap-4 mb-3 sm:mb-4">
          {/* Level badge */}
          <LevelBadge
            level={currentLevel}
            points={rewards.totalPoints}
            avatarUrl={avatarUrl}
            fullName={fullName}
            enableAnimations={enableAnimations}
          />
          
          {/* Info section */}
          <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
            {/* Level name + streak */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <span className={`text-xs sm:text-sm md:text-base font-semibold tracking-tight ${currentLevel.textGradient} bg-clip-text text-transparent`}>
                {currentLevel.name}
              </span>
              <StreakIndicator 
                recentClaims={rewards.recentClaims} 
                enableAnimations={enableAnimations}
              />
            </div>
            
            {/* Motivational message */}
            <motion.p 
              className="text-[10px] sm:text-xs md:text-sm text-white/60 mb-2 sm:mb-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {motivation.emoji} {motivation.text}
            </motion.p>
            
            {/* Progress bar */}
            <ProgressBar
              progress={progress}
              currentLevel={currentLevel}
              nextLevel={nextLevel}
              points={rewards.totalPoints}
              enableAnimations={enableAnimations}
            />
          </div>
        </div>
        
        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
          <StatPill
            icon={Trophy}
            value={rewards.totalPoints}
            label="XP"
            color="text-amber-300"
            enableAnimations={enableAnimations}
          />
          <StatPill
            icon={TrendingUp}
            value={rewards.claimsCount}
            label="collected"
            color="text-emerald-300"
            enableAnimations={enableAnimations}
          />
        </div>
        
        {/* CTA */}
        <CTAButton 
          currentLevel={currentLevel}
          enableAnimations={enableAnimations}
        />

        {/* Safety Rewards link */}
        <Link
          to="/safety-rewards"
          className={`
            mt-2.5 sm:mt-3 flex items-center justify-between gap-2
            px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-lg
            ${currentLevel.bgColor} border ${currentLevel.borderColor}
            backdrop-blur-sm text-white/90 hover:text-white
            transition-all duration-200 hover:border-opacity-50
          `}
        >
          <span className="text-[11px] sm:text-xs font-medium">
            Monthly raffle & prizes
          </span>
          <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${currentLevel.color}`} />
        </Link>
      </div>
      
      {/* Bottom border shine */}
      <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${themeStyles.shimmer} opacity-30`} />
    </motion.div>
  );
}

export const EnhancedRewardsCard = memo(EnhancedRewardsCardComponent);
export default EnhancedRewardsCard;
