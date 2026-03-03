import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowLeft, X } from "lucide-react";
import { BlurFade } from "../ui/blur-fade";
import { cn } from "../../lib/utils";

export interface HistoryPageShellProps {
  subtitle: string;
  title: string;
  description: string;
  badgeLabel?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filterHint?: string;
  className?: string;
  variant?: "emerald" | "amber";
  totalCount?: number | null;
  backTo?: string;
}

const variantStyles = {
  emerald: {
    subtitle: "text-emerald-200/80",
    badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    inputFocus:
      "focus-visible:border-emerald-400/50 focus-visible:ring-2 focus-visible:ring-emerald-400/30",
    clearBtn: "hover:bg-emerald-500/10 hover:text-emerald-300",
  },
  amber: {
    subtitle: "text-amber-200/80",
    badge: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    inputFocus:
      "focus-visible:border-amber-400/50 focus-visible:ring-2 focus-visible:ring-amber-400/30",
    clearBtn: "hover:bg-amber-500/10 hover:text-amber-300",
  },
};

export const HistoryPageShell = memo(function HistoryPageShell({
  subtitle,
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filterHint,
  className,
  variant = "emerald",
  totalCount,
  backTo = "/forms-history",
}: HistoryPageShellProps) {
  const s = variantStyles[variant];
  const navigate = useNavigate();

  const handleClear = useCallback(() => onSearchChange(""), [onSearchChange]);

  return (
    <div className={cn("w-full space-y-5", className)}>
      <BlurFade delay={0} duration={0.4} direction="up" offset={8} inView={false}>
        <div>
          {/* Back navigation */}
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded-lg px-1 -ml-1"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Forms History
          </button>

          {/* Title block */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "text-xs uppercase tracking-[0.35em] font-medium",
                  s.subtitle
                )}
              >
                {subtitle}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                {title}
              </h2>
              <p className="text-sm text-white/60 mt-1.5 max-w-xl leading-relaxed">
                {description}
              </p>
            </div>
            {totalCount != null && (
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 shadow-sm",
                  "text-xs font-semibold tracking-wide tabular-nums",
                  s.badge
                )}
              >
                {totalCount.toLocaleString()} total
              </div>
            )}
          </div>
        </div>
      </BlurFade>

      {/* Compact search bar */}
      <BlurFade delay={0.06} duration={0.4} direction="up" offset={8} inView={false}>
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
            aria-hidden
          />
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              "w-full rounded-xl bg-gray-800 border border-white/[0.06] pl-11 pr-10 py-3",
              "text-base text-white placeholder:text-white/30 outline-none transition-all duration-150",
              "hover:border-white/[0.08]",
              "focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950",
              s.inputFocus
            )}
            aria-label="Search submissions"
          />
          {filterHint && (
            <p className="mt-2 text-xs text-white/50">{filterHint}</p>
          )}
          {searchValue && (
            <button
              type="button"
              onClick={handleClear}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/40 transition-colors",
                s.clearBtn,
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              )}
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </BlurFade>
    </div>
  );
});

export default HistoryPageShell;
