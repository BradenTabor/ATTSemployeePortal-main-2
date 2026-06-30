/**
 * useFieldSubjectTimeline — one subject's interleaved history (Chunk 6).
 *
 * The "Chad's hard hat history" view: for a single person (`person_id`) or a
 * single equipment unit (`equipment_type` + normalized `equipment_number`), it
 * interleaves that subject's audit findings (failing `field_audit_items` across
 * every audit they appeared in) with their persistent `field_notes`, sorted
 * newest-first.
 *
 * Identity hygiene (D2): the unit number is normalized upper-trim at query time —
 * the SAME normalization every write path applies — so a typed `j119` resolves to
 * the stored `J-119`. If the query input and the stored value were normalized
 * differently the join would fragment; here both sides go through
 * `normalizeEquipmentNumber`, so they don't.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import {
  hasTimelineIdentity,
  normalizeEquipmentNumber,
  timelineSubjectCacheKey,
  type FieldNoteKind,
  type TimelineSubjectIdentity,
} from "../../pages/safety-officer/fieldAuditConstants";

export type TimelineEntry =
  | {
      kind: "finding";
      id: string;
      /** field_audit_items.created_at (timestamptz) — used for ordering. */
      sortAt: string;
      /** field_audits.audit_date — used for display. */
      auditDate: string;
      auditId: string;
      checklistItemId: string | null;
      customLabel: string | null;
      note: string | null;
      photoPath: string | null;
      escalated: boolean;
      workSiteId: string | null;
      locationText: string | null;
    }
  | {
      kind: "note";
      id: string;
      /** field_notes.created_at — ordering + display. */
      sortAt: string;
      noteKind: FieldNoteKind;
      itemTag: string | null;
      body: string;
      fieldAuditId: string | null;
    };

export interface SubjectTimeline {
  entries: TimelineEntry[];
  findingCount: number;
  noteCount: number;
  /** Distinct audits this subject appeared in. */
  auditCount: number;
}

async function fetchSubjectTimeline(
  identity: TimelineSubjectIdentity,
): Promise<SubjectTimeline> {
  const isPerson = identity.subjectType === "person";
  const normalizedNumber = identity.equipmentNumber
    ? normalizeEquipmentNumber(identity.equipmentNumber)
    : "";

  // 1) Subjects for this identity (across every audit they appeared in).
  let subjectsQuery = supabase
    .from("field_audit_subjects")
    .select("id, field_audit_id");
  subjectsQuery = isPerson
    ? subjectsQuery.eq("person_id", identity.personId as string)
    : subjectsQuery
        .eq("equipment_type", identity.equipmentType as string)
        .eq("equipment_number", normalizedNumber);

  const subjectsRes = await subjectsQuery;
  if (subjectsRes.error) throw new Error(subjectsRes.error.message);
  const subjects = (subjectsRes.data ?? []) as Array<{
    id: string;
    field_audit_id: string;
  }>;
  const subjectIds = subjects.map((s) => s.id);
  const auditIds = new Set(subjects.map((s) => s.field_audit_id));

  // 2) Failing items (findings) for those subjects, and notes for the identity.
  let notesQuery = supabase
    .from("field_notes")
    .select("id, field_audit_id, note, note_kind, item_tag, created_at")
    .order("created_at", { ascending: false });
  notesQuery = isPerson
    ? notesQuery.eq("person_id", identity.personId as string)
    : notesQuery
        .eq("equipment_type", identity.equipmentType as string)
        .eq("equipment_number", normalizedNumber);

  const [findingsRes, notesRes] = await Promise.all([
    subjectIds.length > 0
      ? supabase
          .from("field_audit_items")
          .select(
            "id, field_audit_id, checklist_item_id, custom_label, note, photo_path, corrective_action_id, created_at",
          )
          .in("field_audit_subject_id", subjectIds)
          .eq("result", "fail")
      : Promise.resolve({ data: [], error: null } as const),
    notesQuery,
  ]);
  if (findingsRes.error) throw new Error(findingsRes.error.message);
  if (notesRes.error) throw new Error(notesRes.error.message);

  const findings = (findingsRes.data ?? []) as Array<{
    id: string;
    field_audit_id: string;
    checklist_item_id: string | null;
    custom_label: string | null;
    note: string | null;
    photo_path: string | null;
    corrective_action_id: string | null;
    created_at: string;
  }>;
  const notes = (notesRes.data ?? []) as Array<{
    id: string;
    field_audit_id: string | null;
    note: string;
    note_kind: FieldNoteKind;
    item_tag: string | null;
    created_at: string;
  }>;

  // 3) Audit dates/context for the findings (and any audit referenced by a note).
  for (const f of findings) auditIds.add(f.field_audit_id);
  for (const n of notes) if (n.field_audit_id) auditIds.add(n.field_audit_id);

  const auditMeta = new Map<
    string,
    { audit_date: string; work_site_id: string | null; location_text: string | null }
  >();
  if (auditIds.size > 0) {
    const { data, error } = await supabase
      .from("field_audits")
      .select("id, audit_date, work_site_id, location_text")
      .in("id", [...auditIds]);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const r = row as {
        id: string;
        audit_date: string;
        work_site_id: string | null;
        location_text: string | null;
      };
      auditMeta.set(r.id, {
        audit_date: r.audit_date,
        work_site_id: r.work_site_id,
        location_text: r.location_text,
      });
    }
  }

  // 4) Merge into a single chronologically-sorted timeline.
  const entries: TimelineEntry[] = [];
  for (const f of findings) {
    const meta = auditMeta.get(f.field_audit_id);
    entries.push({
      kind: "finding",
      id: f.id,
      sortAt: f.created_at,
      auditDate: meta?.audit_date ?? f.created_at.slice(0, 10),
      auditId: f.field_audit_id,
      checklistItemId: f.checklist_item_id,
      customLabel: f.custom_label,
      note: f.note,
      photoPath: f.photo_path,
      escalated: Boolean(f.corrective_action_id),
      workSiteId: meta?.work_site_id ?? null,
      locationText: meta?.location_text ?? null,
    });
  }
  for (const n of notes) {
    entries.push({
      kind: "note",
      id: n.id,
      sortAt: n.created_at,
      noteKind: n.note_kind,
      itemTag: n.item_tag,
      body: n.note,
      fieldAuditId: n.field_audit_id,
    });
  }
  entries.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

  return {
    entries,
    findingCount: findings.length,
    noteCount: notes.length,
    auditCount: auditIds.size,
  };
}

export function useFieldSubjectTimeline(identity: TimelineSubjectIdentity | null) {
  const enabled = hasTimelineIdentity(identity);
  const key = identity ? timelineSubjectCacheKey(identity) : "none";

  return useQuery({
    queryKey: queryKeys.fieldAudit.timeline(key),
    enabled,
    staleTime: 1000 * 30,
    queryFn: () => fetchSubjectTimeline(identity as TimelineSubjectIdentity),
  });
}
