import { type ReactNode, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  FolderOpen,
  Loader2,
  Save,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { JSA_STEPS } from "./jsaSteps";

interface JsaWizardProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  completedSteps: Set<number>;
  children: ReactNode;
  onSave: () => void;
  onComplete: () => void;
  onBack: () => void;
  onOpenPicker: () => void;
  saving: boolean;
  isValid: boolean;
  isEditMode: boolean;
  status: "draft" | "completed";
  title?: string;
}

export function JsaWizard({
  currentStep,
  setCurrentStep,
  completedSteps,
  children,
  onSave,
  onComplete,
  onBack,
  onOpenPicker,
  saving,
  isValid,
  isEditMode,
  status,
  title = "Daily JSA",
}: JsaWizardProps) {
  const [direction, setDirection] = useState(0);
  const totalSteps = JSA_STEPS.length;
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;
  const currentStepData = JSA_STEPS[currentStep - 1];

  const goToStep = useCallback(
    (step: number) => {
      if (step < 1 || step > totalSteps) return;
      setDirection(step > currentStep ? 1 : -1);
      setCurrentStep(step);
    },
    [currentStep, setCurrentStep, totalSteps]
  );

  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep, isFirstStep]);

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, goToStep, isLastStep]);

  // Animation variants for step transitions
  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 50 : -50,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 50 : -50,
      opacity: 0,
    }),
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Premium Header - Mobile Optimized */}
      <div
        className="flex-shrink-0 border-b border-emerald-500/20"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,30,18,0.98) 0%, rgba(0,15,8,0.95) 100%)",
        }}
      >
        {/* Top bar - Enhanced for mobile visibility */}
        <div className="flex items-center justify-between px-3 py-2 sm:px-5 sm:py-2.5 gap-2">
          {/* Back Button - More visible */}
          <motion.button
            type="button"
            onClick={onBack}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all touch-manipulation active:bg-white/15"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Back</span>
          </motion.button>

          {/* Center Title */}
          <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-white truncate">{title}</h1>
            {isEditMode && (
              <span
                className={cn(
                  "flex-shrink-0 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wide",
                  status === "completed"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                )}
              >
                {status}
              </span>
            )}
          </div>

          {/* Edit My JSA's Button - Always visible, enhanced */}
          <motion.button
            type="button"
            onClick={onOpenPicker}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-400/40 transition-all touch-manipulation active:bg-emerald-500/30 shadow-sm shadow-emerald-900/20"
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs font-semibold whitespace-nowrap">My JSA's</span>
          </motion.button>
        </div>

        {/* Step Progress - Compact horizontal pills */}
        <div className="px-3 pb-2.5 sm:px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {JSA_STEPS.map((step) => {
              const isActive = step.id === currentStep;
              const isComplete = completedSteps.has(step.id) || step.id < currentStep;
              
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  className={cn(
                    "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all touch-manipulation",
                    isActive
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                      : isComplete
                      ? "bg-white/5 text-white/70 hover:bg-white/10"
                      : "bg-transparent text-white/40 hover:text-white/60"
                  )}
                >
                  <span
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                      isActive
                        ? "bg-emerald-500 text-white"
                        : isComplete
                        ? "bg-emerald-600/50 text-emerald-200"
                        : "bg-white/10 text-white/50"
                    )}
                  >
                    {isComplete && !isActive ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      step.id
                    )}
                  </span>
                  <span className="hidden sm:inline">{step.shortTitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-2xl mx-auto px-4 py-5 sm:px-6 sm:py-6 pb-24">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 400, damping: 35 },
                opacity: { duration: 0.15 },
              }}
            >
              {/* Step Header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                    Step {currentStep} of {totalSteps}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">
                  {currentStepData?.title}
                </h2>
              </div>

              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Fixed Footer Navigation */}
      <div
        className="flex-shrink-0 border-t border-white/10"
        style={{
          background:
            "linear-gradient(0deg, rgba(0,10,5,0.98) 0%, rgba(0,20,10,0.95) 100%)",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.5rem)",
        }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
          {/* Previous */}
          <button
            type="button"
            onClick={handlePrevious}
            disabled={isFirstStep}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all touch-manipulation min-w-[80px]",
              isFirstStep
                ? "opacity-30 cursor-not-allowed text-white/40"
                : "bg-white/10 text-white hover:bg-white/15 border border-white/10"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Center: Save */}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all touch-manipulation",
              saving
                ? "opacity-60 cursor-not-allowed bg-emerald-700/50 text-white/70"
                : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/30"
            )}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save</span>
          </button>

          {/* Next / Complete */}
          {isLastStep ? (
            <button
              type="button"
              onClick={onComplete}
              disabled={saving || !isValid}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all touch-manipulation min-w-[80px]",
                saving || !isValid
                  ? "opacity-40 cursor-not-allowed bg-amber-700/30 text-white/50"
                  : "bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-500 hover:to-amber-600"
              )}
            >
              <Check className="w-4 h-4" />
              <span className="hidden sm:inline">Done</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600/80 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-all touch-manipulation min-w-[80px] border border-emerald-500/30"
            >
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Validation hint - only show on last step */}
        {isLastStep && !isValid && (
          <p className="text-center text-[10px] text-amber-300/70 pb-1 -mt-1">
            Fill required fields (date, location, signature) to complete
          </p>
        )}
      </div>
    </div>
  );
}
