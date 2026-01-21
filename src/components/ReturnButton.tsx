/**
 * ReturnButton - Sticky Floating Navigation
 * 
 * A beautiful, non-intrusive floating button that provides quick navigation
 * back to the user's role-specific dashboard. Features smooth, premium animations.
 */

import { memo, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ArrowLeft, Home } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getDeviceCapabilities } from "../lib/mobilePerf";

// Smooth spring config for natural feel
const smoothSpring = {
  type: "spring" as const,
  stiffness: 200,
  damping: 25,
  mass: 0.8,
};

// Gentle spring for subtle movements
const gentleSpring = {
  type: "spring" as const,
  stiffness: 150,
  damping: 20,
  mass: 0.5,
};

// Button container variants
const containerVariants: Variants = {
  hidden: { 
    opacity: 0, 
    y: 30,
    scale: 0.8,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      ...smoothSpring,
      delay: 0.8,
    },
  },
};

// Glow animation variants
const glowVariants: Variants = {
  idle: {
    scale: 1,
    opacity: 0.3,
  },
  hover: {
    scale: 1.8,
    opacity: 0.6,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Button hover variants
const buttonVariants: Variants = {
  idle: {
    scale: 1,
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(52, 211, 153, 0.2)",
  },
  hover: {
    scale: 1.03,
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4), 0 0 30px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(52, 211, 153, 0.4)",
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  tap: {
    scale: 0.97,
    transition: {
      duration: 0.1,
    },
  },
};

// Arrow icon variants
const arrowVariants: Variants = {
  idle: {
    x: 0,
    rotate: 0,
  },
  hover: {
    x: -3,
    rotate: -15,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Label variants removed - not currently used

// Home icon variants
const homeIconVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.5,
    x: -8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    x: 0,
    transition: {
      delay: 0.1,
      duration: 0.25,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    x: -8,
    transition: {
      duration: 0.15,
    },
  },
};

// Tooltip variants
const tooltipVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 8,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.5,
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.95,
    transition: {
      duration: 0.1,
    },
  },
};

// Shimmer effect variants
const shimmerVariants: Variants = {
  idle: {
    x: "-100%",
    opacity: 0,
  },
  hover: {
    x: "200%",
    opacity: [0, 1, 0],
    transition: {
      duration: 0.8,
      ease: "easeInOut",
    },
  },
};

function ReturnButtonComponent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldReduceMotion = caps.prefersReducedMotion;
  const isMobile = caps.isMobile;

  const isAdmin = role === "admin";
  const isGeneralForeman = role === "general_foreman";
  const isSafetyOfficer = role === "safety_officer";
  const isForeman = role === "foreman";
  const isMechanic = role === "mechanic";
  const path = location.pathname;

  // Pages with their own bottom navigation that would conflict with ReturnButton
  // Only JSA has its own wizard navigation that conflicts
  const pagesWithBottomNav = useMemo(() => [
    '/forms/jsa',
  ], []);

  // Check if current page has its own bottom navigation
  const hasConflictingNav = useMemo(() => {
    return pagesWithBottomNav.some(page => path.startsWith(page));
  }, [path, pagesWithBottomNav]);

  // Determine navigation target and labels
  const { label, shortLabel, target } = useMemo(() => {
    let label = "";
    let shortLabel = "";
    let target = "";

    if (isGeneralForeman) {
      if (path !== "/general-foreman-dashboard" && path !== "/") {
        label = "General Foreman Dashboard";
        shortLabel = "Dashboard";
        target = "/general-foreman-dashboard";
      }
    } else if (isSafetyOfficer) {
      if (path !== "/safety-officer-dashboard" && path !== "/") {
        label = "Safety Officer Dashboard";
        shortLabel = "Dashboard";
        target = "/safety-officer-dashboard";
      }
    } else if (isMechanic) {
      if (path !== "/mechanic-dashboard" && path !== "/") {
        label = "Mechanic Dashboard";
        shortLabel = "Dashboard";
        target = "/mechanic-dashboard";
      }
    } else if (isForeman) {
      if (path !== "/foreman-dashboard" && path !== "/") {
        label = "Foreman Dashboard";
        shortLabel = "Dashboard";
        target = "/foreman-dashboard";
      }
    } else if (isAdmin) {
      if (path.startsWith("/admin") && path !== "/admin") {
        label = "Admin Dashboard";
        shortLabel = "Admin";
        target = "/admin";
      } else if (path === "/admin") {
        label = "General Dashboard";
        shortLabel = "Dashboard";
        target = "/dashboard";
      } else if (path.startsWith("/") && path !== "/dashboard" && path !== "/") {
        label = "Dashboard";
        shortLabel = "Dashboard";
        target = "/dashboard";
      }
    } else {
      if (path.startsWith("/") && path !== "/dashboard" && path !== "/") {
        label = "Dashboard";
        shortLabel = "Dashboard";
        target = "/dashboard";
      }
    }

    return { label, shortLabel, target };
  }, [isAdmin, isGeneralForeman, isSafetyOfficer, isMechanic, isForeman, path]);

  // Don't render if no navigation target OR if page has its own bottom navigation
  if (!label || hasConflictingNav) return null;

  // On mobile: first tap expands, second tap navigates
  // On desktop: click navigates immediately
  const handleClick = () => {
    if (isMobile && !isExpanded) {
      setIsExpanded(true);
      // Auto-collapse after 3 seconds
      setTimeout(() => setIsExpanded(false), 3000);
    } else {
      navigate(target);
    }
  };

  // For mobile: show expanded state when tapped, compact by default
  // For desktop: show based on hover state
  const showExpanded = isMobile ? isExpanded : isHovered;

  return (
    <motion.div
      className="fixed bottom-4 left-4 z-50 sm:bottom-6 sm:left-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Ambient glow behind button - reduced on mobile */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.5) 0%, rgba(16, 185, 129, 0.2) 40%, transparent 70%)',
          filter: isMobile ? 'blur(8px)' : 'blur(16px)',
        }}
        variants={shouldReduceMotion ? undefined : glowVariants}
        initial="idle"
        animate={showExpanded ? "hover" : "idle"}
      />

      {/* Secondary pulsing glow - disabled on mobile for performance */}
      {!isMobile && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(52, 211, 153, 0.3) 0%, transparent 60%)',
            filter: 'blur(20px)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      <motion.button
        onClick={handleClick}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        onFocus={() => !isMobile && setIsHovered(true)}
        onBlur={() => !isMobile && setIsHovered(false)}
        className="relative flex items-center overflow-hidden rounded-full border border-emerald-400/30 backdrop-blur-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        style={{
          background: 'linear-gradient(145deg, rgba(6, 35, 25, 0.95) 0%, rgba(3, 20, 14, 0.98) 50%, rgba(2, 12, 8, 0.99) 100%)',
        }}
        variants={shouldReduceMotion ? undefined : buttonVariants}
        initial="idle"
        animate={showExpanded ? "hover" : "idle"}
        whileTap={shouldReduceMotion ? undefined : "tap"}
        aria-label={isMobile && !isExpanded ? 'Tap to show navigation' : `Return to ${label}`}
      >
        {/* Inner gradient overlay */}
        <div 
          className="absolute inset-0 rounded-full pointer-events-none opacity-0 transition-opacity duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.1) 0%, transparent 50%, rgba(16, 185, 129, 0.05) 100%)',
            opacity: showExpanded ? 1 : 0,
          }}
        />
        
        {/* Top edge highlight */}
        <div className="absolute top-0 left-2 right-2 sm:left-3 sm:right-3 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

        {/* Shimmer effect on hover - desktop only */}
        {!isMobile && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
              width: '50%',
            }}
            variants={shouldReduceMotion ? undefined : shimmerVariants}
            initial="idle"
            animate={showExpanded ? "hover" : "idle"}
          />
        )}

        {/* Button content - compact on mobile, full on desktop */}
        <motion.div
          className={`relative flex items-center ${
            isMobile && !isExpanded 
              ? 'px-3 py-2.5' 
              : 'gap-2 px-3.5 py-2.5 sm:gap-2.5 sm:px-5 sm:py-3.5'
          }`}
          layout
          transition={gentleSpring}
        >
          {/* Arrow icon with smooth animation */}
          <motion.div
            className="flex-shrink-0 flex items-center justify-center"
            variants={shouldReduceMotion ? undefined : arrowVariants}
            initial="idle"
            animate={showExpanded ? "hover" : "idle"}
          >
            <ArrowLeft className={`${isMobile && !isExpanded ? 'w-4 h-4' : 'w-4 h-4 sm:w-[18px] sm:h-[18px]'} text-emerald-300`} />
          </motion.div>

          {/* Label - hidden on mobile when collapsed */}
          <AnimatePresence mode="wait">
            {(!isMobile || isExpanded) && (
              <motion.div
                className="flex items-center gap-2 overflow-hidden"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={gentleSpring}
              >
                <motion.span
                  key={showExpanded ? "expanded" : "collapsed"}
                  className="text-xs sm:text-sm font-semibold text-emerald-100 whitespace-nowrap"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{
                    duration: 0.2,
                    ease: "easeOut",
                  }}
                >
                  {showExpanded ? label : shortLabel}
                </motion.span>

                {/* Home icon with smooth appearance - only on desktop hover */}
                {!isMobile && (
                  <AnimatePresence mode="wait">
                    {isHovered && (
                      <motion.div
                        className="flex-shrink-0"
                        variants={homeIconVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                      >
                        <Home className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-emerald-400/80" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Animated border glow */}
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: '1px solid transparent',
            background: 'linear-gradient(90deg, rgba(52, 211, 153, 0) 0%, rgba(52, 211, 153, 0.5) 50%, rgba(52, 211, 153, 0) 100%) border-box',
            WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
          animate={{
            opacity: showExpanded ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
        />
      </motion.button>

      {/* Tooltip - desktop only */}
      <AnimatePresence>
        {!isMobile && isHovered && !shouldReduceMotion && (
          <motion.div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 rounded-lg bg-gray-900/95 border border-emerald-500/20 text-xs text-emerald-100/90 whitespace-nowrap pointer-events-none backdrop-blur-sm shadow-lg"
            variants={tooltipVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <span className="relative z-10">Click to return</span>
            {/* Tooltip arrow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900/95 border-r border-b border-emerald-500/20" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile hint - shows briefly when collapsed */}
      <AnimatePresence>
        {isMobile && isExpanded && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-emerald-900/90 border border-emerald-500/30 text-[10px] text-emerald-200 whitespace-nowrap pointer-events-none"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
          >
            Tap again to go
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(ReturnButtonComponent);
