/**
 * useFieldAuditDetail — read-only full detail for one audit (Chunk 6).
 *
 * Powers the history detail modal: the audit row, its subjects, and every
 * checklist response in one self-contained query (keyed separately from the
 * live-draft `detail` cache so the two shapes never collide). The modal resolves
 * checklist-item labels via the cached `useAuditChecklistItems` config and person
 * names via `useCrewMembers`, and computes per-subject pass/fail rollups
 * read-time with `summarizeItems`.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import type {
  FieldAuditItem,
  FieldAuditSubject,
} from "../../pages/safety-officer/fieldAuditConstants";

export interface FieldAuditDetailRow {
  id: string;
  audit_date: string;
  status: "draft" | "submitted";
  work_site_id: string | null;
  location_text: string | null;
  crew_id: string | null;
  crew_name: string | null;
  foreman_id: string | null;
  auditor_id: string;
  notes: string | null;
  created_at: string;
  submitted_at: string | null;
}

export interface FieldAuditDetail {
  audit: FieldAuditDetailRow;
  subjects: FieldAuditSubject[];
  items: FieldAuditItem[];
}

const AUDIT_COLUMNS =
  "id, audit_date, status, work_site_id, location_text, crew_id, crew_name, foreman_id, auditor_id, notes, created_at, submitted_at";
const SUBJECT_COLUMNS =
  "id, field_audit_id, subject_type, person_id, equipment_type, equipment_number, is_custom_equipment, created_at";
const ITEM_COLUMNS =
  "id, field_audit_id, field_audit_subject_id, checklist_item_id, custom_label, result, note, photo_path, corrective_action_id";

export function useFieldAuditDetail(auditId: string | null) {
  return useQuery({
    queryKey: queryKeys.fieldAudit.historyDetail(auditId ?? "none"),
    enabled: Boolean(auditId),
    staleTime: 1000 * 30,
    queryFn: async (): Promise<FieldAuditDetail> => {
      const id = auditId as string;
      const [auditRes, subjectsRes, itemsRes] = await Promise.all([
        supabase.from("field_audits").select(AUDIT_COLUMNS).eq("id", id).single(),
        supabase
          .from("field_audit_subjects")
          .select(SUBJECT_COLUMNS)
          .eq("field_audit_id", id)
          .order("created_at", { ascending: true }),
        supabase.from("field_audit_items").select(ITEM_COLUMNS).eq("field_audit_id", id),
      ]);

      if (auditRes.error) throw new Error(auditRes.error.message);
      if (subjectsRes.error) throw new Error(subjectsRes.error.message);
      if (itemsRes.error) throw new Error(itemsRes.error.message);

      return {
        audit: auditRes.data as FieldAuditDetailRow,
        subjects: (subjectsRes.data ?? []) as FieldAuditSubject[],
        items: (itemsRes.data ?? []) as FieldAuditItem[],
      };
    },
  });
}
