import React, { memo } from "react";
import { cn } from "../lib/utils";

interface AdaptiveCardWrapperProps {
  children: React.ReactNode;
  className?: string;
  /** Enable subtle brightness pulse animation (CSS-based, respects reduced motion) */
  enablePulse?: boolean;
}

/**
 * AdaptiveCardWrapper - Wrapper component with optional ambient brightness effect.
 * 
 * PERFORMANCE FIX: Previously used useAnimationFrame which ran every frame.
 * Now uses CSS @keyframes animation which:
 * - Is GPU-accelerated
 * - Only runs when visible (via CSS)
 * - Respects prefers-reduced-motion automatically
 * - Has zero JavaScript overhead during animation
 */
function AdaptiveCardWrapperComponent({ 
  children, 
  className,
  enablePulse = true,
}: AdaptiveCardWrapperProps) {
  return (
    <>
      <div
        className={cn(
          "transition-all duration-500",
          enablePulse && "adaptive-card-pulse",
          className
        )}
      >
        {children}
      </div>
      
      {/* Inject keyframes once - CSS handles everything */}
      <style>{`
        @keyframes adaptiveCardPulse {
          0%, 100% {
            filter: brightness(1) contrast(1.05) saturate(1.05);
          }
          50% {
            filter: brightness(1.08) contrast(1.05) saturate(1.05);
          }
        }
        
        .adaptive-card-pulse {
          animation: adaptiveCardPulse 4s ease-in-out infinite;
        }
        
        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .adaptive-card-pulse {
            animation: none;
            filter: brightness(1) contrast(1.05) saturate(1.05);
          }
        }
      `}</style>
    </>
  );
}

export default memo(AdaptiveCardWrapperComponent);
