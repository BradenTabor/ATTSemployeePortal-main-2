/**
 * ShimmerButton Component (Magic UI)
 * 
 * A button with a shimmering light that travels around the perimeter.
 * Adapted from Magic UI for the ATTS portal.
 */

import React, { CSSProperties, memo, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ShimmerButton = memo(forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  function ShimmerButton(
    {
      shimmerColor = '#10b981',
      shimmerSize = '0.05em',
      shimmerDuration = '3s',
      borderRadius = '12px',
      background = 'rgba(16, 185, 129, 0.9)',
      className,
      children,
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        style={
          {
            '--spread': '90deg',
            '--shimmer-color': shimmerColor,
            '--radius': borderRadius,
            '--speed': shimmerDuration,
            '--cut': shimmerSize,
            '--bg': background,
          } as CSSProperties
        }
        className={cn(
          'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden',
          '[border-radius:var(--radius)] border border-emerald-400/20 px-6 py-3',
          'whitespace-nowrap text-white font-semibold [background:var(--bg)]',
          'transform-gpu transition-transform duration-300 ease-in-out active:translate-y-px',
          'hover:shadow-lg hover:shadow-emerald-500/20',
          className
        )}
        {...props}
      >
        {/* Shimmer container */}
        <div
          className={cn(
            '-z-30 blur-[2px]',
            '[container-type:size] absolute inset-0 overflow-visible'
          )}
        >
          {/* Shimmer animation */}
          <div 
            className="absolute inset-0 [aspect-ratio:1] h-[100cqh] [border-radius:0] [mask:none]"
            style={{
              animation: `shimmer-slide var(--speed) ease-in-out infinite`,
            }}
          >
            <div 
              className="absolute -inset-full w-auto rotate-0"
              style={{
                animation: `spin-around calc(var(--speed) * 2) infinite linear`,
                background: `conic-gradient(from calc(270deg-(var(--spread)*0.5)),transparent 0,var(--shimmer-color) var(--spread),transparent var(--spread))`,
              }}
            />
          </div>
        </div>
        
        {children}

        {/* Highlight */}
        <div
          className={cn(
            'absolute inset-0 size-full',
            'rounded-xl px-4 py-1.5 text-sm font-medium shadow-[inset_0_-8px_10px_#ffffff1f]',
            'transform-gpu transition-all duration-300 ease-in-out',
            'group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]',
            'group-active:shadow-[inset_0_-10px_10px_#ffffff3f]'
          )}
        />

        {/* Backdrop */}
        <div
          className={cn(
            'absolute [inset:var(--cut)] -z-20 [border-radius:var(--radius)] [background:var(--bg)]'
          )}
        />
      </button>
    );
  }
));

// Add shimmer keyframes to global styles
const shimmerStyles = `
@keyframes shimmer-slide {
  to {
    transform: translate(calc(100cqw - 100%), 0);
  }
}

@keyframes spin-around {
  0% {
    transform: translateZ(0) rotate(0);
  }
  15%, 35% {
    transform: translateZ(0) rotate(90deg);
  }
  65%, 85% {
    transform: translateZ(0) rotate(270deg);
  }
  100% {
    transform: translateZ(0) rotate(360deg);
  }
}
`;

// Inject styles if not already present
if (typeof document !== 'undefined') {
  const styleId = 'shimmer-button-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = shimmerStyles;
    document.head.appendChild(style);
  }
}

export default ShimmerButton;
