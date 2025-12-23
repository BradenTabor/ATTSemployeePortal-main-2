import { useState, useCallback, ReactNode, memo, cloneElement, isValidElement, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPersistedBool, setPersistedBool } from '../../lib/persistence';
import { GlowEffect } from '../ui/GlowEffect';
import { ShimmerEffect } from '../ui/ShimmerEffect';
import type { IconInteractionProps } from './ExpandableSection';
import { getGridExpandStyles, getGridContentStyles, springSnappy, instant } from '../../motion';

// Ember glow color palette
const GLOW_COLORS = ['#f6b78f', '#ff6f3c', '#ffa366', '#ff9350'];

interface EmberExpandableSectionProps {
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

function EmberExpandableSectionComponent({
  id,
  title,
  subtitle,
  storageKey,
  defaultOpen = true,
  children,
  className,
  icon,
  headerAction,
}: EmberExpandableSectionProps) {
  // Check reduced motion preference
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !prefersReducedMotion;

  // Use lazy initializer to read persisted state without useEffect setState
  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey) {
      return getPersistedBool(storageKey, defaultOpen);
    }
    return defaultOpen;
  });
  
  // Interactive states for avatar animations
  const [isHovered, setIsHovered] = useState(false);
  const [wasJustToggled, setWasJustToggled] = useState(false);
  const [toggleDirection, setToggleDirection] = useState<'expand' | 'collapse' | null>(null);
  const toggleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setIsOpen((prev) => {
      const newValue = !prev;
      if (storageKey) {
        setPersistedBool(storageKey, newValue);
      }
      
      // Set toggle direction and trigger animation
      setToggleDirection(newValue ? 'expand' : 'collapse');
      setWasJustToggled(true);
      
      // Clear any existing timeout
      if (toggleTimeoutRef.current) {
        clearTimeout(toggleTimeoutRef.current);
      }
      
      // Reset wasJustToggled after animation completes (800ms for full gesture)
      toggleTimeoutRef.current = setTimeout(() => {
        setWasJustToggled(false);
        setToggleDirection(null);
      }, 800);
      
      return newValue;
    });
  }, [storageKey]);

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

  // Hover handlers
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

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

  // Get CSS Grid styles for performant height animation (no JS measurement needed)
  const gridStyles = getGridExpandStyles(isOpen, shouldAnimate);
  const contentOpacityStyles = getGridContentStyles(isOpen, shouldAnimate);

  // Transition for motion elements
  const chevronTransition = shouldAnimate ? springSnappy : instant;
  const hoverTransition = shouldAnimate ? { type: 'spring' as const, stiffness: 300, damping: 20 } : instant;

  return (
    <div className={cn('relative', className)}>
      {/* Glow effect layer - behind the card */}
      <div className="absolute -inset-3 opacity-30">
        <GlowEffect
          colors={GLOW_COLORS}
          mode="rotate"
          blur="stronger"
          duration={8}
          scale={1.1}
        />
      </div>

      {/* Shimmer wrapper with both border and surface effects */}
      <ShimmerEffect
        borderShimmer={true}
        surfaceShimmer={true}
        duration={4}
        className="rounded-3xl"
        borderColor="rgba(255, 147, 80, 0.15)"
      >
        <section
          className={cn(
            'relative rounded-3xl transition-all duration-300',
            // Premium ember glass morphism styling
            'bg-gradient-to-br from-[#1a0a06]/95 via-[#140804]/90 to-[#0c0402]/95',
            'border border-[#ff9350]/30',
            // Enhanced shadow for depth
            'shadow-[0_0_40px_-12px_rgba(255,147,80,0.25)]',
            'shadow-[#ff9350]/10',
            // Backdrop blur for glass effect
            'backdrop-blur-sm'
          )}
        >
          {/* Inner glow accent */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-[#ff9350]/5 via-transparent to-transparent pointer-events-none" />

          {/* Header - clickable toggle area */}
          <div className="relative p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <button
                id={toggleId}
                type="button"
                onClick={toggle}
                onKeyDown={handleKeyDown}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className={cn(
                  'flex-1 flex items-center gap-3 text-left',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9350]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#140804]',
                  'rounded-xl -m-2 p-2 transition-all duration-200',
                  'hover:bg-[#ff9350]/5'
                )}
              >
                {/* Icon/Avatar container with premium ember styling */}
                {enhancedIcon && (
                  <motion.div
                    className={cn(
                      'flex-shrink-0 w-16 h-20 md:w-18 md:h-22 rounded-2xl',
                      'bg-gradient-to-br from-[#ff9350]/15 via-[#ff6f3c]/8 to-transparent',
                      'border border-[#ffb48a]/30',
                      'flex items-center justify-center',
                      'shadow-xl shadow-[#ff9350]/20',
                      'ring-1 ring-inset ring-[#ffb48a]/5',
                      'overflow-visible relative'
                    )}
                    animate={{
                      scale: isHovered && shouldAnimate ? 1.03 : 1,
                      boxShadow: isHovered 
                        ? '0 0 50px rgba(255, 147, 80, 0.4)' 
                        : '0 20px 25px -5px rgba(255, 147, 80, 0.2)',
                    }}
                    transition={hoverTransition}
                  >
                    {/* Inner glow effect - intensifies on hover */}
                    <motion.div 
                      className="absolute inset-0 rounded-2xl bg-gradient-to-t from-[#ff9350]/8 via-transparent to-[#ffb48a]/3 pointer-events-none"
                      animate={{
                        opacity: isHovered ? 1.5 : 1,
                      }}
                      transition={{ duration: shouldAnimate ? 0.3 : 0 }}
                    />
                    {/* Subtle ambient light - pulses on toggle */}
                    <motion.div 
                      className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-[#ffb48a]/8 to-transparent blur-md pointer-events-none"
                      animate={{
                        scale: wasJustToggled && shouldAnimate ? [1, 1.2, 1] : 1,
                        opacity: wasJustToggled && shouldAnimate ? [0.5, 1, 0.5] : 0.5,
                      }}
                      transition={{ 
                        duration: shouldAnimate ? 0.6 : 0, 
                        ease: 'easeOut',
                      }}
                    />
                    {enhancedIcon}
                  </motion.div>
                )}

                {/* Title and subtitle */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                    <span className="bg-gradient-to-r from-white via-[#ffe4c9] to-white/80 bg-clip-text text-transparent">
                      {title}
                    </span>
                  </h3>
                  {subtitle && (
                    <p className="text-xs md:text-sm text-[#ffd4b8]/60 mt-0.5 line-clamp-1">
                      {subtitle}
                    </p>
                  )}
                </div>

                {/* Animated chevron indicator */}
                <motion.div
                  animate={{ 
                    rotate: isOpen ? 180 : 0,
                    scale: wasJustToggled && shouldAnimate ? [1, 1.15, 1] : 1,
                  }}
                  transition={chevronTransition}
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg',
                    'bg-[#ff9350]/10 border border-[#ff9350]/20',
                    'flex items-center justify-center'
                  )}
                >
                  <ChevronDown
                    className="w-4 h-4 text-[#ffb48a]/70"
                    aria-hidden="true"
                  />
                </motion.div>
              </button>

              {/* Optional header action (e.g., "View all" link) */}
              {headerAction && (
                <div className="flex-shrink-0 ml-2">{headerAction}</div>
              )}
            </div>
          </div>

          {/* Collapsible content with CSS Grid animation (no JS measurement) */}
          <div
            id={contentId}
            role="region"
            aria-labelledby={toggleId}
            style={gridStyles}
          >
            <div className="overflow-hidden">
              <div style={contentOpacityStyles}>
                {/* Divider line */}
                <div className="mx-4 md:mx-6 h-px bg-gradient-to-r from-transparent via-[#ff9350]/30 to-transparent" />
                
                <div className="px-4 pb-4 md:px-6 md:pb-6 pt-4">
                  {/* Staggered content reveal */}
                  <motion.div
                    initial={shouldAnimate ? "hidden" : false}
                    animate={isOpen ? "visible" : "hidden"}
                    variants={{
                      hidden: { opacity: 0 },
                      visible: {
                        opacity: 1,
                        transition: shouldAnimate ? {
                          staggerChildren: 0.05,
                          delayChildren: 0.1,
                        } : { duration: 0 },
                      },
                    }}
                  >
                    {children}
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ShimmerEffect>
    </div>
  );
}

export const EmberExpandableSection = memo(EmberExpandableSectionComponent);
export default EmberExpandableSection;
