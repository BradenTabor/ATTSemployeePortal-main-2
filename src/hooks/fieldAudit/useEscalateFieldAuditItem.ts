/**
 * useEscalateFieldAuditItem — issue a corrective action for a FAIL item (Chunk 4).
 *
 * Wraps the SECURITY DEFINER RPC `escalate_field_audit_item`, which atomically
 * creates the corrective action, writes the (clamped, raffle-excluded) points
 * deduction for a person subject, and emits the safety_alert notification_events
 * (employee + crew foreman / general_foreman fallback). The RPC is idempotent —
 * early-return + claim-update gate the CA/notifications and the ledger rides its
 * own partial unique index — so a re-tap returns the SAME corrective-action id
 * with no second ledger row or notification.
 *
 * On success the item's `corrective_action_id` is patched into the items cache so
 * the row reflects the issued state without a refetch, and the CAPA lists are
 * invalidated (the restored near-miss -> corrective-action flow consumes them).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import type {
  FieldAuditActionType,
  FieldAuditItem,
} from "../../pages/safety-officer/fieldAuditConstants";

export interface EscalateItemInput {
  itemId: string;
  /**
   * Points to deduct. `null` => the RPC reads `app_settings.field_audit_config`
   * and hard-clamps to [0, 25]; `0` => a corrective action with no deduction.
   * The client only expresses intent — it never invents an amount.
   */
  deduction: number | null;
  actionType: FieldAuditActionType;
  /** `YYYY-MM-DD`, or null to let the RPC default to +7 days (America/Chicago). */
  dueDate: string | null;
  /** Explicit assignee override; null lets the RPC default to the audited person. */
  assignedTo: string | null;
}

export function useEscalateFieldAuditItem(auditId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: EscalateItemInput): Promise<string> => {
      const { data, error } = await supabase.rpc("escalate_field_audit_item", {
        p_item_id: input.itemId,
        p_deduction: input.deduction,
        p_action_type: input.actionType,
        p_due_date: input.dueDate,
        p_assigned_to: input.assignedTo,
      });
      if (error) throw new Error(error.message);
      if (!data) {
        throw new Error("Escalation did not return a corrective action.");
      }
      return data as string;
    },
    onSuccess: (correctiveActionId, input) => {
      if (auditId) {
        queryClient.setQueryData<FieldAuditItem[]>(
          queryKeys.fieldAudit.items(auditId),
          (prev) =>
            (prev ?? []).map((i) =>
              i.id === input.itemId
                ? { ...i, corrective_action_id: correctiveActionId }
                : i,
            ),
        );
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.correctiveActions.all,
      });
    },
  });

  return {
    escalate: mutation.mutateAsync,
    isEscalating: mutation.isPending,
  };
}
