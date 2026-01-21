import { useMemo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Wrench,
  ClipboardList,
  Search,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
  Camera,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import TableSkeleton from "../../../components/skeletons/TableSkeleton";
import CardListSkeleton from "../../../components/skeletons/CardListSkeleton";
import { AdvancedPagination } from "../../../components/ui/AdvancedPagination";
import { DateRangeChips } from "../../../components/ui/QuickFilterChips";
import type { EquipmentInspection } from "./types";
import { GENERAL_EQUIPMENT_ITEMS, EQUIPMENT_TYPE_OPTIONS } from "./types";
import { inspectionHasFailures, getSpecificItems } from "./helpers";
import { ScrollRevealSection, listItemVariants, listItemVariantsReduced, detailTransition, detailTransitionReduced } from "./animations";

interface EquipmentTabProps {
  inspections: EquipmentInspection[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  search: string;
  onSearchChange: (value: string) => void;
  status: "attention" | "all" | "passed";
  onStatusChange: (status: "attention" | "all" | "passed") => void;
  equipmentType: string;
  onEquipmentTypeChange: (type: string) => void;
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

export function EquipmentTab({
  inspections,
  loading,
  error,
  selectedId,
  onSelectId,
  search,
  onSearchChange,
  status,
  onStatusChange,
  equipmentType,
  onEquipmentTypeChange,
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
}: EquipmentTabProps) {
  // Note: _enableAnimations passed from parent but we use useReducedMotion() for consistency
  void _enableAnimations;
  const prefersReducedMotion = useReducedMotion();

  // Storage helper
  const getEquipmentPublicUrl = useCallback((path?: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("equipment-inspection-photos").getPublicUrl(path);
    return data.publicUrl ?? null;
  }, []);

  // Filtered data
  const filteredInspections = useMemo(() => {
    let filtered = inspections;
    if (status === "attention") {
      filtered = filtered.filter((i) => inspectionHasFailures(i));
    } else if (status === "passed") {
      filtered = filtered.filter((i) => !inspectionHasFailures(i));
    }
    return filtered;
  }, [inspections, status]);

  const selectedEquipment = useMemo(() => inspections.find((i) => i.id === selectedId) || null, [inspections, selectedId]);

  // Photo entries
  const photoEntries = useMemo(() => {
    if (!selectedEquipment) return [];
    const photos = [
      { label: "Overview", path: selectedEquipment.overview_photo_path },
      { label: "Damage / Wear", path: selectedEquipment.damage_photo_path },
      { label: "Attachments / Teeth", path: selectedEquipment.attachments_photo_path },
      { label: "Hydraulic Fluid", path: selectedEquipment.hydraulic_photo_path },
    ];
    return photos.filter((p) => p.path).map((p) => {
      const url = getEquipmentPublicUrl(p.path);
      return url ? { label: p.label, url } : null;
    }).filter((p): p is { label: string; url: string } => Boolean(p));
  }, [selectedEquipment, getEquipmentPublicUrl]);

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
              {/* Status Select */}
              <div className="relative">
                <select 
                  value={status} 
                  onChange={(e) => { onStatusChange(e.target.value as typeof status); onPageChange(1); }} 
                  className="w-full sm:w-auto bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 appearance-none cursor-pointer transition-all"
                >
                  <option value="attention">Needs Attention</option>
                  <option value="all">All Inspections</option>
                  <option value="passed">Passed Only</option>
                </select>
                <ClipboardList className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50 pointer-events-none" />
              </div>
              
              {/* Type Select */}
              <div className="relative">
                <select 
                  value={equipmentType} 
                  onChange={(e) => { onEquipmentTypeChange(e.target.value); onPageChange(1); }} 
                  className="w-full sm:w-auto bg-black/40 border border-purple-500/20 rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 appearance-none cursor-pointer transition-all"
                >
                  <option value="">All Types</option>
                  {EQUIPMENT_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <Wrench className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50 pointer-events-none" />
              </div>
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/50" />
                <input 
                  value={search} 
                  onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }} 
                  placeholder="Search equipment or operator..." 
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
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
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
                      className={`w-3 h-3 rounded-full ${status === "attention" ? "bg-rose-400" : status === "passed" ? "bg-purple-300" : "bg-violet-300"}`} 
                    />
                    <span className="text-sm font-bold text-white drop-shadow-sm">{status === "attention" ? "Needs Attention" : status === "passed" ? "Passed" : "All"}</span>
                    <motion.span 
                      key={filteredInspections.length}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/20 text-white shadow-inner"
                    >
                      {filteredInspections.length}
                    </motion.span>
                  </div>
                </div>
              </div>
              
              {/* List content */}
              <div className="max-h-[420px] overflow-y-auto flex-1">
                {filteredInspections.length === 0 ? (
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
                      <ClipboardList className="w-8 h-8 text-purple-300" />
                    </motion.div>
                    <p className="text-sm font-semibold text-white/80 mb-1">No matches found</p>
                    <p className="text-xs text-purple-200/50">Try adjusting your filters</p>
                  </motion.div>
                ) : (
                  filteredInspections.map((inspection, index) => {
                    const isSelected = inspection.id === selectedId;
                    const hasFailures = inspectionHasFailures(inspection);
                    const hasFix = Boolean(inspection.mechanic_fixes?.trim());
                    return (
                      <motion.button
                        key={inspection.id}
                        custom={index}
                        variants={prefersReducedMotion ? listItemVariantsReduced : listItemVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ backgroundColor: "rgba(192, 132, 252, 0.1)" }}
                        onClick={() => onSelectId(isSelected ? null : inspection.id)}
                        className={`w-full text-left px-4 py-3.5 transition-all duration-200 flex items-center gap-3 group border-b border-purple-500/10 last:border-b-0 ${
                          isSelected 
                            ? "bg-gradient-to-r from-purple-600/25 to-purple-500/10 border-l-4 border-l-purple-400" 
                            : "border-l-4 border-l-transparent hover:border-l-purple-500/50"
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="equipment-selection-indicator"
                            className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 via-violet-400 to-purple-500"
                          />
                        )}
                        <motion.div 
                          whileHover={{ scale: 1.3 }}
                          className={`w-3 h-3 rounded-full flex-shrink-0 shadow-lg ${hasFailures ? "bg-rose-400 shadow-rose-500/50" : "bg-purple-400 shadow-purple-500/50"}`} 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white truncate drop-shadow-sm">{inspection.equipment_number || "N/A"}</span>
                            <span className="text-[10px] text-purple-200/60 truncate bg-purple-500/20 px-2 py-0.5 rounded-full">{inspection.equipment_type || ""}</span>
                            {hasFix && (
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
                            <span className="text-xs text-purple-100/70 truncate">{inspection.submitted_by || "Unknown"}</span>
                            <span className="text-purple-300/30">•</span>
                            <span className="text-[10px] text-purple-200/50">{new Date(inspection.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 transition-all duration-200 flex-shrink-0 ${isSelected ? "text-purple-300 rotate-90" : "text-purple-400/40 group-hover:text-purple-300"}`} />
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
                {!selectedEquipment ? (
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
                      <ClipboardList className="w-10 h-10 text-purple-300" />
                    </motion.div>
                    <p className="text-lg font-bold text-white mb-1">Select an inspection</p>
                    <p className="text-sm text-purple-200/60">Choose a record from the list to view details</p>
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
                              <Wrench className="w-7 h-7 text-purple-100" />
                            </motion.div>
                            <div className="min-w-0">
                              <h3 className="text-xl font-black text-white truncate drop-shadow-lg">{selectedEquipment.equipment_number || "Unknown"}</h3>
                              <div className="flex items-center gap-2 text-sm text-purple-100/80">
                                <span className="font-medium bg-purple-500/30 px-2 py-0.5 rounded-lg">{selectedEquipment.equipment_type || "Equipment"}</span>
                                <span className="text-purple-300/40">•</span>
                                <span className="font-semibold">{new Date(selectedEquipment.inspection_date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {selectedEquipment.mechanic_fixes && (
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
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-lg ${inspectionHasFailures(selectedEquipment) ? "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-rose-500/30" : "bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-purple-500/30"}`}
                            >
                              {inspectionHasFailures(selectedEquipment) ? <><AlertTriangle className="w-4 h-4" />Needs Review</> : <><CheckCircle2 className="w-4 h-4" />Passed</>}
                            </motion.span>
                          </div>
                        </div>
                      </div>
                      {/* Content */}
                      <div className="px-5 py-5 space-y-4">
                        {/* Info Cards */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-800/30 to-purple-900/20 p-4">
                            <div className="text-[11px] uppercase tracking-wider text-purple-200/70 mb-2 font-bold">Submitted by</div>
                            <p className="text-base text-white/90 font-medium">{selectedEquipment.submitted_by || "Unknown"}</p>
                          </div>
                          <div className="rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-800/30 to-purple-900/20 p-4">
                            <div className="text-[11px] uppercase tracking-wider text-purple-200/70 mb-2 font-bold">Notes</div>
                            <p className="text-sm text-white/80 line-clamp-2">{selectedEquipment.notes?.trim() || "No notes"}</p>
                          </div>
                        </div>
                        {/* Mechanic Fix */}
                        {selectedEquipment.mechanic_fixes && (
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
                            <p className="text-base text-white/90 font-medium">{selectedEquipment.mechanic_fixes}</p>
                            {selectedEquipment.last_mechanic_updated_at && <p className="text-xs text-emerald-200/50 mt-3">Updated {new Date(selectedEquipment.last_mechanic_updated_at).toLocaleDateString()}</p>}
                          </motion.div>
                        )}
                        {/* Checklists */}
                        <details className="group rounded-xl border-2 border-purple-500/25 bg-gradient-to-br from-purple-900/30 to-purple-950/20 overflow-hidden" open>
                          <summary className="flex items-center justify-between cursor-pointer px-4 py-3.5 text-sm font-bold text-white/80 hover:text-white hover:bg-purple-500/10 transition-all">
                            <span className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-purple-300" />Checklists</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-purple-400" />
                          </summary>
                          <div className="grid gap-3 sm:grid-cols-2 p-4 border-t border-purple-500/20 bg-black/20">
                            <div className="rounded-xl border border-purple-500/20 bg-purple-950/30 p-4">
                              <div className="text-[11px] uppercase tracking-wider text-purple-200/70 mb-3 font-bold">General</div>
                              <div className="max-h-48 overflow-y-auto space-y-1.5">
                                {GENERAL_EQUIPMENT_ITEMS.map((item) => {
                                  const value = selectedEquipment.general_checklist?.[item.id];
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
                              <div className="text-[11px] uppercase tracking-wider text-purple-200/70 mb-3 font-bold">Template</div>
                              {getSpecificItems(selectedEquipment.template).length === 0 ? <p className="text-sm text-purple-200/50">No template</p> : (
                                <div className="max-h-48 overflow-y-auto space-y-1.5">
                                  {getSpecificItems(selectedEquipment.template).map((item) => {
                                    const value = selectedEquipment.specific_checklist?.[item.id];
                                    const itemStatus = value === "P" ? "pass" : value === "F" ? "fail" : "pending";
                                    return (
                                      <div key={item.id} className="flex items-center justify-between py-2 text-sm text-white/70 gap-2 border-b border-purple-500/10 last:border-0">
                                        <span className="truncate">{item.label}</span>
                                        <span className={`w-3 h-3 rounded-full flex-shrink-0 shadow-lg ${itemStatus === "pass" ? "bg-emerald-400 shadow-emerald-500/50" : itemStatus === "fail" ? "bg-rose-400 shadow-rose-500/50" : "bg-white/20"}`} />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </details>
                        <details className="group rounded-xl border-2 border-purple-500/25 bg-gradient-to-br from-purple-900/30 to-purple-950/20 overflow-hidden">
                          <summary className="flex items-center justify-between cursor-pointer px-4 py-3.5 text-sm font-bold text-white/80 hover:text-white hover:bg-purple-500/10 transition-all">
                            <span className="flex items-center gap-2"><Camera className="w-4 h-4 text-purple-300" />Photos ({photoEntries.length})</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-purple-400" />
                          </summary>
                          <div className="p-4 border-t border-purple-500/20 bg-black/20">
                            {photoEntries.length === 0 ? <p className="text-sm text-purple-200/50">No photos uploaded</p> : (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {photoEntries.map((photo) => (
                                  <a key={photo.label} href={photo.url} target="_blank" rel="noopener noreferrer" className="group/img block rounded-xl border border-purple-500/20 bg-purple-950/30 overflow-hidden transition-all hover:border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/20">
                                    <img src={photo.url} alt={photo.label} className="h-20 w-full object-cover transition-transform duration-300 group-hover/img:scale-110" />
                                    <div className="px-2 py-2 text-[11px] text-purple-200/70 truncate font-medium">{photo.label}</div>
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
