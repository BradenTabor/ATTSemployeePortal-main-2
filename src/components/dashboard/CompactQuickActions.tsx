import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import AdaptiveCardWrapper from "../AdaptiveCardWrapper";

interface QuickActionLink {
  label: string;
  description?: string;
  path: string;
  icon?: LucideIcon;
  gradient?: string;
  border?: string;
  glow?: string;
  iconBg?: string;
  iconAccent?: string;
}

interface CompactQuickActionsProps {
  links: QuickActionLink[];
  className?: string;
}

const DEFAULT_STYLES = {
  gradient: "from-[#1b5f43]/70 via-[#04130d] to-[#010604]",
  border: "border-[#2a8a63]/40",
  glow: "from-[#33c38a]/20 to-transparent",
  iconBg: "bg-[#1c7a57]/30 border border-[#2e9b6e]/40",
  iconAccent: "text-emerald-200",
};

/**
 * CompactQuickActions - mobile-first quick action tiles.
 * - Mobile (<768px): single-column vertical list with compact tiles
 * - Desktop (md+): 2-column grid with fuller card styling
 */
export default function CompactQuickActions({
  links,
  className,
}: CompactQuickActionsProps) {
  if (links.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        // Mobile: single column, compact gap
        "grid grid-cols-1 gap-2",
        // Desktop: 2 columns, slightly larger gap
        "md:grid-cols-2 md:gap-4",
        className
      )}
    >
      {links.map((link, idx) => (
        <CompactActionTile key={link.path} link={link} index={idx} />
      ))}
    </div>
  );
}

interface CompactActionTileProps {
  link: QuickActionLink;
  index: number;
}

function CompactActionTile({ link, index }: CompactActionTileProps) {
  const Icon = link.icon;
  const gradient = link.gradient ?? DEFAULT_STYLES.gradient;
  const border = link.border ?? DEFAULT_STYLES.border;
  const glow = link.glow ?? DEFAULT_STYLES.glow;
  const iconBg = link.iconBg ?? DEFAULT_STYLES.iconBg;
  const iconAccent = link.iconAccent ?? DEFAULT_STYLES.iconAccent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link to={link.path} className="block">
        <AdaptiveCardWrapper>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "relative w-full p-[1px] rounded-2xl overflow-hidden shadow-md bg-gradient-to-br group",
              gradient
            )}
          >
            <div
              className={cn(
                "w-full rounded-2xl bg-black/70 backdrop-blur-xl border transition-all duration-300",
                border,
                // Mobile: compact padding
                "p-3 flex items-center gap-3",
                // Desktop: fuller card
                "md:p-4 md:flex-col md:items-start md:gap-3"
              )}
            >
              {/* Icon */}
              {Icon && (
                <div
                  className={cn(
                    "rounded-xl flex items-center justify-center flex-shrink-0",
                    iconBg,
                    // Mobile: smaller icon container
                    "w-9 h-9",
                    // Desktop: larger
                    "md:w-11 md:h-11"
                  )}
                >
                  <Icon className={cn("w-4 h-4 md:w-5 md:h-5", iconAccent)} />
                </div>
              )}

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-white font-semibold truncate",
                    // Mobile: smaller text
                    "text-sm",
                    // Desktop: larger
                    "md:text-base"
                  )}
                >
                  {link.label}
                </p>
                {link.description && (
                  <p
                    className={cn(
                      "text-white/60 leading-snug",
                      // Mobile: hidden or very short
                      "hidden md:block text-xs mt-1 line-clamp-2"
                    )}
                  >
                    {link.description}
                  </p>
                )}
              </div>

              {/* Chevron on mobile */}
              <ChevronRight
                className={cn(
                  "w-4 h-4 text-white/40 flex-shrink-0 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all",
                  "md:hidden"
                )}
              />
            </div>

            {/* Glow overlay */}
            <div
              className={cn(
                "absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity",
                glow
              )}
            />
          </motion.div>
        </AdaptiveCardWrapper>
      </Link>
    </motion.div>
  );
}

