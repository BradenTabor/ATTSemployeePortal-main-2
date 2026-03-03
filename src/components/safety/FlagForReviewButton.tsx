/**
 * FlagForReviewButton — Opens a modal to flag a form for SO/GF review (creates safety_flags row).
 * Modal is portaled to document.body so it displays above the layout scroll container.
 */

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";

export type SafetyFlagFormType = "jsa" | "dvir" | "equipment" | "incident" | "near_miss";

interface FlagForReviewButtonProps {
  formType: SafetyFlagFormType;
  formId: string;
  onSuccess?: () => void;
  className?: string;
  variant?: "button" | "icon";
}

export default function FlagForReviewButton({
  formType,
  formId,
  onSuccess,
  className = "",
  variant = "button",
}: FlagForReviewButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!reason.trim() || !user?.id) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("safety_flags").insert({
        flagged_by: user.id,
        form_type: formType,
        form_id: formId,
        reason: reason.trim(),
        status: "open",
      });
      if (error) throw new Error(error.message);
      toast.success("Flagged for review");
      setReason("");
      setOpen(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to flag");
    } finally {
      setSubmitting(false);
    }
  }, [reason, user?.id, formType, formId, onSuccess]);

  const handleClose = useCallback(() => {
    if (!submitting) setOpen(false);
  }, [submitting]);

  if (!user) return null;

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={className || "p-2 rounded-lg border border-white/10 hover:bg-white/5 text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"}
          aria-label="Flag for review"
        >
          <Flag className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={className || "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"}
        >
          <Flag className="w-4 h-4" />
          Flag for review
        </button>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="flag-dialog-title"
          >
            <div className="rounded-xl border border-white/10 bg-gray-900 p-4 w-full max-w-md shadow-xl">
              <h2 id="flag-dialog-title" className="text-lg font-semibold text-white mb-3">
                Flag for review
              </h2>
              <p className="text-sm text-white/60 mb-3">
                This will notify safety officers. Provide a brief reason.
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Needs follow-up on hazard control"
                className="w-full rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-white/40 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                rows={3}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-white/80 hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !reason.trim()}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                  Submit
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
