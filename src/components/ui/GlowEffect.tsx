import { useRef } from 'react';
import { cn } from '../../lib/utils';

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
  scale?: number;
  duration?: number;
};

/**
 * GlowEffect component - STATIC MODE FOR PERFORMANCE
 * All animation modes now render as static gradients
 * to reduce JavaScript execution and animation overhead.
 */
export function GlowEffect({
  className,
  style,
  colors = ['#FF5733', '#33FF57', '#3357FF', '#F1C40F'],
  blur = 'medium',
  scale = 1,
}: GlowEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const getBlurClass = (blurValue: GlowEffectProps['blur']) => {
    if (typeof blurValue === 'number') {
      return `blur-[${blurValue}px]`;
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
    return presets[blurValue as keyof typeof presets];
  };

  // Static gradient - no animations
  const staticBackground = `linear-gradient(to right, ${colors.join(', ')})`;

  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        '--scale': scale,
        background: staticBackground,
      } as React.CSSProperties}
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        'scale-[var(--scale)] transform-gpu',
        getBlurClass(blur),
        className
      )}
    />
  );
}
