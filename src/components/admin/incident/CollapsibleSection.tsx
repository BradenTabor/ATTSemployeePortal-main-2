import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "../../../lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  required?: boolean;
  badge?: string;
  badgeColor?: string;
}

const sectionSpring = { type: "spring" as const, stiffness: 350, damping: 32 };

export function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  required,
  badge,
  badgeColor = "white",
}: CollapsibleSectionProps) {
  return (
    <div className={cn(
      "rounded-xl overflow-hidden transition-all duration-300",
      "border",
      isOpen
        ? "border-red-500/15 bg-white/[0.02] shadow-[0_0_16px_rgba(239,68,68,0.04)]"
        : "border-white/[0.06] bg-transparent"
    )}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2.5 transition-all duration-200 active:scale-[0.995]",
          isOpen
            ? "bg-gradient-to-r from-red-500/[0.06] to-transparent"
            : "bg-white/[0.03] hover:bg-white/[0.05]"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className={cn(
            "transition-colors duration-200",
            isOpen ? "text-red-400/70" : "text-white/40"
          )}>
            {icon}
          </span>
          <span className="text-xs font-semibold text-white/90 tracking-tight">{title}</span>
          {required && <span className="text-red-400 text-[10px] font-bold">*</span>}
          {badge && (
            <span className={cn(
              "text-[9px] font-semibold px-2 py-0.5 rounded-md",
              badgeColor === "amber" && "bg-amber-500/15 text-amber-300 border border-amber-500/15",
              badgeColor === "red" && "bg-red-500/15 text-red-300 border border-red-500/15",
              badgeColor === "white" && "bg-white/[0.06] text-white/50 border border-white/[0.06]"
            )}>
              {badge}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={sectionSpring}
        >
          <ChevronDown className={cn(
            "w-3.5 h-3.5 transition-colors duration-200",
            isOpen ? "text-red-400/60" : "text-white/30"
          )} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={sectionSpring}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-2 space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
