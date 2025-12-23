import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// Context
interface ExpandableScreenContextValue {
  isExpanded: boolean;
  expand: () => void;
  collapse: () => void;
  layoutId: string;
  triggerRadius: string;
  contentRadius: string;
  animationDuration: number;
}

const ExpandableScreenContext = createContext<ExpandableScreenContextValue | null>(null);

// This hook is exported from the same module as ExpandableScreen for developer ergonomics.
// eslint-disable-next-line react-refresh/only-export-components
export function useExpandableScreen() {
  const context = useContext(ExpandableScreenContext);
  if (!context) {
    throw new Error('useExpandableScreen must be used within an ExpandableScreen');
  }
  return context;
}

// Root Component
interface ExpandableScreenProps {
  children: ReactNode;
  defaultExpanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  layoutId?: string;
  triggerRadius?: string;
  contentRadius?: string;
  animationDuration?: number;
  lockScroll?: boolean;
}

export function ExpandableScreen({
  children,
  defaultExpanded = false,
  onExpandChange,
  layoutId = 'expandable-card',
  triggerRadius = '16px',
  contentRadius = '24px',
  animationDuration = 0.35,
  lockScroll = true,
}: ExpandableScreenProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const expand = useCallback(() => {
    setIsExpanded(true);
    onExpandChange?.(true);
  }, [onExpandChange]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
    onExpandChange?.(false);
  }, [onExpandChange]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        collapse();
      }
    };

    if (isExpanded) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExpanded, collapse]);

  // Handle scroll lock
  useEffect(() => {
    if (lockScroll) {
      if (isExpanded) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'unset';
      }
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isExpanded, lockScroll]);

  return (
    <ExpandableScreenContext.Provider
      value={{
        isExpanded,
        expand,
        collapse,
        layoutId,
        triggerRadius,
        contentRadius,
        animationDuration,
      }}
    >
      {children}
    </ExpandableScreenContext.Provider>
  );
}

// Trigger Component
interface ExpandableScreenTriggerProps {
  children: ReactNode;
  className?: string;
}

export function ExpandableScreenTrigger({
  children,
  className = '',
}: ExpandableScreenTriggerProps) {
  const { isExpanded, expand, layoutId, triggerRadius } = useExpandableScreen();

  return (
    <AnimatePresence initial={false}>
      {!isExpanded && (
        <motion.div className={cn('inline-block relative w-full', className)}>
          {/* Background layer with shared layoutId for morphing */}
          <motion.div
            style={{ borderRadius: triggerRadius }}
            layout
            layoutId={layoutId}
            className="absolute inset-0 transform-gpu will-change-transform bg-transparent"
          />
          {/* Content layer that fades out on expand */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            exit={{ opacity: 0, scale: 0.95 }}
            layout={false}
            onClick={expand}
            className="relative cursor-pointer w-full"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Content Component
interface ExpandableScreenContentProps {
  children: ReactNode;
  className?: string;
  showCloseButton?: boolean;
  closeButtonClassName?: string;
}

export function ExpandableScreenContent({
  children,
  className = '',
  showCloseButton = true,
  closeButtonClassName = '',
}: ExpandableScreenContentProps) {
  const { isExpanded, collapse, layoutId, contentRadius, animationDuration } =
    useExpandableScreen();

  // Use portal to render outside of any parent stacking context
  // This ensures the expanded content always appears on top
  const content = (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animationDuration * 0.8 }}
            onClick={collapse}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
          />
          
          {/* Content */}
          <div 
            className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
            style={{ 
              zIndex: 9999,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 1)',
            }}
          >
            {/* Morphing container with shared layoutId */}
            <motion.div
              layoutId={layoutId}
              transition={{ duration: animationDuration, ease: [0.32, 0.72, 0, 1] }}
              style={{ borderRadius: contentRadius }}
              layout
              className={cn(
                'relative flex max-h-[90vh] w-full max-w-2xl overflow-hidden transform-gpu will-change-transform',
                className
              )}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: animationDuration * 0.5, duration: 0.3 }}
                className="relative z-20 w-full overflow-y-auto"
              >
                {children}
              </motion.div>

              {showCloseButton && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: animationDuration * 0.7 }}
                  onClick={collapse}
                  className={cn(
                    'absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    'bg-white/10 hover:bg-white/20 text-white',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                    closeButtonClassName
                  )}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  // Render via portal to document.body to escape any parent stacking contexts
  return createPortal(content, document.body);
}

export default ExpandableScreen;

