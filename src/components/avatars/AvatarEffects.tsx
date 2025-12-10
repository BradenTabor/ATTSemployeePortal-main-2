import { memo } from 'react';
import type { MotionValue } from 'framer-motion';

/**
 * Avatar effects components - DISABLED FOR PERFORMANCE
 * All components return null to avoid animation overhead
 * Kept as shells for API compatibility
 */

interface AvatarGlowProps {
  isExcited: boolean;
  isHovered: boolean;
  isExpanded: boolean;
  isCelebrating: boolean;
  glowIntensity: number;
  smoothLightX: MotionValue<number>;
  smoothLightY: MotionValue<number>;
  themeColor?: string;
}

export const AvatarGlow = memo(function AvatarGlow(_: AvatarGlowProps) {
  void _; // Satisfy TypeScript - props kept for API compatibility
  return null;
});

interface AvatarRimLightingProps {
  isHovered: boolean;
  isExpanded: boolean;
  smoothLightX: MotionValue<number>;
  themeColor?: string;
}

export const AvatarRimLighting = memo(function AvatarRimLighting(_: AvatarRimLightingProps) {
  void _; // Satisfy TypeScript - props kept for API compatibility
  return null;
});

interface AvatarParticlesProps {
  isExpanded: boolean;
  isExcited: boolean;
  shouldAnimate: boolean;
  themeColor?: string;
}

export const AvatarParticles = memo(function AvatarParticles(_: AvatarParticlesProps) {
  void _; // Satisfy TypeScript - props kept for API compatibility
  return null;
});

interface AvatarCelebrationBurstProps {
  isCelebrating: boolean;
  themeColor?: string;
}

export const AvatarCelebrationBurst = memo(function AvatarCelebrationBurst(_: AvatarCelebrationBurstProps) {
  void _; // Satisfy TypeScript - props kept for API compatibility
  return null;
});

export default AvatarGlow;
