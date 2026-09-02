/**
 * ChecklistRow — presentational row for one field-audit checklist item.
 *
 * Renders the item label (or an editable label for ad-hoc items), an optional
 * `standard_ref` info chip, the tri-state control, and — when the result is
 * Fail — a required note plus an optional photo (required when the item config
 * sets `requires_photo_on_fail`). All persistence is owned by SubjectChecklist;
 * this component is stateful only for its own signed-URL photo preview.
 */

import { useEffect, useId, useRef, useState } from "react";
import {
  Info,
  Camera,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import ChecklistTriState from "./ChecklistTriState";
import EscalationControl from "./EscalationControl";
import type { FindingSubjectType, TriValue } from "../fieldAuditConstants";

type TriChoice = Exclude<TriValue, "">;

interface ChecklistRowProps {
  label: string;
  standardRef?: string | null;
  isAdHoc?: boolean;
  customLabel?: string;
  requiresPhoto?: boolean;

  value: TriValue;
  note: string;
  photoPath: string | null;
  pendingPhotoName: string | null;
  photoRetry: boolean;
  saving: boolean;
  error: string | null;

  /** Escalation context — the finding is escalatable once it has a saved id. */
  auditId: string;
  subjectType: FindingSubjectType;
  itemId: string | null;
  correctiveActionId: string | null;
  onEscalated: (correctiveActionId: string) => void;

  getSignedUrl: (path: string) => Promise<string | null>;

  onValueChange: (v: TriChoice) => void;
  onNoteChange: (s: string) => void;
  onNoteBlur: () => void;
  onPickPhoto: (file: File) => void;
  onRemovePhoto: () => void;
  onRetryPhoto: () => void;
  onCustomLabelChange?: (s: string) => void;
  onCustomLabelBlur?: () => void;
  onRemoveAdHoc?: () => void;
}

export default function ChecklistRow({
  label,
  standardRef,
  isAdHoc = false,
  customLabel = "",
  requiresPhoto = false,
  value,
  note,
  photoPath,
  pendingPhotoName,
  photoRetry,
  saving,
  error,
  auditId,
  subjectType,
  itemId,
  correctiveActionId,
  onEscalated,
  getSignedUrl,
  onValueChange,
  onNoteChange,
  onNoteBlur,
  onPickPhoto,
  onRemovePhoto,
  onRetryPhoto,
  onCustomLabelChange,
  onCustomLabelBlur,
  onRemoveAdHoc,
}: ChecklistRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Resolve a signed URL for the stored photo (private bucket).
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      if (!photoPath) {
        if (!cancelled) setPreviewUrl(null);
        return;
      }
      const url = await getSignedUrl(photoPath);
      if (!cancelled) setPreviewUrl(url);
    };
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [photoPath, getSignedUrl]);

  const isFail = value === "F";
  const noteMissing = isFail && !note.trim();
  const hasPhoto = Boolean(photoPath || pendingPhotoName);
  const photoMissing = isFail && requiresPhoto && !hasPhoto;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onPickPhoto(file);
    // reset so the same file can be re-picked after removal
    e.target.value = "";
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.015] px-3.5 py-3">
      {/* Phones: label above a full-width P/F/NA row so the text never wraps
          one word per line beside the buttons. sm+: label left, buttons right. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          {isAdHoc ? (
            <input
              type="text"
              value={customLabel}
              onChange={(e) => onCustomLabelChange?.(e.target.value)}
              onBlur={() => onCustomLabelBlur?.()}
              placeholder="Custom item label"
              aria-label="Custom item label"
              className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus:border-rose-400/40"
            />
          ) : (
            <p id={labelId} className="text-sm text-white/90 leading-snug">
              {label}
            </p>
          )}
          {standardRef && (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-md bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-white/45"
              title={standardRef}
            >
              <Info className="w-3 h-3" aria-hidden />
              {standardRef}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saving && (
            <Loader2 className="w-3.5 h-3.5 text-white/40 animate-spin" aria-hidden />
          )}
          <ChecklistTriState
            value={value}
            onChange={onValueChange}
            ariaLabel={isAdHoc ? customLabel || "Custom item" : label}
            className="flex-1 sm:flex-none"
          />
          {isAdHoc && onRemoveAdHoc && (
            <button
              type="button"
              onClick={onRemoveAdHoc}
              aria-label="Remove custom item"
              className="rounded-lg p-1.5 text-white/40 hover:text-rose-300 hover:bg-rose-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Fail → required note + optional/required photo */}
      {isFail && (
        <div className="mt-3 space-y-2.5 pl-0.5">
          <div>
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              onBlur={onNoteBlur}
              rows={2}
              placeholder="What's the finding? (required for a Fail)"
              aria-label="Finding note"
              aria-invalid={noteMissing}
              className={[
                "w-full rounded-lg bg-white/[0.03] border px-2.5 py-2 text-sm text-white placeholder-white/30 resize-y",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50",
                noteMissing ? "border-rose-400/50" : "border-white/10 focus:border-rose-400/40",
              ].join(" ")}
            />
            {noteMissing && (
              <p className="mt-1 text-[11px] text-rose-300" role="alert">
                A note is required on a Fail.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />
            {previewUrl ? (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="block w-12 h-12 rounded-lg overflow-hidden border border-white/10"
              >
                <img
                  src={previewUrl}
                  alt="Finding photo"
                  className="w-full h-full object-cover"
                />
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
            >
              <Camera className="w-3.5 h-3.5" aria-hidden />
              {hasPhoto ? "Replace photo" : "Add photo"}
            </button>

            {hasPhoto && (
              <button
                type="button"
                onClick={onRemovePhoto}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-white/50 hover:text-rose-300 hover:bg-rose-500/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
                Remove
              </button>
            )}

            {photoRetry && (
              <button
                type="button"
                onClick={onRetryPhoto}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-2.5 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                Retry upload
              </button>
            )}

            {pendingPhotoName && !photoRetry && (
              <span className="text-[11px] text-white/40 truncate max-w-[10rem]">
                {pendingPhotoName}
              </span>
            )}
          </div>

          {photoMissing && (
            <p className="text-[11px] text-amber-300/90" role="alert">
              A photo is required for this finding.
            </p>
          )}
          {photoRetry && (
            <p className="flex items-center gap-1.5 text-[11px] text-amber-300/90" role="alert">
              <AlertTriangle className="w-3 h-3" aria-hidden />
              Photo upload failed — the finding is saved; retry the photo before submitting.
            </p>
          )}

          {/* Escalation — only once the finding is saved (has an id). */}
          {itemId && (
            <EscalationControl
              auditId={auditId}
              itemId={itemId}
              subjectType={subjectType}
              correctiveActionId={correctiveActionId}
              disabledReason={
                noteMissing
                  ? "Add the required note to escalate."
                  : photoMissing
                    ? "Add the required photo to escalate."
                    : null
              }
              onEscalated={onEscalated}
            />
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-[11px] text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
