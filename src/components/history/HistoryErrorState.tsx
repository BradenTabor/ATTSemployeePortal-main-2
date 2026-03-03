import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { BlurFade } from "../ui/blur-fade";
import { cn } from "../../lib/utils";

export interface HistoryErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const HistoryErrorState = memo(function HistoryErrorState({
  message,
  onRetry,
  className,
}: HistoryErrorStateProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <BlurFade delay={0.1} inView={false}>
      <motion.div
        role="alert"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
        }
        className={cn(
          "rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-4 sm:px-5 flex items-center gap-3",
          className
        )}
      >
        <div className="p-1.5 rounded-lg bg-red-500/10 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-red-300" aria-hidden />
        </div>
        <p className="text-sm text-red-200 flex-1">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-medium text-red-300 hover:text-red-200 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
          >
            Retry
          </button>
        )}
      </motion.div>
    </BlurFade>
  );
});

export default HistoryErrorState;
