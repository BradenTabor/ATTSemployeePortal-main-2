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
}

export default function BrandedNavCard({
  title,
  description,
  icon,
  to,
}: BrandedNavCardProps) {
  return (
    <Link to={to}>
      <AdaptiveCardWrapper>
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "relative w-full max-w-sm p-[2px] rounded-2xl overflow-hidden shadow-lg",
            "bg-gradient-to-br from-green-600/70 via-black/80 to-green-800/80",
            "hover:from-green-500 hover:via-black hover:to-green-700",
            "transition-all duration-300 ease-out"
          )}
        >
          <div
            className={cn(
              "h-full w-full rounded-2xl p-6 flex flex-col justify-center items-center text-center",
              "bg-black/70 backdrop-blur-xl",
              "border border-green-700/30"
            )}
          >
            {icon && <div className="mb-3 text-green-400">{icon}</div>}
            <h3 className="text-xl sm:text-2xl font-semibold text-white mb-2 tracking-wide">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-white/80 max-w-xs">{description}</p>
            )}
          </div>

          {/* Subtle glowing overlay */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-green-500/10 to-transparent" />
        </motion.div>
      </AdaptiveCardWrapper>
    </Link>
  );
}
