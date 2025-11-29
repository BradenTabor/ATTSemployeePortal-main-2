import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number | null;
  loading: boolean;
  pageSize: number;
  onPreviousClick: () => void;
  onNextClick: () => void;
  label?: string; // e.g., "reports", "users", "items"
}

/**
 * Reusable pagination footer component
 * Use this on any list/history page to show consistent pagination UI
 * 
 * @example
 * ```typescript
 * <PaginationControls
 *   currentPage={currentPage}
 *   totalPages={totalPages}
 *   totalItems={totalReports}
 *   loading={loading}
 *   pageSize={pageSize}
 *   onPreviousClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
 *   onNextClick={() => setCurrentPage(prev => Math. min(totalPages, prev + 1))}
 *   label="reports"
 * />
 * ```
 */
export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  loading,
  pageSize,
  onPreviousClick,
  onNextClick,
  label = "items",
}: PaginationControlsProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems || 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col sm:flex-row items-center justify-between px-6 py-5 border-t border-white/10 bg-gradient-to-r from-black/40 to-black/20 gap-4"
    >
      {/* Left: Item Range */}
      <div className="text-sm text-gray-300 text-center sm:text-left">
        <span className="font-semibold text-green-400">{startItem}</span>
        {" - "}
        <span className="font-semibold text-green-400">{endItem}</span>
        {" of "}
        <span className="font-semibold text-green-400">{totalItems || 0}</span>
        <span className="text-gray-400"> {label}</span>
      </div>

      {/* Right: Navigation Buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={currentPage === 1 || loading}
          onClick={onPreviousClick}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-white/10 hover:border-white/20"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous</span>
        </motion.button>

        <div className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-gray-300 min-w-[100px] text-center">
          Page <span className="font-semibold text-white">{currentPage}</span> of{" "}
          <span className="font-semibold text-white">{totalPages}</span>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={currentPage >= totalPages || loading}
          onClick={onNextClick}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all border border-white/10 hover:border-white/20"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}