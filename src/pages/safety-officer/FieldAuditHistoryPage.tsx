/**
 * FieldAuditHistoryPage — browse, filter, and drill into past field audits (Chunk 6).
 *
 * The filtered list is modeled on the Admin JSA oversight query
 * (useFieldAuditHistory ≈ useAdminJSAQuery: conditional filters, count-exact
 * pagination, read-time rollups), not the lighter HistoryPageShell. Filters:
 * date range, equipment type, person, and "open findings only". A row opens the
 * read-only FieldAuditDetailModal, from which each subject's timeline (findings
 * interleaved with field_notes) is one click away.
 */

import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  History,
  Loader2,
  MapPin,
  User,
  Users,
  Wrench,
  X,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { glass } from "../../lib/glass";
import { useAuth } from "../../contexts/AuthContext";
import {
  useFieldAuditHistory,
  type FieldAuditHistoryRow,
  type FieldAuditStatusFilter,
} from "../../hooks/fieldAudit";
import { useCrewMembers } from "../../hooks/jobs/useCrewMembers";
import { useCrews } from "../../hooks/useCrews";
import { useWorkSitesQuery } from "../../hooks/queries/useWorkSites";
import { FieldAuditDetailModal } from "./field-audit";
import {
  FIELD_AUDIT_EQUIPMENT_TYPES,
  type RollupCounts,
} from "./fieldAuditConstants";

const PAGE_SIZE = 20;

const INPUT_CLASS =
  "w-full rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5 text-sm text-white placeholder-white/30 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus:border-rose-400/40 transition-colors [color-scheme:dark]";
const LABEL_CLASS =
  "block text-[11px] font-semibold uppercase tracking-wide text-white/45 mb-1.5";

const STATUS_FILTERS: { value: FieldAuditStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "draft", label: "Drafts" },
];

function formatAuditDate(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function HistoryRollup({ rollup }: { rollup: RollupCounts }) {
  if (rollup.total === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase text-white/45 font-mono font-medium tracking-[0.14em]">
        No checks
      </span>
    );
  }
  if (rollup.fail > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
        <AlertTriangle className="w-3 h-3" aria-hidden />
        {rollup.fail} fail
        {rollup.openFail > 0 && <span className="text-rose-300/80">· {rollup.openFail} open</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
      <CheckCircle2 className="w-3 h-3" aria-hidden />
      All pass
    </span>
  );
}

function SubjectCounts({ row }: { row: FieldAuditHistoryRow }) {
  if (row.peopleCount === 0 && row.equipmentCount === 0) {
    return <span className="text-xs text-white/35">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs text-white/60">
      {row.peopleCount > 0 && (
        <span className="inline-flex items-center gap-1">
          <User className="w-3.5 h-3.5 text-rose-300/70" aria-hidden />
          {row.peopleCount}
        </span>
      )}
      {row.equipmentCount > 0 && (
        <span className="inline-flex items-center gap-1">
          <Wrench className="w-3.5 h-3.5 text-rose-300/70" aria-hidden />
          {row.equipmentCount}
        </span>
      )}
    </span>
  );
}

export default function FieldAuditHistoryPage() {
  const { user } = useAuth();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<FieldAuditStatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [personId, setPersonId] = useState("");
  const [openFailsOnly, setOpenFailsOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  // `?audit=<id>` deep link (submission receipt → "View in history") opens the
  // detail modal directly; closing it strips the param so back/refresh behave.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("audit"),
  );
  const closeDetail = useCallback(() => {
    setSelectedId(null);
    if (searchParams.has("audit")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("audit");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const { crewMembers } = useCrewMembers();
  const { crews } = useCrews();
  const { data: workSites = [] } = useWorkSitesQuery();

  const siteNameById = useMemo(
    () => new Map(workSites.map((s) => [s.id, s.name])),
    [workSites],
  );
  const crewNameById = useMemo(
    () => new Map(crews.map((c) => [c.id, c.name])),
    [crews],
  );
  const sortedPeople = useMemo(
    () =>
      [...crewMembers].sort((a, b) =>
        (a.full_name || a.email || "").localeCompare(b.full_name || b.email || ""),
      ),
    [crewMembers],
  );

  const { data, isLoading, isFetching, error } = useFieldAuditHistory(
    {
      page,
      pageSize: PAGE_SIZE,
      statusFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      equipmentType: equipmentType || undefined,
      personId: personId || undefined,
      openFailsOnly: openFailsOnly || undefined,
    },
    Boolean(user),
  );

  const records = useMemo(() => data?.records ?? [], [data?.records]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Reset to page 1 whenever a filter changes. Done as an adjust-state-during-
  // render (the React-recommended alternative to a setState-in-effect): when the
  // filter signature changes, snap back to the first page before paint.
  const filterSignature = `${statusFilter}|${dateFrom}|${dateTo}|${equipmentType}|${personId}|${openFailsOnly ? 1 : 0}`;
  const [appliedFilterSignature, setAppliedFilterSignature] = useState(filterSignature);
  if (appliedFilterSignature !== filterSignature) {
    setAppliedFilterSignature(filterSignature);
    setPage(1);
  }

  const hasActiveFilters =
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    Boolean(equipmentType) ||
    Boolean(personId) ||
    openFailsOnly ||
    statusFilter !== "all";

  const clearAllFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setEquipmentType("");
    setPersonId("");
    setOpenFailsOnly(false);
  };

  const locationLabel = (row: FieldAuditHistoryRow): string =>
    row.work_site_id
      ? siteNameById.get(row.work_site_id) ?? "Work site"
      : row.location_text || "—";
  const crewLabel = (row: FieldAuditHistoryRow): string =>
    row.crew_id ? crewNameById.get(row.crew_id) ?? "Crew" : row.crew_name || "—";

  return (
    <DashboardLayout title="Field Audit History">
      <div className="relative w-full max-w-5xl mx-auto px-3 sm:px-4 md:px-6 pb-12 pt-2 sm:pt-4">
        {/* Atmospheric rose glow (safety officer role) */}
        <div
          className="absolute inset-0 pointer-events-none select-none overflow-hidden rounded-leaf-sm"
          style={{ zIndex: -1 }}
          aria-hidden
        >
          <div
            className="absolute top-0 right-0 w-[min(100%,24rem)] h-64 rounded-full opacity-[0.07]"
            style={{
              background:
                "radial-gradient(circle, #fda4af 0%, #be123c 40%, transparent 70%)",
              filter: "blur(60px)",
              transform: "translate(20%, -20%)",
            }}
          />
        </div>

        <div className="relative z-10 space-y-5" data-testid="field-audit-history-page">
          {/* Header */}
          <header className={`${glass.cardRed} p-5 sm:p-6`}>
            <Link
              to="/safety-officer/field-audit"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-200/70 hover:text-rose-100 transition-colors mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 rounded-lg"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              Back to Field Audit
            </Link>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-leaf-sm bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0">
                <History className="w-6 h-6 text-rose-300" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="type-display font-light text-bone-50 text-[clamp(1.6rem,3.8vw,2.6rem)]">
                  Field Audit History
                </h1>
                <p className="text-sm text-white/60 mt-1">
                  Review past site-visit audits, filter by equipment, person, or
                  open findings, and drill into a subject&apos;s full timeline.
                </p>
              </div>
            </div>
          </header>

          {/* Filters */}
          <section className={`${glass.cardRed} overflow-hidden`}>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
            >
              <span className="inline-flex items-center gap-2 text-xs uppercase text-rose-200/80 font-mono font-medium tracking-[0.14em]">
                <Filter className="w-4 h-4" aria-hidden />
                Filters
              </span>
              {hasActiveFilters && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAllFilters();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      clearAllFilters();
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70 hover:text-white hover:border-rose-400/40 transition-all"
                >
                  <X className="w-3 h-3" aria-hidden />
                  Clear all
                </span>
              )}
            </button>

            <AnimatePresence initial={false}>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 sm:px-5 pb-4 pt-1 space-y-3 border-t border-white/[0.06]">
                    {/* Status segmented control */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      {STATUS_FILTERS.map((f) => {
                        const active = statusFilter === f.value;
                        return (
                          <button
                            key={f.value}
                            type="button"
                            onClick={() => setStatusFilter(f.value)}
                            className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0 ${
                              active
                                ? "bg-rose-600 text-white border border-rose-500/40"
                                : "bg-white/[0.03] border border-white/10 text-white/65 hover:text-white hover:border-rose-400/30"
                            }`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className={LABEL_CLASS} htmlFor="fa-hist-from">
                          From
                        </label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 text-rose-300/60 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" aria-hidden />
                          <input
                            id="fa-hist-from"
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            data-testid="field-audit-history-date-from"
                            className={`${INPUT_CLASS} pl-9`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={LABEL_CLASS} htmlFor="fa-hist-to">
                          To
                        </label>
                        <div className="relative">
                          <Calendar className="w-4 h-4 text-rose-300/60 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" aria-hidden />
                          <input
                            id="fa-hist-to"
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            data-testid="field-audit-history-date-to"
                            className={`${INPUT_CLASS} pl-9`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={LABEL_CLASS} htmlFor="fa-hist-equipment">
                          Equipment type
                        </label>
                        <select
                          id="fa-hist-equipment"
                          value={equipmentType}
                          onChange={(e) => setEquipmentType(e.target.value)}
                          data-testid="field-audit-history-equipment"
                          className={INPUT_CLASS}
                        >
                          <option value="">All equipment</option>
                          {FIELD_AUDIT_EQUIPMENT_TYPES.map((t) => (
                            <option key={t.token} value={t.token}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLASS} htmlFor="fa-hist-person">
                          Person
                        </label>
                        <select
                          id="fa-hist-person"
                          value={personId}
                          onChange={(e) => setPersonId(e.target.value)}
                          data-testid="field-audit-history-person"
                          className={INPUT_CLASS}
                        >
                          <option value="">All people</option>
                          {sortedPeople.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name || p.email || "Crew member"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={openFailsOnly}
                        onChange={(e) => setOpenFailsOnly(e.target.checked)}
                        data-testid="field-audit-history-open-fails"
                        className="h-4 w-4 rounded border-white/20 bg-white/[0.03] text-rose-500 focus:ring-rose-400/50 focus:ring-offset-0"
                      />
                      <span className="text-sm text-white/70">
                        Only audits with open findings (unescalated fails)
                      </span>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Results */}
          <section className={`${glass.cardRed} overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-white/[0.06]">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                <ClipboardList className="w-4 h-4 text-rose-300/80" aria-hidden />
                Audits
                <span className="text-[11px] font-mono tabular-nums text-white/40">
                  {total}
                </span>
              </span>
              {isFetching && !isLoading && (
                <Loader2 className="w-4 h-4 text-rose-300/70 animate-spin" aria-hidden />
              )}
            </div>

            {error ? (
              <div className="px-5 py-10 text-center text-sm text-rose-200">
                {error instanceof Error ? error.message : "Could not load audits."}
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-white/55">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Loading audits…
              </div>
            ) : records.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <ClipboardList className="w-10 h-10 text-rose-300/30 mx-auto mb-3" aria-hidden />
                <p className="text-sm text-white/70">No audits match your filters.</p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-3 text-rose-300 hover:text-rose-200 underline text-sm"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[0.65rem] uppercase text-rose-200/70 border-b border-white/[0.06] font-mono font-medium tracking-[0.14em]">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Crew</th>
                        <th className="px-4 py-3">Subjects</th>
                        <th className="px-4 py-3">Findings</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedId(row.id)}
                          data-testid="field-audit-history-row"
                          className="border-b border-white/[0.05] text-sm text-white/85 transition cursor-pointer hover:bg-white/[0.03]"
                        >
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            {formatAuditDate(row.audit_date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-rose-300/70 shrink-0" aria-hidden />
                              <span className="truncate max-w-[200px]">{locationLabel(row)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-white/70">
                            <span className="truncate block max-w-[140px]">{crewLabel(row)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <SubjectCounts row={row} />
                          </td>
                          <td className="px-4 py-3">
                            <HistoryRollup rollup={row.rollup} />
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                row.status === "draft"
                                  ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                                  : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                              }`}
                            >
                              {row.status === "draft" ? "Draft" : "Submitted"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-white/[0.05]">
                  {records.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      data-testid="field-audit-history-row"
                      className="w-full text-left px-4 py-3.5 hover:bg-white/[0.03] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50 focus-visible:ring-inset"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">
                          {formatAuditDate(row.audit_date)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            row.status === "draft"
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                              : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                          }`}
                        >
                          {row.status === "draft" ? "Draft" : "Submitted"}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-white/60">
                        <MapPin className="w-3.5 h-3.5 text-rose-300/70 shrink-0" aria-hidden />
                        <span className="truncate">{locationLabel(row)}</span>
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <SubjectCounts row={row} />
                        <HistoryRollup rollup={row.rollup} />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-white/[0.06]">
                  <span className="text-xs text-white/50">
                    <span className="text-rose-200 font-semibold">
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
                    </span>{" "}
                    of {total}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      aria-label="Previous page"
                      className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-rose-200 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden />
                    </button>
                    <span className="text-xs text-white/55 tabular-nums px-1">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      aria-label="Next page"
                      className="p-2 rounded-lg bg-white/[0.03] border border-white/10 text-rose-200 hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Quiet hint mirroring the dashboard's calm-state pattern */}
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-white/30">
            <Users className="w-3 h-3" aria-hidden />
            Open an audit to see each subject&apos;s findings and field-note history.
          </p>
        </div>

        {selectedId && (
          <FieldAuditDetailModal auditId={selectedId} onClose={closeDetail} />
        )}
      </div>
    </DashboardLayout>
  );
}
