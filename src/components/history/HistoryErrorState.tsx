import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { BlurFade } from "../ui/blur-fade";
import { cn } from "../../lib/utils";

export interface HistoryErrorStateProps {
  /** User-friendly error message */
  message: string;
  /** Optional extra class for the container */
  className?: string;
}

export const HistoryErrorState = memo(function HistoryErrorState({
  message,
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
          "rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 sm:px-5 sm:py-4 text-sm text-red-100 flex items-center gap-3",
          className
        )}
      >
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-300" aria-hidden />
        <p>{message}</p>
      </motion.div>
    </BlurFade>
  );
});

export default HistoryErrorState;
