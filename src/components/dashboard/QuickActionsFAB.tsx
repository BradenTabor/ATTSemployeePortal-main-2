import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ChevronRight } from 'lucide-react';
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
 * QuickActionsFAB - Premium Floating Action Button for quick navigation
 * 
 * Features:
 * - Fixed bottom-left positioning with safe area support
 * - Multi-layered glow effects and premium animations
 * - Mobile optimizations for battery savings
 * - Large touch targets for accessibility
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
        // Fixed positioning - BOTTOM LEFT corner
        "!fixed z-[9999]",
        // Horizontal positioning
        "left-5 sm:left-6 lg:left-8",
        // Vertical positioning - bottom of viewport
        "bottom-6 sm:bottom-8",
        className
      )}
    >
      {/* Premium FAB Trigger Button */}
      <FloatingPanelTrigger
        title="Quick Actions"
        className={cn(
          // Reset default styles completely
          "!border-0 !bg-transparent !p-0 !h-auto !min-h-0",
          // Premium sizing - larger for better visibility
          "w-16 h-16 md:w-[72px] md:h-[72px] rounded-2xl",
          "flex items-center justify-center",
          // Luxurious emerald gradient with depth
          "bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700",
          // Premium shadow layers for depth
          "shadow-[0_8px_32px_rgba(16,185,129,0.4),0_0_60px_rgba(16,185,129,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]",
          // Hover glow enhancement
          "hover:shadow-[0_12px_40px_rgba(16,185,129,0.5),0_0_80px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(255,255,255,0.2)]",
          // Premium border with glass effect
          "ring-1 ring-white/20 ring-inset",
          // Outer glow ring
          "outline outline-2 outline-emerald-400/30 outline-offset-2",
          // Smooth transitions
          "transition-all duration-400 ease-out",
          // Hover scale
          "hover:scale-105 active:scale-95"
        )}
      >
        {/* Multi-layer background effects - desktop only */}
        {!caps.isMobile && !caps.prefersReducedMotion && (
          <>
            {/* Outer pulse ring */}
            <motion.div
              className="absolute -inset-3 rounded-3xl opacity-40"
              style={{
                background: 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)',
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.4, 0.1, 0.4],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            {/* Inner glow ring */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{
                boxShadow: '0 0 20px rgba(52,211,153,0.5), inset 0 0 20px rgba(52,211,153,0.1)',
              }}
              animate={{
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}
        
        {/* Icon with animation */}
        {caps.isMobile || caps.prefersReducedMotion ? (
          <div className="relative z-10">
            <Sparkles className="w-7 h-7 md:w-8 md:h-8 text-white drop-shadow-lg" />
          </div>
        ) : (
          <motion.div
            className="relative z-10"
            animate={{
              scale: [1, 1.08, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Sparkles className="w-7 h-7 md:w-8 md:h-8 text-white drop-shadow-lg" />
            {/* Sparkle accent */}
            <motion.div
              className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white"
              animate={{
                scale: [0.8, 1.2, 0.8],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        )}
        
        {/* Floating particles - desktop only */}
        {!caps.isMobile && !caps.prefersReducedMotion && (
          <>
            <motion.div
              className="absolute w-1 h-1 rounded-full bg-emerald-300"
              style={{ top: '20%', left: '15%' }}
              animate={{
                y: [-2, 2, -2],
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.2,
              }}
            />
            <motion.div
              className="absolute w-1.5 h-1.5 rounded-full bg-emerald-200"
              style={{ bottom: '25%', right: '20%' }}
              animate={{
                y: [2, -2, 2],
                opacity: [0.4, 0.9, 0.4],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
            />
          </>
        )}
      </FloatingPanelTrigger>

      {/* Premium Floating Panel Content */}
      <FloatingPanelContent className="w-[320px] md:w-[360px]">
        {/* Header with gradient accent */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Quick Actions</h3>
              <p className="text-xs text-emerald-300/60">Navigate instantly</p>
            </div>
          </div>
        </div>

        <FloatingPanelBody className="p-3 md:p-4 space-y-2">
          {links.map((link, index) => {
            const Icon = link.icon;
            return (
              <motion.div
                key={link.path}
                initial={{ opacity: 0, x: -15, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ 
                  delay: index * 0.06 + 0.1,
                  type: "spring",
                  stiffness: 300,
                  damping: 24
                }}
              >
                <FloatingPanelButton
                  onClick={() => navigate(link.path)}
                  className="group relative overflow-hidden"
                >
                  {/* Hover gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Icon container with enhanced styling */}
                  {Icon && (
                    <div
                      className={cn(
                        'relative flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center',
                        'transition-all duration-300 group-hover:scale-110 group-hover:rotate-3',
                        'shadow-sm group-hover:shadow-md',
                        link.iconBg || 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30'
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5 transition-transform duration-300 group-hover:scale-105',
                          link.iconColor || 'text-emerald-300'
                        )}
                      />
                    </div>
                  )}

                  {/* Label and description with enhanced typography */}
                  <div className="flex-1 min-w-0 relative">
                    <p className="text-sm font-semibold text-white group-hover:text-emerald-100 transition-colors truncate">
                      {link.label}
                    </p>
                    {link.description && (
                      <p className="text-xs text-white/40 group-hover:text-white/60 truncate mt-0.5 transition-colors">
                        {link.description}
                      </p>
                    )}
                  </div>

                  {/* Animated arrow with glow */}
                  <div className="relative flex-shrink-0">
                    <ChevronRight
                      className="w-5 h-5 text-white/20 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all duration-300"
                      aria-hidden="true"
                    />
                    {/* Arrow glow on hover */}
                    <div className="absolute inset-0 blur-sm opacity-0 group-hover:opacity-50 transition-opacity">
                      <ChevronRight
                        className="w-5 h-5 text-emerald-400 translate-x-1"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </FloatingPanelButton>
              </motion.div>
            );
          })}
        </FloatingPanelBody>

        <FloatingPanelFooter>
          <FloatingPanelCloseButton />
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {links.length} action{links.length !== 1 ? 's' : ''}
            </span>
          </div>
        </FloatingPanelFooter>
      </FloatingPanelContent>
    </FloatingPanelRoot>
  );
}

export const QuickActionsFAB = memo(QuickActionsFABComponent);
export default QuickActionsFAB;