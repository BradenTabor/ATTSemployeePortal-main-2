/**
 * useCreateFieldNote — append a persistent field note (Chunk 5).
 *
 * Writes one `field_notes` row via the author/supervisor INSERT policy (caller
 * must be admin/safety/GF and author_id must equal auth.uid()). The log is
 * append-only — there is no update/delete path. On success the subject's
 * recent-notes query is invalidated so RecentNotesStrip reflects the new note.
 *
 * Standalone notes pass fieldAuditId = null; a note written from a subject card
 * during an audit carries the audit id for provenance (it still outlives the
 * audit, surfacing by person/equipment identity).
 */

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import {
  FIELD_NOTE_ISSUANCE_KINDS,
  fieldNotesSubjectKey,
  normalizeEquipmentNumber,
  type FieldNote,
  type FieldNoteKind,
} from "../../pages/safety-officer/fieldAuditConstants";

const NOTE_COLUMNS =
  "id, field_audit_id, author_id, subject_type, person_id, equipment_type, equipment_number, is_custom_equipment, note, note_kind, item_tag, created_at";

export interface CreateFieldNoteInput {
  subjectType: "person" | "equipment";
  /** Required when subjectType === 'person'. */
  personId: string | null;
  /** Required when subjectType === 'equipment'. */
  equipmentType: string | null;
  /** Required when subjectType === 'equipment' (normalized upper-trim on write). */
  equipmentNumber: string | null;
  isCustomEquipment?: boolean;
  noteKind: FieldNoteKind;
  /** Optional free-text item (e.g. "hard hat"); blanks are stored as null. */
  itemTag: string | null;
  body: string;
  /** Set when written during an audit session; null for standalone notes. */
  fieldAuditId?: string | null;
}

export function useCreateFieldNote() {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const createNote = useCallback(
    async (input: CreateFieldNoteInput): Promise<FieldNote> => {
      const body = input.body.trim();
      if (!body) throw new Error("Enter a note before saving.");
      const itemTag = input.itemTag?.trim() || null;
      if (FIELD_NOTE_ISSUANCE_KINDS.has(input.noteKind) && !itemTag) {
        throw new Error("Name the item issued for PPE / equipment notes.");
      }

      // author_id must equal auth.uid() (RLS); read it from the local session.
      const { data: sessionData } = await supabase.auth.getSession();
      const authorId = sessionData.session?.user.id;
      if (!authorId) throw new Error("You must be signed in to add a note.");

      const identity =
        input.subjectType === "person"
          ? {
              subject_type: "person" as const,
              person_id: input.personId,
              equipment_type: null,
              equipment_number: null,
              is_custom_equipment: false,
            }
          : {
              subject_type: "equipment" as const,
              person_id: null,
              equipment_type: input.equipmentType,
              equipment_number: input.equipmentNumber
                ? normalizeEquipmentNumber(input.equipmentNumber)
                : null,
              is_custom_equipment: input.isCustomEquipment ?? false,
            };

      if (identity.subject_type === "person" && !identity.person_id) {
        throw new Error("Choose the person this note is about.");
      }
      if (
        identity.subject_type === "equipment" &&
        (!identity.equipment_type || !identity.equipment_number)
      ) {
        throw new Error("Choose the equipment type and unit this note is about.");
      }

      setIsSaving(true);
      try {
        const { data, error } = await supabase
          .from("field_notes")
          .insert({
            ...identity,
            author_id: authorId,
            field_audit_id: input.fieldAuditId ?? null,
            note: body,
            note_kind: input.noteKind,
            item_tag: itemTag,
          })
          .select(NOTE_COLUMNS)
          .single();
        if (error) throw new Error(error.message);

        const note = data as FieldNote;
        // Refresh the subject's recent-notes strip (key mirrors the read hook).
        const key = fieldNotesSubjectKey({
          subject_type: note.subject_type,
          person_id: note.person_id,
          equipment_type: note.equipment_type,
          equipment_number: note.equipment_number,
        });
        await queryClient.invalidateQueries({
          queryKey: queryKeys.fieldAudit.notesForSubject(key),
        });
        return note;
      } finally {
        setIsSaving(false);
      }
    },
    [queryClient],
  );

  return { createNote, isSaving };
}
