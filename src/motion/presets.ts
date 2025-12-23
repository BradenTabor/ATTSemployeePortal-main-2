import type { Variants, Transition } from 'framer-motion';

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

/** Snappy spring for interactive elements */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

/** Smooth spring for larger movements */
export const springSmooth: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
  mass: 0.8,
};

/** Gentle spring for subtle animations */
export const springGentle: Transition = {
  type: 'spring',
  stiffness: 150,
  damping: 20,
};

/** Quick tween for simple fades */
export const tweenQuick: Transition = {
  type: 'tween',
  duration: 0.2,
  ease: 'easeOut',
};

/** Medium tween for standard animations */
export const tweenMedium: Transition = {
  type: 'tween',
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1], // ease-out-cubic
};

/** Slow tween for dramatic reveals */
export const tweenSlow: Transition = {
  type: 'tween',
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1],
};

/** Instant transition for reduced motion */
export const instant: Transition = {
  duration: 0.01,
};

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

/** Fade in from transparent */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: tweenMedium,
  },
  exit: { 
    opacity: 0,
    transition: tweenQuick,
  },
};

/** Fade in with upward movement */
export const fadeInUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      ...tweenMedium,
      duration: 0.4,
    },
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: tweenQuick,
  },
};

/** Fade in with downward movement */
export const fadeInDown: Variants = {
  hidden: { 
    opacity: 0, 
    y: -20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: tweenMedium,
  },
  exit: { 
    opacity: 0, 
    y: 10,
    transition: tweenQuick,
  },
};

/** Scale in from smaller size */
export const scaleIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.9,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: springSnappy,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: tweenQuick,
  },
};

/** Scale in with bounce effect */
export const scaleInBounce: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    transition: tweenQuick,
  },
};

/** Page transition variant for route changes - optimized for speed */
export const pageTransition: Variants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: {
      duration: 0.15,
      ease: 'easeOut',
    },
  },
  exit: { 
    opacity: 0,
    transition: {
      duration: 0.1,
      ease: 'easeIn',
    },
  },
};

/** Stagger container for orchestrating child animations */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

/** Stagger item for use inside staggerContainer */
export const staggerItem: Variants = {
  hidden: { 
    opacity: 0, 
    y: 10,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: tweenMedium,
  },
  exit: { 
    opacity: 0,
    transition: tweenQuick,
  },
};

// =============================================================================
// EXPAND/COLLAPSE VARIANTS
// =============================================================================

/** Standard expand animation using height: auto */
export const expandCollapse: Variants = {
  collapsed: { 
    height: 0, 
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.1 },
    },
  },
  expanded: { 
    height: 'auto', 
    opacity: 1,
    transition: {
      height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.2, delay: 0.05 },
    },
  },
};

/** Reduced motion expand - instant with subtle opacity */
export const expandCollapseReduced: Variants = {
  collapsed: { 
    opacity: 0,
    transition: { duration: 0.1 },
  },
  expanded: { 
    opacity: 1,
    transition: { duration: 0.1 },
  },
};

// =============================================================================
// REDUCED MOTION VARIANTS
// =============================================================================

/** Minimal fade for reduced motion preference */
export const reducedMotionFade: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: instant,
  },
  exit: { 
    opacity: 0,
    transition: instant,
  },
};

// =============================================================================
// SCROLL REVEAL VARIANTS
// =============================================================================

/** Scroll-triggered fade up - elegant upward reveal */
export const scrollFadeUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 40,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      mass: 0.8,
    },
  },
};

/** Scroll-triggered simple fade */
export const scrollFadeIn: Variants = {
  hidden: { 
    opacity: 0,
  },
  visible: { 
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

/** Scroll-triggered scale entrance */
export const scrollScaleIn: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.92,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 18,
    },
  },
};

/** Scroll-triggered slide from left */
export const scrollSlideLeft: Variants = {
  hidden: { 
    opacity: 0, 
    x: -50,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
    },
  },
};

/** Scroll-triggered slide from right */
export const scrollSlideRight: Variants = {
  hidden: { 
    opacity: 0, 
    x: 50,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
    },
  },
};

/** Scroll-triggered stagger container for lists */
export const scrollStaggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

/** Scroll-triggered stagger item */
export const scrollStaggerItem: Variants = {
  hidden: { 
    opacity: 0, 
    y: 30,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 18,
    },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Returns the appropriate variant based on reduced motion preference.
 * @param fullVariant - The full animation variant
 * @param reducedVariant - Optional simplified variant for reduced motion (defaults to reducedMotionFade)
 * @param shouldReduceMotion - Whether reduced motion is preferred
 */
export function getVariant(
  fullVariant: Variants,
  shouldReduceMotion: boolean,
  reducedVariant: Variants = reducedMotionFade
): Variants {
  return shouldReduceMotion ? reducedVariant : fullVariant;
}

/**
 * Returns the appropriate transition based on reduced motion preference.
 * @param fullTransition - The full animation transition
 * @param shouldReduceMotion - Whether reduced motion is preferred
 */
export function getTransition(
  fullTransition: Transition,
  shouldReduceMotion: boolean
): Transition {
  return shouldReduceMotion ? instant : fullTransition;
}

/**
 * Creates motion props that respect reduced motion preference.
 * Returns empty object if reduced motion is preferred and no reduced variant is provided.
 */
export function createMotionProps(
  variants: Variants,
  shouldReduceMotion: boolean,
  options?: {
    reducedVariants?: Variants;
    initial?: string;
    animate?: string;
    exit?: string;
  }
) {
  const { 
    reducedVariants, 
    initial = 'hidden', 
    animate = 'visible', 
    exit = 'exit' 
  } = options || {};

  return {
    variants: shouldReduceMotion ? (reducedVariants || reducedMotionFade) : variants,
    initial,
    animate,
    exit,
  };
}

// =============================================================================
// CSS GRID EXPAND STYLES (For performant height animations)
// =============================================================================

/**
 * Returns CSS styles for grid-based height animation.
 * This is more performant than JavaScript-measured height animations.
 * 
 * Usage:
 * <div style={getGridExpandStyles(isOpen, shouldAnimate)}>
 *   <div className="overflow-hidden">content</div>
 * </div>
 */
export function getGridExpandStyles(
  isOpen: boolean,
  shouldAnimate: boolean
): React.CSSProperties {
  if (!shouldAnimate) {
    return {
      display: isOpen ? 'block' : 'none',
    };
  }
  
  return {
    display: 'grid',
    gridTemplateRows: isOpen ? '1fr' : '0fr',
    transition: 'grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  };
}

/**
 * Returns opacity transition styles for content inside grid expand.
 */
export function getGridContentStyles(
  isOpen: boolean,
  shouldAnimate: boolean
): React.CSSProperties {
  if (!shouldAnimate) {
    return {};
  }
  
  return {
    opacity: isOpen ? 1 : 0,
    transition: 'opacity 200ms ease-out',
  };
}

