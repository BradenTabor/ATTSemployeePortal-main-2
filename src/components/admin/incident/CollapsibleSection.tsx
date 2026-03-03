import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
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

export function CollapsibleSection({ 
  title, 
  icon, 
  isOpen, 
  onToggle, 
  children, 
  required,
  badge,
  badgeColor = "white"
}: CollapsibleSectionProps) {
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-white/50">{icon}</span>
          <span className="text-xs font-medium text-white">{title}</span>
          {required && <span className="text-red-400 text-[10px]">*</span>}
          {badge && (
            <span className={cn(
              "text-[9px] px-1.5 py-0.5 rounded-full",
              badgeColor === "amber" && "bg-amber-500/20 text-amber-300",
              badgeColor === "red" && "bg-red-500/20 text-red-300",
              badgeColor === "white" && "bg-white/10 text-white/60"
            )}>
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-white/50" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-white/50" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-3 bg-white/[0.02]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
