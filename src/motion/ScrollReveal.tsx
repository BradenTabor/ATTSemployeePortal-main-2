import { ReactNode, memo } from 'react';
import { motion, useInView, useReducedMotion, Variants } from 'framer-motion';
import { useRef } from 'react';
import {
  scrollFadeUp,
  scrollFadeIn,
  scrollScaleIn,
  scrollSlideLeft,
  scrollSlideRight,
  scrollStaggerContainer,
  scrollStaggerItem,
  reducedMotionFade,
} from './presets';

// =============================================================================
// SCROLL REVEAL VARIANT TYPES
// =============================================================================

export type ScrollRevealVariant =
  | 'fadeUp'
  | 'fadeIn'
  | 'scaleIn'
  | 'slideLeft'
  | 'slideRight'
  | 'stagger';

const variantMap: Record<ScrollRevealVariant, Variants> = {
  fadeUp: scrollFadeUp,
  fadeIn: scrollFadeIn,
  scaleIn: scrollScaleIn,
  slideLeft: scrollSlideLeft,
  slideRight: scrollSlideRight,
  stagger: scrollStaggerContainer,
};

// =============================================================================
// SCROLL REVEAL COMPONENT
// =============================================================================

export interface ScrollRevealProps {
  /** Content to animate */
  children: ReactNode;
  
  /** Animation variant to use */
  variant?: ScrollRevealVariant;
  
  /** Custom animation variants (overrides variant prop) */
  customVariants?: Variants;
  
  /** Delay before animation starts (in seconds) */
  delay?: number;
  
  /** Percentage of element that must be visible to trigger (0-1) */
  threshold?: number;
  
  /** Margin around viewport for trigger detection */
  margin?: string;
  
  /** Whether animation should trigger only once */
  once?: boolean;
  
  /** Additional className for the wrapper */
  className?: string;
  
  /** Wrapper element tag */
  as?: 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'main' | 'span';
}

/**
 * ScrollReveal - Premium scroll-triggered animation wrapper
 * 
 * Animates children when they scroll into view with elegant reveal effects.
 * Respects reduced motion preferences automatically.
 * 
 * @example
 * ```tsx
 * <ScrollReveal variant="fadeUp" delay={0.1}>
 *   <Card>Content that fades up when scrolled into view</Card>
 * </ScrollReveal>
 * ```
 */
export const ScrollReveal = memo(function ScrollReveal({
  children,
  variant = 'fadeUp',
  customVariants,
  delay = 0,
  threshold = 0.15,
  margin = '0px 0px -50px 0px',
  once = true,
  className = '',
  as = 'div',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  
  const isInView = useInView(ref, {
    amount: threshold,
    margin: margin as `${number}px ${number}px ${number}px ${number}px`,
    once,
  });

  // Use reduced motion variant if user prefers
  const shouldReduceMotion = prefersReducedMotion ?? false;
  const variants = shouldReduceMotion 
    ? reducedMotionFade 
    : (customVariants || variantMap[variant]);

  // Add delay to the visible transition if specified
  const animateVariants: Variants = delay > 0 && !shouldReduceMotion
    ? {
        ...variants,
        visible: {
          ...variants.visible,
          transition: {
            ...(typeof variants.visible === 'object' && 'transition' in variants.visible 
              ? variants.visible.transition 
              : {}),
            delay,
          },
        },
      }
    : variants;

  const MotionComponent = motion[as] as typeof motion.div;

  return (
    <MotionComponent
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={animateVariants}
    >
      {children}
    </MotionComponent>
  );
});

// =============================================================================
// SCROLL REVEAL ITEM - For use inside staggered containers
// =============================================================================

export interface ScrollRevealItemProps {
  /** Content to animate */
  children: ReactNode;
  
  /** Additional className */
  className?: string;
  
  /** Wrapper element tag */
  as?: 'div' | 'li' | 'article' | 'section' | 'span';
}

/**
 * ScrollRevealItem - Child component for staggered scroll reveals
 * 
 * Use inside a ScrollReveal with variant="stagger" for sequential animations.
 * 
 * @example
 * ```tsx
 * <ScrollReveal variant="stagger">
 *   <ScrollRevealItem><Card>First</Card></ScrollRevealItem>
 *   <ScrollRevealItem><Card>Second</Card></ScrollRevealItem>
 * </ScrollReveal>
 * ```
 */
export const ScrollRevealItem = memo(function ScrollRevealItem({
  children,
  className = '',
  as = 'div',
}: ScrollRevealItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = prefersReducedMotion ?? false;
  
  const variants = shouldReduceMotion ? reducedMotionFade : scrollStaggerItem;
  const MotionComponent = motion[as] as typeof motion.div;

  return (
    <MotionComponent className={className} variants={variants}>
      {children}
    </MotionComponent>
  );
});

// =============================================================================
// SCROLL REVEAL GROUP - Wrapper for coordinated reveals
// =============================================================================

export interface ScrollRevealGroupProps {
  /** Items to reveal in sequence */
  children: ReactNode;
  
  /** Base delay before first item animates */
  baseDelay?: number;
  
  /** Delay between each item */
  staggerDelay?: number;
  
  /** Threshold for triggering animation */
  threshold?: number;
  
  /** Whether animations trigger only once */
  once?: boolean;
  
  /** Additional className */
  className?: string;
}

/**
 * ScrollRevealGroup - Coordinates multiple ScrollReveal children
 * 
 * Provides staggered timing across multiple independent reveal elements.
 * 
 * @example
 * ```tsx
 * <ScrollRevealGroup staggerDelay={0.1}>
 *   <ScrollReveal><Card>First</Card></ScrollReveal>
 *   <ScrollReveal><Card>Second</Card></ScrollReveal>
 * </ScrollRevealGroup>
 * ```
 */
export const ScrollRevealGroup = memo(function ScrollRevealGroup({
  children,
  baseDelay = 0,
  staggerDelay = 0.08,
  threshold = 0.15,
  once = true,
  className = '',
}: ScrollRevealGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  
  const isInView = useInView(ref, {
    amount: threshold,
    once,
  });

  const shouldReduceMotion = prefersReducedMotion ?? false;
  
  const containerVariants: Variants = shouldReduceMotion
    ? reducedMotionFade
    : {
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: baseDelay,
          },
        },
      };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={containerVariants}
    >
      {children}
    </motion.div>
  );
});

