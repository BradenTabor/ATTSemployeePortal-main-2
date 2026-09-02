/**
 * EscalationControl — escalate a saved FAIL finding to a corrective action (Chunk 4).
 *
 * Rendered inside a Fail row once the finding is saved (has an item id). A
 * recorded fail is "record only" by default; this control escalates it to a
 * corrective action via `escalate_field_audit_item` — optionally with a points
 * deduction for a person subject (the amount is server-read + clamped; the
 * client only expresses intent). Once issued it collapses to a static
 * "Corrective action issued" badge. The RPC is idempotent, so a stray re-tap is
 * a no-op that returns the same corrective action.
 */

import { useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useEscalateFieldAuditItem } from "../../../hooks/fieldAudit";
import {
  FIELD_AUDIT_ACTION_TYPES,
  defaultCorrectiveDueDate,
  type FieldAuditActionType,
  type FindingSubjectType,
} from "../fieldAuditConstants";

interface EscalationControlProps {
  auditId: string;
  itemId: string;
  subjectType: FindingSubjectType;
  correctiveActionId: string | null;
  /** Non-null when the required note/photo is still missing (blocks escalation). */
  disabledReason: string | null;
  onEscalated: (correctiveActionId: string) => void;
}

export default function EscalationControl({
  auditId,
  itemId,
  subjectType,
  correctiveActionId,
  disabledReason,
  onEscalated,
}: EscalationControlProps) {
  const { escalate, isEscalating } = useEscalateFieldAuditItem(auditId);
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState<FieldAuditActionType>("immediate");
  const [dueDate, setDueDate] = useState<string>(() => defaultCorrectiveDueDate());
  const [deductPoints, setDeductPoints] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already escalated → static badge (the RPC is idempotent regardless).
  if (correctiveActionId) {
    return (
      <div
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-1.5 text-xs font-medium text-emerald-300"
        data-testid="field-audit-escalation-issued"
      >
        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
        Corrective action issued
      </div>
    );
  }

  const handleIssue = async () => {
    setError(null);
    try {
      const caId = await escalate({
        itemId,
        // Person + "deduct" => null (RPC reads/clamps config); else no points.
        deduction: deductPoints && subjectType === "person" ? null : 0,
        actionType,
        dueDate: dueDate || null,
        assignedTo: null,
      });
      onEscalated(caId);
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not issue the corrective action.",
      );
    }
  };

  if (!open) {
    return (
      <div className="mt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={Boolean(disabledReason)}
          data-testid="field-audit-escalate-toggle"
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-2.5 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        >
          <ShieldAlert className="w-3.5 h-3.5" aria-hidden />
          Issue corrective action
          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </button>
        {disabledReason && (
          <p className="mt-1 text-[11px] text-white/40">{disabledReason}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 space-y-3"
      data-testid="field-audit-escalation-form"
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase text-amber-200/80 font-mono font-medium tracking-[0.14em]">
        <ShieldAlert className="w-3.5 h-3.5" aria-hidden />
        Corrective action
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label
            className="block text-[11px] text-white/50 mb-1"
            htmlFor={`esc-type-${itemId}`}
          >
            Action type
          </label>
          <select
            id={`esc-type-${itemId}`}
            value={actionType}
            onChange={(e) =>
              setActionType(e.target.value as FieldAuditActionType)
            }
            data-testid="field-audit-escalate-action-type"
            className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
          >
            {FIELD_AUDIT_ACTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="block text-[11px] text-white/50 mb-1"
            htmlFor={`esc-due-${itemId}`}
          >
            Due date
          </label>
          <input
            id={`esc-due-${itemId}`}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            data-testid="field-audit-escalate-due-date"
            className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-1.5 text-sm text-white [color-scheme:dark] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
          />
        </div>
      </div>

      {subjectType !== "person" && (
        <p className="text-[11px] text-white/45">
          {subjectType === "site"
            ? "Site findings are assigned to the crew foreman."
            : "Equipment findings are assigned to the crew foreman."}
        </p>
      )}

      {subjectType === "person" && (
        <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={deductPoints}
            onChange={(e) => setDeductPoints(e.target.checked)}
            data-testid="field-audit-escalate-deduct-points"
            className="h-4 w-4 rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-400/50"
          />
          Also deduct safety reward points (amount set by admin)
        </label>
      )}

      {error && (
        <p className="text-[11px] text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleIssue()}
          disabled={isEscalating}
          data-testid="field-audit-escalate-submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 border border-amber-500/30 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        >
          {isEscalating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5" aria-hidden />
          )}
          Issue corrective action
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={isEscalating}
          data-testid="field-audit-escalate-cancel"
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
