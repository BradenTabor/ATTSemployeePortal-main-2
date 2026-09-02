/**
 * SubjectTimelineModal — one subject's interleaved history (Chunk 6).
 *
 * The "Chad's hard hat history" view, opened from a subject row in the audit
 * detail modal. Mirrors JsaDetailModal's portal + overlay pattern (createPortal
 * to document.body, useModalOverlay focus-trap) but renders at a higher z-index
 * so it stacks above the detail modal it was opened from. Reads
 * useFieldSubjectTimeline (findings + field_notes, newest-first) and resolves
 * checklist labels + work-site names via the app-wide cached config hooks.
 */

import { useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ImageIcon,
  Loader2,
  ShieldCheck,
  StickyNote,
  User,
  Wrench,
  X,
} from "lucide-react";
import { useModalOverlay } from "../../../hooks/useModalOverlay";
import { glass } from "../../../lib/glass";
import {
  useAuditChecklistItems,
  useFieldSubjectTimeline,
} from "../../../hooks/fieldAudit";
import { useWorkSitesQuery } from "../../../hooks/queries/useWorkSites";
import {
  FIELD_NOTE_KINDS,
  type TimelineSubjectIdentity,
} from "../fieldAuditConstants";

interface SubjectTimelineModalProps {
  identity: TimelineSubjectIdentity;
  displayName: string;
  subtitle: string;
  onClose: () => void;
}

const NOTE_KIND_LABEL = new Map(FIELD_NOTE_KINDS.map((k) => [k.value, k.label]));

function formatAuditDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SubjectTimelineModal({
  identity,
  displayName,
  subtitle,
  onClose,
}: SubjectTimelineModalProps) {
  const prefersReducedMotion = useReducedMotion();
  // Nested above the detail modal (which uses the default 100).
  const { modalRef, zIndex } = useModalOverlay({ isOpen: true, onClose, zIndex: 110 });

  const { data: timeline, isLoading, isError } = useFieldSubjectTimeline(identity);
  const { data: configItems = [] } = useAuditChecklistItems();
  const { data: workSites = [] } = useWorkSitesQuery();

  const labelById = useMemo(
    () => new Map(configItems.map((c) => [c.id, c.label])),
    [configItems],
  );
  const siteNameById = useMemo(
    () => new Map(workSites.map((s) => [s.id, s.name])),
    [workSites],
  );

  const SubjectIcon = identity.subjectType === "person" ? User : Wrench;
  const entries = timeline?.entries ?? [];

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 flex items-end sm:items-center justify-center"
      style={{ zIndex }}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fa-timeline-title"
        data-testid="field-audit-subject-timeline"
        initial={{
          opacity: 0,
          y: prefersReducedMotion ? 0 : 24,
          scale: prefersReducedMotion ? 1 : 0.97,
        }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.2 }
            : { type: "spring", damping: 28, stiffness: 300 }
        }
        className={`relative z-10 w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-leaf-sm overflow-hidden mx-0 sm:mx-4 ${glass.elevated}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-gray-800 border-b border-white/[0.06] px-5 sm:px-6 py-4">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <SubjectIcon className="w-4 h-4 text-rose-300" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 id="fa-timeline-title" className="text-lg sm:text-xl font-bold text-white truncate">
                  {displayName}
                </h2>
                <p className="text-xs text-white/40 truncate">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 shrink-0"
              aria-label="Close timeline"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {timeline && (
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-200">
                {timeline.findingCount} finding{timeline.findingCount === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-semibold text-white/70">
                {timeline.noteCount} note{timeline.noteCount === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-semibold text-white/70">
                {timeline.auditCount} audit{timeline.auditCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable timeline */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Loading history…
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-200">
              Could not load this subject&apos;s history.
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-400/70" aria-hidden />
              <p className="text-sm text-white/70">No findings or notes yet.</p>
              <p className="text-xs text-white/40 max-w-xs">
                This subject has a clean record — failed checklist items and field
                notes will appear here as they&apos;re logged.
              </p>
            </div>
          ) : (
            <ol className="relative space-y-3 border-l border-white/[0.08] pl-4">
              {entries.map((entry) =>
                entry.kind === "finding" ? (
                  <li key={`finding-${entry.id}`} className="relative" data-testid="field-audit-timeline-finding">
                    <span className="absolute -left-[1.30rem] top-3 w-2.5 h-2.5 rounded-full bg-rose-400 ring-4 ring-gray-800" aria-hidden />
                    <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" aria-hidden />
                          <span className="text-sm font-semibold text-white">
                            {entry.checklistItemId
                              ? labelById.get(entry.checklistItemId) ?? "Checklist item"
                              : entry.customLabel || "Ad-hoc finding"}
                          </span>
                        </div>
                        <span className="text-[11px] text-white/45 shrink-0">
                          {formatAuditDate(entry.auditDate)}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/40">
                        {entry.workSiteId
                          ? siteNameById.get(entry.workSiteId) ?? "Work site"
                          : entry.locationText || "Location not recorded"}
                      </p>
                      {entry.note && (
                        <p className="mt-2 text-sm text-white/80 whitespace-pre-wrap leading-snug">
                          {entry.note}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] uppercase text-rose-200 font-mono font-medium tracking-[0.14em]">
                          Fail
                        </span>
                        {entry.escalated && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase text-amber-200 font-mono font-medium tracking-[0.14em]">
                            Escalated
                          </span>
                        )}
                        {entry.photoPath && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/60">
                            <ImageIcon className="w-3 h-3" aria-hidden />
                            Photo
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ) : (
                  <li key={`note-${entry.id}`} className="relative" data-testid="field-audit-timeline-note">
                    <span className="absolute -left-[1.30rem] top-3 w-2.5 h-2.5 rounded-full bg-white/40 ring-4 ring-gray-800" aria-hidden />
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <StickyNote className="w-4 h-4 text-rose-300/70 shrink-0" aria-hidden />
                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase text-white/70 font-mono font-medium tracking-[0.14em]">
                            {NOTE_KIND_LABEL.get(entry.noteKind) ?? "Note"}
                          </span>
                          {entry.itemTag && (
                            <span className="text-[11px] text-rose-200/70 truncate">
                              {entry.itemTag}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-white/45 shrink-0">
                          {formatTimestamp(entry.sortAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-white/80 whitespace-pre-wrap leading-snug">
                        {entry.body}
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
        </div>
      </motion.div>
    </motion.div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
