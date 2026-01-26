import { useCallback, useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Truck,
  Wrench,
  ClipboardList,
  Search,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
  Images,
  FileSignature,
  ListChecks,
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

import {
  type DVIRReport,
  VEHICLE_TRAILER_ITEMS,
  AERIAL_LIFT_ITEMS,
} from "./types";
import {
  getFailedDVIRItems,
  getDVIRStatus,
  hasMechanicUpdate,
  formatDateTime,
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
import { dvirExportColumns } from "./exportColumns";

interface DVIRTabProps {
  dvirReports: DVIRReport[];
  dvirLoading: boolean;
  dvirError: string | null;
  dvirSearch: string;
  setDvirSearch: (value: string) => void;
  dvirStatus: "failed" | "passed";
  setDvirStatus: (value: "failed" | "passed") => void;
  dvirPage: number;
  setDvirPage: (value: number) => void;
  dvirPageSize: number;
  setDvirPageSize: (value: number) => void;
  dvirDateRange: string;
  setDvirDateRange: (value: string) => void;
  dvirTotalCount: number;
  showFilters: boolean;
  isExporting: boolean;
  setIsExporting: (value: boolean) => void;
  exportSuccess: string | null;
  setExportSuccess: (value: string | null) => void;
  userEmail: string | undefined;
  debouncedDvirSearch: string;
  onRefresh: () => void;
  setDvirReports: React.Dispatch<React.SetStateAction<DVIRReport[]>>;
  getDvirPublicUrl: (path?: string | null) => string | null;
}

export function DVIRTab({
  dvirReports,
  dvirLoading,
  dvirError,
  dvirSearch,
  setDvirSearch,
  dvirStatus,
  setDvirStatus,
  dvirPage,
  setDvirPage,
  dvirPageSize,
  setDvirPageSize,
  dvirDateRange,
  setDvirDateRange,
  dvirTotalCount,
  showFilters,
  isExporting,
  setIsExporting,
  exportSuccess,
  setExportSuccess,
  userEmail,
  debouncedDvirSearch,
  onRefresh,
  setDvirReports,
  getDvirPublicUrl,
}: DVIRTabProps) {
  const prefersReducedMotion = useReducedMotion();

  const isStoragePath = useCallback((s: string) => /[/\\]/.test(s) || /\.(png|jpe?g|webp)$/i.test(s), []);
  
  // Selection state
  const [selectedDvirId, setSelectedDvirId] = useState<string | null>(null);

  // Form state
  const [dvirUpdateTruckNumber, setDvirUpdateTruckNumber] = useState("");
  const [dvirUpdateDate, setDvirUpdateDate] = useState("");
  const [dvirUpdateDeficiency, setDvirUpdateDeficiency] = useState("");
  const [dvirUpdateRemarks, setDvirUpdateRemarks] = useState("");
  const [dvirUpdateCost, setDvirUpdateCost] = useState("");
  const [dvirUpdateParts, setDvirUpdateParts] = useState<{ part_name: string; quantity: number; part_number: string }[]>([]);
  const [savingDvirUpdate, setSavingDvirUpdate] = useState(false);
  const [dvirSaveMessage, setDvirSaveMessage] = useState<string | null>(null);

  // Filtered data
  const filteredDvirReports = useMemo(() => {
    let filtered = dvirReports;
    if (dvirStatus === "failed") {
      filtered = filtered.filter((r) => getDVIRStatus(r) === "failed");
    } else {
      filtered = filtered.filter((r) => getDVIRStatus(r) === "passed");
    }
    if (debouncedDvirSearch.trim()) {
      const query = debouncedDvirSearch.toLowerCase();
      filtered = filtered.filter(
        (r) => r.truck_number?.toLowerCase().includes(query) || r.drivers_name?.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [dvirReports, dvirStatus, debouncedDvirSearch]);

  const failedDvirCount = useMemo(() => dvirReports.filter((r) => getDVIRStatus(r) === "failed").length, [dvirReports]);
  const passedDvirCount = useMemo(() => dvirReports.filter((r) => getDVIRStatus(r) === "passed").length, [dvirReports]);

  const selectedDvir = useMemo(() => dvirReports.find((r) => r.id === selectedDvirId) || null, [dvirReports, selectedDvirId]);

  // Populate form when selection changes
  useEffect(() => {
    if (!selectedDvir) {
      setDvirUpdateTruckNumber("");
      setDvirUpdateDate("");
      setDvirUpdateDeficiency("");
      setDvirUpdateRemarks("");
      setDvirUpdateCost("");
      setDvirUpdateParts([]);
      return;
    }
    setDvirUpdateTruckNumber(selectedDvir.mechanic_truck_number || "");
    setDvirUpdateDate(selectedDvir.mechanic_date || "");
    setDvirUpdateDeficiency(selectedDvir.deficiency_corrected || "");
    setDvirUpdateRemarks(selectedDvir.mechanic_remarks || "");
    setDvirUpdateCost(selectedDvir.mechanic_cost?.toString() || "");
    const existingParts = selectedDvir.mechanic_parts_used;
    setDvirUpdateParts(existingParts?.map(p => ({ part_name: p.part_name, quantity: p.quantity, part_number: p.part_number || "" })) || []);
  }, [selectedDvir]);

  // Parts handlers
  const handleAddDvirPart = () => {
    setDvirUpdateParts(prev => [...prev, { part_name: "", quantity: 1, part_number: "" }]);
  };
  const handleDvirPartChange = (index: number, part: { part_name: string; quantity: number; part_number: string }) => {
    setDvirUpdateParts(prev => { const newParts = [...prev]; newParts[index] = part; return newParts; });
  };
  const handleDvirPartRemove = (index: number) => {
    setDvirUpdateParts(prev => prev.filter((_, i) => i !== index));
  };

  // Save handler
  const handleSaveDvirUpdate = async () => {
    if (!selectedDvir) return;
    try {
      setSavingDvirUpdate(true);
      setDvirSaveMessage(null);
      const validParts = dvirUpdateParts.filter(p => p.part_name.trim());
      const costValue = dvirUpdateCost ? parseFloat(dvirUpdateCost) : null;
      const { error } = await supabase.from("dvir_reports").update({
        mechanic_truck_number: dvirUpdateTruckNumber || null,
        mechanic_date: dvirUpdateDate || null,
        deficiency_corrected: dvirUpdateDeficiency || null,
        mechanic_remarks: dvirUpdateRemarks || null,
        mechanic_cost: costValue,
        mechanic_parts_used: validParts.length > 0 ? validParts : null,
      }).eq("id", selectedDvir.id);
      if (error) throw error;
      setDvirReports((prev) => prev.map((r) => r.id === selectedDvir.id ? { 
        ...r, 
        mechanic_truck_number: dvirUpdateTruckNumber || null, 
        mechanic_date: dvirUpdateDate || null, 
        deficiency_corrected: dvirUpdateDeficiency || null, 
        mechanic_remarks: dvirUpdateRemarks || null,
        mechanic_cost: costValue,
        mechanic_parts_used: validParts.length > 0 ? validParts : null,
      } : r));
      setDvirSaveMessage("Fix recorded successfully!");
      setTimeout(() => setDvirSaveMessage(null), 4000);
    } catch {
      setDvirSaveMessage("Failed to save. Please try again.");
      setTimeout(() => setDvirSaveMessage(null), 4000);
    } finally {
      setSavingDvirUpdate(false);
    }
  };

  // Export handler
  const handleExportDvir = useCallback(async (exportFormat: "csv" | "excel" | "pdf") => {
    setIsExporting(true);
    setExportSuccess(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const exporter = new DataExporter<DVIRReport>();
      const metadata: ExportMetadata = {
        reportType: "DVIR Reports Export",
        generatedAt: new Date(),
        exportedBy: userEmail || "Unknown",
        filters: {
          "Status": dvirStatus === "failed" ? "Needs Review" : "Passed",
          "Search": debouncedDvirSearch || "None",
        },
        totalRecords: filteredDvirReports.length,
      };
      
      const filename = generateFilename("DVIR_Reports", dvirStatus);
      
      switch (exportFormat) {
        case "csv":
          exporter.exportCSV({
            data: filteredDvirReports,
            columns: dvirExportColumns,
            filename,
            metadata,
          });
          setExportSuccess("DVIR data exported to CSV!");
          break;
        case "excel":
          exporter.exportExcel({
            data: filteredDvirReports,
            columns: dvirExportColumns,
            filename: filename.replace(".csv", ".xlsx"),
            metadata,
          });
          setExportSuccess("DVIR data exported to Excel!");
          break;
        case "pdf":
          exporter.exportPDF({
            data: filteredDvirReports,
            columns: dvirExportColumns,
            filename: filename.replace(".csv", ".pdf"),
            metadata,
            companyName: "All Terrain Tree Service",
            subtitle: `Status: ${dvirStatus === "failed" ? "Needs Review" : "Passed"}`,
            orientation: "landscape",
          });
          setExportSuccess("DVIR data exported to PDF!");
          break;
      }
      
      setTimeout(() => setExportSuccess(null), 3000);
    } catch {
      // Export failed silently
    } finally {
      setIsExporting(false);
    }
  }, [filteredDvirReports, dvirStatus, debouncedDvirSearch, userEmail, setIsExporting, setExportSuccess]);

  // Media entries
  const dvirMediaEntries = useMemo(() => {
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

  const dvirSignatureEntries = useMemo(() => {
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

  const dvirTotalPages = Math.max(1, Math.ceil(dvirTotalCount / dvirPageSize));

  return (
    <div className="space-y-4">
      {/* DVIR FILTER BAR */}
      <ScrollRevealSection delay={0}>
        <motion.div 
          layout
          className="rounded-2xl border-2 border-orange-600/40 bg-gradient-to-br from-gray-900 via-orange-950/50 to-gray-900 p-4 shadow-xl shadow-orange-500/10"
        >
          <div className="flex flex-col gap-4">
            {/* Primary filters row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Status toggle */}
              <div className="flex gap-1.5 p-1.5 bg-gray-950 rounded-xl border border-gray-800">
                {[
                  { id: "failed" as const, label: "Need Review", shortLabel: "Review", icon: AlertTriangle, count: failedDvirCount, activeGradient: "from-rose-600 to-red-700", activeBorder: "border-rose-400/50", inactiveIcon: "text-rose-400" },
                  { id: "passed" as const, label: "Passed", shortLabel: "Pass", icon: CheckCircle2, count: passedDvirCount, activeGradient: "from-emerald-600 to-green-700", activeBorder: "border-emerald-400/50", inactiveIcon: "text-emerald-400" },
                ].map(({ id, label, shortLabel, icon: Icon, count, activeGradient, activeBorder, inactiveIcon }) => (
                  <motion.button
                    key={id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setDvirStatus(id); setDvirPage(1); }}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                      dvirStatus === id
                        ? `bg-gradient-to-r ${activeGradient} text-white shadow-lg border ${activeBorder}`
                        : "text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${dvirStatus === id ? "text-white" : inactiveIcon}`} />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                    <motion.span 
                      key={count}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black ${dvirStatus === id ? "bg-white/30" : "bg-gray-800 text-gray-400"}`}
                    >
                      {count}
                    </motion.span>
                  </motion.button>
                ))}
              </div>
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
                <input
                  type="text"
                  placeholder="Search truck # or driver name..."
                  value={dvirSearch}
                  onChange={(e) => { setDvirSearch(e.target.value); setDvirPage(1); }}
                  className="w-full bg-gray-950 border-2 border-gray-800 rounded-xl pl-11 pr-11 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                />
                {dvirSearch && (
                  <motion.button 
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    onClick={() => { setDvirSearch(""); setDvirPage(1); }} 
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
                  disabled={dvirLoading}
                  className="p-3 rounded-xl bg-gradient-to-br from-orange-600 to-amber-700 border border-orange-400/50 text-white hover:shadow-lg hover:shadow-orange-500/30 disabled:opacity-50 transition-all"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${dvirLoading ? "animate-spin" : ""}`} />
                </motion.button>
                
                {/* Export Dropdown */}
                <div className="relative group">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isExporting || filteredDvirReports.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 border border-blue-400/50 text-white text-xs font-bold hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="hidden sm:inline">Export</span>
                  </motion.button>
                  <div className="absolute right-0 top-full mt-2 w-40 bg-gray-950 border-2 border-gray-800 rounded-xl shadow-2xl shadow-black/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                    <button type="button" onClick={() => handleExportDvir("csv")} disabled={isExporting} aria-label="Export DVIR as CSV" className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-orange-600/20 transition-colors min-h-[44px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-inset">
                      <FileSpreadsheet className="w-4 h-4 text-orange-400" aria-hidden /> CSV
                    </button>
                    <button type="button" onClick={() => handleExportDvir("excel")} disabled={isExporting} aria-label="Export DVIR as Excel" className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-orange-600/20 transition-colors border-t border-gray-800 min-h-[44px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-inset">
                      <Table className="w-4 h-4 text-orange-400" aria-hidden /> Excel
                    </button>
                    <button type="button" onClick={() => handleExportDvir("pdf")} disabled={isExporting} aria-label="Export DVIR as PDF" className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-orange-600/20 transition-colors border-t border-gray-800 min-h-[44px] focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-inset">
                      <FileDown className="w-4 h-4 text-orange-400" aria-hidden /> PDF
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
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-600/20 border border-orange-500/30">
                      <Calendar className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-semibold text-orange-200">Date Range:</span>
                    </div>
                    <DateRangeChips
                      activeRange={dvirDateRange}
                      onRangeChange={(range) => { setDvirDateRange(range); setDvirPage(1); }}
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

      {/* DVIR Content */}
      <ScrollRevealSection delay={0.1}>
        {dvirLoading && (
          <div className="space-y-3">
            <div className="hidden lg:block"><TableSkeleton rows={5} columns={4} variant="ember" /></div>
            <div className="lg:hidden"><CardListSkeleton rows={4} variant="ember" /></div>
          </div>
        )}
        {dvirError && <div className="rounded-xl border-2 border-red-500/50 bg-red-950/80 px-4 py-3 text-sm text-red-200 font-medium">{dvirError}</div>}
        {!dvirLoading && !dvirError && (
          <div className="grid gap-4 lg:grid-cols-3">
            {/* DVIR LIST PANEL */}
            <motion.div 
              layout
              className="rounded-2xl border-2 border-orange-600/40 bg-gradient-to-b from-gray-900 via-orange-950/40 to-gray-950 overflow-hidden flex flex-col shadow-2xl shadow-orange-500/10"
            >
              {/* Panel Header */}
              <div className={`flex items-center justify-between px-4 py-3 ${
                dvirStatus === "failed" 
                  ? "bg-gradient-to-r from-rose-700/80 to-rose-900/60" 
                  : "bg-gradient-to-r from-emerald-700/80 to-emerald-900/60"
              }`}>
                <div className="flex items-center gap-3">
                  <motion.div 
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`w-3 h-3 rounded-full ${dvirStatus === "failed" ? "bg-rose-300" : "bg-emerald-300"}`} 
                  />
                  <span className="text-sm font-bold text-white">{dvirStatus === "failed" ? "Need Review" : "Passed"}</span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-white/20 text-white">
                    {filteredDvirReports.length}
                  </span>
                </div>
              </div>
              
              {/* List content */}
              <div className="max-h-[420px] overflow-y-auto flex-1">
                {filteredDvirReports.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-8 text-center"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-700 to-amber-800 border-2 border-orange-500/50 flex items-center justify-center shadow-lg shadow-orange-500/30"
                    >
                      {dvirSearch ? <Search className="w-9 h-9 text-white/70" /> : dvirStatus === "failed" ? <CheckCircle2 className="w-9 h-9 text-white" /> : <ClipboardList className="w-9 h-9 text-white/70" />}
                    </motion.div>
                    <p className="text-base font-bold text-white mb-1">
                      {dvirSearch ? "No matches found" : dvirStatus === "failed" ? "All clear!" : "No records"}
                    </p>
                    <p className="text-sm text-gray-400">
                      {dvirSearch ? "Try a different search term" : dvirStatus === "failed" ? "No DVIRs need review" : "No passed DVIRs yet"}
                    </p>
                  </motion.div>
                ) : (
                  filteredDvirReports.map((report, index) => {
                    const { allFails } = getFailedDVIRItems(report);
                    const status = getDVIRStatus(report);
                    const mechanicFlag = hasMechanicUpdate(report);
                    const isSelected = report.id === selectedDvirId;
                    return (
                      <motion.button
                        key={report.id}
                        custom={index}
                        variants={prefersReducedMotion ? listItemVariantsReduced : listItemVariants}
                        initial="hidden"
                        animate="visible"
                        whileHover={{ backgroundColor: "rgba(251, 146, 60, 0.15)" }}
                        onClick={() => setSelectedDvirId(isSelected ? null : report.id)}
                        className={`w-full text-left px-4 py-3.5 transition-all duration-200 flex items-center gap-3 group border-b border-gray-800/50 ${
                          isSelected 
                            ? "bg-gradient-to-r from-orange-600/30 to-transparent border-l-4 border-l-orange-500" 
                            : "border-l-4 border-l-transparent hover:border-l-orange-500/50"
                        }`}
                      >
                        <motion.div 
                          whileHover={{ scale: 1.4 }}
                          className={`w-3 h-3 rounded-full flex-shrink-0 shadow-lg ${status === "failed" ? "bg-rose-500 shadow-rose-500/50" : "bg-emerald-500 shadow-emerald-500/50"}`} 
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white">{report.truck_number || "N/A"}</span>
                            {mechanicFlag && (
                              <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center px-2 py-0.5 bg-emerald-600/30 border border-emerald-500/50 rounded-md text-[9px] text-emerald-300 font-bold"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Fixed
                              </motion.span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400 truncate">{report.drivers_name || "Unknown"}</span>
                            <span className="text-gray-600">•</span>
                            <span className="text-[10px] text-gray-500">{formatDateTime(report.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {allFails.length > 0 && (
                            <motion.span 
                              whileHover={{ scale: 1.15 }}
                              className="text-xs font-black text-white bg-gradient-to-r from-rose-600 to-red-700 px-2.5 py-1 rounded-lg shadow-lg shadow-rose-500/30"
                            >
                              {allFails.length}
                            </motion.span>
                          )}
                          <ChevronRight className={`w-5 h-5 transition-all duration-200 ${isSelected ? "text-orange-400 rotate-90" : "text-gray-600 group-hover:text-orange-400"}`} />
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </div>
              
              {/* Pagination */}
              {dvirTotalCount > 0 && (
                <div className="px-3 py-3 border-t-2 border-gray-800 bg-gray-950/80">
                  <AdvancedPagination
                    currentPage={dvirPage}
                    totalPages={dvirTotalPages}
                    totalItems={dvirTotalCount}
                    pageSize={dvirPageSize}
                    onPageChange={setDvirPage}
                    onPageSizeChange={(size) => { setDvirPageSize(size); setDvirPage(1); }}
                    pageSizeOptions={[10, 15, 25, 50]}
                    variant="amber"
                    compact
                  />
                </div>
              )}
            </motion.div>

            {/* DVIR DETAIL PANEL */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {!selectedDvir ? (
                  <motion.div 
                    key="empty-state" 
                    {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} 
                    className="h-full min-h-[300px] rounded-2xl border-2 border-orange-600/30 bg-gradient-to-br from-gray-900 via-orange-950/30 to-gray-950 p-8 flex flex-col items-center justify-center text-center shadow-xl"
                  >
                    <motion.div 
                      animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-700 to-amber-800 border-2 border-orange-500/50 mb-5 shadow-xl shadow-orange-500/30"
                    >
                      <ClipboardList className="w-9 h-9 text-white" />
                    </motion.div>
                    <p className="text-lg font-bold text-white mb-2">Select a DVIR Report</p>
                    <p className="text-sm text-gray-400">Choose a report from the list to view details and record fixes</p>
                  </motion.div>
                ) : (
                  <motion.div key={selectedDvirId} {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} className="space-y-4">
                    {/* Report Details */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative rounded-2xl border-2 border-orange-500/50 bg-gradient-to-br from-orange-950 via-amber-950/80 to-gray-950 overflow-hidden shadow-2xl shadow-orange-500/20"
                    >
                      {/* Detail Header */}
                      <div className={`relative px-5 py-5 ${
                        getDVIRStatus(selectedDvir) === "failed"
                          ? "bg-gradient-to-r from-orange-700 via-amber-800 to-orange-800"
                          : "bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-800"
                      }`}>
                        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <motion.div 
                              whileHover={{ rotate: 15, scale: 1.15 }}
                              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/30 to-white/10 border-2 border-white/40 flex items-center justify-center flex-shrink-0 shadow-2xl backdrop-blur-sm"
                            >
                              <Truck className="w-8 h-8 text-white drop-shadow-lg" />
                            </motion.div>
                            <div className="min-w-0">
                              <h3 className="text-2xl font-black text-white truncate drop-shadow-lg">Truck {selectedDvir.truck_number || "N/A"}</h3>
                              <div className="flex items-center gap-3 text-sm text-white/90 mt-1.5">
                                <span className="truncate font-medium">{selectedDvir.drivers_name || "Unknown"}</span>
                                <span className="text-white/40">•</span>
                                <span className="text-amber-200 font-bold">{selectedDvir.mileage?.toLocaleString() || "—"} mi</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                            {hasMechanicUpdate(selectedDvir) && (
                              <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-700 border-2 border-emerald-400/60 rounded-xl text-sm font-bold text-white shadow-xl shadow-emerald-500/30"
                              >
                                <Wrench className="w-4 h-4" />Fixed
                              </motion.span>
                            )}
                            <motion.span 
                              whileHover={{ scale: 1.05 }}
                              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-xl ${
                                getDVIRStatus(selectedDvir) === "failed" 
                                  ? "bg-gradient-to-r from-rose-600 to-red-700 text-white border-2 border-rose-400/60 shadow-rose-500/30" 
                                  : "bg-gradient-to-r from-emerald-600 to-green-700 text-white border-2 border-emerald-400/60 shadow-emerald-500/30"
                              }`}
                            >
                              {getDVIRStatus(selectedDvir) === "failed" 
                                ? <><AlertTriangle className="w-4 h-4" />Needs Review</> 
                                : <><CheckCircle2 className="w-4 h-4" />Passed</>}
                            </motion.span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="relative px-5 py-5 space-y-4">
                        {/* Failures */}
                        {(() => {
                          const { vehicleFails, aerialFails, allFails } = getFailedDVIRItems(selectedDvir);
                          if (allFails.length === 0) {
                            return (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-900/60 to-green-900/40 px-5 py-4 flex items-center gap-4"
                              >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                  <CheckCircle2 className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                  <span className="text-base font-bold text-emerald-100 block">All items passed inspection</span>
                                  <span className="text-sm text-emerald-200/60">No issues detected during review</span>
                                </div>
                              </motion.div>
                            );
                          }
                          return (
                            <div className="space-y-4">
                              <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-rose-800/60 to-red-900/40 border-2 border-rose-500/50 rounded-xl"
                              >
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
                                  <AlertTriangle className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <span className="text-base font-bold text-rose-100">{allFails.length} Failed Item{allFails.length !== 1 ? "s" : ""}</span>
                                  <span className="text-sm text-rose-200/60 block">Requires mechanic attention</span>
                                </div>
                              </motion.div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                {vehicleFails.length > 0 && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="rounded-xl border-2 border-rose-500/40 bg-gradient-to-br from-rose-950/80 to-red-950/60 p-4 max-h-48 overflow-y-auto"
                                  >
                                    <div className="text-xs uppercase tracking-wider text-rose-300 font-bold mb-3 flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                                      Vehicle / Trailer
                                    </div>
                                    <ul className="space-y-2">{vehicleFails.map((label) => <li key={label} className="flex items-start gap-3 text-sm text-rose-100 font-medium"><span className="w-2 h-2 bg-rose-500 rounded-full mt-1.5 flex-shrink-0" />{label}</li>)}</ul>
                                  </motion.div>
                                )}
                                {aerialFails.length > 0 && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className="rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-950/80 to-orange-950/60 p-4 max-h-48 overflow-y-auto"
                                  >
                                    <div className="text-xs uppercase tracking-wider text-amber-300 font-bold mb-3 flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                      Aerial Lift
                                    </div>
                                    <ul className="space-y-2">{aerialFails.map((label) => <li key={label} className="flex items-start gap-3 text-sm text-amber-100 font-medium"><span className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />{label}</li>)}</ul>
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Notes and Info */}
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border-2 border-orange-600/30 bg-gradient-to-br from-orange-950/60 to-gray-950 p-4">
                            <div className="text-xs uppercase tracking-wider text-orange-300 font-bold mb-2 flex items-center gap-2">
                              <ClipboardList className="w-3.5 h-3.5" />Driver Notes
                            </div>
                            <p className="text-sm text-gray-200 line-clamp-2">{selectedDvir.notes?.trim() || "No notes provided"}</p>
                          </div>
                          <div className="rounded-xl border-2 border-orange-600/30 bg-gradient-to-br from-orange-950/60 to-gray-950 p-4">
                            <div className="text-xs uppercase tracking-wider text-orange-300 font-bold mb-2 flex items-center gap-2">
                              <Truck className="w-3.5 h-3.5" />Vehicle Info
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                              <div className="text-gray-400">Chipper: <span className="font-bold text-white">{selectedDvir.chipper_number || "—"}</span></div>
                              <div className="text-gray-400">Trailer: <span className="font-bold text-white">{selectedDvir.trailer_number || "—"}</span></div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Existing Fix */}
                        {hasMechanicUpdate(selectedDvir) && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/70 to-green-950/50 p-5"
                          >
                            <div className="text-xs uppercase tracking-wider text-emerald-300 font-bold mb-3 flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center">
                                <Wrench className="w-3.5 h-3.5 text-white" />
                              </div>
                              Mechanic Fix Applied
                            </div>
                            <p className="text-base text-white font-semibold">{selectedDvir.deficiency_corrected || "—"}</p>
                            {selectedDvir.mechanic_remarks && <p className="text-sm text-gray-300 mt-3 border-t border-emerald-500/20 pt-3">Remarks: {selectedDvir.mechanic_remarks}</p>}
                            {selectedDvir.mechanic_date && <p className="text-xs text-emerald-300/60 mt-2">Date: {selectedDvir.mechanic_date}</p>}
                          </motion.div>
                        )}
                        
                        {/* Checklists */}
                        <details className="group rounded-xl border-2 border-gray-700/50 overflow-hidden">
                          <summary className="flex items-center justify-between cursor-pointer px-4 py-3 bg-gray-900/80 text-sm font-bold text-gray-200 hover:text-white hover:bg-gray-800/80 transition-colors">
                            <span className="flex items-center gap-2"><ListChecks className="w-4 h-4 text-orange-400" />Full Checklist Review</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-orange-400" />
                          </summary>
                          <div className="grid gap-3 sm:grid-cols-2 p-3 bg-gray-950/80">
                            <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
                              <div className="text-[10px] uppercase tracking-wider text-orange-300 font-bold mb-3">Vehicle / Trailer</div>
                              <div className="max-h-52 overflow-y-auto space-y-1">
                                {VEHICLE_TRAILER_ITEMS.map((item) => {
                                  const value = selectedDvir.vehicle_trailer_checklist?.[item.id];
                                  const status = value === "P" ? "pass" : value === "F" ? "fail" : value === "N/A" ? "na" : "pending";
                                  return (
                                    <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-800/50 text-sm text-gray-300 gap-2">
                                      <span className="truncate">{item.label}</span>
                                      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${status === "pass" ? "bg-emerald-500" : status === "fail" ? "bg-rose-500" : status === "na" ? "bg-amber-500" : "bg-gray-600"}`} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="rounded-xl border border-gray-800 bg-gray-900 p-3">
                              <div className="text-[10px] uppercase tracking-wider text-orange-300 font-bold mb-3">Aerial Lift</div>
                              <div className="max-h-52 overflow-y-auto space-y-1">
                                {AERIAL_LIFT_ITEMS.map((item) => {
                                  const value = selectedDvir.aerial_checklist?.[item.id];
                                  const status = value === "P" ? "pass" : value === "F" ? "fail" : value === "N/A" ? "na" : "pending";
                                  return (
                                    <div key={item.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-800/50 text-sm text-gray-300 gap-2">
                                      <span className="truncate">{item.label}</span>
                                      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${status === "pass" ? "bg-emerald-500" : status === "fail" ? "bg-rose-500" : status === "na" ? "bg-amber-500" : "bg-gray-600"}`} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </details>
                        
                        {/* Photos */}
                        <details className="group rounded-xl border-2 border-gray-700/50 overflow-hidden">
                          <summary className="flex items-center justify-between cursor-pointer px-4 py-3 bg-gray-900/80 text-sm font-bold text-gray-200 hover:text-white hover:bg-gray-800/80 transition-colors">
                            <span className="flex items-center gap-2"><Images className="w-4 h-4 text-orange-400" />Photos ({dvirMediaEntries.length})</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-orange-400" />
                          </summary>
                          {dvirMediaEntries.length === 0 ? <p className="px-4 py-3 text-sm text-gray-500 bg-gray-950/80">No photos uploaded</p> : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-950/80">
                              {dvirMediaEntries.map((media) => (
                                <a key={media.label} href={media.url} target="_blank" rel="noopener noreferrer" className="group/img block rounded-xl border-2 border-gray-800 bg-gray-900 overflow-hidden transition-all hover:border-orange-500/50 hover:shadow-lg">
                                  <img src={media.url} alt={media.label} className="h-24 w-full object-cover transition-transform duration-200 group-hover/img:scale-105" />
                                  <div className="px-2 py-2 text-xs text-gray-300 truncate font-medium">{media.label}</div>
                                </a>
                              ))}
                            </div>
                          )}
                        </details>
                        
                        {/* Signatures */}
                        <details className="group rounded-xl border-2 border-gray-700/50 overflow-hidden">
                          <summary className="flex items-center justify-between cursor-pointer px-4 py-3 bg-gray-900/80 text-sm font-bold text-gray-200 hover:text-white hover:bg-gray-800/80 transition-colors">
                            <span className="flex items-center gap-2"><FileSignature className="w-4 h-4 text-orange-400" />Signatures ({dvirSignatureEntries.length})</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 text-orange-400" />
                          </summary>
                          {dvirSignatureEntries.length === 0 ? <p className="px-4 py-3 text-sm text-gray-500 bg-gray-950/80">No signatures</p> : (
                            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-950/80">
                              {dvirSignatureEntries.map((sig) =>
                                "url" in sig && sig.url ? (
                                  <a key={sig.label} href={sig.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border-2 border-gray-800 bg-gray-900 p-3 transition-all hover:border-orange-500/50">
                                    <div className="text-xs text-gray-400 mb-2 truncate font-semibold">{sig.label}</div>
                                    <img src={sig.url} alt={sig.label} className="h-20 w-full object-contain bg-white/5 rounded-lg" />
                                  </a>
                                ) : (
                                  <div key={sig.label} className="rounded-xl border-2 border-gray-800 bg-gray-900 p-3">
                                    <div className="text-xs text-gray-400 mb-2 truncate font-semibold">{sig.label}</div>
                                    <p className="text-sm text-white truncate">{sig.text ?? "—"}</p>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </details>
                      </div>
                    </motion.div>

                    {/* MECHANIC UPDATE FORM */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="rounded-2xl border-2 border-orange-600/40 bg-gradient-to-br from-gray-900 via-orange-950/40 to-gray-950 overflow-hidden shadow-2xl shadow-orange-500/10"
                    >
                      <div className="px-5 py-4 bg-gradient-to-r from-orange-700 to-amber-800">
                        <div className="flex items-center gap-3">
                          <motion.div 
                            whileHover={{ rotate: 20, scale: 1.1 }}
                            className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shadow-lg"
                          >
                            <Wrench className="w-5 h-5 text-white" />
                          </motion.div>
                          <div>
                            <span className="text-base font-bold text-white block">Record Mechanic Fix</span>
                            <span className="text-xs text-orange-100/70">Document repair work and parts used</span>
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-5 space-y-5">
                        {/* Truck # & Date */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs uppercase tracking-wider text-orange-300 mb-2 font-bold">Truck #</label>
                            <input value={dvirUpdateTruckNumber} onChange={(e) => setDvirUpdateTruckNumber(e.target.value)} placeholder="e.g., 101" className="w-full bg-gray-950 border-2 border-gray-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all placeholder:text-gray-600" />
                          </div>
                          <div>
                            <label className="block text-xs uppercase tracking-wider text-orange-300 mb-2 font-bold">Date</label>
                            <input type="date" value={dvirUpdateDate} onChange={(e) => setDvirUpdateDate(e.target.value)} className="w-full bg-gray-950 border-2 border-gray-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all [color-scheme:dark]" />
                          </div>
                        </div>
                        
                        {/* Fix Description */}
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-orange-300 mb-2 font-bold">Fix Applied <span className="text-rose-400">*</span></label>
                          <textarea value={dvirUpdateDeficiency} onChange={(e) => setDvirUpdateDeficiency(e.target.value)} rows={2} placeholder="What was done? E.g., Replaced brake pads..." className="w-full bg-gray-950 border-2 border-gray-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none placeholder:text-gray-600" />
                        </div>
                        
                        {/* Cost */}
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-orange-300 mb-2 font-bold">Repair Cost <span className="text-gray-500">(Optional)</span></label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
                            <input type="number" step="0.01" min="0" value={dvirUpdateCost} onChange={(e) => setDvirUpdateCost(e.target.value)} placeholder="0.00" className="w-full bg-gray-950 border-2 border-gray-700 text-white text-sm rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all placeholder:text-gray-600" />
                          </div>
                        </div>
                        
                        {/* Parts */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-xs uppercase tracking-wider text-orange-300 font-bold">Parts Used <span className="text-gray-500">(Optional)</span></label>
                            <motion.button 
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              type="button" 
                              onClick={handleAddDvirPart} 
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:shadow-lg hover:shadow-orange-500/30 border border-orange-400/30 transition-all"
                            >
                              <Plus className="w-4 h-4" />Add Part
                            </motion.button>
                          </div>
                          <AnimatePresence mode="popLayout">
                            {dvirUpdateParts.length > 0 ? (
                              <motion.div layout className="space-y-3">
                                {dvirUpdateParts.map((part, index) => (
                                  <motion.div 
                                    key={index} 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="flex gap-3 items-start p-3 rounded-xl bg-gray-900 border-2 border-gray-700"
                                  >
                                    <div className="flex-1 grid grid-cols-3 gap-2">
                                      <input type="text" placeholder="Part name" value={part.part_name} onChange={(e) => handleDvirPartChange(index, { ...part, part_name: e.target.value })} className="col-span-2 sm:col-span-1 bg-gray-950 border-2 border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-gray-600" />
                                      <input type="number" placeholder="Qty" min={1} value={part.quantity || ""} onChange={(e) => handleDvirPartChange(index, { ...part, quantity: parseInt(e.target.value) || 1 })} className="bg-gray-950 border-2 border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-gray-600" />
                                      <input type="text" placeholder="Part #" value={part.part_number || ""} onChange={(e) => handleDvirPartChange(index, { ...part, part_number: e.target.value })} className="bg-gray-950 border-2 border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-gray-600" />
                                    </div>
                                    <motion.button 
                                      whileHover={{ scale: 1.15 }}
                                      whileTap={{ scale: 0.9 }}
                                      type="button" 
                                      onClick={() => handleDvirPartRemove(index)} 
                                      className="p-3 rounded-xl bg-rose-600/20 text-rose-400 hover:text-white hover:bg-rose-600/40 border border-rose-500/30 transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </motion.button>
                                  </motion.div>
                                ))}
                              </motion.div>
                            ) : (
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="rounded-xl border-2 border-dashed border-gray-700 p-6 text-center bg-gray-950/50"
                              >
                                <Package className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                                <p className="text-sm text-gray-500 font-medium">No parts added yet</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {/* Remarks */}
                        <div>
                          <label className="block text-xs uppercase tracking-wider text-orange-300 mb-2 font-bold">Additional Notes <span className="text-gray-500">(Optional)</span></label>
                          <textarea value={dvirUpdateRemarks} onChange={(e) => setDvirUpdateRemarks(e.target.value)} rows={2} placeholder="Any additional details..." className="w-full bg-gray-950 border-2 border-gray-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none placeholder:text-gray-600" />
                        </div>
                        
                        {/* Save Message */}
                        <AnimatePresence>
                          {dvirSaveMessage && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10, scale: 0.95 }} 
                              animate={{ opacity: 1, y: 0, scale: 1 }} 
                              exit={{ opacity: 0, y: -10, scale: 0.95 }} 
                              className={`rounded-xl px-4 py-3 text-sm font-bold flex items-center gap-3 ${
                                dvirSaveMessage.includes("success") 
                                  ? "bg-emerald-900/50 border-2 border-emerald-500/50 text-emerald-200" 
                                  : "bg-rose-900/50 border-2 border-rose-500/50 text-rose-200"
                              }`}
                            >
                              {dvirSaveMessage.includes("success") ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                              {dvirSaveMessage}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {/* Save Button */}
                        <motion.button 
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          type="button" 
                          onClick={handleSaveDvirUpdate} 
                          disabled={savingDvirUpdate} 
                          className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 animate-gradient px-6 py-4 text-base font-black text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-orange-500/30 border-2 border-orange-400/30"
                        >
                          {savingDvirUpdate ? <><Loader2 className="w-5 h-5 animate-spin" />Saving...</> : <><CheckCircle2 className="w-5 h-5" />Save Mechanic Update</>}
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
