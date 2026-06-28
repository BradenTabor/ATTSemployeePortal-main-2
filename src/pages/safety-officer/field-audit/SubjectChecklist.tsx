/**
 * SubjectChecklist — per-subject Pass/Fail/NA checklist with live upsert (Chunk 3).
 *
 * Renders the seeded items applicable to this subject (by subject_scope +
 * equipment_types containment) plus any ad-hoc "+ Add item" rows. Each change
 * upserts live to the server (D1): the result persists immediately, the note
 * persists on blur, and a photo uploads at save time. A failed photo upload
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
  checklistItemsForSubject,
  type AuditChecklistItem,
  type FieldAuditItem,
  type FieldAuditSubject,
  type TriValue,
} from "../fieldAuditConstants";
import type { SaveItemInput } from "../../../hooks/fieldAudit";

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
  subject: FieldAuditSubject;
  configItems: AuditChecklistItem[];
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
  subject,
  configItems,
  subjectItems,
  itemsLoading,
  saveItem,
  removeItem,
  uploadPhoto,
  deletePhoto,
  getSignedUrl,
}: SubjectChecklistProps) {
  const seededItems = useMemo(
    () => checklistItemsForSubject(configItems, subject),
    [configItems, subject],
  );

  const [rows, setRows] = useState<Record<string, RowDraft>>({});
  const [adHocKeys, setAdHocKeys] = useState<string[]>([]);
  // Mirror of `rows` for synchronous back-to-back edits. Every setRows() call
  // below updates this ref in lockstep, so it never needs syncing during render.
  const rowsRef = useRef<Record<string, RowDraft>>({});

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
    async (key: string, checklistItemId: string | null, draft: RowDraft) => {
      if (draft.value === "") return;
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
          subjectId: subject.id,
          checklistItemId,
          customLabel: isAdHoc ? draft.customLabel.trim() : null,
          result: TRI_TO_RESULT[draft.value as Exclude<TriValue, "">],
          note: draft.note.trim() || null,
          photoPath: photoPath ?? null,
          existingItemId: draft.itemId,
        });
        mergeRow(key, {
          itemId: saved.id,
          photoPath: saved.photo_path,
          pendingPhoto: photoRetry ? draft.pendingPhoto : null,
          photoRetry,
          saving: false,
          error: null,
        });
      } catch (e) {
        mergeRow(key, {
          saving: false,
          error: e instanceof Error ? e.message : "Could not save this item.",
        });
      }
    },
    [auditId, mergeRow, saveItem, subject.id, uploadPhoto],
  );

  // ── Row handlers ──────────────────────────────────────────────────────────
  const handleValue = useCallback(
    (key: string, checklistItemId: string | null, v: Exclude<TriValue, "">) => {
      const merged = mergeRow(key, { value: v, error: null });
      void persistDraft(key, checklistItemId, merged);
    },
    [mergeRow, persistDraft],
  );

  const handleNoteChange = useCallback(
    (key: string, s: string) => {
      mergeRow(key, { note: s });
    },
    [mergeRow],
  );

  const handleNoteBlur = useCallback(
    (key: string, checklistItemId: string | null) => {
      const draft = rowsRef.current[key];
      if (draft && draft.value !== "") void persistDraft(key, checklistItemId, draft);
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
        void persistDraft(key, null, draft);
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
      if (merged.value !== "") void persistDraft(key, checklistItemId, merged);
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
      if (merged.value !== "") void persistDraft(key, checklistItemId, merged);
    },
    [deletePhoto, mergeRow, persistDraft],
  );

  const handleRetryPhoto = useCallback(
    (key: string, checklistItemId: string | null) => {
      const draft = rowsRef.current[key];
      if (draft) void persistDraft(key, checklistItemId, draft);
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
          No standard checklist items for this subject. Use “+ Add item” to record
          a finding.
        </p>
        <AddItemButton onClick={handleAddAdHoc} className="mt-3" />
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-white/40">
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
            subjectType={subject.subject_type}
            itemId={draft.itemId}
            correctiveActionId={draft.correctiveActionId}
            onEscalated={(caId) => mergeRow(key, { correctiveActionId: caId })}
            getSignedUrl={getSignedUrl}
            onValueChange={(v) => handleValue(key, item.id, v)}
            onNoteChange={(s) => handleNoteChange(key, s)}
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
            subjectType={subject.subject_type}
            itemId={draft.itemId}
            correctiveActionId={draft.correctiveActionId}
            onEscalated={(caId) => mergeRow(key, { correctiveActionId: caId })}
            getSignedUrl={getSignedUrl}
            onValueChange={(v) => handleValue(key, null, v)}
            onNoteChange={(s) => handleNoteChange(key, s)}
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
