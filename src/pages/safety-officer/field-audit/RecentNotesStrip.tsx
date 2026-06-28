/**
 * RecentNotesStrip — read-only strip of a subject's most recent field notes.
 *
 * The "memory layer": shows up to 3 recent `field_notes` for this person/equipment
 * with relative dates, so the auditor has prior context on the card. Writing notes
 * is Chunk 5 — this only displays existing notes.
 */

import { StickyNote, Loader2 } from "lucide-react";
import {
  useFieldNotesForSubject,
  type FieldNotesSubject,
} from "../../../hooks/fieldAudit";
import { relativeDate } from "../fieldAuditConstants";

interface RecentNotesStripProps {
  subject: FieldNotesSubject;
}

export default function RecentNotesStrip({ subject }: RecentNotesStripProps) {
  const { data: notes, isLoading } = useFieldNotesForSubject(subject);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-white/40">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        Loading notes…
      </div>
    );
  }

  if (!notes || notes.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-white/30">
        <StickyNote className="w-3.5 h-3.5" aria-hidden />
        No prior notes for this subject.
      </div>
    );
  }

  return (
    <ul className="space-y-1.5" aria-label="Recent notes">
      {notes.map((note) => (
        <li
          key={note.id}
          className="flex items-start gap-2 rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2"
        >
          <StickyNote
            className="w-3.5 h-3.5 text-rose-300/70 shrink-0 mt-0.5"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/80 leading-snug">{note.note}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/35">
              {relativeDate(note.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
