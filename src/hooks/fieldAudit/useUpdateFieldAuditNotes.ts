/**
 * useUpdateFieldAuditNotes — persist the closing notes on a DRAFT audit.
 *
 * The Review & Submit panel autosaves notes on blur so a reload / crash never
 * loses the auditor's summary (server is the source of truth; localStorage only
 * holds the audit pointer). `submit_field_audit` also accepts `p_notes`, so the
 * final value rides the submit call regardless — this hook just keeps the draft
 * warm. Submitted audits are immutable (trigger) and the row-level RLS policy
 * only lets the auditor / admin-tier touch drafts, so no client-side gating.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";

export interface UpdateFieldAuditNotesInput {
  auditId: string;
  notes: string | null;
}

export function useUpdateFieldAuditNotes() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: UpdateFieldAuditNotesInput): Promise<string | null> => {
      const notes = input.notes?.trim() ? input.notes.trim() : null;
      const { error } = await supabase
        .from("field_audits")
        .update({ notes })
        .eq("id", input.auditId)
        .eq("status", "draft");
      if (error) throw new Error(error.message);
      return notes;
    },
    onSuccess: (notes, input) => {
      queryClient.setQueryData<{ notes?: string | null } | null | undefined>(
        queryKeys.fieldAudit.detail(input.auditId),
        (prev) => (prev ? { ...prev, notes } : prev),
      );
    },
  });

  return {
    saveNotes: mutation.mutateAsync,
    isSavingNotes: mutation.isPending,
    notesError: mutation.error,
  };
}
