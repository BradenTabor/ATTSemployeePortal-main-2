import { memo } from "react";
import { motion } from "framer-motion";
import { AdvancedPagination } from "../ui/AdvancedPagination";
import { glass } from "../../lib/glass";
import { cn } from "../../lib/utils";

export interface HistoryPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  label?: string;
  variant?: "emerald" | "amber" | "purple";
  compact?: boolean;
  showPageSizeSelector?: boolean;
  className?: string;
}

export const HistoryPagination = memo(function HistoryPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  label = "items",
  variant = "emerald",
  compact = false,
  showPageSizeSelector = false,
  className,
}: HistoryPaginationProps) {
  if (totalItems === 0) return null;

  const rangeStart = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        glass.subtle,
        "flex flex-col gap-3 px-4 py-3.5 sm:px-5",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/40">
        <span>
          Showing{" "}
          <span className="font-medium text-white/60 tabular-nums">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          of{" "}
          <span className="font-medium text-white/60 tabular-nums">
            {totalItems.toLocaleString()}
          </span>{" "}
          {label}
        </span>
      </div>
      <AdvancedPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={showPageSizeSelector ? onPageSizeChange : undefined}
        showPageSizeSelector={showPageSizeSelector}
        showTotalItems={false}
        showJumpToPage={true}
        variant={variant}
        compact={compact}
      />
    </motion.div>
  );
});

export default HistoryPagination;
