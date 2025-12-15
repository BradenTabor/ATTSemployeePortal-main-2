import { useState, useEffect, useCallback, ReactNode, memo, cloneElement, isValidElement, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import useMeasure from 'react-use-measure';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPersistedBool, setPersistedBool } from '../../lib/persistence';
import { GlowEffect } from '../ui/GlowEffect';
import { ShimmerEffect } from '../ui/ShimmerEffect';

const springConfig = { stiffness: 200, damping: 25, mass: 0.8 };

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
  // Initialize with defaultOpen, will be updated in useEffect from localStorage
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasHydrated, setHasHydrated] = useState(false);
  
  // Interactive states for avatar animations
  const [isHovered, setIsHovered] = useState(false);
  const [wasJustToggled, setWasJustToggled] = useState(false);
  const [toggleDirection, setToggleDirection] = useState<'expand' | 'collapse' | null>(null);
  const toggleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Measure content height for smooth animations
  const [measureRef, { height: measuredHeight }] = useMeasure();
  
  // Motion values for spring-based height animation
  const animatedHeight = useMotionValue(0);
  const smoothHeight = useSpring(animatedHeight, springConfig);

  // Read persisted state on mount (in useEffect to avoid hydration mismatch)
  useEffect(() => {
    if (storageKey) {
      const persisted = getPersistedBool(storageKey, defaultOpen);
      setIsOpen(persisted);
    }
    setHasHydrated(true);
  }, [storageKey, defaultOpen]);

  // Update animated height when expansion state or measured height changes
  useEffect(() => {
    if (isOpen && hasHydrated) {
      animatedHeight.set(measuredHeight);
    } else {
      animatedHeight.set(0);
    }
  }, [isOpen, measuredHeight, animatedHeight, hasHydrated]);

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

  return (
    <div className={cn('relative', className)}>
      {/* Glow effect layer - behind the card */}
      <div className="absolute -inset-3 opacity-40">
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
      >
        <section
          className={cn(
            'relative rounded-3xl transition-all duration-300',
            // Premium glass morphism styling
            'bg-gradient-to-br from-[#04150f]/95 via-[#041812]/90 to-[#03120c]/95',
            'border border-emerald-500/30',
            // Enhanced shadow for depth
            'shadow-[0_0_40px_-12px_rgba(16,185,129,0.25)]',
            'shadow-emerald-500/10',
            // Backdrop blur for glass effect
            'backdrop-blur-sm'
          )}
        >
          {/* Inner glow accent */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

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
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04150f]',
                  'rounded-xl -m-2 p-2 transition-all duration-200',
                  'hover:bg-emerald-500/5'
                )}
              >
                {/* Icon/Avatar container with premium styling */}
                {enhancedIcon && (
                  <motion.div
                    className={cn(
                      'flex-shrink-0 w-16 h-20 md:w-18 md:h-22 rounded-2xl',
                      'bg-gradient-to-br from-emerald-500/15 via-emerald-600/8 to-transparent',
                      'border border-emerald-400/30',
                      'flex items-center justify-center',
                      'shadow-xl shadow-emerald-500/20',
                      'ring-1 ring-inset ring-emerald-300/5',
                      'overflow-visible relative'
                    )}
                    animate={{
                      scale: isHovered ? 1.03 : 1,
                      boxShadow: isHovered 
                        ? '0 0 50px rgba(16, 185, 129, 0.4)' 
                        : '0 20px 25px -5px rgba(16, 185, 129, 0.2)',
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    {/* Inner glow effect - intensifies on hover */}
                    <motion.div 
                      className="absolute inset-0 rounded-2xl bg-gradient-to-t from-emerald-500/8 via-transparent to-emerald-400/3 pointer-events-none"
                      animate={{
                        opacity: isHovered ? 1.5 : 1,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                    {/* Subtle ambient light - pulses on toggle */}
                    <motion.div 
                      className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-emerald-400/8 to-transparent blur-md pointer-events-none"
                      animate={{
                        scale: wasJustToggled ? [1, 1.2, 1] : 1,
                        opacity: wasJustToggled ? [0.5, 1, 0.5] : 0.5,
                      }}
                      transition={{ 
                        duration: 0.6, 
                        ease: 'easeOut',
                      }}
                    />
                    {enhancedIcon}
                  </motion.div>
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
                <motion.div
                  animate={{ 
                    rotate: isOpen ? 180 : 0,
                    scale: wasJustToggled ? [1, 1.15, 1] : 1,
                  }}
                  transition={{ 
                    rotate: { duration: 0.3, ease: 'easeInOut' },
                    scale: { duration: 0.4, ease: 'easeOut' },
                  }}
                  className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg',
                    'bg-emerald-500/10 border border-emerald-500/20',
                    'flex items-center justify-center'
                  )}
                >
                  <ChevronDown
                    className="w-4 h-4 text-emerald-400/70"
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

          {/* Collapsible content with spring animation */}
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={toggleId}
            style={{ height: smoothHeight, overflow: 'hidden' }}
          >
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  ref={measureRef}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    transition: {
                      opacity: { duration: 0.3, delay: 0.1 },
                      y: { duration: 0.3, delay: 0.05 }
                    }
                  }}
                  exit={{ 
                    opacity: 0,
                    y: -5,
                    transition: {
                      opacity: { duration: 0.15 },
                      y: { duration: 0.1 }
                    }
                  }}
                >
                  {/* Divider line */}
                  <div className="mx-4 md:mx-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                  
                  <div className="px-4 pb-4 md:px-6 md:pb-6 pt-4">
                    {/* Staggered content reveal */}
                    <motion.div
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: {
                            staggerChildren: 0.05,
                            delayChildren: 0.1,
                          },
                        },
                      }}
                    >
                      {/* Only render children after hydration to avoid flash */}
                      {hasHydrated && children}
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </section>
      </ShimmerEffect>
    </div>
  );
}

export const ExpandableSection = memo(ExpandableSectionComponent);
export default ExpandableSection;