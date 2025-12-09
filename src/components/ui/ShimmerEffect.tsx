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

export function ShimmerEffect({
  className,
  borderColor = 'rgba(52, 211, 153, 0.6)',
  surfaceColors = ['rgba(16, 185, 129, 0.08)', 'rgba(52, 211, 153, 0.15)'],
  duration = 3,
  borderShimmer = true,
  surfaceShimmer = true,
  children,
}: ShimmerEffectProps) {
  return (
    <div className={cn('relative group', className)}>
      {/* Border shimmer effect - light traveling around the edge */}
      {borderShimmer && (
        <div
          className="absolute -inset-[1px] rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `conic-gradient(from var(--shimmer-angle, 0deg) at 50% 50%, transparent 0%, ${borderColor} 10%, transparent 20%)`,
            animation: `shimmer-rotate ${duration}s linear infinite`,
          }}
        />
      )}

      {/* Surface shimmer effect - gradient sweep across the card */}
      {surfaceShimmer && (
        <div
          className="absolute inset-0 rounded-[inherit] overflow-hidden pointer-events-none z-[1]"
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
              animation: `shimmer-sweep ${duration * 1.5}s ease-in-out infinite`,
            }}
          />
        </div>
      )}

      {/* Ambient glow on hover */}
      <div
        className="absolute -inset-1 rounded-[inherit] opacity-0 group-hover:opacity-40 blur-xl transition-opacity duration-700"
        style={{
          background: `radial-gradient(ellipse at center, ${borderColor}, transparent 70%)`,
        }}
      />

      {/* Content container */}
      <div className="relative">{children}</div>

      {/* Global styles for animations */}
      <style>{`
        @property --shimmer-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }

        @keyframes shimmer-rotate {
          0% {
            --shimmer-angle: 0deg;
          }
          100% {
            --shimmer-angle: 360deg;
          }
        }

        @keyframes shimmer-sweep {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}

export default ShimmerEffect;

