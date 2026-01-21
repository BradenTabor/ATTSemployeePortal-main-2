/**
 * EnhancedEmptyStates Component Collection
 * 
 * Actionable empty states that guide users to their next step
 * instead of just showing "nothing here" messages.
 * 
 * UX Philosophy:
 * - Empty states should be helpful, not dead ends
 * - Provide clear next actions
 * - Use friendly, encouraging language
 * - Visual interest to reduce feeling of emptiness
 */

import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Inbox,
  Phone,
  FileText,
  CheckCircle2,
  History,
  Sparkles,
  ArrowRight,
  Trophy,
} from 'lucide-react';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// EMPTY JOBS STATE (Enhanced)
// ============================================================================

export const EnhancedEmptyJobsState = memo(function EnhancedEmptyJobsState() {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      {/* Animated icon */}
      <motion.div
        animate={caps.prefersReducedMotion ? undefined : {
          y: [0, -5, 0],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative mb-4"
      >
        <div className="absolute -inset-3 rounded-full bg-emerald-500/10 blur-xl" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center">
          <Inbox className="w-8 h-8 text-emerald-400/60" />
        </div>
      </motion.div>
      
      {/* Message */}
      <h4 className="text-base font-semibold text-white/80 mb-1">No Active Jobs</h4>
      <p className="text-sm text-white/50 max-w-xs mb-4">
        Jobs assigned to you will appear here. Check back soon or contact your foreman.
      </p>
      
      {/* Action buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors"
        >
          <Phone className="w-4 h-4" />
          Contact Foreman
        </Link>
        <Link
          to="/forms"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Submit Forms
        </Link>
      </div>
    </motion.div>
  );
});

// ============================================================================
// ALL FORMS COMPLETE STATE
// ============================================================================

export const AllFormsCompleteState = memo(function AllFormsCompleteState() {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-6 text-center"
    >
      {/* Celebration animation */}
      <motion.div
        animate={caps.prefersReducedMotion ? undefined : {
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="relative mb-3"
      >
        <div className="absolute -inset-4 rounded-full bg-emerald-400/20 blur-xl" />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </div>
        {/* Sparkles */}
        <motion.div
          className="absolute -top-1 -right-1"
          animate={caps.prefersReducedMotion ? undefined : { rotate: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
        </motion.div>
      </motion.div>
      
      <h4 className="text-base font-bold text-emerald-400 mb-1">You're All Caught Up!</h4>
      <p className="text-sm text-white/50 max-w-xs mb-3">
        All compliance forms submitted for today. Great job staying safe!
      </p>
      
      <Link
        to="/forms-history"
        className="inline-flex items-center gap-2 text-sm text-emerald-400/70 hover:text-emerald-400 transition-colors"
      >
        <History className="w-4 h-4" />
        View submission history
        <ArrowRight className="w-3 h-3" />
      </Link>
    </motion.div>
  );
});

// ============================================================================
// NO REWARDS STATE
// ============================================================================

export const NoRewardsState = memo(function NoRewardsState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-4 text-center"
    >
      <div className="relative mb-3">
        <div className="absolute -inset-2 rounded-full bg-amber-400/10 blur-lg" />
        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-500/10 border border-amber-400/30 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-amber-400/50" />
        </div>
      </div>
      
      <h4 className="text-sm font-semibold text-white/70 mb-1">Start Earning Points</h4>
      <p className="text-xs text-white/40 max-w-[200px] mb-3">
        Read safety announcements to earn reward points!
      </p>
      
      <Link
        to="/announcements"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
      >
        <Sparkles className="w-3 h-3" />
        View Announcements
      </Link>
    </motion.div>
  );
});

// ============================================================================
// WEEKEND MODE STATE
// ============================================================================

export const WeekendModeState = memo(function WeekendModeState() {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 px-4 py-3"
    >
      <motion.div
        animate={caps.prefersReducedMotion ? undefined : {
          rotate: [0, 10, -10, 0],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/10 border border-emerald-400/30 flex items-center justify-center"
      >
        <Sparkles className="w-6 h-6 text-emerald-400" />
      </motion.div>
      
      <div>
        <h4 className="text-sm font-bold text-white mb-0.5">Weekend Mode 🎉</h4>
        <p className="text-xs text-white/50">Enjoy your time off! No compliance forms required today.</p>
      </div>
    </motion.div>
  );
});

// ============================================================================
// EMPTY ANNOUNCEMENTS STATE
// ============================================================================

export const EmptyAnnouncementsState = memo(function EmptyAnnouncementsState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-8 text-center"
    >
      <div className="relative mb-4">
        <div className="absolute -inset-3 rounded-full bg-blue-500/10 blur-xl" />
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center">
          <FileText className="w-7 h-7 text-blue-400/60" />
        </div>
      </div>
      
      <h4 className="text-base font-semibold text-white/80 mb-1">No Announcements Yet</h4>
      <p className="text-sm text-white/50 max-w-xs">
        Company announcements and safety updates will appear here.
      </p>
    </motion.div>
  );
});

// ============================================================================
// LOADING ERROR STATE
// ============================================================================

interface LoadingErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const LoadingErrorState = memo(function LoadingErrorState({
  message = 'Something went wrong',
  onRetry,
}: LoadingErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-6 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
        <span className="text-2xl">⚠️</span>
      </div>
      
      <h4 className="text-sm font-semibold text-red-400 mb-1">Oops!</h4>
      <p className="text-xs text-white/50 max-w-xs mb-3">{message}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
        >
          Try Again
        </button>
      )}
    </motion.div>
  );
});
