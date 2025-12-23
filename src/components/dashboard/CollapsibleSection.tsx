import { useState, useCallback, ReactNode, memo, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPersistedBool, setPersistedBool } from '../../lib/persistence';

interface CollapsibleSectionProps {
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

// Stable animation configs - defined outside component to prevent recreations
const expandAnimation = {
  initial: { height: 0, opacity: 0 },
  animate: { 
    height: 'auto', 
    opacity: 1,
    transition: {
      height: { duration: 0.25, ease: 'easeOut' as const },
      opacity: { duration: 0.2, delay: 0.05 }
    }
  },
  exit: { 
    height: 0, 
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: 'easeIn' as const },
      opacity: { duration: 0.1 }
    }
  }
};

// Reduced motion variants - instant transitions
const reducedMotionExpand = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.1 } },
  exit: { opacity: 0, transition: { duration: 0.1 } }
};

function CollapsibleSectionComponent({
  id,
  title,
  subtitle,
  storageKey,
  defaultOpen = true,
  children,
  className,
  icon,
  headerAction,
}: CollapsibleSectionProps) {
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

  const toggleId = `${id}-toggle`;
  const contentId = `${id}-content`;

  // Select animation variant based on reduced motion preference
  const animationVariant = useMemo(
    () => prefersReducedMotion ? reducedMotionExpand : expandAnimation,
    [prefersReducedMotion]
  );

  return (
    <section
      className={cn(
        'rounded-3xl border border-[#1f5f46]/40 bg-[#04150f]/85 overflow-hidden transition-all',
        className
      )}
    >
      {/* Header - clickable toggle area */}
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <button
            id={toggleId}
            type="button"
            onClick={toggle}
            onKeyDown={handleKeyDown}
            aria-expanded={isOpen}
            aria-controls={contentId}
            className={cn(
              'flex-1 flex items-center gap-3 text-left',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04150f]',
              'rounded-lg -m-2 p-2 transition-colors hover:bg-white/5'
            )}
          >
            {/* Icon */}
            {icon && (
              <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                {icon}
              </div>
            )}

            {/* Title and subtitle */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-white/60 mt-0.5 line-clamp-1">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Chevron indicator - CSS transform for better performance */}
            <div
              className={cn(
                'w-5 h-5 text-white/40 flex-shrink-0 will-change-transform',
                shouldAnimate ? 'transition-transform duration-200' : ''
              )}
              style={{
                transform: `rotate(${isOpen ? 180 : 0}deg)`,
              }}
            >
              <ChevronDown
                className="w-5 h-5"
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

      {/* Collapsible content */}
      <AnimatePresence initial={false} mode="sync">
        {isOpen && (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={toggleId}
            {...animationVariant}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 md:px-6 md:pb-6 pt-0">
              {/* Only render children after hydration to avoid flash */}
              {hasHydrated && children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export const CollapsibleSection = memo(CollapsibleSectionComponent);
export default CollapsibleSection;
