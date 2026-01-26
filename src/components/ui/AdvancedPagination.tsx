import { memo, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react";

interface AdvancedPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showTotalItems?: boolean;
  showJumpToPage?: boolean;
  variant?: "emerald" | "amber" | "purple";
  compact?: boolean;
}

const variantStyles = {
  emerald: {
    active: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30",
    hover: "hover:bg-emerald-500/20 hover:text-emerald-300",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/20",
    ring: "focus:ring-emerald-500/50",
  },
  amber: {
    active: "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30",
    hover: "hover:bg-amber-500/20 hover:text-amber-300",
    border: "border-amber-500/20",
    text: "text-amber-400",
    glow: "shadow-amber-500/20",
    ring: "focus:ring-amber-500/50",
  },
  purple: {
    active: "bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg shadow-purple-500/30",
    hover: "hover:bg-purple-500/20 hover:text-purple-300",
    border: "border-purple-500/20",
    text: "text-purple-400",
    glow: "shadow-purple-500/20",
    ring: "focus:ring-purple-500/50",
  },
};

export const AdvancedPagination = memo(function AdvancedPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 25, 50],
  showPageSizeSelector = true,
  showTotalItems = true,
  showJumpToPage = true,
  variant = "emerald",
  compact = false,
}: AdvancedPaginationProps) {
  const [jumpInputVisible, setJumpInputVisible] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const styles = variantStyles[variant];

  // Calculate visible page numbers
  const visiblePages = useMemo(() => {
    const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [];
    const maxVisible = compact ? 3 : 5;
    
    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small enough
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate range around current page
      const end = Math.min(totalPages - 1, Math.max(2, currentPage - Math.floor(maxVisible / 2)) + maxVisible - 1);
      const start = end === totalPages - 1 
        ? Math.max(2, end - maxVisible + 1) 
        : Math.max(2, currentPage - Math.floor(maxVisible / 2));
      
      // Add ellipsis if needed before range
      if (start > 2) {
        pages.push("ellipsis-start");
      }
      
      // Add range
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Add ellipsis if needed after range
      if (end < totalPages - 1) {
        pages.push("ellipsis-end");
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  }, [currentPage, totalPages, compact]);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(jumpValue);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpInputVisible(false);
      setJumpValue("");
    }
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalPages <= 1 && !showTotalItems) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`flex flex-wrap items-center justify-between gap-3 ${compact ? "text-xs" : "text-sm"}`}
    >
      {/* Left side - Total items info */}
      <div className="flex items-center gap-3">
        {showTotalItems && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-white/50 text-xs"
          >
            <span className="text-white/70 font-medium">{startItem}-{endItem}</span>
            <span className="mx-1">of</span>
            <span className="text-white/70 font-medium">{totalItems.toLocaleString()}</span>
          </motion.div>
        )}

        {showPageSizeSelector && onPageSizeChange && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-2"
          >
            <span className="text-white/40 text-xs hidden sm:inline">Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={`bg-black/30 border ${styles.border} rounded-lg px-2 py-1.5 text-xs text-white/80 
                focus:outline-none focus:ring-1 ${styles.ring} appearance-none cursor-pointer 
                transition-all hover:bg-white/5 min-w-[60px]`}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </motion.div>
        )}
      </div>

      {/* Right side - Pagination controls */}
      <div className="flex items-center gap-1">
        {/* First page button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed 
            text-white/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${styles.ring} ${styles.hover}`}
          title="First page"
          aria-label="Go to first page"
        >
          <ChevronsLeft className="w-4 h-4" aria-hidden />
        </motion.button>

        {/* Previous page button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed 
            text-white/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${styles.ring} ${styles.hover}`}
          title="Previous page"
          aria-label="Go to previous page"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </motion.button>

        {/* Page numbers */}
        <div className="flex items-center gap-0.5 mx-1">
          <AnimatePresence mode="popLayout">
            {visiblePages.map((page, index) => {
              if (page === "ellipsis-start" || page === "ellipsis-end") {
                return (
                  <motion.button
                    key={page}
                    type="button"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => {
                      if (showJumpToPage) {
                        setJumpInputVisible(true);
                      }
                    }}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-white/40 
                      ${showJumpToPage ? `${styles.hover} cursor-pointer focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${styles.ring}` : "cursor-default"}`}
                    title={showJumpToPage ? "Jump to page" : undefined}
                    aria-label={showJumpToPage ? "Jump to page" : undefined}
                  >
                    <MoreHorizontal className="w-4 h-4" aria-hidden />
                  </motion.button>
                );
              }

              const isActive = page === currentPage;
              return (
                <motion.button
                  key={page}
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.02 }}
                  whileHover={!isActive ? { scale: 1.1 } : undefined}
                  whileTap={!isActive ? { scale: 0.95 } : undefined}
                  onClick={() => onPageChange(page)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${styles.ring}
                    ${isActive 
                      ? styles.active
                      : `text-white/60 ${styles.hover} border border-white/5`
                    }`}
                  aria-label={isActive ? `Page ${page}, current page` : `Go to page ${page}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {page}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Next page button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed 
            text-white/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${styles.ring} ${styles.hover}`}
          title="Next page"
          aria-label="Go to next page"
        >
          <ChevronRight className="w-4 h-4" aria-hidden />
        </motion.button>

        {/* Last page button */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={`p-1.5 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed 
            text-white/50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${styles.ring} ${styles.hover}`}
          title="Last page"
          aria-label="Go to last page"
        >
          <ChevronsRight className="w-4 h-4" aria-hidden />
        </motion.button>
      </div>

      {/* Jump to page modal */}
      <AnimatePresence>
        {jumpInputVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setJumpInputVisible(false)}
          >
            <motion.form
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              exit={{ y: 20 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleJumpSubmit}
              className={`bg-[#0a0a0a] border ${styles.border} rounded-2xl p-4 shadow-2xl ${styles.glow}`}
            >
              <div className="text-sm text-white/70 mb-3">Jump to page</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpValue}
                  onChange={(e) => setJumpValue(e.target.value)}
                  placeholder={`1 - ${totalPages}`}
                  autoFocus
                  className={`w-24 bg-black/50 border ${styles.border} rounded-lg px-3 py-2 text-sm text-white 
                    focus:outline-none focus:ring-1 ${styles.ring} transition-all`}
                />
                <button
                  type="submit"
                  aria-label="Go to page"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all focus-visible:outline focus-visible:ring-2 focus-visible:ring-offset-2 ${styles.ring} ${styles.active}`}
                >
                  Go
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default AdvancedPagination;
