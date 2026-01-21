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
import { ScrollRevealSection, listItemVariants, listItemVariantsReduced, detailTransition, detailTransitionReduced } from "./animations";

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
    return base.filter((e) => e.path).map((e) => {
      const url = getDvirPublicUrl(e.path);
      return url ? { label: e.label, url } : null;
    }).filter((e): e is { label: string; url: string } => Boolean(e));
  }, [selectedDvir, getDvirPublicUrl]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <ScrollRevealSection delay={0}>
        <motion.div 
          layout
          className="rounded-2xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-900/40 via-purple-950/50 to-black/70 p-4 shadow-xl shadow-purple-500/10"
        >
          <div className="flex flex-col gap-4">
            {/* Primary filters row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Status toggle */}
              <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-purple-500/10">
                {[
                  { id: "failed" as const, label: "Need Review", icon: AlertTriangle, count: failedCount, activeColor: "from-rose-500 to-red-500 shadow-rose-500/30", iconColor: "text-rose-400" },
                  { id: "passed" as const, label: "Passed", icon: CheckCircle2, count: passedCount, activeColor: "from-purple-500 to-violet-500 shadow-purple-500/30", iconColor: "text-purple-400" },
                ].map(({ id, label, icon: Icon, count, activeColor, iconColor }) => (
                  <motion.button
                    key={id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { onStatusChange(id); onPageChange(1); }}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                      status === id
                        ? `bg-gradient-to-r ${activeColor} text-white shadow-lg`
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${status === id ? "text-white" : iconColor}`} />
                    <span className="hidden sm:inline">{label}</span>
                    <motion.span 
                      key={count}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${status === id ? "bg-white/25" : "bg-white/10"}`}
                    >
                      {count}
                    </motion.span>
                  </motion.button>
                ))}
              </div>
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
                <input
                  type="text"
                  placeholder="Search truck # or driver name..."
                  value={search}
                  onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
                  className="w-full bg-black/40 border border-purple-500/20 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                />
                {search && (
                  <motion.button 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => { onSearchChange(""); onPageChange(1); }} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                )}
              </div>
              
              {/* Refresh button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onRefresh}
                disabled={loading}
                className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 disabled:opacity-50 transition-all"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </motion.button>
            </div>
            
            {/* Advanced filters row - collapsible */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 border-t border-purple-500/10 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400/60" />
                      <span className="text-xs text-white/50">Date Range:</span>
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
        </motion.div>
      </ScrollRevealSection>

      {/* Content */}
      <ScrollRevealSection delay={0.1}>
        {loading && (
          <div className="space-y-3">
            <div className="hidden lg:block"><TableSkeleton rows={5} columns={4} variant="purple" /></div>
            <div className="lg:hidden"><CardListSkeleton rows={4} variant="purple" /></div>
          </div>
        )}
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        {!loading && !error && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* List Panel */}
            <motion.div 
              layout
              className="rounded-2xl border-2 border-purple-500/30 bg-gradient-to-b from-purple-900/50 via-purple-950/60 to-black/80 overflow-hidden flex flex-col shadow-2xl shadow-purple-500/10"
            >
              {/* Panel Header */}
              <div className="relative px-4 py-3.5 bg-gradient-to-r from-purple-700/80 via-purple-800/70 to-violet-900/60 border-b border-purple-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.3, 1],
                        boxShadow: ['0 0 10px rgba(192, 132, 252, 0.5)', '0 0 20px rgba(192, 132, 252, 0.8)', '0 0 10px rgba(192, 132, 252, 0.5)']
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`w-3 h-3 rounded-full ${status === "failed" ? "bg-rose-400" : "bg-purple-300"}`} 
                    />
                    <span className="text-sm font-bold text-white drop-shadow-sm">{status === "failed" ? "Need Review" : "Passed"}</span>
                    <motion.span 
                      key={filteredReports.length}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white shadow-inner"
                    >
                      {filteredReports.length}
                    </motion.span>
                  </div>
                </div>
              </div>
              
              {/* List content */}
              <div className="max-h-[420px] overflow-y-auto flex-1">
                {filteredReports.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 text-center"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600/30 to-violet-700/30 border border-purple-400/30 flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-8 h-8 text-purple-300" />
                    </motion.div>
                    <p className="text-sm font-semibold text-white/80 mb-1">
                      {search ? "No matches found" : status === "failed" ? "All clear!" : "No records"}
                    </p>
                    <p className="text-xs text-purple-200/50">
                      {search ? "Try a different search term" : status === "failed" ? "No DVIRs need review" : "No passed DVIRs yet"}
                    </p>
                  </motion.div>
                ) : (
                  filteredReports.map((report, index) => {
                    const { allFails } = getFailedDVIRItems(report);
                    const reportStatus = getDVIRStatus(report);
                    const mechanicFlag = hasMechanicUpdate(report);
                    const isSelected = report.id === selectedId;
                    return (
                      <motion.button
                        key={report.id}
                        custom={index}
                        variants={prefersReducedMotion ? listItemVariantsReduced : listItemVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ backgroundColor: "rgba(192, 132, 252, 0.1)" }}
                        onClick={() => onSelectId(isSelected ? null : report.id)}
                        className={`w-full text-left px-4 py-3.5 transition-all duration-200 flex items-center gap-3 group border-b border-purple-500/10 last:border-b-0 ${
                          isSelected 
                            ? "bg-gradient-to-r from-purple-600/25 to-purple-500/10 border-l-4 border-l-purple-400" 
                            : "border-l-4 border-l-transparent hover:border-l-purple-500/50"
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="dvir-selection-indicator"
                            className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 via-violet-400 to-purple-500"
                          />
                        )}
                        <motion.div 
                          whileHover={{ scale: 1.3 }}
                          className={`w-3 h-3 rounded-full flex-shrink-0 shadow-lg ${reportStatus === "failed" ? "bg-rose-400 shadow-rose-500/50" : "bg-purple-400 shadow-purple-500/50"}`} 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white truncate drop-shadow-sm">{report.truck_number || "N/A"}</span>
                            {mechanicFlag && (
                              <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center px-2 py-0.5 bg-emerald-500/30 border border-emerald-400/40 rounded-full text-[9px] text-emerald-200 font-bold shadow-sm"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                                Fixed
                              </motion.span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-purple-100/70 truncate">{report.drivers_name || "Unknown"}</span>
                            <span className="text-purple-300/30">•</span>
                            <span className="text-[10px] text-purple-200/50">{formatDateTime(report.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {allFails.length > 0 && (
                            <motion.span 
                              whileHover={{ scale: 1.1 }}
                              className="text-[11px] font-black text-white bg-gradient-to-r from-rose-500 to-red-500 px-2.5 py-1 rounded-full shadow-lg shadow-rose-500/30"
                            >
                              {allFails.length}
                            </motion.span>
                          )}
                          <ChevronRight className={`w-4 h-4 transition-all duration-200 ${isSelected ? "text-purple-300 rotate-90" : "text-purple-400/40 group-hover:text-purple-300"}`} />
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>
              
              {/* Pagination */}
              {totalCount > 0 && (
                <div className="px-3 py-3 border-t border-purple-500/10 bg-black/20">
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
            </motion.div>

            {/* Detail Panel */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {!selectedDvir ? (
                  <motion.div 
                    key="empty-state" 
                    {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} 
                    className="h-full min-h-[300px] rounded-2xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-900/40 via-purple-950/50 to-black/70 p-8 flex flex-col items-center justify-center text-center shadow-2xl shadow-purple-500/10"
                  >
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.05, 1], 
                        rotate: [0, 5, -5, 0],
                        boxShadow: ['0 0 20px rgba(192, 132, 252, 0.3)', '0 0 40px rgba(192, 132, 252, 0.5)', '0 0 20px rgba(192, 132, 252, 0.3)']
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600/40 to-violet-700/40 border border-purple-400/40 mb-4"
                    >
                      <ListChecks className="w-10 h-10 text-purple-300" />
                    </motion.div>
                    <p className="text-lg font-bold text-white mb-1">Select a DVIR</p>
                    <p className="text-sm text-purple-200/60">Choose a report from the list to view details</p>
                  </motion.div>
                ) : (
                  <motion.div key={selectedId} {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} className="space-y-4">
                    <div className="rounded-2xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-900/50 via-purple-950/60 to-black/80 overflow-hidden shadow-2xl shadow-purple-500/15">
                      {/* Header */}
                      <div className="relative bg-gradient-to-r from-purple-700/80 via-violet-700/70 to-purple-800/60 border-b border-purple-400/30 px-5 py-5">
                        <div className="absolute inset-0 animate-shimmer opacity-20 pointer-events-none" />
                        
                        <div className="relative flex items-center justify-between gap-3">
                          <div className="flex items-center gap-4 min-w-0">
                            <motion.div 
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              animate={{
                                boxShadow: ['0 0 15px rgba(192, 132, 252, 0.4)', '0 0 30px rgba(192, 132, 252, 0.6)', '0 0 15px rgba(192, 132, 252, 0.4)']
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/50 to-violet-600/50 border border-purple-300/50 flex items-center justify-center flex-shrink-0"
                            >
                              <Truck className="w-7 h-7 text-purple-100" />
                            </motion.div>
                            <div className="min-w-0">
                              <h3 className="text-xl font-black text-white truncate drop-shadow-lg">Truck {selectedDvir.truck_number || "N/A"}</h3>
                              <div className="flex items-center gap-2 text-sm text-purple-100/80">
                                <span className="truncate font-medium">{selectedDvir.drivers_name || "Unknown"}</span>
                                <span className="text-purple-300/40">•</span>
                                <span className="font-semibold">{selectedDvir.mileage?.toLocaleString() || "—"} mi</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {hasMechanicUpdate(selectedDvir) && (
                              <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500/30 border border-emerald-400/50 rounded-xl text-xs font-bold text-emerald-100 shadow-lg shadow-emerald-500/20"
                              >
                                <Wrench className="w-4 h-4" />Fixed
                              </motion.span>
                            )}
                            <motion.span 
                              animate={{ scale: [1, 1.02, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-lg ${getDVIRStatus(selectedDvir) === "failed" ? "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-rose-500/30" : "bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-purple-500/30"}`}
                            >
                              {getDVIRStatus(selectedDvir) === "failed" ? <><AlertTriangle className="w-4 h-4" />Needs Review</> : <><CheckCircle2 className="w-4 h-4" />Passed</>}
                            </motion.span>
                          </div>
                        </div>
                      </div>
                      {/* Content */}
                      <div className="px-5 py-5 space-y-4">
                        {(() => {
                          const { vehicleFails, aerialFails, allFails } = getFailedDVIRItems(selectedDvir);
                          if (allFails.length === 0) {
                            return (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-600/20 to-emerald-700/10 px-4 py-4 flex items-center gap-3"
                              >
                                <motion.div
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                                </motion.div>
                                <span className="text-base font-semibold text-emerald-200">All items passed inspection</span>
                              </motion.div>
                            );
                          }
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <motion.div
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                                </motion.div>
                                <span className="text-base font-bold text-rose-300">{allFails.length} Failed Item{allFails.length !== 1 ? "s" : ""}</span>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                {vehicleFails.length > 0 && (
                                  <motion.div 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="rounded-xl border-2 border-rose-500/30 bg-gradient-to-br from-rose-600/20 to-rose-700/10 p-4 max-h-40 overflow-y-auto"
                                  >
                                    <div className="text-[11px] uppercase tracking-wider text-rose-200 mb-2 font-bold">Vehicle / Trailer</div>
                                    <ul className="space-y-2">{vehicleFails.map((label) => (
                                      <li key={label} className="flex items-start gap-2 text-sm text-rose-100/90">
                                        <motion.span 
                                          animate={{ scale: [1, 1.3, 1] }}
                                          transition={{ duration: 1.5, repeat: Infinity }}
                                          className="w-2 h-2 bg-rose-400 rounded-full mt-1.5 flex-shrink-0 shadow-lg shadow-rose-500/50" 
                                        />
                                        {label}
                                      </li>
                                    ))}</ul>
                                  </motion.div>
                                )}
                                {aerialFails.length > 0 && (
                                  <motion.div 
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-600/20 to-amber-700/10 p-4 max-h-40 overflow-y-auto"
                                  >
                                    <div className="text-[11px] uppercase tracking-wider text-amber-200 mb-2 font-bold">Aerial Lift</div>
                                    <ul className="space-y-2">{aerialFails.map((label) => (
                                      <li key={label} className="flex items-start gap-2 text-sm text-amber-100/90">
                                        <motion.span 
                                          animate={{ scale: [1, 1.3, 1] }}
                                          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                                          className="w-2 h-2 bg-amber-400 rounded-full mt-1.5 flex-shrink-0 shadow-lg shadow-amber-500/50" 
                                        />
                                        {label}
                                      </li>
                                    ))}</ul>
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        {/* Info Cards */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-800/30 to-purple-900/20 p-4">
                            <div className="text-[11px] uppercase tracking-wider text-purple-200/70 mb-2 font-bold">Driver Notes</div>
                            <p className="text-sm text-white/80 line-clamp-2">{selectedDvir.notes?.trim() || "No notes"}</p>
                          </div>
                          <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-800/30 to-purple-900/20 p-4">
                            <div className="text-[11px] uppercase tracking-wider text-purple-200/70 mb-2 font-bold">Vehicle Info</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-white/70">
                              <span>Chipper: <span className="font-semibold text-white/90">{selectedDvir.chipper_number || "—"}</span></span>
                              <span>Trailer: <span className="font-semibold text-white/90">{selectedDvir.trailer_number || "—"}</span></span>
                            </div>
                          </div>
                        </div>
                        {/* Mechanic Fix */}
                        {hasMechanicUpdate(selectedDvir) && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-700/30 via-emerald-800/20 to-emerald-900/10 p-5"
                          >
                            <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-emerald-200 mb-3 font-bold">
                              <motion.div
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                <Wrench className="w-4 h-4" />
                              </motion.div>
                              Mechanic Fix
                            </div>
                            <p className="text-base text-white/90 font-medium">{selectedDvir.deficiency_corrected || "—"}</p>
                            {selectedDvir.mechanic_remarks && <p className="text-sm text-emerald-100/70 mt-3">Remarks: {selectedDvir.mechanic_remarks}</p>}
                            {selectedDvir.mechanic_date && <p className="text-xs text-emerald-200/50 mt-2">Date: {selectedDvir.mechanic_date}</p>}
                          </motion.div>
                        )}
                        {/* Collapsible sections */}
                        <details className="group rounded-xl border-2 border-purple-500/25 bg-gradient-to-br from-purple-900/30 to-purple-950/20 overflow-hidden">
                          <summary className="flex items-center justify-between cursor-pointer px-4 py-3.5 text-sm font-bold text-white/80 hover:text-white hover:bg-purple-500/10 transition-all">
                            <span className="flex items-center gap-2"><ListChecks className="w-4 h-4 text-purple-300" />Full Checklist Review</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-purple-400" />
                          </summary>
                          <div className="grid gap-3 sm:grid-cols-2 p-4 border-t border-purple-500/20 bg-black/20">
                            <div className="rounded-xl border border-purple-500/20 bg-purple-950/30 p-4">
                              <div className="text-[11px] uppercase tracking-wider text-purple-200/70 mb-3 font-bold">Vehicle / Trailer</div>
                              <div className="max-h-48 overflow-y-auto space-y-1.5">
                                {VEHICLE_TRAILER_ITEMS.map((item) => {
                                  const value = selectedDvir.vehicle_trailer_checklist?.[item.id];
                                  const itemStatus = value === "P" ? "pass" : value === "F" ? "fail" : "pending";
                                  return (
                                    <div key={item.id} className="flex items-center justify-between py-2 text-sm text-white/70 gap-2 border-b border-purple-500/10 last:border-0">
                                      <span className="truncate">{item.label}</span>
                                      <span className={`w-3 h-3 rounded-full flex-shrink-0 shadow-lg ${itemStatus === "pass" ? "bg-emerald-400 shadow-emerald-500/50" : itemStatus === "fail" ? "bg-rose-400 shadow-rose-500/50" : "bg-white/20"}`} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-purple-500/20 bg-purple-950/30 p-4">
                              <div className="text-[11px] uppercase tracking-wider text-purple-200/70 mb-3 font-bold">Aerial Lift</div>
                              <div className="max-h-48 overflow-y-auto space-y-1.5">
                                {AERIAL_LIFT_ITEMS.map((item) => {
                                  const value = selectedDvir.aerial_checklist?.[item.id];
                                  const itemStatus = value === "P" ? "pass" : value === "F" ? "fail" : "pending";
                                  return (
                                    <div key={item.id} className="flex items-center justify-between py-2 text-sm text-white/70 gap-2 border-b border-purple-500/10 last:border-0">
                                      <span className="truncate">{item.label}</span>
                                      <span className={`w-3 h-3 rounded-full flex-shrink-0 shadow-lg ${itemStatus === "pass" ? "bg-emerald-400 shadow-emerald-500/50" : itemStatus === "fail" ? "bg-rose-400 shadow-rose-500/50" : "bg-white/20"}`} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </details>
                        <details className="group rounded-xl border-2 border-purple-500/25 bg-gradient-to-br from-purple-900/30 to-purple-950/20 overflow-hidden">
                          <summary className="flex items-center justify-between cursor-pointer px-4 py-3.5 text-sm font-bold text-white/80 hover:text-white hover:bg-purple-500/10 transition-all">
                            <span className="flex items-center gap-2"><Images className="w-4 h-4 text-purple-300" />Photos ({mediaEntries.length})</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-purple-400" />
                          </summary>
                          <div className="p-4 border-t border-purple-500/20 bg-black/20">
                            {mediaEntries.length === 0 ? <p className="text-sm text-purple-200/50">No photos uploaded</p> : (
                              <div className="grid grid-cols-3 gap-3">
                                {mediaEntries.map((media) => (
                                  <a key={media.label} href={media.url} target="_blank" rel="noopener noreferrer" className="group/img block rounded-xl border border-purple-500/20 bg-purple-950/30 overflow-hidden transition-all hover:border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/20">
                                    <img src={media.url} alt={media.label} className="h-24 w-full object-cover transition-transform duration-300 group-hover/img:scale-110" />
                                    <div className="px-2 py-2 text-[11px] text-purple-200/70 truncate font-medium">{media.label}</div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                        <details className="group rounded-xl border-2 border-purple-500/25 bg-gradient-to-br from-purple-900/30 to-purple-950/20 overflow-hidden">
                          <summary className="flex items-center justify-between cursor-pointer px-4 py-3.5 text-sm font-bold text-white/80 hover:text-white hover:bg-purple-500/10 transition-all">
                            <span className="flex items-center gap-2"><FileSignature className="w-4 h-4 text-purple-300" />Signatures ({signatureEntries.length})</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-purple-400" />
                          </summary>
                          <div className="p-4 border-t border-purple-500/20 bg-black/20">
                            {signatureEntries.length === 0 ? <p className="text-sm text-purple-200/50">No signatures</p> : (
                              <div className="grid grid-cols-2 gap-3">
                                {signatureEntries.map((sig) => (
                                  <a key={sig.label} href={sig.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-purple-500/20 bg-purple-950/30 p-3 transition-all hover:border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/20">
                                    <div className="text-[11px] text-purple-200/70 mb-2 truncate font-bold">{sig.label}</div>
                                    <img src={sig.url} alt={sig.label} className="h-20 w-full object-contain" />
                                  </a>
                                ))}
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
