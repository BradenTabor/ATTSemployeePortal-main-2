import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { ReactNode } from "react";
import AdaptiveCardWrapper from "./AdaptiveCardWrapper";

type CardVariant = "emerald" | "gold" | "ember";

interface BrandedNavCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  to: string;
  variant?: CardVariant;
}

const VARIANT_STYLES = {
  emerald: {
    outer:
      "bg-gradient-to-br from-green-600/70 via-black/80 to-green-800/80 hover:from-green-500 hover:via-black hover:to-green-700",
    inner:
      "border border-[rgba(11,132,92,0.3)] items-center text-center text-white/80",
    innerStyle: {
      background:
        "linear-gradient(90deg, rgba(0, 0, 0, 0.7) 0%, rgba(11, 132, 92, 1) 50%, rgba(12, 39, 19, 1) 100%)",
    },
    iconWrapper: "mb-3 text-green-400",
    title: "text-white",
    description: "text-white/80",
    overlay: "bg-gradient-to-br from-green-500/10 to-transparent",
  },
  gold: {
    outer:
      "bg-gradient-to-br from-[#f9e7c4]/20 via-[#0b0a07] to-[#1b150e] border border-[#f7ddb4]/30 hover:border-[#f6dcb2]/60 hover:shadow-[0_25px_50px_rgba(0,0,0,0.6)]",
    inner:
      "border border-[#f6dcb2]/25 items-start text-left text-[#f8e5bb]/80 shadow-[0_20px_45px_rgba(0,0,0,0.55)]",
    innerStyle: {
      background: "linear-gradient(51.63deg, rgba(0, 0, 0, 1) 5%, rgba(147, 98, 6, 1) 11.25%, rgba(84, 55, 3, 1) 17.5%, rgba(104, 69, 3, 1) 30%, rgba(147, 98, 6, 1) 42%, rgba(189, 126, 10, 1) 54%, rgba(234, 216, 123, 1) 66.5%, rgba(244, 159, 1, 1) 79%, rgba(245, 245, 245, 1) 90%, rgba(251, 190, 75, 1) 100%)",
    },
    iconWrapper:
      "mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef3d1]/10 border border-[#f4c979]/40 text-[#f4c979]",
    title: "text-[#fff6dd]",
    description: "text-[#f8e5bb]/80",
    overlay: "bg-gradient-to-br from-[#f4c979]/15 via-transparent to-transparent",
  },
  ember: {
    outer:
      "bg-gradient-to-br from-[#341109]/80 via-[#120504] to-[#050201] border border-[#f59a71]/35 hover:border-[#ffb089]/60 hover:shadow-[0_25px_45px_rgba(0,0,0,0.65)]",
    inner:
      "border border-[#f38d57]/35 items-start text-left text-[#ffd4b8]/85 shadow-[0_20px_45px_rgba(0,0,0,0.6)]",
    innerStyle: {
      background:
        "linear-gradient(36.85deg, rgba(0, 0, 0, 1) 0%, rgba(71, 28, 6, 1) 12.5%, rgba(101, 39, 6, 1) 25%, rgba(137, 53, 11, 1) 37.5%, rgba(158, 59, 5, 1) 50%, rgba(228, 84, 7, 1) 62.5%, rgba(255, 129, 61, 1) 75%, rgba(255, 209, 184, 1) 100%)",
    },
    iconWrapper:
      "mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#ffb47a]/10 border border-[#ff9350]/40 text-[#ff9d5f]",
    title: "text-[#ffe4c9]",
    description: "text-[#ffd4b8]/80",
    overlay: "bg-gradient-to-br from-[#ff8f57]/15 via-transparent to-transparent",
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
            style={selected.innerStyle}
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
