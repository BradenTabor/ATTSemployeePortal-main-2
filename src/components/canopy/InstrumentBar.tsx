import { memo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BrandMark } from "@/components/canopy/BrandMark";
import { useAuth } from "@/contexts/AuthContext";
import { getRoleDashboard } from "@/lib/navigation";
import { useNetworkStore } from "@/lib/networkStatus";
import { cn } from "@/lib/utils";
import { EASE_CANOPY } from "@/motion/presets";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  mechanic: "Mechanic",
  general_foreman: "General Foreman",
  safety_officer: "Safety Officer",
  foreman: "Foreman",
  employee: "Crew",
};

function useCentralClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const date = now
    .toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "2-digit" })
    .toUpperCase();
  return { time, date };
}

interface InstrumentBarProps {
  /** Page title rendered in the display face */
  title?: string;
  /** Visually hide the title (page renders its own h1) */
  hideTitle?: boolean;
  className?: string;
}

/**
 * InstrumentBar — the CANOPY app header. A thin instrument rail: brand mark,
 * page title in the display serif, and a live readout (Central time, link
 * status, role) set in the mono face. Back/return navigation is the sticky
 * <ReturnButton> dock, not the header, so it never scrolls out of reach.
 */
function InstrumentBarComponent({ title, hideTitle, className }: InstrumentBarProps) {
  const { role, fullName } = useAuth();
  const { time, date } = useCentralClock();
  const online = useNetworkStore((s) => s.isOnline);
  const home = getRoleDashboard(role);
  const initials = (fullName ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <header className={cn("relative w-full", className)}>
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            to={home}
            className="group tap-44 relative flex min-h-[44px] items-center gap-3 rounded-leaf-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-verdant-400"
            aria-label="Go to dashboard"
          >
            <BrandMark size={38} className="transition-transform duration-500 ease-canopy group-hover:-rotate-6" />
            <span className="hidden sm:flex flex-col leading-none">
              <span className="type-display text-[1.05rem] font-medium text-bone-50">
                All Terrain
              </span>
              <span className="type-instrument mt-1 text-verdant-300/80">Tree Service · Portal</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-baseline gap-2 font-mono text-[11px] tracking-[0.18em] text-bone-300">
            <span className="tabular-nums text-bone-100">{time}</span>
            <span className="text-ink-500">CT</span>
            <span className="text-ink-400">{date}</span>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
              online
                ? "border-verdant-400/30 bg-verdant-500/10 text-verdant-200"
                : "border-amber-400/40 bg-amber-500/10 text-amber-200"
            )}
            aria-live="polite"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className={cn("absolute inset-0 rounded-full", online ? "bg-verdant-400" : "bg-amber-400")} />
              {online && <span className="absolute inset-0 rounded-full bg-verdant-400 animate-pulse-ring" />}
            </span>
            <span className="hidden xs:inline">{online ? "Link" : "Offline"}</span>
          </span>

          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-bone-50/[0.1] bg-ink-900/70 py-1 pl-1 pr-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8DF5A8,#1F7A44)] font-display text-[11px] font-semibold text-ink-950">
              {initials || "•"}
            </span>
            <span className="type-instrument text-bone-300">{(role && ROLE_LABEL[role]) ?? role ?? "Guest"}</span>
          </span>
        </div>
      </div>

      <motion.div
        className="vein mt-4"
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, ease: EASE_CANOPY, delay: 0.1 }}
        aria-hidden
      />

      {title && !hideTitle && (
        <motion.p
          aria-hidden="true"
          className="type-display mt-5 text-[clamp(1.75rem,4.5vw,3rem)] font-light text-bone-50"
          initial={{ opacity: 0, y: "0.4em", filter: "blur(10px)" }}
          animate={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: EASE_CANOPY, delay: 0.15 }}
        >
          {title}
        </motion.p>
      )}
    </header>
  );
}

export const InstrumentBar = memo(InstrumentBarComponent);
export default InstrumentBar;
