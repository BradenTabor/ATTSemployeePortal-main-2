import { useState, useEffect } from 'react';
import type { InteractionState } from '../types';

interface UseAvatarInteractionOptions {
  /** Reference to the container element */
  containerRef: React.RefObject<HTMLElement>;
}

// Custom hook for intersection observer (kept for visibility tracking)
function useIntersectionObserver(
  ref: React.RefObject<HTMLElement>, 
  options?: IntersectionObserverInit
): boolean {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, options]);

  return isVisible;
}

// Static value helper for motion value API compatibility
const staticValue = (val: number) => ({
  get: () => val,
  set: () => {},
});

interface UseAvatarInteractionReturn extends InteractionState {
  rotateX: ReturnType<typeof staticValue>;
  rotateY: ReturnType<typeof staticValue>;
  layer1X: ReturnType<typeof staticValue>;
  layer1Y: ReturnType<typeof staticValue>;
  layer2X: ReturnType<typeof staticValue>;
  layer2Y: ReturnType<typeof staticValue>;
  layer3X: ReturnType<typeof staticValue>;
  layer3Y: ReturnType<typeof staticValue>;
  smoothLightX: ReturnType<typeof staticValue>;
  smoothLightY: ReturnType<typeof staticValue>;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseLeave: () => void;
}

/**
 * Static avatar interaction hook - animations disabled for performance
 * Returns static default values, no parallax or mouse tracking
 */
export function useAvatarInteraction({
  containerRef,
}: UseAvatarInteractionOptions): UseAvatarInteractionReturn {
  // Visibility tracking kept for potential future use
  const isVisible = useIntersectionObserver(containerRef);

  // Return static values - no parallax/tracking
  return {
    mouseX: 0,
    mouseY: 0,
    lightX: 0,
    lightY: 0,
    isVisible,
    shouldAnimate: false, // Always false - animations disabled
    rotateX: staticValue(0),
    rotateY: staticValue(0),
    layer1X: staticValue(0),
    layer1Y: staticValue(0),
    layer2X: staticValue(0),
    layer2Y: staticValue(0),
    layer3X: staticValue(0),
    layer3Y: staticValue(0),
    smoothLightX: staticValue(0),
    smoothLightY: staticValue(0),
    handleMouseMove: () => {}, // No-op
    handleMouseLeave: () => {}, // No-op
  };
}

export { useIntersectionObserver };
export default useAvatarInteraction;
