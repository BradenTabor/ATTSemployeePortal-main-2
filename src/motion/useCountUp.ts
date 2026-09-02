/**
 * useCountUp — animate a number from 0 to a target on mount.
 *
 * Reduced-motion safe: when the user prefers reduced motion (or animation is
 * disabled / duration is 0 / target is null), the target value is returned
 * directly during render with no animation and no effect-driven setState.
 * When animating, state is updated only inside the requestAnimationFrame
 * callback (never synchronously in the effect body) using an ease-out curve.
 * Pair the rendered number with `tabular-nums` so digit width stays stable and
 * the count-up causes zero layout shift.
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface UseCountUpOptions {
  /** Animation duration in milliseconds (default 900). */
  durationMs?: number;
  /** Set false to skip animation and show the target immediately. */
  enabled?: boolean;
}

export function useCountUp(
  target: number | null,
  options: UseCountUpOptions = {}
): number {
  const { durationMs = 900, enabled = true } = options;
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate =
    enabled && !prefersReducedMotion && durationMs > 0 && target != null;

  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldAnimate || target == null) return;

    let start: number | null = null;
    const tick = (timestamp: number) => {
      if (start == null) start = timestamp;
      const progress = Math.min(1, (timestamp - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, shouldAnimate, durationMs]);

  return shouldAnimate ? value : target ?? 0;
}
