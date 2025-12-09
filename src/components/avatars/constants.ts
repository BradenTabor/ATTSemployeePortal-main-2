import type { ColorPalette, SpringConfig, GestureVariantSet, AvatarSize } from './types';

// ATTS Brand Color Palette - Enhanced with SSS and material-specific colors
export const AVATAR_COLORS: ColorPalette = {
  // Primary emerald theme
  emerald: {
    light: '#6ee7b7',
    base: '#10b981',
    dark: '#059669',
    darker: '#047857',
    glow: '#34d399',
  },
  // Safety colors
  safety: {
    orange: '#f97316',
    orangeLight: '#fb923c',
    orangeDark: '#ea580c',
    orangeDeep: '#c2410c',
    yellow: '#facc15',
    yellowLight: '#fde047',
    yellowBright: '#fef08a',
  },
  // Forest/Nature
  forest: {
    light: '#22c55e',
    base: '#166534',
    dark: '#14532d',
  },
  // Skin tones with SSS undertones
  skin: {
    highlight: '#fcd9bd',
    base: '#e8b896',
    shadow: '#c99a6b',
    deep: '#a67c52',
    // SSS colors - warm blood/translucency undertones
    sssWarm: '#ffb8a8',
    sssRed: '#e8a090',
    sssPink: '#f0c8c0',
  },
  // Materials - Enhanced
  metal: {
    light: '#e5e7eb',
    base: '#9ca3af',
    dark: '#6b7280',
    darker: '#4b5563',
    highlight: '#ffffff',
    reflection: '#f8fafc',
  },
  plastic: {
    highlight: '#fefefe',
    base: '#f3f4f6',
    shine: '#ffffff',
  },
  fabric: {
    vestGreen: '#16a34a',
    vestGreenDark: '#15803d',
    shirtTan: '#d6c4a8',
    shirtTanDark: '#b8a88c',
    shirtTanLight: '#e8dcc8',
  },
  // Leather for boots/gloves
  leather: {
    light: '#92400e',
    base: '#78350f',
    dark: '#451a03',
  },
};

// Spring configurations for different animation types
export const SPRING_CONFIGS: Record<string, SpringConfig> = {
  // Snappy for quick reactions
  snappy: { stiffness: 400, damping: 25, mass: 0.5 },
  // Bouncy for playful gestures
  bouncy: { stiffness: 300, damping: 15, mass: 0.8 },
  // Gentle for subtle movements
  gentle: { stiffness: 150, damping: 20, mass: 1 },
  // Smooth for continuous animations
  smooth: { stiffness: 100, damping: 15, mass: 0.5 },
};

// Size configurations
export const SIZE_CONFIGS: Record<AvatarSize, { width: string; height: string }> = {
  sm: { width: '2rem', height: '2.5rem' },
  md: { width: '2.5rem', height: '3rem' },
  lg: { width: '3rem', height: '3.75rem' },
  xl: { width: '4rem', height: '5rem' },
};

// Default gesture variants for announcements
export const ANNOUNCEMENTS_GESTURES: GestureVariantSet = {
  idle: {
    body: { rotate: 0, y: 0, scale: 1 },
    head: { rotate: 0, y: 0 },
    rightArm: { rotate: 0, y: 0 },
    leftArm: { rotate: 0 },
  },
  expand: {
    body: { rotate: [0, -2, 2, 0], y: [0, -3, -1, 0], scale: [1, 1.02, 1] },
    head: { rotate: [0, 5, -3, 0], y: [0, -2, 0] },
    rightArm: { rotate: [0, 15, 25, 15, 0], y: [0, -5, -8, -5, 0] },
    leftArm: { rotate: [0, -5, 0] },
  },
  collapse: {
    body: { rotate: [0, 2, 0], y: [0, 1, 0], scale: [1, 0.98, 1] },
    head: { rotate: [0, -5, 0], y: [0, 2, 0] },
    rightArm: { rotate: [0, 10, 0], y: [0, -3, 0] },
    leftArm: { rotate: 0 },
  },
  hover: {
    body: { rotate: -2, y: -1, scale: 1.01 },
    head: { rotate: 3, y: -1 },
    rightArm: { rotate: 5, y: -2 },
    leftArm: { rotate: -3 },
  },
};

// Default gesture variants for jobs
export const JOBS_GESTURES: GestureVariantSet = {
  idle: {
    body: { rotate: 0, y: 0, scale: 1 },
    head: { rotate: 0, y: 0 },
    rightArm: { rotate: 0, y: 0 },
    leftArm: { rotate: 0 },
  },
  expand: {
    body: { rotate: [0, -1, 1, 0], y: [0, -2, 0], scale: [1, 1.01, 1] },
    head: { rotate: [0, -8, 0, 5, 0], y: [0, -1, 2, 0] },
    rightArm: { rotate: [0, -5, 0], y: [0, 2, 0] },
    leftArm: { rotate: [0, 5, 0] },
  },
  collapse: {
    body: { rotate: [0, 1, 0], y: [0, 1, 0], scale: 1 },
    head: { rotate: [0, 10, 5, 0], y: [0, -3, -1, 0] },
    rightArm: { rotate: 0 },
    leftArm: { rotate: [0, -3, 0] },
  },
  hover: {
    body: { rotate: 1, y: 0, scale: 1.005 },
    head: { rotate: -2, y: 0 },
    rightArm: { rotate: -3, y: 1 },
    leftArm: { rotate: 2 },
  },
};

// Default gesture variants for tools
export const TOOLS_GESTURES: GestureVariantSet = {
  idle: {
    body: { rotate: 0, y: 0, scale: 1 },
    head: { rotate: 0, y: 0 },
    rightArm: { rotate: 0, y: 0 },
    leftArm: { rotate: 0 },
  },
  expand: {
    body: { rotate: [0, -2, 1, 0], y: [0, -2, -1, 0], scale: [1, 1.02, 1] },
    head: { rotate: [0, 3, -2, 0], y: [0, -1, 0] },
    rightArm: { rotate: [0, -20, -35, -20, 0], y: [0, -3, -6, -3, 0] },
    leftArm: { rotate: [0, 5, 0] },
  },
  collapse: {
    body: { rotate: [0, 1, 0], y: [0, 1, 0], scale: 1 },
    head: { rotate: [0, 8, 4, 0], y: [0, -2, 0] },
    rightArm: { rotate: [0, -10, 0], y: [0, -2, 0] },
    leftArm: { rotate: 0 },
  },
  hover: {
    body: { rotate: -1, y: -1, scale: 1.01 },
    head: { rotate: 2, y: -1 },
    rightArm: { rotate: -5, y: -1 },
    leftArm: { rotate: 3 },
  },
};

// Map of all gesture variants by variant type
export const GESTURE_VARIANTS: Record<string, GestureVariantSet> = {
  announcements: ANNOUNCEMENTS_GESTURES,
  jobs: JOBS_GESTURES,
  tools: TOOLS_GESTURES,
};

// Animation timing constants
export const ANIMATION_TIMING = {
  blinkDuration: 150,
  blinkIntervalNormal: 2000,
  blinkIntervalExcited: 1000,
  eyeMovementInterval: 3000,
  fidgetThreshold: 5000,
  celebrationDuration: 800,
  particleInterval: 4000,
  idleFidgetChance: 0.3,
};

// Default effect settings
export const DEFAULT_EFFECTS = {
  showParticles: true,
  showGlow: true,
  showRimLighting: true,
  enableIdleFidgets: true,
};

