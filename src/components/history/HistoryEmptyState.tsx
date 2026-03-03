import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileSearch } from "lucide-react";
import { BlurFade } from "../ui/blur-fade";
import { glass } from "../../lib/glass";
import { cn } from "../../lib/utils";

export interface HistoryEmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const defaultIcon = (
  <div className={`w-14 h-14 rounded-2xl ${glass.subtle} flex items-center justify-center`}>
    <FileSearch className="w-7 h-7 text-white/40" aria-hidden />
  </div>
);

export const HistoryEmptyState = memo(function HistoryEmptyState({
  title,
  description,
  icon = defaultIcon,
  action,
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
          glass.card,
          "px-6 py-14 sm:px-8 sm:py-20 flex flex-col items-center text-center",
          className
        )}
      >
        <div className="mb-4">{icon}</div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/50 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
        {action && <div className="mt-6">{action}</div>}
      </motion.div>
    </BlurFade>
  );
});

export default HistoryEmptyState;
