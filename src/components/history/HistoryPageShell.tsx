import { memo } from "react";
import { Search, Activity } from "lucide-react";
import { BlurFade } from "../ui/blur-fade";
import { cn } from "../../lib/utils";

export interface HistoryPageShellProps {
  /** e.g. "Safety compliance" */
  subtitle: string;
  /** e.g. "Job Safety Analysis History" */
  title: string;
  /** Short description below title */
  description: string;
  /** Badge text, e.g. "Auto-synced" */
  badgeLabel?: string;
  /** Search value */
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Placeholder for search input */
  searchPlaceholder: string;
  /** Hint below search, e.g. "Search by location, circuit..." */
  filterHint: string;
  /** Optional extra class for the outer wrapper */
  className?: string;
  /** Accent color variant */
  variant?: "emerald" | "amber";
}

const variantStyles = {
  emerald: {
    subtitle: "text-emerald-200/80",
    badge: "text-emerald-300",
    inputFocus: "focus:border-emerald-400 focus:ring-emerald-400/40",
    filterBg: "bg-emerald-950/40",
  },
  amber: {
    subtitle: "text-amber-200/80",
    badge: "text-amber-300",
    inputFocus: "focus:border-amber-400 focus:ring-amber-400/40",
    filterBg: "bg-amber-950/30",
  },
};

export const HistoryPageShell = memo(function HistoryPageShell({
  subtitle,
  title,
  description,
  badgeLabel = "Auto-synced",
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filterHint,
  className,
  variant = "emerald",
}: HistoryPageShellProps) {
  const s = variantStyles[variant];

  return (
    <div className={cn("w-full max-w-6xl mx-auto space-y-6", className)}>
      <BlurFade delay={0} duration={0.4} direction="up" offset={8} inView={false}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className={cn("text-xs uppercase tracking-[0.35em] font-medium", s.subtitle)}>
              {subtitle}
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight mt-1">
              {title}
            </h2>
            <p className="text-sm text-white/70 mt-2 max-w-2xl leading-relaxed">
              {description}
            </p>
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2",
              "text-xs tracking-[0.35em] text-white/60 font-medium",
              "bg-gradient-to-r from-white/5 via-transparent to-transparent",
              "backdrop-blur-sm"
            )}
          >
            <Activity className={cn("w-4 h-4", s.badge)} aria-hidden />
            {badgeLabel}
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.08} duration={0.4} direction="up" offset={8} inView={false}>
        <div
          className={cn(
            "rounded-2xl border border-white/10 backdrop-blur-xl p-4 sm:p-5 space-y-4",
            s.filterBg
          )}
        >
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.35em] text-white/50 font-medium">
              Quick filters
            </p>
            <p className="text-sm text-white/60">{filterHint}</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" aria-hidden />
              <input
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  "w-full rounded-xl bg-white/5 border border-white/10 pl-11 pr-4 py-2.5",
                  "text-sm text-white placeholder:text-white/40 outline-none transition",
                  "hover:border-white/20",
                  "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                  s.inputFocus,
                  "focus:ring-2"
                )}
                aria-label="Search"
              />
            </div>
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-white/70 text-sm font-medium hover:text-white hover:border-white/30 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent transition-all outline-none"
                aria-label="Clear search"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      </BlurFade>
    </div>
  );
});

export default HistoryPageShell;
