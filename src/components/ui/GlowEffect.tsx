import { useRef, useState, useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { motion, Transition, useReducedMotion } from 'framer-motion';

export type GlowEffectProps = {
  className?: string;
  style?: React.CSSProperties;
  colors?: string[];
  mode?:
    | 'rotate'
    | 'pulse'
    | 'breathe'
    | 'colorShift'
    | 'flowHorizontal'
    | 'static';
  blur?:
    | number
    | 'softest'
    | 'soft'
    | 'medium'
    | 'strong'
    | 'stronger'
    | 'strongest'
    | 'none';
  transition?: Transition;
  scale?: number;
  duration?: number;
};

// Custom hook for intersection observer
function useIsVisible(ref: React.RefObject<HTMLElement | null>, options?: IntersectionObserverInit) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1, ...options }
    );
    
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, options]);
  
  return isVisible;
}

export function GlowEffect({
  className,
  style,
  colors = ['#FF5733', '#33FF57', '#3357FF', '#F1C40F'],
  mode = 'rotate',
  blur = 'medium',
  transition,
  scale = 1,
  duration = 5,
}: GlowEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useIsVisible(containerRef);
  const prefersReducedMotion = useReducedMotion();
  
  // Disable animations if user prefers reduced motion or element is not visible
  const shouldAnimate = isVisible && !prefersReducedMotion;
  
  // Use static mode if reduced motion is preferred
  const effectiveMode = prefersReducedMotion ? 'static' : mode;

  const BASE_TRANSITION = useMemo(() => ({
    repeat: Infinity,
    duration: duration,
    ease: 'linear',
  }), [duration]);

  const animations = useMemo(() => ({
    rotate: {
      background: [
        `conic-gradient(from 0deg at 50% 50%, ${colors.join(', ')})`,
        `conic-gradient(from 360deg at 50% 50%, ${colors.join(', ')})`,
      ],
      transition: {
        ...(transition ?? BASE_TRANSITION),
      },
    },
    pulse: {
      background: colors.map(
        (color) =>
          `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
      ),
      scale: [1 * scale, 1.1 * scale, 1 * scale],
      opacity: [0.5, 0.8, 0.5],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror' as const,
        }),
      },
    },
    breathe: {
      background: [
        ...colors.map(
          (color) =>
            `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
        ),
      ],
      scale: [1 * scale, 1.05 * scale, 1 * scale],
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror' as const,
        }),
      },
    },
    colorShift: {
      background: colors.map((color, index) => {
        const nextColor = colors[(index + 1) % colors.length];
        return `conic-gradient(from 0deg at 50% 50%, ${color} 0%, ${nextColor} 50%, ${color} 100%)`;
      }),
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror' as const,
        }),
      },
    },
    flowHorizontal: {
      background: colors.map((color) => {
        const nextColor = colors[(colors.indexOf(color) + 1) % colors.length];
        return `linear-gradient(to right, ${color}, ${nextColor})`;
      }),
      transition: {
        ...(transition ?? {
          ...BASE_TRANSITION,
          repeatType: 'mirror' as const,
        }),
      },
    },
    static: {
      background: `linear-gradient(to right, ${colors.join(', ')})`,
    },
  }), [colors, scale, transition, BASE_TRANSITION]);

  const getBlurClass = (blur: GlowEffectProps['blur']) => {
    if (typeof blur === 'number') {
      return `blur-[${blur}px]`;
    }
    const presets = {
      softest: 'blur-xs',
      soft: 'blur-sm',
      medium: 'blur-md',
      strong: 'blur-lg',
      stronger: 'blur-xl',
      strongest: 'blur-2xl',
      none: 'blur-none',
    };
    return presets[blur as keyof typeof presets];
  };

  return (
    <motion.div
      ref={containerRef}
      style={
        {
          ...style,
          '--scale': scale,
          // Only set willChange when visible and animating to reduce compositor layer overhead
          willChange: shouldAnimate ? 'transform, background' : 'auto',
          backfaceVisibility: 'hidden',
        } as React.CSSProperties
      }
      // Only animate when visible and motion is allowed
      animate={shouldAnimate ? animations[effectiveMode] : animations.static}
      // When not visible, show the first color as static background
      initial={
        effectiveMode !== 'static'
          ? { background: `linear-gradient(to right, ${colors.join(', ')})` }
          : undefined
      }
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        'scale-[var(--scale)] transform-gpu',
        getBlurClass(blur),
        className
      )}
    />
  );
}
