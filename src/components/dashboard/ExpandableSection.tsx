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

// ============================================================================
// THEME CONFIGURATION
// ============================================================================

export type ExpandableSectionTheme = 'emerald' | 'blue';

interface ThemeConfig {
  glowColors: string[];
  cardBg: string;
  borderColor: string;
  shadow: string;
  shadowMobile: string;
  innerGlowAccent: string;
  headerBg: string;
  focusRing: string;
  hoverBg: string;
  iconContainerBg: string;
  iconContainerBorder: string;
  iconContainerShadow: string;
  iconContainerShadowMobile: string;
  iconContainerRing: string;
  iconGlowHover: string;
  iconGlowDefault: string;
  titleGradient: string;
  subtitleColor: string;
  chevronBg: string;
  chevronBorder: string;
  chevronColor: string;
  dividerGradient: string;
}

const themeConfig: Record<ExpandableSectionTheme, ThemeConfig> = {
  emerald: {
    glowColors: ['#10b981', '#059669', '#34d399', '#047857'],
    cardBg: 'bg-gradient-to-br from-[#04150f]/95 via-[#041812]/90 to-[#03120c]/95',
    borderColor: 'border-emerald-500/30',
    shadow: 'shadow-[0_0_40px_-12px_rgba(16,185,129,0.25)] shadow-emerald-500/10',
    shadowMobile: 'shadow-lg shadow-emerald-500/10',
    innerGlowAccent: 'bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent',
    headerBg: 'radial-gradient(circle at 50% 50%, rgba(16, 66, 42, 1) 0%, rgba(0, 0, 0, 1) 100%)',
    focusRing: 'focus-visible:ring-emerald-400/50 focus-visible:ring-offset-[#04150f]',
    hoverBg: 'hover:bg-emerald-500/5',
    iconContainerBg: 'bg-gradient-to-br from-emerald-500/15 via-emerald-600/8 to-transparent',
    iconContainerBorder: 'border-emerald-400/30',
    iconContainerShadow: 'shadow-xl shadow-emerald-500/20',
    iconContainerShadowMobile: 'shadow-lg shadow-emerald-500/15',
    iconContainerRing: 'ring-emerald-300/5',
    iconGlowHover: 'from-emerald-500/8 via-transparent to-emerald-400/3',
    iconGlowDefault: 'from-emerald-500/8 via-transparent to-emerald-400/3',
    titleGradient: 'from-white via-emerald-100 to-white/80',
    subtitleColor: 'text-emerald-200/60',
    chevronBg: 'bg-emerald-500/10',
    chevronBorder: 'border-emerald-500/20',
    chevronColor: 'text-emerald-400/70',
    dividerGradient: 'from-transparent via-emerald-500/30 to-transparent',
  },
  blue: {
    glowColors: ['#3b82f6', '#2563eb', '#60a5fa', '#1d4ed8'],
    cardBg: 'bg-gradient-to-br from-[#040815]/95 via-[#041020]/90 to-[#03080c]/95',
    borderColor: 'border-blue-500/30',
    shadow: 'shadow-[0_0_40px_-12px_rgba(59,130,246,0.25)] shadow-blue-500/10',
    shadowMobile: 'shadow-lg shadow-blue-500/10',
    innerGlowAccent: 'bg-gradient-to-b from-blue-500/5 via-transparent to-transparent',
    headerBg: 'radial-gradient(circle at 50% 50%, rgba(16, 42, 66, 1) 0%, rgba(0, 0, 0, 1) 100%)',
    focusRing: 'focus-visible:ring-blue-400/50 focus-visible:ring-offset-[#040815]',
    hoverBg: 'hover:bg-blue-500/5',
    iconContainerBg: 'bg-gradient-to-br from-blue-500/15 via-blue-600/8 to-transparent',
    iconContainerBorder: 'border-blue-400/30',
    iconContainerShadow: 'shadow-xl shadow-blue-500/20',
    iconContainerShadowMobile: 'shadow-lg shadow-blue-500/15',
    iconContainerRing: 'ring-blue-300/5',
    iconGlowHover: 'from-blue-500/8 via-transparent to-blue-400/3',
    iconGlowDefault: 'from-blue-500/8 via-transparent to-blue-400/3',
    titleGradient: 'from-white via-blue-100 to-white/80',
    subtitleColor: 'text-blue-200/60',
    chevronBg: 'bg-blue-500/10',
    chevronBorder: 'border-blue-500/20',
    chevronColor: 'text-blue-400/70',
    dividerGradient: 'from-transparent via-blue-500/30 to-transparent',
  },
};

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
  /** Accessible label for the toggle button (provides additional context for screen readers) */
  ariaLabel?: string;
  /** Color theme - defaults to emerald */
  theme?: ExpandableSectionTheme;
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
  ariaLabel,
  theme = 'emerald',
}: ExpandableSectionProps) {
  // Get theme styles
  const themeStyles = themeConfig[theme];
  
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
            colors={themeStyles.glowColors}
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
            // Premium glass morphism styling - theme-aware
            themeStyles.cardBg,
            'border',
            themeStyles.borderColor,
            // Reduced shadow on mobile for performance
            caps.isMobile ? themeStyles.shadowMobile : themeStyles.shadow,
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
            <div className={cn('absolute inset-0 rounded-3xl pointer-events-none', themeStyles.innerGlowAccent)} />
          )}

          {/* Header - clickable toggle area */}
          <div 
            className="relative p-4 md:p-6 rounded-[inherit]"
            style={{
              background: themeStyles.headerBg,
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
                aria-label={ariaLabel}
                className={cn(
                  'flex-1 flex items-center gap-3 text-left',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  themeStyles.focusRing,
                  'rounded-xl -m-2 p-2 transition-colors duration-200',
                  themeStyles.hoverBg,
                  // Touch-friendly sizing
                  'min-h-[44px]'
                )}
              >
                {/* Icon/Avatar container with premium styling */}
                {enhancedIcon && (
                  <div
                    className={cn(
                      'flex-shrink-0 w-16 h-20 md:w-18 md:h-22 rounded-2xl',
                      themeStyles.iconContainerBg,
                      'border',
                      themeStyles.iconContainerBorder,
                      'flex items-center justify-center',
                      // Simplified shadow on mobile
                      caps.isMobile ? themeStyles.iconContainerShadowMobile : themeStyles.iconContainerShadow,
                      'ring-1 ring-inset',
                      themeStyles.iconContainerRing,
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
                          'absolute inset-0 rounded-2xl bg-gradient-to-t pointer-events-none transition-opacity duration-300',
                          themeStyles.iconGlowHover,
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
                    <span className={cn('bg-gradient-to-r bg-clip-text text-transparent', themeStyles.titleGradient)}>
                      {title}
                    </span>
                  </h3>
                  {subtitle && (
                    <p className={cn('text-xs md:text-sm mt-0.5 line-clamp-1', themeStyles.subtitleColor)}>
                      {subtitle}
                    </p>
                  )}
                </div>

                {/* Animated chevron indicator */}
                <div
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg',
                    themeStyles.chevronBg,
                    'border',
                    themeStyles.chevronBorder,
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
                    className={cn('w-4 h-4', themeStyles.chevronColor)}
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
                  <div className={cn('mx-4 md:mx-6 h-px bg-gradient-to-r', themeStyles.dividerGradient)} />
                  
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
