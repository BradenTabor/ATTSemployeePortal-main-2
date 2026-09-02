/**
 * SubjectsTray — the Chunk 3 heart: add people/equipment to an audit and run
 * each subject's Pass/Fail/NA checklist, all upserting live to the server.
 *
 * Wires the field-audit hooks (config, subjects, items, photos) and the crew
 * roster (for the person picker) together, derives the per-subject item slices
 * and display names, and renders the AddSubjectPanel + SubjectCard list.
 */

import { useMemo, useState } from "react";
import { Loader2, MapPinned, Users } from "lucide-react";
import AddSubjectPanel, { type AddEquipmentInput } from "./AddSubjectPanel";
import SubjectCard from "./SubjectCard";
import SiteConditionsCard from "./SiteConditionsCard";
import { describeSubject } from "./subjectDisplay";
import { formToast } from "../../../lib/formToast";
import { useCrewMembers } from "../../../hooks/jobs/useCrewMembers";
import { useCrewDetails } from "../../../hooks/useCrews";
import {
  useAuditChecklistItems,
  useFieldAuditItems,
  useFieldAuditPhotos,
  useFieldAuditSubjects,
} from "../../../hooks/fieldAudit";
import type { FieldAuditItem } from "../fieldAuditConstants";

interface SubjectsTrayProps {
  auditId: string;
  crewId: string | null;
}

export default function SubjectsTray({ auditId, crewId }: SubjectsTrayProps) {
  const { data: configItems = [], isLoading: configLoading } =
    useAuditChecklistItems();
  const {
    subjects,
    isLoading: subjectsLoading,
    addSubject,
    isAddingSubject,
    removeSubject,
  } = useFieldAuditSubjects(auditId);
  const {
    items,
    isLoading: itemsLoading,
    saveItem,
    removeItem,
  } = useFieldAuditItems(auditId);
  const { uploadPhoto, deletePhoto, getSignedUrl } = useFieldAuditPhotos();

  const { crewMembers } = useCrewMembers();
  const { crew } = useCrewDetails(crewId);

  const [removingId, setRemovingId] = useState<string | null>(null);

  // app_users.id → profile (person display name + roster mapping).
  const profileById = useMemo(
    () => new Map(crewMembers.map((p) => [p.id, p])),
    [crewMembers],
  );

  // Crew roster as app_users ids (crew_members stores auth user_id → map via profiles).
  const crewRosterIds = useMemo(() => {
    if (!crew?.members?.length) return new Set<string>();
    const authIds = new Set(crew.members.map((m) => m.user_id));
    return new Set(
      crewMembers.filter((p) => authIds.has(p.user_id)).map((p) => p.id),
    );
  }, [crew, crewMembers]);

  const existingPersonIds = useMemo(
    () =>
      new Set(
        subjects
          .filter((s) => s.subject_type === "person" && s.person_id)
          .map((s) => s.person_id as string),
      ),
    [subjects],
  );

  // Subject rows keyed by subject; NULL-subject rows are the audit-wide site checks.
  const { itemsBySubject, siteItems } = useMemo(() => {
    const map = new Map<string, FieldAuditItem[]>();
    const site: FieldAuditItem[] = [];
    for (const it of items) {
      if (!it.field_audit_subject_id) {
        site.push(it);
        continue;
      }
      const arr = map.get(it.field_audit_subject_id);
      if (arr) arr.push(it);
      else map.set(it.field_audit_subject_id, [it]);
    }
    return { itemsBySubject: map, siteItems: site };
  }, [items]);

  const handleAddEquipment = async (input: AddEquipmentInput) => {
    try {
      await addSubject({
        kind: "equipment",
        equipmentType: input.equipmentType,
        equipmentNumber: input.equipmentNumber,
        isCustom: input.isCustom,
      });
    } catch (e) {
      formToast.error(
        "Could not add equipment",
        e instanceof Error ? e.message : "Please try again.",
      );
    }
  };

  const handleAddPerson = async (personId: string) => {
    try {
      await addSubject({ kind: "person", personId });
    } catch (e) {
      formToast.error(
        "Could not add person",
        e instanceof Error ? e.message : "Please try again.",
      );
    }
  };

  const handleRemove = async (subjectId: string) => {
    setRemovingId(subjectId);
    try {
      await removeSubject(subjectId);
    } catch (e) {
      formToast.error(
        "Could not remove subject",
        e instanceof Error ? e.message : "Please try again.",
      );
    } finally {
      setRemovingId(null);
    }
  };

  if (configLoading || subjectsLoading) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8"
        data-testid="field-audit-subjects-loading"
      >
        <Loader2 className="w-4 h-4 text-rose-300 animate-spin" aria-hidden />
        <span className="text-sm text-white/60">Loading checklist…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="field-audit-subjects-tray">
      {/* Audit-wide site checks — bound to the audit, not a person or unit. */}
      <div className="flex items-center gap-2">
        <MapPinned className="w-4 h-4 text-rose-300/80" aria-hidden />
        <h3 className="text-sm font-semibold text-white">Site</h3>
      </div>
      <SiteConditionsCard
        auditId={auditId}
        configItems={configItems}
        siteItems={siteItems}
        itemsLoading={itemsLoading}
        saveItem={saveItem}
        removeItem={removeItem}
        uploadPhoto={uploadPhoto}
        deletePhoto={deletePhoto}
        getSignedUrl={getSignedUrl}
      />

      <div className="flex items-center gap-2 pt-1">
        <Users className="w-4 h-4 text-rose-300/80" aria-hidden />
        <h3 className="text-sm font-semibold text-white">Subjects</h3>
        <span className="text-[11px] font-mono tabular-nums text-white/35">
          {subjects.length}
        </span>
      </div>

      <AddSubjectPanel
        crewMembers={crewMembers}
        crewRosterIds={crewRosterIds}
        existingPersonIds={existingPersonIds}
        busy={isAddingSubject}
        onAddEquipment={handleAddEquipment}
        onAddPerson={handleAddPerson}
      />

      {subjects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-6 text-center">
          <p className="text-sm text-white/55">No subjects yet.</p>
          <p className="mt-1 text-xs text-white/35">
            Add the equipment and crew you&apos;re auditing to start their Pass /
            Fail checks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => {
            const profile = subject.person_id
              ? profileById.get(subject.person_id)
              : undefined;
            const display = describeSubject(subject, profile);

            return (
              <SubjectCard
                key={subject.id}
                subject={subject}
                displayName={display.name}
                subtitle={display.subtitle}
                auditId={auditId}
                configItems={configItems}
                subjectItems={itemsBySubject.get(subject.id) ?? []}
                itemsLoading={itemsLoading}
                removing={removingId === subject.id}
                saveItem={saveItem}
                removeItem={removeItem}
                uploadPhoto={uploadPhoto}
                deletePhoto={deletePhoto}
                getSignedUrl={getSignedUrl}
                onRemove={() => handleRemove(subject.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
