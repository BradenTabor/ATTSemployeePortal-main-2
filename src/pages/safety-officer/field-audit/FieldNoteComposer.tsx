/**
 * FieldNoteComposer — append a field note for a resolved subject (Chunk 5).
 *
 * The shared write form behind both quick-note entry points: a `note_kind` chip
 * selector, an optional free-text `item_tag` (emphasized for the issuance kinds),
 * and the note body. The subject identity (person or equipment) is supplied by
 * the caller — the per-subject card knows it; the standalone panel resolves it
 * from a picker. On save the note is appended via the author/supervisor INSERT
 * policy and the subject's RecentNotesStrip refreshes.
 */

import { useState } from "react";
import { StickyNote, Loader2, Check, X } from "lucide-react";
import { useCreateFieldNote } from "../../../hooks/fieldAudit";
import { VoiceInputButton } from "../../../components/forms/VoiceInputButton";
import { formToast } from "../../../lib/formToast";
import {
  FIELD_NOTE_KINDS,
  FIELD_NOTE_ISSUANCE_KINDS,
  type FieldNote,
  type FieldNoteKind,
} from "../fieldAuditConstants";

interface FieldNoteComposerProps {
  subjectType: "person" | "equipment";
  personId: string | null;
  equipmentType: string | null;
  equipmentNumber: string | null;
  isCustomEquipment?: boolean;
  /** Set when composing inside an audit session; null for standalone notes. */
  fieldAuditId?: string | null;
  /** Caller gate (e.g. standalone picker not yet resolved) — also checked here. */
  subjectReady?: boolean;
  autoFocus?: boolean;
  onSaved?: (note: FieldNote) => void;
  onCancel?: () => void;
}

export default function FieldNoteComposer({
  subjectType,
  personId,
  equipmentType,
  equipmentNumber,
  isCustomEquipment,
  fieldAuditId = null,
  subjectReady = true,
  autoFocus = false,
  onSaved,
  onCancel,
}: FieldNoteComposerProps) {
  const { createNote, isSaving } = useCreateFieldNote();
  const [noteKind, setNoteKind] = useState<FieldNoteKind>("general");
  const [itemTag, setItemTag] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const identityReady =
    subjectType === "person"
      ? Boolean(personId)
      : Boolean(equipmentType && equipmentNumber);
  const ready = subjectReady && identityReady;
  // PPE / equipment issuance notes must name the item — that's what powers the
  // issuance tracking + repeat-issuance flagging the item_tag column exists for.
  // item_tag stays optional for every other note kind.
  const tagRequired = FIELD_NOTE_ISSUANCE_KINDS.has(noteKind);
  const tagSatisfied = !tagRequired || itemTag.trim().length > 0;
  const canSave = ready && body.trim().length > 0 && tagSatisfied && !isSaving;

  const handleSave = async () => {
    setError(null);
    if (!ready) {
      setError("Choose who or what this note is about.");
      return;
    }
    if (!body.trim()) {
      setError("Enter a note before saving.");
      return;
    }
    if (tagRequired && !itemTag.trim()) {
      setError("Name the item that was issued (e.g. hard hat).");
      return;
    }
    formToast.submitting("Saving note…");
    try {
      const note = await createNote({
        subjectType,
        personId,
        equipmentType,
        equipmentNumber,
        isCustomEquipment,
        noteKind,
        itemTag: itemTag.trim() || null,
        body,
        fieldAuditId,
      });
      formToast.success("Note saved", "Added to this subject's field notes.", {
        autoDismiss: 2200,
      });
      setBody("");
      setItemTag("");
      setNoteKind("general");
      onSaved?.(note);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save the note.";
      setError(msg);
      formToast.error("Could not save note", msg);
    }
  };

  return (
    <div
      className="rounded-xl border border-rose-500/20 bg-rose-950/[0.15] p-3 space-y-3"
      data-testid="field-audit-note-composer"
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-200/80">
        <StickyNote className="w-3.5 h-3.5" aria-hidden />
        New note
      </div>

      {/* note_kind chips */}
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="Note type"
      >
        {FIELD_NOTE_KINDS.map((k) => {
          const active = k.value === noteKind;
          return (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setNoteKind(k.value)}
              data-testid={`field-audit-note-kind-${k.value}`}
              className={[
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50",
                active
                  ? "border-rose-400/40 bg-rose-500/20 text-rose-100"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white/80 hover:bg-white/[0.06]",
              ].join(" ")}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      {/* optional item_tag */}
      <div>
        <label
          className="block text-[11px] text-white/50 mb-1"
          htmlFor="field-note-item-tag"
        >
          Item tag{" "}
          <span className="text-white/30">
            {tagRequired ? "(required — e.g. hard hat, chaps)" : "(optional)"}
          </span>
        </label>
        <input
          id="field-note-item-tag"
          type="text"
          value={itemTag}
          onChange={(e) => setItemTag(e.target.value)}
          placeholder={tagRequired ? "What was issued?" : "Optional tag"}
          data-testid="field-audit-note-item-tag"
          className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus:border-rose-400/40"
        />
      </div>

      {/* body */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] text-white/50" htmlFor="field-note-body">
            Note
          </label>
          <VoiceInputButton
            onTranscript={(text) => setBody(text)}
            currentValue={body}
            appendMode
            size="sm"
          />
        </div>
        <textarea
          id="field-note-body"
          autoFocus={autoFocus}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="What happened? (this becomes the note)"
          data-testid="field-audit-note-body"
          className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2 text-sm text-white placeholder-white/30 resize-y focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus:border-rose-400/40"
        />
      </div>

      {error && (
        <p className="text-[11px] text-rose-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          data-testid="field-audit-note-save"
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
        >
          {isSaving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="w-3.5 h-3.5" aria-hidden />
          )}
          Save note
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            data-testid="field-audit-note-cancel"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <X className="w-3.5 h-3.5" aria-hidden />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
