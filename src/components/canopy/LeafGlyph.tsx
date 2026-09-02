import { memo, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LeafTone = "verdant" | "platinum" | "moss" | "glacier" | "sap" | "safety" | "lime";

const TONES: Record<LeafTone, { a: string; b: string; vein: string; ink: string }> = {
  verdant: { a: "#8DF5A8", b: "#1F7A44", vein: "#C8FFD4", ink: "#040605" },
  platinum: { a: "#F4F7F2", b: "#8A9A8E", vein: "#B8FF7A", ink: "#040605" },
  moss: { a: "#3DDC84", b: "#0A2A19", vein: "#8DF5A8", ink: "#F4F7F2" },
  glacier: { a: "#E4EAE1", b: "#5EE898", vein: "#F4F7F2", ink: "#040605" },
  sap: { a: "#D2FFA3", b: "#7CC43F", vein: "#F4F7F2", ink: "#040605" },
  safety: { a: "#FECACA", b: "#B91C1C", vein: "#FFF1F2", ink: "#040605" },
  lime: { a: "#B8FF7A", b: "#3DDC84", vein: "#F4F7F2", ink: "#040605" },
};

interface LeafGlyphProps {
  /** A lucide icon element or a 1–2 letter monogram */
  children?: ReactNode;
  tone?: LeafTone;
  size?: number;
  className?: string;
  /** Mirror the leaf silhouette */
  flip?: boolean;
  /** Animate the vein */
  live?: boolean;
}

/**
 * LeafGlyph — the CANOPY icon tile. A leaf-shaped gradient slab with a
 * central vein, holding either an icon or a monogram. Replaces the raster
 * icon set so every navigation surface shares one silhouette.
 */
function LeafGlyphComponent({
  children,
  tone = "verdant",
  size = 48,
  className,
  flip = false,
  live = false,
}: LeafGlyphProps) {
  const id = useId();
  const t = TONES[tone];
  const gradId = `lg-${id}`;
  const glowId = `lw-${id}`;

  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className={cn("absolute inset-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]", flip && "-scale-x-100")}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={t.a} />
            <stop offset="1" stopColor={t.b} />
          </linearGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* leaf body: asymmetric rounded slab (matches rounded-leaf) */}
        <path
          d="M28 2 H58 a4 4 0 0 1 4 4 V36 C62 50.6 50.6 62 36 62 H6 a4 4 0 0 1-4-4 V28 C2 13.4 13.4 2 28 2 Z"
          fill={`url(#${gradId})`}
        />
        {/* top-edge highlight */}
        <path
          d="M28 2 H58 a4 4 0 0 1 4 4 V8 H28 C15 8 8 15 8 28 V8 C8 4 20 2 28 2 Z"
          fill="#F4F7F2"
          opacity="0.18"
        />
        {/* central vein */}
        <path
          d="M14 50 C22 38 34 26 50 14"
          stroke={t.vein}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
          filter={`url(#${glowId})`}
          className={live ? "animate-breathe" : undefined}
        />
        <path d="M24 40 C30 36 33 33 36 28" stroke={t.vein} strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.4" />
        <path d="M30 46 C36 42 40 38 44 32" stroke={t.vein} strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.3" />
      </svg>
      <span
        className="relative z-10 flex items-center justify-center font-display font-semibold leading-none"
        style={{ color: t.ink, fontSize: size * 0.38 }}
      >
        {children}
      </span>
    </span>
  );
}

export const LeafGlyph = memo(LeafGlyphComponent);
export default LeafGlyph;
