/**
 * useAuditChecklistItems — the seeded `audit_checklist_items` config (Chunk 3).
 *
 * Read-only config that drives the per-subject checklist by `subject_scope` +
 * `equipment_types` containment. Cached long (config rarely changes); RLS lets
 * any authenticated user SELECT.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import type { AuditChecklistItem } from "../../pages/safety-officer/fieldAuditConstants";

const CHECKLIST_COLUMNS =
  "id, section_key, item_key, label, standard_ref, subject_scope, equipment_types, sort_order, requires_photo_on_fail";

export function useAuditChecklistItems() {
  return useQuery({
    queryKey: queryKeys.fieldAudit.checklistConfig(),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    queryFn: async (): Promise<AuditChecklistItem[]> => {
      const { data, error } = await supabase
        .from("audit_checklist_items")
        .select(CHECKLIST_COLUMNS)
        .eq("is_active", true)
        .order("section_key", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as AuditChecklistItem[];
    },
  });
}
