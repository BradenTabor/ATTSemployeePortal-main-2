import { Fragment, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import {
  useWorkerQualifications,
  useUpdateQualification,
  useElectricalQualificationHistory,
  type ElectricalQualificationHistoryEntry,
} from "../../../hooks/queries/useWorkerQualifications";
import type {
  ElectricalQualificationLevel,
  WorkerQualification,
} from "../../../types/electricalQualification";
import { QUALIFICATION_LABELS } from "../../../types/electricalQualification";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Upload, UserPlus } from "lucide-react";
import TableSkeleton from "../../skeletons/TableSkeleton";
import { WorkerQualificationsImportModal } from "./WorkerQualificationsImportModal";
import { CertificationAuditLogPanel } from "./CertificationAuditLogPanel";
import { WorkerCertificationsCard } from "./WorkerCertificationsCard";
import { WorkerCertsSummaryCell } from "./WorkerCertsSummaryCell";
import { WorkerInternalCertsList } from "./WorkerInternalCertsList";
import { ExternalCertModal } from "./ExternalCertModal";
import { GrantCertAccessModal } from "./GrantCertAccessModal";
import { useWorkerExternalCertifications } from "../../../hooks/queries/useExternalCertifications";
import { useCertificationTypes, useUserCertificationMatrix, useAllActiveInternalCertRecords } from "../../../hooks/useCertifications";
import type { WorkerExternalCertification } from "../../../types/externalCertification";
import { glass } from "../../../lib/glass";

const TABLE_COLUMNS = 8;

function levelLabel(level: string | null): string {
  if (!level) return "—";
  return QUALIFICATION_LABELS[level as ElectricalQualificationLevel] ?? level;
}

const LEVEL_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  unqualified: { bg: "bg-gray-500/20", text: "text-gray-400" },
  line_clearance_tree_trimmer: { bg: "bg-amber-500/20", text: "text-amber-300" },
  qualified_269: { bg: "bg-emerald-500/20", text: "text-emerald-300" },
};

function QualificationBadge({ level }: { level: ElectricalQualificationLevel }) {
  const style = LEVEL_BADGE_STYLES[level] ?? LEVEL_BADGE_STYLES.unqualified;
  return (
    <span
      className={`inline-flex items-center rounded-full ${style.bg} px-2.5 py-0.5 text-xs font-medium ${style.text}`}
    >
      {QUALIFICATION_LABELS[level]}
    </span>
  );
}

function HistoryCell({ userId }: { userId: string }) {
  const { data: history, isLoading, error } = useElectricalQualificationHistory(userId, {
    enabled: true,
  });
  if (isLoading) {
    return (
      <div className="py-4 text-center text-sm text-white/50">
        Loading history…
      </div>
    );
  }
  if (error) {
    return (
      <div className="py-4 text-center text-sm text-red-400">
        {(error as Error)?.message ?? "Failed to load history."}
      </div>
    );
  }
  if (!history?.length) {
    return (
      <div className="py-4 text-center text-sm text-white/50">
        No qualification history yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto py-3">
      <table className="w-full min-w-[400px] text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 text-white/60">
            <th className="pb-2 pr-4 font-medium">Date changed</th>
            <th className="pb-2 pr-4 font-medium">Previous level</th>
            <th className="pb-2 pr-4 font-medium">New level</th>
            <th className="pb-2 font-medium">Changed by</th>
          </tr>
        </thead>
        <tbody>
          {history.map((entry: ElectricalQualificationHistoryEntry) => (
            <tr key={entry.id} className="border-b border-white/5">
              <td className="py-1.5 pr-4 text-white/80">
                {new Date(entry.certified_at ?? entry.created_at).toLocaleDateString()}
              </td>
              <td className="py-1.5 pr-4 text-white/70">
                {levelLabel(entry.previous_electrical_level)}
              </td>
              <td className="py-1.5 pr-4 text-white/70">
                {levelLabel(entry.new_electrical_level)}
              </td>
              <td className="py-1.5 text-white/70">
                {entry.changed_by_name ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const LEVELS: ElectricalQualificationLevel[] = [
  "unqualified",
  "line_clearance_tree_trimmer",
  "qualified_269",
];

const PAGE_SIZE = 25;

type SortField = "name" | "role" | "level" | "date";
type SortDir = "asc" | "desc";

const LEVEL_ORDER: Record<string, number> = {
  unqualified: 0,
  line_clearance_tree_trimmer: 1,
  qualified_269: 2,
};

function compareSorted(a: WorkerQualification, b: WorkerQualification, field: SortField, dir: SortDir): number {
  let cmp = 0;
  switch (field) {
    case "name":
      cmp = (a.full_name ?? "").localeCompare(b.full_name ?? "");
      break;
    case "role":
      cmp = (a.role ?? "").localeCompare(b.role ?? "");
      break;
    case "level":
      cmp = (LEVEL_ORDER[a.electrical_qualification_level] ?? 0) - (LEVEL_ORDER[b.electrical_qualification_level] ?? 0);
      break;
    case "date":
      cmp = (a.electrical_qualification_date ?? "").localeCompare(b.electrical_qualification_date ?? "");
      break;
  }
  return dir === "desc" ? -cmp : cmp;
}

function levelParamToFilter(
  levelParam: string | null
): ElectricalQualificationLevel | undefined {
  if (levelParam === null || levelParam === "") return undefined;
  const i = parseInt(levelParam, 10);
  if (Number.isNaN(i) || i < 0 || i >= LEVELS.length) return undefined;
  return LEVELS[i];
}

function filterToLevelParam(
  level: ElectricalQualificationLevel | undefined
): string | null {
  if (level === undefined) return null;
  const i = LEVELS.indexOf(level);
  return i === -1 ? null : String(i);
}

function exportWorkerQualificationsCsv(rows: WorkerQualification[]) {
  const headers = ["Name", "Role", "Electrical Qualification", "Qualification Date", "Verified By"];
  const lines = [
    "\ufeff" + headers.join(","),
    ...rows.map((r) =>
      [
        `"${(r.full_name ?? "").replace(/"/g, '""')}"`,
        `"${(r.role ?? "").replace(/"/g, '""')}"`,
        `"${QUALIFICATION_LABELS[r.electrical_qualification_level]}"`,
        r.electrical_qualification_date ?? "",
        `"${(r.verified_by_name ?? "").replace(/"/g, '""')}"`,
      ].join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `worker-qualifications-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface WorkerQualificationsSectionProps {
  /** When provided, use this data instead of fetching (e.g. from CertificationsHub). Filter by level/search applied client-side. */
  workers?: WorkerQualification[] | null;
  workersLoading?: boolean;
  workersError?: Error | null;
  onRefreshWorkers?: () => void;
}

export function WorkerQualificationsSection({
  workers: workersProp,
  workersLoading: workersLoadingProp,
  workersError: workersErrorProp,
}: WorkerQualificationsSectionProps = {}) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const filterLevel = useMemo(
    () => levelParamToFilter(searchParams.get("level")),
    [searchParams]
  );
  const filterCertTypeId = searchParams.get("cert") ?? "";
  const filterCompliance = searchParams.get("compliance") ?? "";
  const sortField = (searchParams.get("sort") as SortField) || "name";
  const sortDir = (searchParams.get("dir") as SortDir) || "asc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const setSearch = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value.trim()) next.set("search", value.trim());
        else next.delete("search");
        next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  const setFilterLevelInUrl = (level: ElectricalQualificationLevel | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const param = filterToLevelParam(level);
        if (param !== null) next.set("level", param);
        else next.delete("level");
        next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  const setFilterCertTypeInUrl = (certTypeId: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (certTypeId) next.set("cert", certTypeId);
        else next.delete("cert");
        next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  const setFilterComplianceInUrl = (compliance: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (compliance) next.set("compliance", compliance);
        else next.delete("compliance");
        next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  const toggleSort = (field: SortField) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (sortField === field) {
          next.set("dir", sortDir === "asc" ? "desc" : "asc");
        } else {
          next.set("sort", field);
          next.set("dir", "asc");
        }
        next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  const setPage = (p: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (p <= 1) next.delete("page");
        else next.set("page", String(p));
        return next;
      },
      { replace: true }
    );
  };

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [certModal, setCertModal] = useState<{
    mode: "assign" | "edit";
    workerId: string;
    workerName: string;
    existingCert?: WorkerExternalCertification;
  } | null>(null);
  const [grantAccessModal, setGrantAccessModal] = useState<{
    workerId: string;
    workerName: string;
  } | null>(null);

  const { data: allExternalCerts } = useWorkerExternalCertifications();
  const extCertCountMap = useMemo(() => {
    const map = new Map<string, { active: number; expiring: number; expired: number }>();
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().slice(0, 10);
    for (const c of allExternalCerts ?? []) {
      const entry = map.get(c.user_id) ?? { active: 0, expiring: 0, expired: 0 };
      if (c.effective_status === "expired") {
        entry.expired += 1;
      } else if (c.effective_status === "active" && c.expiration_date && c.expiration_date <= in30Str && c.expiration_date >= today) {
        entry.expiring += 1;
        entry.active += 1;
      } else if (c.effective_status === "active") {
        entry.active += 1;
      }
      map.set(c.user_id, entry);
    }
    return map;
  }, [allExternalCerts]);

  const { data: certTypes } = useCertificationTypes();
  const { data: matrixRows } = useUserCertificationMatrix();

  const allowedUserIdsWhenFilterActive = useMemo(() => {
    if (!filterCertTypeId && !filterCompliance) return null;
    let rows = matrixRows ?? [];
    if (filterCertTypeId) {
      rows = rows.filter((r) => r.certification_type_id === filterCertTypeId);
    }
    if (filterCompliance) {
      rows = rows.filter((r) => r.compliance_status === filterCompliance);
    }
    return new Set(rows.map((r) => r.user_id));
  }, [matrixRows, filterCertTypeId, filterCompliance]);

  const { data: allActiveInternalCerts } = useAllActiveInternalCertRecords();
  const internalCertCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of allActiveInternalCerts ?? []) {
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + 1);
    }
    return map;
  }, [allActiveInternalCerts]);

  const hookResult = useWorkerQualifications(
    filterLevel,
    { enabled: workersProp === undefined }
  );
  const workers = useMemo(
    () =>
      workersProp !== undefined ? (workersProp ?? []) : (hookResult.data ?? []),
    [workersProp, hookResult.data]
  );
  const isLoading =
    workersProp !== undefined ? (workersLoadingProp ?? false) : hookResult.isLoading;
  const error = workersProp !== undefined ? workersErrorProp : hookResult.error;

  const filteredWorkers = useMemo(() => {
    let list = workers;
    if (filterLevel) {
      list = list.filter((w) => w.electrical_qualification_level === filterLevel);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((w) =>
        (w.full_name ?? "").toLowerCase().includes(q)
      );
    }
    if (allowedUserIdsWhenFilterActive != null) {
      list = list.filter((w) => allowedUserIdsWhenFilterActive.has(w.user_id));
    }
    return list;
  }, [workers, filterLevel, search, allowedUserIdsWhenFilterActive]);

  const sortedWorkers = useMemo(
    () => [...filteredWorkers].sort((a, b) => compareSorted(a, b, sortField, sortDir)),
    [filteredWorkers, sortField, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(sortedWorkers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedWorkers = useMemo(
    () => sortedWorkers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedWorkers, safePage]
  );

  const updateQual = useUpdateQualification();
  const runImport = useCallback(
    async (rows: { userId: string; level: ElectricalQualificationLevel }[]) => {
      if (!user?.id) return [];
      return Promise.allSettled(
        rows.map((r) =>
          updateQual.mutateAsync({
            userId: r.userId,
            level: r.level,
            adminAuthUserId: user.id,
          })
        )
      );
    },
    [user, updateQual]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className={`px-4 py-4 ${glass.card}`}>
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Worker Qualifications
        </h2>
        <p className="mt-1 text-sm text-white/60">
          OSHA 1910.269(r) electrical qualification levels. Filter and edit
          inline.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            data-testid="worker-qualifications-import-csv"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Import CSV
          </button>
          <button
            type="button"
            onClick={() => exportWorkerQualificationsCsv(sortedWorkers)}
            disabled={!sortedWorkers.length}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            data-testid="worker-qualifications-export-csv"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
        </div>
      </div>

      {importModalOpen &&
        createPortal(
          <WorkerQualificationsImportModal
            open={importModalOpen}
            onClose={() => setImportModalOpen(false)}
            workers={workers ?? []}
            onImport={runImport}
          />,
          document.body
        )}

      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          aria-label="Search workers by name"
          data-testid="worker-qualifications-search"
          className="w-full min-w-[140px] sm:w-auto rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        />
        <span className="text-sm text-white/60 shrink-0">Level:</span>
        <select
          value={filterLevel ?? ""}
          onChange={(e) =>
            setFilterLevelInUrl(
              (e.target.value || undefined) as ElectricalQualificationLevel | undefined
            )
          }
          data-testid="worker-qualifications-filter-level"
          className="w-full sm:w-auto rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 min-h-[44px]"
          aria-label="Filter by qualification level"
        >
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {QUALIFICATION_LABELS[l]}
            </option>
          ))}
        </select>
        <span className="text-sm text-white/60 shrink-0 hidden sm:inline">Certification:</span>
        <select
          value={filterCertTypeId}
          onChange={(e) => setFilterCertTypeInUrl(e.target.value)}
          data-testid="worker-qualifications-filter-cert"
          className="w-full sm:w-auto rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 min-h-[44px]"
          aria-label="Filter by certification type"
        >
          <option value="">All certifications</option>
          {(certTypes ?? []).map((ct) => (
            <option key={ct.id} value={ct.id}>
              {ct.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-white/60 shrink-0 hidden sm:inline">Compliance:</span>
        <select
          value={filterCompliance}
          onChange={(e) => setFilterComplianceInUrl(e.target.value)}
          data-testid="worker-qualifications-filter-compliance"
          className="w-full sm:w-auto rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 min-h-[44px]"
          aria-label="Filter by compliance status"
        >
          <option value="">All</option>
          <option value="compliant">Compliant</option>
          <option value="expiring_soon">Expiring soon</option>
          <option value="non_compliant">Non-compliant</option>
        </select>
      </div>

      {error && (
        <div
          role="alert"
          className={`px-4 py-3 text-sm text-red-300 ${glass.danger}`}
          data-testid="worker-qualifications-error"
        >
          {(error as Error)?.message ?? "Failed to load workers."}
        </div>
      )}

      {isLoading ? (
        <div data-testid="worker-qualifications-skeleton">
          <TableSkeleton rows={10} columns={5} />
        </div>
      ) : !sortedWorkers.length && !error ? (
        <div
          className={`px-6 py-12 text-center text-white/60 ${glass.subtle}`}
          data-testid="worker-qualifications-empty"
        >
          <p className="text-sm">No workers match the current filter.</p>
          <p className="mt-1 text-xs">
            Change the filter or ensure users exist in the system.
          </p>
        </div>
      ) : (
        <>
          <div
            className={`hidden overflow-hidden sm:block ${glass.card}`}
            data-testid="worker-qualifications-table"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="w-9 px-2 py-3" aria-label="Expand" />
                    {([
                      ["name", "Name"],
                      ["role", "Role"],
                      ["level", "Electrical Qualification"],
                      ["date", "Qualification Date"],
                    ] as const).map(([field, label]) => (
                      <th key={field} className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort(field)}
                          className="inline-flex items-center gap-1 font-semibold text-white/80 hover:text-white"
                          aria-label={`Sort by ${label}`}
                        >
                          {label}
                          {sortField === field ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 text-white/30" aria-hidden />
                          )}
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold text-white/80">
                      Verified By
                    </th>
                    <th className="px-4 py-3 font-semibold text-white/80">
                      Certifications
                    </th>
                    <th className="w-16 px-2 py-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedWorkers.map((w) => (
                    <Fragment key={w.user_id}>
                      <tr className="border-b border-white/5">
                        <td className="w-9 px-2 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedUserId((prev) =>
                                prev === w.user_id ? null : w.user_id
                              )
                            }
                            aria-expanded={expandedUserId === w.user_id}
                            aria-label={
                              expandedUserId === w.user_id
                                ? "Collapse history"
                                : "Expand history"
                            }
                            className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
                          >
                            {expandedUserId === w.user_id ? (
                              <ChevronDown className="h-4 w-4" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-white">
                          {w.full_name ?? "—"}
                        </td>
                      <td className="px-4 py-3 text-white/70">
                        {w.role ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <QualificationBadge level={w.electrical_qualification_level} />
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {w.electrical_qualification_date ?? "—"}
                      </td>
                        <td className="px-4 py-3 text-white/70">
                          {w.verified_by_name ?? (w.electrical_qualification_verified_by ? "Unknown" : "—")}
                        </td>
                        <td className="px-4 py-3">
                          <WorkerCertsSummaryCell
                            internalActiveCount={internalCertCountMap.get(w.user_id) ?? 0}
                            internalTotal={certTypes?.length ?? 0}
                            externalActiveCount={extCertCountMap.get(w.user_id)?.active ?? 0}
                            externalExpiringCount={extCertCountMap.get(w.user_id)?.expiring ?? 0}
                            externalExpiredCount={extCertCountMap.get(w.user_id)?.expired ?? 0}
                            onExpandClick={() =>
                              setExpandedUserId((prev) =>
                                prev === w.user_id ? null : w.user_id
                              )
                            }
                          />
                        </td>
                        <td className="w-16 px-2 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setCertModal({
                                mode: "assign",
                                workerId: w.user_id,
                                workerName: w.full_name ?? "Worker",
                              })
                            }
                            aria-label={`Assign external cert to ${w.full_name ?? "worker"}`}
                            className="rounded p-1.5 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-300 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                      {expandedUserId === w.user_id && (
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={TABLE_COLUMNS} className="px-4 py-3 align-top">
                            <div className="space-y-4">
                              <div>
                                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/50">
                                  Electrical Qualification History
                                </h4>
                                <HistoryCell userId={w.user_id} />
                              </div>
                              <div>
                                <WorkerInternalCertsList
                                  userId={w.user_id}
                                  workerName={w.full_name ?? "Worker"}
                                  rightAction={
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setGrantAccessModal({
                                          workerId: w.user_id,
                                          workerName: w.full_name ?? "Worker",
                                        })
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 min-h-[44px] sm:min-h-0"
                                      data-testid="worker-grant-cert-access"
                                    >
                                      <UserPlus className="h-3.5 w-3.5" aria-hidden />
                                      Grant certification access
                                    </button>
                                  }
                                />
                              </div>
                              <div>
                                <WorkerCertificationsCard
                                  userId={w.user_id}
                                  workerName={w.full_name ?? "Worker"}
                                  onAssign={() =>
                                    setCertModal({
                                      mode: "assign",
                                      workerId: w.user_id,
                                      workerName: w.full_name ?? "Worker",
                                    })
                                  }
                                  onEdit={(cert) =>
                                    setCertModal({
                                      mode: "edit",
                                      workerId: w.user_id,
                                      workerName: w.full_name ?? "Worker",
                                      existingCert: cert,
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div
            className="space-y-3 sm:hidden"
            data-testid="worker-qualifications-cards"
          >
            {paginatedWorkers.map((w) => (
              <div
                key={w.user_id}
                className={`p-4 ${glass.card}`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedUserId((prev) =>
                        prev === w.user_id ? null : w.user_id
                      )
                    }
                    aria-expanded={expandedUserId === w.user_id}
                    aria-label={
                      expandedUserId === w.user_id
                        ? "Collapse history"
                        : "Expand history"
                    }
                    className="mt-0.5 shrink-0 rounded p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                  >
                    {expandedUserId === w.user_id ? (
                      <ChevronDown className="h-4 w-4" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">
                      {w.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-white/60">{w.role ?? "—"}</p>
                    <p className="mt-1 text-xs text-white/50">
                      Certifications: {internalCertCountMap.get(w.user_id) ?? 0} internal · {(extCertCountMap.get(w.user_id)?.active ?? 0) + (extCertCountMap.get(w.user_id)?.expiring ?? 0) + (extCertCountMap.get(w.user_id)?.expired ?? 0)} external
                    </p>
                    <div className="mt-2">
                      <QualificationBadge level={w.electrical_qualification_level} />
                    </div>
                    <p className="mt-2 text-xs text-white/50">
                      Date: {w.electrical_qualification_date ?? "—"} ·{" "}
                      {w.verified_by_name
                        ? `Verified by ${w.verified_by_name}`
                        : w.electrical_qualification_verified_by
                          ? "Verified"
                          : "Not verified"}
                    </p>
                  </div>
                </div>
                {expandedUserId === w.user_id && (
                  <div className="mt-3 space-y-4 border-t border-white/10 pt-3">
                    <div>
                      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/50">
                        Electrical History
                      </h4>
                      <HistoryCell userId={w.user_id} />
                    </div>
                    <WorkerInternalCertsList
                      userId={w.user_id}
                      workerName={w.full_name ?? "Worker"}
                      rightAction={
                        <button
                          type="button"
                          onClick={() =>
                            setGrantAccessModal({
                              workerId: w.user_id,
                              workerName: w.full_name ?? "Worker",
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50 min-h-[44px]"
                          data-testid="worker-grant-cert-access-mobile"
                        >
                          <UserPlus className="h-3.5 w-3.5" aria-hidden />
                          Grant certification access
                        </button>
                      }
                    />
                    <WorkerCertificationsCard
                      userId={w.user_id}
                      workerName={w.full_name ?? "Worker"}
                      onAssign={() =>
                        setCertModal({
                          mode: "assign",
                          workerId: w.user_id,
                          workerName: w.full_name ?? "Worker",
                        })
                      }
                      onEdit={(cert) =>
                        setCertModal({
                          mode: "edit",
                          workerId: w.user_id,
                          workerName: w.full_name ?? "Worker",
                          existingCert: cert,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-white/60">
                {sortedWorkers.length} worker{sortedWorkers.length === 1 ? "" : "s"} · page {safePage} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                  aria-label="Previous page"
                  data-testid="worker-qualifications-prev-page"
                  className="rounded-lg border border-white/10 p-2 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                  aria-label="Next page"
                  data-testid="worker-qualifications-next-page"
                  className="rounded-lg border border-white/10 p-2 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {certModal &&
        createPortal(
          <ExternalCertModal
            mode={certModal.mode}
            workerId={certModal.workerId}
            workerName={certModal.workerName}
            existingCert={certModal.existingCert}
            onClose={() => setCertModal(null)}
          />,
          document.body
        )}

      {grantAccessModal &&
        createPortal(
          <GrantCertAccessModal
            workerId={grantAccessModal.workerId}
            workerName={grantAccessModal.workerName}
            onClose={() => setGrantAccessModal(null)}
          />,
          document.body
        )}

      <section className="mt-6">
        <CertificationAuditLogPanel />
      </section>
    </div>
  );
}
