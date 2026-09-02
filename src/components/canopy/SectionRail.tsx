import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { springSnappy } from "@/motion/presets";

export interface RailSection {
  id: string;
  label: string;
  /** Optional live count shown as a chip */
  count?: number;
}

interface SectionRailProps {
  sections: RailSection[];
  active: string;
  onJump: (id: string) => void;
  className?: string;
}

/**
 * SectionRail — the instrument index for a long page.
 * Desktop: a vertical rail of numbered labels pinned to the left with a moving
 * vein indicator. Mobile: a horizontal scrollable chip strip.
 */
export function SectionRail({ sections, active, onJump, className }: SectionRailProps) {
  return (
    <nav aria-label="Page sections" className={cn("relative", className)}>
      {/* desktop vertical */}
      <ul className="hidden lg:flex lg:flex-col lg:gap-1">
        {sections.map((s, i) => {
          const isActive = s.id === active;
          return (
            <li key={s.id} className="relative">
              <button
                type="button"
                onClick={() => onJump(s.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-leaf-xs py-2 pl-4 pr-3 text-left transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdant-400",
                  isActive ? "text-bone-50" : "text-bone-400 hover:text-bone-200"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="rail-indicator"
                    className="absolute inset-y-1 left-0 w-px bg-[linear-gradient(180deg,#B8FF7A,#3DDC84)] shadow-glow"
                    transition={springSnappy}
                  />
                )}
                <span className={cn("type-instrument w-5 tabular-nums", isActive ? "text-verdant-300" : "text-bone-50/30")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 truncate text-[13px] font-medium tracking-[-0.01em]">{s.label}</span>
                {s.count !== undefined && s.count > 0 && (
                  <span className="rounded-full border border-lime-400/40 bg-lime-400/10 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-lime-300">
                    {s.count}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* mobile horizontal */}
      <div className="mask-fade-x -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s, i) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onJump(s.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "tap-44 relative flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-verdant-400",
                isActive ? "border-verdant-400/60 bg-verdant-500/15 text-verdant-100" : "border-bone-50/[0.1] bg-ink-900/70 text-bone-300"
              )}
            >
              <span className="opacity-60">{String(i + 1).padStart(2, "0")}</span>
              {s.label}
              {s.count !== undefined && s.count > 0 && (
                <span className="rounded-full bg-lime-400 px-1.5 text-[9px] font-bold text-ink-950">{s.count}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default SectionRail;
