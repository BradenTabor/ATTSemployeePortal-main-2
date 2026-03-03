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
import { toast } from "../../../lib/toast";
import { logger } from "../../../lib/logger";
import { ChevronDown, ChevronRight, Upload } from "lucide-react";
import TableSkeleton from "../../skeletons/TableSkeleton";
import { WorkerQualificationsImportModal } from "./WorkerQualificationsImportModal";
import { CertificationAuditLogPanel } from "./CertificationAuditLogPanel";
import { glass } from "../../../lib/glass";

const TABLE_COLUMNS = 6;

function levelLabel(level: string | null): string {
  if (!level) return "—";
  return QUALIFICATION_LABELS[level as ElectricalQualificationLevel] ?? level;
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

  const setSearch = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value.trim()) next.set("search", value.trim());
        else next.delete("search");
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
        return next;
      },
      { replace: true }
    );
  };

  const [optimisticLevels, setOptimisticLevels] = useState<
    Record<string, ElectricalQualificationLevel>
  >({});
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

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

  const updateQual = useUpdateQualification();

  const filteredWorkers = useMemo(() => {
    let list = workers;
    if (filterLevel) {
      list = list.filter((w) => w.electrical_qualification_level === filterLevel);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((w) =>
      (w.full_name ?? "").toLowerCase().includes(q)
    );
  }, [workers, filterLevel, search]);

  const displayLevel = (w: { user_id: string; electrical_qualification_level: ElectricalQualificationLevel }) =>
    optimisticLevels[w.user_id] ?? w.electrical_qualification_level;

  const handleChange = (
    userId: string,
    _previousLevel: ElectricalQualificationLevel,
    newLevel: ElectricalQualificationLevel
  ) => {
    if (!user?.id) {
      toast.error("You must be signed in to update qualifications.");
      return;
    }
    setOptimisticLevels((prev) => ({ ...prev, [userId]: newLevel }));
    updateQual.mutate(
      {
        userId,
        level: newLevel,
        adminAuthUserId: user.id,
      },
      {
        onSuccess: () => toast.success("Qualification updated."),
        onError: (e) => {
          logger.error("Failed to update qualification", { error: e, userId });
          setOptimisticLevels((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
          toast.error("Failed to update qualification.");
        },
        onSettled: () => {
          setOptimisticLevels((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
        },
      }
    );
  };

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
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
            data-testid="worker-qualifications-import-csv"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Import CSV
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

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          aria-label="Search workers by name"
          data-testid="worker-qualifications-search"
          className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
        />
        <span className="text-sm text-white/60">Level:</span>
        <select
          value={filterLevel ?? ""}
          onChange={(e) =>
            setFilterLevelInUrl(
              (e.target.value || undefined) as ElectricalQualificationLevel | undefined
            )
          }
          data-testid="worker-qualifications-filter-level"
          className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          aria-label="Filter by qualification level"
        >
          <option value="">All levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {QUALIFICATION_LABELS[l]}
            </option>
          ))}
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
      ) : !filteredWorkers.length && !error ? (
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
                    <th className="px-4 py-3 font-semibold text-white/80">
                      Name
                    </th>
                    <th className="px-4 py-3 font-semibold text-white/80">
                      Role
                    </th>
                    <th className="px-4 py-3 font-semibold text-white/80">
                      Electrical Qualification
                    </th>
                    <th className="px-4 py-3 font-semibold text-white/80">
                      Qualification Date
                    </th>
                    <th className="px-4 py-3 font-semibold text-white/80">
                      Verified By
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.map((w) => (
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
                        <select
                          value={displayLevel(w)}
                          onChange={(e) =>
                            handleChange(
                              w.user_id,
                              w.electrical_qualification_level,
                              e.target.value as ElectricalQualificationLevel
                            )
                          }
                          aria-label={`Update qualification for ${w.full_name ?? "worker"}`}
                          className="rounded border border-white/10 bg-gray-800 px-2 py-1 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                        >
                          {LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {QUALIFICATION_LABELS[l]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-white/70">
                        {w.electrical_qualification_date ?? "—"}
                      </td>
                        <td className="px-4 py-3 text-white/70">
                          {w.electrical_qualification_verified_by
                            ? "Recorded"
                            : "—"}
                        </td>
                      </tr>
                      {expandedUserId === w.user_id && (
                        <tr className="border-b border-white/5 bg-white/[0.02]">
                          <td colSpan={TABLE_COLUMNS} className="px-4 py-0 align-top">
                            <HistoryCell userId={w.user_id} />
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
            {filteredWorkers.map((w) => (
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
                    className="mt-0.5 shrink-0 rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
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
                    <div className="mt-3">
                      <span className="text-xs text-white/60">
                        Qualification:{" "}
                      </span>
                      <select
                        value={displayLevel(w)}
                        onChange={(e) =>
                          handleChange(
                            w.user_id,
                            w.electrical_qualification_level,
                            e.target.value as ElectricalQualificationLevel
                          )
                        }
                        aria-label={`Update qualification for ${w.full_name ?? "worker"}`}
                        className="mt-1 w-full rounded border border-white/10 bg-gray-800 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                      >
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {QUALIFICATION_LABELS[l]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-2 text-xs text-white/50">
                      Date: {w.electrical_qualification_date ?? "—"} ·{" "}
                      {w.electrical_qualification_verified_by
                        ? "Verified"
                        : "Not verified"}
                    </p>
                  </div>
                </div>
                {expandedUserId === w.user_id && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <HistoryCell userId={w.user_id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <section className="mt-6">
        <CertificationAuditLogPanel />
      </section>
    </div>
  );
}
