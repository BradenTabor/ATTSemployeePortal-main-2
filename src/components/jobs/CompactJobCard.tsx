import { memo } from "react";
import { motion } from "framer-motion";
import { MapPin, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
import { calculateJobProgress, getProgressStatusColors } from "../../lib/jobProgressUtils";
import type { JobProgressTracker } from "../../types/jobs";

interface CompactJobCardProps {
  job: JobProgressTracker;
  onClick?: () => void;
  index?: number;
}

/**
 * CompactJobCard - A condensed job card for dashboard lists.
 * Shows job name, location, progress percentage, and exceeded badge.
 * Fully accessible and keyboard navigable.
 */
function CompactJobCardComponent({ job, onClick, index = 0 }: CompactJobCardProps) {
  const progress = calculateJobProgress(job.start_date, job.end_date);
  const colors = getProgressStatusColors(progress.status);
  const isExceeded = progress.status === "exceeded";

  const handleClick = () => {
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`${job.job_name}, ${progress.percentage}% complete${isExceeded ? ", timeline exceeded" : ""}`}
        className={cn(
          "group relative w-full rounded-xl border transition-all duration-200 cursor-pointer",
          "bg-[#041b14]/70 hover:bg-[#052a1c]/80",
          isExceeded
            ? "border-red-500/40 hover:border-red-500/60"
            : "border-[#1f5f46]/40 hover:border-emerald-500/50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04150f]"
        )}
      >
        <div className="flex items-center gap-3 p-3">
          {/* Job info - left side */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-100 transition-colors">
              {job.job_name}
            </p>
            {job.job_location && (
              <p className="flex items-center gap-1.5 text-xs text-white/50 mt-0.5 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{job.job_location}</span>
              </p>
            )}
          </div>

          {/* Progress indicator - right side */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {/* Progress percentage */}
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                colors.text
              )}
            >
              {progress.percentage}%
            </span>

            {/* Mini progress bar */}
            <div
              className={cn(
                "w-16 h-1.5 rounded-full overflow-hidden",
                isExceeded ? "bg-red-900/30" : "bg-white/10"
              )}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full bg-gradient-to-r",
                  colors.gradient
                )}
              />
            </div>
          </div>
        </div>

        {/* Exceeded badge - shown inline on mobile */}
        {isExceeded && (
          <div className="px-3 pb-2.5 -mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-semibold">
              <AlertTriangle className="w-2.5 h-2.5" />
              {progress.daysExceeded}d over
            </span>
          </div>
        )}

        {/* Hover glow effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity",
            "bg-gradient-to-r",
            isExceeded
              ? "from-red-500/5 to-transparent"
              : "from-emerald-500/5 to-transparent"
          )}
        />
      </div>
    </motion.div>
  );
}

export const CompactJobCard = memo(CompactJobCardComponent);

