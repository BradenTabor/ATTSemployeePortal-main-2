import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  FloatingPanelRoot,
  FloatingPanelTrigger,
  FloatingPanelContent,
  FloatingPanelBody,
  FloatingPanelFooter,
  FloatingPanelCloseButton,
  FloatingPanelButton,
} from '../ui/FloatingPanel';
import { cn } from '../../lib/utils';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

export interface QuickActionLink {
  label: string;
  description?: string;
  path: string;
  icon?: LucideIcon;
  /** Custom gradient for the icon background */
  iconBg?: string;
  /** Custom icon color */
  iconColor?: string;
}

interface QuickActionsFABProps {
  links: QuickActionLink[];
  className?: string;
}

/**
 * QuickActionsFAB - Floating Action Button for quick navigation
 * 
 * Mobile optimizations:
 * - Accounts for iOS safe-area-insets (notch/home indicator)
 * - Disables pulsing animation on mobile for battery savings
 * - Uses larger touch targets on mobile
 */
function QuickActionsFABComponent({ links, className }: QuickActionsFABProps) {
  const navigate = useNavigate();
  
  // Get device capabilities (cached)
  const caps = useMemo(() => getDeviceCapabilities(), []);

  if (links.length === 0) {
    return null;
  }

  return (
    <FloatingPanelRoot 
      className={cn(
        // Fixed positioning - bottom left with safe area handling
        "fixed z-[9999]",
        // Mobile: account for iOS safe area (home indicator)
        // Using CSS max() to ensure minimum spacing even without safe area
        "left-4",
        // Tablet and up: more breathing room
        "sm:left-6",
        // Large screens
        "lg:left-8",
        className
      )}
      style={{
        // Safe area inset bottom with fallback minimum
        bottom: `max(calc(20px + env(safe-area-inset-bottom, 0px)), 80px)`,
      }}
    >
      {/* FAB Trigger Button - 44px minimum touch target on mobile */}
      <FloatingPanelTrigger
        title="Quick Actions"
        className={cn(
          // Remove default styles
          "!border-0 !bg-transparent !p-0 !h-auto",
          // FAB styling - 56px on mobile (meets 44px minimum), larger on desktop
          "w-14 h-14 md:w-16 md:h-16 rounded-full",
          "flex items-center justify-center",
          // Premium emerald gradient
          "bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700",
          // Glow effect
          "shadow-[0_0_30px_rgba(16,185,129,0.5)]",
          "hover:shadow-[0_0_40px_rgba(16,185,129,0.7)]",
          // Border accent
          "ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-[#04150f]",
          // Transitions
          "transition-all duration-300"
        )}
      >
        {/* Icon animation - disabled on mobile to save battery */}
        {caps.isMobile || caps.prefersReducedMotion ? (
          <div className="relative">
            <Zap className="w-6 h-6 md:w-7 md:h-7 text-white" fill="currentColor" />
          </div>
        ) : (
          <motion.div
            className="relative"
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Zap className="w-6 h-6 md:w-7 md:h-7 text-white" fill="currentColor" />
          </motion.div>
        )}
        
        {/* Pulsing ring animation - only on desktop */}
        {!caps.isMobile && !caps.prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: 'rgba(7, 207, 84, 0.6)' }}
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        )}
      </FloatingPanelTrigger>

      {/* Floating Panel Content */}
      <FloatingPanelContent className="w-[300px] md:w-[340px]">
        <FloatingPanelBody className="p-3 md:p-4 space-y-2">
          {links.map((link, index) => {
            const Icon = link.icon;
            return (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 + 0.1 }}
              >
                <FloatingPanelButton
                  onClick={() => navigate(link.path)}
                  className="group"
                >
                  {/* Icon container */}
                  {Icon && (
                    <div
                      className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
                        'transition-all duration-200 group-hover:scale-105',
                        link.iconBg || 'bg-emerald-500/15 border border-emerald-500/30'
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5',
                          link.iconColor || 'text-emerald-300'
                        )}
                      />
                    </div>
                  )}

                  {/* Label and description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-emerald-100 transition-colors truncate">
                      {link.label}
                    </p>
                    {link.description && (
                      <p className="text-xs text-white/50 truncate mt-0.5">
                        {link.description}
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <ChevronRight
                    className="w-4 h-4 text-white/30 group-hover:text-emerald-300 group-hover:translate-x-1 transition-all flex-shrink-0"
                    aria-hidden="true"
                  />
                </FloatingPanelButton>
              </motion.div>
            );
          })}
        </FloatingPanelBody>

        <FloatingPanelFooter>
          <FloatingPanelCloseButton />
          <div className="flex items-center gap-2 text-xs text-emerald-200/50">
            <span>{links.length} action{links.length !== 1 ? 's' : ''}</span>
          </div>
        </FloatingPanelFooter>
      </FloatingPanelContent>
    </FloatingPanelRoot>
  );
}

export const QuickActionsFAB = memo(QuickActionsFABComponent);
export default QuickActionsFAB;
