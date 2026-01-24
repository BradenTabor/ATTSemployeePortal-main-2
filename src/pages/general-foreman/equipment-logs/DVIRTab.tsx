import { useMemo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Truck,
  Wrench,
  Search,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
  Images,
  FileSignature,
  ListChecks,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import TableSkeleton from "../../../components/skeletons/TableSkeleton";
import CardListSkeleton from "../../../components/skeletons/CardListSkeleton";
import { AdvancedPagination } from "../../../components/ui/AdvancedPagination";
import { DateRangeChips } from "../../../components/ui/QuickFilterChips";
import type { DVIRReport } from "./types";
import { VEHICLE_TRAILER_ITEMS, AERIAL_LIFT_ITEMS } from "./types";
import { getFailedDVIRItems, getDVIRStatus, hasMechanicUpdate, formatDateTime } from "./helpers";
import { ScrollRevealSection } from "./animations";
import { listItemVariants, listItemVariantsReduced, detailTransition, detailTransitionReduced } from "../../../lib/animationVariants";

interface DVIRTabProps {
  reports: DVIRReport[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  search: string;
  onSearchChange: (value: string) => void;
  status: "failed" | "passed";
  onStatusChange: (status: "failed" | "passed") => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalCount: number;
  showFilters: boolean;
  onRefresh: () => void;
  enableAnimations: boolean;
}

export function DVIRTab({
  reports,
  loading,
  error,
  selectedId,
  onSelectId,
  search,
  onSearchChange,
  status,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalCount,
  showFilters,
  onRefresh,
  enableAnimations: _enableAnimations,
}: DVIRTabProps) {
  // Note: _enableAnimations passed from parent but we use useReducedMotion() for consistency
  void _enableAnimations;
  const prefersReducedMotion = useReducedMotion();

  // Storage helper
  const getDvirPublicUrl = useCallback((path?: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("dvir-photos").getPublicUrl(path);
    return data.publicUrl ?? null;
  }, []);

  const isStoragePath = useCallback((s: string) => /[/\\]/.test(s) || /\.(png|jpe?g|webp)$/i.test(s), []);

  // Filtered data
  const filteredReports = useMemo(() => {
    let filtered = reports;
    if (status === "failed") {
      filtered = filtered.filter((r) => getDVIRStatus(r) === "failed");
    } else {
      filtered = filtered.filter((r) => getDVIRStatus(r) === "passed");
    }
    return filtered;
  }, [reports, status]);

  const failedCount = useMemo(() => reports.filter((r) => getDVIRStatus(r) === "failed").length, [reports]);
  const passedCount = useMemo(() => reports.filter((r) => getDVIRStatus(r) === "passed").length, [reports]);

  const selectedDvir = useMemo(() => reports.find((r) => r.id === selectedId) || null, [reports, selectedId]);

  // Media entries
  const mediaEntries = useMemo(() => {
    if (!selectedDvir) return [];
    const base = [
      { label: "Oil Dipstick", path: selectedDvir.oil_dipstick_path },
      { label: "Tire Photo", path: selectedDvir.tire_photo_path },
      { label: "Coolant Photo", path: selectedDvir.coolant_photo_path },
      { label: "Damage Photo", path: selectedDvir.damage_photo_path },
      { label: "Detail / Clean Truck", path: selectedDvir.detail_clean_truck_photo_path },
    ];
    return base.filter((e) => e.path).map((e) => {
      const url = getDvirPublicUrl(e.path);
      return url ? { label: e.label, url } : null;
    }).filter((e): e is { label: string; url: string } => Boolean(e));
  }, [selectedDvir, getDvirPublicUrl]);

  const signatureEntries = useMemo(() => {
    if (!selectedDvir) return [];
    const base = [
      { label: "Final Driver", path: selectedDvir.final_driver_signature },
      { label: "General Foreman", path: selectedDvir.general_foreman_signature },
      { label: "Mechanic", path: selectedDvir.mechanic_signature },
      { label: "Driver Approval", path: selectedDvir.driver_approval_signature },
    ];
    const out: { label: string; url?: string; text?: string }[] = [];
    for (const e of base) {
      const path = e.path?.trim();
      if (!path) continue;
      if (isStoragePath(path)) {
        const url = getDvirPublicUrl(path);
        if (url) out.push({ label: e.label, url });
      } else {
        out.push({ label: e.label, text: path });
      }
    }
    return out;
  }, [selectedDvir, getDvirPublicUrl, isStoragePath]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Filter Bar - compressed, mobile-optimized */}
      <ScrollRevealSection delay={0}>
        <div
          role="search"
          aria-label="Filter DVIR reports"
          className="rounded-xl sm:rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 via-purple-950/50 to-black/70 p-3 sm:p-4 shadow-lg shadow-purple-500/10"
        >
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="flex gap-1 p-1 bg-black/40 rounded-lg sm:rounded-xl border border-purple-500/10" role="group" aria-label="Status filter">
                {[
                  { id: "failed" as const, label: "Need Review", icon: AlertTriangle, count: failedCount, activeColor: "from-rose-500 to-red-500 shadow-rose-500/30", iconColor: "text-rose-400" },
                  { id: "passed" as const, label: "Passed", icon: CheckCircle2, count: passedCount, activeColor: "from-purple-500 to-violet-500 shadow-purple-500/30", iconColor: "text-purple-400" },
                ].map(({ id, label, icon: Icon, count, activeColor, iconColor }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { onStatusChange(id); onPageChange(1); }}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80 min-h-[44px] ${
                      status === id
                        ? `bg-gradient-to-r ${activeColor} text-white shadow-lg`
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                    aria-pressed={status === id}
                  >
                    <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${status === id ? "text-white" : iconColor}`} aria-hidden />
                    <span className="hidden sm:inline">{label}</span>
                    <span className={`px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold tabular-nums ${status === id ? "bg-white/25" : "bg-white/10"}`}>{count}</span>
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400/50 pointer-events-none" aria-hidden />
                <input
                  type="search"
                  placeholder="Search truck # or driver name…"
                  value={search}
                  onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
                  className="w-full bg-black/40 border border-purple-500/20 rounded-lg sm:rounded-xl pl-9 sm:pl-10 pr-9 sm:pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/40 transition-colors min-h-[44px]"
                  aria-label="Search by truck number or driver name"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { onSearchChange(""); onPageChange(1); }}
                    className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 rounded-md sm:rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Refresh data"
                aria-label="Refresh DVIR reports"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              </button>
            </div>
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 sm:pt-4 border-t border-purple-500/10 flex flex-col sm:flex-row gap-2 sm:gap-3 items-start sm:items-center">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400/60" aria-hidden />
                      <span className="text-[11px] sm:text-xs text-white/50">Date range</span>
                    </div>
                    <DateRangeChips
                      activeRange={dateRange}
                      onRangeChange={(range) => { onDateRangeChange(range); onPageChange(1); }}
                      variant="purple"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </ScrollRevealSection>

      {/* Content */}
      <ScrollRevealSection delay={0.1}>
        {loading && (
          <div className="space-y-3">
            <div className="hidden lg:block"><TableSkeleton rows={5} columns={4} variant="purple" /></div>
            <div className="lg:hidden"><CardListSkeleton rows={4} variant="purple" /></div>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </div>
        )}
        {!loading && !error && (
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
            {/* List Panel - compressed, mobile-optimized */}
            <div className="rounded-xl sm:rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-900/50 via-purple-950/60 to-black/80 overflow-hidden flex flex-col shadow-lg sm:shadow-xl shadow-purple-500/10 min-h-0">
              <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-gradient-to-r from-purple-700/60 via-purple-800/50 to-violet-900/50 border-b border-purple-500/20 flex-shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 ${status === "failed" ? "bg-rose-400" : "bg-purple-300"}`} aria-hidden />
                  <span className="text-xs sm:text-sm font-bold text-white">{status === "failed" ? "Need Review" : "Passed"}</span>
                  <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold bg-white/15 text-white tabular-nums">{filteredReports.length}</span>
                </div>
              </div>
              <div className="max-h-[220px] xs:max-h-[260px] sm:max-h-[320px] lg:max-h-[400px] overflow-y-auto flex-1 scroll-container min-h-0">
                {filteredReports.length === 0 ? (
                  <div className="p-5 sm:p-6 text-center">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 rounded-lg sm:rounded-xl bg-purple-600/20 border border-purple-400/20 flex items-center justify-center" aria-hidden>
                      <CheckCircle2 className="w-5 h-5 sm:w-7 sm:h-7 text-purple-300" />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white/80 mb-0.5 sm:mb-1">
                      {search ? "No matches found" : status === "failed" ? "All clear!" : "No records"}
                    </p>
                    <p className="text-[11px] sm:text-xs text-purple-200/50">
                      {search ? "Try a different search term" : status === "failed" ? "No DVIRs need review" : "No passed DVIRs yet"}
                    </p>
                  </div>
                ) : (
                  filteredReports.map((report, index) => {
                    const { allFails } = getFailedDVIRItems(report);
                    const reportStatus = getDVIRStatus(report);
                    const mechanicFlag = hasMechanicUpdate(report);
                    const isSelected = report.id === selectedId;
                    return (
                      <motion.button
                        key={report.id}
                        type="button"
                        custom={index}
                        variants={prefersReducedMotion ? listItemVariantsReduced : listItemVariants}
                        initial="hidden"
                        animate="visible"
                        onClick={() => onSelectId(isSelected ? null : report.id)}
                        className={`w-full text-left px-3 py-2.5 sm:px-4 sm:py-3 transition-colors duration-150 flex items-center gap-2 sm:gap-3 border-b border-purple-500/10 last:border-b-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-inset min-h-[44px] sm:min-h-[48px] touch-target ${
                          isSelected
                            ? "bg-purple-600/20 border-l-4 border-l-purple-400"
                            : "border-l-4 border-l-transparent hover:bg-purple-500/10 hover:border-l-purple-500/30"
                        }`}
                        aria-pressed={isSelected}
                        aria-label={`${report.truck_number || "N/A"}, ${report.drivers_name || "Unknown"}. ${reportStatus === "failed" ? "Needs review" : "Passed"}. Select to view details.`}
                      >
                        <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 ${reportStatus === "failed" ? "bg-rose-400" : "bg-purple-400"}`} aria-hidden />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="font-semibold text-xs sm:text-sm text-white truncate">{report.truck_number || "N/A"}</span>
                            {mechanicFlag && (
                              <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 sm:px-2 sm:py-0.5 bg-emerald-500/25 border border-emerald-400/30 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-semibold text-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" aria-hidden /> Fixed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                            <span className="text-[11px] sm:text-xs text-purple-100/70 truncate">{report.drivers_name || "Unknown"}</span>
                            <span className="text-purple-300/30 shrink-0" aria-hidden>•</span>
                            <span className="text-[10px] sm:text-xs text-purple-200/50 truncate">{formatDateTime(report.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          {allFails.length > 0 && (
                            <span className="text-[10px] sm:text-xs font-bold text-white bg-rose-500/80 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md sm:rounded-lg tabular-nums">
                              {allFails.length}
                            </span>
                          )}
                          <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 transition-transform duration-200 ${isSelected ? "text-purple-300 rotate-90" : "text-purple-400/40"}`} aria-hidden />
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>
              {totalCount > 0 && (
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t border-purple-500/10 bg-black/20 flex-shrink-0">
                  <AdvancedPagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalCount}
                    pageSize={pageSize}
                    onPageChange={onPageChange}
                    onPageSizeChange={(size) => { onPageSizeChange(size); onPageChange(1); }}
                    pageSizeOptions={[10, 15, 25, 50]}
                    variant="purple"
                    compact
                  />
                </div>
              )}
            </div>

            {/* Detail Panel - compressed, mobile-optimized */}
            <div className="lg:col-span-2 min-w-0">
              <AnimatePresence mode="wait">
                {!selectedDvir ? (
                  <motion.div 
                    key="empty-state" 
                    {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} 
                    className="h-full min-h-[200px] sm:min-h-[260px] rounded-xl sm:rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 via-purple-950/50 to-black/70 p-5 sm:p-8 flex flex-col items-center justify-center text-center shadow-lg sm:shadow-xl shadow-purple-500/10"
                  >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl bg-purple-600/30 border border-purple-400/30 flex items-center justify-center mb-4 sm:mb-6" aria-hidden>
                      <ListChecks className="w-6 h-6 sm:w-8 sm:h-8 text-purple-300" />
                    </div>
                    <p className="text-base sm:text-lg font-bold text-white mb-0.5 sm:mb-1">Select a DVIR</p>
                    <p className="text-xs sm:text-sm text-purple-200/60">Choose a report from the list to view details</p>
                  </motion.div>
                ) : (
                  <motion.div key={selectedId} {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} className="space-y-3 sm:space-y-4">
                    <div className="rounded-xl sm:rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/50 via-purple-950/60 to-black/80 overflow-hidden shadow-lg sm:shadow-xl shadow-purple-500/10">
                      <div className="bg-gradient-to-r from-purple-700/60 via-violet-700/50 to-purple-800/50 border-b border-purple-400/20 px-3 py-3 sm:px-5 sm:py-4">
                        <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 sm:gap-4">
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/40 border border-purple-400/30 flex items-center justify-center flex-shrink-0" aria-hidden>
                              <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-purple-100" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base sm:text-lg font-bold text-white truncate">Truck {selectedDvir.truck_number || "N/A"}</h3>
                              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-purple-100/80 mt-0.5 flex-wrap">
                                <span className="truncate font-medium">{selectedDvir.drivers_name || "Unknown"}</span>
                                <span className="text-purple-300/40 shrink-0" aria-hidden>•</span>
                                <span className="font-semibold tabular-nums">{selectedDvir.mileage?.toLocaleString() || "—"} mi</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap">
                            {hasMechanicUpdate(selectedDvir) && (
                              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-emerald-500/25 border border-emerald-400/40 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold text-emerald-100">
                                <Wrench className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" aria-hidden /> Fixed
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold ${getDVIRStatus(selectedDvir) === "failed" ? "bg-rose-500/80 text-white" : "bg-purple-500/80 text-white"}`}>
                              {getDVIRStatus(selectedDvir) === "failed" ? <><AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" aria-hidden /> Needs Review</> : <><CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" aria-hidden /> Passed</>}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="px-3 py-3 sm:px-5 sm:py-4 space-y-3 sm:space-y-4">
                        {(() => {
                          const { vehicleFails, aerialFails, allFails } = getFailedDVIRItems(selectedDvir);
                          if (allFails.length === 0) {
                            return (
                              <div className="rounded-lg sm:rounded-xl border border-emerald-500/40 bg-emerald-600/15 px-3 py-3 sm:px-4 sm:py-4 flex items-center gap-2 sm:gap-3">
                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 flex-shrink-0" aria-hidden />
                                <span className="text-xs sm:text-sm font-semibold text-emerald-200">All items passed inspection</span>
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-3 sm:space-y-4">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400 flex-shrink-0" aria-hidden />
                                <span className="text-xs sm:text-sm font-bold text-rose-300">{allFails.length} Failed item{allFails.length !== 1 ? "s" : ""}</span>
                              </div>
                              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                                {vehicleFails.length > 0 && (
                                  <div className="rounded-lg sm:rounded-xl border border-rose-500/30 bg-rose-600/10 p-3 sm:p-4 max-h-28 sm:max-h-36 overflow-y-auto">
                                    <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-200/90 mb-2">Vehicle / Trailer</div>
                                    <ul className="space-y-1.5 sm:space-y-2">{vehicleFails.map((label) => (
                                      <li key={label} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-rose-100/90">
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-rose-400 rounded-full mt-1.5 flex-shrink-0" aria-hidden />
                                        {label}
                                      </li>
                                    ))}</ul>
                                  </div>
                                )}
                                {aerialFails.length > 0 && (
                                  <div className="rounded-lg sm:rounded-xl border border-amber-500/30 bg-amber-600/10 p-3 sm:p-4 max-h-28 sm:max-h-36 overflow-y-auto">
                                    <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-200/90 mb-2">Aerial Lift</div>
                                    <ul className="space-y-1.5 sm:space-y-2">{aerialFails.map((label) => (
                                      <li key={label} className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-amber-100/90">
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0" aria-hidden />
                                        {label}
                                      </li>
                                    ))}</ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                          <div className="rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-800/20 p-3 sm:p-4">
                            <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-purple-200/70 mb-1.5 sm:mb-2">Driver notes</div>
                            <p className="text-xs sm:text-sm text-white/80 line-clamp-2">{selectedDvir.notes?.trim() || "No notes"}</p>
                          </div>
                          <div className="rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-800/20 p-3 sm:p-4">
                            <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-purple-200/70 mb-1.5 sm:mb-2">Vehicle info</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:gap-x-4 sm:gap-y-1 text-xs sm:text-sm text-white/70">
                              <span>Chipper: <span className="font-semibold text-white/90">{selectedDvir.chipper_number || "—"}</span></span>
                              <span>Trailer: <span className="font-semibold text-white/90">{selectedDvir.trailer_number || "—"}</span></span>
                            </div>
                          </div>
                        </div>
                        {hasMechanicUpdate(selectedDvir) && (
                          <div className="rounded-lg sm:rounded-xl border border-emerald-500/40 bg-emerald-700/20 p-3 sm:p-5">
                            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-200 mb-2 sm:mb-3">
                              <Wrench className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" aria-hidden /> Mechanic fix
                            </div>
                            <p className="text-xs sm:text-sm text-white/90 font-medium">{selectedDvir.deficiency_corrected || "—"}</p>
                            {selectedDvir.mechanic_remarks && <p className="text-xs sm:text-sm text-emerald-100/70 mt-2 sm:mt-3">Remarks: {selectedDvir.mechanic_remarks}</p>}
                            {selectedDvir.mechanic_date && <p className="text-[10px] sm:text-xs text-emerald-200/50 mt-1.5 sm:mt-2">Date: {selectedDvir.mechanic_date}</p>}
                          </div>
                        )}
                        <details className="group rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-900/20 overflow-hidden focus-within:ring-2 focus-within:ring-purple-400 focus-within:ring-offset-2 focus-within:ring-offset-purple-950/80">
                          <summary className="flex items-center justify-between cursor-pointer px-3 py-2.5 sm:px-4 sm:py-3.5 text-xs sm:text-sm font-semibold text-white/90 hover:text-white hover:bg-purple-500/10 transition-colors list-none [&::-webkit-details-marker]:hidden touch-target">
                            <span className="flex items-center gap-1.5 sm:gap-2 min-w-0"><ListChecks className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300 shrink-0" aria-hidden /> <span className="truncate">Full checklist review</span></span>
                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform duration-200 group-open:rotate-90 text-purple-400" aria-hidden />
                          </summary>
                          <div className="grid gap-2 sm:gap-3 md:gap-4 sm:grid-cols-2 p-2.5 sm:p-3 md:p-4 border-t border-purple-500/20 bg-black/20">
                            <div className="rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-950/30 p-2.5 sm:p-3 md:p-4 min-w-0">
                              <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-purple-200/70 mb-1.5 sm:mb-2 md:mb-3">Vehicle / Trailer</div>
                              <div className="max-h-24 xs:max-h-28 sm:max-h-32 md:max-h-40 overflow-y-auto space-y-0.5 sm:space-y-1 md:space-y-1.5 scroll-container">
                                {VEHICLE_TRAILER_ITEMS.map((item) => {
                                  const value = selectedDvir.vehicle_trailer_checklist?.[item.id];
                                  const itemStatus = value === "P" ? "pass" : value === "F" ? "fail" : value === "N/A" ? "na" : "pending";
                                  return (
                                    <div key={item.id} className="flex items-center justify-between py-1 sm:py-1.5 md:py-2 text-[11px] sm:text-xs md:text-sm text-white/70 gap-2 border-b border-purple-500/10 last:border-0">
                                      <span className="truncate">{item.label}</span>
                                      <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0 ${itemStatus === "pass" ? "bg-emerald-400" : itemStatus === "fail" ? "bg-rose-400" : itemStatus === "na" ? "bg-amber-400" : "bg-white/20"}`} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-950/30 p-2.5 sm:p-3 md:p-4 min-w-0">
                              <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-purple-200/70 mb-1.5 sm:mb-2 md:mb-3">Aerial Lift</div>
                              <div className="max-h-24 xs:max-h-28 sm:max-h-32 md:max-h-40 overflow-y-auto space-y-0.5 sm:space-y-1 md:space-y-1.5 scroll-container">
                                {AERIAL_LIFT_ITEMS.map((item) => {
                                  const value = selectedDvir.aerial_checklist?.[item.id];
                                  const itemStatus = value === "P" ? "pass" : value === "F" ? "fail" : value === "N/A" ? "na" : "pending";
                                  return (
                                    <div key={item.id} className="flex items-center justify-between py-1 sm:py-1.5 md:py-2 text-[11px] sm:text-xs md:text-sm text-white/70 gap-2 border-b border-purple-500/10 last:border-0">
                                      <span className="truncate">{item.label}</span>
                                      <span className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0 ${itemStatus === "pass" ? "bg-emerald-400" : itemStatus === "fail" ? "bg-rose-400" : itemStatus === "na" ? "bg-amber-400" : "bg-white/20"}`} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </details>
                        <details className="group rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-900/20 overflow-hidden focus-within:ring-2 focus-within:ring-purple-400 focus-within:ring-offset-2 focus-within:ring-offset-purple-950/80">
                          <summary className="flex items-center justify-between cursor-pointer px-3 py-2.5 sm:px-4 sm:py-3.5 text-xs sm:text-sm font-semibold text-white/90 hover:text-white hover:bg-purple-500/10 transition-colors list-none [&::-webkit-details-marker]:hidden touch-target">
                            <span className="flex items-center gap-1.5 sm:gap-2 min-w-0"><Images className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300 shrink-0" aria-hidden /> <span className="truncate">Photos ({mediaEntries.length})</span></span>
                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform duration-200 group-open:rotate-90 text-purple-400" aria-hidden />
                          </summary>
                          <div className="p-3 sm:p-4 border-t border-purple-500/20 bg-black/20">
                            {mediaEntries.length === 0 ? <p className="text-xs sm:text-sm text-purple-200/50">No photos uploaded</p> : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                                {mediaEntries.map((media) => (
                                  <a key={media.label} href={media.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-950/30 overflow-hidden transition-colors hover:border-purple-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-purple-950/80">
                                    <img src={media.url} alt={media.label} className="h-16 sm:h-20 lg:h-24 w-full object-cover" />
                                    <div className="px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs text-purple-200/70 truncate font-medium">{media.label}</div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                        <details className="group rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-900/20 overflow-hidden focus-within:ring-2 focus-within:ring-purple-400 focus-within:ring-offset-2 focus-within:ring-offset-purple-950/80">
                          <summary className="flex items-center justify-between cursor-pointer px-3 py-2.5 sm:px-4 sm:py-3.5 text-xs sm:text-sm font-semibold text-white/90 hover:text-white hover:bg-purple-500/10 transition-colors list-none [&::-webkit-details-marker]:hidden touch-target">
                            <span className="flex items-center gap-1.5 sm:gap-2 min-w-0"><FileSignature className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300 shrink-0" aria-hidden /> <span className="truncate">Signatures ({signatureEntries.length})</span></span>
                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform duration-200 group-open:rotate-90 text-purple-400" aria-hidden />
                          </summary>
                          <div className="p-3 sm:p-4 border-t border-purple-500/20 bg-black/20">
                            {signatureEntries.length === 0 ? <p className="text-xs sm:text-sm text-purple-200/50">No signatures</p> : (
                              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                {signatureEntries.map((sig) =>
                                  "url" in sig && sig.url ? (
                                    <a key={sig.label} href={sig.url} target="_blank" rel="noopener noreferrer" className="rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-950/30 p-2 sm:p-3 transition-colors hover:border-purple-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-purple-950/80">
                                      <div className="text-[10px] sm:text-xs text-purple-200/70 mb-1 sm:mb-2 truncate font-semibold">{sig.label}</div>
                                      <img src={sig.url} alt={sig.label} className="h-14 sm:h-20 w-full object-contain" />
                                    </a>
                                  ) : (
                                    <div key={sig.label} className="rounded-lg sm:rounded-xl border border-purple-500/20 bg-purple-950/30 p-2 sm:p-3">
                                      <div className="text-[10px] sm:text-xs text-purple-200/70 mb-1 sm:mb-2 truncate font-semibold">{sig.label}</div>
                                      <p className="text-xs sm:text-sm text-white truncate">{sig.text ?? "—"}</p>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </ScrollRevealSection>
    </div>
  );
}
