import { memo, useCallback, useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

export interface SegmentTab {
  id: string;
  label: string;
  icon: ReactNode;
  /** Short label for mobile view */
  shortLabel?: string;
}

interface AdminSegmentedControlProps {
  tabs: SegmentTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  /** Storage key for localStorage persistence */
  storageKey?: string;
}

// Animation spring config for the sliding indicator
const indicatorSpring = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 35,
  mass: 1,
};

const indicatorSpringReduced = {
  duration: 0.1,
};

function AdminSegmentedControlComponent({
  tabs,
  activeTab,
  onChange,
  className,
}: AdminSegmentedControlProps) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  // Use null to indicate "not yet measured" - avoids needing a separate hydration state
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(null);
  
  // Get device capabilities for animation decisions
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldAnimate = !prefersReducedMotion && !caps.isLowEnd;

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
    }
  }, [activeTab, tabs]);

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
        // Focus the new tab button
        const newButton = containerRef.current?.querySelector(
          `[data-tab-id="${tabs[newIndex].id}"]`
        ) as HTMLButtonElement | null;
        newButton?.focus();
      }
    },
    [tabs, onChange]
  );

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Dashboard sections"
      className={cn(
        'relative inline-flex items-center rounded-2xl p-1.5',
        // Glass morphism background
        'bg-[#0c0a08]/80 backdrop-blur-xl',
        // Border with subtle gold glow
        'border border-[#f4c979]/20',
        // Shadow for depth
        'shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
        // Horizontal scroll on mobile
        'overflow-x-auto scrollbar-hide',
        // Full width on mobile, auto on desktop
        'w-full sm:w-auto',
        className
      )}
    >
      {/* Ambient glow overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_50%_0%,rgba(244,201,121,0.08),transparent_60%)]" />
      
      {/* Sliding indicator */}
      {indicatorStyle && indicatorStyle.width > 0 && (
        <motion.div
          className={cn(
            'absolute top-1.5 bottom-1.5 rounded-xl',
            // Gold gradient background
            'bg-gradient-to-br from-[#f7e4bd]/20 via-[#f4c979]/15 to-[#d79a32]/10',
            // Inner border glow
            'border border-[#f4c979]/40',
            // Glow shadow
            'shadow-[0_0_20px_rgba(244,201,121,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
          )}
          initial={false}
          animate={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
          transition={prefersReducedMotion ? indicatorSpringReduced : indicatorSpring}
          style={{ zIndex: 0 }}
        />
      )}

      {/* Tab buttons */}
      <div className="relative z-10 flex items-center gap-1">
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              data-tab-id={tab.id}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'relative flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl',
                'text-sm font-semibold whitespace-nowrap',
                'transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f4c979]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0a08]',
                // Active state
                isActive
                  ? 'text-[#fff6dd]'
                  : 'text-[#f8e5bb]/60 hover:text-[#f8e5bb]/90 hover:bg-white/5'
              )}
            >
              {/* Icon */}
              <span
                className={cn(
                  'flex-shrink-0 transition-colors duration-200',
                  isActive ? 'text-[#f4c979]' : 'text-[#f8e5bb]/50'
                )}
              >
                {tab.icon}
              </span>
              
              {/* Label - full on desktop, short on mobile */}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel || tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Shimmer effect on container hover */}
      {shouldAnimate && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `linear-gradient(
              115deg,
              transparent 20%,
              rgba(247,228,189,0.04) 40%,
              rgba(244,201,121,0.03) 50%,
              rgba(247,228,189,0.04) 60%,
              transparent 80%
            )`,
            backgroundSize: '200% 100%',
            animation: 'segmentShimmer 3s ease-in-out infinite',
          }}
        />
      )}

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes segmentShimmer {
          0%, 100% { background-position: 200% 0; }
          50% { background-position: -200% 0; }
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
          .segment-shimmer {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export const AdminSegmentedControl = memo(AdminSegmentedControlComponent);
export default AdminSegmentedControl;

