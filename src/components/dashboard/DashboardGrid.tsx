/**
 * DashboardGrid Component
 * 
 * Responsive grid wrapper that provides efficient horizontal layouts
 * for dashboard content while maintaining mobile-first design.
 * 
 * UX Philosophy:
 * - Mobile: Single column, vertically stacked
 * - Tablet+: Two-column grid for efficient space usage
 * - Flexible slots for different content combinations
 */

import { memo, ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getDeviceCapabilities } from '../../lib/mobilePerf';

// ============================================================================
// THEME CONFIGURATION
// ============================================================================

export type DashboardCardTheme = 'emerald' | 'blue';

interface CardThemeConfig {
  default: {
    bg: string;
    border: string;
    hoverBorder: string;
    hoverBg: string;
  };
  elevated: {
    gradient: string;
    border: string;
    shadow: string;
    hoverShadow: string;
    hoverBorder: string;
  };
  glass: {
    bg: string;
    border: string;
    shadow: string;
    hoverBg: string;
    hoverBorder: string;
  };
}

const cardThemeConfig: Record<DashboardCardTheme, CardThemeConfig> = {
  emerald: {
    default: {
      bg: 'bg-[#041b14]/80',
      border: 'border-white/[0.08]',
      hoverBorder: 'hover:border-emerald-500/30',
      hoverBg: 'hover:bg-[#052a1d]/80',
    },
    elevated: {
      gradient: 'bg-gradient-to-br from-[#062a1d]/95 via-[#041e15]/90 to-[#03150f]/95',
      border: 'border-emerald-500/30',
      shadow: 'shadow-lg shadow-emerald-900/20',
      hoverShadow: 'hover:shadow-emerald-500/20',
      hoverBorder: 'hover:border-emerald-400/50',
    },
    glass: {
      bg: 'bg-white/[0.03]',
      border: 'border-white/[0.12]',
      shadow: 'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
      hoverBg: 'hover:bg-white/[0.06]',
      hoverBorder: 'hover:border-white/20',
    },
  },
  blue: {
    default: {
      bg: 'bg-[#041420]/80',
      border: 'border-white/[0.08]',
      hoverBorder: 'hover:border-blue-500/30',
      hoverBg: 'hover:bg-[#052030]/80',
    },
    elevated: {
      gradient: 'bg-gradient-to-br from-[#062a3d]/95 via-[#041e30]/90 to-[#030f1f]/95',
      border: 'border-blue-500/30',
      shadow: 'shadow-lg shadow-blue-900/20',
      hoverShadow: 'hover:shadow-blue-500/20',
      hoverBorder: 'hover:border-blue-400/50',
    },
    glass: {
      bg: 'bg-white/[0.03]',
      border: 'border-white/[0.12]',
      shadow: 'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
      hoverBg: 'hover:bg-white/[0.06]',
      hoverBorder: 'hover:border-white/20',
    },
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface DashboardGridProps {
  /** Content for the left/primary column */
  primary: ReactNode;
  /** Content for the right/secondary column */
  secondary: ReactNode;
  /** Whether to reverse column order on desktop (secondary first) */
  reverseOnDesktop?: boolean;
  /** Gap between columns - 'sm' | 'md' | 'lg' */
  gap?: 'sm' | 'md' | 'lg';
  /** Whether the primary column should be wider */
  primaryWider?: boolean;
  /** Additional className for the grid container */
  className?: string;
}

interface DashboardSectionProps {
  children: ReactNode;
  /** Optional title for the section */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Whether to add inner padding */
  padded?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================================================
// DASHBOARD SECTION COMPONENT
// ============================================================================

export const DashboardSection = memo(function DashboardSection({
  children,
  title,
  subtitle,
  padded = false,
  className = '',
}: DashboardSectionProps) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldAnimate = !caps.prefersReducedMotion;

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 10 } : undefined}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`${padded ? 'p-3 sm:p-4' : ''} ${className}`}
    >
      {(title || subtitle) && (
        <div className="mb-2.5 sm:mb-3">
          {title && (
            <h3 className="text-sm sm:text-base font-bold text-white">{title}</h3>
          )}
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-white/40 mt-0.5">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </motion.div>
  );
});

// ============================================================================
// DASHBOARD GRID COMPONENT
// ============================================================================

function DashboardGridComponent({
  primary,
  secondary,
  reverseOnDesktop = false,
  gap = 'md',
  primaryWider = false,
  className = '',
}: DashboardGridProps) {
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const shouldAnimate = !caps.prefersReducedMotion;

  const gapClass = {
    sm: 'gap-2 sm:gap-3',
    md: 'gap-3 sm:gap-4',
    lg: 'gap-4 sm:gap-5',
  }[gap];

  // Grid column sizing
  const gridCols = primaryWider
    ? 'md:grid-cols-[1.2fr_1fr]'
    : 'md:grid-cols-2';

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0 } : undefined}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`
        grid grid-cols-1 ${gridCols} ${gapClass}
        ${className}
      `}
    >
      {/* Primary content - appears first on mobile */}
      <div className={`${reverseOnDesktop ? 'md:order-2' : 'md:order-1'}`}>
        {primary}
      </div>
      
      {/* Secondary content - appears second on mobile */}
      <div className={`${reverseOnDesktop ? 'md:order-1' : 'md:order-2'}`}>
        {secondary}
      </div>
    </motion.div>
  );
}

export const DashboardGrid = memo(DashboardGridComponent);

// ============================================================================
// DASHBOARD CARD WRAPPER
// ============================================================================

interface DashboardCardProps {
  children: ReactNode;
  /** Visual variant */
  variant?: 'default' | 'elevated' | 'glass';
  /** Additional className */
  className?: string;
  /** Whether card is interactive (adds hover effects) */
  interactive?: boolean;
  /** Color theme - defaults to emerald */
  theme?: DashboardCardTheme;
}

export const DashboardCard = memo(function DashboardCard({
  children,
  variant = 'default',
  className = '',
  interactive = false,
  theme = 'emerald',
}: DashboardCardProps) {
  const baseStyles = 'rounded-2xl sm:rounded-3xl overflow-hidden';
  const themeStyles = cardThemeConfig[theme];
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'elevated':
        return `
          ${themeStyles.elevated.gradient}
          border ${themeStyles.elevated.border} ${themeStyles.elevated.shadow}
          ${interactive ? `${themeStyles.elevated.hoverShadow} ${themeStyles.elevated.hoverBorder} transition-all duration-200` : ''}
        `;
      case 'glass':
        return `
          ${themeStyles.glass.bg} backdrop-blur-xl border ${themeStyles.glass.border}
          ${themeStyles.glass.shadow}
          ${interactive ? `${themeStyles.glass.hoverBg} ${themeStyles.glass.hoverBorder} transition-all duration-200` : ''}
        `;
      default:
        return `
          ${themeStyles.default.bg} border ${themeStyles.default.border}
          ${interactive ? `${themeStyles.default.hoverBorder} ${themeStyles.default.hoverBg} transition-all duration-200` : ''}
        `;
    }
  };

  return (
    <div className={`${baseStyles} ${getVariantStyles()} ${className}`}>
      {children}
    </div>
  );
});

// ============================================================================
// HORIZONTAL SCROLL CONTAINER
// ============================================================================

interface HorizontalScrollProps {
  children: ReactNode;
  /** Gap between items */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
  /** Whether to show scroll hints on edges */
  showScrollHints?: boolean;
}

export const HorizontalScroll = memo(function HorizontalScroll({
  children,
  gap = 'md',
  className = '',
  showScrollHints = false,
}: HorizontalScrollProps) {
  const gapClass = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
  }[gap];

  return (
    <div className={`relative ${className}`}>
      {/* Scroll container */}
      <div 
        className={`
          flex ${gapClass} overflow-x-auto pb-2
          scrollbar-hide scroll-smooth snap-x snap-mandatory
          -mx-3 px-3 sm:-mx-4 sm:px-4
        `}
      >
        {children}
      </div>
      
      {/* Scroll hints (gradient fades on edges) */}
      {showScrollHints && (
        <>
          <div className="absolute left-0 top-0 bottom-2 w-4 bg-gradient-to-r from-[#041b14] to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-2 w-4 bg-gradient-to-l from-[#041b14] to-transparent pointer-events-none" />
        </>
      )}
    </div>
  );
});

// ============================================================================
// STACKED LAYOUT (VERTICAL WITH SPACING)
// ============================================================================

interface StackedLayoutProps {
  children: ReactNode;
  /** Gap between items */
  gap?: 'xs' | 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
}

export const StackedLayout = memo(function StackedLayout({
  children,
  gap = 'md',
  className = '',
}: StackedLayoutProps) {
  const gapClass = {
    xs: 'space-y-1.5',
    sm: 'space-y-2 sm:space-y-2.5',
    md: 'space-y-3 sm:space-y-4',
    lg: 'space-y-4 sm:space-y-5 md:space-y-6',
  }[gap];

  return (
    <div className={`${gapClass} ${className}`}>
      {children}
    </div>
  );
});

export default DashboardGrid;
