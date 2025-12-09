import { ReactNode } from "react";
import BrandedNavCard from "../BrandedNavCard";
import { cn } from "../../lib/utils";
import { GlowEffect } from "../ui/GlowEffect";
import { TextEffect } from "../ui/TextEffect";

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
  variant?: "emerald" | "gold" | "ember";
};

type AdminTheme = "gold" | "ember" | "emerald";

interface AdminPremiumScaffoldProps {
  hero: AdminHeroConfig;
  stats?: AdminStat[];
  navCards?: AdminNavCardConfig[];
  sidePanel?: ReactNode;
  children?: ReactNode;
  theme?: AdminTheme;
}

const BADGE_STYLES: Record<string, string> = {
  solid:
    "inline-flex items-center space-x-2 px-4 py-2 bg-black/40 rounded-full border border-[#f7dca8]/40 text-sm text-[#fff5da]",
  outline:
    "inline-flex items-center space-x-2 px-4 py-2 rounded-full border border-[#fef3d1]/30 text-sm text-[#f8e4bb] bg-[#fef3d1]/10",
};

const THEME_STYLES: Record<
  AdminTheme,
  {
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
    navVariant: "emerald" | "gold" | "ember";
    sidePanelContainer: string;
    sidePanelBorder: string;
    sidePanelGlowOne: string;
    sidePanelGlowTwo: string;
    glowColors: string[];
    shimmerColor: string;
    shimmerColorAlt: string;
    borderGlowColor: string;
    headingGradient: string;
    headingTextGlow: string;
  }
> = {
  gold: {
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
    sidePanelContainer:
      "relative overflow-hidden rounded-3xl border border-[#f6dcb2]/25 bg-gradient-to-br from-[#1b1914] via-[#120f0c] to-[#070605] shadow-[0_40px_80px_rgba(0,0,0,0.65)] p-6",
    sidePanelBorder:
      "pointer-events-none absolute inset-0 rounded-3xl border border-[#f6dcb2]/10 opacity-40",
    sidePanelGlowOne:
      "pointer-events-none absolute -top-24 -right-10 h-56 w-56 bg-[radial-gradient(circle,rgba(247,223,179,0.35),transparent_60%)] blur-2xl",
    sidePanelGlowTwo:
      "pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 bg-[radial-gradient(circle,rgba(209,152,57,0.35),transparent_70%)] blur-3xl",
    glowColors: ["#f7e4bd", "#f4c979", "#d79a32", "#fef3d1"],
    shimmerColor: "rgba(247,228,189,0.08)",
    shimmerColorAlt: "rgba(244,201,121,0.05)",
    borderGlowColor: "rgba(247,228,189,0.15)",
    headingGradient: "bg-gradient-to-r from-[#fff6dd] via-[#f4c979] to-[#fff6dd]",
    headingTextGlow: "drop-shadow-[0_0_25px_rgba(247,228,189,0.5)]",
  },
  ember: {
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
    sidePanelContainer:
      "relative overflow-hidden rounded-3xl border border-[#f28b53]/35 bg-gradient-to-br from-[#2b130a] via-[#170807] to-[#070303] shadow-[0_40px_80px_rgba(0,0,0,0.7)] p-6",
    sidePanelBorder:
      "pointer-events-none absolute inset-0 rounded-3xl border border-[#f5a06b]/25 opacity-40",
    sidePanelGlowOne:
      "pointer-events-none absolute -top-24 -right-10 h-56 w-56 bg-[radial-gradient(circle,rgba(255,166,102,0.4),transparent_60%)] blur-2xl",
    sidePanelGlowTwo:
      "pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 bg-[radial-gradient(circle,rgba(255,85,37,0.35),transparent_70%)] blur-3xl",
    glowColors: ["#f6b78f", "#ff6f3c", "#ffa366", "#ff9350"],
    shimmerColor: "rgba(246,183,143,0.08)",
    shimmerColorAlt: "rgba(255,111,60,0.05)",
    borderGlowColor: "rgba(246,183,143,0.15)",
    headingGradient: "bg-gradient-to-r from-[#ffe7d0] via-[#ff9350] to-[#ffe7d0]",
    headingTextGlow: "drop-shadow-[0_0_25px_rgba(255,147,80,0.5)]",
  },
  emerald: {
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
    sidePanelContainer:
      "relative overflow-hidden rounded-3xl border border-[#53d6a1]/35 bg-gradient-to-br from-[#08251a] via-[#02140d] to-[#000704] shadow-[0_40px_80px_rgba(0,0,0,0.65)] p-6",
    sidePanelBorder:
      "pointer-events-none absolute inset-0 rounded-3xl border border-[#6fe9b7]/25 opacity-40",
    sidePanelGlowOne:
      "pointer-events-none absolute -top-24 -right-10 h-56 w-56 bg-[radial-gradient(circle,rgba(117,255,200,0.35),transparent_60%)] blur-2xl",
    sidePanelGlowTwo:
      "pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 bg-[radial-gradient(circle,rgba(31,166,118,0.35),transparent_70%)] blur-3xl",
    glowColors: ["#7de1b4", "#10b981", "#34d399", "#059669"],
    shimmerColor: "rgba(125,225,180,0.06)",
    shimmerColorAlt: "rgba(16,185,129,0.04)",
    borderGlowColor: "rgba(125,225,180,0.12)",
    headingGradient: "bg-gradient-to-r from-[#e5fff6] via-[#7de1b4] to-[#e5fff6]",
    headingTextGlow: "drop-shadow-[0_0_25px_rgba(125,225,180,0.5)]",
  },
};

export default function AdminPremiumScaffold({
  hero,
  stats,
  navCards,
  sidePanel,
  children,
  theme = "gold",
}: AdminPremiumScaffoldProps) {
  const themeStyles = THEME_STYLES[theme] ?? THEME_STYLES.gold;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <AdminHero hero={hero} stats={stats} themeStyles={themeStyles} />

          {navCards && navCards.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2">
              {navCards.map((card) => (
                <BrandedNavCard
                  key={card.to}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  to={card.to}
                  variant={card.variant ?? themeStyles.navVariant}
                />
              ))}
            </div>
          )}

          {children}
        </div>

        {sidePanel && (
          <div className={themeStyles.sidePanelContainer}>
            <div className={themeStyles.sidePanelBorder} />
            <div className={themeStyles.sidePanelGlowOne} />
            <div className={themeStyles.sidePanelGlowTwo} />
            <div className="relative space-y-6">{sidePanel}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminHero({
  hero,
  stats,
  themeStyles,
}: {
  hero: AdminHeroConfig;
  stats?: AdminStat[];
  themeStyles: (typeof THEME_STYLES)[AdminTheme];
}) {
  return (
    <div className="relative">
      {/* Background glow effect around the container */}
      <div className="absolute -inset-3 rounded-[2rem] overflow-hidden">
        <GlowEffect
          colors={themeStyles.glowColors}
          mode="breathe"
          blur="stronger"
          duration={6}
          scale={1.15}
          className="opacity-30"
        />
      </div>
      
      {/* Border glow pulse effect */}
      <div 
        className="pointer-events-none absolute -inset-[1px] rounded-3xl"
        style={{
          background: `linear-gradient(135deg, ${themeStyles.borderGlowColor}, transparent 40%, transparent 60%, ${themeStyles.borderGlowColor})`,
          animation: "borderPulse 4s ease-in-out infinite",
        }}
      />

      <div className={themeStyles.heroContainer}>
        <div className={themeStyles.heroOverlayPrimary} />
        <div className={themeStyles.heroOverlaySecondary} />
        
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
        
        {/* CSS keyframes for all animations */}
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

        <div className="relative flex flex-col gap-6">
          {(hero.eyebrow || hero.eyebrowIcon) && (
            <p className={themeStyles.eyebrowClass}>
              {hero.eyebrowIcon}
              {hero.eyebrow}
            </p>
          )}

          <div className="relative">
            {/* GlowEffect behind the heading */}
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
            {/* Upgraded heading with TextEffect animation */}
            <TextEffect
              as="h2"
              preset="blurSlide"
              per="char"
              delay={0.1}
              className="relative text-3xl sm:text-4xl font-black leading-tight tracking-tight text-white"
              segmentWrapperClassName={themeStyles.headingTextGlow}
            >
              {hero.heading}
            </TextEffect>
            {hero.description && (
              <p className={cn("relative mt-3", themeStyles.descriptionClass)}>{hero.description}</p>
            )}
          </div>

          {hero.badges && hero.badges.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {hero.badges.map((badge, index) => (
                <div
                  key={`${badge.label}-${index}`}
                  className={cn(
                    BADGE_STYLES[badge.variant ?? "solid"],
                    badge.variant === "outline" && "text-[#f8e4bb]"
                  )}
                >
                  {badge.icon}
                  <span>{badge.label}</span>
                </div>
              ))}
            </div>
          )}

          {stats && stats.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className={themeStyles.statsCard}
                >
                  <div className={themeStyles.statsOverlay} />
                  <div className={themeStyles.statsGlow} />
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

