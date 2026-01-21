import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Truck,
  Wrench,
  Shield,
  AlertTriangle,
  HardHat,
  Filter,
  Zap,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { logger } from "../../lib/logger";
import type { DVIRReport, EquipmentInspection } from "./equipment-logs/types";
import { getDVIRStatus, inspectionHasFailures, getDateRangeStart } from "./equipment-logs/helpers";
import { ScrollRevealSection } from "./equipment-logs/animations";
import { DVIRTab } from "./equipment-logs/DVIRTab";
import { EquipmentTab } from "./equipment-logs/EquipmentTab";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function GeneralForemanEquipmentLogs() {
  const { role } = useAuth();
  const hasAccess = role === "general_foreman" || role === "admin";

  // Tab state
  const [activeTab, setActiveTab] = useState<"dvir" | "equipment">("dvir");

  // DVIR state
  const [dvirReports, setDvirReports] = useState<DVIRReport[]>([]);
  const [dvirLoading, setDvirLoading] = useState(true);
  const [dvirError, setDvirError] = useState<string | null>(null);
  const [selectedDvirId, setSelectedDvirId] = useState<string | null>(null);
  const [dvirSearch, setDvirSearch] = useState("");
  const debouncedDvirSearch = useDebouncedValue(dvirSearch, 300);
  const [dvirStatus, setDvirStatus] = useState<"failed" | "passed">("failed");
  const [dvirPage, setDvirPage] = useState(1);
  const [dvirPageSize, setDvirPageSize] = useState(15);
  const [dvirDateRange, setDvirDateRange] = useState<string>("all");
  const [dvirTotalCount, setDvirTotalCount] = useState(0);

  // Equipment state
  const [equipmentInspections, setEquipmentInspections] = useState<EquipmentInspection[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  const [equipmentError, setEquipmentError] = useState<string | null>(null);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const debouncedEquipmentSearch = useDebouncedValue(equipmentSearch, 300);
  const [equipmentStatus, setEquipmentStatus] = useState<"attention" | "all" | "passed">("attention");
  const [equipmentType, setEquipmentType] = useState<string>("");
  const [equipmentPage, setEquipmentPage] = useState(1);
  const [equipmentPageSize, setEquipmentPageSize] = useState(12);
  const [equipmentTotalCount, setEquipmentTotalCount] = useState(0);
  const [equipmentDateRange, setEquipmentDateRange] = useState<string>("all");
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);

  // Device capabilities
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  // ==========================================================================
  // DVIR FETCH
  // ==========================================================================

  const fetchDvirReports = useCallback(async () => {
    if (!hasAccess) return;
    try {
      setDvirLoading(true);
      setDvirError(null);
      const from = (dvirPage - 1) * dvirPageSize;
      const to = from + dvirPageSize - 1;

      let query = supabase
        .from("dvir_reports")
        .select(`
          id, created_at, user_id, truck_number, mileage, drivers_name,
          chipper_number, trailer_number, notes, vehicle_trailer_checklist,
          aerial_checklist, mechanic_truck_number, mechanic_date,
          deficiency_corrected, mechanic_remarks, oil_dipstick_path,
          tire_photo_path, coolant_photo_path, damage_photo_path,
          detail_clean_truck_photo_path, final_driver_signature,
          general_foreman_signature, mechanic_signature, driver_approval_signature
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      // Apply date range filter
      const dateStart = getDateRangeStart(dvirDateRange);
      if (dateStart) {
        query = query.gte("created_at", dateStart);
      }

      // Apply search filter at DB level if provided
      if (debouncedDvirSearch.trim()) {
        const pattern = `%${debouncedDvirSearch.trim()}%`;
        query = query.or(`truck_number.ilike.${pattern},drivers_name.ilike.${pattern}`);
      }

      const { data, error: supabaseError, count } = await query.range(from, to);

      if (supabaseError) throw supabaseError;
      setDvirReports((data as DVIRReport[]) || []);
      setDvirTotalCount(count ?? 0);
    } catch (err) {
      logger.error("Error loading DVIR reports:", err);
      setDvirError("Failed to load DVIR reports.");
      setDvirReports([]);
      setDvirTotalCount(0);
    } finally {
      setDvirLoading(false);
    }
  }, [hasAccess, dvirPage, dvirPageSize, dvirDateRange, debouncedDvirSearch]);

  useEffect(() => {
    if (hasAccess) fetchDvirReports();
  }, [fetchDvirReports, hasAccess]);

  // ==========================================================================
  // EQUIPMENT FETCH
  // ==========================================================================

  const fetchEquipmentInspections = useCallback(async () => {
    if (!hasAccess) return;
    try {
      setEquipmentLoading(true);
      setEquipmentError(null);
      const from = (equipmentPage - 1) * equipmentPageSize;
      const to = from + equipmentPageSize - 1;

      let query = supabase
        .from("daily_equipment_inspections")
        .select(`
          id, created_at, submitted_by, equipment_type, equipment_number,
          inspection_date, template, notes, general_checklist, specific_checklist,
          overview_photo_path, damage_photo_path, attachments_photo_path,
          hydraulic_photo_path, mechanic_fixes, last_mechanic_updated_at
        `, { count: "exact" })
        .order("created_at", { ascending: false });

      // Apply date range filter
      const dateStart = getDateRangeStart(equipmentDateRange);
      if (dateStart) {
        query = query.gte("created_at", dateStart);
      }

      if (equipmentType) {
        query = query.eq("equipment_type", equipmentType);
      }

      if (debouncedEquipmentSearch.trim()) {
        const pattern = `%${debouncedEquipmentSearch.trim()}%`;
        query = query.or(`equipment_number.ilike.${pattern},submitted_by.ilike.${pattern}`);
      }

      const { data, error: supabaseError, count } = await query.range(from, to);

      if (supabaseError) throw supabaseError;
      setEquipmentInspections((data as EquipmentInspection[]) || []);
      setEquipmentTotalCount(count ?? 0);
    } catch (err) {
      logger.error("Error loading equipment inspections:", err);
      setEquipmentError("Failed to load equipment inspections.");
      setEquipmentInspections([]);
      setEquipmentTotalCount(0);
    } finally {
      setEquipmentLoading(false);
    }
  }, [hasAccess, equipmentPage, equipmentPageSize, equipmentType, debouncedEquipmentSearch, equipmentDateRange]);

  useEffect(() => {
    if (hasAccess) fetchEquipmentInspections();
  }, [fetchEquipmentInspections, hasAccess]);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const failedDvirCount = useMemo(() => dvirReports.filter((r) => getDVIRStatus(r) === "failed").length, [dvirReports]);

  const stats = useMemo(() => {
    const dvirNeedsReview = dvirReports.filter((r) => getDVIRStatus(r) === "failed").length;
    const equipNeedsReview = equipmentInspections.filter((i) => inspectionHasFailures(i)).length;
    return {
      totalDvir: dvirReports.length,
      totalEquip: equipmentInspections.length,
      needsReview: dvirNeedsReview + equipNeedsReview,
    };
  }, [dvirReports, equipmentInspections]);

  // ==========================================================================
  // ACCESS DENIED
  // ==========================================================================

  if (!hasAccess) {
    return (
      <DashboardLayout title="Equipment Logs">
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-[#c084fc]/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-[#c084fc]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <DashboardLayout title="Equipment Logs">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-4 pt-3 sm:pt-6">
        {/* Premium Hero Header */}
        <div className="mb-4 md:mb-6">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="relative">
            {/* Animated background glow */}
            <motion.div
              animate={{ opacity: [0.4, 0.6, 0.4], scale: [1, 1.02, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-purple-500/30 via-violet-500/20 to-fuchsia-500/30 blur-xl pointer-events-none"
            />
            
            <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border-2 border-purple-500/40 shadow-2xl shadow-purple-500/20"
              style={{ background: 'linear-gradient(135deg, #581c87 0%, #4c1d95 25%, #3b0764 50%, #1e1b4b 75%, #0c0a1d 100%)' }}>
              {/* Animated mesh gradient overlay */}
              <motion.div
                animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(ellipse at 20% 20%, rgba(192, 132, 252, 0.4) 0%, transparent 40%), radial-gradient(ellipse at 80% 80%, rgba(168, 85, 247, 0.3) 0%, transparent 40%), radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 60%)',
                  backgroundSize: '200% 200%'
                }}
              />
              
              <div className="absolute inset-0 animate-shimmer opacity-20 pointer-events-none" />
              <motion.div animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }} className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent" />
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-purple-400 via-violet-500 to-transparent" />

              <div className="relative px-4 py-4 md:px-7 md:py-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/60 to-violet-600/60 border border-purple-400/50 shadow-lg shadow-purple-500/30">
                      <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                        <HardHat className="w-4 h-4 text-purple-200" />
                      </motion.div>
                      <span className="text-[11px] uppercase tracking-[0.15em] font-bold text-purple-100">General Foreman</span>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-900/60 border border-purple-500/30">
                      <HardHat className="w-3 h-3 text-purple-400" />
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-purple-200/80">{role === "admin" ? "ADMIN" : "GEN FOREMAN"}</span>
                    </motion.div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1.5 h-16 md:h-20 rounded-full bg-gradient-to-b from-purple-300 via-violet-400 to-fuchsia-500 origin-top flex-shrink-0" style={{ boxShadow: '0 0 25px rgba(192, 132, 252, 0.7), 0 0 50px rgba(192, 132, 252, 0.4)' }} />
                  <div className="flex-1 min-w-0">
                    {enableAnimations ? (
                      <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight" segmentWrapperClassName="text-white drop-shadow-[0_2px_10px_rgba(192,132,252,0.6)]">
                        Equipment Logs
                      </TextEffect>
                    ) : (
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_10px_rgba(192,132,252,0.6)]">Equipment Logs</h1>
                    )}
                    <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-2 md:mt-3 text-sm sm:text-base text-purple-100/80 font-medium leading-relaxed max-w-xl">
                      Combined DVIR and equipment inspection oversight
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </div>
          </motion.div>
        </div>

        {/* Stats Card */}
        <ScrollRevealSection delay={0}>
          <div className="mb-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              whileHover={{ scale: 1.01, y: -2 }}
              className="relative overflow-hidden rounded-2xl border-2 border-purple-500/50 bg-gradient-to-br from-purple-700 via-purple-800 to-violet-900 p-5 shadow-2xl shadow-purple-500/30 transition-all duration-300 cursor-pointer"
            >
              <motion.div animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(168, 85, 247, 0.4) 25%, rgba(192, 132, 252, 0.3) 50%, rgba(139, 92, 246, 0.4) 75%, transparent 100%)', backgroundSize: '200% 100%' }} />
              <div className="absolute inset-0 animate-shimmer opacity-30" />
              <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity }} className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-purple-500/20 via-violet-500/30 to-fuchsia-500/20 blur-2xl pointer-events-none" />
              
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <motion.div animate={{ boxShadow: ['0 0 20px rgba(192, 132, 252, 0.4)', '0 0 40px rgba(192, 132, 252, 0.6)', '0 0 20px rgba(192, 132, 252, 0.4)'] }} transition={{ duration: 2, repeat: Infinity }} className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/40 to-violet-600/40 border border-purple-400/50 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-purple-200" />
                  </motion.div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] font-bold text-purple-200/80 mb-1">Needs Review</p>
                    <div className="flex items-baseline gap-3">
                      <motion.span key={stats.needsReview} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-4xl sm:text-5xl font-black text-white drop-shadow-[0_2px_10px_rgba(192,132,252,0.5)]">
                        {stats.needsReview}
                      </motion.span>
                      <span className="text-sm text-purple-200/60 font-medium">items</span>
                    </div>
                  </div>
                </div>
                
                <div className="hidden sm:flex items-center gap-6 pr-2">
                  <div className="text-center">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Truck className="w-4 h-4 text-purple-300/70" />
                      <span className="text-xs text-purple-200/50 uppercase tracking-wider">DVIR</span>
                    </div>
                    <motion.p key={failedDvirCount} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-2xl font-bold text-white/90">{failedDvirCount}</motion.p>
                  </div>
                  <div className="w-px h-12 bg-purple-400/20" />
                  <div className="text-center">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Wrench className="w-4 h-4 text-purple-300/70" />
                      <span className="text-xs text-purple-200/50 uppercase tracking-wider">Equipment</span>
                    </div>
                    <motion.p key={stats.needsReview - failedDvirCount} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-2xl font-bold text-white/90">{equipmentInspections.filter(i => inspectionHasFailures(i)).length}</motion.p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </ScrollRevealSection>

        {/* Tab Navigation */}
        <ScrollRevealSection delay={0.05}>
          <div className="flex flex-wrap gap-2 mb-5">
            {[
              { id: "dvir" as const, label: "DVIR Reports", icon: Truck, count: stats.totalDvir },
              { id: "equipment" as const, label: "Equipment Inspections", icon: Wrench, count: stats.totalEquip },
            ].map((tab, index) => (
              <motion.button
                key={tab.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 + 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-[0_8px_30px_rgba(16,185,129,0.4)]"
                    : "bg-purple-950/50 border border-purple-500/20 text-purple-200/80 hover:border-purple-500/40 hover:text-white hover:bg-purple-900/30"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.id === "dvir" ? "DVIR" : "Equipment"}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab.id ? "bg-white/20" : "bg-purple-500/20"}`}>{tab.count}</span>
              </motion.button>
            ))}
            
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-300 ${
                showFilters ? "bg-purple-500/20 border border-purple-500/40 text-purple-300" : "bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-purple-500/30"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {showFilters && <Zap className="w-3 h-3 text-purple-400" />}
            </motion.button>
          </div>
        </ScrollRevealSection>

        {/* Tab Content */}
        {activeTab === "dvir" && (
          <DVIRTab
            reports={dvirReports}
            loading={dvirLoading}
            error={dvirError}
            selectedId={selectedDvirId}
            onSelectId={setSelectedDvirId}
            search={dvirSearch}
            onSearchChange={setDvirSearch}
            status={dvirStatus}
            onStatusChange={setDvirStatus}
            dateRange={dvirDateRange}
            onDateRangeChange={setDvirDateRange}
            page={dvirPage}
            onPageChange={setDvirPage}
            pageSize={dvirPageSize}
            onPageSizeChange={setDvirPageSize}
            totalCount={dvirTotalCount}
            showFilters={showFilters}
            onRefresh={fetchDvirReports}
            enableAnimations={enableAnimations}
          />
        )}

        {activeTab === "equipment" && (
          <EquipmentTab
            inspections={equipmentInspections}
            loading={equipmentLoading}
            error={equipmentError}
            selectedId={selectedEquipmentId}
            onSelectId={setSelectedEquipmentId}
            search={equipmentSearch}
            onSearchChange={setEquipmentSearch}
            status={equipmentStatus}
            onStatusChange={setEquipmentStatus}
            equipmentType={equipmentType}
            onEquipmentTypeChange={setEquipmentType}
            dateRange={equipmentDateRange}
            onDateRangeChange={setEquipmentDateRange}
            page={equipmentPage}
            onPageChange={setEquipmentPage}
            pageSize={equipmentPageSize}
            onPageSizeChange={setEquipmentPageSize}
            totalCount={equipmentTotalCount}
            showFilters={showFilters}
            onRefresh={fetchEquipmentInspections}
            enableAnimations={enableAnimations}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
