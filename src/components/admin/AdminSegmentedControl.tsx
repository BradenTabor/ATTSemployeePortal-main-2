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

// Tab button press animation
const tabButtonVariants = {
  tap: { scale: 0.97 },
  hover: { scale: 1.02 },
};

// Breakpoint for switching between wrapped and inline layouts
const MOBILE_BREAKPOINT = 900;

function AdminSegmentedControlComponent({
  tabs,
  activeTab,
  onChange,
  className,
  size = 'default',
}: AdminSegmentedControlProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number; top: number; height: number } | null>(null);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(true); // Default to mobile for SSR safety
  
  // Get device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldAnimate = !prefersReducedMotion && !caps.isLowEnd;
  const isLarge = size === 'large';

  // Check if we're in mobile/wrapped layout using window width
  useEffect(() => {
    const checkLayout = () => {
      // Wrap on mobile and tablet to ensure all tabs fit without cutoff
      // Desktop (900px+) shows horizontal row with sliding indicator
      setIsMobileLayout(window.innerWidth < MOBILE_BREAKPOINT);
    };

    checkLayout();
    
    window.addEventListener('resize', checkLayout, { passive: true });
    
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  // Update indicator position when active tab changes (only for desktop)
  useEffect(() => {
    if (!containerRef.current || isMobileLayout) return;

    const activeButton = containerRef.current.querySelector(
      `[data-tab-id="${activeTab}"]`
    ) as HTMLButtonElement | null;

    if (activeButton) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
        top: buttonRect.top - containerRect.top,
        height: buttonRect.height,
      });
    }
  }, [activeTab, tabs, isMobileLayout]);

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

  return (
    <div className={cn('relative w-full', className)}>
      <div
        ref={containerRef}
        role="tablist"
        aria-label="Dashboard sections"
        className={cn(
          'relative',
          isLarge ? 'p-2 gap-2' : 'p-1.5',
          // Glass morphism background
          'bg-[#0c0a08]/90 backdrop-blur-xl',
          // Border with subtle gold glow
          'border border-[#f4c979]/25',
          // Rounded corners
          'rounded-2xl',
          // Shadow for depth
          'shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]',
          // Layout based on JS state
          isMobileLayout
            ? 'flex flex-wrap items-center justify-center gap-1.5'
            : 'inline-flex flex-nowrap items-center justify-start gap-1'
        )}
      >
        {/* Ambient glow overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_0%,rgba(244,201,121,0.1),transparent_60%)]" />
        
        {/* Sliding indicator with glow - only on desktop/non-wrapped layout */}
        {!isMobileLayout && indicatorStyle && indicatorStyle.width > 0 && (
          <motion.div
            className={cn(
              'absolute rounded-xl pointer-events-none',
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
              top: indicatorStyle.top,
              width: indicatorStyle.width,
              height: indicatorStyle.height,
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
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          const isHovered = hoveredTab === tab.id;
          const showBadge = tab.badgeCount && tab.badgeCount > 0;
          const showDot = tab.hasNotification && !showBadge;
          
          // Compute aria attributes to satisfy linter
          const ariaProps = { 'aria-selected': isActive ? 'true' as const : 'false' as const };
          
          return (
            <motion.button
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
              variants={tabButtonVariants}
              whileHover={shouldAnimate ? "hover" : undefined}
              whileTap={shouldAnimate ? "tap" : undefined}
              className={cn(
                'relative flex items-center justify-center rounded-xl',
                // Gap and layout based on mode
                isMobileLayout ? 'gap-1.5' : 'gap-2',
                // Mobile: equal sizing with flex for 2x2 grid
                isMobileLayout 
                  ? 'flex-1 min-w-[calc(50%-0.375rem)]' 
                  : 'flex-initial',
                // Padding based on size and mode
                isLarge 
                  ? (isMobileLayout ? 'px-3 py-2 sm:px-4 sm:py-2.5' : 'px-5 py-3')
                  : (isMobileLayout ? 'px-2.5 py-1.5 sm:px-3 sm:py-2' : 'px-4 py-2.5'),
                // Text sizing based on mode
                isMobileLayout ? 'text-xs' : 'text-sm',
                'font-semibold',
                'transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0a08]',
                // Touch target minimum
                'min-h-[44px]',
                // Active state styling differs between mobile/tablet and desktop
                isMobileLayout
                  ? isActive
                    ? 'bg-gradient-to-br from-[#f7e4bd]/25 via-[#f4c979]/20 to-[#d79a32]/15 border border-[#f4c979]/50 text-[#fff6dd] shadow-[0_0_20px_rgba(244,201,121,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]'
                    : 'border border-transparent text-[#f8e5bb]/50 hover:text-[#f8e5bb]/90 hover:bg-white/5 active:bg-white/10'
                  : isActive
                    ? 'text-[#fff6dd]'
                    : 'text-[#f8e5bb]/50 hover:text-[#f8e5bb]/90 hover:bg-white/5',
                // Ensure proper z-index for active state
                'z-10'
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
              
              {/* Label - short label on mobile/tablet, full on desktop */}
              <span className={cn(
                'transition-all duration-200 whitespace-nowrap',
                isActive ? 'font-bold' : 'font-semibold',
                // Responsive text sizing
                isMobileLayout ? 'text-[11px]' : 'text-sm'
              )}>
                {isMobileLayout ? (tab.shortLabel || tab.label) : tab.label}
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
                      'px-1.5 py-0.5 rounded-full font-bold leading-none',
                      isMobileLayout ? 'ml-0.5 text-[9px]' : 'ml-1 text-[10px]',
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
                    className={cn(
                      'absolute -top-0.5 -right-0.5 rounded-full bg-[#f4c979] shadow-[0_0_8px_rgba(244,201,121,0.8)]',
                      isMobileLayout ? 'w-2 h-2' : 'w-2.5 h-2.5'
                    )}
                  >
                    {shouldAnimate && (
                      <span className="absolute inset-0 rounded-full bg-[#f4c979] animate-ping opacity-75" />
                    )}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Active glow effect for mobile layout */}
              {isMobileLayout && isActive && shouldAnimate && (
                <motion.div
                  className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.08) 50%, transparent 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'indicatorShimmer 2.5s ease-in-out infinite',
                    }}
                  />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes indicatorShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
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
