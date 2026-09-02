import { ReactNode, useMemo } from "react";
import { motion } from "framer-motion";
import BrandedNavCard from "../BrandedNavCard";
import { cn } from "../../lib/utils";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { Eyebrow } from "../canopy/Eyebrow";
import { EASE_CANOPY, riseThroughBlur, unfurlContainer, staggerItem, reducedMotionFade } from "../../motion/presets";

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

/**
 * Role tint → Canopy hero treatment.
 * The hero is a deep slab with a radial "canopy gap" light; each role shifts
 * the hue of that light while staying inside green · white · black
 * (safety = red, a justified safety-critical exception).
 */
const THEME: Record<
  AdminTheme,
  {
    heroBg: string;
    heroBorder: string;
    light: string;
    eyebrowTone: "verdant" | "bone" | "safety" | "lime";
    headingAccent: string;
    badgeSolid: string;
    badgeOutline: string;
    statBorder: string;
    statValue: string;
    navVariant: AdminNavCardConfig["variant"];
  }
> = {
  gold: {
    heroBg: "bg-[radial-gradient(110%_120%_at_0%_0%,#1e2a23_0%,#0b100d_50%,#040605_100%)]",
    heroBorder: "border-bone-50/[0.16]",
    light: "rgba(244,247,242,0.22)",
    eyebrowTone: "bone",
    headingAccent: "from-bone-50 via-verdant-200 to-bone-100",
    badgeSolid: "border-bone-50/25 bg-bone-50/[0.06] text-bone-100",
    badgeOutline: "border-bone-50/15 bg-transparent text-bone-300",
    statBorder: "border-bone-50/[0.12] hover:border-bone-50/30",
    statValue: "text-bone-50",
    navVariant: "gold",
  },
  ember: {
    heroBg: "bg-[radial-gradient(110%_120%_at_0%_0%,#1c2a12_0%,#0b100d_50%,#040605_100%)]",
    heroBorder: "border-lime-400/25",
    light: "rgba(184,255,122,0.22)",
    eyebrowTone: "lime",
    headingAccent: "from-bone-50 via-lime-300 to-bone-100",
    badgeSolid: "border-lime-400/35 bg-lime-400/10 text-lime-200",
    badgeOutline: "border-lime-400/20 bg-transparent text-lime-300/80",
    statBorder: "border-lime-400/20 hover:border-lime-400/50",
    statValue: "text-lime-100",
    navVariant: "ember",
  },
  emerald: {
    heroBg: "bg-[radial-gradient(110%_120%_at_0%_0%,#12482a_0%,#0b100d_50%,#040605_100%)]",
    heroBorder: "border-verdant-400/25",
    light: "rgba(61,220,132,0.26)",
    eyebrowTone: "verdant",
    headingAccent: "from-bone-50 via-verdant-300 to-bone-100",
    badgeSolid: "border-verdant-400/35 bg-verdant-500/10 text-verdant-100",
    badgeOutline: "border-verdant-400/20 bg-transparent text-verdant-200/80",
    statBorder: "border-verdant-400/20 hover:border-verdant-400/50",
    statValue: "text-verdant-100",
    navVariant: "emerald",
  },
  purple: {
    heroBg: "bg-[radial-gradient(110%_120%_at_0%_0%,#1f7a44_0%,#0a2a19_35%,#040605_100%)]",
    heroBorder: "border-verdant-300/30",
    light: "rgba(94,232,152,0.3)",
    eyebrowTone: "verdant",
    headingAccent: "from-bone-50 via-verdant-300 to-verdant-100",
    badgeSolid: "border-verdant-300/40 bg-verdant-500/15 text-verdant-100",
    badgeOutline: "border-verdant-300/25 bg-transparent text-verdant-200",
    statBorder: "border-verdant-300/25 hover:border-verdant-300/60",
    statValue: "text-verdant-50",
    navVariant: "purple",
  },
  redwhite: {
    heroBg: "bg-[radial-gradient(110%_120%_at_0%_0%,#3a0d13_0%,#12080a_50%,#040605_100%)]",
    heroBorder: "border-rose-400/30",
    light: "rgba(254,202,202,0.22)",
    eyebrowTone: "safety",
    headingAccent: "from-bone-50 via-rose-200 to-bone-100",
    badgeSolid: "border-rose-300/35 bg-rose-500/10 text-rose-100",
    badgeOutline: "border-rose-300/20 bg-transparent text-rose-200/80",
    statBorder: "border-rose-400/25 hover:border-rose-300/60",
    statValue: "text-rose-50",
    navVariant: "redwhite",
  },
  bluewhite: {
    heroBg: "bg-[radial-gradient(110%_120%_at_0%_0%,#1e2a23_0%,#0b100d_50%,#040605_100%)]",
    heroBorder: "border-verdant-200/25",
    light: "rgba(200,255,212,0.22)",
    eyebrowTone: "bone",
    headingAccent: "from-bone-50 via-verdant-200 to-bone-50",
    badgeSolid: "border-verdant-200/30 bg-verdant-200/[0.08] text-bone-100",
    badgeOutline: "border-verdant-200/20 bg-transparent text-bone-300",
    statBorder: "border-verdant-200/20 hover:border-verdant-200/50",
    statValue: "text-bone-50",
    navVariant: "bluewhite",
  },
};

/**
 * AdminPremiumScaffold — CANOPY role dashboard scaffold.
 *
 * Hero slab (eyebrow → display heading → description → badges → stat rail),
 * followed by an unfurling grid of leaf tiles and any children.
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
  void _sidePanel;
  const t = THEME[theme] ?? THEME.gold;
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const reduce = caps.prefersReducedMotion || caps.isLowEnd;

  return (
    <div className={cn("mx-auto w-full max-w-[1400px] px-0 pb-4", compact ? "pt-2 sm:pt-4" : "pt-2 sm:pt-4")}>
      <div className={cn(compact ? "space-y-4 sm:space-y-5" : "space-y-8 md:space-y-10")}>
        <AdminHero hero={hero} stats={stats} t={t} compact={compact} reduce={reduce} />

        {navCards && navCards.length > 0 && (
          <motion.div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
            variants={reduce ? reducedMotionFade : unfurlContainer}
            initial="hidden"
            animate="visible"
          >
            {navCards.map((card) => (
              <motion.div key={card.to} variants={reduce ? reducedMotionFade : staggerItem}>
                <BrandedNavCard
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  to={card.to}
                  variant={card.variant ?? t.navVariant}
                  iconAsImage={card.iconAsImage}
                  comingSoon={card.comingSoon}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {children}
      </div>
    </div>
  );
}

interface AdminHeroProps {
  hero: AdminHeroConfig;
  stats?: AdminStat[];
  t: (typeof THEME)[AdminTheme];
  compact: boolean;
  reduce: boolean;
}

function AdminHero({ hero, stats, t, compact, reduce }: AdminHeroProps) {
  const words = hero.heading.split(" ");

  return (
    <motion.section
      className={cn(
        "relative overflow-hidden grain border shadow-slab-lg",
        compact ? "rounded-leaf p-5 sm:p-6" : "rounded-leaf-lg p-6 sm:p-8 lg:p-10",
        t.heroBg,
        t.heroBorder
      )}
      initial={reduce ? false : { opacity: 0, y: 24, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease: EASE_CANOPY }}
    >
      {/* canopy-gap light */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-32 h-[420px] w-[520px] rounded-full blur-3xl animate-breathe"
        style={{ background: `radial-gradient(closest-side, ${t.light}, transparent 70%)` }}
      />
      {/* top-edge highlight */}
      <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(244,247,242,0.35),transparent)]" />
      {/* index rail */}
      {!compact && (
        <span
          aria-hidden
          className="type-instrument pointer-events-none absolute right-6 top-6 hidden text-bone-50/25 sm:block"
        >
          {new Date().toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "2-digit" }).toUpperCase()}
        </span>
      )}

      <div className={cn("relative flex", compact ? "gap-4" : "gap-6 lg:gap-10", hero.avatar ? "items-start" : "")}>
        <div className={cn("flex min-w-0 flex-1 flex-col", compact ? "gap-3" : "gap-5")}>
          {(hero.eyebrow || hero.eyebrowIcon) && (
            <Eyebrow tone={t.eyebrowTone} rule={false}>
              <span className="inline-flex items-center gap-2 [&>svg]:h-3 [&>svg]:w-3">
                {hero.eyebrowIcon}
                {hero.eyebrow}
              </span>
            </Eyebrow>
          )}

          <div>
            <h2
              className={cn(
                "type-display text-balance font-light text-bone-50",
                compact ? "text-[clamp(1.5rem,5vw,2.25rem)]" : "text-[clamp(2rem,5.5vw,4.25rem)]"
              )}
            >
              {words.map((w, i) => (
                <motion.span
                  key={`${w}-${i}`}
                  className={cn(
                    "inline-block will-change-transform",
                    i === words.length - 1 && `bg-gradient-to-r ${t.headingAccent} bg-clip-text italic text-transparent`
                  )}
                  variants={reduce ? reducedMotionFade : riseThroughBlur}
                  initial="hidden"
                  animate="visible"
                  transition={{ delay: reduce ? 0 : 0.15 + i * 0.07 }}
                >
                  {w}
                  {i < words.length - 1 && "\u00A0"}
                </motion.span>
              ))}
            </h2>
            {hero.description && (
              <motion.p
                className={cn("max-w-2xl text-pretty text-bone-300", compact ? "mt-2 text-sm" : "mt-4 text-base sm:text-lg")}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE_CANOPY, delay: 0.45 }}
              >
                {hero.description}
              </motion.p>
            )}
          </div>

          {hero.badges && hero.badges.length > 0 && (
            <motion.div
              className={cn("flex flex-wrap", compact ? "gap-2" : "gap-2.5")}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              {hero.badges.map((badge, index) => (
                <span
                  key={`${badge.label}-${index}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] [&>svg]:h-3 [&>svg]:w-3",
                    badge.variant === "outline" ? t.badgeOutline : t.badgeSolid
                  )}
                >
                  {badge.icon}
                  <span>{badge.label}</span>
                </span>
              ))}
            </motion.div>
          )}
        </div>

        {hero.avatar && !compact && (
          <div className="hidden w-28 flex-shrink-0 sm:block sm:h-36 md:h-44 md:w-36 lg:h-48 lg:w-40">{hero.avatar}</div>
        )}
      </div>

      {stats && stats.length > 0 && (
        <motion.div
          className={cn("relative grid grid-cols-1 sm:grid-cols-3", compact ? "mt-5 gap-2" : "mt-8 gap-3")}
          variants={reduce ? reducedMotionFade : unfurlContainer}
          initial="hidden"
          animate="visible"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={reduce ? reducedMotionFade : staggerItem}
              className={cn(
                "relative overflow-hidden rounded-leaf-sm border bg-ink-950/60 px-4 py-3.5 transition-colors duration-500 ease-canopy",
                t.statBorder
              )}
            >
              <span className="type-instrument text-bone-50/40">{String(i + 1).padStart(2, "0")}</span>
              <p className={cn("type-display mt-1 text-3xl font-medium tabular-nums sm:text-4xl", t.statValue)}>{stat.value}</p>
              <p className="type-instrument mt-2 text-bone-300">{stat.label}</p>
              {stat.hint && <p className="mt-1 text-xs text-bone-400">{stat.hint}</p>}
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.section>
  );
}
