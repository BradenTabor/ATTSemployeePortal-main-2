import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import React, { ReactNode, useMemo, useState, useCallback, useRef, isValidElement } from "react";
import { ArrowUpRight, Pin, PinOff, Star } from "lucide-react";
import { cn } from "../lib/utils";
import { getDeviceCapabilities } from "../lib/mobilePerf";
import { LeafGlyph, type LeafTone } from "./canopy/LeafGlyph";
import { EASE_CANOPY, springSnappy } from "../motion/presets";

type CardVariant = "emerald" | "gold" | "ember" | "purple" | "redwhite" | "bluewhite";

interface BrandedNavCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  to: string;
  variant?: CardVariant;
  /** Smaller card with no description, for dense grids */
  compact?: boolean;
  /** Mark as coming soon - disables link and shows badge */
  comingSoon?: boolean;
  /** Unique ID for pinning (required for pin functionality) */
  itemId?: string;
  /** Whether this item is currently pinned */
  isPinned?: boolean;
  /** Whether user can pin more items (not at max) */
  canPinMore?: boolean;
  /** Callback when user pins/unpins this item */
  onTogglePin?: (itemId: string) => void;
  /** When true, icon is an image (rendered raw, no glyph tile) */
  iconAsImage?: boolean;
}

/**
 * Role tint → Canopy tone.
 * All within green · white · black except safety (red) which is a justified exception.
 */
const VARIANT: Record<
  CardVariant,
  { tone: LeafTone; border: string; hoverBorder: string; glow: string; title: string; desc: string; vein: string }
> = {
  emerald: {
    tone: "verdant",
    border: "border-verdant-500/[0.18]",
    hoverBorder: "group-hover:border-verdant-400/60",
    glow: "rgba(61,220,132,0.35)",
    title: "text-bone-50",
    desc: "text-bone-300",
    vein: "from-verdant-400 to-lime-400",
  },
  gold: {
    tone: "platinum",
    border: "border-bone-50/[0.14]",
    hoverBorder: "group-hover:border-bone-50/50",
    glow: "rgba(244,247,242,0.28)",
    title: "text-bone-50",
    desc: "text-bone-300",
    vein: "from-bone-50 to-lime-400",
  },
  ember: {
    tone: "sap",
    border: "border-lime-400/25",
    hoverBorder: "group-hover:border-lime-400/70",
    glow: "rgba(184,255,122,0.32)",
    title: "text-bone-50",
    desc: "text-bone-300",
    vein: "from-lime-400 to-verdant-400",
  },
  purple: {
    tone: "moss",
    border: "border-verdant-400/25",
    hoverBorder: "group-hover:border-verdant-300/70",
    glow: "rgba(61,220,132,0.4)",
    title: "text-bone-50",
    desc: "text-bone-300",
    vein: "from-verdant-500 to-verdant-300",
  },
  redwhite: {
    tone: "safety",
    border: "border-rose-400/30",
    hoverBorder: "group-hover:border-rose-300/70",
    glow: "rgba(254,202,202,0.35)",
    title: "text-bone-50",
    desc: "text-rose-100/80",
    vein: "from-rose-300 to-rose-500",
  },
  bluewhite: {
    tone: "glacier",
    border: "border-verdant-200/20",
    hoverBorder: "group-hover:border-verdant-200/60",
    glow: "rgba(200,255,212,0.3)",
    title: "text-bone-50",
    desc: "text-bone-300",
    vein: "from-bone-100 to-verdant-300",
  },
};

/**
 * BrandedNavCard — the CANOPY leaf tile.
 *
 * A slab with the signature asymmetric radius, a LeafGlyph icon tile, and a
 * living vein that draws along the base on hover. Lifts and tilts on desktop.
 */
export default function BrandedNavCard({
  title,
  description,
  icon,
  to,
  variant = "emerald",
  compact = false,
  comingSoon = false,
  itemId,
  isPinned = false,
  canPinMore = true,
  onTogglePin,
  iconAsImage = false,
}: BrandedNavCardProps) {
  const v = VARIANT[variant] ?? VARIANT.emerald;
  const [isHovered, setIsHovered] = useState(false);
  const [showPinOverlay, setShowPinOverlay] = useState(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const caps = useMemo(() => getDeviceCapabilities(), []);
  const canAnimate = !caps.prefersReducedMotion;
  const canHover = !caps.isMobile && canAnimate && !comingSoon;
  const isMobile = caps.isMobile;
  const hasPinSupport = !!itemId && !!onTogglePin;

  const handleTouchStart = useCallback(() => {
    if (!hasPinSupport) return;
    pressTimerRef.current = setTimeout(() => {
      setShowPinOverlay(true);
      if ("vibrate" in navigator) navigator.vibrate(10);
    }, 500);
  }, [hasPinSupport]);

  const handleTouchEnd = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!hasPinSupport) return;
      e.preventDefault();
      setShowPinOverlay(true);
    },
    [hasPinSupport]
  );

  const handleTogglePin = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (itemId && onTogglePin) {
        onTogglePin(itemId);
        if ("vibrate" in navigator) navigator.vibrate(5);
      }
      setShowPinOverlay(false);
    },
    [itemId, onTogglePin]
  );

  const mouseHandlers = {
    onMouseEnter: () => canHover && setIsHovered(true),
    onMouseLeave: () => {
      setIsHovered(false);
      setShowPinOverlay(false);
    },
  };

  const iconNode = isValidElement(icon)
    ? icon
    : typeof icon === "function"
      ? React.createElement(icon as React.ComponentType)
      : null;

  const glyphSize = compact ? 36 : 48;

  const cardContent = (
    <motion.div
      className="group relative h-full"
      whileHover={canHover ? { y: -4 } : undefined}
      whileTap={canAnimate && !comingSoon ? { scale: 0.98 } : undefined}
      transition={springSnappy}
    >
      {comingSoon && (
        <div className="absolute -top-2 right-3 z-20">
          <span className="rounded-full border border-bone-50/[0.15] bg-ink-900 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-bone-300 shadow-slab">
            Soon
          </span>
        </div>
      )}

      {/* hover halo */}
      {canHover && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-leaf blur-xl"
          style={{ background: `radial-gradient(60% 80% at 20% 50%, ${v.glow}, transparent 70%)` }}
          animate={{ opacity: isHovered ? 0.7 : 0 }}
          transition={{ duration: 0.5, ease: EASE_CANOPY }}
        />
      )}

      <div
        className={cn(
          "relative flex h-full items-center overflow-hidden border bg-[linear-gradient(160deg,#121a15_0%,#0b100d_50%,#040605_100%)] transition-[border-color,box-shadow] duration-500 ease-canopy",
          "shadow-[inset_0_1px_0_rgba(244,247,242,0.07),0_2px_6px_rgba(0,0,0,0.5),0_18px_36px_-20px_rgba(0,0,0,0.9)]",
          compact ? "rounded-leaf-sm gap-2.5 px-3 py-2.5 min-h-[52px]" : "rounded-leaf gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 min-h-[68px]",
          v.border,
          !comingSoon && v.hoverBorder,
          comingSoon && "opacity-60",
          isMobile && !comingSoon && "active:opacity-90"
        )}
      >
        {/* top-edge highlight */}
        <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(244,247,242,0.25),transparent)]" />

        {/* sheen sweep on hover (desktop) */}
        {canHover && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(200,255,212,0.10),transparent)]"
            initial={{ x: "-150%", skewX: -18 }}
            animate={isHovered ? { x: "400%" } : { x: "-150%" }}
            transition={{ duration: isHovered ? 1.1 : 0, ease: EASE_CANOPY }}
          />
        )}

        {/* icon */}
        {icon && (
          <motion.div
            className="relative z-10 flex-shrink-0"
            animate={isHovered && canHover ? { rotate: -6, scale: 1.06 } : { rotate: 0, scale: 1 }}
            transition={springSnappy}
          >
            {iconAsImage ? (
              <div
                className={cn(
                  "flex items-center justify-center drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] [&>img]:h-full [&>img]:w-full [&>img]:object-contain",
                  compact ? "h-9 w-9" : "h-12 w-12 sm:h-14 sm:w-14"
                )}
              >
                {iconNode}
              </div>
            ) : (
              <LeafGlyph tone={v.tone} size={glyphSize} live={isHovered}>
                <span className={cn("flex items-center justify-center [&>svg]:h-full [&>svg]:w-full", compact ? "h-4 w-4" : "h-5 w-5")}>
                  {iconNode}
                </span>
              </LeafGlyph>
            )}
          </motion.div>
        )}

        {/* text */}
        <div className="relative z-10 min-w-0 flex-1">
          <h3 className={cn("truncate font-semibold tracking-[-0.01em]", compact ? "text-[13px]" : "text-sm sm:text-[15px]", v.title)}>
            {title}
          </h3>
          {description && !compact && (
            <p className={cn("mt-0.5 line-clamp-1 text-[11px] sm:line-clamp-2 sm:text-xs", v.desc)}>{description}</p>
          )}
        </div>

        {/* arrow */}
        <motion.div
          className={cn("relative z-10 flex-shrink-0 text-bone-300", !isMobile && "opacity-40 transition-opacity duration-300 group-hover:opacity-100 group-hover:text-verdant-200")}
          animate={isHovered && canHover ? { x: 3, y: -3 } : { x: 0, y: 0 }}
          transition={springSnappy}
        >
          <ArrowUpRight className={compact ? "h-3.5 w-3.5" : "h-4 w-4 sm:h-[18px] sm:w-[18px]"} strokeWidth={2} aria-hidden />
        </motion.div>

        {/* base vein draws on hover */}
        {!isMobile && (
          <motion.span
            aria-hidden
            className={cn("absolute bottom-0 left-4 right-4 h-px origin-left bg-gradient-to-r", v.vein)}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isHovered ? 1 : 0 }}
            transition={{ duration: 0.6, ease: EASE_CANOPY }}
          />
        )}
      </div>
    </motion.div>
  );

  if (comingSoon) {
    return (
      <div className="block h-full cursor-not-allowed touch-manipulation" {...mouseHandlers}>
        {cardContent}
      </div>
    );
  }

  return (
    <div
      className="relative h-full"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      {...mouseHandlers}
    >
      <Link
        to={to}
        className="block h-full touch-manipulation rounded-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-verdant-400"
      >
        {cardContent}
      </Link>

      {hasPinSupport && isPinned && (
        <div className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink-950 bg-lime-400 shadow-glow-lime">
          <Star className="h-2.5 w-2.5 fill-ink-950 text-ink-950" aria-hidden />
        </div>
      )}

      <AnimatePresence>
        {showPinOverlay && hasPinSupport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center rounded-leaf bg-ink-950/90"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {isPinned ? (
              <button
                onClick={handleTogglePin}
                className="flex items-center gap-2 rounded-leaf-xs border border-rose-400/40 bg-rose-500/15 px-4 py-2.5 text-sm font-medium text-rose-200 transition-colors hover:bg-rose-500/25"
              >
                <PinOff className="h-4 w-4" aria-hidden />
                Remove from Quick Access
              </button>
            ) : canPinMore ? (
              <button
                onClick={handleTogglePin}
                className="flex items-center gap-2 rounded-leaf-xs border border-verdant-400/40 bg-verdant-500/15 px-4 py-2.5 text-sm font-medium text-verdant-200 transition-colors hover:bg-verdant-500/25"
              >
                <Pin className="h-4 w-4" aria-hidden />
                Add to Quick Access
              </button>
            ) : (
              <div className="flex flex-col items-center gap-1 px-4 py-3 text-center">
                <span className="text-sm text-bone-200">Quick Access is full (4 max)</span>
                <span className="text-xs text-bone-400">Remove an item first</span>
              </div>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPinOverlay(false);
              }}
              className="absolute right-2 top-2 rounded-full bg-bone-50/10 p-1.5 transition-colors hover:bg-bone-50/20"
              aria-label="Close"
            >
              <span className="text-xs text-bone-200">✕</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
