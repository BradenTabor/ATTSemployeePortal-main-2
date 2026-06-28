/**
 * useFieldNotesForSubject — read-only recent persistent notes for a subject.
 *
 * Surfaces the 3 most recent `field_notes` for a person (by person_id) or a piece
 * of equipment (by type+number) so the auditor sees prior context on the subject
 * card. Writing notes lands in Chunk 5 — this hook only reads. RLS lets
 * admin/safety/GF select notes.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import {
  fieldNotesSubjectKey,
  type FieldNote,
  type FieldAuditSubject,
} from "../../pages/safety-officer/fieldAuditConstants";

export type FieldNotesSubject = Pick<
  FieldAuditSubject,
  "subject_type" | "person_id" | "equipment_type" | "equipment_number"
>;

const NOTE_COLUMNS =
  "id, field_audit_id, author_id, subject_type, person_id, equipment_type, equipment_number, is_custom_equipment, note, note_kind, item_tag, created_at";

/** How many recent notes to surface on a subject card. */
export const RECENT_NOTES_LIMIT = 3;

function hasIdentity(subject: FieldNotesSubject | null): subject is FieldNotesSubject {
  if (!subject) return false;
  return subject.subject_type === "person"
    ? Boolean(subject.person_id)
    : Boolean(subject.equipment_type);
}

export function useFieldNotesForSubject(subject: FieldNotesSubject | null) {
  const enabled = hasIdentity(subject);
  const key = subject ? fieldNotesSubjectKey(subject) : "none";

  return useQuery({
    queryKey: queryKeys.fieldAudit.notesForSubject(key),
    enabled,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<FieldNote[]> => {
      if (!subject) return [];
      let query = supabase
        .from("field_notes")
        .select(NOTE_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(RECENT_NOTES_LIMIT);

      if (subject.subject_type === "person") {
        query = query.eq("person_id", subject.person_id as string);
      } else {
        query = query.eq("equipment_type", subject.equipment_type as string);
        query = subject.equipment_number
          ? query.eq("equipment_number", subject.equipment_number)
          : query.is("equipment_number", null);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as FieldNote[];
    },
  });
}
