/**
 * StandaloneFieldNotes — quick field notes with no audit session (Chunk 5).
 *
 * The "log a note about anyone/anything, anytime" entry point. It reuses the
 * audit subject picker to resolve a person (app_users id) or a piece of
 * equipment (type + unit — required here because the field_notes CHECK demands
 * a unit number), then drops the shared FieldNoteComposer with fieldAuditId=null
 * so the note is persistent but not tied to an audit. The same RecentNotesStrip
 * renders below so a freshly written note shows up immediately.
 */

import { useMemo, useState } from "react";
import { StickyNote, ChevronDown, User, Wrench, RotateCcw } from "lucide-react";
import AddSubjectPanel, { type AddEquipmentInput } from "./AddSubjectPanel";
import FieldNoteComposer from "./FieldNoteComposer";
import RecentNotesStrip from "./RecentNotesStrip";
import { useCrewMembers } from "../../../hooks/jobs/useCrewMembers";
import type { FieldNotesSubject } from "../../../hooks/fieldAudit";
import {
  equipmentTypeLabel,
  normalizeEquipmentNumber,
} from "../fieldAuditConstants";

interface SelectedSubject {
  subjectType: "person" | "equipment";
  personId: string | null;
  equipmentType: string | null;
  equipmentNumber: string | null;
  isCustom: boolean;
  displayName: string;
  subtitle: string;
}

const EMPTY_IDS: Set<string> = new Set();

export default function StandaloneFieldNotes() {
  const { crewMembers } = useCrewMembers();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedSubject | null>(null);

  const profileById = useMemo(
    () => new Map(crewMembers.map((p) => [p.id, p])),
    [crewMembers],
  );

  const handlePickPerson = (personId: string) => {
    const profile = profileById.get(personId);
    setSelected({
      subjectType: "person",
      personId,
      equipmentType: null,
      equipmentNumber: null,
      isCustom: false,
      displayName: profile?.full_name || profile?.email || "Crew member",
      subtitle: profile?.role || "Person",
    });
  };

  const handlePickEquipment = (input: AddEquipmentInput) => {
    const number = input.equipmentNumber
      ? normalizeEquipmentNumber(input.equipmentNumber)
      : "";
    setSelected({
      subjectType: "equipment",
      personId: null,
      equipmentType: input.equipmentType,
      equipmentNumber: number,
      isCustom: input.isCustom,
      displayName:
        equipmentTypeLabel(input.equipmentType) + (number ? ` · ${number}` : ""),
      subtitle: input.isCustom ? "Custom equipment" : "Equipment",
    });
  };

  const notesSubject: FieldNotesSubject | null = selected
    ? {
        subject_type: selected.subjectType,
        person_id: selected.personId,
        equipment_type: selected.equipmentType,
        equipment_number: selected.equipmentNumber,
      }
    : null;

  const SubjectIcon = selected?.subjectType === "person" ? User : Wrench;

  return (
    <section
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden"
      data-testid="field-audit-standalone-notes"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="field-audit-standalone-notes-toggle"
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
      >
        <span className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0">
          <StickyNote className="w-5 h-5 text-rose-300" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">
            Field notes
          </span>
          <span className="block text-xs text-white/50">
            Log a quick note about a person or equipment — no audit needed.
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3.5">
          {!selected ? (
            <>
              <p className="text-xs text-white/45">
                Who or what is this note about?
              </p>
              <AddSubjectPanel
                crewMembers={crewMembers}
                crewRosterIds={EMPTY_IDS}
                existingPersonIds={EMPTY_IDS}
                requireEquipmentNumber
                equipmentCtaLabel="Add note for equipment"
                onAddEquipment={handlePickEquipment}
                onAddPerson={handlePickPerson}
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-rose-500/15 bg-rose-950/20 px-3 py-2.5">
                <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                  <SubjectIcon className="w-4 h-4 text-rose-200/80" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white truncate">
                    {selected.displayName}
                  </span>
                  <span className="block text-[11px] text-white/45 truncate">
                    {selected.subtitle}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  data-testid="field-audit-standalone-change-subject"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                  Change
                </button>
              </div>

              <FieldNoteComposer
                key={`${selected.subjectType}:${selected.personId ?? ""}:${selected.equipmentType ?? ""}:${selected.equipmentNumber ?? ""}`}
                subjectType={selected.subjectType}
                personId={selected.personId}
                equipmentType={selected.equipmentType}
                equipmentNumber={selected.equipmentNumber}
                isCustomEquipment={selected.isCustom}
                fieldAuditId={null}
                autoFocus
              />

              {notesSubject && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-2.5">
                  <p className="px-1 pb-1.5 text-[10px] uppercase tracking-widest text-rose-200/50">
                    Recent notes
                  </p>
                  <RecentNotesStrip subject={notesSubject} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
