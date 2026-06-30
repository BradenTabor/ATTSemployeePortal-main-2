/**
 * Field Safety Audit — shared constants & types (Chunk 3).
 *
 * Per the ratified schema decisions (2026-06-27), the per-subject checklist
 * renders purely from the DB: `audit_checklist_items.subject_scope` +
 * `equipment_types` array-containment. There is intentionally NO code-side
 * equipment_type→section map — this file instead holds:
 *   - the equipment-type picker options (human label → stored seed token, D2),
 *   - upper-trim normalization for equipment identity (so `j119`/`J-119` history
 *     joins don't fragment),
 *   - the P/F/NA ↔ pass/fail/na value mapping for the new ChecklistTriState,
 *   - the containment predicate, and the field-audit row types.
 *
 * Equipment-type tokens MUST match the seeded `audit_checklist_items.equipment_types`
 * ({chainsaw}, {chipper}, {Jarraff}, {bucket_truck}) for containment to surface the
 * type-specific checklist. Fleet types with no type-specific seed items still get
 * the `equipment_types IS NULL` ("all equipment") items.
 */

import { toZonedTime } from "date-fns-tz";
import {
  EQUIPMENT_NUMBERS_BY_TYPE,
  type EquipmentTypeOption,
} from "../forms/equipmentConstants";

const FIELD_AUDIT_TZ = "America/Chicago";

// ── Result / tri-state value mapping ────────────────────────────────────────

/** DB column value on `field_audit_items.result`. */
export type FieldAuditResult = "pass" | "fail" | "na";

/** Display value for the field-audit ChecklistTriState ('' = unanswered). */
export type TriValue = "" | "P" | "F" | "NA";

export const RESULT_TO_TRI: Record<FieldAuditResult, Exclude<TriValue, "">> = {
  pass: "P",
  fail: "F",
  na: "NA",
};

export const TRI_TO_RESULT: Record<Exclude<TriValue, "">, FieldAuditResult> = {
  P: "pass",
  F: "fail",
  NA: "na",
};

// ── Escalation (Chunk 4: corrective action + optional points deduction) ──────

/** `corrective_actions.action_type` CHECK set (default `immediate`). */
export type FieldAuditActionType =
  | "immediate"
  | "short_term"
  | "long_term"
  | "systemic";

export const FIELD_AUDIT_ACTION_TYPES: ReadonlyArray<{
  value: FieldAuditActionType;
  label: string;
}> = [
  { value: "immediate", label: "Immediate" },
  { value: "short_term", label: "Short term" },
  { value: "long_term", label: "Long term" },
  { value: "systemic", label: "Systemic" },
];

/**
 * Prefill for the corrective-action due date: +7 days in America/Chicago,
 * mirroring the RPC's own `p_due_date` default. Resolved via Chicago "today"
 * then UTC day-math so it never drifts across the local-vs-Chicago boundary.
 */
export function defaultCorrectiveDueDate(): string {
  const todayChicago = toZonedTime(new Date(), FIELD_AUDIT_TZ)
    .toISOString()
    .slice(0, 10);
  const dt = new Date(`${todayChicago}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 7);
  return dt.toISOString().slice(0, 10);
}

// ── Equipment-type picker (D2: human label → stored seed token) ──────────────

export interface FieldAuditEquipmentType {
  /** Human label shown in the picker. */
  label: string;
  /** Stored `field_audit_subjects.equipment_type` value (seed token). */
  token: string;
  /** Known unit numbers, if any (otherwise the auditor types the unit). */
  units: string[];
}

/** Sentinel token for the free-text "Other / new unit" path (is_custom_equipment). */
export const CUSTOM_EQUIPMENT_TOKEN = "__custom__";

/**
 * Code-side `EQUIPMENT_TYPE_OPTIONS` + audit-only tokens `bucket_truck`,
 * `chipper`, `chainsaw`, `truck_trailer` (D2 / directive open item #3). Tokens
 * that have seeded type-specific checklist items are ordered first.
 */
export const FIELD_AUDIT_EQUIPMENT_TYPES: FieldAuditEquipmentType[] = [
  { label: "Jarraff", token: "Jarraff", units: EQUIPMENT_NUMBERS_BY_TYPE.Jarraff },
  { label: "Bucket Truck", token: "bucket_truck", units: [] },
  { label: "Chipper", token: "chipper", units: [] },
  { label: "Chainsaw", token: "chainsaw", units: [] },
  { label: "Geo-Boy", token: "Geo-Boy", units: EQUIPMENT_NUMBERS_BY_TYPE["Geo-Boy"] },
  { label: "Grapple", token: "Grapple", units: EQUIPMENT_NUMBERS_BY_TYPE.Grapple },
  { label: "Mulcher", token: "Mulcher", units: EQUIPMENT_NUMBERS_BY_TYPE.Mulcher },
  { label: "Skidsteer", token: "Skidsteer", units: EQUIPMENT_NUMBERS_BY_TYPE.Skidsteer },
  { label: "Truck / Trailer", token: "truck_trailer", units: [] },
];

const KNOWN_TYPE_LABEL_BY_TOKEN = new Map(
  FIELD_AUDIT_EQUIPMENT_TYPES.map((t) => [t.token, t.label]),
);

/** Human label for a stored equipment token (falls back to the raw token for custom units). */
export function equipmentTypeLabel(token: string | null | undefined): string {
  if (!token) return "Equipment";
  return KNOWN_TYPE_LABEL_BY_TOKEN.get(token) ?? token;
}

/** Upper-trim normalize the unit number so history joins stay consistent. */
export function normalizeEquipmentNumber(value: string): string {
  return value.trim().toUpperCase();
}

/** Trim a free-text custom equipment type (kept as-typed otherwise). */
export function normalizeCustomType(value: string): string {
  return value.trim();
}

// Re-export for callers building equipment pickers.
export type { EquipmentTypeOption };

// ── Field-audit row types (mirror the live schema) ──────────────────────────

export interface AuditChecklistItem {
  id: string;
  section_key: string;
  item_key: string;
  label: string;
  standard_ref: string | null;
  subject_scope: "person" | "equipment" | "site";
  equipment_types: string[] | null;
  sort_order: number;
  requires_photo_on_fail: boolean;
}

export interface FieldAuditSubject {
  id: string;
  field_audit_id: string;
  subject_type: "person" | "equipment";
  person_id: string | null;
  equipment_type: string | null;
  equipment_number: string | null;
  is_custom_equipment: boolean;
  created_at: string;
}

export interface FieldAuditItem {
  id: string;
  field_audit_id: string;
  field_audit_subject_id: string | null;
  checklist_item_id: string | null;
  custom_label: string | null;
  result: FieldAuditResult;
  note: string | null;
  photo_path: string | null;
  corrective_action_id: string | null;
}

/**
 * Bounded `field_notes.note_kind` set (text + CHECK in the DB, codebase norm).
 * Drives the note-type chip filter and PPE / equipment issuance tracking.
 */
export type FieldNoteKind =
  | "general"
  | "ppe_issued"
  | "equipment_issued"
  | "verbal_warning"
  | "repair_noted";

/**
 * note_kind chip options (label ↔ stored token). `ppe_issued` / `equipment_issued`
 * are the issuance kinds the monthly summary aggregates by `item_tag`.
 */
export const FIELD_NOTE_KINDS: ReadonlyArray<{
  value: FieldNoteKind;
  label: string;
}> = [
  { value: "general", label: "General" },
  { value: "ppe_issued", label: "PPE issued" },
  { value: "equipment_issued", label: "Equipment issued" },
  { value: "verbal_warning", label: "Verbal warning" },
  { value: "repair_noted", label: "Repair noted" },
];

/** note_kinds for which an `item_tag` (e.g. "hard hat", "chaps") is meaningful. */
export const FIELD_NOTE_ISSUANCE_KINDS: ReadonlySet<FieldNoteKind> = new Set([
  "ppe_issued",
  "equipment_issued",
]);

export interface FieldNote {
  id: string;
  field_audit_id: string | null;
  author_id: string;
  subject_type: "person" | "equipment";
  person_id: string | null;
  equipment_type: string | null;
  equipment_number: string | null;
  is_custom_equipment: boolean;
  note: string;
  note_kind: FieldNoteKind;
  /** Free-text item named by an issuance note (e.g. "hard hat", "chaps"); null otherwise. */
  item_tag: string | null;
  created_at: string;
}

// ── Containment: which seeded items apply to a given subject ─────────────────

/** True when a checklist item applies to an equipment subject of `token`. */
export function itemAppliesToEquipment(
  item: AuditChecklistItem,
  token: string | null,
): boolean {
  if (item.subject_scope !== "equipment") return false;
  // NULL / empty equipment_types = applies to ALL equipment.
  if (!item.equipment_types || item.equipment_types.length === 0) return true;
  if (!token) return false;
  return item.equipment_types.includes(token);
}

/** Applicable seeded items for a subject, sorted by section then sort_order. */
export function checklistItemsForSubject(
  items: AuditChecklistItem[],
  subject: Pick<FieldAuditSubject, "subject_type" | "equipment_type">,
): AuditChecklistItem[] {
  const applicable =
    subject.subject_type === "person"
      ? items.filter((i) => i.subject_scope === "person")
      : items.filter((i) => itemAppliesToEquipment(i, subject.equipment_type));
  return [...applicable].sort(
    (a, b) =>
      a.section_key.localeCompare(b.section_key) || a.sort_order - b.sort_order,
  );
}

// ── Read-time rollup status (no denormalized column) ────────────────────────

export type RollupStatus = "none" | "in_progress" | "pass" | "fail";

/** Roll a subject's item results up to a single status dot (read-time). */
export function rollupStatus(results: FieldAuditResult[]): RollupStatus {
  if (results.length === 0) return "none";
  if (results.some((r) => r === "fail")) return "fail";
  return "pass";
}

// ── Tiny dependency-free relative-time formatter (notes strip) ───────────────

export function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  const yr = Math.round(mo / 12);
  return `${yr} yr${yr === 1 ? "" : "s"} ago`;
}

/** Stable cache key for a subject's persistent field-notes lookup. */
export function fieldNotesSubjectKey(
  subject: Pick<
    FieldAuditSubject,
    "subject_type" | "person_id" | "equipment_type" | "equipment_number"
  >,
): string {
  return subject.subject_type === "person"
    ? `person:${subject.person_id ?? ""}`
    : `equipment:${subject.equipment_type ?? ""}:${subject.equipment_number ?? ""}`;
}
