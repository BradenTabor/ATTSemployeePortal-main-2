import { memo, useRef, useMemo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { AvatarProps } from './types';
import { AVATAR_COLORS, SPRING_CONFIGS, SIZE_CONFIGS, DEFAULT_EFFECTS } from './constants';
import { useAvatarAnimation } from './hooks/useAvatarAnimation';
import { useAvatarInteraction } from './hooks/useAvatarInteraction';
import { AvatarGlow, AvatarRimLighting, AvatarParticles, AvatarCelebrationBurst } from './AvatarEffects';

interface AvatarBaseProps extends AvatarProps {
  /** Render function for variant-specific SVG content */
  children: (props: AvatarRenderProps) => ReactNode;
}

// Props passed to variant render function
export interface AvatarRenderProps {
  id: string;
  colors: typeof AVATAR_COLORS;
  // Animation state
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
  // Animation controls
  bodyControls: ReturnType<typeof useAvatarAnimation>['bodyControls'];
  headControls: ReturnType<typeof useAvatarAnimation>['headControls'];
  rightArmControls: ReturnType<typeof useAvatarAnimation>['rightArmControls'];
  leftArmControls: ReturnType<typeof useAvatarAnimation>['leftArmControls'];
  // Interaction state
  shouldAnimate: boolean;
  smoothLightX: ReturnType<typeof useAvatarInteraction>['smoothLightX'];
  smoothLightY: ReturnType<typeof useAvatarInteraction>['smoothLightY'];
  // Layer transforms for parallax
  layer1X: ReturnType<typeof useAvatarInteraction>['layer1X'];
  layer1Y: ReturnType<typeof useAvatarInteraction>['layer1Y'];
  layer2X: ReturnType<typeof useAvatarInteraction>['layer2X'];
  layer2Y: ReturnType<typeof useAvatarInteraction>['layer2Y'];
  layer3X: ReturnType<typeof useAvatarInteraction>['layer3X'];
  layer3Y: ReturnType<typeof useAvatarInteraction>['layer3Y'];
  // Props pass-through
  isExpanded: boolean;
  isHovered: boolean;
  variant: string;
}

function AvatarBaseComponent({
  variant,
  className = '',
  size = 'md',
  isExpanded = false,
  isHovered = false,
  wasJustToggled = false,
  toggleDirection = null,
  showParticles = DEFAULT_EFFECTS.showParticles,
  showGlow = DEFAULT_EFFECTS.showGlow,
  showRimLighting = DEFAULT_EFFECTS.showRimLighting,
  enableIdleFidgets = DEFAULT_EFFECTS.enableIdleFidgets,
  themeColor,
  children,
}: AvatarBaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = `avatar-${variant}`;

  // Get size configuration
  const sizeConfig = SIZE_CONFIGS[size];

  // Interaction handling (parallax, lighting, visibility)
  const interaction = useAvatarInteraction({
    containerRef: containerRef as React.RefObject<HTMLElement>,
  });

  // Animation state and controls
  const animation = useAvatarAnimation({
    variant,
    isExpanded,
    isHovered,
    wasJustToggled,
    toggleDirection,
    shouldAnimate: interaction.shouldAnimate,
    enableIdleFidgets,
  });

  // Memoized render props
  const renderProps = useMemo<AvatarRenderProps>(() => ({
    id,
    colors: AVATAR_COLORS,
    isBlinking: animation.isBlinking,
    eyeOffset: animation.eyeOffset,
    isExcited: animation.isExcited,
    isCelebrating: animation.isCelebrating,
    isFidgeting: animation.isFidgeting,
    fidgetType: animation.fidgetType,
    smileIntensity: animation.smileIntensity,
    glowIntensity: animation.glowIntensity,
    cheekSquish: animation.cheekSquish,
    eyebrowRaise: animation.eyebrowRaise,
    bodyControls: animation.bodyControls,
    headControls: animation.headControls,
    rightArmControls: animation.rightArmControls,
    leftArmControls: animation.leftArmControls,
    shouldAnimate: interaction.shouldAnimate,
    smoothLightX: interaction.smoothLightX,
    smoothLightY: interaction.smoothLightY,
    layer1X: interaction.layer1X,
    layer1Y: interaction.layer1Y,
    layer2X: interaction.layer2X,
    layer2Y: interaction.layer2Y,
    layer3X: interaction.layer3X,
    layer3Y: interaction.layer3Y,
    isExpanded,
    isHovered,
    variant,
  }), [
    id, animation, interaction, isExpanded, isHovered, variant,
  ]);

  return (
    <motion.div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseMove={interaction.handleMouseMove}
      onMouseLeave={interaction.handleMouseLeave}
      style={{
        width: sizeConfig.width,
        height: sizeConfig.height,
        perspective: 800,
        transformStyle: 'preserve-3d',
        willChange: interaction.shouldAnimate ? 'transform, opacity' : 'auto',
        contain: 'layout style paint',
      }}
      animate={interaction.shouldAnimate ? animation.bodyControls : undefined}
      transition={{ type: 'spring', ...SPRING_CONFIGS.bouncy }}
    >
      {/* Glow effects */}
      {showGlow && (
        <AvatarGlow
          isExcited={animation.isExcited}
          isHovered={isHovered}
          isExpanded={isExpanded}
          isCelebrating={animation.isCelebrating}
          glowIntensity={animation.glowIntensity}
          smoothLightX={interaction.smoothLightX}
          smoothLightY={interaction.smoothLightY}
          themeColor={themeColor}
        />
      )}

      {/* Rim lighting */}
      {showRimLighting && (
        <AvatarRimLighting
          isHovered={isHovered}
          isExpanded={isExpanded}
          smoothLightX={interaction.smoothLightX}
          themeColor={themeColor}
        />
      )}

      {/* Floating particles */}
      {showParticles && (
        <AvatarParticles
          isExpanded={isExpanded}
          isExcited={animation.isExcited}
          shouldAnimate={interaction.shouldAnimate}
          themeColor={themeColor}
        />
      )}

      {/* Celebration burst */}
      <AvatarCelebrationBurst
        isCelebrating={animation.isCelebrating}
        themeColor={themeColor}
      />

      {/* Avatar content with parallax */}
      <motion.div
        style={{
          rotateX: interaction.rotateX,
          rotateY: interaction.rotateY,
          transformStyle: 'preserve-3d',
        }}
        className="w-full h-full"
      >
        {children(renderProps)}
      </motion.div>
    </motion.div>
  );
}

export const AvatarBase = memo(AvatarBaseComponent);
export default AvatarBase;

