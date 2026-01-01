import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { JSA_STEPS } from "./jsaSteps";

interface JsaStepProgressProps {
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function JsaStepProgress({
  currentStep,
  completedSteps,
  onStepClick,
  className,
}: JsaStepProgressProps) {
  const progressPercent = ((currentStep - 1) / (JSA_STEPS.length - 1)) * 100;

  return (
    <div className={cn("w-full", className)}>
      {/* Mobile: Simple progress bar with step count */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-emerald-300">
            Step {currentStep} of {JSA_STEPS.length}
          </span>
          <span className="text-xs text-white/70">
            {JSA_STEPS[currentStep - 1]?.title}
          </span>
        </div>
        <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/10">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Desktop: Step indicators */}
      <div className="hidden sm:block">
        <div className="relative">
          {/* Background track */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-white/10" />
          
          {/* Progress fill */}
          <motion.div
            className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />

          {/* Step circles */}
          <div className="relative flex justify-between">
            {JSA_STEPS.map((step) => {
              const isCompleted = completedSteps.has(step.id);
              const isCurrent = step.id === currentStep;
              const isPast = step.id < currentStep;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  disabled={!onStepClick}
                  className={cn(
                    "flex flex-col items-center gap-2 group",
                    onStepClick && "cursor-pointer"
                  )}
                >
                  <motion.div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all",
                      isCurrent
                        ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/40"
                        : isCompleted || isPast
                        ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300"
                        : "bg-black/40 border-white/20 text-white/50"
                    )}
                    whileHover={onStepClick ? { scale: 1.1 } : undefined}
                    whileTap={onStepClick ? { scale: 0.95 } : undefined}
                  >
                    {isCompleted || isPast ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.id
                    )}
                  </motion.div>
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-colors",
                      isCurrent
                        ? "text-emerald-300"
                        : isCompleted || isPast
                        ? "text-emerald-400/70"
                        : "text-white/40"
                    )}
                  >
                    {step.shortTitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

