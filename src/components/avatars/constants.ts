import type { ColorPalette, SpringConfig, GestureVariantSet, AvatarSize } from './types';

// ATTS Brand Color Palette - Enhanced with SSS and material-specific colors
export const AVATAR_COLORS: ColorPalette = {
  // Primary emerald theme
  emerald: {
    light: '#8DF5A8',
    base: '#3DDC84',
    dark: '#2FA45A',
    darker: '#1F7A44',
    glow: '#5EE898',
  },
  // Safety colors
  safety: {
    orange: '#9BEB5B',
    orangeLight: '#B8FF7A',
    orangeDark: '#7CC43F',
    orangeDeep: '#5E9A2C',
    yellow: '#D2FFA3',
    yellowLight: '#E4FFC2',
    yellowBright: '#DDFF85',
  },
  // Forest/Nature
  forest: {
    light: '#2FA45A',
    base: '#1F7A44',
    dark: '#12482A',
  },
  // Skin tones with SSS undertones
  skin: {
    highlight: '#ECFFAE',
    base: '#E4FFC2',
    shadow: '#AEDB3F',
    deep: '#8A9A8E',
    // SSS colors - warm blood/translucency undertones
    sssWarm: '#ffb8a8',
    sssRed: '#e8a090',
    sssPink: '#f0c8c0',
  },
  // Materials - Enhanced
  metal: {
    light: '#E4EAE1',
    base: '#8A9A8E',
    dark: '#5A6B60',
    darker: '#2F3F36',
    highlight: '#ffffff',
    reflection: '#F4FBF7',
  },
  plastic: {
    highlight: '#F4F7F2',
    base: '#F4F7F2',
    shine: '#ffffff',
  },
  fabric: {
    vestGreen: '#2FA45A',
    vestGreenDark: '#1F7A44',
    shirtTan: '#DDFF85',
    shirtTanDark: '#8A9A8E',
    shirtTanLight: '#ECFFAE',
  },
  // Leather for boots/gloves
  leather: {
    light: '#6B8A1F',
    base: '#4A6116',
    dark: '#1E2A23',
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

