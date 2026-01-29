import { useState, useCallback, ReactNode, memo, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPersistedBool, setPersistedBool } from '../../lib/persistence';

interface EmberCollapsibleSectionProps {
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
const chevronTransition = { duration: 0.2, ease: 'easeOut' as const };

const expandAnimation = {
  initial: { height: 0, opacity: 0 },
  animate: { 
    height: 'auto', 
    opacity: 1,
    transition: {
      height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
      opacity: { duration: 0.15, delay: 0.05 }
    }
  },
  exit: { 
    height: 0, 
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
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

function EmberCollapsibleSectionComponent({
  id,
  title,
  subtitle,
  storageKey,
  defaultOpen = true,
  children,
  className,
  icon,
  headerAction,
}: EmberCollapsibleSectionProps) {
  const prefersReducedMotion = useReducedMotion();
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

  // Select animation variant based on reduced motion preference
  const animationVariant = useMemo(
    () => prefersReducedMotion ? reducedMotionExpand : expandAnimation,
    [prefersReducedMotion]
  );

  return (
    <section
      className={cn(
        'relative rounded-3xl border border-[#ff9350]/25 bg-gradient-to-br from-[#1a0a06] via-[#bf7140] to-[#070302] overflow-hidden shadow-[0_25px_50px_rgba(0,0,0,0.5)]',
        className
      )}
    >
      {/* Simplified ambient glow - single layer for performance */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,147,80,0.1),transparent_50%)]" />

      {/* Header - clickable toggle area */}
      <div className="relative p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <button
            id={toggleId}
            type="button"
            onClick={toggle}
            onKeyDown={handleKeyDown}
            aria-expanded={isOpen ? "true" : "false"}
            aria-controls={contentId}
            aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
            className={cn(
              'flex-1 flex items-center gap-4 text-left',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9350]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0402]',
              'rounded-xl -m-2 p-2 transition-colors duration-200 hover:bg-white/5'
            )}
          >
            {/* Icon container */}
            {icon && (
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-[#ff9350]/20 to-[#ff6f3c]/10 border border-[#ff9350]/40 flex items-center justify-center">
                {icon}
              </div>
            )}

            {/* Title and subtitle */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg md:text-xl font-bold text-[#ffe7d0] tracking-wide">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs md:text-sm text-[#ffd4b8]/70 mt-0.5 line-clamp-1">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Chevron with CSS transform for better performance */}
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : chevronTransition}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-[#ff9350]/15 border border-[#ff9350]/35 flex items-center justify-center will-change-transform"
            >
              <ChevronDown
                className="w-5 h-5 text-[#ff9350]"
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
            {/* Content divider line */}
            <div className="mx-5 md:mx-6 h-px bg-gradient-to-r from-transparent via-[#ff9350]/35 to-transparent" />
            
            <div className="p-5 md:p-6 pt-4">
              {hasHydrated && children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export const EmberCollapsibleSection = memo(EmberCollapsibleSectionComponent);
export default EmberCollapsibleSection;
