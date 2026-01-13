import { useState, useEffect, useCallback, ReactNode, memo, cloneElement, isValidElement, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPersistedBool, setPersistedBool } from '../../lib/persistence';
import { GlowEffect } from '../ui/GlowEffect';
import { ShimmerEffect } from '../ui/ShimmerEffect';
import {
  getDeviceCapabilities,
  getQualitySettings,
  perfMark,
  perfMeasure,
  withWillChange,
} from '../../lib/mobilePerf';

// Emerald glow color palette
const GLOW_COLORS = ['#10b981', '#059669', '#34d399', '#047857'];

// Props that will be passed to icon components (like DashboardAvatar)
export interface IconInteractionProps {
  /** Whether the section is currently expanded */
  isExpanded?: boolean;
  /** Whether the section header is being hovered */
  isHovered?: boolean;
  /** Triggers when section was just toggled - resets after animation */
  wasJustToggled?: boolean;
  /** Direction of the last toggle: 'expand' or 'collapse' */
  toggleDirection?: 'expand' | 'collapse' | null;
}

interface ExpandableSectionProps {
  /** Unique ID for ARIA attributes */
  id: string;
  /** Section heading */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** localStorage key for persistence */
  storageKey?: string;
  /** Initial open state (used if no persisted state) */
  defaultOpen?: boolean;
  /** Section content */
  children: ReactNode;
  /** Additional container classes */
  className?: string;
  /** Optional icon to display next to title */
  icon?: ReactNode;
  /** Header action button/element (e.g., "View all" link) */
  headerAction?: ReactNode;
}

/**
 * ExpandableSection - Mobile-optimized collapsible section
 * 
 * Performance optimizations:
 * - Uses CSS grid-template-rows for GPU-accelerated height animation
 * - Respects prefers-reduced-motion for accessibility
 * - Applies will-change only during animation to save GPU memory
 * - Reduced visual effects on low-end devices
 * - No JavaScript-based height measurement (eliminates ResizeObserver polling)
 */
function ExpandableSectionComponent({
  id,
  title,
  subtitle,
  storageKey,
  defaultOpen = true,
  children,
  className,
  icon,
  headerAction,
}: ExpandableSectionProps) {
  // Use lazy initializer to read persisted state without useEffect setState
  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey) {
      return getPersistedBool(storageKey, defaultOpen);
    }
    return defaultOpen;
  });
  // Always true since we initialize synchronously now
  const hasHydrated = true;
  
  // Interactive states for avatar animations
  const [isHovered, setIsHovered] = useState(false);
  const [wasJustToggled, setWasJustToggled] = useState(false);
  const [toggleDirection, setToggleDirection] = useState<'expand' | 'collapse' | null>(null);
  const toggleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Get device capabilities and quality settings (cached)
  const caps = getDeviceCapabilities();
  const quality = getQualitySettings();

  // Cleanup toggle timeout on unmount
  useEffect(() => {
    return () => {
      if (toggleTimeoutRef.current) {
        clearTimeout(toggleTimeoutRef.current);
      }
    };
  }, []);

  // Toggle handler with persistence and animation trigger
  const toggle = useCallback(() => {
    perfMark(`expand-section-${id}`);
    
    setIsOpen((prev) => {
      const newValue = !prev;
      if (storageKey) {
        setPersistedBool(storageKey, newValue);
      }
      
      // Set toggle direction and trigger animation
      setToggleDirection(newValue ? 'expand' : 'collapse');
      setWasJustToggled(true);
      
      // Apply will-change during animation only (prevents GPU memory waste)
      if (quality.enableAnimations) {
        withWillChange(contentRef.current, 'grid-template-rows, opacity', 350);
      }
      
      // Clear any existing timeout
      if (toggleTimeoutRef.current) {
        clearTimeout(toggleTimeoutRef.current);
      }
      
      // Reset wasJustToggled after animation completes
      const animDuration = quality.enableAnimations ? 400 : 0;
      toggleTimeoutRef.current = setTimeout(() => {
        setWasJustToggled(false);
        setToggleDirection(null);
        perfMeasure(`expand-section-${id}`);
      }, animDuration);
      
      return newValue;
    });
  }, [storageKey, id, quality.enableAnimations]);

  // Keyboard handler for Enter/Space
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle]
  );

  // Hover handlers (disabled on touch devices to prevent stuck hover states)
  const handleMouseEnter = useCallback(() => {
    if (!caps.isMobile) {
      setIsHovered(true);
    }
  }, [caps.isMobile]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const toggleId = `${id}-toggle`;
  const contentId = `${id}-content`;

  // Clone icon element with interaction props if it's a valid React element
  const enhancedIcon = icon && isValidElement(icon)
    ? cloneElement(icon as React.ReactElement<IconInteractionProps>, {
        isExpanded: isOpen,
        isHovered,
        wasJustToggled,
        toggleDirection,
      })
    : icon;

  // Determine animation styles based on device capabilities
  const shouldAnimate = quality.enableAnimations && !caps.prefersReducedMotion;
  
  // CSS Grid-based height animation (GPU-accelerated, no JS measurement)
  // grid-template-rows: 0fr -> 1fr is performant and works well cross-browser
  const gridStyle: React.CSSProperties = shouldAnimate
    ? {
        display: 'grid',
        gridTemplateRows: isOpen ? '1fr' : '0fr',
        transition: 'grid-template-rows 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      }
    : {
        display: isOpen ? 'block' : 'none',
      };

  // Reduced effects for low-end devices
  const showEffects = quality.enableEffects && !caps.isLowEnd;

  return (
    <div className={cn('relative', className)}>
      {/* Glow effect layer - behind the card (disabled on low-end) */}
      {showEffects && (
        <div className="absolute -inset-3 opacity-40">
          <GlowEffect
            colors={GLOW_COLORS}
            mode="static"
            blur="stronger"
            scale={1.1}
          />
        </div>
      )}

      {/* Shimmer wrapper - only on capable devices */}
      <ShimmerEffectWrapper enabled={showEffects}>
        <section
          ref={sectionRef}
          className={cn(
            'relative rounded-3xl transition-colors duration-300',
            // Premium glass morphism styling
            'bg-gradient-to-br from-[#04150f]/95 via-[#041812]/90 to-[#03120c]/95',
            'border border-emerald-500/30',
            // Reduced shadow on mobile for performance
            caps.isMobile
              ? 'shadow-lg shadow-emerald-500/10'
              : 'shadow-[0_0_40px_-12px_rgba(16,185,129,0.25)] shadow-emerald-500/10',
            // Layout containment for rendering isolation
            'contain-layout'
          )}
          style={{
            // Safari-safe containment
            contain: 'layout style',
          }}
        >
          {/* Inner glow accent (simplified on mobile) */}
          {showEffects && (
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
          )}

          {/* Header - clickable toggle area */}
          <div 
            className="relative p-4 md:p-6 rounded-[inherit]"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(16, 66, 42, 1) 0%, rgba(0, 0, 0, 1) 100%)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                id={toggleId}
                type="button"
                onClick={toggle}
                onKeyDown={handleKeyDown}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                aria-expanded={isOpen ? "true" : "false"}
                aria-controls={contentId}
                className={cn(
                  'flex-1 flex items-center gap-3 text-left',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04150f]',
                  'rounded-xl -m-2 p-2 transition-colors duration-200',
                  'hover:bg-emerald-500/5',
                  // Touch-friendly sizing
                  'min-h-[44px]'
                )}
              >
                {/* Icon/Avatar container with premium styling */}
                {enhancedIcon && (
                  <div
                    className={cn(
                      'flex-shrink-0 w-16 h-20 md:w-18 md:h-22 rounded-2xl',
                      'bg-gradient-to-br from-emerald-500/15 via-emerald-600/8 to-transparent',
                      'border border-emerald-400/30',
                      'flex items-center justify-center',
                      // Simplified shadow on mobile
                      caps.isMobile
                        ? 'shadow-lg shadow-emerald-500/15'
                        : 'shadow-xl shadow-emerald-500/20',
                      'ring-1 ring-inset ring-emerald-300/5',
                      'overflow-visible relative',
                      // Scale on hover (desktop only, respects reduced motion)
                      shouldAnimate && !caps.isMobile && 'transition-transform duration-200',
                      isHovered && shouldAnimate && !caps.isMobile && 'scale-[1.03]'
                    )}
                  >
                    {/* Inner glow effect - intensifies on hover */}
                    {showEffects && (
                      <div 
                        className={cn(
                          'absolute inset-0 rounded-2xl bg-gradient-to-t from-emerald-500/8 via-transparent to-emerald-400/3 pointer-events-none transition-opacity duration-300',
                          isHovered ? 'opacity-100' : 'opacity-70'
                        )}
                      />
                    )}
                    {enhancedIcon}
                  </div>
                )}

                {/* Title and subtitle */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                    <span className="bg-gradient-to-r from-white via-emerald-100 to-white/80 bg-clip-text text-transparent">
                      {title}
                    </span>
                  </h3>
                  {subtitle && (
                    <p className="text-xs md:text-sm text-emerald-200/60 mt-0.5 line-clamp-1">
                      {subtitle}
                    </p>
                  )}
                </div>

                {/* Animated chevron indicator */}
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg',
                    'bg-emerald-500/10 border border-emerald-500/20',
                    'flex items-center justify-center',
                    // CSS transform for chevron rotation (GPU-accelerated)
                    'transition-transform duration-300',
                    isOpen && 'rotate-180'
                  )}
                  style={{
                    // Force GPU layer for smooth rotation
                    transform: `rotate(${isOpen ? 180 : 0}deg) translateZ(0)`,
                    transition: shouldAnimate ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                  }}
                >
                  <ChevronDown
                    className="w-4 h-4 text-emerald-400/70"
                    aria-hidden="true"
                  />
                </div>
              </button>

              {/* Optional header action (e.g., "View all" link) */}
              {headerAction && (
                <div className="flex-shrink-0 ml-2">{headerAction}</div>
              )}
            </div>
          </div>

          {/* Collapsible content with CSS Grid animation */}
          <div
            ref={contentRef}
            id={contentId}
            role="region"
            aria-labelledby={toggleId}
            style={gridStyle}
          >
            <div className="overflow-hidden">
              {/* Simplified content wrapper - CSS-only opacity transition */}
              {hasHydrated && (
                <div
                  className={cn(
                    shouldAnimate && "transition-opacity duration-200",
                    isOpen ? "opacity-100" : "opacity-0"
                  )}
                >
                  {/* Divider line */}
                  <div className="mx-4 md:mx-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                  
                  <div className="px-4 pb-4 md:px-6 md:pb-6 pt-4">
                    {children}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </ShimmerEffectWrapper>
    </div>
  );
}

/**
 * Conditional wrapper for ShimmerEffect to avoid overhead on low-end devices
 */
function ShimmerEffectWrapper({ 
  enabled, 
  children 
}: { 
  enabled: boolean; 
  children: ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <ShimmerEffect
      borderShimmer={true}
      surfaceShimmer={true}
      duration={4}
      className="rounded-3xl"
    >
      {children}
    </ShimmerEffect>
  );
}

export const ExpandableSection = memo(ExpandableSectionComponent);
export default ExpandableSection;
