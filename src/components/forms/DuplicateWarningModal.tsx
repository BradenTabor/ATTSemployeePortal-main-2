/**
 * DuplicateWarningModal Component
 *
 * Modal displayed when a duplicate form submission is detected.
 * Provides options to view existing record, submit anyway, or cancel.
 *
 * @module DuplicateWarningModal
 * @see docs/Telemetry_plan.md for full documentation
 */

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Eye, FileCheck, X, Clock, User } from "lucide-react";
import { cn } from "../../lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface DuplicateWarningModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Handler when user chooses to submit anyway */
  onSubmitAnyway: () => void;
  /** Handler when user chooses to view existing record */
  onViewExisting: () => void;
  /** Form type for display */
  formType: "dvir" | "equipment";
  /** Entity identifier (truck/equipment number) */
  entityId: string;
  /** Date of the inspection */
  dateFor: string;
  /** Existing record details */
  existingRecord: {
    id: string;
    created_at: string;
    submitted_by?: string;
  };
  /** Whether the submit anyway action is loading */
  isSubmitting?: boolean;
}

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 },
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function DuplicateWarningModal({
  isOpen,
  onClose,
  onSubmitAnyway,
  onViewExisting,
  formType,
  entityId,
  dateFor,
  existingRecord,
  isSubmitting = false,
}: DuplicateWarningModalProps) {
  const formLabel = formType === "dvir" ? "DVIR" : "Equipment Inspection";
  const entityLabel = formType === "dvir" ? "Truck" : "Equipment";

  const formattedDate = new Date(dateFor).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = new Date(existingRecord.created_at).toLocaleTimeString(
    "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Backdrop */}
          <motion.div
            variants={overlayVariants}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            variants={modalVariants}
            className={cn(
              "relative w-full max-w-md rounded-3xl overflow-hidden",
              "bg-gradient-to-br from-[#1a1510] via-[#0f0a08] to-[#080504]",
              "border border-amber-500/30 shadow-2xl shadow-amber-500/10"
            )}
          >
            {/* Top glow */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close duplicate warning"
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Icon & Title */}
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Duplicate Detected
                  </h2>
                  <p className="text-sm text-white/60 mt-1">
                    A {formLabel} for this {entityLabel.toLowerCase()} already
                    exists
                  </p>
                </div>
              </div>

              {/* Existing Record Details */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {entityLabel} {entityId}
                    </p>
                    <p className="text-xs text-white/50">{formattedDate}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-white/60">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Submitted at {formattedTime}</span>
                  </div>
                  {existingRecord.submitted_by && (
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>{existingRecord.submitted_by}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning Message */}
              <p className="text-sm text-white/70 leading-relaxed">
                Submitting a duplicate may create confusion in records. Would
                you like to view the existing submission or submit anyway?
              </p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onViewExisting}
                  aria-label="View existing submission"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                    "bg-white/5 border border-white/10 text-white",
                    "hover:bg-white/10 hover:border-white/20 transition-all",
                    "text-sm font-medium",
                    "focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                  )}
                >
                  <Eye className="w-4 h-4" aria-hidden />
                  View Existing
                </button>

                <button
                  type="button"
                  onClick={onSubmitAnyway}
                  disabled={isSubmitting}
                  aria-label={isSubmitting ? "Submitting..." : "Submit anyway"}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                    "bg-amber-500/20 border border-amber-500/30 text-amber-300",
                    "hover:bg-amber-500/30 hover:border-amber-500/40 transition-all",
                    "text-sm font-medium",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d]"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-4 h-4 border-2 border-amber-300/30 border-t-amber-300 rounded-full"
                        aria-hidden
                      />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4" aria-hidden />
                      Submit Anyway
                    </>
                  )}
                </button>
              </div>

              {/* Cancel */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cancel and go back"
                className="w-full py-2 text-sm text-white/50 hover:text-white/70 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f0d] rounded"
              >
                Cancel and go back
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DuplicateWarningModal;
