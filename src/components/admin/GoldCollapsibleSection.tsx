import { useState, useCallback, ReactNode, memo, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPersistedBool, setPersistedBool } from '../../lib/persistence';

interface GoldCollapsibleSectionProps {
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
  /** Header action button/element */
  headerAction?: ReactNode;
}

// Stable animation configs - defined outside component to prevent recreations
const chevronTransition = { duration: 0.3, ease: 'easeInOut' as const };
const chevronTransitionReduced = { duration: 0 };

const expandAnimation = {
  initial: { height: 0, opacity: 0 },
  animate: { 
    height: 'auto', 
    opacity: 1,
    transition: {
      height: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.25, delay: 0.1 }
    }
  },
  exit: { 
    height: 0, 
    opacity: 0,
    transition: {
      height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.15 }
    }
  }
};

// Reduced motion variants - instant transitions
const reducedMotionExpand = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.1 } }
};

function GoldCollapsibleSectionComponent({
  id,
  title,
  subtitle,
  storageKey,
  defaultOpen = true,
  children,
  className,
  icon,
  headerAction,
}: GoldCollapsibleSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !prefersReducedMotion;

  // Use lazy initializer to read persisted state without useEffect setState
  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey) {
      return getPersistedBool(storageKey, defaultOpen);
    }
    return defaultOpen;
  });
  // Always true since we initialize synchronously now
  const hasHydrated = true;
  const [isHovered, setIsHovered] = useState(false);

  // Toggle handler with persistence
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const newValue = !prev;
      if (storageKey) {
        setPersistedBool(storageKey, newValue);
      }
      return newValue;
    });
  }, [storageKey]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle]
  );

  const toggleId = `${id}-toggle`;
  const contentId = `${id}-content`;

  // Compute aria attributes to satisfy linter
  const ariaProps = { 'aria-expanded': isOpen ? 'true' as const : 'false' as const };

  // Select animation variant based on reduced motion preference
  const animationVariant = useMemo(
    () => prefersReducedMotion ? reducedMotionExpand : expandAnimation,
    [prefersReducedMotion]
  );

  return (
    <section
      className={cn(
        'relative rounded-leaf border border-[#E4EAE1]/20 bg-gradient-to-br from-[#0B100D] via-[#040605] to-[#040605] overflow-hidden transition-all shadow-[0_25px_50px_rgba(0,0,0,0.5)]',
        isHovered && shouldAnimate && 'border-[#E4EAE1]/40 shadow-[0_30px_60px_rgba(0,0,0,0.6)]',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Ambient glow overlays */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(236,255,174,0.08),transparent_50%)] opacity-80" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(174,219,63,0.06),transparent_40%)]" />
      
      {/* Shimmer effect on hover - respects reduced motion */}
      {shouldAnimate && (
        <div 
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden rounded-leaf transition-opacity duration-500",
            isHovered ? "opacity-100" : "opacity-0"
          )}
          style={{
            background: `linear-gradient(
              115deg,
              transparent 15%,
              rgba(236,255,174,0.06) 35%,
              rgba(221,255,133,0.04) 50%,
              rgba(236,255,174,0.06) 65%,
              transparent 85%
            )`,
            backgroundSize: '250% 100%',
            animation: isHovered ? 'goldShimmer 3s ease-in-out infinite' : 'none',
          }}
        />
      )}

      {/* Header - clickable toggle area */}
      <div className="relative p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <button
            id={toggleId}
            type="button"
            onClick={toggle}
            onKeyDown={handleKeyDown}
            {...ariaProps}
            aria-controls={contentId}
            aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
            className={cn(
              'flex-1 flex items-center gap-4 text-left',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F4F7F2]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B100D]',
              'rounded-xl -m-2 p-2 transition-all duration-300 hover:bg-white/5'
            )}
          >
            {/* Icon container with gold glow */}
            {icon && (
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-[#F4F7F2]/15 to-[#F4F7F2]/10 border border-[#F4F7F2]/40 flex items-center justify-center shadow-[0_0_20px_rgba(221,255,133,0.15)]">
                {icon}
              </div>
            )}

            {/* Title and subtitle */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg md:text-xl font-bold text-[#F4F7F2] flex items-center gap-2 tracking-wide">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs md:text-sm text-[#E4EAE1]/70 mt-0.5 line-clamp-1">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Animated chevron */}
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={prefersReducedMotion ? chevronTransitionReduced : chevronTransition}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-[#F4F7F2]/10 border border-[#F4F7F2]/30 flex items-center justify-center will-change-transform"
            >
              <ChevronDown
                className="w-5 h-5 text-[#F4F7F2]"
                aria-hidden="true"
              />
            </motion.div>
          </button>

          {/* Optional header action */}
          {headerAction && (
            <div className="flex-shrink-0 ml-2">{headerAction}</div>
          )}
        </div>
      </div>

      {/* Collapsible content with spring animation */}
      <AnimatePresence initial={false} mode="sync">
        {isOpen && (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={toggleId}
            {...animationVariant}
            className="overflow-hidden"
          >
            {/* Content divider line */}
            <div className="mx-3 sm:mx-5 md:mx-6 h-px bg-gradient-to-r from-transparent via-[#F4F7F2]/30 to-transparent" />
            
            <div className="p-3 sm:p-5 md:p-6 pt-3 sm:pt-4">
              {hasHydrated && children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes goldShimmer {
          0%, 100% { background-position: 250% 0; }
          50% { background-position: -250% 0; }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .gold-shimmer {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}

export const GoldCollapsibleSection = memo(GoldCollapsibleSectionComponent);
export default GoldCollapsibleSection;
