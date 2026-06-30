/**
 * FieldAuditDetailModal — read-only detail for one audit (Chunk 6).
 *
 * Mirrors JsaDetailModal: portals to document.body, uses the shared
 * useModalOverlay (scroll-lock + focus-trap + Escape), and renders a sticky
 * header over scrollable content. Shows the audit's meta, each subject with its
 * checklist responses and a read-time pass/fail rollup, plus any audit-wide
 * (site-scoped) checks. Each subject can open the per-subject timeline
 * (SubjectTimelineModal) stacked above this one.
 */

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  History,
  ImageIcon,
  Loader2,
  MapPin,
  MinusCircle,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useModalOverlay } from "../../../hooks/useModalOverlay";
import { glass } from "../../../lib/glass";
import {
  useAuditChecklistItems,
  useFieldAuditDetail,
} from "../../../hooks/fieldAudit";
import { useCrewMembers } from "../../../hooks/jobs/useCrewMembers";
import { useCrews } from "../../../hooks/useCrews";
import { useWorkSitesQuery } from "../../../hooks/queries/useWorkSites";
import SubjectTimelineModal from "./SubjectTimelineModal";
import {
  equipmentTypeLabel,
  summarizeItems,
  type FieldAuditItem,
  type FieldAuditResult,
  type FieldAuditSubject,
  type RollupCounts,
  type TimelineSubjectIdentity,
} from "../fieldAuditConstants";

interface FieldAuditDetailModalProps {
  auditId: string;
  onClose: () => void;
}

interface TimelineTarget {
  identity: TimelineSubjectIdentity;
  displayName: string;
  subtitle: string;
}

const RESULT_CHIP: Record<FieldAuditResult, string> = {
  pass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  fail: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  na: "border-white/10 bg-white/[0.04] text-white/55",
};

const RESULT_LABEL: Record<FieldAuditResult, string> = {
  pass: "Pass",
  fail: "Fail",
  na: "N/A",
};

const RESULT_RANK: Record<FieldAuditResult, number> = { fail: 0, na: 1, pass: 2 };

function formatAuditDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RollupBadge({ rollup }: { rollup: RollupCounts }) {
  if (rollup.total === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
        No checks
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
      {rollup.fail > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-rose-200">
          <AlertTriangle className="w-3 h-3" aria-hidden />
          {rollup.fail} fail
          {rollup.openFail > 0 && (
            <span className="text-rose-300/80">· {rollup.openFail} open</span>
          )}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
          <CheckCircle2 className="w-3 h-3" aria-hidden />
          All pass
        </span>
      )}
      <span className="text-white/40">
        {rollup.pass}/{rollup.total}
      </span>
    </span>
  );
}

function ItemRow({ item, label }: { item: FieldAuditItem; label: string }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span
        className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${RESULT_CHIP[item.result]}`}
      >
        {RESULT_LABEL[item.result]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/85 leading-snug">{label}</p>
        {item.note && (
          <p className="mt-0.5 text-xs text-white/55 whitespace-pre-wrap leading-snug">
            {item.note}
          </p>
        )}
        {(item.photo_path || item.corrective_action_id) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {item.photo_path && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/55">
                <ImageIcon className="w-3 h-3" aria-hidden />
                Photo
              </span>
            )}
            {item.corrective_action_id && (
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                Escalated
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function FieldAuditDetailModal({
  auditId,
  onClose,
}: FieldAuditDetailModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const { modalRef, zIndex } = useModalOverlay({ isOpen: true, onClose, zIndex: 100 });
  const [timelineTarget, setTimelineTarget] = useState<TimelineTarget | null>(null);

  const { data: detail, isLoading, isError } = useFieldAuditDetail(auditId);
  const { data: configItems = [] } = useAuditChecklistItems();
  const { crewMembers } = useCrewMembers();
  const { crews } = useCrews();
  const { data: workSites = [] } = useWorkSitesQuery();

  const labelById = useMemo(
    () => new Map(configItems.map((c) => [c.id, c.label])),
    [configItems],
  );
  const profileById = useMemo(
    () => new Map(crewMembers.map((p) => [p.id, p])),
    [crewMembers],
  );
  const siteNameById = useMemo(
    () => new Map(workSites.map((s) => [s.id, s.name])),
    [workSites],
  );
  const crewNameById = useMemo(
    () => new Map(crews.map((c) => [c.id, c.name])),
    [crews],
  );

  const itemLabel = (item: FieldAuditItem): string =>
    item.checklist_item_id
      ? labelById.get(item.checklist_item_id) ?? "Checklist item"
      : item.custom_label || "Ad-hoc item";

  const sortItems = (items: FieldAuditItem[]): FieldAuditItem[] =>
    [...items].sort(
      (a, b) =>
        RESULT_RANK[a.result] - RESULT_RANK[b.result] ||
        itemLabel(a).localeCompare(itemLabel(b)),
    );

  const subjectDisplay = (subject: FieldAuditSubject): { name: string; subtitle: string } => {
    if (subject.subject_type === "person") {
      const profile = subject.person_id ? profileById.get(subject.person_id) : undefined;
      return {
        name: profile?.full_name || profile?.email || "Crew member",
        subtitle: profile?.role || "Person",
      };
    }
    return {
      name:
        equipmentTypeLabel(subject.equipment_type) +
        (subject.equipment_number ? ` · ${subject.equipment_number}` : ""),
      subtitle: subject.is_custom_equipment ? "Custom equipment" : "Equipment",
    };
  };

  const itemsBySubject = useMemo(() => {
    const map = new Map<string, FieldAuditItem[]>();
    const siteScoped: FieldAuditItem[] = [];
    for (const it of detail?.items ?? []) {
      if (it.field_audit_subject_id) {
        const arr = map.get(it.field_audit_subject_id);
        if (arr) arr.push(it);
        else map.set(it.field_audit_subject_id, [it]);
      } else {
        siteScoped.push(it);
      }
    }
    return { map, siteScoped };
  }, [detail?.items]);

  const overallRollup = useMemo(
    () => summarizeItems(detail?.items ?? []),
    [detail?.items],
  );

  const audit = detail?.audit;
  const locationLabel = audit
    ? audit.work_site_id
      ? siteNameById.get(audit.work_site_id) ?? "Work site"
      : audit.location_text || "—"
    : "";
  const crewLabel = audit
    ? audit.crew_id
      ? crewNameById.get(audit.crew_id) ?? "Crew"
      : audit.crew_name || "—"
    : "";

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
        aria-labelledby="fa-detail-title"
        data-testid="field-audit-detail-modal"
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
        className={`relative z-10 w-full max-w-3xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden mx-0 sm:mx-4 ${glass.elevated}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-gray-800 border-b border-white/[0.06] px-5 sm:px-6 py-4">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <ClipboardCheck className="w-4 h-4 text-rose-300" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 id="fa-detail-title" className="text-lg sm:text-xl font-bold text-white truncate">
                  {audit ? locationLabel : "Field audit"}
                </h2>
                <p className="text-xs text-white/40">
                  {audit ? formatAuditDate(audit.audit_date) : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {audit && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    audit.status === "draft"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                      : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                  }`}
                >
                  {audit.status === "draft" ? "Draft" : "Submitted"}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 text-white/50 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Loading audit…
            </div>
          ) : isError || !audit ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] px-4 py-3 text-sm text-rose-200">
              Could not load this audit.
            </div>
          ) : (
            <>
              {/* Meta + overall rollup */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className={`${glass.subtle} p-3.5`}>
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
                    <CalendarDays className="w-3.5 h-3.5" aria-hidden /> Date
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {formatAuditDate(audit.audit_date)}
                  </p>
                </div>
                <div className={`${glass.subtle} p-3.5`}>
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
                    <MapPin className="w-3.5 h-3.5" aria-hidden /> Location
                  </p>
                  <p className="mt-1 text-sm font-medium text-white truncate">{locationLabel}</p>
                </div>
                <div className={`${glass.subtle} p-3.5`}>
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
                    <Users className="w-3.5 h-3.5" aria-hidden /> Crew
                  </p>
                  <p className="mt-1 text-sm font-medium text-white truncate">{crewLabel}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className="text-xs uppercase tracking-wide text-white/45">
                  Overall result
                </span>
                <RollupBadge rollup={overallRollup} />
              </div>

              {audit.notes?.trim() && (
                <div className={`${glass.subtle} p-3.5`}>
                  <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1">Audit notes</p>
                  <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                    {audit.notes.trim()}
                  </p>
                </div>
              )}

              {/* Subjects */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-rose-300/80" aria-hidden />
                  <h3 className="text-sm font-semibold text-white">Subjects</h3>
                  <span className="text-[11px] font-mono tabular-nums text-white/35">
                    {detail.subjects.length}
                  </span>
                </div>

                {detail.subjects.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.01] px-4 py-6 text-center text-sm text-white/50">
                    No subjects were recorded on this audit.
                  </p>
                ) : (
                  detail.subjects.map((subject) => {
                    const { name, subtitle } = subjectDisplay(subject);
                    const subjectItems = sortItems(itemsBySubject.map.get(subject.id) ?? []);
                    const rollup = summarizeItems(subjectItems);
                    const Icon = subject.subject_type === "person" ? User : Wrench;
                    return (
                      <div
                        key={subject.id}
                        className="rounded-xl border border-rose-500/15 bg-gradient-to-br from-rose-950/20 to-[#0f1216] p-3.5"
                        data-testid="field-audit-detail-subject"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-rose-200/80" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{name}</p>
                              <p className="text-[11px] text-white/45 truncate">{subtitle}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setTimelineTarget({
                                identity: {
                                  subjectType: subject.subject_type,
                                  personId: subject.person_id,
                                  equipmentType: subject.equipment_type,
                                  equipmentNumber: subject.equipment_number,
                                },
                                displayName: name,
                                subtitle:
                                  subject.subject_type === "person"
                                    ? "Person timeline"
                                    : `Equipment timeline · ${subtitle}`,
                              })
                            }
                            data-testid="field-audit-view-timeline"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
                          >
                            <History className="w-3.5 h-3.5" aria-hidden />
                            History
                          </button>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                          <RollupBadge rollup={rollup} />
                        </div>

                        {subjectItems.length > 0 && (
                          <ul className="mt-1 divide-y divide-white/[0.04]">
                            {subjectItems.map((item) => (
                              <ItemRow key={item.id} item={item} label={itemLabel(item)} />
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Audit-wide (site-scoped) checks */}
              {itemsBySubject.siteScoped.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MinusCircle className="w-4 h-4 text-rose-300/80" aria-hidden />
                    <h3 className="text-sm font-semibold text-white">Audit-wide checks</h3>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <ul className="divide-y divide-white/[0.04]">
                      {sortItems(itemsBySubject.siteScoped).map((item) => (
                        <ItemRow key={item.id} item={item} label={itemLabel(item)} />
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {timelineTarget && (
        <SubjectTimelineModal
          identity={timelineTarget.identity}
          displayName={timelineTarget.displayName}
          subtitle={timelineTarget.subtitle}
          onClose={() => setTimelineTarget(null)}
        />
      )}
    </motion.div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
