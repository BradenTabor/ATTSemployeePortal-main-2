/**
 * FloatingActionButton (FAB) Component
 * 
 * A sticky floating action button that appears on scroll,
 * providing quick access to the most common action.
 * 
 * UX Philosophy:
 * - Appears only when useful (after scroll)
 * - Quick access without scrolling back up
 * - Expandable for multiple quick actions
 * - Non-intrusive when not needed
 */

import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  Truck,
  Wrench,
  ClipboardCheck,
  Briefcase,
  ChevronUp,
} from 'lucide-react';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// TYPES
// ============================================================================

interface QuickAction {
  id: string;
  label: string;
  icon: typeof Truck;
  path: string;
  color: string;
  bgColor: string;
}

interface FloatingActionButtonProps {
  /** Scroll threshold before showing FAB */
  scrollThreshold?: number;
  /** Whether to show the scroll-to-top variant */
  showScrollToTop?: boolean;
  /** Primary action override */
  primaryAction?: {
    label: string;
    path: string;
    icon: typeof Plus;
  };
}

// ============================================================================
// QUICK ACTIONS CONFIG
// ============================================================================

const quickActions: QuickAction[] = [
  {
    id: 'dvir',
    label: 'DVIR',
    icon: Truck,
    path: '/dashboard/forms/dvir',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  {
    id: 'equipment',
    label: 'Equipment',
    icon: Wrench,
    path: '/dashboard/forms/equipment-inspection',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
  {
    id: 'jsa',
    label: 'JSA',
    icon: ClipboardCheck,
    path: '/forms/jsa',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: Briefcase,
    path: '/assigned-jobs',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function FloatingActionButtonComponent({
  scrollThreshold = 300,
  showScrollToTop = true,
}: FloatingActionButtonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  const caps = useMemo(() => getDeviceCapabilities(), []);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsVisible(scrollY > scrollThreshold);
      
      // Collapse when scrolling
      if (isExpanded && scrollY > scrollThreshold + 100) {
        setIsExpanded(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollThreshold, isExpanded]);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsExpanded(false);
  }, []);

  // Toggle expanded state
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Navigate to action
  const handleAction = useCallback((path: string) => {
    setIsExpanded(false);
    navigate(path);
  }, [navigate]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.2, type: 'spring', stiffness: 300 }}
          className="fixed bottom-6 right-4 z-50 flex flex-col items-end gap-3"
        >
          {/* Expanded actions menu */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-2 items-end"
              >
                {/* Scroll to top button */}
                {showScrollToTop && (
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                    onClick={scrollToTop}
                    aria-label="Scroll back to top"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 border border-white/20 shadow-lg backdrop-blur-sm hover:bg-white/15 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                  >
                    <span className="text-xs font-medium text-white/80">Back to top</span>
                    <ChevronUp className="w-4 h-4 text-white/60" aria-hidden />
                  </motion.button>
                )}

                {/* Quick action buttons */}
                {quickActions.map((action, index) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (index + 1) * 0.05 }}
                      onClick={() => handleAction(action.path)}
                      aria-label={`Open ${action.label}`}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-full
                        ${action.bgColor} border border-white/10
                        shadow-lg backdrop-blur-sm
                        hover:scale-105 transition-transform
                        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400
                      `}
                    >
                      <span className={`text-xs font-medium ${action.color}`}>{action.label}</span>
                      <Icon className={`w-4 h-4 ${action.color}`} aria-hidden />
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main FAB button */}
          <motion.button
            whileHover={caps.prefersReducedMotion ? undefined : { scale: 1.05 }}
            whileTap={caps.prefersReducedMotion ? undefined : { scale: 0.95 }}
            onClick={toggleExpanded}
            aria-label={isExpanded ? "Close quick actions menu" : "Open quick actions menu"}
            aria-expanded={isExpanded}
            className={`
              relative w-14 h-14 rounded-2xl
              bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700
              shadow-lg shadow-emerald-500/30
              flex items-center justify-center
              border-2 border-emerald-300/30
              transition-transform
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400
            `}
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 rounded-2xl bg-emerald-400/30 blur-md -z-10" />
            
            {/* Icon with rotation */}
            <motion.div
              animate={{ rotate: isExpanded ? 45 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {isExpanded ? (
                <X className="w-6 h-6 text-white" />
              ) : (
                <Plus className="w-6 h-6 text-white" />
              )}
            </motion.div>

            {/* Pulse animation when collapsed */}
            {!isExpanded && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-emerald-400/20"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const FloatingActionButton = memo(FloatingActionButtonComponent);
export default FloatingActionButton;
