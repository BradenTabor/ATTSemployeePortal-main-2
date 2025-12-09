import { useState, useEffect, useMemo } from 'react';
import { useAnimationControls } from 'framer-motion';
import type { AvatarAnimationState, GestureVariantSet, AvatarInteractionProps } from '../types';
import { GESTURE_VARIANTS, ANIMATION_TIMING } from '../constants';

interface UseAvatarAnimationOptions extends AvatarInteractionProps {
  variant: string;
  shouldAnimate: boolean;
  enableIdleFidgets?: boolean;
}

interface UseAvatarAnimationReturn extends AvatarAnimationState {
  bodyControls: ReturnType<typeof useAnimationControls>;
  headControls: ReturnType<typeof useAnimationControls>;
  rightArmControls: ReturnType<typeof useAnimationControls>;
  leftArmControls: ReturnType<typeof useAnimationControls>;
  gestures: GestureVariantSet;
}

export function useAvatarAnimation({
  variant,
  isExpanded = false,
  isHovered = false,
  wasJustToggled = false,
  toggleDirection = null,
  shouldAnimate,
  enableIdleFidgets = true,
}: UseAvatarAnimationOptions): UseAvatarAnimationReturn {
  // Animation controllers for gesture sequences
  const bodyControls = useAnimationControls();
  const headControls = useAnimationControls();
  const rightArmControls = useAnimationControls();
  const leftArmControls = useAnimationControls();

  // Animation states
  const [isBlinking, setIsBlinking] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isExcited, setIsExcited] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [isFidgeting, setIsFidgeting] = useState(false);
  const [fidgetType, setFidgetType] = useState<'look' | 'shift' | 'tool' | null>(null);
  const [idleTime, setIdleTime] = useState(0);

  // Get gesture variants for this variant type
  const gestures = useMemo(() => 
    GESTURE_VARIANTS[variant] || GESTURE_VARIANTS.announcements,
    [variant]
  );

  // Memoized intensity calculations
  const smileIntensity = useMemo(() => 
    isExcited ? 1.3 : isHovered ? 1.1 : isExpanded ? 1.05 : 1,
    [isExcited, isHovered, isExpanded]
  );

  const glowIntensity = useMemo(() => 
    isExcited ? 1.5 : isExpanded ? 1.2 : 1,
    [isExcited, isExpanded]
  );

  const cheekSquish = useMemo(() => 
    smileIntensity > 1.1 ? (smileIntensity - 1) * 2 : 0,
    [smileIntensity]
  );

  const eyebrowRaise = useMemo(() => 
    isExcited ? 2 : isHovered ? 0.8 : 0,
    [isExcited, isHovered]
  );

  // Handle gesture animations when toggled
  useEffect(() => {
    if (wasJustToggled && toggleDirection && shouldAnimate) {
      const gestureType = toggleDirection === 'expand' ? 'expand' : 'collapse';
      const gesture = gestures[gestureType];

      if (toggleDirection === 'expand') {
        setIsExcited(true);
        setIsCelebrating(true);
        setTimeout(() => {
          setIsExcited(false);
          setIsCelebrating(false);
        }, ANIMATION_TIMING.celebrationDuration);
      }

      const animationConfig = {
        duration: toggleDirection === 'expand' ? 0.7 : 0.5,
        ease: [0.34, 1.56, 0.64, 1] as const,
      };

      bodyControls.start({ ...gesture.body, transition: animationConfig });
      headControls.start({ ...gesture.head, transition: { ...animationConfig, delay: 0.05 } });
      rightArmControls.start({ ...gesture.rightArm, transition: { ...animationConfig, delay: 0.1 } });
      leftArmControls.start({ ...gesture.leftArm, transition: { ...animationConfig, delay: 0.08 } });
    }
  }, [wasJustToggled, toggleDirection, gestures, bodyControls, headControls, rightArmControls, leftArmControls, shouldAnimate]);

  // Handle hover state animations
  useEffect(() => {
    if (!wasJustToggled && shouldAnimate) {
      const gesture = isHovered ? gestures.hover : gestures.idle;
      const config = { duration: 0.3, ease: 'easeOut' as const };

      bodyControls.start({ ...gesture.body, transition: config });
      headControls.start({ ...gesture.head, transition: config });
      rightArmControls.start({ ...gesture.rightArm, transition: config });
      leftArmControls.start({ ...gesture.leftArm, transition: config });
    }
  }, [isHovered, wasJustToggled, gestures, bodyControls, headControls, rightArmControls, leftArmControls, shouldAnimate]);

  // Random blink effect
  useEffect(() => {
    if (!shouldAnimate) return;

    const blinkInterval = setInterval(() => {
      const blinkChance = isExcited ? 0.5 : 0.7;
      if (Math.random() > blinkChance) {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), ANIMATION_TIMING.blinkDuration);
      }
    }, isExcited ? ANIMATION_TIMING.blinkIntervalExcited : ANIMATION_TIMING.blinkIntervalNormal);

    return () => clearInterval(blinkInterval);
  }, [isExcited, shouldAnimate]);

  // Eye movement with fidget support
  useEffect(() => {
    if (!shouldAnimate) return;

    if (isHovered) {
      setEyeOffset({ x: 0.3, y: -0.2 });
    } else if (isExcited) {
      const moveInterval = setInterval(() => {
        setEyeOffset({
          x: (Math.random() - 0.5) * 1.5,
          y: (Math.random() - 0.5) * 0.8,
        });
      }, 300);
      return () => clearInterval(moveInterval);
    } else if (isFidgeting && fidgetType === 'look') {
      const lookSequence = [
        { x: -1.5, y: 0 },
        { x: -1.5, y: -0.5 },
        { x: 0, y: -0.8 },
        { x: 1.5, y: -0.3 },
        { x: 1.5, y: 0 },
        { x: 0, y: 0 },
      ];
      let step = 0;
      const lookInterval = setInterval(() => {
        setEyeOffset(lookSequence[step]);
        step = (step + 1) % lookSequence.length;
      }, 300);
      return () => clearInterval(lookInterval);
    } else {
      const moveInterval = setInterval(() => {
        setEyeOffset({
          x: (Math.random() - 0.5) * 1,
          y: (Math.random() - 0.5) * 0.5,
        });
      }, ANIMATION_TIMING.eyeMovementInterval);
      return () => clearInterval(moveInterval);
    }
  }, [isHovered, isExcited, isFidgeting, fidgetType, shouldAnimate]);

  // Idle fidget system
  useEffect(() => {
    if (!enableIdleFidgets || isHovered || wasJustToggled || isExcited || !shouldAnimate) {
      setIdleTime(0);
      setIsFidgeting(false);
      return;
    }

    const idleTimer = setInterval(() => {
      setIdleTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(idleTimer);
  }, [isHovered, wasJustToggled, isExcited, shouldAnimate, enableIdleFidgets]);

  // Trigger fidgets
  useEffect(() => {
    if (idleTime > 5 && !isFidgeting && Math.random() > 0.7 && enableIdleFidgets) {
      const fidgetTypes: Array<'look' | 'shift' | 'tool'> = ['look', 'shift', 'tool'];
      const randomFidget = fidgetTypes[Math.floor(Math.random() * fidgetTypes.length)];
      setFidgetType(randomFidget);
      setIsFidgeting(true);

      const resetTimer = setTimeout(() => {
        setIsFidgeting(false);
        setFidgetType(null);
        setIdleTime(0);
      }, 2000);

      return () => clearTimeout(resetTimer);
    }
  }, [idleTime, isFidgeting, enableIdleFidgets]);

  return {
    isBlinking,
    eyeOffset,
    isExcited,
    isCelebrating,
    isFidgeting,
    fidgetType,
    smileIntensity,
    glowIntensity,
    cheekSquish,
    eyebrowRaise,
    bodyControls,
    headControls,
    rightArmControls,
    leftArmControls,
    gestures,
  };
}

export default useAvatarAnimation;

