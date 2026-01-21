/**
 * EnhancedSkeletons Component Collection
 * 
 * Premium shimmer-based skeleton loaders that match actual card layouts.
 * Provides a polished loading experience with subtle animations.
 * 
 * UX Philosophy:
 * - Skeletons should match final content layout
 * - Shimmer effect provides visual feedback that loading is happening
 * - Subtle animations reduce perceived wait time
 */

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// SHIMMER EFFECT
// ============================================================================

const ShimmerOverlay = memo(function ShimmerOverlay() {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  
  if (caps.prefersReducedMotion) return null;
  
  return (
    <motion.div
      className="absolute inset-0 -translate-x-full"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
      }}
      animate={{ translateX: ['−100%', '100%'] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
    />
  );
});

// ============================================================================
// WELCOME HEADER SKELETON
// ============================================================================

export const WelcomeHeaderSkeleton = memo(function WelcomeHeaderSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.08] animate-pulse"
      style={{
        background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.05) 0%, rgba(4, 30, 21, 0.65) 40%, rgba(0, 0, 0, 0.75) 100%)',
      }}
    >
      <ShimmerOverlay />
      <div className="px-4 py-4 sm:px-5 sm:py-4 md:px-7 md:py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 flex-1">
            {/* Accent line */}
            <div className="w-1 h-12 sm:h-14 rounded-full bg-emerald-500/20" />
            
            {/* Text content */}
            <div className="flex-1 space-y-2">
              <div className="h-6 sm:h-8 w-48 sm:w-64 bg-white/10 rounded-lg" />
              <div className="h-3 sm:h-4 w-32 sm:w-40 bg-white/5 rounded" />
              <div className="flex gap-2 mt-2">
                <div className="h-5 w-20 bg-emerald-500/10 rounded-full" />
              </div>
            </div>
          </div>
          
          {/* Avatar */}
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/20" />
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// MISSION CONTROL SKELETON
// ============================================================================

export const MissionControlSkeleton = memo(function MissionControlSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-emerald-400/20 animate-pulse"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 1) 100%)',
      }}
    >
      <ShimmerOverlay />
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Progress ring placeholder */}
          <div className="w-[72px] h-[72px] rounded-full bg-white/5 border-4 border-white/10" />
          
          {/* Status text */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500/20" />
              <div className="h-4 w-28 bg-white/10 rounded" />
            </div>
            <div className="h-3 w-24 bg-white/5 rounded" />
            <div className="h-2.5 w-36 bg-white/5 rounded" />
          </div>
          
          {/* Rewards badge */}
          <div className="w-16 h-16 rounded-xl bg-amber-500/10 border border-amber-500/20" />
        </div>
        
        {/* Expand button placeholder */}
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="h-4 w-24 bg-white/5 rounded" />
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// QUICK ACTIONS SKELETON - Premium Carousel Style
// ============================================================================

const skeletonColors = [
  { bg: 'from-emerald-800/60 to-emerald-900/60', border: 'border-emerald-500/30', glow: 'bg-emerald-500/10' },
  { bg: 'from-amber-800/60 to-amber-900/60', border: 'border-amber-500/30', glow: 'bg-amber-500/10' },
  { bg: 'from-blue-800/60 to-blue-900/60', border: 'border-blue-500/30', glow: 'bg-blue-500/10' },
  { bg: 'from-purple-800/60 to-purple-900/60', border: 'border-purple-500/30', glow: 'bg-purple-500/10' },
  { bg: 'from-cyan-800/60 to-cyan-900/60', border: 'border-cyan-500/30', glow: 'bg-cyan-500/10' },
];

const skeletonWidths = ['110px', '135px', '95px', '100px', '125px'];

export const QuickActionsSkeleton = memo(function QuickActionsSkeleton() {
  return (
    <div className="relative overflow-hidden">
      {/* Decorative glow */}
      <div 
        className="absolute inset-0 -z-10 blur-3xl opacity-20 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.3) 0%, rgba(96, 165, 250, 0.3) 50%, rgba(167, 139, 250, 0.3) 100%)',
        }}
      />
      
      <div className="flex items-center gap-4 overflow-hidden py-3 px-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i} 
            className={`flex-shrink-0 h-[54px] rounded-2xl bg-gradient-to-br ${skeletonColors[i].bg} ${skeletonColors[i].border} border animate-pulse flex items-center gap-3 px-5`}
            style={{ 
              width: skeletonWidths[i],
              animationDelay: `${i * 150}ms`,
            }}
          >
            {/* Icon placeholder with glow effect */}
            <div className={`w-9 h-9 rounded-xl ${skeletonColors[i].glow} flex-shrink-0`}>
              <div className="w-full h-full rounded-xl bg-white/10" />
            </div>
            {/* Label placeholder */}
            <div className="h-4 flex-1 rounded bg-white/15" />
          </div>
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// JOB CARD SKELETON (Enhanced)
// ============================================================================

export const EnhancedJobCardSkeleton = memo(function EnhancedJobCardSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-emerald-500/20 animate-pulse"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 1) 100%)',
      }}
    >
      <ShimmerOverlay />
      <div className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 bg-white/10 rounded" />
            <div className="h-3 w-24 bg-white/5 rounded" />
          </div>
          <div className="h-8 w-14 bg-emerald-500/10 rounded-lg" />
        </div>
        <div className="h-2 bg-white/5 rounded-full" />
      </div>
    </div>
  );
});

// ============================================================================
// JOBS SECTION SKELETON
// ============================================================================

export const JobsSectionSkeleton = memo(function JobsSectionSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-xl sm:rounded-2xl md:rounded-[28px] border border-emerald-400/20 animate-pulse"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 1) 100%)',
      }}
    >
      <ShimmerOverlay />
      <div className="p-3 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-24 bg-emerald-500/10 rounded-full" />
            <div className="w-4 h-4 rounded-full bg-emerald-500/10" />
          </div>
        </div>
        
        {/* Job cards */}
        <div className="space-y-2 sm:space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <EnhancedJobCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// ANNOUNCEMENT CARD SKELETON (Enhanced)
// ============================================================================

export const EnhancedAnnouncementSkeleton = memo(function EnhancedAnnouncementSkeleton() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl md:rounded-[28px] border border-emerald-400/20 animate-pulse"
      style={{
        background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.98) 0%, rgba(2, 15, 10, 1) 100%)',
      }}
    >
      <ShimmerOverlay />
      <div className="p-4 sm:p-6">
        {/* Badge and date */}
        <div className="flex items-center gap-3 mb-3">
          <div className="h-6 w-20 bg-emerald-500/10 rounded-full" />
          <div className="h-3 w-24 bg-white/5 rounded" />
        </div>
        
        {/* Title */}
        <div className="h-6 sm:h-7 w-3/4 bg-white/10 rounded mb-2" />
        
        {/* Preview text */}
        <div className="space-y-2 mb-4">
          <div className="h-4 w-full bg-white/5 rounded" />
          <div className="h-4 w-2/3 bg-white/5 rounded" />
        </div>
        
        {/* Footer */}
        <div className="pt-3 border-t border-emerald-400/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10" />
            <div className="space-y-1">
              <div className="h-3 w-20 bg-white/10 rounded" />
              <div className="h-2 w-14 bg-white/5 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// NAV CARDS SKELETON (Enhanced)
// ============================================================================

export const EnhancedNavCardsSkeleton = memo(function EnhancedNavCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 w-full">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="relative overflow-hidden rounded-2xl border border-white/10 animate-pulse h-28 md:h-32"
          style={{
            background: 'linear-gradient(145deg, rgba(4, 30, 21, 0.6) 0%, rgba(2, 15, 10, 0.8) 100%)',
          }}
        >
          <ShimmerOverlay />
          <div className="p-4 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-white/5" />
              <div className="w-5 h-5 rounded bg-white/5" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-3 w-32 bg-white/5 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
