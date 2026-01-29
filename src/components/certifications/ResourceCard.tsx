import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import attsLogoStamped from "../../assets/ATTS_Logo_stamped.png";

const CARD_CLASS =
  "group flex min-h-[44px] items-center justify-between gap-1.5 rounded-lg sm:rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-neutral-900/60 backdrop-blur-sm p-2.5 sm:p-3 text-left shadow-md transition-all sm:gap-3 hover:border-emerald-500/40 hover:bg-gradient-to-br hover:from-emerald-950/50 hover:to-neutral-900/70 hover:shadow-lg hover:shadow-emerald-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400";
const LOGO_CLASS = "h-8 w-8 object-contain sm:h-10 sm:w-10";

export interface ResourceCardProps {
  to: string;
  title: string;
  subtitle?: React.ReactNode;
  /** Optional override for link aria-label; defaults to title */
  ariaLabel?: string;
}

export function ResourceCard({ to, title, subtitle, ariaLabel }: ResourceCardProps) {
  return (
    <Link
      to={to}
      className={CARD_CLASS}
      aria-label={ariaLabel ?? title}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        <div className="flex shrink-0 items-center justify-center" aria-hidden>
          <img src={attsLogoStamped} alt="" className={LOGO_CLASS} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-white sm:text-sm">{title}</p>
          {subtitle != null && (
            <p className="truncate text-[10px] leading-tight text-emerald-100/80 font-medium sm:text-xs">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-emerald-300 transition-colors group-hover:text-emerald-200" aria-hidden />
    </Link>
  );
}
