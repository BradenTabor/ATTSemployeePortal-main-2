import { ReactNode, useMemo } from "react";
import BrandedNavCard from "../BrandedNavCard";
import { cn } from "../../lib/utils";
import { GlowEffect } from "../ui/GlowEffect";
import { TextEffect } from "../ui/TextEffect";
import { getDeviceCapabilities, getQualitySettings } from "../../lib/mobilePerf";

export type AdminHeroBadge = {
  label: string;
  icon?: ReactNode;
  variant?: "solid" | "outline";
};

export type AdminHeroConfig = {
  eyebrow?: string;
  eyebrowIcon?: ReactNode;
  heading: string;
  description?: string;
  badges?: AdminHeroBadge[];
  /** Optional avatar component to display in the hero section */
  avatar?: ReactNode;
};

export type AdminStat = {
  label: string;
  value: string;
  hint?: string;
};

export type AdminNavCardConfig = {
  title: string;
  description?: string;
  icon?: ReactNode;
  to: string;
  variant?: "emerald" | "gold" | "ember" | "purple" | "redwhite" | "bluewhite";
  /** Mark as coming soon - disables link and shows badge */
  comingSoon?: boolean;
  /** When true, icon is an image (no background, larger size) */
  iconAsImage?: boolean;
};

type AdminTheme = "gold" | "ember" | "emerald" | "purple" | "redwhite" | "bluewhite";

interface AdminPremiumScaffoldProps {
  hero: AdminHeroConfig;
  stats?: AdminStat[];
  navCards?: AdminNavCardConfig[];
  children?: ReactNode;
  theme?: AdminTheme;
  /** Optional side panel content */
  sidePanel?: ReactNode;
  /** Enable compact mode for mobile-optimized header */
  compact?: boolean;
}

const BADGE_STYLES: Record<AdminTheme, Record<string, string>> = {
  gold: {
    solid:
      "inline-flex items-center space-x-2 px-4 py-2 bg-black/40 rounded-full border border-[#f7dca8]/40 text-sm text-[#fff5da]",
    outline:
      "inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-[#fef3d1]/30 text-sm text-[#f8e4bb] bg-[#fef3d1]/10",
  },
  ember: {
    solid:
      "inline-flex items-center space-x-2 px-4 py-2 bg-black/40 rounded-full border border-amber-400/40 text-sm text-amber-100",
    outline:
      "inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-amber-400/30 text-sm text-amber-200 bg-amber-500/10",
  },
  emerald: {
    solid:
      "inline-flex items-center space-x-2 px-3 py-1.5 bg-emerald-500/15 rounded-xl border border-emerald-400/30 text-xs text-emerald-100",
    outline:
      "inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-emerald-400/25 text-xs text-emerald-200/90 bg-emerald-500/10",
  },
  purple: {
    solid:
      "inline-flex items-center space-x-2 px-4 py-2 bg-[#2d1b4e]/60 rounded-full border border-[#c084fc]/40 text-sm text-[#e9d5ff]",
    outline:
      "inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-[#c084fc]/30 text-sm text-[#e9d5ff] bg-[#c084fc]/10",
  },
  redwhite: {
    solid:
      "inline-flex items-center space-x-2 px-4 py-2 bg-[#450a0a]/60 rounded-full border border-[#fecaca]/40 text-sm text-[#fef2f2]",
    outline:
      "inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-[#fecaca]/30 text-sm text-[#fef2f2] bg-[#fecaca]/10",
  },
  bluewhite: {
    solid:
      "inline-flex items-center space-x-2 px-4 py-2 bg-[#0a1628]/60 rounded-full border border-[#bfdbfe]/40 text-sm text-[#f0f9ff]",
    outline:
      "inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-[#bfdbfe]/30 text-sm text-[#f0f9ff] bg-[#bfdbfe]/10",
  },
};

const THEME_STYLES: Record<
  AdminTheme,
  {
    mainContainer: string;
    heroContainer: string;
    heroOverlayPrimary: string;
    heroOverlaySecondary: string;
    eyebrowClass: string;
    descriptionClass: string;
    statsCard: string;
    statsOverlay: string;
    statsGlow: string;
    statsLabel: string;
    statsValue: string;
    statsHint: string;
    navVariant: "emerald" | "gold" | "ember" | "purple" | "redwhite" | "bluewhite";
    glowColors: string[];
    shimmerColor: string;
    shimmerColorAlt: string;
    borderGlowColor: string;
    headingGradient: string;
    headingTextGlow: string;
  }
> = {
  gold: {
    mainContainer: "",
    heroContainer:
      "relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c1c1f] via-[#262224] to-[#0f0d09] border border-[#f4dab1]/20 shadow-[0_25px_60px_rgba(0,0,0,0.65)] p-8",
    heroOverlayPrimary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,238,197,0.4),transparent_55%)] opacity-80",
    heroOverlaySecondary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(209,152,57,0.25),transparent_45%)]",
    eyebrowClass:
      "text-[#f7e7c3] uppercase text-[0.65rem] tracking-[0.35em] mb-2 flex items-center gap-2",
    descriptionClass: "text-[#fdf4db]/80 mt-2 max-w-2xl",
    statsCard:
      "relative overflow-hidden rounded-2xl border border-[#f6dcb2]/15 bg-[#0c0a08]/70 px-5 py-4 shadow-[0_15px_35px_rgba(0,0,0,0.55)] transition hover:border-[#f6dcb2]/35",
    statsOverlay:
      "pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-70",
    statsGlow:
      "pointer-events-none absolute right-4 top-3 h-10 w-10 rounded-full bg-[#f5d38f]/15 blur-2xl",
    statsLabel:
      "text-[0.6rem] uppercase tracking-[0.35em] text-[#f2d7a2]/70",
    statsValue: "text-3xl font-black text-[#fff6dd] tracking-wide",
    statsHint: "text-xs text-[#f8e5bb]/70",
    navVariant: "gold",
    glowColors: ["#f7e4bd", "#f4c979", "#d79a32", "#fef3d1"],
    shimmerColor: "rgba(247,228,189,0.08)",
    shimmerColorAlt: "rgba(244,201,121,0.05)",
    borderGlowColor: "rgba(247,228,189,0.15)",
    headingGradient: "bg-gradient-to-r from-[#fff6dd] via-[#f4c979] to-[#fff6dd]",
    headingTextGlow: "drop-shadow-[0_0_25px_rgba(247,228,189,0.5)]",
  },
  ember: {
    mainContainer: "rounded-3xl border-[3px] border-[#d17000]/90 bg-[#675628] shadow-[0px_4px_25px_8px_rgba(0,0,0,0.86),inset_0px_4px_15px_6px_rgba(0,0,0,0.85)]",
    heroContainer:
      "relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2b120b] via-[#1a0b07] to-[#080403] border border-[#f6b78f]/25 shadow-[0_25px_60px_rgba(0,0,0,0.65)] p-8",
    heroOverlayPrimary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,173,120,0.4),transparent_55%)] opacity-80",
    heroOverlaySecondary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,111,60,0.25),transparent_45%)]",
    eyebrowClass:
      "text-[#ffd8b1] uppercase text-[0.65rem] tracking-[0.35em] mb-2 flex items-center gap-2",
    descriptionClass: "text-[#ffe6d2]/80 mt-2 max-w-2xl",
    statsCard:
      "relative overflow-hidden rounded-2xl border border-[#f28b53]/30 bg-[#180905]/85 px-5 py-4 shadow-[0_15px_35px_rgba(0,0,0,0.6)] transition hover:border-[#f28b53]/50",
    statsOverlay:
      "pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-60",
    statsGlow:
      "pointer-events-none absolute right-4 top-3 h-10 w-10 rounded-full bg-[#f96f3b]/20 blur-2xl",
    statsLabel:
      "text-[0.6rem] uppercase tracking-[0.35em] text-[#ffbe94]/80",
    statsValue: "text-3xl font-black text-[#ffe7d0] tracking-wide",
    statsHint: "text-xs text-[#ffd7bc]/80",
    navVariant: "ember",
    glowColors: ["#f6b78f", "#ff6f3c", "#ffa366", "#ff9350"],
    shimmerColor: "rgba(246,183,143,0.08)",
    shimmerColorAlt: "rgba(255,111,60,0.05)",
    borderGlowColor: "rgba(246,183,143,0.15)",
    headingGradient: "bg-gradient-to-r from-[#ffe7d0] via-[#ff9350] to-[#ffe7d0]",
    headingTextGlow: "drop-shadow-[0_0_25px_rgba(255,147,80,0.5)]",
  },
  emerald: {
    mainContainer: "",
    heroContainer:
      "relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#08241b] via-[#04140e] to-[#010805] border border-[#7de1b4]/25 shadow-[0_25px_60px_rgba(0,0,0,0.6)] p-8",
    heroOverlayPrimary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(125,225,180,0.35),transparent_55%)] opacity-80",
    heroOverlaySecondary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.25),transparent_45%)]",
    eyebrowClass:
      "text-[#b2ffe4] uppercase text-[0.65rem] tracking-[0.35em] mb-2 flex items-center gap-2",
    descriptionClass: "text-[#d7ffef]/85 mt-2 max-w-2xl",
    statsCard:
      "relative overflow-hidden rounded-2xl border border-[#5bdba8]/35 bg-[#04120d]/85 px-5 py-4 shadow-[0_15px_35px_rgba(0,0,0,0.55)] transition hover:border-[#5bdba8]/60",
    statsOverlay:
      "pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-60",
    statsGlow:
      "pointer-events-none absolute right-4 top-3 h-10 w-10 rounded-full bg-[#37c58a]/25 blur-2xl",
    statsLabel:
      "text-[0.6rem] uppercase tracking-[0.35em] text-[#9cf6d2]/80",
    statsValue: "text-3xl font-black text-[#e5fff6] tracking-wide",
    statsHint: "text-xs text-[#c5ffe6]/75",
    navVariant: "emerald",
    glowColors: ["#7de1b4", "#10b981", "#34d399", "#059669"],
    shimmerColor: "rgba(125,225,180,0.06)",
    shimmerColorAlt: "rgba(16,185,129,0.04)",
    borderGlowColor: "rgba(125,225,180,0.12)",
    headingGradient: "bg-gradient-to-r from-[#e5fff6] via-[#7de1b4] to-[#e5fff6]",
    headingTextGlow: "drop-shadow-[0_0_25px_rgba(125,225,180,0.5)]",
  },
  purple: {
    mainContainer: "",
    heroContainer:
      "relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2d1b4e] via-[#1a0f2e] to-[#0a0513] border border-[#c084fc]/20 shadow-[0_25px_60px_rgba(0,0,0,0.65)] p-8",
    heroOverlayPrimary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(192,132,252,0.3),transparent_55%)] opacity-70",
    heroOverlaySecondary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(147,51,234,0.2),transparent_50%)]",
    eyebrowClass:
      "text-[#e9d5ff] uppercase text-[0.65rem] tracking-[0.35em] mb-2 flex items-center gap-2",
    descriptionClass: "text-[#f3e8ff]/80 mt-2 max-w-2xl",
    statsCard:
      "relative overflow-hidden rounded-2xl border border-[#c084fc]/25 bg-[#2d1b4e]/60 px-5 py-4 shadow-[0_15px_35px_rgba(0,0,0,0.55)] transition hover:border-[#c084fc]/50",
    statsOverlay:
      "pointer-events-none absolute inset-0 bg-gradient-to-br from-[#c084fc]/10 to-transparent opacity-60",
    statsGlow:
      "pointer-events-none absolute right-4 top-3 h-10 w-10 rounded-full bg-[#9333ea]/25 blur-2xl",
    statsLabel:
      "text-[0.6rem] uppercase tracking-[0.35em] text-[#e9d5ff]/70",
    statsValue: "text-3xl font-black text-white tracking-wide",
    statsHint: "text-xs text-[#c084fc]/60",
    navVariant: "emerald",
    glowColors: ["#c084fc", "#9333ea", "#a855f7", "#7c3aed"],
    shimmerColor: "rgba(192,132,252,0.06)",
    shimmerColorAlt: "rgba(147,51,234,0.04)",
    borderGlowColor: "rgba(192,132,252,0.12)",
    headingGradient: "bg-gradient-to-r from-[#f3e8ff] via-[#c084fc] to-[#f3e8ff]",
    headingTextGlow: "drop-shadow-[0_0_25px_rgba(192,132,252,0.5)]",
  },
  redwhite: {
    mainContainer: "",
    heroContainer:
      "relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#450a0a] via-[#1c0a0a] to-[#0a0202] border border-[#fecaca]/25 shadow-[0_25px_60px_rgba(0,0,0,0.65)] p-8",
    heroOverlayPrimary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(254,202,202,0.3),transparent_55%)] opacity-70",
    heroOverlaySecondary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(220,38,38,0.2),transparent_50%)]",
    eyebrowClass:
      "text-[#fef2f2] uppercase text-[0.65rem] tracking-[0.35em] mb-2 flex items-center gap-2",
    descriptionClass: "text-[#fef2f2]/85 mt-2 max-w-2xl",
    statsCard:
      "relative overflow-hidden rounded-2xl border border-[#fecaca]/30 bg-[#450a0a]/60 px-5 py-4 shadow-[0_15px_35px_rgba(0,0,0,0.55)] transition hover:border-[#fecaca]/55",
    statsOverlay:
      "pointer-events-none absolute inset-0 bg-gradient-to-br from-[#fecaca]/12 to-transparent opacity-60",
    statsGlow:
      "pointer-events-none absolute right-4 top-3 h-10 w-10 rounded-full bg-[#dc2626]/25 blur-2xl",
    statsLabel:
      "text-[0.6rem] uppercase tracking-[0.35em] text-[#fef2f2]/75",
    statsValue: "text-3xl font-black text-white tracking-wide",
    statsHint: "text-xs text-[#fecaca]/65",
    navVariant: "emerald",
    glowColors: ["#fecaca", "#dc2626", "#ef4444", "#b91c1c"],
    shimmerColor: "rgba(254,202,202,0.06)",
    shimmerColorAlt: "rgba(220,38,38,0.04)",
    borderGlowColor: "rgba(254,202,202,0.12)",
    headingGradient: "bg-gradient-to-r from-[#fef2f2] via-[#fecaca] to-[#fef2f2]",
    headingTextGlow: "drop-shadow-[0_0_25px_rgba(254,202,202,0.5)]",
  },
  bluewhite: {
    mainContainer: "",
    heroContainer:
      "relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1628] via-[#0a1020] to-[#020408] border border-[#bfdbfe]/25 shadow-[0_25px_60px_rgba(0,0,0,0.65)] p-8",
    heroOverlayPrimary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(191,219,254,0.3),transparent_55%)] opacity-70",
    heroOverlaySecondary:
      "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(37,99,235,0.2),transparent_50%)]",
    eyebrowClass:
      "text-[#f0f9ff] uppercase text-[0.65rem] tracking-[0.35em] mb-2 flex items-center gap-2",
    descriptionClass: "text-[#f0f9ff]/85 mt-2 max-w-2xl",
    statsCard:
      "relative overflow-hidden rounded-2xl border border-[#bfdbfe]/30 bg-[#0a1628]/60 px-5 py-4 shadow-[0_15px_35px_rgba(0,0,0,0.55)] transition hover:border-[#bfdbfe]/55",
    statsOverlay:
      "pointer-events-none absolute inset-0 bg-gradient-to-br from-[#bfdbfe]/12 to-transparent opacity-60",
    statsGlow:
      "pointer-events-none absolute right-4 top-3 h-10 w-10 rounded-full bg-[#2563eb]/25 blur-2xl",
    statsLabel:
      "text-[0.6rem] uppercase tracking-[0.35em] text-[#f0f9ff]/75",
    statsValue: "text-3xl font-black text-white tracking-wide",
    statsHint: "text-xs text-[#bfdbfe]/65",
    navVariant: "bluewhite",
    glowColors: ["#bfdbfe", "#2563eb", "#3b82f6", "#1d4ed8"],
    shimmerColor: "rgba(191,219,254,0.06)",
    shimmerColorAlt: "rgba(37,99,235,0.04)",
    borderGlowColor: "rgba(191,219,254,0.12)",
    headingGradient: "bg-gradient-to-r from-[#f0f9ff] via-[#bfdbfe] to-[#f0f9ff]",
    headingTextGlow: "drop-shadow-[0_0_25px_rgba(191,219,254,0.5)]",
  },
};

/**
 * AdminPremiumScaffold - Responsive admin layout with premium visual effects
 * 
 * Mobile optimizations:
 * - Disables glow effects on low-end devices
 * - Disables shimmer animations on mobile
 * - Respects prefers-reduced-motion preference
 * 
 * Responsive layout:
 * - Full-width content that scales from mobile to large screens
 * - Uses max-w-7xl container for comfortable reading on wide displays
 */
export default function AdminPremiumScaffold({
  hero,
  stats,
  navCards,
  children,
  theme = "gold",
  sidePanel: _sidePanel,
  compact = false,
}: AdminPremiumScaffoldProps) {
  // Note: sidePanel is defined in props interface for API compatibility but not yet implemented
  void _sidePanel;
  const themeStyles = THEME_STYLES[theme] ?? THEME_STYLES.gold;
  
  // Get device capabilities (cached)
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const quality = useMemo(() => getQualitySettings(), []);
  
  // Determine if we should show premium effects
  const showEffects = quality.enableEffects && !caps.isLowEnd;

  return (
    <div className={cn(
      "w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4",
      compact ? "pt-4 sm:pt-6" : "pt-8",
      themeStyles.mainContainer
    )}>
      <div className={cn(compact ? "space-y-3 sm:space-y-4" : "space-y-6 md:space-y-8")}>
        <AdminHero 
          hero={hero} 
          stats={stats} 
          theme={theme}
          themeStyles={themeStyles}
          showEffects={showEffects}
          isMobile={caps.isMobile}
          prefersReducedMotion={caps.prefersReducedMotion}
          compact={compact}
        />

        {navCards && navCards.length > 0 && (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {navCards.map((card) => (
              <BrandedNavCard
                key={card.to}
                title={card.title}
                description={card.description}
                icon={card.icon}
                to={card.to}
                variant={card.variant ?? themeStyles.navVariant}
                iconAsImage={card.iconAsImage}
              />
            ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

interface AdminHeroProps {
  hero: AdminHeroConfig;
  stats?: AdminStat[];
  theme: AdminTheme;
  themeStyles: (typeof THEME_STYLES)[AdminTheme];
  showEffects: boolean;
  isMobile: boolean;
  prefersReducedMotion: boolean;
  compact?: boolean;
}

function AdminHero({
  hero,
  stats,
  theme,
  themeStyles,
  showEffects,
  isMobile,
  prefersReducedMotion,
  compact = false,
}: AdminHeroProps) {
  // Disable animations on mobile or if user prefers reduced motion
  const enableAnimations = !isMobile && !prefersReducedMotion;
  
  // In compact mode, disable glow effects
  const showGlowEffects = showEffects && !compact;
  
  return (
    <div className="relative">
      {/* Background glow effect around the container - only on desktop with effects enabled, not in compact mode */}
      {showGlowEffects && (
        <div 
          className="absolute -inset-3 rounded-[2rem] overflow-hidden"
          style={{
            boxShadow: '0px 4px 25px 8px rgba(0, 0, 0, 0.85)'
          }}
        >
          <GlowEffect
            colors={themeStyles.glowColors}
            mode="breathe"
            blur="stronger"
            duration={6}
            scale={1.15}
            className="opacity-30"
          />
        </div>
      )}
      
      {/* Border glow pulse effect - only with animations */}
      {enableAnimations && (
        <div 
          className="pointer-events-none absolute -inset-[1px] rounded-3xl"
          style={{
            background: `linear-gradient(135deg, ${themeStyles.borderGlowColor}, transparent 40%, transparent 60%, ${themeStyles.borderGlowColor})`,
            animation: "borderPulse 4s ease-in-out infinite",
          }}
        />
      )}

      <div className={cn(
        themeStyles.heroContainer,
        compact && "!p-4 sm:!p-5 !rounded-2xl sm:!rounded-3xl"
      )}>
        <div className={themeStyles.heroOverlayPrimary} />
        <div className={themeStyles.heroOverlaySecondary} />
        
        {/* Shimmer effects - only on desktop with animations, not in compact mode */}
        {enableAnimations && !compact && (
          <>
            {/* Enhanced multi-layer shimmer overlay */}
            <div 
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
              style={{
                background: `linear-gradient(
                  115deg,
                  transparent 15%,
                  ${themeStyles.shimmerColor} 35%,
                  ${themeStyles.shimmerColorAlt} 50%,
                  ${themeStyles.shimmerColor} 65%,
                  transparent 85%
                )`,
                backgroundSize: "250% 100%",
                animation: "shimmerPrimary 7s ease-in-out infinite",
              }}
            />
            
            {/* Secondary shimmer layer for depth */}
            <div 
              className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl opacity-60"
              style={{
                background: `linear-gradient(
                  -65deg,
                  transparent 20%,
                  ${themeStyles.shimmerColorAlt} 45%,
                  ${themeStyles.shimmerColorAlt} 55%,
                  transparent 80%
                )`,
                backgroundSize: "200% 100%",
                animation: "shimmerSecondary 11s ease-in-out infinite",
              }}
            />
            
            {/* Edge highlight effect */}
            <div 
              className="pointer-events-none absolute inset-0 rounded-3xl"
              style={{
                background: `linear-gradient(180deg, ${themeStyles.borderGlowColor} 0%, transparent 8%, transparent 92%, ${themeStyles.borderGlowColor} 100%)`,
                animation: "edgeGlow 5s ease-in-out infinite alternate",
              }}
            />
          </>
        )}
        
        {/* CSS keyframes for animations - only inject if animations are enabled */}
        {enableAnimations && (
          <style>{`
            @keyframes shimmerPrimary {
              0%, 100% { background-position: 250% 0; }
              50% { background-position: -250% 0; }
            }
            @keyframes shimmerSecondary {
              0%, 100% { background-position: -200% 0; }
              50% { background-position: 200% 0; }
            }
            @keyframes borderPulse {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 0.8; }
            }
            @keyframes edgeGlow {
              0% { opacity: 0.3; }
              100% { opacity: 0.6; }
            }
          `}</style>
        )}

        <div className={cn("relative flex flex-col", compact ? "gap-3 sm:gap-4" : "gap-6")}>
          {/* Hero content with optional avatar */}
          <div className={cn("flex", compact ? "gap-3 sm:gap-4" : "gap-6", hero.avatar ? "items-start" : "")}>
            {/* Text content */}
            <div className={cn("flex-1 flex flex-col", compact ? "gap-2 sm:gap-3" : "gap-4")}>
              {(hero.eyebrow || hero.eyebrowIcon) && (
                <p className={cn(themeStyles.eyebrowClass, compact && "!text-[0.55rem] sm:!text-[0.6rem] !mb-1")}>
                  {hero.eyebrowIcon}
                  {hero.eyebrow}
                </p>
              )}

              <div className="relative">
                {/* GlowEffect behind the heading - only on desktop, not in compact mode */}
                {showEffects && !compact && (
                  <div className="absolute -inset-4 -top-6 -bottom-2">
                    <GlowEffect
                      colors={themeStyles.glowColors}
                      mode="breathe"
                      blur="strong"
                      duration={7}
                      scale={1.1}
                      className="opacity-50"
                    />
                  </div>
                )}
                {/* Heading - use simpler rendering on mobile or compact mode */}
                {prefersReducedMotion || compact ? (
                  <h2 className={cn(
                    "relative font-black leading-tight tracking-tight text-white break-normal",
                    compact ? "text-lg sm:text-xl md:text-2xl" : "text-2xl sm:text-3xl md:text-4xl",
                    !compact && themeStyles.headingTextGlow
                  )}>
                    {hero.heading}
                  </h2>
                ) : (
                  <TextEffect
                    as="h2"
                    preset="blurSlide"
                    per="char"
                    delay={0.1}
                    className="relative text-2xl sm:text-3xl md:text-4xl font-black leading-tight tracking-tight text-white break-normal"
                    segmentWrapperClassName={themeStyles.headingTextGlow}
                  >
                    {hero.heading}
                  </TextEffect>
                )}
                {hero.description && (
                  <p className={cn(
                    "relative",
                    compact ? "mt-1 sm:mt-1.5 text-xs sm:text-sm !max-w-none" : "mt-3",
                    themeStyles.descriptionClass
                  )}>{hero.description}</p>
                )}
              </div>

              {hero.badges && hero.badges.length > 0 && (
                <div className={cn("flex flex-wrap", compact ? "gap-1.5 sm:gap-2" : "gap-3")}>
                  {hero.badges.map((badge, index) => (
                    <div
                      key={`${badge.label}-${index}`}
                      className={cn(
                        BADGE_STYLES[theme][badge.variant ?? "solid"],
                        compact && "!px-2 sm:!px-3 !py-1 !text-[10px] sm:!text-xs !space-x-1"
                      )}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Avatar section - hidden in compact mode */}
            {hero.avatar && !compact && (
              <div className="hidden sm:block flex-shrink-0 w-28 h-36 md:w-36 md:h-44 lg:w-40 lg:h-48">
                {hero.avatar}
              </div>
            )}
          </div>

          {stats && stats.length > 0 && (
            <div className={cn(
              "grid grid-cols-1 sm:grid-cols-3",
              compact ? "gap-2 sm:gap-3" : "gap-4"
            )}>
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={themeStyles.statsCard}
                >
                  {/* Only render decorative overlays on capable devices */}
                  {showEffects && (
                    <>
                      <div className={themeStyles.statsOverlay} />
                      <div className={themeStyles.statsGlow} />
                    </>
                  )}
                  <div className="relative space-y-1.5">
                    <p className={themeStyles.statsLabel}>
                      {stat.label}
                    </p>
                    <p className={themeStyles.statsValue}>
                      {stat.value}
                    </p>
                    {stat.hint && (
                      <p className={themeStyles.statsHint}>{stat.hint}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
