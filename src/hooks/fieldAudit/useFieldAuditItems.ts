/**
 * useFieldAuditItems — per-audit checklist responses with live upsert (Chunk 3).
 *
 * Loads every `field_audit_items` row for the audit (so a resumed draft hydrates
 * its answers) and exposes a single `saveItem` that inserts-or-updates a row by
 * its natural key (subject + seeded checklist item — subject NULL for audit-wide
 * site checks) or by an explicit id (ad-hoc and updates). Writes are optimistic: the query cache is patched from the
 * returned row so the UI stays snappy without a refetch (D1: items upsert live
 * to the server).
 */

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import type {
  FieldAuditItem,
  FieldAuditResult,
} from "../../pages/safety-officer/fieldAuditConstants";

const ITEM_COLUMNS =
  "id, field_audit_id, field_audit_subject_id, checklist_item_id, custom_label, result, note, photo_path, corrective_action_id";

export interface SaveItemInput {
  /** Subject the response belongs to, or null for audit-wide site checks. */
  subjectId: string | null;
  /** Seeded item id, or null for an ad-hoc custom item. */
  checklistItemId: string | null;
  /** Required when checklistItemId is null. */
  customLabel: string | null;
  result: FieldAuditResult;
  note: string | null;
  photoPath: string | null;
  /** Known row id (update target) — set for ad-hoc rows and re-saves. */
  existingItemId: string | null;
}

function upsertInList(
  list: FieldAuditItem[],
  row: FieldAuditItem,
): FieldAuditItem[] {
  const idx = list.findIndex((i) => i.id === row.id);
  if (idx === -1) return [...list, row];
  const next = list.slice();
  next[idx] = row;
  return next;
}

export function useFieldAuditItems(auditId: string | null) {
  const queryClient = useQueryClient();
  const enabled = Boolean(auditId);

  const query = useQuery({
    queryKey: queryKeys.fieldAudit.items(auditId ?? "none"),
    enabled,
    staleTime: 0,
    queryFn: async (): Promise<FieldAuditItem[]> => {
      const { data, error } = await supabase
        .from("field_audit_items")
        .select(ITEM_COLUMNS)
        .eq("field_audit_id", auditId as string);
      if (error) throw new Error(error.message);
      return (data ?? []) as FieldAuditItem[];
    },
  });

  const saveItem = useCallback(
    async (input: SaveItemInput): Promise<FieldAuditItem> => {
      if (!auditId) throw new Error("No active audit.");
      const cacheKey = queryKeys.fieldAudit.items(auditId);

      // Resolve update target: explicit id, else an existing seeded response.
      let targetId = input.existingItemId;
      if (!targetId && input.checklistItemId) {
        const cache =
          queryClient.getQueryData<FieldAuditItem[]>(cacheKey) ?? [];
        targetId =
          cache.find(
            (i) =>
              i.field_audit_subject_id === input.subjectId &&
              i.checklist_item_id === input.checklistItemId,
          )?.id ?? null;
      }

      let row: FieldAuditItem;
      if (targetId) {
        const { data, error } = await supabase
          .from("field_audit_items")
          .update({
            result: input.result,
            note: input.note,
            custom_label: input.customLabel,
            photo_path: input.photoPath,
          })
          .eq("id", targetId)
          .select(ITEM_COLUMNS)
          .single();
        if (error) throw new Error(error.message);
        row = data as FieldAuditItem;
      } else {
        const { data, error } = await supabase
          .from("field_audit_items")
          .insert({
            field_audit_id: auditId,
            field_audit_subject_id: input.subjectId,
            checklist_item_id: input.checklistItemId,
            custom_label: input.customLabel,
            result: input.result,
            note: input.note,
            photo_path: input.photoPath,
          })
          .select(ITEM_COLUMNS)
          .single();
        if (error) throw new Error(error.message);
        row = data as FieldAuditItem;
      }

      queryClient.setQueryData<FieldAuditItem[]>(cacheKey, (prev) =>
        upsertInList(prev ?? [], row),
      );
      return row;
    },
    [auditId, queryClient],
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<void> => {
      if (!auditId) return;
      const { error } = await supabase
        .from("field_audit_items")
        .delete()
        .eq("id", itemId);
      if (error) throw new Error(error.message);
      queryClient.setQueryData<FieldAuditItem[]>(
        queryKeys.fieldAudit.items(auditId),
        (prev) => (prev ?? []).filter((i) => i.id !== itemId),
      );
    },
    [auditId, queryClient],
  );

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    saveItem,
    removeItem,
  };
}
