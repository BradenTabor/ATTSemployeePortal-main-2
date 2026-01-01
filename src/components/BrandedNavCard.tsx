import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { ReactNode, useMemo, useState } from "react";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { ChevronRight } from "lucide-react";

type CardVariant = "emerald" | "gold" | "ember" | "purple" | "redwhite" | "bluewhite";

interface BrandedNavCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  to: string;
  variant?: CardVariant;
  /** Mark as coming soon - disables link and shows badge */
  comingSoon?: boolean;
}

// Premium gradient styles with enhanced icon treatment
const VARIANT_STYLES = {
  emerald: {
    // Outer wrapper gradient border
    outer: "bg-gradient-to-br from-green-600/70 via-black/80 to-green-800/80",
    outerHover: "hover:from-green-500 hover:via-black hover:to-green-700",
    // Inner card gradient background
    innerStyle: {
      background: "linear-gradient(90deg, rgba(0, 0, 0, 0.7) 0%, rgba(11, 132, 92, 1) 50%, rgba(12, 39, 19, 1) 100%)",
    },
    innerBorder: "border-[rgba(11,132,92,0.3)]",
    // Premium icon styling
    iconGradient: "from-emerald-500/30 via-emerald-400/20 to-emerald-600/30",
    iconBorderGradient: "from-emerald-400/60 via-emerald-500/40 to-emerald-400/60",
    iconGlow: "shadow-[0_0_20px_rgba(16,185,129,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)]",
    iconGlowHover: "group-hover:shadow-[0_0_25px_rgba(16,185,129,0.5),inset_0_1px_2px_rgba(255,255,255,0.15)]",
    iconColor: "text-emerald-300",
    iconColorHover: "group-hover:text-emerald-200",
    // Text colors
    title: "text-white",
    description: "text-white/80",
    // Effects
    glow: "group-hover:shadow-[0_0_35px_rgba(16,185,129,0.2)]",
    shimmer: "from-green-400/0 via-green-400/40 to-green-400/0",
    accent: "bg-gradient-to-r from-green-400 to-green-600",
    arrow: "text-green-400/50",
  },
  gold: {
    outer: "bg-gradient-to-br from-[#f9e7c4]/20 via-[#0b0a07] to-[#1b150e]",
    outerHover: "hover:border-[#f6dcb2]/60 hover:shadow-[0_25px_50px_rgba(0,0,0,0.6)]",
    innerStyle: {
      background: "linear-gradient(51.63deg, rgba(0, 0, 0, 1) 5%, rgba(147, 98, 6, 1) 11.25%, rgba(84, 55, 3, 1) 17.5%, rgba(104, 69, 3, 1) 30%, rgba(147, 98, 6, 1) 42%, rgba(189, 126, 10, 1) 54%, rgba(234, 216, 123, 1) 66.5%, rgba(244, 159, 1, 1) 79%, rgba(245, 245, 245, 1) 90%, rgba(251, 190, 75, 1) 100%)",
    },
    innerBorder: "border-[#f6dcb2]/25",
    // Premium icon styling
    iconGradient: "from-amber-500/30 via-yellow-400/25 to-amber-600/30",
    iconBorderGradient: "from-amber-300/70 via-yellow-400/50 to-amber-400/70",
    iconGlow: "shadow-[0_0_20px_rgba(251,191,36,0.25),inset_0_1px_1px_rgba(255,255,255,0.15)]",
    iconGlowHover: "group-hover:shadow-[0_0_28px_rgba(251,191,36,0.45),inset_0_1px_2px_rgba(255,255,255,0.2)]",
    iconColor: "text-amber-300",
    iconColorHover: "group-hover:text-amber-200",
    title: "text-[#fff6dd]",
    description: "text-[#f8e5bb]/80",
    glow: "group-hover:shadow-[0_0_35px_rgba(244,201,121,0.15)]",
    shimmer: "from-amber-400/0 via-amber-400/35 to-amber-400/0",
    accent: "bg-gradient-to-r from-[#f4c979] to-[#d4a84a]",
    arrow: "text-[#f4c979]/50",
  },
  ember: {
    outer: "bg-gradient-to-br from-[#341109]/80 via-[#120504] to-[#050201]",
    outerHover: "hover:border-[#ffb089]/60 hover:shadow-[0_25px_45px_rgba(0,0,0,0.65)]",
    innerStyle: {
      background: "linear-gradient(36.85deg, rgba(0, 0, 0, 1) 0%, rgba(71, 28, 6, 1) 12.5%, rgba(101, 39, 6, 1) 25%, rgba(137, 53, 11, 1) 37.5%, rgba(158, 59, 5, 1) 50%, rgba(228, 84, 7, 1) 62.5%, rgba(255, 129, 61, 1) 75%, rgba(255, 209, 184, 1) 100%)",
    },
    innerBorder: "border-[#f38d57]/35",
    // Premium icon styling
    iconGradient: "from-orange-500/30 via-orange-400/25 to-red-500/30",
    iconBorderGradient: "from-orange-400/70 via-orange-500/50 to-red-400/70",
    iconGlow: "shadow-[0_0_20px_rgba(249,115,22,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)]",
    iconGlowHover: "group-hover:shadow-[0_0_28px_rgba(249,115,22,0.5),inset_0_1px_2px_rgba(255,255,255,0.15)]",
    iconColor: "text-orange-300",
    iconColorHover: "group-hover:text-orange-200",
    title: "text-[#ffe4c9]",
    description: "text-[#ffd4b8]/80",
    glow: "group-hover:shadow-[0_0_35px_rgba(255,143,87,0.15)]",
    shimmer: "from-orange-400/0 via-orange-400/35 to-orange-400/0",
    accent: "bg-gradient-to-r from-[#ff9350] to-[#e85a07]",
    arrow: "text-[#ff9d5f]/50",
  },
  purple: {
    outer: "bg-gradient-to-br from-[#2d1b4e]/80 via-[#1a0f2e] to-[#0a0513]",
    outerHover: "hover:border-[#c084fc]/60 hover:shadow-[0_25px_45px_rgba(0,0,0,0.65)]",
    innerStyle: {
      background: "linear-gradient(90deg, rgba(10, 5, 19, 0.9) 0%, rgba(45, 27, 78, 1) 50%, rgba(26, 15, 46, 1) 100%)",
    },
    innerBorder: "border-[#c084fc]/35",
    // Premium icon styling
    iconGradient: "from-purple-500/30 via-purple-400/25 to-violet-500/30",
    iconBorderGradient: "from-purple-400/70 via-purple-500/50 to-violet-400/70",
    iconGlow: "shadow-[0_0_20px_rgba(192,132,252,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)]",
    iconGlowHover: "group-hover:shadow-[0_0_28px_rgba(192,132,252,0.5),inset_0_1px_2px_rgba(255,255,255,0.15)]",
    iconColor: "text-purple-300",
    iconColorHover: "group-hover:text-purple-200",
    title: "text-[#f3e8ff]",
    description: "text-[#e9d5ff]/80",
    glow: "group-hover:shadow-[0_0_35px_rgba(192,132,252,0.2)]",
    shimmer: "from-purple-400/0 via-purple-400/35 to-purple-400/0",
    accent: "bg-gradient-to-r from-[#c084fc] to-[#9333ea]",
    arrow: "text-[#c084fc]/50",
  },
  redwhite: {
    outer: "bg-gradient-to-br from-[#450a0a]/80 via-[#1c0a0a] to-[#0a0202]",
    outerHover: "hover:border-[#fecaca]/60 hover:shadow-[0_25px_45px_rgba(0,0,0,0.65)]",
    innerStyle: {
      background: "linear-gradient(90deg, rgba(10, 2, 2, 0.9) 0%, rgba(69, 10, 10, 1) 50%, rgba(28, 10, 10, 1) 100%)",
    },
    innerBorder: "border-[#fecaca]/35",
    // Premium icon styling
    iconGradient: "from-red-500/30 via-red-400/25 to-rose-500/30",
    iconBorderGradient: "from-red-400/70 via-red-300/50 to-rose-400/70",
    iconGlow: "shadow-[0_0_20px_rgba(254,202,202,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)]",
    iconGlowHover: "group-hover:shadow-[0_0_28px_rgba(254,202,202,0.5),inset_0_1px_2px_rgba(255,255,255,0.15)]",
    iconColor: "text-red-200",
    iconColorHover: "group-hover:text-red-100",
    title: "text-[#fef2f2]",
    description: "text-[#fecaca]/85",
    glow: "group-hover:shadow-[0_0_35px_rgba(254,202,202,0.2)]",
    shimmer: "from-red-300/0 via-red-300/35 to-red-300/0",
    accent: "bg-gradient-to-r from-[#fecaca] to-[#dc2626]",
    arrow: "text-[#fecaca]/50",
  },
  bluewhite: {
    outer: "bg-gradient-to-br from-[#0a1628]/80 via-[#0a1020] to-[#020408]",
    outerHover: "hover:border-[#bfdbfe]/60 hover:shadow-[0_25px_45px_rgba(0,0,0,0.65)]",
    innerStyle: {
      background: "linear-gradient(90deg, rgba(2, 4, 8, 0.9) 0%, rgba(30, 64, 175, 1) 50%, rgba(15, 23, 42, 1) 100%)",
    },
    innerBorder: "border-[#bfdbfe]/35",
    // Premium icon styling
    iconGradient: "from-blue-500/30 via-blue-400/25 to-sky-500/30",
    iconBorderGradient: "from-blue-400/70 via-blue-300/50 to-sky-400/70",
    iconGlow: "shadow-[0_0_20px_rgba(191,219,254,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)]",
    iconGlowHover: "group-hover:shadow-[0_0_28px_rgba(191,219,254,0.5),inset_0_1px_2px_rgba(255,255,255,0.15)]",
    iconColor: "text-blue-200",
    iconColorHover: "group-hover:text-blue-100",
    title: "text-[#f0f9ff]",
    description: "text-[#bfdbfe]/85",
    glow: "group-hover:shadow-[0_0_35px_rgba(191,219,254,0.2)]",
    shimmer: "from-blue-300/0 via-blue-300/35 to-blue-300/0",
    accent: "bg-gradient-to-r from-[#bfdbfe] to-[#2563eb]",
    arrow: "text-[#bfdbfe]/50",
  },
};

/**
 * BrandedNavCard - Compact navigation card with original premium styling
 * 
 * Features:
 * - Original gradient colors and styling restored
 * - Compact horizontal layout
 * - Premium hover animations (shimmer, glow, accent line)
 * - Mobile-optimized touch states
 */
export default function BrandedNavCard({
  title,
  description,
  icon,
  to,
  variant = "emerald",
  comingSoon = false,
}: BrandedNavCardProps) {
  const selected = VARIANT_STYLES[variant] ?? VARIANT_STYLES.emerald;
  const [isHovered, setIsHovered] = useState(false);
  
  // Get device capabilities (cached)
  const caps = useMemo(() => getDeviceCapabilities(), []);
  
  const canAnimate = !caps.prefersReducedMotion;
  const canHover = !caps.isMobile && canAnimate && !comingSoon;
  const isMobile = caps.isMobile;

  // Common event handlers
  const mouseHandlers = {
    onMouseEnter: () => canHover && setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  };

  // Render content
  const cardContent = (
    <>
      <motion.div
        className="group relative"
        whileHover={canHover ? { y: -3, scale: 1.02 } : undefined}
        whileTap={canAnimate ? { scale: 0.97 } : undefined}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* Coming Soon Badge */}
        {comingSoon && (
          <div className="absolute -top-1 -right-1 z-20">
            <div className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
              "bg-gradient-to-r from-slate-800/95 to-slate-900/95",
              "border border-slate-500/40",
              "text-slate-300 shadow-lg",
              "backdrop-blur-sm"
            )}>
              Coming Soon
            </div>
          </div>
        )}

        {/* Outer wrapper with gradient border - RESTORED ORIGINAL STYLING */}
        <div
          className={cn(
            "relative w-full p-[2px] rounded-2xl overflow-hidden shadow-lg transition-all duration-300 ease-out",
            selected.outer,
            !comingSoon && selected.outerHover,
            !comingSoon && selected.glow,
            comingSoon && "opacity-50 grayscale-[30%]",
            isMobile && !comingSoon && "active:scale-[0.98] active:opacity-95"
          )}
        >
          {/* Animated shimmer overlay - desktop only */}
          {!caps.isLowEnd && !isMobile && (
            <motion.div
              className={cn(
                "absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                selected.shimmer
              )}
              animate={isHovered ? {
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              } : {}}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "linear"
              }}
              style={{
                backgroundSize: "200% 100%",
              }}
            />
          )}
          
          {/* Inner card with gradient background - RESTORED ORIGINAL STYLING */}
          <div
            className={cn(
              "relative h-full w-full rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4",
              "flex items-center gap-3.5",
              "min-h-[60px]", // Touch target
              "border transition-all duration-300",
              selected.innerBorder,
              !caps.isLowEnd && "backdrop-blur-xl"
            )}
            style={selected.innerStyle}
          >
            {/* Premium Icon Container */}
            {icon && (
              <motion.div
                className="flex-shrink-0 relative"
                animate={isHovered && canHover ? { 
                  y: -3,
                  scale: 1.1,
                } : { 
                  y: 0,
                  scale: 1 
                }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                {/* Outer glow ring */}
                <div className={cn(
                  "absolute -inset-0.5 rounded-xl bg-gradient-to-br opacity-60 blur-[2px] transition-opacity duration-300",
                  "group-hover:opacity-100",
                  selected.iconBorderGradient
                )} />
                
                {/* Icon container with gradient background */}
                <div
                  className={cn(
                    "relative flex items-center justify-center",
                    "w-11 h-11 sm:w-12 sm:h-12",
                    "rounded-xl transition-all duration-300",
                    "bg-gradient-to-br",
                    selected.iconGradient,
                    selected.iconGlow,
                    selected.iconGlowHover
                  )}
                >
                  {/* Inner border highlight */}
                  <div className={cn(
                    "absolute inset-[1px] rounded-[10px] bg-gradient-to-br opacity-50",
                    selected.iconGradient
                  )} />
                  
                  {/* Icon */}
                  <div className={cn(
                    "relative z-10 w-5 h-5 sm:w-6 sm:h-6 transition-colors duration-300",
                    "[&>svg]:w-full [&>svg]:h-full [&>svg]:drop-shadow-[0_0_3px_currentColor]",
                    selected.iconColor,
                    selected.iconColorHover
                  )}>
                    {icon}
                  </div>
                </div>
              </motion.div>
            )}
            
            {/* Text content */}
            <div className="flex-1 min-w-0">
              <h3
                className={cn(
                  "text-sm sm:text-base font-semibold tracking-wide truncate",
                  selected.title
                )}
              >
                {title}
              </h3>
              {description && (
                <p className={cn(
                  "text-xs sm:text-sm mt-0.5 line-clamp-1 sm:line-clamp-2 opacity-90",
                  selected.description
                )}>
                  {description}
                </p>
              )}
            </div>
            
            {/* Arrow indicator */}
            <motion.div
              className={cn(
                "flex-shrink-0 transition-all duration-300",
                isMobile ? selected.arrow : cn(
                  "opacity-30 group-hover:opacity-100",
                  selected.iconColor,
                  selected.iconColorHover
                )
              )}
              animate={isHovered && canHover ? { x: 4 } : { x: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <ChevronRight 
                className="w-5 h-5 drop-shadow-[0_0_4px_currentColor]" 
                strokeWidth={2.5} 
              />
            </motion.div>
          </div>
          
          {/* Bottom accent line on hover - desktop */}
          {!isMobile && (
            <motion.div
              className={cn(
                "absolute bottom-0 left-0 h-[2px] rounded-full",
                selected.accent
              )}
              initial={{ width: "0%" }}
              animate={isHovered ? { width: "100%" } : { width: "0%" }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          )}
        </div>
      </motion.div>
    </>
  );

  // Render with appropriate wrapper
  if (comingSoon) {
    return (
      <div 
        className="block touch-manipulation cursor-not-allowed"
        {...mouseHandlers}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link 
      to={to} 
      className="block touch-manipulation"
      {...mouseHandlers}
    >
      {cardContent}
    </Link>
  );
}
