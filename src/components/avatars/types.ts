import type { Variants } from 'framer-motion';

// Base avatar variant type - extensible for new variants
export type AvatarVariant = 'announcements' | 'jobs' | 'tools' | string;

// Size presets for responsive avatars
export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

// Props passed from parent components for interaction state
export interface AvatarInteractionProps {
  /** Whether the parent section is currently expanded */
  isExpanded?: boolean;
  /** Whether the parent section header is being hovered */
  isHovered?: boolean;
  /** Triggers when section was just toggled - resets after animation */
  wasJustToggled?: boolean;
  /** Direction of the last toggle: 'expand' or 'collapse' */
  toggleDirection?: 'expand' | 'collapse' | null;
}

// Main avatar component props
export interface AvatarProps extends AvatarInteractionProps {
  /** Avatar variant type - determines which character/props to render */
  variant: AvatarVariant;
  /** Additional CSS classes */
  className?: string;
  /** Size preset */
  size?: AvatarSize;
  /** Enable particle effects */
  showParticles?: boolean;
  /** Enable glow effects */
  showGlow?: boolean;
  /** Enable dynamic rim lighting */
  showRimLighting?: boolean;
  /** Enable idle fidget animations */
  enableIdleFidgets?: boolean;
  /** Custom theme color override */
  themeColor?: string;
}

// Particle configuration
export interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

// Gesture animation structure for body parts
export interface GestureAnimations {
  body: Record<string, unknown>;
  head: Record<string, unknown>;
  rightArm: Record<string, unknown>;
  leftArm: Record<string, unknown>;
}

// Complete gesture variant set
export interface GestureVariantSet {
  idle: Variants;
  expand: Variants;
  collapse: Variants;
  hover: Variants;
}

// Avatar variant configuration
export interface AvatarVariantConfig {
  /** Unique identifier for the variant */
  id: string;
  /** Display name */
  name: string;
  /** Gesture animations for this variant */
  gestures: GestureVariantSet;
  /** Tool-specific effects (chainsaw vibration, sound waves, etc.) */
  toolEffects?: {
    type: 'vibration' | 'waves' | 'sparkles' | 'rotation';
    intensity?: number;
  };
  /** Custom accessories or props for this variant */
  hasVisor?: boolean;
  hasSafetyGlasses?: boolean;
}

// Spring configuration for animations
export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

// Color palette structure
export interface ColorPalette {
  emerald: {
    light: string;
    base: string;
    dark: string;
    darker: string;
    glow: string;
  };
  safety: {
    orange: string;
    orangeLight: string;
    orangeDark: string;
    orangeDeep: string;
    yellow: string;
    yellowLight: string;
    yellowBright: string;
  };
  forest: {
    light: string;
    base: string;
    dark: string;
  };
  skin: {
    highlight: string;
    base: string;
    shadow: string;
    deep: string;
    sssWarm: string;
    sssRed: string;
    sssPink: string;
  };
  metal: {
    light: string;
    base: string;
    dark: string;
    darker: string;
    highlight: string;
    reflection: string;
  };
  plastic: {
    highlight: string;
    base: string;
    shine: string;
  };
  fabric: {
    vestGreen: string;
    vestGreenDark: string;
    shirtTan: string;
    shirtTanDark: string;
    shirtTanLight: string;
  };
  leather: {
    light: string;
    base: string;
    dark: string;
  };
}

// Animation state returned by hooks
export interface AvatarAnimationState {
  isBlinking: boolean;
  eyeOffset: { x: number; y: number };
  isExcited: boolean;
  isCelebrating: boolean;
  isFidgeting: boolean;
  fidgetType: 'look' | 'shift' | 'tool' | null;
  smileIntensity: number;
  glowIntensity: number;
  cheekSquish: number;
  eyebrowRaise: number;
}

// Interaction state from mouse/touch
export interface InteractionState {
  mouseX: number;
  mouseY: number;
  lightX: number;
  lightY: number;
  isVisible: boolean;
  shouldAnimate: boolean;
}

