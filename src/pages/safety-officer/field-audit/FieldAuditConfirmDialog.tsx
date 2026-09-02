/**
 * FieldAuditConfirmDialog — portaled alertdialog for the two irreversible-ish
 * moments in the audit flow: discarding a draft (danger) and submitting with
 * open warnings (warning). Escape cancels; the backdrop cancels; focus lands on
 * the cancel button so a stray Enter never confirms.
 */

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { glass } from "../../../lib/glass";
import { Z } from "../../../lib/zIndex";

const TRANSITION = { duration: 0.2 };

interface FieldAuditConfirmDialogProps {
  isOpen: boolean;
  tone: "danger" | "warning";
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmLoading?: boolean;
  testId?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function FieldAuditConfirmDialog({
  isOpen,
  tone,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmLoading = false,
  testId = "field-audit-confirm",
  onConfirm,
  onCancel,
}: FieldAuditConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmLoading) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, confirmLoading, onCancel]);

  if (typeof document === "undefined") return null;

  const Icon = tone === "danger" ? Trash2 : AlertTriangle;
  const iconWrap =
    tone === "danger"
      ? "bg-rose-500/10 text-rose-300"
      : "bg-amber-500/10 text-amber-300";
  const confirmClass =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-500 border-rose-500/30 text-white focus-visible:ring-rose-400/50"
      : "bg-amber-500 hover:bg-amber-400 border-amber-400/30 text-ink-950 focus-visible:ring-amber-400/50";

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: Z.modalNested }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={confirmLoading ? undefined : onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          />
          <motion.div
            className={`relative w-full max-w-sm p-5 sm:p-6 ${glass.elevated}`}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={TRANSITION}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            data-testid={testId}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconWrap}`}
              >
                <Icon className="w-5 h-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h3 id={titleId} className="text-base font-semibold text-white">
                  {title}
                </h3>
                <div id={descId} className="text-sm text-white/60 mt-1 leading-relaxed">
                  {description}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                disabled={confirmLoading}
                data-testid={`${testId}-cancel`}
                className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={confirmLoading}
                data-testid={`${testId}-confirm`}
                className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 ${confirmClass}`}
              >
                {confirmLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                )}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
