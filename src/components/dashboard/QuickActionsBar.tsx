/**
 * QuickActionsBar Component
 * 
 * A premium animated carousel with smooth auto-rotation.
 * High-polish animations with 3D effects and glowing hover states.
 * 
 * UX Philosophy:
 * - Continuous smooth motion draws attention
 * - Pause on hover for easy selection
 * - High contrast for instant readability
 * - Touch-friendly with momentum scrolling
 */

import { memo, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Truck,
  Wrench,
  ClipboardCheck,
  Briefcase,
  FileText,
  Check,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// TYPES
// ============================================================================

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Truck;
  path: string;
  gradient: string;
  glowColor: string;
  borderColor: string;
  iconBg: string;
  textColor: string;
  shadowColor: string;
  roles?: string[];
}

interface QuickActionsBarProps {
  dvirComplete?: boolean;
  equipmentComplete?: boolean;
  jsaComplete?: boolean;
  activeJobsCount?: number;
}

// ============================================================================
// QUICK ACTIONS CONFIG - Premium gradients with glows
// ============================================================================

const quickActions: QuickAction[] = [
  {
    id: 'dvir',
    label: 'DVIR',
    icon: Truck,
    path: '/dashboard/forms/dvir',
    gradient: 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)',
    glowColor: 'rgba(16, 185, 129, 0.6)',
    borderColor: 'rgba(52, 211, 153, 0.5)',
    iconBg: 'rgba(52, 211, 153, 0.25)',
    textColor: '#d1fae5',
    shadowColor: 'rgba(16, 185, 129, 0.4)',
  },
  {
    id: 'equipment',
    label: 'Equipment',
    icon: Wrench,
    path: '/dashboard/forms/equipment-inspection',
    gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 50%, #92400e 100%)',
    glowColor: 'rgba(251, 191, 36, 0.6)',
    borderColor: 'rgba(251, 191, 36, 0.5)',
    iconBg: 'rgba(251, 191, 36, 0.25)',
    textColor: '#fef3c7',
    shadowColor: 'rgba(251, 191, 36, 0.4)',
  },
  {
    id: 'jsa',
    label: 'JSA',
    icon: ClipboardCheck,
    path: '/forms/jsa',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)',
    glowColor: 'rgba(96, 165, 250, 0.6)',
    borderColor: 'rgba(96, 165, 250, 0.5)',
    iconBg: 'rgba(96, 165, 250, 0.25)',
    textColor: '#dbeafe',
    shadowColor: 'rgba(96, 165, 250, 0.4)',
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: Briefcase,
    path: '/assigned-jobs',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)',
    glowColor: 'rgba(167, 139, 250, 0.6)',
    borderColor: 'rgba(167, 139, 250, 0.5)',
    iconBg: 'rgba(167, 139, 250, 0.25)',
    textColor: '#ede9fe',
    shadowColor: 'rgba(167, 139, 250, 0.4)',
  },
  {
    id: 'forms',
    label: 'All Forms',
    icon: FileText,
    path: '/forms',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)',
    glowColor: 'rgba(34, 211, 238, 0.6)',
    borderColor: 'rgba(34, 211, 238, 0.5)',
    iconBg: 'rgba(34, 211, 238, 0.25)',
    textColor: '#cffafe',
    shadowColor: 'rgba(34, 211, 238, 0.4)',
  },
];

// ============================================================================
// ANIMATED QUICK ACTION CARD
// ============================================================================

interface QuickActionCardProps {
  action: QuickAction;
  isComplete?: boolean;
  badge?: number;
  index: number;
  isHovered: boolean;
  onHover: (hovered: boolean) => void;
  shouldReduceMotion: boolean;
}

const QuickActionCard = memo(function QuickActionCard({
  action,
  isComplete,
  badge,
  index,
  isHovered,
  onHover,
  shouldReduceMotion,
}: QuickActionCardProps) {
  const Icon = action.icon;
  const [isPressed, setIsPressed] = useState(false);

  // Hover animation with 3D tilt
  const hoverVariants: Variants = {
    idle: {
      scale: 1,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      boxShadow: `0 4px 20px -5px ${action.shadowColor}`,
    },
    hover: {
      scale: 1.08,
      y: -6,
      rotateX: 5,
      rotateY: -5,
      boxShadow: `0 20px 40px -10px ${action.shadowColor}, 0 0 30px ${action.glowColor}`,
      transition: {
        type: 'spring' as const,
        stiffness: 400,
        damping: 25,
      }
    },
    tap: {
      scale: 0.95,
      y: 0,
    }
  };

  // Shimmer animation
  const shimmerVariants: Variants = {
    initial: { x: '-100%', opacity: 0 },
    animate: { 
      x: '200%', 
      opacity: [0, 1, 0],
      transition: {
        duration: 1.5,
        ease: 'easeInOut' as const,
        repeat: Infinity,
        repeatDelay: 3,
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        x: 0, 
        scale: 1,
        y: shouldReduceMotion ? 0 : [0, -4, 0, 3, 0],
      }}
      transition={{
        opacity: { duration: 0.4, delay: index * 0.08 },
        x: { type: 'spring', stiffness: 100, damping: 15, delay: index * 0.08 },
        scale: { type: 'spring', stiffness: 100, damping: 15, delay: index * 0.08 },
        y: {
          duration: 2.8 + (index * 0.5),
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.3 + (index * 0.4),
        }
      }}
      className="flex-shrink-0"
      style={{ perspective: '1000px' }}
    >
      <Link to={action.path}>
        <motion.div
          variants={shouldReduceMotion ? undefined : hoverVariants}
          initial="idle"
          animate={isPressed ? 'tap' : isHovered ? 'hover' : 'idle'}
          onHoverStart={() => onHover(true)}
          onHoverEnd={() => onHover(false)}
          onTapStart={() => setIsPressed(true)}
          onTap={() => setIsPressed(false)}
          onTapCancel={() => setIsPressed(false)}
          className="relative flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl cursor-pointer overflow-hidden"
          style={{ 
            background: action.gradient,
            border: `1px solid ${action.borderColor}`,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Animated background glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{
              background: isHovered 
                ? `radial-gradient(circle at 50% 50%, ${action.glowColor} 0%, transparent 70%)`
                : 'transparent',
            }}
            transition={{ duration: 0.3 }}
          />

          {/* Top shine reflection */}
          <div 
            className="absolute inset-x-0 top-0 h-1/2 pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
              borderRadius: 'inherit',
            }}
          />

          {/* Animated shimmer */}
          {!shouldReduceMotion && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                width: '50%',
              }}
              variants={shimmerVariants}
              initial="initial"
              animate="animate"
            />
          )}

          {/* Icon container with glow */}
          <motion.div 
            className="relative w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center"
            style={{ backgroundColor: action.iconBg }}
            animate={{
              boxShadow: isHovered ? `0 0 20px ${action.glowColor}` : 'none',
            }}
            transition={{ duration: 0.3 }}
          >
            <Icon 
              className="w-4 h-4 sm:w-5 sm:h-5" 
              style={{ color: action.textColor }}
            />
            
            {/* Completion checkmark */}
            <AnimatePresence>
              {isComplete && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-400 flex items-center justify-center shadow-md sm:shadow-lg"
                  style={{ boxShadow: '0 0 8px rgba(52, 211, 153, 0.8)' }}
                >
                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-900" strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Count badge */}
            <AnimatePresence>
              {badge !== undefined && badge > 0 && !isComplete && (
                <motion.div
                  initial={{ scale: 0, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0, y: -10 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[16px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 rounded-full bg-white flex items-center justify-center shadow-md sm:shadow-lg"
                >
                  <span className="text-[10px] sm:text-xs font-bold text-gray-900 leading-none">
                    {badge > 9 ? '9+' : badge}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          {/* Label with subtle animation */}
          <motion.span 
            className="text-xs sm:text-sm font-bold whitespace-nowrap relative z-10"
            style={{ color: action.textColor }}
            animate={{
              textShadow: isHovered ? `0 0 10px ${action.glowColor}` : 'none',
            }}
          >
            {action.label}
          </motion.span>

          {/* Sparkle effect on hover */}
          <AnimatePresence>
            {isHovered && !shouldReduceMotion && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                className="absolute top-1 right-2"
              >
                <Sparkles className="w-3 h-3 text-white/60" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </Link>
    </motion.div>
  );
});

// ============================================================================
// MAIN COMPONENT WITH AUTO-SCROLL CAROUSEL
// ============================================================================

function QuickActionsBarComponent({
  dvirComplete = false,
  equipmentComplete = false,
  jsaComplete = false,
  activeJobsCount = 0,
}: QuickActionsBarProps) {
  const { role } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isUserHovering, setIsUserHovering] = useState(false);
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const isAutoScrolling = true; // Auto-scrolling is always enabled
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion;
  const animationRef = useRef<number | null>(null);
  const scrollSpeedRef = useRef(1.2); // pixels per frame - faster for visible motion
  const lastTimeRef = useRef(0);
  const scrollDirectionRef = useRef<'right' | 'left'>('right');

  // Filter actions based on role
  const filteredActions = useMemo(() => {
    return quickActions.filter(action => {
      if (!action.roles) return true;
      return action.roles.includes(role || '');
    });
  }, [role]);

  // Check scroll capabilities
  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  }, []);

  // Start/stop auto-scroll
  useEffect(() => {
    // Define the auto-scroll function inside useEffect to avoid ref assignment during render
    const autoScroll = (timestamp: number) => {
      if (!scrollRef.current) {
        animationRef.current = requestAnimationFrame(autoScroll);
        return;
      }

      // Pause scrolling when user is hovering or reduced motion is preferred
      if (isUserHovering || shouldReduceMotion) {
        animationRef.current = requestAnimationFrame(autoScroll);
        return;
      }

      // Throttle to ~60fps
      if (timestamp - lastTimeRef.current < 16) {
        animationRef.current = requestAnimationFrame(autoScroll);
        return;
      }
      lastTimeRef.current = timestamp;

      const el = scrollRef.current;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const maxScroll = scrollWidth - clientWidth;

      // Only scroll if there's content to scroll
      if (maxScroll <= 0) {
        animationRef.current = requestAnimationFrame(autoScroll);
        return;
      }

      // Ping-pong scroll direction for smooth continuous motion
      if (scrollDirectionRef.current === 'right') {
        if (scrollLeft >= maxScroll - 2) {
          scrollDirectionRef.current = 'left';
        } else {
          el.scrollLeft += scrollSpeedRef.current;
        }
      } else {
        if (scrollLeft <= 2) {
          scrollDirectionRef.current = 'right';
        } else {
          el.scrollLeft -= scrollSpeedRef.current;
        }
      }

      checkScroll();
      animationRef.current = requestAnimationFrame(autoScroll);
    };

    if (isAutoScrolling && !shouldReduceMotion) {
      animationRef.current = requestAnimationFrame(autoScroll);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAutoScrolling, isUserHovering, shouldReduceMotion, checkScroll]);

  // Initial setup
  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll, { passive: true });
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [filteredActions, checkScroll]);

  // Manual scroll
  // Handle hover state
  const handleContainerHover = useCallback((hovering: boolean) => {
    setIsUserHovering(hovering);
  }, []);

  const handleCardHover = useCallback((index: number, hovering: boolean) => {
    setHoveredCardIndex(hovering ? index : null);
    setIsUserHovering(hovering);
  }, []);

  // Get completion/badge status
  const getActionStatus = useCallback((actionId: string) => {
    switch (actionId) {
      case 'dvir':
        return { isComplete: dvirComplete };
      case 'equipment':
        return { isComplete: equipmentComplete };
      case 'jsa':
        return { isComplete: jsaComplete };
      case 'jobs':
        return { badge: activeJobsCount };
      default:
        return {};
    }
  }, [dvirComplete, equipmentComplete, jsaComplete, activeJobsCount]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
      onMouseEnter={() => handleContainerHover(true)}
      onMouseLeave={() => handleContainerHover(false)}
    >
      {/* Decorative glow behind carousel */}
      <div 
        className="absolute inset-0 -z-10 blur-3xl opacity-30 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.3) 0%, rgba(96, 165, 250, 0.3) 50%, rgba(167, 139, 250, 0.3) 100%)',
        }}
      />

      {/* Navigation arrows - desktop only */}
      {/* Gradient fade masks */}
      <motion.div 
        className="absolute left-0 top-0 bottom-0 w-12 pointer-events-none z-10"
        style={{ background: 'linear-gradient(270deg, rgba(4, 30, 21, 1) 0%, rgba(4, 30, 21, 0.8) 0%, rgba(0, 0, 0, 0) 0%)' }}
        animate={{ opacity: canScrollLeft ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div 
        className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none z-10 rounded-[10px]"
        style={{ background: 'linear-gradient(270deg, rgba(4, 30, 21, 1) 0%, rgba(4, 30, 21, 0.8) 0%, rgba(0, 0, 0, 0) 0%)' }}
        animate={{ opacity: canScrollRight ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Scrollable carousel container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-2 sm:py-3 px-1 sm:px-2 scrollbar-hide rounded-[20px]"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
        }}
      >
        {filteredActions.map((action, index) => {
          const status = getActionStatus(action.id);
          return (
            <QuickActionCard
              key={action.id}
              action={action}
              index={index}
              isComplete={status.isComplete}
              badge={status.badge}
              isHovered={hoveredCardIndex === index}
              onHover={(hovering) => handleCardHover(index, hovering)}
              shouldReduceMotion={shouldReduceMotion}
            />
          );
        })}
      </div>

      {/* Auto-scroll indicator - animated dots showing motion */}
      {!shouldReduceMotion && isAutoScrolling && !isUserHovering && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 py-1"
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ 
              x: [0, 6, 0, -6, 0],
              scale: [1, 1.2, 1, 1.2, 1],
              opacity: [0.6, 1, 0.6, 1, 0.6] 
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ 
              x: [0, 6, 0, -6, 0],
              scale: [1, 1.2, 1, 1.2, 1],
              opacity: [0.6, 1, 0.6, 1, 0.6] 
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
          />
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
            animate={{ 
              x: [0, 6, 0, -6, 0],
              scale: [1, 1.2, 1, 1.2, 1],
              opacity: [0.6, 1, 0.6, 1, 0.6] 
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

export const QuickActionsBar = memo(QuickActionsBarComponent);
export default QuickActionsBar;
