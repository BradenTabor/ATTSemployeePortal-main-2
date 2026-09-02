/**
 * Field Safety Audit — submit readiness (pure, dependency-free).
 *
 * The Review & Submit panel asks one question: "is this audit ready to leave
 * the auditor's hands?" This module answers it deterministically from the
 * server-loaded subjects, items, and checklist config so the same rules can be
 * unit-tested, rendered as a checklist, and mirrored by the `submit_field_audit`
 * RPC (which enforces the BLOCKER subset server-side as the floor).
 *
 *   Blockers  — submit is refused until fixed (server enforces the same):
 *     no_checks           nothing has been recorded at all
 *     fail_note_missing   a Fail has no finding note
 *
 *   Warnings  — surfaced for judgement, never block:
 *     fail_photo_missing  a Fail on a `requires_photo_on_fail` item has no photo
 *     subject_untouched   a subject was added but no check was answered
 *     subject_incomplete  a subject has unanswered seeded items
 *     site_incomplete     audit-wide site checks were started but not finished
 *     open_findings       Fails not yet escalated to a corrective action
 */

import {
  checklistItemsForSite,
  checklistItemsForSubject,
  summarizeItems,
  type AuditChecklistItem,
  type FieldAuditItem,
  type FieldAuditSubject,
  type RollupCounts,
} from "./fieldAuditConstants";

export type ReadinessSeverity = "blocker" | "warning";

export type ReadinessCode =
  | "no_checks"
  | "fail_note_missing"
  | "fail_photo_missing"
  | "subject_untouched"
  | "subject_incomplete"
  | "site_incomplete"
  | "open_findings";

export interface ReadinessIssue {
  code: ReadinessCode;
  severity: ReadinessSeverity;
  /** Auditor-facing sentence, already pluralised. */
  message: string;
  /** Subject the issue points at (null for audit-wide / aggregate issues). */
  subjectId: string | null;
  /** How many items the issue covers (1 for single-item issues). */
  count: number;
}

/** Overall read of the audit for the verdict band. */
export type ReadinessGrade = "empty" | "incomplete" | "findings" | "clean";

export interface ReadinessCounts extends RollupCounts {
  people: number;
  equipment: number;
  /** Subjects with ≥1 answered item. */
  subjectsStarted: number;
  siteAnswered: number;
  siteTotal: number;
  custom: number;
  /** Fails that carry a photo. */
  failWithPhoto: number;
}

export interface FieldAuditReadiness {
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  counts: ReadinessCounts;
  canSubmit: boolean;
  grade: ReadinessGrade;
  /** pass / (pass + fail), or null when nothing decisive was recorded. */
  passRate: number | null;
}

export interface ReadinessInput {
  subjects: ReadonlyArray<FieldAuditSubject>;
  items: ReadonlyArray<FieldAuditItem>;
  configItems: ReadonlyArray<AuditChecklistItem>;
  /** Display names keyed by subject id (falls back to a generic label). */
  subjectNames?: ReadonlyMap<string, string>;
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export function computeFieldAuditReadiness(input: ReadinessInput): FieldAuditReadiness {
  const { subjects, items, configItems } = input;
  const nameOf = (id: string) => input.subjectNames?.get(id) ?? "A subject";

  const configById = new Map(configItems.map((c) => [c.id, c]));
  const config = [...configItems];

  const itemsBySubject = new Map<string, FieldAuditItem[]>();
  const siteItems: FieldAuditItem[] = [];
  for (const it of items) {
    if (it.field_audit_subject_id) {
      const arr = itemsBySubject.get(it.field_audit_subject_id);
      if (arr) arr.push(it);
      else itemsBySubject.set(it.field_audit_subject_id, [it]);
    } else {
      siteItems.push(it);
    }
  }

  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  // ── Blockers ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    blockers.push({
      code: "no_checks",
      severity: "blocker",
      message: "Record at least one Pass / Fail / N/A check before submitting.",
      subjectId: null,
      count: 0,
    });
  }

  const failsMissingNote = items.filter(
    (i) => i.result === "fail" && !(i.note ?? "").trim(),
  );
  if (failsMissingNote.length > 0) {
    // Group per subject so the panel can deep-link the auditor to the right card.
    const bySubject = new Map<string | null, number>();
    for (const f of failsMissingNote) {
      const key = f.field_audit_subject_id;
      bySubject.set(key, (bySubject.get(key) ?? 0) + 1);
    }
    for (const [subjectId, count] of bySubject) {
      const who = subjectId ? nameOf(subjectId) : "Site conditions";
      blockers.push({
        code: "fail_note_missing",
        severity: "blocker",
        message: `${who}: ${count} Fail ${plural(count, "needs", "need")} a finding note.`,
        subjectId,
        count,
      });
    }
  }

  // ── Warnings ──────────────────────────────────────────────────────────────
  const failsMissingPhoto = items.filter((i) => {
    if (i.result !== "fail" || i.photo_path) return false;
    const cfg = i.checklist_item_id ? configById.get(i.checklist_item_id) : undefined;
    return Boolean(cfg?.requires_photo_on_fail);
  });
  if (failsMissingPhoto.length > 0) {
    warnings.push({
      code: "fail_photo_missing",
      severity: "warning",
      message: `${failsMissingPhoto.length} Fail ${plural(
        failsMissingPhoto.length,
        "is",
        "are",
      )} missing a required photo.`,
      subjectId: null,
      count: failsMissingPhoto.length,
    });
  }

  let subjectsStarted = 0;
  for (const subject of subjects) {
    const answered = itemsBySubject.get(subject.id) ?? [];
    if (answered.length === 0) {
      warnings.push({
        code: "subject_untouched",
        severity: "warning",
        message: `${nameOf(subject.id)} has no checks recorded.`,
        subjectId: subject.id,
        count: 0,
      });
      continue;
    }
    subjectsStarted += 1;
    const seeded = checklistItemsForSubject(config, subject);
    const answeredSeeded = new Set(
      answered.filter((i) => i.checklist_item_id).map((i) => i.checklist_item_id),
    );
    const remaining = seeded.filter((s) => !answeredSeeded.has(s.id)).length;
    if (remaining > 0) {
      warnings.push({
        code: "subject_incomplete",
        severity: "warning",
        message: `${nameOf(subject.id)}: ${remaining} ${plural(
          remaining,
          "check",
        )} left unanswered.`,
        subjectId: subject.id,
        count: remaining,
      });
    }
  }

  const siteConfig = checklistItemsForSite(config);
  const siteAnsweredSeeded = new Set(
    siteItems.filter((i) => i.checklist_item_id).map((i) => i.checklist_item_id),
  );
  const siteRemaining = siteConfig.filter((s) => !siteAnsweredSeeded.has(s.id)).length;
  if (siteItems.length > 0 && siteRemaining > 0) {
    warnings.push({
      code: "site_incomplete",
      severity: "warning",
      message: `Site conditions: ${siteRemaining} ${plural(
        siteRemaining,
        "check",
      )} left unanswered.`,
      subjectId: null,
      count: siteRemaining,
    });
  }

  const rollup = summarizeItems(items);
  if (rollup.openFail > 0) {
    warnings.push({
      code: "open_findings",
      severity: "warning",
      message: `${rollup.openFail} ${plural(
        rollup.openFail,
        "finding has",
        "findings have",
      )} not been escalated to a corrective action (record-only).`,
      subjectId: null,
      count: rollup.openFail,
    });
  }

  // ── Counts + verdict ──────────────────────────────────────────────────────
  const counts: ReadinessCounts = {
    ...rollup,
    people: subjects.filter((s) => s.subject_type === "person").length,
    equipment: subjects.filter((s) => s.subject_type === "equipment").length,
    subjectsStarted,
    siteAnswered: siteAnsweredSeeded.size,
    siteTotal: siteConfig.length,
    custom: items.filter((i) => i.custom_label != null).length,
    failWithPhoto: items.filter((i) => i.result === "fail" && Boolean(i.photo_path)).length,
  };

  const decisive = rollup.pass + rollup.fail;
  const passRate = decisive > 0 ? rollup.pass / decisive : null;

  let grade: ReadinessGrade;
  if (items.length === 0) grade = "empty";
  else if (blockers.length > 0 || warnings.some((w) => w.code !== "open_findings"))
    grade = "incomplete";
  else if (rollup.fail > 0) grade = "findings";
  else grade = "clean";

  return {
    blockers,
    warnings,
    counts,
    canSubmit: blockers.length === 0,
    grade,
    passRate,
  };
}

/** Ad-hoc (`custom_label`) items, grouped for the "Custom items" review subsection. */
export interface CustomItemSummary {
  id: string;
  label: string;
  result: FieldAuditItem["result"];
  subjectId: string | null;
}

export function listCustomItems(items: ReadonlyArray<FieldAuditItem>): CustomItemSummary[] {
  return items
    .filter((i) => i.custom_label != null)
    .map((i) => ({
      id: i.id,
      label: (i.custom_label ?? "").trim() || "Untitled item",
      result: i.result,
      subjectId: i.field_audit_subject_id,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Map a server HINT code from `submit_field_audit` back to a readiness code. */
export function readinessCodeFromServerHint(hint: string | null | undefined): ReadinessCode | null {
  switch (hint) {
    case "FIELD_AUDIT_EMPTY":
      return "no_checks";
    case "FIELD_AUDIT_FAIL_NOTE_MISSING":
      return "fail_note_missing";
    default:
      return null;
  }
}
