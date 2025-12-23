import { useMemo, useRef } from 'react';
import { useReducedMotion, useInView } from 'framer-motion';
import type { Variants, Transition } from 'framer-motion';
import {
  fadeIn,
  fadeInUp,
  fadeInDown,
  scaleIn,
  scaleInBounce,
  pageTransition,
  staggerContainer,
  staggerItem,
  expandCollapse,
  expandCollapseReduced,
  reducedMotionFade,
  springSnappy,
  springSmooth,
  springGentle,
  tweenQuick,
  tweenMedium,
  tweenSlow,
  instant,
  getGridExpandStyles,
  getGridContentStyles,
  scrollFadeUp,
  scrollFadeIn,
  scrollScaleIn,
  scrollSlideLeft,
  scrollSlideRight,
} from './presets';

// =============================================================================
// MOTION CONFIG HOOK
// =============================================================================

export interface MotionConfig {
  /** Whether animations should be reduced (respects OS preference) */
  shouldReduceMotion: boolean;
  
  /** Whether to animate at all */
  shouldAnimate: boolean;
  
  /** Transition presets adjusted for reduced motion */
  transitions: {
    snappy: Transition;
    smooth: Transition;
    gentle: Transition;
    quick: Transition;
    medium: Transition;
    slow: Transition;
  };
  
  /** Variant presets adjusted for reduced motion */
  variants: {
    fadeIn: Variants;
    fadeInUp: Variants;
    fadeInDown: Variants;
    scaleIn: Variants;
    scaleInBounce: Variants;
    pageTransition: Variants;
    staggerContainer: Variants;
    staggerItem: Variants;
    expandCollapse: Variants;
  };
  
  /** Helper to get grid expand styles */
  getExpandStyles: (isOpen: boolean) => React.CSSProperties;
  
  /** Helper to get content opacity styles inside grid expand */
  getContentStyles: (isOpen: boolean) => React.CSSProperties;
}

/**
 * Hook that provides motion configuration respecting reduced motion preferences.
 * 
 * Usage:
 * ```tsx
 * const { shouldAnimate, variants, transitions } = useMotionConfig();
 * 
 * return (
 *   <motion.div
 *     variants={variants.fadeInUp}
 *     initial="hidden"
 *     animate="visible"
 *   />
 * );
 * ```
 */
export function useMotionConfig(): MotionConfig {
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = prefersReducedMotion ?? false;
  const shouldAnimate = !shouldReduceMotion;

  const config = useMemo<MotionConfig>(() => {
    // Transitions - use instant for reduced motion
    const transitions = {
      snappy: shouldReduceMotion ? instant : springSnappy,
      smooth: shouldReduceMotion ? instant : springSmooth,
      gentle: shouldReduceMotion ? instant : springGentle,
      quick: shouldReduceMotion ? instant : tweenQuick,
      medium: shouldReduceMotion ? instant : tweenMedium,
      slow: shouldReduceMotion ? instant : tweenSlow,
    };

    // Variants - use reduced variants when motion is reduced
    const variants = {
      fadeIn: shouldReduceMotion ? reducedMotionFade : fadeIn,
      fadeInUp: shouldReduceMotion ? reducedMotionFade : fadeInUp,
      fadeInDown: shouldReduceMotion ? reducedMotionFade : fadeInDown,
      scaleIn: shouldReduceMotion ? reducedMotionFade : scaleIn,
      scaleInBounce: shouldReduceMotion ? reducedMotionFade : scaleInBounce,
      pageTransition: shouldReduceMotion ? reducedMotionFade : pageTransition,
      staggerContainer: shouldReduceMotion ? reducedMotionFade : staggerContainer,
      staggerItem: shouldReduceMotion ? reducedMotionFade : staggerItem,
      expandCollapse: shouldReduceMotion ? expandCollapseReduced : expandCollapse,
    };

    // Grid expand helpers
    const getExpandStyles = (isOpen: boolean) => 
      getGridExpandStyles(isOpen, shouldAnimate);
    
    const getContentStyles = (isOpen: boolean) => 
      getGridContentStyles(isOpen, shouldAnimate);

    return {
      shouldReduceMotion,
      shouldAnimate,
      transitions,
      variants,
      getExpandStyles,
      getContentStyles,
    };
  }, [shouldReduceMotion, shouldAnimate]);

  return config;
}

// =============================================================================
// EXPAND/COLLAPSE HOOK
// =============================================================================

export interface ExpandAnimationConfig {
  /** Whether the section is expanded */
  isOpen: boolean;
  
  /** Grid container styles for height animation */
  containerStyles: React.CSSProperties;
  
  /** Content wrapper styles for opacity transition */
  contentStyles: React.CSSProperties;
  
  /** Framer Motion variants for AnimatePresence approach */
  variants: Variants;
  
  /** Whether to animate (false = instant show/hide) */
  shouldAnimate: boolean;
}

/**
 * Hook specifically for expand/collapse animations.
 * Provides both CSS Grid approach and Framer Motion variants.
 * 
 * Usage (CSS Grid approach - more performant):
 * ```tsx
 * const { containerStyles, contentStyles } = useExpandAnimation(isOpen);
 * 
 * return (
 *   <div style={containerStyles}>
 *     <div className="overflow-hidden" style={contentStyles}>
 *       {children}
 *     </div>
 *   </div>
 * );
 * ```
 * 
 * Usage (AnimatePresence approach):
 * ```tsx
 * const { variants, shouldAnimate } = useExpandAnimation(isOpen);
 * 
 * return (
 *   <AnimatePresence>
 *     {isOpen && (
 *       <motion.div variants={variants} initial="collapsed" animate="expanded" exit="collapsed">
 *         {children}
 *       </motion.div>
 *     )}
 *   </AnimatePresence>
 * );
 * ```
 */
export function useExpandAnimation(isOpen: boolean): ExpandAnimationConfig {
  const { shouldAnimate, getExpandStyles, getContentStyles, variants } = useMotionConfig();

  return useMemo(() => ({
    isOpen,
    containerStyles: getExpandStyles(isOpen),
    contentStyles: getContentStyles(isOpen),
    variants: variants.expandCollapse,
    shouldAnimate,
  }), [isOpen, shouldAnimate, getExpandStyles, getContentStyles, variants.expandCollapse]);
}

// =============================================================================
// STAGGER ANIMATION HOOK
// =============================================================================

export interface StaggerConfig {
  /** Container variants with stagger timing */
  containerVariants: Variants;
  
  /** Item variants for children */
  itemVariants: Variants;
  
  /** Whether to animate */
  shouldAnimate: boolean;
}

/**
 * Hook for staggered list animations.
 * 
 * Usage:
 * ```tsx
 * const { containerVariants, itemVariants } = useStaggerAnimation();
 * 
 * return (
 *   <motion.ul variants={containerVariants} initial="hidden" animate="visible">
 *     {items.map(item => (
 *       <motion.li key={item.id} variants={itemVariants}>
 *         {item.content}
 *       </motion.li>
 *     ))}
 *   </motion.ul>
 * );
 * ```
 */
export function useStaggerAnimation(): StaggerConfig {
  const { shouldAnimate, variants } = useMotionConfig();

  return useMemo(() => ({
    containerVariants: variants.staggerContainer,
    itemVariants: variants.staggerItem,
    shouldAnimate,
  }), [shouldAnimate, variants.staggerContainer, variants.staggerItem]);
}

// =============================================================================
// HOVER ANIMATION HOOK
// =============================================================================

/**
 * Returns hover props that respect reduced motion.
 * 
 * Usage:
 * ```tsx
 * const hoverProps = useHoverAnimation({ scale: 1.05, y: -4 });
 * 
 * return <motion.div {...hoverProps}>Hover me</motion.div>;
 * ```
 */
export function useHoverAnimation(
  hoverState: { scale?: number; y?: number; x?: number }
): { whileHover?: { scale?: number; y?: number; x?: number } } {
  const prefersReducedMotion = useReducedMotion();

  return useMemo(() => {
    if (prefersReducedMotion) {
      return {};
    }
    return { whileHover: hoverState };
  }, [prefersReducedMotion, hoverState]);
}

// =============================================================================
// TAP ANIMATION HOOK
// =============================================================================

/**
 * Returns tap/press props that respect reduced motion.
 * 
 * Usage:
 * ```tsx
 * const tapProps = useTapAnimation({ scale: 0.95 });
 * 
 * return <motion.button {...tapProps}>Press me</motion.button>;
 * ```
 */
export function useTapAnimation(
  tapState: { scale?: number }
): { whileTap?: { scale?: number } } {
  const prefersReducedMotion = useReducedMotion();

  return useMemo(() => {
    if (prefersReducedMotion) {
      return {};
    }
    return { whileTap: tapState };
  }, [prefersReducedMotion, tapState]);
}

// =============================================================================
// SCROLL REVEAL HOOK
// =============================================================================

export type ScrollRevealVariantType = 'fadeUp' | 'fadeIn' | 'scaleIn' | 'slideLeft' | 'slideRight';

const scrollVariantMap: Record<ScrollRevealVariantType, Variants> = {
  fadeUp: scrollFadeUp,
  fadeIn: scrollFadeIn,
  scaleIn: scrollScaleIn,
  slideLeft: scrollSlideLeft,
  slideRight: scrollSlideRight,
};

export interface ScrollRevealConfig {
  /** Ref to attach to the element */
  ref: React.RefObject<HTMLDivElement>;
  
  /** Whether the element is currently in view */
  isInView: boolean;
  
  /** Animation variants to use */
  variants: Variants;
  
  /** Initial animation state */
  initial: string;
  
  /** Current animation state based on visibility */
  animate: string;
  
  /** Whether reduced motion is preferred */
  shouldReduceMotion: boolean;
}

export interface UseScrollRevealOptions {
  /** Animation variant to use */
  variant?: ScrollRevealVariantType;
  
  /** Custom variants (overrides variant prop) */
  customVariants?: Variants;
  
  /** Percentage of element visible to trigger (0-1) */
  threshold?: number;
  
  /** Margin around viewport */
  margin?: string;
  
  /** Only trigger animation once */
  once?: boolean;
  
  /** Delay before animation (seconds) */
  delay?: number;
}

/**
 * Hook for custom scroll-triggered reveal animations.
 * 
 * Usage:
 * ```tsx
 * const { ref, variants, initial, animate } = useScrollReveal({ variant: 'fadeUp' });
 * 
 * return (
 *   <motion.div ref={ref} variants={variants} initial={initial} animate={animate}>
 *     Content reveals on scroll
 *   </motion.div>
 * );
 * ```
 */
export function useScrollReveal(options: UseScrollRevealOptions = {}): ScrollRevealConfig {
  const {
    variant = 'fadeUp',
    customVariants,
    threshold = 0.15,
    margin = '0px 0px -50px 0px',
    once = true,
    delay = 0,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = prefersReducedMotion ?? false;

  const isInView = useInView(ref, {
    amount: threshold,
    margin,
    once,
  });

  const config = useMemo<ScrollRevealConfig>(() => {
    // Get base variants
    const baseVariants = shouldReduceMotion
      ? reducedMotionFade
      : (customVariants || scrollVariantMap[variant]);

    // Apply delay if specified
    const variants: Variants = delay > 0 && !shouldReduceMotion
      ? {
          ...baseVariants,
          visible: {
            ...baseVariants.visible,
            transition: {
              ...(typeof baseVariants.visible === 'object' && 'transition' in baseVariants.visible
                ? baseVariants.visible.transition
                : {}),
              delay,
            },
          },
        }
      : baseVariants;

    return {
      ref,
      isInView,
      variants,
      initial: 'hidden',
      animate: isInView ? 'visible' : 'hidden',
      shouldReduceMotion,
    };
  }, [variant, customVariants, delay, isInView, shouldReduceMotion]);

  return { ...config, ref };
}

