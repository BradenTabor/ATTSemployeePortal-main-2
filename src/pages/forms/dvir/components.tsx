/**
 * DVIR Form Helper Components
 * 
 * Reusable UI components for the DVIR form including section cards,
 * mileage input, checklist actions, progress indicators, upload tiles,
 * and signature pad.
 */

import { ReactNode, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Camera,
  CheckCheck,
  CheckCircle2,
  Gauge,
  Info,
  RotateCcw,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AutoSaveIndicator } from "@/components/forms/AutoSaveIndicator";

// =============================================================================
// SECTION CARD
// =============================================================================

interface SectionCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}

export const SectionCard = ({ title, subtitle, badge, children }: SectionCardProps) => (
  <section 
    className="rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900/80 via-gray-900/40 to-gray-900/10 p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-2xl shadow-black/60"
  >
    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
      <div className="min-w-0">
        <p className="text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em] uppercase text-emerald-200/70">
          {badge || "DOT COMPLIANT"}
        </p>
        <h2 className="text-base sm:text-lg font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs sm:text-sm text-white/70 mt-0.5 sm:mt-1 max-w-2xl">{subtitle}</p>}
      </div>
    </div>
    <div className="space-y-3 sm:space-y-4">{children}</div>
  </section>
);

// =============================================================================
// MILEAGE INPUT
// =============================================================================

interface MileageInputProps {
  value: string;
  onChange: (value: string) => void;
  truckNumber?: string;
  previousMileage?: number | null;
  /** Called on blur for form-level validation (e.g. handleFieldBlur('mileage')) */
  onBlur?: () => void;
}

export const MileageInput = ({ value, onChange, truckNumber, previousMileage, onBlur }: MileageInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Format number with commas for display
  const formatWithCommas = (num: string) => {
    const cleaned = num.replace(/[^\d]/g, '');
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  
  // Calculate mileage difference from previous
  const mileageDiff = useMemo(() => {
    if (!previousMileage || !value) return null;
    const current = parseInt(value.replace(/[^\d]/g, ''), 10);
    if (isNaN(current)) return null;
    return current - previousMileage;
  }, [value, previousMileage]);
  
  // Validation state (step 2 before step 3 so "lower than previous" shows suggestion, not negative diff)
  const validation = useMemo(() => {
    const num = parseInt(value.replace(/[^\d]/g, ''), 10);
    if (!value) return { valid: true, message: '', suggestion: false };
    if (isNaN(num) || num <= 0) return { valid: false, message: 'Enter a valid number', suggestion: false };
    if (previousMileage != null && num < previousMileage) {
      return { valid: true, message: 'Lower than last recorded. Submit if this reading is correct.', suggestion: true };
    }
    if (mileageDiff != null && mileageDiff > 500) {
      return { valid: true, message: `+${mileageDiff.toLocaleString()} miles since last DVIR`, suggestion: false };
    }
    return { valid: true, message: '', suggestion: false };
  }, [value, previousMileage, mileageDiff]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const rawValue = e.target.value.replace(/[^\d]/g, '');
    onChange(rawValue);
  };
  
  const displayValue = isFocused ? value : formatWithCommas(value);

  return (
    <div className="space-y-2">
      <label htmlFor="mileage" className="flex items-center gap-2 text-xs text-gray-300">
        <Gauge className="w-3.5 h-3.5 text-emerald-400" />
        ODOMETER READING *
      </label>
      
      <div 
        className={cn(
          "relative rounded-xl transition-all duration-200",
          isFocused && "ring-2 ring-emerald-400/50"
        )}
      >
        {/* Odometer-style background */}
        <div className={cn(
          "absolute inset-0 rounded-xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border transition-colors duration-200",
          isFocused ? "border-emerald-500/50" : "border-gray-700",
          !validation.valid && value && "border-red-500/50"
        )} />
        
        {/* Input container */}
        <div className="relative flex items-center">
          {/* Truck icon indicator */}
          <div className={cn(
            "flex items-center justify-center w-12 h-12 rounded-l-xl border-r transition-colors",
            isFocused ? "border-emerald-500/30 bg-emerald-500/10" : "border-gray-700 bg-black/30"
          )}>
            <Truck className={cn(
              "w-5 h-5 transition-colors",
              isFocused ? "text-emerald-400" : "text-gray-500"
            )} />
          </div>
          
          {/* Main input */}
          <input
            ref={inputRef}
            id="mileage"
            name="mileage"
            data-testid="mileage-input"
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              onBlur?.();
            }}
            placeholder="123,456"
            className={cn(
              "flex-1 bg-transparent px-4 py-3 text-lg font-mono text-white tracking-wider",
              "placeholder:text-gray-600 focus:outline-none",
              "tabular-nums"
            )}
            aria-label="Vehicle mileage"
            aria-required="true"
          />
          
          {/* Unit label */}
          <div className="px-4 text-xs text-gray-500 font-medium">
            mi
          </div>
        </div>
      </div>
      
      {/* Helper text and validation */}
      <AnimatePresence mode="wait">
        {validation.message && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              !validation.valid && "text-red-400",
              validation.valid && validation.suggestion && "text-amber-400/90",
              validation.valid && !validation.suggestion && "text-emerald-400/80"
            )}
          >
            {!validation.valid ? (
              <AlertTriangle className="w-3 h-3" />
            ) : validation.suggestion ? (
              <Info className="w-3 h-3" />
            ) : (
              <TrendingUp className="w-3 h-3" />
            )}
            {validation.message}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Previous mileage hint */}
      {truckNumber && previousMileage && (
        <p className="text-[10px] text-gray-500">
          Last recorded for {truckNumber}: {previousMileage.toLocaleString()} mi
        </p>
      )}
    </div>
  );
};

// =============================================================================
// CHECKLIST QUICK ACTIONS
// =============================================================================

interface ChecklistQuickActionsProps {
  onMarkAllPass: () => void;
  onMarkAllFail?: () => void;
  onClearAll: () => void;
  checkedCount: number;
  totalCount: number;
}

export const ChecklistQuickActions = ({ onMarkAllPass, onMarkAllFail, onClearAll, checkedCount, totalCount }: ChecklistQuickActionsProps) => (
  <div className="flex flex-col gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-black/30 border border-white/5">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="text-[10px] sm:text-xs text-gray-400">
          <span className="text-emerald-400 font-semibold">{checkedCount}</span>
          <span className="text-gray-600"> / </span>
          <span>{totalCount}</span>
          <span className="ml-1 text-gray-600 hidden xs:inline">checked</span>
        </div>
        {checkedCount === totalCount && checkedCount > 0 && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
          >
            ✓
          </motion.span>
        )}
      </div>
      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/50 hidden sm:inline">
        Quick Actions
      </span>
    </div>
    <div className="flex items-center gap-1.5 sm:gap-2 w-full">
      <button
        type="button"
        onClick={onMarkAllPass}
        className="flex-1 xs:flex-none flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2.5 sm:py-2.5 text-[10px] sm:text-[10px] font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 active:bg-emerald-500/30 border border-emerald-500/30 rounded-lg transition-colors min-h-[44px]"
      >
        <CheckCheck className="w-3 h-3" />
        <span>All Pass</span>
      </button>
      {onMarkAllFail && (
        <button
          type="button"
          onClick={onMarkAllFail}
          className="flex-1 xs:flex-none flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2.5 sm:py-2.5 text-[10px] sm:text-[10px] font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 border border-rose-500/30 rounded-lg transition-colors min-h-[44px]"
        >
          <X className="w-3 h-3" />
          <span>All Fail</span>
        </button>
      )}
      <button
        type="button"
        onClick={onClearAll}
        disabled={checkedCount === 0}
        className="flex-1 xs:flex-none flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2.5 sm:py-2.5 text-[10px] sm:text-[10px] font-medium text-gray-400 hover:text-white active:text-white bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-40 disabled:cursor-not-allowed disabled:focus-visible:ring-0 min-h-[44px]"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Clear</span>
      </button>
    </div>
  </div>
);

// =============================================================================
// FORM PROGRESS
// =============================================================================

export interface ProgressStep {
  id: string;
  label: string;
  icon?: ReactNode;
  isComplete: boolean;
  isCurrent: boolean;
}

interface FormProgressProps {
  steps: ProgressStep[];
  lastSaved?: Date | null;
  hasUnsavedChanges?: boolean;
}

export const FormProgress = ({ steps, lastSaved, hasUnsavedChanges }: FormProgressProps) => {
  const completedCount = steps.filter(s => s.isComplete).length;
  const progress = (completedCount / steps.length) * 100;
  
  return (
    <div className="sticky top-2 sm:top-4 z-40 mx-2 sm:mx-4">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto rounded-2xl bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden"
      >
        {/* Subtle gradient border effect */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        
        <div className="p-4 sm:p-5">
          {/* Top row: Title + Percentage */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                completedCount === steps.length 
                  ? "bg-emerald-500/20 border border-emerald-500/40" 
                  : "bg-white/5 border border-white/10"
              )}>
                {completedCount === steps.length ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Gauge className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {completedCount === steps.length ? "Ready to Submit!" : "DVIR Progress"}
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">
                    {completedCount} of {steps.length} sections complete
                  </p>
                  {/* Auto-save indicator */}
                  {(lastSaved || hasUnsavedChanges) && (
                    <AutoSaveIndicator
                      status={hasUnsavedChanges ? "saving" : lastSaved ? "saved" : "idle"}
                      lastSaved={lastSaved ?? null}
                      hasUnsavedChanges={hasUnsavedChanges ?? false}
                      className="hidden sm:flex"
                    />
                  )}
                </div>
              </div>
            </div>
            
            {/* Circular percentage indicator */}
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                {/* Background circle */}
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-gray-800"
                />
                {/* Progress circle */}
                <motion.circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 0.88} 88`}
                  initial={{ strokeDasharray: "0 88" }}
                  animate={{ strokeDasharray: `${progress * 0.88} 88` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn(
                  "text-xs font-bold",
                  progress === 100 ? "text-emerald-400" : "text-white"
                )}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden mb-5">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          
          {/* Step indicators - horizontal scroll on mobile */}
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            {steps.map((step, index) => {
              const isCompleted = step.isComplete;
              const isCurrent = step.isCurrent && !step.isComplete;
              const isPending = !step.isComplete && !step.isCurrent;
              
              return (
                <div 
                  key={step.id} 
                  className="flex-1 flex flex-col items-center text-center min-w-0"
                >
                  {/* Step indicator */}
                  <div className={cn(
                    "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center mb-2 transition-all duration-300",
                    isCompleted && "bg-emerald-500 shadow-lg shadow-emerald-500/25",
                    isCurrent && "bg-emerald-500/20 border-2 border-emerald-400 shadow-lg shadow-emerald-500/20",
                    isPending && "bg-gray-800/80 border border-gray-700"
                  )}>
                    {isCompleted ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </motion.div>
                    ) : (
                      <span className={cn(
                        "text-xs sm:text-sm font-semibold",
                        isCurrent ? "text-emerald-400" : "text-gray-500"
                      )}>
                        {index + 1}
                      </span>
                    )}
                  </div>
                  
                  {/* Step label */}
                  <span className={cn(
                    "text-[10px] sm:text-xs font-medium leading-tight transition-colors truncate w-full",
                    isCompleted && "text-emerald-400",
                    isCurrent && "text-white",
                    isPending && "text-gray-500"
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// =============================================================================
// UPLOAD TILE
// =============================================================================

interface UploadTileProps {
  label: string;
  description?: string;
  required?: boolean;
  status: boolean;
  onClick: () => void;
}

export const UploadTile = ({ label, description, required, status, onClick }: UploadTileProps) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex items-center justify-between gap-2 sm:gap-4 rounded-xl sm:rounded-2xl border border-white/5 bg-white/[0.04] px-3 sm:px-4 py-3 text-left transition-all hover:border-emerald-400/40 hover:bg-white/[0.07] active:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black min-h-[60px] sm:min-h-[64px]"
  >
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
      <span className="inline-flex items-center justify-center rounded-xl sm:rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-2 sm:p-2.5 text-emerald-200 flex-shrink-0">
        <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-semibold text-white flex items-center gap-1 flex-wrap">
          <span className="truncate">{label}</span>
          {required && <span className="text-rose-300 text-[9px] sm:text-[11px]">*</span>}
        </p>
        {description && <p className="text-[10px] sm:text-xs text-white/60 truncate">{description}</p>}
      </div>
    </div>
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold transition-colors flex-shrink-0",
        status ? "text-emerald-300" : "text-amber-200"
      )}
    >
      {status ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">Captured</span>
        </>
      ) : (
        <>
          <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">Pending</span>
        </>
      )}
    </span>
  </button>
);

// =============================================================================
// SIGNATURE PAD
// =============================================================================

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  getImageBlob: () => Promise<Blob | null>;
}

interface SignaturePadProps {
  label: string;
  onDrawingChange?: (hasDrawing: boolean) => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ label, onDrawingChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const strokesRef = useRef<{ x: number; y: number }[][]>([]);
    const currentStrokeRef = useRef<{ x: number; y: number }[] | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawing, setHasDrawing] = useState(false);

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, rect.width, rect.height);
      strokesRef.current.forEach((stroke) => {
        ctx.beginPath();
        stroke.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
      });
    }, []);

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#0f172a";
      ctxRef.current = ctx;
      redraw();
    }, [redraw]);

    useEffect(() => {
      resizeCanvas();
      const handleResize = () => resizeCanvas();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [resizeCanvas]);

    const handleClear = () => {
      strokesRef.current = [];
      currentStrokeRef.current = null;
      redraw();
      setHasDrawing(false);
      onDrawingChange?.(false);
    };

    const handleUndo = () => {
      if (!strokesRef.current.length) return;
      strokesRef.current.pop();
      redraw();
      const newHasDrawing = strokesRef.current.length > 0;
      setHasDrawing(newHasDrawing);
      onDrawingChange?.(newHasDrawing);
    };

    useImperativeHandle(ref, () => ({
      clear: handleClear,
      isEmpty() {
        return !hasDrawing;
      },
      async getImageBlob() {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawing) return null;
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob || null), "image/png");
        });
      },
    }));

    const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const ctx = ctxRef.current;
      if (!ctx) return;
      const point = getPoint(event);
      if (!point) return;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      currentStrokeRef.current = [point];
      setIsDrawing(true);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !currentStrokeRef.current) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      const point = getPoint(event);
      if (!point) return;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      currentStrokeRef.current.push(point);
      
      // Notify parent when drawing state changes
      if (!hasDrawing) {
        setHasDrawing(true);
        onDrawingChange?.(true);
      }
    };

    const handlePointerUp = () => {
      setIsDrawing(false);
      if (currentStrokeRef.current && currentStrokeRef.current.length) {
        strokesRef.current.push(currentStrokeRef.current);
      }
      currentStrokeRef.current = null;
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>{label}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!hasDrawing}
              className="text-[11px] text-white/60 hover:text-white disabled:opacity-30 disabled:hover:text-white/60 transition"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-white/60 hover:text-white transition"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            className="w-full h-36 md:h-44 touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
        <p className="text-[11px] text-white/50">
          Use your finger or stylus. Undo or clear as needed before submitting.
        </p>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";
