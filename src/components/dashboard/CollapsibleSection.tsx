import { useState, useEffect, useCallback, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { getPersistedBool, setPersistedBool } from "../../lib/persistence";

interface CollapsibleSectionProps {
  /** Unique identifier for aria-controls */
  id: string;
  /** Section title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** localStorage key for persisting collapsed state */
  storageKey?: string;
  /** Initial open state (default: true) */
  defaultOpen?: boolean;
  /** Section content */
  children: React.ReactNode;
  /** Additional class names for the outer container */
  className?: string;
  /** Optional header icon */
  icon?: React.ReactNode;
}

/**
 * Collapsible section with persisted open/close state.
 * Accessible with keyboard navigation and proper ARIA attributes.
 */
export default function CollapsibleSection({
  id,
  title,
  subtitle,
  storageKey,
  defaultOpen = true,
  children,
  className,
  icon,
}: CollapsibleSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const buttonId = useId();
  const contentId = `${id}-content`;

  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey) {
      return getPersistedBool(storageKey, defaultOpen);
    }
    return defaultOpen;
  });

  // Persist state changes
  useEffect(() => {
    if (storageKey) {
      setPersistedBool(storageKey, isOpen);
    }
  }, [isOpen, storageKey]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    },
    [toggle]
  );

  const animationProps = prefersReducedMotion
    ? {}
    : {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0.25, ease: "easeInOut" },
      };

  return (
    <section
      className={cn(
        "rounded-3xl border border-[#1f5f46]/40 bg-[#04150f]/85 overflow-hidden",
        className
      )}
    >
      {/* Header / Toggle Button */}
      <button
        id={buttonId}
        type="button"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={cn(
          "w-full flex items-center justify-between gap-4 p-5 text-left",
          "hover:bg-white/[0.02] transition-colors duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04150f]"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span className="flex-shrink-0 text-emerald-300">{icon}</span>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{title}</h3>
            {subtitle && (
              <p className="text-xs text-white/60 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 text-emerald-400"
        >
          <ChevronDown className="w-5 h-5" />
        </motion.span>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={contentId}
            role="region"
            aria-labelledby={buttonId}
            {...animationProps}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

