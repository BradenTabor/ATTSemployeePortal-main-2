import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence, type MotionValue } from 'framer-motion';
import type { Particle } from './types';
import { AVATAR_COLORS } from './constants';

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

export const AvatarGlow = memo(function AvatarGlow({
  isExcited,
  isHovered,
  isExpanded,
  isCelebrating,
  glowIntensity,
  smoothLightX,
  smoothLightY,
  themeColor,
}: AvatarGlowProps) {
  const colors = themeColor ? { glow: themeColor, light: themeColor, base: themeColor } : AVATAR_COLORS.emerald;

  return (
    <>
      {/* Multi-layer ambient glow with dynamic positioning */}
      <motion.div
        className="absolute inset-[-35%] rounded-full blur-3xl pointer-events-none"
        animate={{
          opacity: (isExcited ? 0.7 : isHovered ? 0.55 : 0.45) * glowIntensity,
          scale: isCelebrating ? [1, 1.3, 1] : isExcited ? 1.15 : isExpanded ? 1.08 : 1,
        }}
        transition={{ duration: isCelebrating ? 0.5 : 0.3 }}
        style={{
          background: `radial-gradient(circle at ${50 + smoothLightX.get() * 15}% ${50 + smoothLightY.get() * 15}%, ${colors.glow}60 0%, ${colors.base}35 35%, transparent 70%)`,
        }}
      />
      <motion.div
        className="absolute inset-[-20%] rounded-full blur-xl pointer-events-none"
        animate={{
          opacity: (isExcited ? 0.55 : isExpanded ? 0.45 : 0.35) * glowIntensity,
          scale: isExcited ? [1, 1.2, 1] : 1,
        }}
        transition={{
          duration: isExcited ? 0.4 : 0.3,
          repeat: isExcited ? 2 : 0,
        }}
        style={{
          background: `radial-gradient(circle at ${50 - smoothLightX.get() * 10}% ${50 - smoothLightY.get() * 10}%, ${colors.light}50 0%, transparent 55%)`,
        }}
      />
    </>
  );
});

interface AvatarRimLightingProps {
  isHovered: boolean;
  isExpanded: boolean;
  smoothLightX: MotionValue<number>;
  themeColor?: string;
}

export const AvatarRimLighting = memo(function AvatarRimLighting({
  isHovered,
  isExpanded,
  smoothLightX,
  themeColor,
}: AvatarRimLightingProps) {
  const colors = themeColor ? { light: themeColor, glow: themeColor } : AVATAR_COLORS.emerald;

  return (
    <motion.div
      className="absolute inset-[-5%] rounded-full pointer-events-none"
      animate={{
        opacity: isHovered ? 0.6 : isExpanded ? 0.4 : 0.25,
      }}
      style={{
        background: `conic-gradient(from ${90 + smoothLightX.get() * 45}deg at 50% 50%, transparent 0deg, ${colors.light}40 90deg, transparent 180deg, ${colors.glow}30 270deg, transparent 360deg)`,
        filter: 'blur(8px)',
      }}
    />
  );
});

interface AvatarParticlesProps {
  isExpanded: boolean;
  isExcited: boolean;
  shouldAnimate: boolean;
  themeColor?: string;
}

export const AvatarParticles = memo(function AvatarParticles({
  isExpanded,
  isExcited,
  shouldAnimate,
  themeColor,
}: AvatarParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const colors = themeColor ? { light: themeColor, glow: themeColor } : AVATAR_COLORS.emerald;

  useEffect(() => {
    if (!shouldAnimate || (!isExpanded && !isExcited)) {
      setParticles([]);
      return;
    }

    const generateParticles = () => {
      const newParticles: Particle[] = [];
      const count = isExcited ? 12 : 6;
      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: Date.now() + i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 1.5 + Math.random() * 2.5,
          duration: 2 + Math.random() * 3,
          delay: Math.random() * 2,
        });
      }
      setParticles(newParticles);
    };

    generateParticles();
    const interval = setInterval(generateParticles, 4000);
    return () => clearInterval(interval);
  }, [isExpanded, isExcited, shouldAnimate]);

  return (
    <AnimatePresence>
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute pointer-events-none"
          initial={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            opacity: 0,
            scale: 0,
          }}
          animate={{
            opacity: [0, 0.8, 0.6, 0],
            scale: [0, 1, 0.8, 0],
            y: [0, -30, -50],
            x: [0, (Math.random() - 0.5) * 20],
          }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: 'easeOut',
          }}
          style={{
            width: particle.size,
            height: particle.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.light} 0%, ${colors.glow} 50%, transparent 100%)`,
            boxShadow: `0 0 ${particle.size * 2}px ${colors.glow}`,
          }}
        />
      ))}
    </AnimatePresence>
  );
});

interface AvatarCelebrationBurstProps {
  isCelebrating: boolean;
  themeColor?: string;
}

export const AvatarCelebrationBurst = memo(function AvatarCelebrationBurst({
  isCelebrating,
  themeColor,
}: AvatarCelebrationBurstProps) {
  const colors = themeColor ? { light: themeColor, glow: themeColor } : AVATAR_COLORS.emerald;

  return (
    <AnimatePresence>
      {isCelebrating && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`burst-${i}`}
              className="absolute left-1/2 top-1/2"
              initial={{
                x: '-50%',
                y: '-50%',
                opacity: 1,
                scale: 0,
              }}
              animate={{
                x: `${-50 + Math.cos(i * Math.PI / 4) * 150}%`,
                y: `${-50 + Math.sin(i * Math.PI / 4) * 150}%`,
                opacity: [1, 0.8, 0],
                scale: [0, 1.5, 0.5],
              }}
              transition={{
                duration: 0.6,
                ease: 'easeOut',
              }}
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: colors.light,
                boxShadow: `0 0 8px ${colors.glow}`,
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default AvatarGlow;

