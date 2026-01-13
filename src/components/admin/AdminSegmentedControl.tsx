import { memo, useCallback, useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

export interface SegmentTab {
  id: string;
  label: string;
  icon: ReactNode;
  /** Short label for mobile view */
  shortLabel?: string;
  /** Optional badge count to display */
  badgeCount?: number;
  /** Show notification dot instead of count */
  hasNotification?: boolean;
}

interface AdminSegmentedControlProps {
  tabs: SegmentTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  /** Storage key for localStorage persistence */
  storageKey?: string;
  /** Size variant */
  size?: 'default' | 'large';
}

// Animation spring config for the sliding indicator
const indicatorSpring = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
  mass: 1,
};

const indicatorSpringReduced = {
  duration: 0.15,
};

// Badge animation
const badgeVariants = {
  initial: { scale: 0, opacity: 0 },
  animate: { 
    scale: 1, 
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 500, damping: 25 }
  },
  exit: { 
    scale: 0, 
    opacity: 0,
    transition: { duration: 0.15 }
  },
};

function AdminSegmentedControlComponent({
  tabs,
  activeTab,
  onChange,
  className,
  size = 'default',
}: AdminSegmentedControlProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  
  // Get device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldAnimate = !prefersReducedMotion && !caps.isLowEnd;
  const isLarge = size === 'large';

  // Check scroll position for fade indicators
  const checkScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    setCanScrollLeft(container.scrollLeft > 5);
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 5);
  }, []);

  // Update indicator position when active tab changes
  useEffect(() => {
    if (!containerRef.current) return;

    const activeButton = containerRef.current.querySelector(
      `[data-tab-id="${activeTab}"]`
    ) as HTMLButtonElement | null;

    if (activeButton) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
      });

      // Scroll active tab into view on mobile
      if (scrollContainerRef.current) {
        const scrollContainer = scrollContainerRef.current;
        const buttonLeft = activeButton.offsetLeft;
        const buttonWidth = activeButton.offsetWidth;
        const containerWidth = scrollContainer.clientWidth;
        const scrollLeft = scrollContainer.scrollLeft;

        if (buttonLeft < scrollLeft + 20) {
          scrollContainer.scrollTo({ left: Math.max(0, buttonLeft - 20), behavior: 'smooth' });
        } else if (buttonLeft + buttonWidth > scrollLeft + containerWidth - 20) {
          scrollContainer.scrollTo({ 
            left: buttonLeft + buttonWidth - containerWidth + 20, 
            behavior: 'smooth' 
          });
        }
      }
    }

    checkScroll();
  }, [activeTab, tabs, checkScroll]);

  // Add scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();

    return () => container.removeEventListener('scroll', checkScroll);
  }, [checkScroll]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      let newIndex = currentIndex;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1;
      } else if (e.key === 'Home') {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        newIndex = tabs.length - 1;
      }

      if (newIndex !== currentIndex) {
        onChange(tabs[newIndex].id);
        const newButton = containerRef.current?.querySelector(
          `[data-tab-id="${tabs[newIndex].id}"]`
        ) as HTMLButtonElement | null;
        newButton?.focus();
      }
    },
    [tabs, onChange]
  );

  const activeIndex = tabs.findIndex(t => t.id === activeTab);

  return (
    <div className={cn('relative', className)}>
      {/* Scroll fade indicators */}
      <AnimatePresence>
        {canScrollLeft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-0 top-0 bottom-0 w-8 z-20 pointer-events-none bg-gradient-to-r from-[#0c0a08] via-[#0c0a08]/80 to-transparent rounded-l-2xl"
          />
        )}
        {canScrollRight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-0 top-0 bottom-0 w-8 z-20 pointer-events-none bg-gradient-to-l from-[#0c0a08] via-[#0c0a08]/80 to-transparent rounded-r-2xl"
          />
        )}
      </AnimatePresence>

      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide"
      >
        <div
          ref={containerRef}
          role="tablist"
          aria-label="Dashboard sections"
          className={cn(
            'relative inline-flex items-center rounded-2xl',
            isLarge ? 'p-2 gap-1' : 'p-1.5',
            // Glass morphism background
            'bg-[#0c0a08]/90 backdrop-blur-xl',
            // Border with subtle gold glow
            'border border-[#f4c979]/25',
            // Shadow for depth
            'shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]',
            // Min width on mobile to ensure full tabs visible
            'min-w-full sm:min-w-0'
          )}
        >
          {/* Ambient glow overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_0%,rgba(244,201,121,0.1),transparent_60%)]" />
          
          {/* Sliding indicator with glow */}
          {indicatorStyle && indicatorStyle.width > 0 && (
            <motion.div
              className={cn(
                'absolute rounded-xl',
                isLarge ? 'top-2 bottom-2' : 'top-1.5 bottom-1.5',
                // Enhanced gold gradient background
                'bg-gradient-to-br from-[#f7e4bd]/25 via-[#f4c979]/20 to-[#d79a32]/15',
                // Inner border glow
                'border border-[#f4c979]/50',
                // Enhanced glow shadow
                'shadow-[0_0_25px_rgba(244,201,121,0.3),0_0_50px_rgba(244,201,121,0.15),inset_0_1px_0_rgba(255,255,255,0.15)]'
              )}
              initial={false}
              animate={{
                left: indicatorStyle.left,
                width: indicatorStyle.width,
              }}
              transition={prefersReducedMotion ? indicatorSpringReduced : indicatorSpring}
              style={{ zIndex: 0 }}
            >
              {/* Inner shimmer on indicator */}
              {shouldAnimate && (
                <div 
                  className="absolute inset-0 rounded-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'indicatorShimmer 2s ease-in-out infinite',
                  }}
                />
              )}
            </motion.div>
          )}

          {/* Tab buttons */}
          <div className={cn('relative z-10 flex items-center', isLarge ? 'gap-1' : 'gap-0.5')}>
            {tabs.map((tab, index) => {
              const isActive = activeTab === tab.id;
              const isHovered = hoveredTab === tab.id;
              const showBadge = tab.badgeCount && tab.badgeCount > 0;
              const showDot = tab.hasNotification && !showBadge;
              
              // Compute aria attributes to satisfy linter
              const ariaProps = { 'aria-selected': isActive ? 'true' as const : 'false' as const };
              
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  data-tab-id={tab.id}
                  {...ariaProps}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => onChange(tab.id)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-xl',
                    isLarge ? 'px-5 py-3' : 'px-3 sm:px-4 py-2.5',
                    'text-sm font-semibold whitespace-nowrap',
                    'transition-all duration-200',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0a08]',
                    // Active state
                    isActive
                      ? 'text-[#fff6dd]'
                      : 'text-[#f8e5bb]/50 hover:text-[#f8e5bb]/90',
                    // Hover background for inactive tabs
                    !isActive && 'hover:bg-white/5'
                  )}
                >
                  {/* Icon with glow when active */}
                  <span
                    className={cn(
                      'relative flex-shrink-0 transition-all duration-300',
                      isActive 
                        ? 'text-[#f4c979] drop-shadow-[0_0_8px_rgba(244,201,121,0.6)]' 
                        : isHovered 
                          ? 'text-[#f8e5bb]/70' 
                          : 'text-[#f8e5bb]/40'
                    )}
                  >
                    {tab.icon}
                  </span>
                  
                  {/* Label - full on desktop, short on mobile */}
                  <span className={cn(
                    'hidden sm:inline transition-all duration-200',
                    isActive ? 'font-bold' : 'font-semibold'
                  )}>
                    {tab.label}
                  </span>
                  <span className={cn(
                    'sm:hidden transition-all duration-200',
                    isActive ? 'font-bold' : 'font-semibold'
                  )}>
                    {tab.shortLabel || tab.label}
                  </span>

                  {/* Badge count */}
                  <AnimatePresence mode="wait">
                    {showBadge && (
                      <motion.span
                        key={`badge-${tab.id}`}
                        variants={badgeVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className={cn(
                          'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none',
                          isActive
                            ? 'bg-[#f4c979] text-[#2e1b02]'
                            : 'bg-white/10 text-[#f8e5bb]/80'
                        )}
                      >
                        {(tab.badgeCount ?? 0) > 99 ? '99+' : tab.badgeCount}
                      </motion.span>
                    )}
                    {showDot && (
                      <motion.span
                        key={`dot-${tab.id}`}
                        variants={badgeVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#f4c979] shadow-[0_0_8px_rgba(244,201,121,0.8)]"
                      >
                        {shouldAnimate && (
                          <span className="absolute inset-0 rounded-full bg-[#f4c979] animate-ping opacity-75" />
                        )}
                      </motion.span>
                    )}
                  </AnimatePresence>

                  {/* Active underline indicator for extra emphasis */}
                  {isActive && (
                    <motion.span
                      layoutId="activeUnderline"
                      className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#f4c979] to-transparent"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Progress indicator showing position */}
          <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-white/5 overflow-hidden sm:hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#f4c979]/60 to-[#d79a32]/60 rounded-full"
              initial={false}
              animate={{
                width: `${100 / tabs.length}%`,
                x: `${activeIndex * 100}%`,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          </div>
        </div>
      </div>

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes indicatorShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        /* Hide scrollbar but allow scrolling */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        @media (prefers-reduced-motion: reduce) {
          @keyframes indicatorShimmer {
            0%, 100% { background-position: 0 0; }
          }
        }
      `}</style>
    </div>
  );
}

export const AdminSegmentedControl = memo(AdminSegmentedControlComponent);
export default AdminSegmentedControl;
