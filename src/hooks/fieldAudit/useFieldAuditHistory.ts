/**
 * useFieldAuditHistory — filtered + paginated field-audit history (Chunk 6).
 *
 * Modeled on `useAdminJSAQuery` (filtered query + count-exact pagination + a
 * second enrichment pass), NOT the lighter HistoryPageShell. Filters:
 *   - date range  → field_audits.audit_date gte/lte
 *   - status      → field_audits.status (draft / submitted / all)
 *   - equipment   → audits that include a field_audit_subjects row of that type
 *   - person      → audits that include that person as a subject
 *   - open fails  → audits with ≥1 field_audit_items fail not yet escalated
 *
 * The cross-table filters (equipment / person / open-fails) resolve to a set of
 * candidate audit ids first, intersected, then constrain the main query with
 * `.in('id', …)` so pagination + counts stay correct. Per-audit pass/fail
 * rollups are computed read-time (GROUP BY in JS over the page's items, backed
 * by `idx_fa_items_fail` for the fail set) — there is no denormalized column.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { queryKeys } from "../../lib/queryKeys";
import {
  emptyRollup,
  summarizeItems,
  type RollupCounts,
} from "../../pages/safety-officer/fieldAuditConstants";

export type FieldAuditStatusFilter = "all" | "draft" | "submitted";

export interface FieldAuditHistoryParams {
  page: number;
  pageSize: number;
  statusFilter: FieldAuditStatusFilter;
  /** Inclusive ISO date (yyyy-mm-dd) lower bound on audit_date. */
  dateFrom?: string;
  /** Inclusive ISO date (yyyy-mm-dd) upper bound on audit_date. */
  dateTo?: string;
  /** field_audit_subjects.equipment_type token. */
  equipmentType?: string;
  /** field_audit_subjects.person_id (app_users id). */
  personId?: string;
  /** Only audits with ≥1 unescalated fail. */
  openFailsOnly?: boolean;
}

export interface FieldAuditHistoryRow {
  id: string;
  audit_date: string;
  status: "draft" | "submitted";
  work_site_id: string | null;
  location_text: string | null;
  crew_id: string | null;
  crew_name: string | null;
  foreman_id: string | null;
  auditor_id: string;
  created_at: string;
  submitted_at: string | null;
  /** Read-time rollup across this audit's items. */
  rollup: RollupCounts;
  peopleCount: number;
  equipmentCount: number;
}

export interface FieldAuditHistoryResult {
  records: FieldAuditHistoryRow[];
  total: number;
}

const AUDIT_COLUMNS =
  "id, audit_date, status, work_site_id, location_text, crew_id, crew_name, foreman_id, auditor_id, created_at, submitted_at";

/** Distinct field_audit_id set for a subject-side filter (equipment / person). */
async function auditIdsForSubjectFilter(
  column: "equipment_type" | "person_id",
  value: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("field_audit_subjects")
    .select("field_audit_id")
    .eq(column, value);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => (r as { field_audit_id: string }).field_audit_id));
}

/** Distinct field_audit_id set with ≥1 unescalated fail (backed by idx_fa_items_fail). */
async function auditIdsWithOpenFails(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("field_audit_items")
    .select("field_audit_id")
    .eq("result", "fail")
    .is("corrective_action_id", null);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => (r as { field_audit_id: string }).field_audit_id));
}

function intersect(sets: Set<string>[]): Set<string> {
  if (sets.length === 0) return new Set();
  let acc = sets[0];
  for (let i = 1; i < sets.length; i += 1) {
    acc = new Set([...acc].filter((id) => sets[i].has(id)));
    if (acc.size === 0) break;
  }
  return acc;
}

async function fetchFieldAuditHistory(
  params: FieldAuditHistoryParams,
): Promise<FieldAuditHistoryResult> {
  const {
    page,
    pageSize,
    statusFilter,
    dateFrom,
    dateTo,
    equipmentType,
    personId,
    openFailsOnly,
  } = params;

  // 1) Resolve cross-table filters to a candidate id set (intersection).
  const candidateSets: Set<string>[] = [];
  if (equipmentType) {
    candidateSets.push(await auditIdsForSubjectFilter("equipment_type", equipmentType));
  }
  if (personId) {
    candidateSets.push(await auditIdsForSubjectFilter("person_id", personId));
  }
  if (openFailsOnly) {
    candidateSets.push(await auditIdsWithOpenFails());
  }

  let candidateIds: string[] | null = null;
  if (candidateSets.length > 0) {
    const intersection = intersect(candidateSets);
    if (intersection.size === 0) {
      return { records: [], total: 0 };
    }
    candidateIds = [...intersection];
  }

  // 2) Main page query (date + status filters + optional id constraint).
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("field_audits")
    .select(AUDIT_COLUMNS, { count: "exact" })
    .order("audit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter !== "all") query = query.eq("status", statusFilter);
  if (dateFrom) query = query.gte("audit_date", dateFrom);
  if (dateTo) query = query.lte("audit_date", dateTo);
  if (candidateIds) query = query.in("id", candidateIds);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const audits = (data ?? []) as Array<
    Omit<FieldAuditHistoryRow, "rollup" | "peopleCount" | "equipmentCount">
  >;
  const pageIds = audits.map((a) => a.id);

  // 3) Enrich the page rows with read-time rollups + subject counts.
  const rollupByAudit = new Map<string, RollupCounts>();
  const peopleByAudit = new Map<string, number>();
  const equipmentByAudit = new Map<string, number>();

  if (pageIds.length > 0) {
    const [itemsRes, subjectsRes] = await Promise.all([
      supabase
        .from("field_audit_items")
        .select("field_audit_id, result, corrective_action_id")
        .in("field_audit_id", pageIds),
      supabase
        .from("field_audit_subjects")
        .select("field_audit_id, subject_type")
        .in("field_audit_id", pageIds),
    ]);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (subjectsRes.error) throw new Error(subjectsRes.error.message);

    const itemsByAudit = new Map<
      string,
      Array<{ result: "pass" | "fail" | "na"; corrective_action_id: string | null }>
    >();
    for (const row of itemsRes.data ?? []) {
      const r = row as {
        field_audit_id: string;
        result: "pass" | "fail" | "na";
        corrective_action_id: string | null;
      };
      const arr = itemsByAudit.get(r.field_audit_id);
      if (arr) arr.push(r);
      else itemsByAudit.set(r.field_audit_id, [r]);
    }
    for (const id of pageIds) {
      rollupByAudit.set(id, summarizeItems(itemsByAudit.get(id) ?? []));
    }

    for (const row of subjectsRes.data ?? []) {
      const r = row as { field_audit_id: string; subject_type: "person" | "equipment" };
      if (r.subject_type === "person") {
        peopleByAudit.set(r.field_audit_id, (peopleByAudit.get(r.field_audit_id) ?? 0) + 1);
      } else {
        equipmentByAudit.set(
          r.field_audit_id,
          (equipmentByAudit.get(r.field_audit_id) ?? 0) + 1,
        );
      }
    }
  }

  const records: FieldAuditHistoryRow[] = audits.map((a) => ({
    ...a,
    rollup: rollupByAudit.get(a.id) ?? emptyRollup(),
    peopleCount: peopleByAudit.get(a.id) ?? 0,
    equipmentCount: equipmentByAudit.get(a.id) ?? 0,
  }));

  return { records, total: typeof count === "number" ? count : records.length };
}

export function useFieldAuditHistory(
  params: FieldAuditHistoryParams,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.fieldAudit.history(params),
    queryFn: () => fetchFieldAuditHistory(params),
    enabled,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });
}
