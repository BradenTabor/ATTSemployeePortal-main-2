/**
 * RewardPointsCard Component
 * 
 * Displays the user's earned reward points from Safety AI announcement engagement.
 * Gamification element that encourages employees to read safety announcements.
 * 
 * UX Philosophy:
 * - Celebration of achievement - makes users feel good about engagement
 * - Clear progress visualization - users see their contribution
 * - Non-intrusive - informational, not demanding action
 * - Quick link to announcements for further engagement
 */

import { memo, useMemo, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Trophy,
  Star,
  Sparkles,
  ChevronRight,
  TrendingUp,
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
  loading: boolean;
  error: string | null;
}

interface RewardPointsCardProps {
  /** Theme variant for different dashboard contexts */
  theme?: 'emerald' | 'blue';
  /** Compact mode shows minimal info */
  compact?: boolean;
}

// ============================================================================
// THEME CONFIG
// ============================================================================

const themeConfig = {
  emerald: {
    border: 'border-emerald-400/20',
    bg: 'rgba(4, 30, 21, 0.95)',
    headerBg: 'from-emerald-500/10 to-emerald-600/5',
    accent: 'text-emerald-400',
    accentBg: 'bg-emerald-500/10',
    accentBorder: 'border-emerald-500/30',
    glow: 'rgba(16, 185, 129, 0.15)',
    gradientFrom: 'from-emerald-400',
    gradientTo: 'to-emerald-600',
    starColor: 'text-amber-400',
  },
  blue: {
    border: 'border-blue-400/20',
    bg: 'rgba(10, 22, 40, 0.95)',
    headerBg: 'from-blue-500/10 to-blue-600/5',
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-500/30',
    glow: 'rgba(59, 130, 246, 0.15)',
    gradientFrom: 'from-blue-400',
    gradientTo: 'to-blue-600',
    starColor: 'text-amber-400',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getEngagementLevel(points: number): { level: string; nextLevel: number; progress: number } {
  if (points >= 50) return { level: 'Safety Champion', nextLevel: 100, progress: (points - 50) / 50 };
  if (points >= 25) return { level: 'Safety Pro', nextLevel: 50, progress: (points - 25) / 25 };
  if (points >= 10) return { level: 'Safety Aware', nextLevel: 25, progress: (points - 10) / 15 };
  if (points >= 5) return { level: 'Getting Started', nextLevel: 10, progress: (points - 5) / 5 };
  return { level: 'Newcomer', nextLevel: 5, progress: points / 5 };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function RewardPointsCardComponent({ theme = 'emerald', compact = false }: RewardPointsCardProps) {
  const { user } = useAuth();
  const themeStyles = themeConfig[theme];
  const caps = useMemo(() => getDeviceCapabilities(), []);
  
  const [rewards, setRewards] = useState<RewardData>({
    totalPoints: 0,
    claimsCount: 0,
    loading: true,
    error: null,
  });

  // Fetch reward points
  const fetchRewards = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      // Displayed total = ledger balance (single source of truth). Claim count
      // stays sourced from announcement_rewards (it counts announcement claims).
      const [balanceResult, claimsResult] = await Promise.all([
        supabase.rpc('get_user_point_balance', { target_user_id: user.id }),
        supabase
          .from('announcement_rewards')
          .select('points_awarded')
          .eq('user_id', user.id),
      ]);

      if (balanceResult.error) throw balanceResult.error;
      if (claimsResult.error) throw claimsResult.error;

      const totalPoints = (balanceResult.data as number) ?? 0;
      const claimsCount = claimsResult.data?.length ?? 0;

      setRewards({
        totalPoints,
        claimsCount,
        loading: false,
        error: null,
      });
    } catch {
      setRewards(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load rewards',
      }));
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  const engagement = useMemo(() => getEngagementLevel(rewards.totalPoints), [rewards.totalPoints]);

  // Loading state
  if (rewards.loading) {
    return (
      <div 
        className={`rounded-2xl border ${themeStyles.border} p-4 animate-pulse`}
        style={{ background: themeStyles.bg }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/5" />
          <div className="flex-1">
            <div className="h-5 w-16 bg-white/10 rounded mb-1" />
            <div className="h-3 w-24 bg-white/5 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Compact mode - just show points
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.02 }}
      >
        <Link
          to="/announcements"
          className={`
            flex items-center gap-3 px-4 py-3 rounded-xl
            border ${themeStyles.border}
            hover:border-amber-400/30 transition-colors
            group
          `}
          style={{ background: themeStyles.bg }}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-white">{rewards.totalPoints}</span>
              <span className="text-xs text-white/50">pts</span>
            </div>
            <p className="text-[10px] text-amber-400/70 font-medium">{engagement.level}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative overflow-hidden rounded-2xl border ${themeStyles.border}
      `}
      style={{ 
        background: themeStyles.bg,
        boxShadow: `0 4px 20px ${themeStyles.glow}`,
      }}
    >
      {/* Top shine */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
      
      {/* Decorative background orb */}
      <motion.div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, transparent 70%)',
          filter: 'blur(15px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      <div className="relative p-4">
        {/* Main content */}
        <div className="flex items-start gap-4">
          {/* Trophy icon with glow */}
          <motion.div
            className="relative flex-shrink-0"
            animate={rewards.totalPoints > 0 ? {
              rotate: [0, -5, 5, 0],
            } : undefined}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <div className="absolute -inset-1 rounded-xl bg-amber-400/20 blur-md" />
            <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30 flex items-center justify-center">
              <Trophy className="w-7 h-7 text-amber-400" />
            </div>
            {/* Star decorations */}
            {rewards.totalPoints >= 10 && (
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              >
                <Star className="w-4 h-4 text-amber-400 fill-amber-400/50" />
              </motion.div>
            )}
          </motion.div>
          
          {/* Points and level */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <motion.span
                key={rewards.totalPoints}
                initial={{ scale: 1.2, color: '#fbbf24' }}
                animate={{ scale: 1, color: '#ffffff' }}
                className="text-2xl font-black text-white"
              >
                {rewards.totalPoints}
              </motion.span>
              <span className="text-sm text-white/50 font-medium">points</span>
            </div>
            
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-semibold text-amber-400">{engagement.level}</span>
              {engagement.nextLevel > rewards.totalPoints && (
                <span className="text-[10px] text-white/40">
                  · {engagement.nextLevel - rewards.totalPoints} to next level
                </span>
              )}
            </div>
            
            {/* Progress bar to next level */}
            {rewards.totalPoints < 100 && (
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(engagement.progress * 100, 100)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}
            
            {/* Stats */}
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1 text-[10px] text-white/40">
                <TrendingUp className="w-3 h-3" />
                <span>{rewards.claimsCount} announcements read</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* CTA */}
        <motion.div
          className="mt-4"
          whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.01 }}
          whileTap={caps.prefersReducedMotion ? undefined : { scale: 0.99 }}
        >
          <Link
            to="/announcements"
            className={`
              flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl
              bg-gradient-to-r from-amber-500/10 to-amber-600/5
              border border-amber-400/20 hover:border-amber-400/40
              transition-colors group
            `}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-white/80">Earn more by reading announcements</span>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400/50 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}

export const RewardPointsCard = memo(RewardPointsCardComponent);
export default RewardPointsCard;
