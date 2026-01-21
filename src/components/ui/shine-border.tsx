/**
 * ShineBorder Component (Magic UI)
 * 
 * An animated background border effect with a shining gradient.
 * Adapted from Magic UI for the ATTS portal.
 */

import { memo, CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface ShineBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: string | string[];
  className?: string;
  children: ReactNode;
}

export const ShineBorder = memo(function ShineBorder({
  borderRadius = 16,
  borderWidth = 1,
  duration = 14,
  color = '#10b981',
  className,
  children,
}: ShineBorderProps) {
  const colorString = Array.isArray(color) ? color.join(',') : color;

  return (
    <div
      style={
        {
          '--border-radius': `${borderRadius}px`,
          '--border-width': `${borderWidth}px`,
          '--shine-pulse-duration': `${duration}s`,
          '--mask-linear-gradient': `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          '--background-radial-gradient': `radial-gradient(transparent,transparent, ${colorString}, transparent, transparent)`,
        } as CSSProperties
      }
      className={cn(
        'relative grid min-h-[60px] w-fit min-w-[300px] place-items-center rounded-[--border-radius] bg-white p-3 text-black dark:bg-black dark:text-white',
        // Pseudo-element for the animated border
        'before:pointer-events-none before:absolute before:inset-0 before:size-full before:rounded-[--border-radius]',
        'before:p-[--border-width] before:[background-image:--background-radial-gradient] before:[background-size:300%_300%]',
        'before:[mask:--mask-linear-gradient] before:[mask-composite:exclude] before:![mask-clip:padding-box,border-box]',
        'before:animate-shine',
        className
      )}
    >
      {children}
    </div>
  );
});

// Add shine animation keyframes
const shineStyles = `
@keyframes shine {
  0% {
    background-position: 0% 0%;
  }
  50% {
    background-position: 100% 100%;
  }
  100% {
    background-position: 0% 0%;
  }
}

.animate-shine::before {
  animation: shine var(--shine-pulse-duration) infinite linear;
}
`;

// Inject styles if not already present
if (typeof document !== 'undefined') {
  const styleId = 'shine-border-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = shineStyles;
    document.head.appendChild(style);
  }
}

export default ShineBorder;
