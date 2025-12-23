// =============================================================================
// MOTION SYSTEM - Centralized animation presets and hooks
// =============================================================================

// Presets - Transitions and Variants
export {
  // Transitions
  springSnappy,
  springSmooth,
  springGentle,
  tweenQuick,
  tweenMedium,
  tweenSlow,
  instant,
  
  // Variants
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
  
  // Scroll Reveal Variants
  scrollFadeUp,
  scrollFadeIn,
  scrollScaleIn,
  scrollSlideLeft,
  scrollSlideRight,
  scrollStaggerContainer,
  scrollStaggerItem,
  
  // Helper functions
  getVariant,
  getTransition,
  createMotionProps,
  getGridExpandStyles,
  getGridContentStyles,
} from './presets';

// Hooks
export {
  useMotionConfig,
  useExpandAnimation,
  useStaggerAnimation,
  useHoverAnimation,
  useTapAnimation,
  useScrollReveal,
} from './hooks';

// Types
export type {
  MotionConfig,
  ExpandAnimationConfig,
  StaggerConfig,
  ScrollRevealConfig,
  UseScrollRevealOptions,
  ScrollRevealVariantType,
} from './hooks';

// Components
export { PageWrapper } from './PageWrapper';

// Scroll Reveal Components
export {
  ScrollReveal,
  ScrollRevealItem,
  ScrollRevealGroup,
} from './ScrollReveal';

export type {
  ScrollRevealProps,
  ScrollRevealItemProps,
  ScrollRevealGroupProps,
  ScrollRevealVariant,
} from './ScrollReveal';

