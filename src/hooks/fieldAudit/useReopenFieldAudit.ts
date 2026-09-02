/**
 * useReopenFieldAudit — admin-only `submitted → draft` (correction path).
 *
 * Wraps the SECURITY DEFINER RPC `reopen_field_audit`. Submitted audits are
 * immutable at the row level (trigger-enforced), so this is the ONLY sanctioned
 * way to amend one: an admin reopens it, the original auditor (or any
 * admin / safety officer / GF) resumes it from the history page, then re-submits.
 * Idempotent — reopening a draft is a no-op that returns the same id.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";

export function useReopenFieldAudit() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (auditId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("reopen_field_audit", {
        p_audit_id: auditId,
      });
      if (error) throw new Error(error.message);
      if (typeof data !== "string") {
        throw new Error("Reopen did not return the audit id.");
      }
      return data;
    },
    onSuccess: (auditId) => {
      queryClient.removeQueries({ queryKey: queryKeys.fieldAudit.detail(auditId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.fieldAudit.all });
    },
  });

  return {
    reopen: mutation.mutateAsync,
    isReopening: mutation.isPending,
  };
}
