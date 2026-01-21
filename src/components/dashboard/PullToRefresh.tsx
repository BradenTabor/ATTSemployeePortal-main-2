/**
 * PullToRefresh Component
 * 
 * A native-feeling pull-to-refresh wrapper for mobile devices.
 * Provides visual feedback during refresh and haptic feedback on iOS.
 * 
 * UX Philosophy:
 * - Natural gesture-based interaction
 * - Clear visual feedback during pull
 * - Smooth, performant animations
 * - Graceful fallback on desktop (hidden)
 */

import {
  memo,
  useRef,
  useState,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// TYPES
// ============================================================================

interface PullToRefreshProps {
  /** Content to wrap */
  children: ReactNode;
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void>;
  /** Whether a refresh is currently in progress (controlled externally) */
  isRefreshing?: boolean;
  /** Threshold in pixels before refresh triggers */
  threshold?: number;
  /** Maximum pull distance */
  maxPull?: number;
  /** Custom loading text */
  loadingText?: string;
  /** Custom pull text */
  pullText?: string;
  /** Custom release text */
  releaseText?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_THRESHOLD = 80;
const DEFAULT_MAX_PULL = 120;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function PullToRefreshComponent({
  children,
  onRefresh,
  isRefreshing: externalRefreshing,
  threshold = DEFAULT_THRESHOLD,
  maxPull = DEFAULT_MAX_PULL,
  loadingText = 'Refreshing...',
  pullText = 'Pull to refresh',
  releaseText = 'Release to refresh',
}: PullToRefreshProps) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Motion values for smooth animation
  const pullDistance = useMotionValue(0);
  const indicatorOpacity = useTransform(pullDistance, [0, threshold * 0.5], [0, 1]);
  const indicatorScale = useTransform(pullDistance, [0, threshold], [0.5, 1]);
  const indicatorRotation = useTransform(pullDistance, [0, threshold], [0, 180]);

  // Combined refreshing state
  const refreshing = isRefreshing || externalRefreshing;

  // Trigger haptic feedback on iOS
  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    
    const scrollTop = containerRef.current?.scrollTop || window.scrollY;
    if (scrollTop > 5) return; // Only allow pull when at top
    
    startYRef.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [refreshing]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || refreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    
    if (diff < 0) {
      pullDistance.set(0);
      return;
    }
    
    // Apply resistance for over-pull
    const resistance = Math.min(diff, maxPull);
    const dampedPull = resistance * (1 - Math.min(resistance / maxPull, 0.5));
    pullDistance.set(dampedPull);
    
    // Haptic feedback when crossing threshold
    const prevPull = pullDistance.getPrevious();
    if (dampedPull >= threshold && prevPull !== undefined && prevPull < threshold) {
      triggerHaptic();
    }
  }, [isPulling, refreshing, maxPull, threshold, pullDistance, triggerHaptic]);

  // Handle touch end
  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || refreshing) return;
    
    setIsPulling(false);
    const currentPull = pullDistance.get();
    
    if (currentPull >= threshold) {
      // Trigger refresh
      setIsRefreshing(true);
      triggerHaptic();
      
      // Animate to loading position
      await animate(pullDistance, threshold * 0.6, { duration: 0.2 });
      
      try {
        await onRefresh();
      } finally {
        // Animate back
        await animate(pullDistance, 0, { duration: 0.3, ease: 'easeOut' });
        setIsRefreshing(false);
      }
    } else {
      // Snap back
      animate(pullDistance, 0, { duration: 0.2, ease: 'easeOut' });
    }
  }, [isPulling, refreshing, pullDistance, threshold, onRefresh, triggerHaptic]);

  // Get current state text
  const stateText = useMemo(() => {
    if (refreshing) return loadingText;
    if (pullDistance.get() >= threshold) return releaseText;
    return pullText;
  }, [refreshing, pullDistance, threshold, loadingText, releaseText, pullText]);

  // Don't render on desktop - must be after all hooks
  if (!caps.isMobile) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        className="absolute left-0 right-0 -top-16 h-16 flex flex-col items-center justify-end pb-2 pointer-events-none z-50"
        style={{ 
          opacity: indicatorOpacity,
          y: pullDistance,
        }}
      >
        <motion.div
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#041e15]/90 border border-emerald-500/30 shadow-lg"
          style={{ scale: indicatorScale }}
        >
          {refreshing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
            </motion.div>
          ) : (
            <motion.div style={{ rotate: indicatorRotation }}>
              <ArrowDown className="w-4 h-4 text-emerald-400" />
            </motion.div>
          )}
          <span className="text-xs font-medium text-emerald-300">{stateText}</span>
        </motion.div>
      </motion.div>

      {/* Content wrapper */}
      <motion.div
        style={{ y: pullDistance }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}

export const PullToRefresh = memo(PullToRefreshComponent);
export default PullToRefresh;
