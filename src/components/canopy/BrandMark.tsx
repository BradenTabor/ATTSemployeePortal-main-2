import { memo } from "react";
import logo from "@/assets/atts-logo.webp";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** Tile size in px */
  size?: number;
  className?: string;
  /** Adds the slow bioluminescent breathing halo */
  live?: boolean;
}

/**
 * BrandMark — the ATTS logo set into a bone leaf tile.
 *
 * The source logo is black lettering on transparency, which vanishes on the
 * ink background; the tile gives it a legible ground and the leaf shape ties
 * it to the Canopy system. The artwork has generous transparent padding, so
 * it is scaled up inside the clipped tile.
 */
function BrandMarkComponent({ size = 40, className, live = false }: BrandMarkProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {live && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-leaf-xs bg-verdant-400/40 blur-lg animate-breathe"
        />
      )}
      <span
        className="relative block h-full w-full overflow-hidden rounded-leaf-xs border border-bone-50/40 bg-[linear-gradient(160deg,#FFFFFF_0%,#E4EAE1_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_18px_-6px_rgba(61,220,132,0.45)]"
      >
        <img
          src={logo}
          alt="ATTS"
          // @ts-expect-error fetchpriority is valid HTML but missing from React types
          fetchpriority="high"
          decoding="async"
          className="h-full w-full scale-[1.9] object-contain"
          style={{ objectPosition: "50% 52%" }}
        />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,#3DDC84,transparent)]" />
      </span>
    </span>
  );
}

export const BrandMark = memo(BrandMarkComponent);
export default BrandMark;
