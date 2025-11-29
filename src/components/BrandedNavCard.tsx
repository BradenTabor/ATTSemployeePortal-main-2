import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { ReactNode } from "react";
import AdaptiveCardWrapper from "./AdaptiveCardWrapper";

interface BrandedNavCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  to: string;
  variant?: "emerald" | "gold";
}

const VARIANT_STYLES = {
  emerald: {
    outer:
      "bg-gradient-to-br from-green-600/70 via-black/80 to-green-800/80 hover:from-green-500 hover:via-black hover:to-green-700",
    inner:
      "bg-black/70 border border-green-700/30 items-center text-center text-white/80",
    iconWrapper: "mb-3 text-green-400",
    title: "text-white",
    description: "text-white/80",
    overlay: "bg-gradient-to-br from-green-500/10 to-transparent",
  },
  gold: {
    outer:
      "bg-gradient-to-br from-[#f9e7c4]/20 via-[#0b0a07] to-[#1b150e] border border-[#f7ddb4]/30 hover:border-[#f6dcb2]/60 hover:shadow-[0_25px_50px_rgba(0,0,0,0.6)]",
    inner:
      "bg-[#050402]/85 border border-[#f6dcb2]/25 items-start text-left text-[#f8e5bb]/80 shadow-[0_20px_45px_rgba(0,0,0,0.55)]",
    iconWrapper:
      "mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef3d1]/10 border border-[#f4c979]/40 text-[#f4c979]",
    title: "text-[#fff6dd]",
    description: "text-[#f8e5bb]/80",
    overlay: "bg-gradient-to-br from-[#f4c979]/15 via-transparent to-transparent",
  },
};

export default function BrandedNavCard({
  title,
  description,
  icon,
  to,
  variant = "emerald",
}: BrandedNavCardProps) {
  const selected = VARIANT_STYLES[variant] ?? VARIANT_STYLES.emerald;

  return (
    <Link to={to}>
      <AdaptiveCardWrapper>
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "relative w-full max-w-sm p-[2px] rounded-2xl overflow-hidden shadow-lg transition-all duration-300 ease-out",
            selected.outer
          )}
        >
          <div
            className={cn(
              "h-full w-full rounded-2xl p-6 flex flex-col gap-2 backdrop-blur-xl",
              selected.inner
            )}
          >
            {icon && <div className={selected.iconWrapper}>{icon}</div>}
            <h3
              className={cn(
                "text-xl sm:text-2xl font-semibold tracking-wide",
                selected.title
              )}
            >
              {title}
            </h3>
            {description && (
              <p className={cn("text-sm max-w-xs", selected.description)}>
                {description}
              </p>
            )}
          </div>

          {/* Subtle glowing overlay */}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl pointer-events-none",
              selected.overlay
            )}
          />
        </motion.div>
      </AdaptiveCardWrapper>
    </Link>
  );
}
