import { useState, useEffect, useCallback } from 'react';
import { useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import type { InteractionState } from '../types';
import { SPRING_CONFIGS } from '../constants';

interface UseAvatarInteractionOptions {
  /** Reference to the container element */
  containerRef: React.RefObject<HTMLElement>;
}

interface UseAvatarInteractionReturn extends InteractionState {
  // Motion values for parallax
  rotateX: ReturnType<typeof useSpring>;
  rotateY: ReturnType<typeof useSpring>;
  layer1X: ReturnType<typeof useSpring>;
  layer1Y: ReturnType<typeof useSpring>;
  layer2X: ReturnType<typeof useSpring>;
  layer2Y: ReturnType<typeof useSpring>;
  layer3X: ReturnType<typeof useSpring>;
  layer3Y: ReturnType<typeof useSpring>;
  smoothLightX: ReturnType<typeof useSpring>;
  smoothLightY: ReturnType<typeof useSpring>;
  // Event handlers
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseLeave: () => void;
}

// Custom hook for intersection observer
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

export function useAvatarInteraction({
  containerRef,
}: UseAvatarInteractionOptions): UseAvatarInteractionReturn {
  // Accessibility
  const prefersReducedMotion = useReducedMotion();
  const isVisible = useIntersectionObserver(containerRef);
  const shouldAnimate = isVisible && !prefersReducedMotion;

  // Mouse position for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Dynamic lighting position
  const lightX = useMotionValue(0);
  const lightY = useMotionValue(0);

  // Smooth spring values for parallax
  const parallaxSpring = SPRING_CONFIGS.gentle;
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [8, -8]), parallaxSpring);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-8, 8]), parallaxSpring);

  // Layer parallax transforms (different depths)
  const layer1X = useSpring(useTransform(mouseX, [-0.5, 0.5], [-2, 2]), parallaxSpring);
  const layer1Y = useSpring(useTransform(mouseY, [-0.5, 0.5], [-2, 2]), parallaxSpring);
  const layer2X = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), parallaxSpring);
  const layer2Y = useSpring(useTransform(mouseY, [-0.5, 0.5], [-4, 4]), parallaxSpring);
  const layer3X = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), parallaxSpring);
  const layer3Y = useSpring(useTransform(mouseY, [-0.5, 0.5], [-6, 6]), parallaxSpring);

  // Smooth lighting
  const smoothLightX = useSpring(lightX, { stiffness: 100, damping: 20 });
  const smoothLightY = useSpring(lightY, { stiffness: 100, damping: 20 });

  // Handle mouse move for parallax and dynamic lighting
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !shouldAnimate) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
    lightX.set(x * 2);
    lightY.set(y * 2);
  }, [containerRef, mouseX, mouseY, lightX, lightY, shouldAnimate]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
    lightX.set(0);
    lightY.set(0);
  }, [mouseX, mouseY, lightX, lightY]);

  return {
    mouseX: mouseX.get(),
    mouseY: mouseY.get(),
    lightX: lightX.get(),
    lightY: lightY.get(),
    isVisible,
    shouldAnimate,
    rotateX,
    rotateY,
    layer1X,
    layer1Y,
    layer2X,
    layer2Y,
    layer3X,
    layer3Y,
    smoothLightX,
    smoothLightY,
    handleMouseMove,
    handleMouseLeave,
  };
}

export { useIntersectionObserver };
export default useAvatarInteraction;

