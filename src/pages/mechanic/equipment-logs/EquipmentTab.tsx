import { useCallback, useMemo, useState, useEffect } from "react";
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
  Loader2,
  Download,
  FileSpreadsheet,
  Table,
  FileDown,
  DollarSign,
  Plus,
  Trash2,
  Package,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import TableSkeleton from "../../../components/skeletons/TableSkeleton";
import CardListSkeleton from "../../../components/skeletons/CardListSkeleton";
import { AdvancedPagination } from "../../../components/ui/AdvancedPagination";
import { DateRangeChips } from "../../../components/ui/QuickFilterChips";
import { DataExporter, generateFilename, type ExportMetadata } from "../../../lib/exportUtils";
import { logReportExported } from "../../../lib/safetyAuditLog";
import { useAuth } from "../../../contexts/AuthContext";

import {
  type EquipmentInspection,
  GENERAL_EQUIPMENT_ITEMS,
  EQUIPMENT_TYPE_OPTIONS,
} from "./types";
import {
  inspectionHasFailures,
  getSpecificItems,
} from "./helpers";
import {
  ScrollRevealSection,
} from "./animations";
import {
  listItemVariants,
  listItemVariantsReduced,
  detailTransition,
  detailTransitionReduced,
} from "../../../lib/animationVariants";
import { equipmentExportColumns, EQUIPMENT_PDF_EXPORT_COLUMNS } from "./exportColumns";

interface EquipmentTabProps {
  equipmentInspections: EquipmentInspection[];
  equipmentLoading: boolean;
  equipmentError: string | null;
  equipmentSearch: string;
  setEquipmentSearch: (value: string) => void;
  equipmentStatus: "attention" | "all" | "passed";
  setEquipmentStatus: (value: "attention" | "all" | "passed") => void;
  equipmentType: string;
  setEquipmentType: (value: string) => void;
  equipmentPage: number;
  setEquipmentPage: (value: number) => void;
  equipmentPageSize: number;
  setEquipmentPageSize: (value: number) => void;
  equipmentDateRange: string;
  setEquipmentDateRange: (value: string) => void;
  equipmentTotalCount: number;
  showFilters: boolean;
  isExporting: boolean;
  setIsExporting: (value: boolean) => void;
  exportSuccess: string | null;
  setExportSuccess: (value: string | null) => void;
  userEmail: string | undefined;
  debouncedEquipmentSearch: string;
  onRefresh: () => void;
  setEquipmentInspections: React.Dispatch<React.SetStateAction<EquipmentInspection[]>>;
  getEquipmentPublicUrl: (path?: string | null) => string | null;
}

export function EquipmentTab({
  equipmentInspections,
  equipmentLoading,
  equipmentError,
  equipmentSearch,
  setEquipmentSearch,
  equipmentStatus,
  setEquipmentStatus,
  equipmentType,
  setEquipmentType,
  equipmentPage,
  setEquipmentPage,
  equipmentPageSize,
  setEquipmentPageSize,
  equipmentDateRange,
  setEquipmentDateRange,
  equipmentTotalCount,
  showFilters,
  isExporting,
  setIsExporting,
  exportSuccess,
  setExportSuccess,
  userEmail,
  debouncedEquipmentSearch,
  onRefresh,
  setEquipmentInspections,
  getEquipmentPublicUrl,
}: EquipmentTabProps) {
  const { user, role } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  
  // Selection state
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);

  // Form state
  const [equipmentMechanicNotes, setEquipmentMechanicNotes] = useState("");
  const [equipmentUpdateCost, setEquipmentUpdateCost] = useState("");
  const [equipmentUpdateParts, setEquipmentUpdateParts] = useState<{ part_name: string; quantity: number; part_number: string }[]>([]);
  const [savingEquipmentFix, setSavingEquipmentFix] = useState(false);
  const [equipmentSaveMessage, setEquipmentSaveMessage] = useState<string | null>(null);

  // Filtered data
  const filteredEquipmentInspections = useMemo(() => {
    let filtered = equipmentInspections;
    if (equipmentStatus === "attention") {
      filtered = filtered.filter((i) => inspectionHasFailures(i));
    } else if (equipmentStatus === "passed") {
      filtered = filtered.filter((i) => !inspectionHasFailures(i));
    }
    return filtered;
  }, [equipmentInspections, equipmentStatus]);

  const selectedEquipment = useMemo(() => equipmentInspections.find((i) => i.id === selectedEquipmentId) || null, [equipmentInspections, selectedEquipmentId]);

  // Populate form when selection changes
  useEffect(() => {
    if (!selectedEquipment) {
      setEquipmentMechanicNotes("");
      setEquipmentUpdateCost("");
      setEquipmentUpdateParts([]);
      return;
    }
    setEquipmentMechanicNotes(selectedEquipment.mechanic_fixes || "");
    setEquipmentUpdateCost(selectedEquipment.mechanic_cost?.toString() || "");
    const existingParts = selectedEquipment.mechanic_parts_used;
    setEquipmentUpdateParts(existingParts?.map(p => ({ part_name: p.part_name, quantity: p.quantity, part_number: p.part_number || "" })) || []);
  }, [selectedEquipment]);

  // Parts handlers
  const handleAddEquipmentPart = () => {
    setEquipmentUpdateParts(prev => [...prev, { part_name: "", quantity: 1, part_number: "" }]);
  };
  const handleEquipmentPartChange = (index: number, part: { part_name: string; quantity: number; part_number: string }) => {
    setEquipmentUpdateParts(prev => { const newParts = [...prev]; newParts[index] = part; return newParts; });
  };
  const handleEquipmentPartRemove = (index: number) => {
    setEquipmentUpdateParts(prev => prev.filter((_, i) => i !== index));
  };

  // Save handler
  const handleSaveEquipmentFix = async () => {
    if (!selectedEquipment) return;
    try {
      setSavingEquipmentFix(true);
      setEquipmentSaveMessage(null);
      const validParts = equipmentUpdateParts.filter(p => p.part_name.trim());
      const costValue = equipmentUpdateCost ? parseFloat(equipmentUpdateCost) : null;
      const { error } = await supabase.from("daily_equipment_inspections").update({
        mechanic_fixes: equipmentMechanicNotes.trim() || null,
        last_mechanic_updated_at: new Date().toISOString(),
        mechanic_cost: costValue,
        mechanic_parts_used: validParts.length > 0 ? validParts : null,
      }).eq("id", selectedEquipment.id);
      if (error) throw error;
      setEquipmentInspections((prev) => prev.map((i) => i.id === selectedEquipment.id ? { 
        ...i, 
        mechanic_fixes: equipmentMechanicNotes.trim() || null, 
        last_mechanic_updated_at: new Date().toISOString(),
        mechanic_cost: costValue,
        mechanic_parts_used: validParts.length > 0 ? validParts : null,
      } : i));
      setEquipmentSaveMessage("Fix recorded successfully!");
      setTimeout(() => setEquipmentSaveMessage(null), 4000);
    } catch {
      setEquipmentSaveMessage("Failed to save. Please try again.");
      setTimeout(() => setEquipmentSaveMessage(null), 4000);
    } finally {
      setSavingEquipmentFix(false);
    }
  };

  // Export handler
  const handleExportEquipment = useCallback(async (exportFormat: "csv" | "excel" | "pdf") => {
    setIsExporting(true);
    setExportSuccess(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const exporter = new DataExporter<EquipmentInspection>();
      const metadata: ExportMetadata = {
        reportType: "Equipment Inspections Export",
        generatedAt: new Date(),
        exportedBy: userEmail || "Unknown",
        filters: {
          "Status": equipmentStatus === "attention" ? "Needs Attention" : equipmentStatus === "passed" ? "Passed" : "All",
          "Type": equipmentType || "All Types",
          "Search": debouncedEquipmentSearch || "None",
        },
        totalRecords: filteredEquipmentInspections.length,
      };
      
      const filename = generateFilename("Equipment_Inspections", equipmentType || equipmentStatus);
      
      switch (exportFormat) {
        case "csv":
          exporter.exportCSV({
            data: filteredEquipmentInspections,
            columns: equipmentExportColumns,
            filename,
            metadata,
          });
          setExportSuccess("Equipment data exported to CSV!");
          break;
        case "excel":
          exporter.exportExcel({
            data: filteredEquipmentInspections,
            columns: equipmentExportColumns,
            filename: filename.replace(".csv", ".xlsx"),
            metadata,
          });
          setExportSuccess("Equipment data exported to Excel!");
          break;
        case "pdf":
          exporter.exportPDF({
            data: filteredEquipmentInspections,
            columns: EQUIPMENT_PDF_EXPORT_COLUMNS,
            filename: filename.replace(".csv", ".pdf"),
            metadata,
            companyName: "All Terrain Tree Service",
            subtitle: equipmentType ? `Type: ${equipmentType}` : "All Equipment Types",
            orientation: "landscape",
          });
          setExportSuccess("Equipment data exported to PDF!");
          break;
      }
      await logReportExported(
        {
          reportType: "Equipment",
          dateFrom: equipmentDateRange?.split("_")[0] ?? null,
          dateTo: equipmentDateRange?.split("_")[1] ?? null,
          format: exportFormat,
          totalRecords: filteredEquipmentInspections.length,
        },
        { userId: user?.id, role: role ?? undefined }
      );
      setTimeout(() => setExportSuccess(null), 3000);
    } catch {
      // Export failed silently
    } finally {
      setIsExporting(false);
    }
  }, [filteredEquipmentInspections, equipmentStatus, equipmentType, debouncedEquipmentSearch, userEmail, setIsExporting, setExportSuccess, user?.id, role, equipmentDateRange]);

  // Photo entries
  const equipmentPhotoEntries = useMemo(() => {
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

  const equipmentTotalPages = Math.max(1, Math.ceil(equipmentTotalCount / equipmentPageSize));

  return (
    <div className="space-y-4">
      {/* EQUIPMENT FILTER BAR */}
      <ScrollRevealSection delay={0}>
        <motion.div 
          layout
          className="rounded-2xl border-2 border-amber-600/40 bg-gradient-to-br from-gray-900 via-amber-950/50 to-gray-900 p-4 shadow-xl shadow-amber-500/10"
        >
          <div className="flex flex-col gap-4">
            {/* Primary filters row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Status dropdown */}
              <div className="relative">
                <select 
                  value={equipmentStatus} 
                  onChange={(e) => { setEquipmentStatus(e.target.value as typeof equipmentStatus); setEquipmentPage(1); }} 
                  className="w-full sm:w-auto bg-gray-950 border-2 border-gray-700 rounded-xl px-4 py-3 pr-12 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none cursor-pointer transition-all hover:border-amber-500/50"
                >
                  <option value="attention">🔴 Needs Attention</option>
                  <option value="all">📋 All Inspections</option>
                  <option value="passed">✅ Passed Only</option>
                </select>
                <ClipboardList className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none" />
              </div>
              
              {/* Type dropdown */}
              <div className="relative">
                <select 
                  value={equipmentType} 
                  onChange={(e) => { setEquipmentType(e.target.value); setEquipmentPage(1); }} 
                  className="w-full sm:w-auto bg-gray-950 border-2 border-gray-700 rounded-xl px-4 py-3 pr-12 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 appearance-none cursor-pointer transition-all hover:border-amber-500/50"
                >
                  <option value="">All Equipment Types</option>
                  {EQUIPMENT_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <Wrench className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none" />
              </div>
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                <input 
                  value={equipmentSearch} 
                  onChange={(e) => { setEquipmentSearch(e.target.value); setEquipmentPage(1); }} 
                  placeholder="Search equipment # or operator..." 
                  className="w-full bg-gray-950 border-2 border-gray-700 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all" 
                />
                {equipmentSearch && (
                  <motion.button 
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    onClick={() => { setEquipmentSearch(""); setEquipmentPage(1); }} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.08, rotate: 180 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={onRefresh}
                  disabled={equipmentLoading}
                  className="p-3 rounded-xl bg-gradient-to-br from-amber-600 to-yellow-700 border border-amber-400/50 text-white hover:shadow-lg hover:shadow-amber-500/30 disabled:opacity-50 transition-all"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${equipmentLoading ? "animate-spin" : ""}`} />
                </motion.button>
                
                {/* Export Dropdown */}
                <div className="relative group">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isExporting || filteredEquipmentInspections.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 border border-blue-400/50 text-white text-xs font-bold hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="hidden sm:inline">Export</span>
                  </motion.button>
                  <div className="absolute right-0 top-full mt-2 w-40 bg-gray-950 border-2 border-gray-800 rounded-xl shadow-2xl shadow-black/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                    <button type="button" onClick={() => handleExportEquipment("csv")} disabled={isExporting} aria-label="Export equipment as CSV" className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-amber-600/20 transition-colors min-h-[44px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-inset">
                      <FileSpreadsheet className="w-4 h-4 text-amber-400" aria-hidden /> CSV
                    </button>
                    <button type="button" onClick={() => handleExportEquipment("excel")} disabled={isExporting} aria-label="Export equipment as Excel" className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-amber-600/20 transition-colors border-t border-gray-800 min-h-[44px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-inset">
                      <Table className="w-4 h-4 text-amber-400" aria-hidden /> Excel
                    </button>
                    <button type="button" onClick={() => handleExportEquipment("pdf")} disabled={isExporting} aria-label="Export equipment as PDF" className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-amber-600/20 transition-colors border-t border-gray-800 min-h-[44px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-inset">
                      <FileDown className="w-4 h-4 text-amber-400" aria-hidden /> PDF
                    </button>
                  </div>
                </div>
              </div>
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
                  <div className="pt-4 border-t-2 border-gray-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600/20 border border-amber-500/30">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-200">Date Range:</span>
                    </div>
                    <DateRangeChips
                      activeRange={equipmentDateRange}
                      onRangeChange={(range) => { setEquipmentDateRange(range); setEquipmentPage(1); }}
                      variant="amber"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Export Success Message */}
          <AnimatePresence>
            {exportSuccess && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: -10, scale: 0.95 }} 
                className="mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600/20 to-green-600/20 border-2 border-emerald-500/40 text-sm text-emerald-300 font-semibold flex items-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> {exportSuccess}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </ScrollRevealSection>

      {/* Equipment Content */}
      <ScrollRevealSection delay={0.1}>
        {equipmentLoading && (
          <div className="space-y-3">
            <div className="hidden lg:block"><TableSkeleton rows={5} columns={4} variant="ember" /></div>
            <div className="lg:hidden"><CardListSkeleton rows={4} variant="ember" /></div>
          </div>
        )}
        {equipmentError && <div className="rounded-xl border-2 border-red-500/50 bg-red-950/80 px-4 py-3 text-sm text-red-200 font-medium">{equipmentError}</div>}
        {!equipmentLoading && !equipmentError && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* EQUIPMENT LIST PANEL */}
            <motion.div 
              layout
              className="rounded-2xl border-2 border-amber-600/40 bg-gradient-to-b from-gray-900 via-amber-950/40 to-gray-950 overflow-hidden flex flex-col shadow-2xl shadow-amber-500/10"
            >
              {/* Panel Header */}
              <div className={`flex items-center justify-between px-4 py-3 ${
                equipmentStatus === "attention" 
                  ? "bg-gradient-to-r from-rose-700/80 to-rose-900/60" 
                  : equipmentStatus === "passed"
                  ? "bg-gradient-to-r from-emerald-700/80 to-emerald-900/60"
                  : "bg-gradient-to-r from-amber-700/80 to-amber-900/60"
              }`}>
                <div className="flex items-center gap-3">
                  <motion.div 
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`w-3 h-3 rounded-full ${
                      equipmentStatus === "attention" ? "bg-rose-300" : 
                      equipmentStatus === "passed" ? "bg-emerald-300" : 
                      "bg-amber-300"
                    }`} 
                  />
                  <span className="text-sm font-bold text-white">
                    {equipmentStatus === "attention" ? "Needs Attention" : equipmentStatus === "passed" ? "Passed" : "All Equipment"}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-white/20 text-white">
                    {filteredEquipmentInspections.length}
                  </span>
                </div>
              </div>
              
              {/* List content */}
              <div className="max-h-[420px] overflow-y-auto flex-1">
                {filteredEquipmentInspections.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 text-center"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-700 to-yellow-800 border-2 border-amber-500/50 flex items-center justify-center shadow-lg shadow-amber-500/30"
                    >
                      <Wrench className="w-9 h-9 text-white" />
                    </motion.div>
                    <p className="text-base font-bold text-white mb-1">No equipment found</p>
                    <p className="text-sm text-gray-400">Try adjusting your filters</p>
                  </motion.div>
                ) : (
                  filteredEquipmentInspections.map((inspection, index) => {
                    const isSelected = inspection.id === selectedEquipmentId;
                    const hasFailures = inspectionHasFailures(inspection);
                    const hasFix = Boolean(inspection.mechanic_fixes?.trim());
                    return (
                      <motion.button
                        key={inspection.id}
                        custom={index}
                        variants={prefersReducedMotion ? listItemVariantsReduced : listItemVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}
                        onClick={() => setSelectedEquipmentId(isSelected ? null : inspection.id)}
                        className={`w-full text-left px-4 py-3 transition-all duration-200 flex items-center gap-3 group ${
                          isSelected 
                            ? "bg-gradient-to-r from-orange-500/15 to-orange-500/5 border-l-2 border-l-orange-400" 
                            : "border-l-2 border-l-transparent"
                        }`}
                      >
                        <motion.div 
                          whileHover={{ scale: 1.3 }}
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${hasFailures ? "bg-rose-400" : "bg-orange-400"}`} 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white truncate">{inspection.equipment_number || "N/A"}</span>
                            <span className="text-[10px] text-orange-300/50 px-1.5 py-0.5 bg-orange-500/10 rounded truncate">{inspection.equipment_type || ""}</span>
                            {hasFix && (
                              <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center px-2 py-0.5 bg-orange-500/20 border border-orange-400/30 rounded-full text-[9px] text-orange-300 font-semibold"
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                                Fixed
                              </motion.span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-white/50 truncate">{inspection.submitted_by || "Unknown"}</span>
                            <span className="text-white/20">•</span>
                            <span className="text-[10px] text-white/40">{new Date(inspection.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 transition-all duration-200 flex-shrink-0 ${isSelected ? "text-orange-400 rotate-90" : "text-white/20 group-hover:text-orange-400/50"}`} />
                      </motion.button>
                    );
                  })
                )}
              </div>
              
              {/* Pagination */}
              {equipmentTotalCount > 0 && (
                <div className="px-3 py-3 border-t border-orange-500/10 bg-black/20">
                  <AdvancedPagination
                    currentPage={equipmentPage}
                    totalPages={equipmentTotalPages}
                    totalItems={equipmentTotalCount}
                    pageSize={equipmentPageSize}
                    onPageChange={setEquipmentPage}
                    onPageSizeChange={(size) => { setEquipmentPageSize(size); setEquipmentPage(1); }}
                    pageSizeOptions={[10, 12, 25, 50]}
                    variant="amber"
                    compact
                  />
                </div>
              )}
            </motion.div>

            {/* Equipment Detail Panel */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {!selectedEquipment ? (
                  <motion.div 
                    key="empty-state" 
                    {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} 
                    className="h-full min-h-[300px] rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-950/20 to-black/60 p-8 flex flex-col items-center justify-center text-center"
                  >
                    <motion.div 
                      animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-4 shadow-lg shadow-orange-500/10"
                    >
                      <ClipboardList className="w-7 h-7 text-orange-400/70" />
                    </motion.div>
                    <p className="text-base font-semibold text-white/80 mb-1">Select an Inspection</p>
                    <p className="text-sm text-white/40">Choose an equipment inspection from the list to view details</p>
                  </motion.div>
                ) : (
                  <motion.div key={selectedEquipmentId} {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} className="space-y-4">
                    {/* Inspection Details */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-950/30 to-black/60 overflow-hidden shadow-xl shadow-orange-500/5"
                    >
                      {/* Detail Header */}
                      <div className="bg-gradient-to-r from-orange-500/10 via-orange-500/5 to-transparent border-b border-orange-500/15 px-5 py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <motion.div 
                              whileHover={{ rotate: 10, scale: 1.1 }}
                              className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/25 to-amber-500/15 border border-orange-400/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20"
                            >
                              <Wrench className="w-6 h-6 text-orange-400" />
                            </motion.div>
                            <div className="min-w-0">
                              <h3 className="text-lg font-bold text-white truncate">{selectedEquipment.equipment_number || "Unknown"}</h3>
                              <div className="flex items-center gap-2 text-sm text-white/60 mt-0.5">
                                <span className="px-2 py-0.5 bg-orange-500/10 rounded text-orange-300/70 text-xs">{selectedEquipment.equipment_type || "Equipment"}</span>
                                <span className="text-orange-400/30">•</span>
                                <span className="text-orange-300/60">{new Date(selectedEquipment.inspection_date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {selectedEquipment.mechanic_fixes && (
                              <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 border border-orange-400/30 rounded-full text-xs font-semibold text-orange-300 shadow-lg shadow-orange-500/10"
                              >
                                <Wrench className="w-3.5 h-3.5" />Fixed
                              </motion.span>
                            )}
                            <motion.span 
                              whileHover={{ scale: 1.05 }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg ${
                                inspectionHasFailures(selectedEquipment) 
                                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-rose-500/10" 
                                  : "bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-orange-500/10"
                              }`}
                            >
                              {inspectionHasFailures(selectedEquipment) 
                                ? <><AlertTriangle className="w-3.5 h-3.5" />Needs Review</> 
                                : <><CheckCircle2 className="w-3.5 h-3.5" />Passed</>}
                            </motion.span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="px-4 py-4 space-y-4">
                        {/* Info */}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Submitted by</div>
                            <p className="text-xs text-white/70">{selectedEquipment.submitted_by || "Unknown"}</p>
                          </div>
                          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                            <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Notes</div>
                            <p className="text-xs text-white/60 line-clamp-2">{selectedEquipment.notes?.trim() || "No notes"}</p>
                          </div>
                        </div>
                        
                        {/* Existing Fix */}
                        {selectedEquipment.mechanic_fixes && (
                          <div className="rounded-lg border border-[#ff9350]/20 bg-[#ff9350]/5 p-2.5">
                            <div className="text-[10px] uppercase tracking-wider text-[#ff9350]/70 mb-1.5">Mechanic Fix</div>
                            <p className="text-xs text-white/70">{selectedEquipment.mechanic_fixes}</p>
                            {selectedEquipment.last_mechanic_updated_at && <p className="text-[10px] text-white/40 mt-1">Updated {new Date(selectedEquipment.last_mechanic_updated_at).toLocaleDateString()}</p>}
                          </div>
                        )}
                        
                        {/* Checklists */}
                        <details className="group" open>
                          <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                            <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5 text-[#ff9350]/70" />Checklists</span>
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                          </summary>
                          <div className="grid gap-2 sm:grid-cols-2 pt-2">
                            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">General</div>
                              <div className="max-h-48 overflow-y-auto space-y-0.5">
                                {GENERAL_EQUIPMENT_ITEMS.map((item) => {
                                  const value = selectedEquipment.general_checklist?.[item.id];
                                  const status = value === "P" ? "pass" : value === "F" ? "fail" : value === "N/A" ? "na" : "pending";
                                  return (
                                    <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                      <span className="truncate">{item.label}</span>
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "pass" ? "bg-orange-400" : status === "fail" ? "bg-red-400" : status === "na" ? "bg-amber-400" : "bg-white/20"}`} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                              <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Template</div>
                              {getSpecificItems(selectedEquipment.template).length === 0 ? <p className="text-[11px] text-white/40">No template</p> : (
                                <div className="max-h-48 overflow-y-auto space-y-0.5">
                                  {getSpecificItems(selectedEquipment.template).map((item) => {
                                    const value = selectedEquipment.specific_checklist?.[item.id];
                                    const status = value === "P" ? "pass" : value === "F" ? "fail" : value === "N/A" ? "na" : "pending";
                                    return (
                                      <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                        <span className="truncate">{item.label}</span>
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "pass" ? "bg-orange-400" : status === "fail" ? "bg-red-400" : status === "na" ? "bg-amber-400" : "bg-white/20"}`} />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </details>
                        
                        {/* Photos */}
                        <details className="group">
                          <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                            <span className="flex items-center gap-1.5"><Camera className="w-3.5 h-3.5 text-[#ff9350]/70" />Photos ({equipmentPhotoEntries.length})</span>
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                          </summary>
                          {equipmentPhotoEntries.length === 0 ? <p className="text-[11px] text-white/40 pt-1">No photos uploaded</p> : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                              {equipmentPhotoEntries.map((photo) => (
                                <a key={photo.label} href={photo.url} target="_blank" rel="noopener noreferrer" className="group/img block rounded-lg border border-white/5 bg-black/30 overflow-hidden transition-all hover:border-[#ff9350]/30">
                                  <img src={photo.url} alt={photo.label} className="h-16 w-full object-cover transition-transform duration-200 group-hover/img:scale-105" />
                                  <div className="px-1.5 py-1 text-[9px] text-white/40 truncate">{photo.label}</div>
                                </a>
                              ))}
                            </div>
                          )}
                        </details>
                      </div>
                    </motion.div>

                    {/* Equipment Mechanic Fix Form */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-950/40 to-black/70 overflow-hidden shadow-xl shadow-orange-500/5"
                    >
                      <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-orange-500/15 to-transparent border-b border-orange-500/15">
                        <div className="flex items-center gap-3">
                          <motion.div 
                            whileHover={{ rotate: 20 }}
                            className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500/25 to-amber-500/15 border border-orange-400/30 flex items-center justify-center shadow-lg shadow-orange-500/10"
                          >
                            <Wrench className="w-4 h-4 text-orange-400" />
                          </motion.div>
                          <span className="text-sm font-semibold text-white">Record Equipment Fix</span>
                        </div>
                        {selectedEquipment.last_mechanic_updated_at && (
                          <span className="text-[10px] text-orange-300/50">Updated {new Date(selectedEquipment.last_mechanic_updated_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="px-5 py-4 space-y-4">
                        {/* Fix Description */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-orange-300/50 mb-1.5 font-medium">Fix Applied *</label>
                          <textarea value={equipmentMechanicNotes} onChange={(e) => setEquipmentMechanicNotes(e.target.value)} rows={2} placeholder="What was done? E.g., Replaced fuel filter..." className="w-full bg-black/40 border border-orange-500/20 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition-all resize-none placeholder:text-white/25" />
                        </div>
                        
                        {/* Cost */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-orange-300/50 mb-1.5 font-medium">Cost (Optional)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400/50" />
                            <input type="number" step="0.01" min="0" value={equipmentUpdateCost} onChange={(e) => setEquipmentUpdateCost(e.target.value)} placeholder="0.00" className="w-full bg-black/40 border border-orange-500/20 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/40 transition-all placeholder:text-white/25" />
                          </div>
                        </div>
                        
                        {/* Parts */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] uppercase tracking-wider text-orange-300/50 font-medium">Parts Used (Optional)</label>
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              type="button" 
                              onClick={handleAddEquipmentPart} 
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-orange-400 hover:text-orange-300 hover:bg-orange-500/15 border border-orange-500/20 transition-all"
                            >
                              <Plus className="w-3 h-3" />Add Part
                            </motion.button>
                          </div>
                          <AnimatePresence mode="popLayout">
                            {equipmentUpdateParts.length > 0 ? (
                              <motion.div layout className="space-y-2">
                                {equipmentUpdateParts.map((part, index) => (
                                  <motion.div 
                                    key={index} 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex gap-2 items-start"
                                  >
                                    <div className="flex-1 grid grid-cols-3 gap-2">
                                      <input type="text" placeholder="Part name" value={part.part_name} onChange={(e) => handleEquipmentPartChange(index, { ...part, part_name: e.target.value })} className="col-span-2 sm:col-span-1 bg-black/40 border border-orange-500/20 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all placeholder:text-white/25" />
                                      <input type="number" placeholder="Qty" min={1} value={part.quantity || ""} onChange={(e) => handleEquipmentPartChange(index, { ...part, quantity: parseInt(e.target.value) || 1 })} className="bg-black/40 border border-orange-500/20 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all placeholder:text-white/25" />
                                      <input type="text" placeholder="Part #" value={part.part_number || ""} onChange={(e) => handleEquipmentPartChange(index, { ...part, part_number: e.target.value })} className="bg-black/40 border border-orange-500/20 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/40 transition-all placeholder:text-white/25" />
                                    </div>
                                    <motion.button 
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      type="button" 
                                      onClick={() => handleEquipmentPartRemove(index)} 
                                      className="p-2.5 rounded-lg text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/15 transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </motion.button>
                                  </motion.div>
                                ))}
                              </motion.div>
                            ) : (
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="rounded-xl border border-dashed border-orange-500/20 p-4 text-center bg-orange-500/5"
                              >
                                <Package className="w-6 h-6 text-orange-400/30 mx-auto mb-2" />
                                <p className="text-xs text-white/40">No parts added yet</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {/* Save Message */}
                        <AnimatePresence>
                          {equipmentSaveMessage && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10, scale: 0.95 }} 
                              animate={{ opacity: 1, y: 0, scale: 1 }} 
                              exit={{ opacity: 0, y: -10, scale: 0.95 }} 
                              className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                                equipmentSaveMessage.includes("success") 
                                  ? "bg-orange-500/15 border border-orange-500/25 text-orange-300" 
                                  : "bg-rose-500/15 border border-rose-500/25 text-rose-300"
                              }`}
                            >
                              {equipmentSaveMessage.includes("success") ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                              {equipmentSaveMessage}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {/* Save Button */}
                        <motion.button 
                          whileHover={{ scale: 1.01, boxShadow: "0 10px 40px rgba(16, 185, 129, 0.3)" }}
                          whileTap={{ scale: 0.99 }}
                          type="button" 
                          onClick={handleSaveEquipmentFix} 
                          disabled={savingEquipmentFix} 
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/25"
                        >
                          {savingEquipmentFix ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><CheckCircle2 className="w-4 h-4" />Save Equipment Fix</>}
                        </motion.button>
                      </div>
                    </motion.div>
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
