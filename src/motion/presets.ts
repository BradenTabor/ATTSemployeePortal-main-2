import type { Variants, Transition } from 'framer-motion';

// =============================================================================
// CANOPY MOTION — things unfurl, they don't fade.
//
// Principles
//   • Long, soft exponential ease-outs (0.16, 1, 0.3, 1) for reveals
//   • Springs with visible but restrained overshoot for interaction
//   • Blur + clipPath + rotateX for "organic" entrances
//   • Every export name from the previous system is preserved
// =============================================================================

/** Signature exponential ease-out */
export const EASE_CANOPY: [number, number, number, number] = [0.16, 1, 0.3, 1];
/** Exponential ease-in for exits */
export const EASE_CANOPY_IN: [number, number, number, number] = [0.7, 0, 0.84, 0];

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

/** Snappy spring for interactive elements */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 34,
  mass: 0.7,
};

/** Smooth spring for larger movements */
export const springSmooth: Transition = {
  type: 'spring',
  stiffness: 170,
  damping: 22,
  mass: 0.9,
};

/** Gentle spring for subtle animations */
export const springGentle: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 18,
  mass: 1,
};

/** Quick tween for simple fades */
export const tweenQuick: Transition = {
  type: 'tween',
  duration: 0.22,
  ease: EASE_CANOPY,
};

/** Medium tween for standard animations */
export const tweenMedium: Transition = {
  type: 'tween',
  duration: 0.55,
  ease: EASE_CANOPY,
};

/** Slow tween for dramatic reveals */
export const tweenSlow: Transition = {
  type: 'tween',
  duration: 0.9,
  ease: EASE_CANOPY,
};

/** Instant transition for reduced motion */
export const instant: Transition = {
  duration: 0.01,
};

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: tweenMedium },
  exit: { opacity: 0, transition: tweenQuick },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { ...tweenMedium, duration: 0.7 },
  },
  exit: { opacity: 0, y: -10, filter: 'blur(4px)', transition: tweenQuick },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -24, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: tweenMedium },
  exit: { opacity: 0, y: 10, transition: tweenQuick },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: springSnappy },
  exit: { opacity: 0, scale: 0.96, transition: tweenQuick },
};

export const scaleInBounce: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 320, damping: 18 },
  },
  exit: { opacity: 0, scale: 0.9, transition: tweenQuick },
};

/**
 * Route change: soft dissolve. Compositor-only properties (opacity/transform);
 * a full-page `filter: blur` drops frames on mid-tier phones.
 */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.992 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.42, ease: EASE_CANOPY },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.996,
    transition: { duration: 0.18, ease: EASE_CANOPY_IN },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.08 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: tweenMedium },
  exit: { opacity: 0, transition: tweenQuick },
};

// =============================================================================
// CANOPY SIGNATURE VARIANTS
// =============================================================================

/** A slab unfurling from its top edge like a leaf opening */
export const unfurl: Variants = {
  hidden: {
    opacity: 0,
    y: 22,
    rotateX: 10,
    clipPath: 'inset(0 0 100% 0 round 28px 8px)',
    transformPerspective: 1200,
  },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    clipPath: 'inset(0 0 0% 0 round 28px 8px)',
    transformPerspective: 1200,
    transition: { duration: 0.9, ease: EASE_CANOPY },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: tweenQuick,
  },
};

/** Container that unfurls children in a cascading wave */
export const unfurlContainer: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.12 },
  },
  exit: { opacity: 0, transition: { staggerChildren: 0.02, staggerDirection: -1 } },
};

/** Text rising through a blur, per line / per word */
export const riseThroughBlur: Variants = {
  hidden: { opacity: 0, y: '0.6em', filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    y: '0em',
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE_CANOPY },
  },
};

/** Hairline that draws itself */
export const drawLine: Variants = {
  hidden: { scaleX: 0, originX: 0 },
  visible: { scaleX: 1, originX: 0, transition: { duration: 1.1, ease: EASE_CANOPY } },
};

// =============================================================================
// EXPAND/COLLAPSE VARIANTS
// =============================================================================

export const expandCollapse: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.28, ease: EASE_CANOPY },
      opacity: { duration: 0.12 },
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.38, ease: EASE_CANOPY },
      opacity: { duration: 0.3, delay: 0.06 },
    },
  },
};

export const expandCollapseReduced: Variants = {
  collapsed: { opacity: 0, transition: { duration: 0.1 } },
  expanded: { opacity: 1, transition: { duration: 0.1 } },
};

// =============================================================================
// REDUCED MOTION VARIANTS
// =============================================================================

export const reducedMotionFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: instant },
  exit: { opacity: 0, transition: instant },
};

// =============================================================================
// SCROLL REVEAL VARIANTS
// =============================================================================

export const scrollFadeUp: Variants = {
  hidden: { opacity: 0, y: 48, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.9, ease: EASE_CANOPY },
  },
};

export const scrollFadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: EASE_CANOPY } },
};

export const scrollScaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 120, damping: 20 },
  },
};

export const scrollSlideLeft: Variants = {
  hidden: { opacity: 0, x: -56 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } },
};

export const scrollSlideRight: Variants = {
  hidden: { opacity: 0, x: 56 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } },
};

export const scrollStaggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

export const scrollStaggerItem: Variants = {
  hidden: { opacity: 0, y: 32, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease: EASE_CANOPY },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getVariant(
  fullVariant: Variants,
  shouldReduceMotion: boolean,
  reducedVariant: Variants = reducedMotionFade
): Variants {
  return shouldReduceMotion ? reducedVariant : fullVariant;
}

export function getTransition(fullTransition: Transition, shouldReduceMotion: boolean): Transition {
  return shouldReduceMotion ? instant : fullTransition;
}

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
  const { reducedVariants, initial = 'hidden', animate = 'visible', exit = 'exit' } = options || {};

  return {
    variants: shouldReduceMotion ? reducedVariants || reducedMotionFade : variants,
    initial,
    animate,
    exit,
  };
}

// =============================================================================
// CSS GRID EXPAND STYLES
// =============================================================================

export function getGridExpandStyles(isOpen: boolean, shouldAnimate: boolean): React.CSSProperties {
  if (!shouldAnimate) {
    return { display: isOpen ? 'block' : 'none' };
  }

  return {
    display: 'grid',
    gridTemplateRows: isOpen ? '1fr' : '0fr',
    transition: 'grid-template-rows 420ms cubic-bezier(0.16, 1, 0.3, 1)',
  };
}

export function getGridContentStyles(isOpen: boolean, shouldAnimate: boolean): React.CSSProperties {
  if (!shouldAnimate) {
    return {};
  }

  return {
    opacity: isOpen ? 1 : 0,
    transition: 'opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)',
  };
}
