import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileSearch } from "lucide-react";
import { BlurFade } from "../ui/blur-fade";
import { cn } from "../../lib/utils";

export interface HistoryEmptyStateProps {
  /** Primary heading, e.g. "No JSAs match your filters" */
  title: string;
  /** Supporting text: empty vs filtered message */
  description: string;
  /** Accent icon; default FileSearch */
  icon?: React.ReactNode;
  /** Optional extra class for the container */
  className?: string;
}

const defaultIcon = (
  <FileSearch className="w-12 h-12 text-emerald-300/90" aria-hidden />
);

export const HistoryEmptyState = memo(function HistoryEmptyState({
  title,
  description,
  icon = defaultIcon,
  className,
}: HistoryEmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <BlurFade delay={0.1} inView={false}>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
        }
        className={cn(
          "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-12 sm:px-8 sm:py-16 text-center space-y-4",
          className
        )}
      >
        <div className="flex justify-center">{icon}</div>
        <h3 className="text-lg sm:text-xl font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/60 max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </motion.div>
    </BlurFade>
  );
});

export default HistoryEmptyState;
