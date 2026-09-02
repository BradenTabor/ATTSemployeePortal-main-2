import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EyebrowProps {
  children: ReactNode;
  /** Optional index / counter shown before the label, e.g. "01" */
  index?: string | number;
  className?: string;
  /** Extend a vein hairline to the right */
  rule?: boolean;
  tone?: EyebrowTone;
}

export type EyebrowTone = "verdant" | "bone" | "safety" | "lime" | "glacier" | "moss" | "red";

const TONE: Record<EyebrowTone, string> = {
  verdant: "text-verdant-300",
  bone: "text-bone-300",
  safety: "text-rose-300",
  red: "text-red-300",
  lime: "text-lime-400",
  glacier: "text-glacier-300",
  moss: "text-moss-300",
};

/**
 * Eyebrow — the instrument label. Martian Mono, tracked wide, with an optional
 * counter and a living hairline. Used above every section of the canopy.
 */
export function Eyebrow({ children, index, className, rule = true, tone = "verdant" }: EyebrowProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {index !== undefined && (
        <span className={cn("type-instrument tabular-nums opacity-70", TONE[tone])}>{String(index).padStart(2, "0")}</span>
      )}
      <span className={cn("type-instrument", TONE[tone])}>{children}</span>
      {rule && <span className="vein flex-1 opacity-60" aria-hidden />}
    </div>
  );
}

export default Eyebrow;
