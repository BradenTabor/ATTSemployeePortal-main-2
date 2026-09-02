/**
 * SubjectChecklist — scoped Pass/Fail/NA checklist with live upsert (Chunk 3).
 *
 * Renders against a `ChecklistScope`: one subject (seeded items by subject_scope
 * + equipment_types containment) or the audit itself (site-scoped items, stored
 * with a NULL subject id), plus any ad-hoc "+ Add item" rows. Each change
 * upserts live to the server (D1): the result persists immediately, the note
 * autosaves after a typing pause (and on blur), and a photo uploads at save
 * time. A failed photo upload
 * never blocks recording the finding — the row saves without the photo and is
 * flagged for retry (DVIR/Equipment in-memory-photo pattern; not draft-persisted).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import ChecklistRow from "./ChecklistRow";
import { validators } from "../../../lib/formValidation";
import {
  RESULT_TO_TRI,
  TRI_TO_RESULT,
  checklistItemsForSite,
  checklistItemsForSubject,
  type AuditChecklistItem,
  type ChecklistScope,
  type FieldAuditItem,
  type FindingSubjectType,
  type TriValue,
} from "../fieldAuditConstants";
import type { SaveItemInput } from "../../../hooks/fieldAudit";

/** Idle delay before a finding note is persisted while the field still has focus. */
const NOTE_AUTOSAVE_MS = 600;

interface RowDraft {
  value: TriValue;
  note: string;
  customLabel: string;
  itemId: string | null;
  photoPath: string | null;
  pendingPhoto: File | null;
  photoRetry: boolean;
  saving: boolean;
  error: string | null;
  correctiveActionId: string | null;
}

function emptyDraft(): RowDraft {
  return {
    value: "",
    note: "",
    customLabel: "",
    itemId: null,
    photoPath: null,
    pendingPhoto: null,
    photoRetry: false,
    saving: false,
    error: null,
    correctiveActionId: null,
  };
}

function draftFromItem(it: FieldAuditItem): RowDraft {
  return {
    value: RESULT_TO_TRI[it.result],
    note: it.note ?? "",
    customLabel: it.custom_label ?? "",
    itemId: it.id,
    photoPath: it.photo_path,
    pendingPhoto: null,
    photoRetry: false,
    saving: false,
    error: null,
    correctiveActionId: it.corrective_action_id,
  };
}

interface SubjectChecklistProps {
  auditId: string;
  scope: ChecklistScope;
  configItems: AuditChecklistItem[];
  /** Items already bound to this scope (subject rows, or NULL-subject site rows). */
  subjectItems: FieldAuditItem[];
  itemsLoading: boolean;
  saveItem: (input: SaveItemInput) => Promise<FieldAuditItem>;
  removeItem: (id: string) => Promise<void>;
  uploadPhoto: (file: File, auditId: string) => Promise<string>;
  deletePhoto: (path: string) => Promise<void>;
  getSignedUrl: (path: string) => Promise<string | null>;
}

export default function SubjectChecklist({
  auditId,
  scope,
  configItems,
  subjectItems,
  itemsLoading,
  saveItem,
  removeItem,
  uploadPhoto,
  deletePhoto,
  getSignedUrl,
}: SubjectChecklistProps) {
  const subject = scope.kind === "subject" ? scope.subject : null;
  const subjectId = subject?.id ?? null;
  const findingSubjectType: FindingSubjectType = subject?.subject_type ?? "site";

  const seededItems = useMemo(
    () =>
      subject
        ? checklistItemsForSubject(configItems, subject)
        : checklistItemsForSite(configItems),
    [configItems, subject],
  );

  const [rows, setRows] = useState<Record<string, RowDraft>>({});
  const [adHocKeys, setAdHocKeys] = useState<string[]>([]);
  // Mirror of `rows` for synchronous back-to-back edits. Every setRows() call
  // below updates this ref in lockstep, so it never needs syncing during render.
  const rowsRef = useRef<Record<string, RowDraft>>({});
  // Per-row save chain: a fast result→note sequence fires two persistDraft calls
  // before the first INSERT returns an id. Serialized per key, the second call
  // waits and re-reads the freshly-saved id, so it UPDATEs instead of racing a
  // second INSERT (which trips uq_fa_items_subject_item and drops the later edit).
  // Different rows keep their own chains, so they still save concurrently.
  const saveChainRef = useRef<Record<string, Promise<void>>>({});

  // Hydrate once from existing items (covers resume mid-checklist).
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || itemsLoading) return;
    hydratedRef.current = true;
    const next: Record<string, RowDraft> = {};
    const adhoc: string[] = [];
    for (const it of subjectItems) {
      if (it.checklist_item_id) {
        next[`seed:${it.checklist_item_id}`] = draftFromItem(it);
      } else {
        const key = `adhoc:${it.id}`;
        next[key] = draftFromItem(it);
        adhoc.push(key);
      }
    }
    rowsRef.current = next;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from server-loaded items (resume mid-checklist); guarded by hydratedRef + itemsLoading.
    setRows(next);
    setAdHocKeys(adhoc);
  }, [itemsLoading, subjectItems]);

  /** Merge a patch into a row, keeping rowsRef in sync for back-to-back edits. */
  const mergeRow = useCallback(
    (key: string, patch: Partial<RowDraft>): RowDraft => {
      const current = rowsRef.current[key] ?? emptyDraft();
      const merged = { ...current, ...patch };
      rowsRef.current = { ...rowsRef.current, [key]: merged };
      setRows(rowsRef.current);
      return merged;
    },
    [],
  );

  const persistDraft = useCallback(
    (key: string, checklistItemId: string | null): Promise<void> => {
      const run = async () => {
        // Re-read at run time so a save queued behind another picks up the id
        // the first one just wrote (INSERT → UPDATE) plus the latest note/photo.
        const draft = rowsRef.current[key];
        if (!draft || draft.value === "") return;
        const isAdHoc = checklistItemId === null;
        if (isAdHoc && !draft.customLabel.trim()) {
          mergeRow(key, { error: "Enter a label for this item." });
          return;
        }

        mergeRow(key, { saving: true, error: null });

        // Upload the pending photo first; a failure flags retry but never blocks save.
        let photoPath = draft.photoPath;
        let photoRetry = false;
        if (draft.pendingPhoto) {
          try {
            photoPath = await uploadPhoto(draft.pendingPhoto, auditId);
          } catch {
            photoRetry = true;
          }
        }

        try {
          const saved = await saveItem({
            subjectId,
            checklistItemId,
            customLabel: isAdHoc ? draft.customLabel.trim() : null,
            result: TRI_TO_RESULT[draft.value as Exclude<TriValue, "">],
            note: draft.note.trim() || null,
            photoPath: photoPath ?? null,
            existingItemId: draft.itemId,
          });
          // A photo picked while this save was in flight is still pending and
          // belongs to the chained save — only clear the one we just uploaded.
          const latest = rowsRef.current[key];
          const uploadedThis =
            draft.pendingPhoto !== null && latest?.pendingPhoto === draft.pendingPhoto;
          mergeRow(key, {
            itemId: saved.id,
            photoPath: saved.photo_path,
            pendingPhoto: uploadedThis
              ? photoRetry
                ? draft.pendingPhoto
                : null
              : (latest?.pendingPhoto ?? null),
            photoRetry: uploadedThis ? photoRetry : (latest?.photoRetry ?? false),
            saving: false,
            error: null,
          });
        } catch (e) {
          mergeRow(key, {
            saving: false,
            error: e instanceof Error ? e.message : "Could not save this item.",
          });
        }
      };

      // Chain after any in-flight save for this row (run on settle, success or not).
      const next = (saveChainRef.current[key] ?? Promise.resolve()).then(
        run,
        run,
      );
      saveChainRef.current[key] = next;
      return next;
    },
    [auditId, mergeRow, saveItem, subjectId, uploadPhoto],
  );

  // ── Row handlers ──────────────────────────────────────────────────────────
  const handleValue = useCallback(
    (key: string, checklistItemId: string | null, v: Exclude<TriValue, "">) => {
      mergeRow(key, { value: v, error: null });
      void persistDraft(key, checklistItemId);
    },
    [mergeRow, persistDraft],
  );

  // Notes autosave shortly after typing pauses (and flush on blur) so the
  // Review panel's readiness reflects the note without waiting for focus to
  // leave the field — on a phone the next tap is often "Submit".
  const noteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const timers = noteTimersRef.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  const handleNoteChange = useCallback(
    (key: string, checklistItemId: string | null, s: string) => {
      const merged = mergeRow(key, { note: s });
      clearTimeout(noteTimersRef.current[key]);
      if (merged.value === "") return;
      noteTimersRef.current[key] = setTimeout(() => {
        delete noteTimersRef.current[key];
        void persistDraft(key, checklistItemId);
      }, NOTE_AUTOSAVE_MS);
    },
    [mergeRow, persistDraft],
  );

  const handleNoteBlur = useCallback(
    (key: string, checklistItemId: string | null) => {
      clearTimeout(noteTimersRef.current[key]);
      delete noteTimersRef.current[key];
      const draft = rowsRef.current[key];
      if (draft && draft.value !== "") void persistDraft(key, checklistItemId);
    },
    [persistDraft],
  );

  const handleCustomLabelChange = useCallback(
    (key: string, s: string) => {
      mergeRow(key, { customLabel: s });
    },
    [mergeRow],
  );

  const handleCustomLabelBlur = useCallback(
    (key: string) => {
      const draft = rowsRef.current[key];
      if (draft && draft.value !== "" && draft.customLabel.trim()) {
        void persistDraft(key, null);
      }
    },
    [persistDraft],
  );

  const handlePickPhoto = useCallback(
    (key: string, checklistItemId: string | null, file: File) => {
      const validationError = validators.photoFile(file);
      if (validationError) {
        mergeRow(key, { error: validationError });
        return;
      }
      const merged = mergeRow(key, { pendingPhoto: file, photoRetry: false, error: null });
      if (merged.value !== "") void persistDraft(key, checklistItemId);
    },
    [mergeRow, persistDraft],
  );

  const handleRemovePhoto = useCallback(
    (key: string, checklistItemId: string | null) => {
      const current = rowsRef.current[key];
      if (current?.photoPath) {
        void deletePhoto(current.photoPath).catch(() => {
          /* best-effort; orphaned object is acceptable for v1 */
        });
      }
      const merged = mergeRow(key, {
        photoPath: null,
        pendingPhoto: null,
        photoRetry: false,
      });
      if (merged.value !== "") void persistDraft(key, checklistItemId);
    },
    [deletePhoto, mergeRow, persistDraft],
  );

  const handleRetryPhoto = useCallback(
    (key: string, checklistItemId: string | null) => {
      const draft = rowsRef.current[key];
      if (draft) void persistDraft(key, checklistItemId);
    },
    [persistDraft],
  );

  const handleAddAdHoc = useCallback(() => {
    const key = `adhoc:tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    mergeRow(key, emptyDraft());
    setAdHocKeys((prev) => [...prev, key]);
  }, [mergeRow]);

  const handleRemoveAdHoc = useCallback(
    (key: string) => {
      const current = rowsRef.current[key];
      if (current?.itemId) {
        void removeItem(current.itemId).catch(() => {
          /* surfaced via row error on next save attempt */
        });
      }
      const nextRows = { ...rowsRef.current };
      delete nextRows[key];
      rowsRef.current = nextRows;
      setRows(nextRows);
      setAdHocKeys((prev) => prev.filter((k) => k !== key));
    },
    [removeItem],
  );

  const answeredCount = useMemo(() => {
    return Object.values(rows).filter((r) => r.value !== "").length;
  }, [rows]);
  const totalCount = seededItems.length + adHocKeys.length;

  if (seededItems.length === 0 && adHocKeys.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] px-3.5 py-4 text-center">
        <p className="text-xs text-white/40">
          {subject
            ? "No standard checklist items for this subject. Use “+ Add item” to record a finding."
            : "No site checks are configured. Use “+ Add item” to record a site finding."}
        </p>
        <AddItemButton onClick={handleAddAdHoc} className="mt-3" />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase text-white/40 font-mono font-medium tracking-[0.14em]">
          Checklist
        </p>
        <span className="text-[11px] font-mono tabular-nums text-white/35">
          {answeredCount}/{totalCount}
        </span>
      </div>

      {seededItems.map((item) => {
        const key = `seed:${item.id}`;
        const draft = rows[key] ?? emptyDraft();
        return (
          <ChecklistRow
            key={key}
            label={item.label}
            standardRef={item.standard_ref}
            requiresPhoto={item.requires_photo_on_fail}
            value={draft.value}
            note={draft.note}
            photoPath={draft.photoPath}
            pendingPhotoName={draft.pendingPhoto?.name ?? null}
            photoRetry={draft.photoRetry}
            saving={draft.saving}
            error={draft.error}
            auditId={auditId}
            subjectType={findingSubjectType}
            itemId={draft.itemId}
            correctiveActionId={draft.correctiveActionId}
            onEscalated={(caId) => mergeRow(key, { correctiveActionId: caId })}
            getSignedUrl={getSignedUrl}
            onValueChange={(v) => handleValue(key, item.id, v)}
            onNoteChange={(s) => handleNoteChange(key, item.id, s)}
            onNoteBlur={() => handleNoteBlur(key, item.id)}
            onPickPhoto={(file) => handlePickPhoto(key, item.id, file)}
            onRemovePhoto={() => handleRemovePhoto(key, item.id)}
            onRetryPhoto={() => handleRetryPhoto(key, item.id)}
          />
        );
      })}

      {adHocKeys.map((key) => {
        const draft = rows[key] ?? emptyDraft();
        return (
          <ChecklistRow
            key={key}
            label=""
            isAdHoc
            customLabel={draft.customLabel}
            value={draft.value}
            note={draft.note}
            photoPath={draft.photoPath}
            pendingPhotoName={draft.pendingPhoto?.name ?? null}
            photoRetry={draft.photoRetry}
            saving={draft.saving}
            error={draft.error}
            auditId={auditId}
            subjectType={findingSubjectType}
            itemId={draft.itemId}
            correctiveActionId={draft.correctiveActionId}
            onEscalated={(caId) => mergeRow(key, { correctiveActionId: caId })}
            getSignedUrl={getSignedUrl}
            onValueChange={(v) => handleValue(key, null, v)}
            onNoteChange={(s) => handleNoteChange(key, null, s)}
            onNoteBlur={() => handleNoteBlur(key, null)}
            onPickPhoto={(file) => handlePickPhoto(key, null, file)}
            onRemovePhoto={() => handleRemovePhoto(key, null)}
            onRetryPhoto={() => handleRetryPhoto(key, null)}
            onCustomLabelChange={(s) => handleCustomLabelChange(key, s)}
            onCustomLabelBlur={() => handleCustomLabelBlur(key)}
            onRemoveAdHoc={() => handleRemoveAdHoc(key)}
          />
        );
      })}

      <AddItemButton onClick={handleAddAdHoc} />
    </div>
  );
}

function AddItemButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="field-audit-add-item"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:border-white/25 hover:bg-white/[0.04] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 ${className}`}
    >
      <Plus className="w-3.5 h-3.5" aria-hidden />
      Add item
    </button>
  );
}
