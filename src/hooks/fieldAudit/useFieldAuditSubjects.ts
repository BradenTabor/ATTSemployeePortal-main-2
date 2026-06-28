/**
 * useFieldAuditSubjects — the people + equipment under one audit (Chunk 3).
 *
 * Loads `field_audit_subjects` for the audit and provides add/remove mutations.
 * Equipment identity is normalized upper-trim on save (history-join hygiene);
 * a duplicate subject (unique index) surfaces a friendly error. Removing a
 * subject cascades its items server-side, so we invalidate the items cache.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import {
  normalizeCustomType,
  normalizeEquipmentNumber,
  type FieldAuditSubject,
} from "../../pages/safety-officer/fieldAuditConstants";

const SUBJECT_COLUMNS =
  "id, field_audit_id, subject_type, person_id, equipment_type, equipment_number, is_custom_equipment, created_at";

export type AddSubjectInput =
  | { kind: "person"; personId: string }
  | {
      kind: "equipment";
      equipmentType: string;
      equipmentNumber: string;
      isCustom: boolean;
    };

export function useFieldAuditSubjects(auditId: string | null) {
  const queryClient = useQueryClient();
  const enabled = Boolean(auditId);

  const query = useQuery({
    queryKey: queryKeys.fieldAudit.subjects(auditId ?? "none"),
    enabled,
    staleTime: 0,
    queryFn: async (): Promise<FieldAuditSubject[]> => {
      const { data, error } = await supabase
        .from("field_audit_subjects")
        .select(SUBJECT_COLUMNS)
        .eq("field_audit_id", auditId as string)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as FieldAuditSubject[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (input: AddSubjectInput): Promise<FieldAuditSubject> => {
      if (!auditId) throw new Error("No active audit.");

      const payload =
        input.kind === "person"
          ? {
              field_audit_id: auditId,
              subject_type: "person" as const,
              person_id: input.personId,
            }
          : {
              field_audit_id: auditId,
              subject_type: "equipment" as const,
              equipment_type: input.isCustom
                ? normalizeCustomType(input.equipmentType)
                : input.equipmentType,
              equipment_number:
                normalizeEquipmentNumber(input.equipmentNumber) || null,
              is_custom_equipment: input.isCustom,
            };

      const { data, error } = await supabase
        .from("field_audit_subjects")
        .insert(payload)
        .select(SUBJECT_COLUMNS)
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("That subject is already on this audit.");
        }
        throw new Error(error.message);
      }
      return data as FieldAuditSubject;
    },
    onSuccess: (row) => {
      queryClient.setQueryData<FieldAuditSubject[]>(
        queryKeys.fieldAudit.subjects(auditId ?? "none"),
        (prev) => [...(prev ?? []), row],
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (subjectId: string): Promise<string> => {
      const { error } = await supabase
        .from("field_audit_subjects")
        .delete()
        .eq("id", subjectId);
      if (error) throw new Error(error.message);
      return subjectId;
    },
    onSuccess: (subjectId) => {
      queryClient.setQueryData<FieldAuditSubject[]>(
        queryKeys.fieldAudit.subjects(auditId ?? "none"),
        (prev) => (prev ?? []).filter((s) => s.id !== subjectId),
      );
      // Items cascade-deleted server-side; drop them from cache too.
      queryClient.invalidateQueries({
        queryKey: queryKeys.fieldAudit.items(auditId ?? "none"),
      });
    },
  });

  return {
    subjects: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    addSubject: addMutation.mutateAsync,
    isAddingSubject: addMutation.isPending,
    removeSubject: removeMutation.mutateAsync,
  };
}
