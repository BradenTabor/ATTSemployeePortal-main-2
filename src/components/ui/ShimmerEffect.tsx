import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

export interface ShimmerEffectProps {
  className?: string;
  /** Border shimmer color */
  borderColor?: string;
  /** Surface shimmer colors */
  surfaceColors?: [string, string];
  /** Animation duration in seconds */
  duration?: number;
  /** Enable border shimmer */
  borderShimmer?: boolean;
  /** Enable surface shimmer */
  surfaceShimmer?: boolean;
  children: React.ReactNode;
}

// Singleton pattern to inject global styles only once
let shimmerStylesInjected = false;

function injectShimmerStyles() {
  if (shimmerStylesInjected || typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    @property --shimmer-angle {
      syntax: '<angle>';
      initial-value: 0deg;
      inherits: false;
    }

    @keyframes shimmer-rotate {
      0% { --shimmer-angle: 0deg; }
      100% { --shimmer-angle: 360deg; }
    }

    @keyframes shimmer-sweep {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
  shimmerStylesInjected = true;
}

export function ShimmerEffect({
  className,
  borderColor = 'rgba(52, 211, 153, 0.6)',
  surfaceColors = ['rgba(16, 185, 129, 0.08)', 'rgba(52, 211, 153, 0.15)'],
  duration = 3,
  borderShimmer = true,
  surfaceShimmer = true,
  children,
}: ShimmerEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Inject global styles once
  useEffect(() => {
    injectShimmerStyles();
  }, []);

  return (
    <div ref={containerRef} className={cn('relative group', className)}>
      {/* Border shimmer effect - only animates on hover */}
      {borderShimmer && (
        <div
          className="absolute -inset-[1px] rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500 will-change-transform"
          style={{
            background: `conic-gradient(from var(--shimmer-angle, 0deg) at 50% 50%, transparent 0%, ${borderColor} 10%, transparent 20%)`,
            animation: `shimmer-rotate ${duration}s linear infinite paused`,
            animationPlayState: 'paused',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.animationPlayState = 'running';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.animationPlayState = 'paused';
          }}
        />
      )}

      {/* Surface shimmer effect - only animates on hover */}
      {surfaceShimmer && (
        <div
          className="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none z-[1] will-change-transform"
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{
              background: `linear-gradient(
                110deg,
                transparent 20%,
                ${surfaceColors[0]} 40%,
                ${surfaceColors[1]} 50%,
                ${surfaceColors[0]} 60%,
                transparent 80%
              )`,
              backgroundSize: '200% 100%',
              animation: `shimmer-sweep ${duration * 1.5}s ease-in-out infinite paused`,
              animationPlayState: 'paused',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.animationPlayState = 'running';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.animationPlayState = 'paused';
            }}
          />
        </div>
      )}

      {/* Ambient glow on hover - optimized with will-change */}
      <div
        className="absolute -inset-1 rounded-[inherit] opacity-0 group-hover:opacity-40 blur-xl transition-opacity duration-700 will-change-transform"
        style={{
          background: `radial-gradient(ellipse at center, ${borderColor}, transparent 70%)`,
        }}
      />

      {/* Content container */}
      <div className="relative">{children}</div>
    </div>
  );
}

export default ShimmerEffect;

