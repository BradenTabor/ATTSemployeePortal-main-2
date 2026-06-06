import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";

interface FilterChip {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: "emerald" | "amber" | "red" | "blue" | "purple";
}

interface QuickFilterChipsProps {
  chips: FilterChip[];
  activeChips: string[];
  onToggle: (chipId: string) => void;
  onClearAll?: () => void;
  variant?: "emerald" | "amber" | "purple";
}

const colorStyles = {
  emerald: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30",
  amber: "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30",
  red: "bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30",
  blue: "bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30",
  purple: "bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30",
};

const activeColorStyles = {
  emerald: "bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30",
  amber: "bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400 text-white shadow-lg shadow-amber-500/30",
  red: "bg-gradient-to-r from-red-500 to-rose-500 border-red-400 text-white shadow-lg shadow-red-500/30",
  blue: "bg-gradient-to-r from-blue-500 to-indigo-500 border-blue-400 text-white shadow-lg shadow-blue-500/30",
  purple: "bg-gradient-to-r from-purple-500 to-violet-500 border-purple-400 text-white shadow-lg shadow-purple-500/30",
};

export const QuickFilterChips = memo(function QuickFilterChips({
  chips,
  activeChips,
  onToggle,
  onClearAll,
  variant = "emerald",
}: QuickFilterChipsProps) {
  const hasActiveFilters = activeChips.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10`}
      >
        <Sparkles className="w-3 h-3 text-white/40" />
        <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Quick Filters</span>
      </motion.div>

      <AnimatePresence mode="popLayout">
        {chips.map((chip, index) => {
          const isActive = activeChips.includes(chip.id);
          const chipColor = chip.color || variant;
          const Icon = chip.icon;
          
          return (
            <motion.button
              key={chip.id}
              layout
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -10 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onToggle(chip.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium 
                border transition-all duration-200 ${
                isActive 
                  ? activeColorStyles[chipColor]
                  : colorStyles[chipColor]
              }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              <span>{chip.label}</span>
              {isActive && (
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="ml-0.5"
                >
                  <X className="w-3 h-3" />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* Clear all button */}
      <AnimatePresence>
        {hasActiveFilters && onClearAll && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClearAll}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-medium 
              bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all`}
          >
            <X className="w-3 h-3" />
            Clear All
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});

// Date Range Quick Filters
interface DateRangeChipsProps {
  activeRange: string;
  onRangeChange: (range: string) => void;
  variant?: "emerald" | "amber" | "purple";
}

export const DateRangeChips = memo(function DateRangeChips({
  activeRange,
  onRangeChange,
  variant = "emerald",
}: DateRangeChipsProps) {
  const ranges = [
    { id: "all", label: "All Time" },
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
  ];

  const variantStyles = {
    emerald: {
      active: "bg-gradient-to-r from-emerald-500/30 to-teal-500/30 border-emerald-500/50 text-emerald-200",
      inactive: "bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-emerald-500/30",
    },
    amber: {
      active: "bg-gradient-to-r from-amber-500/30 to-orange-500/30 border-amber-500/50 text-amber-200",
      inactive: "bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-amber-500/30",
    },
    purple: {
      active: "bg-gradient-to-r from-purple-500/30 to-violet-500/30 border-purple-500/50 text-purple-200",
      inactive: "bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:border-purple-500/30",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      role="group"
      aria-label="Date range"
      className="flex flex-wrap items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-black/20 rounded-lg sm:rounded-xl border border-white/5 hover:scale-[1.02]"
    >
      {ranges.map((range, index) => (
        <motion.button
          key={range.id}
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onRangeChange(range.id)}
          className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-medium border transition-all duration-200 min-h-[32px] sm:min-h-0
            ${activeRange === range.id ? styles.active : styles.inactive}`}
          aria-pressed={activeRange === range.id}
          aria-label={`${range.label}${activeRange === range.id ? ", selected" : ""}`}
        >
          {range.label}
        </motion.button>
      ))}
    </div>
  );
});

export default QuickFilterChips;
