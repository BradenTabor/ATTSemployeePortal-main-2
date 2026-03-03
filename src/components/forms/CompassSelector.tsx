/**
 * CompassSelector: visual 8-direction compass rose for selecting direction.
 * Used for lean direction, fall path, and retreat path in Tree Felling JSA.
 */

import { useMemo } from "react";
import { cn } from "../../lib/utils";
import type { CompassDirection } from "../../types/treeFelling";

const DIRECTIONS: CompassDirection[] = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
];

// Position each label around the circle (N at top, then clockwise)
const ANGLE_BY_DIR: Record<CompassDirection, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

export interface CompassSelectorProps {
  value: CompassDirection | null;
  onChange: (dir: CompassDirection) => void;
  label: string;
  className?: string;
  "aria-describedby"?: string;
}

export function CompassSelector({
  value,
  onChange,
  label,
  className,
  "aria-describedby": ariaDescribedby,
}: CompassSelectorProps) {
  const radius = 44;
  const center = 52;

  const buttons = useMemo(() => {
    return DIRECTIONS.map((dir) => {
      const angleDeg = ANGLE_BY_DIR[dir];
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = center + radius * Math.sin(angleRad);
      const y = center - radius * Math.cos(angleRad);
      return { dir, x, y };
    });
  }, []);

  return (
    <fieldset className={cn("space-y-2", className)}>
      <legend className="text-sm font-medium text-white">{label}</legend>
      {ariaDescribedby && (
        <p id={ariaDescribedby} className="sr-only">
          Select one of eight compass directions by clicking or using keyboard.
        </p>
      )}
      <div
        className="relative inline-block w-[104px] h-[104px] rounded-full border border-white/20 bg-white/5"
        role="group"
        aria-label={label}
      >
        {buttons.map(({ dir, x, y }) => (
          <button
            key={dir}
            type="button"
            onClick={() => onChange(dir)}
            className={cn(
              "absolute w-8 h-8 rounded-full text-xs font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]",
              value === dir
                ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/50"
                : "bg-white/10 text-white/80 border border-white/10 hover:bg-white/20"
            )}
            style={{
              left: `${x - 16}px`,
              top: `${y - 16}px`,
            }}
            aria-pressed={value === dir}
            aria-label={`Direction ${dir}`}
          >
            {dir}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
