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
  useEffect,
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
  const isPullingRef = useRef(false);
  const lastPullRef = useRef(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Motion values for smooth animation
  const pullDistance = useMotionValue(0);
  const indicatorOpacity = useTransform(pullDistance, [0, threshold * 0.5], [0, 1]);
  const indicatorScale = useTransform(pullDistance, [0, threshold], [0.5, 1]);
  const indicatorRotation = useTransform(pullDistance, [0, threshold], [0, 180]);

  // Refs for passive listeners (avoid blocking scroll; avoid stale closures)
  const pullDistanceRef = useRef(pullDistance);
  const thresholdRef = useRef(threshold);
  const maxPullRef = useRef(maxPull);
  pullDistanceRef.current = pullDistance;
  thresholdRef.current = threshold;
  maxPullRef.current = maxPull;

  // Combined refreshing state
  const refreshing = isRefreshing || externalRefreshing;
  const refreshingRef = useRef(refreshing);
  refreshingRef.current = refreshing;

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // Trigger haptic feedback on iOS
  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, []);

  // Passive touch listeners so we never block native scroll (fixes mobile scroll lag)
  useEffect(() => {
    if (!caps.isMobile || !containerRef.current) return;
    const el = containerRef.current;

    const getScrollTop = (): number => {
      const scrollEl = el.closest<HTMLElement>('[data-scroll-container]');
      if (scrollEl) return scrollEl.scrollTop;
      return (el as HTMLElement).scrollTop ?? window.scrollY;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (getScrollTop() > 5) return;
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
      setIsPulling(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || refreshingRef.current) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;
      if (diff < 0) {
        lastPullRef.current = 0;
        pullDistanceRef.current.set(0);
        return;
      }
      const maxP = maxPullRef.current;
      const thresh = thresholdRef.current;
      const resistance = Math.min(diff, maxP);
      const dampedPull = resistance * (1 - Math.min(resistance / maxP, 0.5));
      pullDistanceRef.current.set(dampedPull);
      const prevPull =
        typeof pullDistanceRef.current.getPrevious === 'function'
          ? pullDistanceRef.current.getPrevious()
          : lastPullRef.current;
      lastPullRef.current = dampedPull;
      if (dampedPull >= thresh && prevPull !== undefined && prevPull < thresh) {
        triggerHaptic();
      }
    };

    const handleTouchEnd = () => {
      if (!isPullingRef.current || refreshingRef.current) {
        isPullingRef.current = false;
        setIsPulling(false);
        return;
      }
      isPullingRef.current = false;
      setIsPulling(false);
      const currentPull = pullDistanceRef.current.get();
      const thresh = thresholdRef.current;
      if (currentPull >= thresh) {
        setIsRefreshing(true);
        triggerHaptic();
        animate(pullDistanceRef.current, thresh * 0.6, { duration: 0.2 }).then(() =>
          onRefreshRef.current().then(
            () => {
              animate(pullDistanceRef.current, 0, { duration: 0.3, ease: 'easeOut' }).then(() => {
                lastPullRef.current = 0;
                setIsRefreshing(false);
              });
            },
            () => {
              lastPullRef.current = 0;
              animate(pullDistanceRef.current, 0, { duration: 0.2, ease: 'easeOut' });
              setIsRefreshing(false);
            }
          )
        );
      } else {
        lastPullRef.current = 0;
        animate(pullDistanceRef.current, 0, { duration: 0.2, ease: 'easeOut' });
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [caps.isMobile, triggerHaptic]);

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
    <div ref={containerRef} className="relative">
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
