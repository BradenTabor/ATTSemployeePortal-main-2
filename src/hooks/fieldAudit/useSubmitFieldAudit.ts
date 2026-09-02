/**
 * useSubmitFieldAudit — close out a draft (Review & Submit).
 *
 * Wraps the SECURITY DEFINER RPC `submit_field_audit(p_audit_id, p_notes)`.
 * The RPC is the floor for readiness: it refuses an empty audit or a Fail with no
 * finding note (HINT codes `FIELD_AUDIT_EMPTY` / `FIELD_AUDIT_FAIL_NOTE_MISSING`),
 * flips `draft → submitted`, folds the closing notes into the row, emits exactly
 * one `safety_alert` to the crew foreman (user target, never role fan-out) and
 * returns the read-time rollup. It is idempotent: re-submitting an already
 * submitted audit returns the same summary with `already_submitted: true`.
 *
 * The client-side readiness module (`fieldAuditReadiness.ts`) mirrors the blocker
 * rules so the auditor almost never hits the server gate; when they do (stale
 * tab, concurrent edit) the HINT is surfaced as a `FieldAuditSubmitError` with a
 * `readinessCode` the panel can highlight.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import {
  readinessCodeFromServerHint,
  type ReadinessCode,
} from "../../pages/safety-officer/fieldAuditReadiness";

export interface FieldAuditSubmitSummary {
  audit_id: string;
  status: "submitted";
  submitted_at: string;
  already_submitted: boolean;
  notified_foreman: boolean;
  subjects: { people: number; equipment: number };
  checks: {
    total: number;
    pass: number;
    fail: number;
    na: number;
    open_fail: number;
    site: number;
    custom: number;
  };
}

export interface SubmitFieldAuditInput {
  auditId: string;
  /** Closing notes; blank keeps whatever is already on the row. */
  notes: string | null;
}

/** Thrown when the RPC refuses the submit; carries the mapped readiness code. */
export class FieldAuditSubmitError extends Error {
  readonly hint: string | null;
  readonly readinessCode: ReadinessCode | null;

  constructor(message: string, hint: string | null) {
    super(message);
    this.name = "FieldAuditSubmitError";
    this.hint = hint;
    this.readinessCode = readinessCodeFromServerHint(hint);
  }
}

export function isFieldAuditSubmitError(err: unknown): err is FieldAuditSubmitError {
  return err instanceof FieldAuditSubmitError;
}

function isSummary(value: unknown): value is FieldAuditSubmitSummary {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.audit_id === "string" &&
    v.status === "submitted" &&
    typeof v.submitted_at === "string" &&
    typeof v.checks === "object" &&
    v.checks !== null
  );
}

export function useSubmitFieldAudit() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: SubmitFieldAuditInput): Promise<FieldAuditSubmitSummary> => {
      const notes = input.notes?.trim() ? input.notes.trim() : null;
      const { data, error } = await supabase.rpc("submit_field_audit", {
        p_audit_id: input.auditId,
        p_notes: notes,
      });
      if (error) {
        throw new FieldAuditSubmitError(error.message, error.hint ?? null);
      }
      if (!isSummary(data)) {
        throw new FieldAuditSubmitError(
          "Submit did not return a summary. Refresh and check the history page.",
          null,
        );
      }
      return data;
    },
    onSuccess: (summary) => {
      // Live-draft detail cache: flip status so any resume logic sees "submitted".
      queryClient.setQueryData<{ status: string } | null | undefined>(
        queryKeys.fieldAudit.detail(summary.audit_id),
        (prev) =>
          prev
            ? { ...prev, status: "submitted", submitted_at: summary.submitted_at }
            : prev,
      );
      // History list, history detail and subject timelines all change.
      queryClient.invalidateQueries({ queryKey: queryKeys.fieldAudit.all });
    },
  });

  return {
    submit: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    submitError: mutation.error,
    reset: mutation.reset,
  };
}
