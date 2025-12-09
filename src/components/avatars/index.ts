// Types
export type {
  AvatarVariant,
  AvatarSize,
  AvatarInteractionProps,
  AvatarProps,
  Particle,
  GestureAnimations,
  GestureVariantSet,
  AvatarVariantConfig,
  SpringConfig,
  ColorPalette,
  AvatarAnimationState,
  InteractionState,
} from './types';

// Constants
export {
  AVATAR_COLORS,
  SPRING_CONFIGS,
  SIZE_CONFIGS,
  GESTURE_VARIANTS,
  ANNOUNCEMENTS_GESTURES,
  JOBS_GESTURES,
  TOOLS_GESTURES,
  ANIMATION_TIMING,
  DEFAULT_EFFECTS,
} from './constants';

// Hooks
export { useAvatarAnimation } from './hooks/useAvatarAnimation';
export { useAvatarInteraction, useIntersectionObserver } from './hooks/useAvatarInteraction';

// Effects components
export {
  AvatarGlow,
  AvatarRimLighting,
  AvatarParticles,
  AvatarCelebrationBurst,
} from './AvatarEffects';

// Main component
export { AvatarBase, type AvatarRenderProps } from './AvatarBase';

// Default export
export { AvatarBase as default } from './AvatarBase';

