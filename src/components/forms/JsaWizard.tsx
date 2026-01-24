import { type ReactNode, useCallback, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  Loader2,
  Save,
  FileText,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { JSA_STEPS } from "./jsaSteps";
import { FormProgressRing, FormProgressBar } from "./FormProgressRing";
import { AutoSaveIndicator } from "./AutoSaveIndicator";

export type SaveMode = "draft" | "complete";

interface JsaWizardProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  completedSteps: Set<number>;
  children: ReactNode;
  onSave: (mode: SaveMode) => void;
  onComplete: () => void;
  onBack: () => void;
  saving: boolean;
  isValid: boolean;
  isEditMode: boolean;
  status: "draft" | "completed";
  title?: string;
  /** Form completion progress (0-100) */
  progress?: number;
  /** Last saved timestamp */
  lastSaved?: Date | null;
  /** Whether there are unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Step-specific completion status for badges */
  stepCompletionStatus?: {
    step1: boolean; // Job Info (required fields filled)
    step2: boolean; // PPE (at least one selected)
    step3: boolean; // Weather (at least one condition selected)
    step4: boolean; // Hazards (reviewed)
    step5: boolean; // Spans (at least one filled)
    step6: boolean; // Review (signature provided)
  };
  /** Validation errors to show specific field issues */
  validationErrors?: Record<string, string | undefined>;
}

export function JsaWizard({
  currentStep,
  setCurrentStep,
  completedSteps,
  children,
  onSave,
  onComplete,
  onBack,
  saving,
  isValid,
  isEditMode,
  status,
  title = "Daily JSA",
  progress = 0,
  lastSaved = null,
  hasUnsavedChanges = false,
  stepCompletionStatus,
  validationErrors = {},
}: JsaWizardProps) {
  const [direction, setDirection] = useState(0);
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Swipe gesture state
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  
  const totalSteps = JSA_STEPS.length;
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;
  const currentStepData = JSA_STEPS[currentStep - 1];

  // Close save menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSaveOptions &&
        saveMenuRef.current &&
        saveButtonRef.current &&
        !saveMenuRef.current.contains(event.target as Node) &&
        !saveButtonRef.current.contains(event.target as Node)
      ) {
        setShowSaveOptions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSaveOptions]);

  // Handle save with mode
  const handleSave = useCallback((mode: SaveMode) => {
    setShowSaveOptions(false);
    onSave(mode);
  }, [onSave]);

  // Navigation - must be defined before swipe handlers
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

  // Swipe gesture handlers (mobile navigation)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    
    // Only trigger if horizontal swipe is dominant and significant
    const minSwipeDistance = 50;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0 && !isFirstStep) {
        // Swipe right -> go back
        goToStep(currentStep - 1);
      } else if (deltaX < 0 && !isLastStep) {
        // Swipe left -> go forward
        goToStep(currentStep + 1);
      }
    }
    
    touchStartX.current = null;
    touchStartY.current = null;
  }, [currentStep, isFirstStep, isLastStep, goToStep]);

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

          {/* Center - Progress Ring & Title */}
          <div className="flex items-center gap-2 flex-1 justify-center min-w-0">
            {/* Progress Ring (desktop) */}
            <div className="hidden sm:block">
              <FormProgressRing progress={progress} size={36} strokeWidth={3} />
            </div>
            <div className="flex flex-col items-center sm:items-start">
              <div className="flex items-center gap-2">
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
              {/* Auto-save indicator (only for new forms) */}
              {!isEditMode && (
                <AutoSaveIndicator
                  status={hasUnsavedChanges ? "saving" : lastSaved ? "saved" : "idle"}
                  lastSaved={lastSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                  className="mt-0.5"
                />
              )}
            </div>
          </div>
        </div>

        {/* Mobile Progress Bar */}
        <div className="sm:hidden px-3 pb-2">
          <FormProgressBar progress={progress} showLabel={true} />
        </div>

        {/* Step Progress - Enhanced touch targets with completion badges */}
        <div className="px-3 pb-2.5 sm:px-4">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
            {JSA_STEPS.map((step) => {
              const isActive = step.id === currentStep;
              const isComplete = completedSteps.has(step.id) || step.id < currentStep;
              
              // Check step-specific completion for visual badge
              const stepKey = `step${step.id}` as keyof typeof stepCompletionStatus;
              const isStepComplete = stepCompletionStatus?.[stepKey] ?? false;
              
              return (
                <motion.button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.id)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    // Increased min-height for better touch targets (44px minimum)
                    "relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-medium transition-all touch-manipulation",
                    isActive
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-900/20"
                      : isComplete
                      ? "bg-white/5 text-white/70 hover:bg-white/10 border border-transparent"
                      : "bg-transparent text-white/40 hover:text-white/60 border border-transparent"
                  )}
                >
                  <span
                    className={cn(
                      // Increased size on mobile for easier tapping
                      "w-6 h-6 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[11px] sm:text-[10px] font-bold transition-all",
                      isActive
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                        : isComplete || isStepComplete
                        ? "bg-emerald-600/50 text-emerald-200"
                        : "bg-white/10 text-white/50"
                    )}
                  >
                    {(isComplete || isStepComplete) && !isActive ? (
                      <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                    ) : (
                      step.id
                    )}
                  </span>
                  <span className="hidden sm:inline">{step.shortTitle}</span>
                  
                  {/* Completion badge - small dot indicator */}
                  {isStepComplete && !isActive && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-gray-900 shadow-sm"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
          
          {/* Swipe hint for mobile (only on first visit) */}
          <p className="sm:hidden text-center text-[9px] text-white/30 mt-1.5">
            Swipe left/right to navigate steps
          </p>
        </div>
      </div>

      {/* Scrollable Content Area - with swipe gestures */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="max-w-2xl mx-auto px-3 py-3 sm:px-6 sm:py-5 pb-20">
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
              {/* Step Header - Compact on mobile */}
              <div className="mb-3 sm:mb-5">
                <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-400 uppercase tracking-wide">
                    Step {currentStep} of {totalSteps}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white">
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
            aria-disabled={isFirstStep}
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

          {/* Center: Save with Mode Selector */}
          <div className="relative">
            <button
              ref={saveButtonRef}
              type="button"
              onClick={() => setShowSaveOptions(!showSaveOptions)}
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

            {/* Save Mode Selector Popover */}
            <AnimatePresence>
              {showSaveOptions && !saving && (
                <motion.div
                  ref={saveMenuRef}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="fixed bottom-20 inset-x-0 mx-auto w-[calc(100vw-2rem)] max-w-[280px] z-50"
                >
                  <div className="bg-gray-900/98 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
                      <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wide">
                        Choose Save Type
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSaveOptions(false)}
                        aria-label="Close save options"
                        className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Options */}
                    <div className="p-2 space-y-1.5">
                      {/* Save Draft Option */}
                      <button
                        type="button"
                        onClick={() => handleSave("draft")}
                        className="w-full flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 transition-all group"
                      >
                        <div className="flex-shrink-0 p-1.5 rounded-lg bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
                          <FileText className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-xs font-semibold text-amber-300 group-hover:text-amber-200">
                            Save as Draft
                          </p>
                          <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">
                            Save progress and continue later.
                          </p>
                        </div>
                      </button>

                      {/* Save Complete Option */}
                      <button
                        type="button"
                        onClick={() => handleSave("complete")}
                        disabled={!isValid}
                        className={cn(
                          "w-full flex items-start gap-2.5 p-2.5 rounded-lg border transition-all group",
                          isValid
                            ? "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 hover:border-emerald-500/40"
                            : "bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className={cn(
                          "flex-shrink-0 p-1.5 rounded-lg transition-colors",
                          isValid
                            ? "bg-emerald-500/20 group-hover:bg-emerald-500/30"
                            : "bg-white/10"
                        )}>
                          <CheckCircle2 className={cn(
                            "w-4 h-4",
                            isValid ? "text-emerald-400" : "text-white/30"
                          )} />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className={cn(
                            "text-xs font-semibold",
                            isValid
                              ? "text-emerald-300 group-hover:text-emerald-200"
                              : "text-white/40"
                          )}>
                            Save as Complete
                          </p>
                          <p className="text-[10px] text-white/50 mt-0.5 leading-relaxed">
                            {isValid
                              ? "Mark as final submission."
                              : "Fill required fields first."}
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Next / Complete */}
          {isLastStep ? (
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('[JSA Wizard] Done button clicked', { 
                  saving, 
                  isValid, 
                  isEditMode,
                  disabled: saving || !isValid,
                  validationErrors: Object.keys(validationErrors || {}).filter(k => validationErrors?.[k]),
                });
                
                // Prevent multiple clicks while saving
                if (saving) {
                  console.warn('[JSA Wizard] Submission already in progress, ignoring click');
                  return;
                }
                
                // Always call onComplete - it will re-validate and show errors if needed
                // This ensures users get feedback even if validation state is stale
                try {
                  await onComplete();
                } catch (error) {
                  console.error('[JSA Wizard] onComplete error', error);
                }
              }}
              disabled={saving || !isValid}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all touch-manipulation min-w-[80px]",
                saving || !isValid
                  ? "opacity-40 cursor-not-allowed bg-amber-700/30 text-white/50"
                  : "bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-500 hover:to-amber-600"
              )}
              aria-label={saving ? "Submitting..." : !isValid ? "Please fix validation errors" : "Submit JSA form"}
              title={saving ? "Submitting..." : !isValid ? "Please fix the issues above" : "Submit JSA form"}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {!saving && <Check className="w-4 h-4" />}
              <span className="hidden sm:inline">{saving ? "Submitting..." : "Done"}</span>
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
          <div className="text-center text-[10px] text-amber-300/70 pb-1 -mt-1 space-y-0.5">
            <p className="mb-1 font-medium">Please fix the following issues:</p>
            <div className="space-y-0.5">
              {(() => {
                // Filter out undefined/null errors and get actual error messages
                const actualErrors = Object.entries(validationErrors || {})
                  .filter(([, error]) => error && typeof error === 'string' && error.trim())
                  .map(([field, error]) => ({ field, error: error as string }));
                
                if (actualErrors.length === 0) {
                  // If no specific errors but form is invalid, show generic message
                  return (
                    <p className="text-amber-200/80">
                      Check all required fields: date, location, contacts (with valid phone numbers), jobs, and signature
                    </p>
                  );
                }
                
                return actualErrors.map(({ field, error }) => {
                  const fieldLabel = field === 'jobDate' ? 'Date' :
                                   field === 'workLocation' ? 'Location' :
                                   field === 'ocContact' ? 'OC Contact' :
                                   field === 'docContact' ? 'DOC Contact' :
                                   field === 'gfContact' ? 'GF Contact' :
                                   field === 'safetyContact' ? 'Safety Contact' :
                                   field === 'jobsPerformed' ? 'Jobs' :
                                   field === 'employeeSignature' ? 'Signature' :
                                   field;
                  
                  return (
                    <p key={field} className="text-amber-200/90">
                      • {fieldLabel}: {error}
                    </p>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
