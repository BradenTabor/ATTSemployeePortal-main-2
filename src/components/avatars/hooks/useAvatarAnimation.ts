import { useMemo } from 'react';
import type { AvatarAnimationState, GestureVariantSet, AvatarInteractionProps } from '../types';
import { GESTURE_VARIANTS } from '../constants';

interface UseAvatarAnimationOptions extends AvatarInteractionProps {
  variant: string;
  shouldAnimate: boolean;
  enableIdleFidgets?: boolean;
}

// No-op animation controls to prevent runtime errors
const noOpControls = {
  start: () => Promise.resolve(),
  stop: () => {},
  set: () => {},
};

interface UseAvatarAnimationReturn extends AvatarAnimationState {
  bodyControls: typeof noOpControls;
  headControls: typeof noOpControls;
  rightArmControls: typeof noOpControls;
  leftArmControls: typeof noOpControls;
  gestures: GestureVariantSet;
}

/**
 * Static avatar animation hook - animations disabled for performance
 * Returns static default values for all animation states
 */
export function useAvatarAnimation({
  variant,
}: UseAvatarAnimationOptions): UseAvatarAnimationReturn {
  // Get gesture variants for this variant type (kept for API compatibility)
  const gestures = useMemo(() => 
    GESTURE_VARIANTS[variant] || GESTURE_VARIANTS.announcements,
    [variant]
  );

  // Return static values - no animations
  return {
    isBlinking: false,
    eyeOffset: { x: 0, y: 0 },
    isExcited: false,
    isCelebrating: false,
    isFidgeting: false,
    fidgetType: null,
    smileIntensity: 1,
    glowIntensity: 1,
    cheekSquish: 0,
    eyebrowRaise: 0,
    bodyControls: noOpControls,
    headControls: noOpControls,
    rightArmControls: noOpControls,
    leftArmControls: noOpControls,
    gestures,
  };
}

export default useAvatarAnimation;
