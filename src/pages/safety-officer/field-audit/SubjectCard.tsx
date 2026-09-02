/**
 * SubjectCard — one audited person/equipment: rollup status dot, a read-only
 * recent-notes strip (the memory layer), and an expandable per-subject checklist.
 *
 * The status dot is computed read-time (no denormalized rollup column): red if any
 * Fail, amber if partially answered, green when complete, neutral when untouched.
 */

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Trash2,
  User,
  Wrench,
  Loader2,
  StickyNote,
} from "lucide-react";
import RecentNotesStrip from "./RecentNotesStrip";
import FieldNoteComposer from "./FieldNoteComposer";
import SubjectChecklist from "./SubjectChecklist";
import type { FieldNotesSubject, SaveItemInput } from "../../../hooks/fieldAudit";
import {
  checklistItemsForSubject,
  type AuditChecklistItem,
  type FieldAuditItem,
  type FieldAuditSubject,
} from "../fieldAuditConstants";

type DotStatus = "none" | "in_progress" | "pass" | "fail";

const DOT_CLASS: Record<DotStatus, string> = {
  none: "bg-white/20",
  in_progress: "bg-amber-400",
  pass: "bg-emerald-400",
  fail: "bg-rose-400",
};

const DOT_LABEL: Record<DotStatus, string> = {
  none: "Not started",
  in_progress: "In progress",
  pass: "All pass",
  fail: "Has findings",
};

interface SubjectCardProps {
  subject: FieldAuditSubject;
  displayName: string;
  subtitle: string;
  auditId: string;
  configItems: AuditChecklistItem[];
  subjectItems: FieldAuditItem[];
  itemsLoading: boolean;
  removing: boolean;
  saveItem: (input: SaveItemInput) => Promise<FieldAuditItem>;
  removeItem: (id: string) => Promise<void>;
  uploadPhoto: (file: File, auditId: string) => Promise<string>;
  deletePhoto: (path: string) => Promise<void>;
  getSignedUrl: (path: string) => Promise<string | null>;
  onRemove: () => void;
}

export default function SubjectCard({
  subject,
  displayName,
  subtitle,
  auditId,
  configItems,
  subjectItems,
  itemsLoading,
  removing,
  saveItem,
  removeItem,
  uploadPhoto,
  deletePhoto,
  getSignedUrl,
  onRemove,
}: SubjectCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);

  const status: DotStatus = useMemo(() => {
    if (subjectItems.some((i) => i.result === "fail")) return "fail";
    if (subjectItems.length === 0) return "none";
    const seededCount = checklistItemsForSubject(configItems, subject).length;
    const adHocCount = subjectItems.filter((i) => i.custom_label != null).length;
    const total = seededCount + adHocCount;
    return subjectItems.length < total ? "in_progress" : "pass";
  }, [subjectItems, configItems, subject]);

  const notesSubject: FieldNotesSubject = {
    subject_type: subject.subject_type,
    person_id: subject.person_id,
    equipment_type: subject.equipment_type,
    equipment_number: subject.equipment_number,
  };

  const Icon = subject.subject_type === "person" ? User : Wrench;

  return (
    <div className="rounded-xl border border-rose-500/15 bg-gradient-to-br from-rose-950/20 to-[#121A15] shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-3.5">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_CLASS[status]}`}
          title={DOT_LABEL[status]}
          aria-label={DOT_LABEL[status]}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 rounded-lg"
          aria-expanded={expanded}
        >
          <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-rose-200/80" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white truncate">
              {displayName}
            </span>
            <span className="block text-[11px] text-white/45 truncate">
              {subtitle}
            </span>
          </span>
          <ChevronDown
            className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setExpanded(true);
            setNoteOpen((v) => !v);
          }}
          aria-label="Add note"
          aria-expanded={noteOpen}
          data-testid="field-audit-subject-note-btn"
          className={`rounded-lg p-1.5 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 ${
            noteOpen
              ? "text-rose-300 bg-rose-500/10"
              : "text-white/40 hover:text-rose-300 hover:bg-rose-500/10"
          }`}
        >
          <StickyNote className="w-4 h-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label="Remove subject"
          data-testid="field-audit-remove-subject"
          className="rounded-lg p-1.5 text-white/40 hover:text-rose-300 hover:bg-rose-500/10 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 shrink-0"
        >
          {removing ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="w-4 h-4" aria-hidden />
          )}
        </button>
      </div>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3">
          {/* Quick-note composer (per-subject entry point) */}
          {noteOpen && (
            <FieldNoteComposer
              subjectType={subject.subject_type}
              personId={subject.person_id}
              equipmentType={subject.equipment_type}
              equipmentNumber={subject.equipment_number}
              isCustomEquipment={subject.is_custom_equipment}
              fieldAuditId={auditId}
              autoFocus
              onSaved={() => setNoteOpen(false)}
              onCancel={() => setNoteOpen(false)}
            />
          )}

          {/* Read-only recent notes (memory layer) */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-2.5">
            <p className="px-1 pb-1.5 text-[10px] uppercase text-rose-200/50 font-mono font-medium tracking-[0.14em]">
              Recent notes
            </p>
            <RecentNotesStrip subject={notesSubject} />
          </div>

          <SubjectChecklist
            auditId={auditId}
            scope={{ kind: "subject", subject }}
            configItems={configItems}
            subjectItems={subjectItems}
            itemsLoading={itemsLoading}
            saveItem={saveItem}
            removeItem={removeItem}
            uploadPhoto={uploadPhoto}
            deletePhoto={deletePhoto}
            getSignedUrl={getSignedUrl}
          />
        </div>
      )}
    </div>
  );
}
