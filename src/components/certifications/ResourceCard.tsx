import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

const VARIANT_STYLES = {
  default: {
    accent: "border-l-emerald-500/60",
    accentVisited: "border-l-emerald-400/40",
    accentHover: "hover:border-l-emerald-500",
    hoverShadow:
      "hover:shadow-[0_20px_40px_rgba(0,0,0,0.3),0_0_20px_rgba(16,185,129,0.15)]",
    focusRing: "focus-visible:ring-emerald-500/50",
  },
  danger: {
    accent: "border-l-red-500/60",
    accentVisited: "border-l-red-400/40",
    accentHover: "hover:border-l-red-500",
    hoverShadow:
      "hover:shadow-[0_20px_40px_rgba(0,0,0,0.3),0_0_20px_rgba(239,68,68,0.15)]",
    focusRing: "focus-visible:ring-red-500/50",
  },
} as const;

const BASE_CLASS =
  "group relative overflow-hidden flex items-center justify-between gap-2 sm:gap-3 " +
  "min-h-[52px] rounded-xl border border-white/10 border-l-[3px] " +
  "bg-gradient-to-br from-gray-900 via-gray-900/95 to-gray-950 px-3 py-2.5 sm:px-4 sm:py-3 " +
  "text-left shadow-lg shadow-black/25 " +
  "before:content-[''] before:absolute before:inset-x-0 before:top-0 before:h-px " +
  "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:pointer-events-none " +
  "hover:border-white/15 hover:scale-[1.01] " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 " +
  "transition-[transform,box-shadow,border-color] duration-150 will-change-transform";

export interface ResourceCardProps {
  to: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Optional override for link aria-label; defaults to title */
  ariaLabel?: string;
  /** Controls accent color — "danger" for emergency cards */
  variant?: "default" | "danger";
  /** Dims card when user has previously visited the link */
  visited?: boolean;
  /** Callback fired on click, before navigation */
  onClick?: () => void;
}

export function ResourceCard({
  to,
  title,
  subtitle,
  ariaLabel,
  variant = "default",
  visited = false,
  onClick,
}: ResourceCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        BASE_CLASS,
        visited ? styles.accentVisited : styles.accent,
        styles.accentHover,
        styles.hoverShadow,
        styles.focusRing,
        visited && "opacity-80",
      )}
      aria-label={ariaLabel ?? title}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        {subtitle != null && (
          <p className="truncate text-xs text-white/60 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-white/30 transition-[color,transform] duration-150 ease-out group-hover:text-white/60 group-hover:translate-x-0.5"
        strokeWidth={1.5}
        aria-hidden
      />
    </Link>
  );
}
