import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Truck,
  Wrench,
  Shield,
  AlertTriangle,
  HardHat,
  Filter,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
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
          general_foreman_signature, mechanic_signature, driver_approval_signature,
          mechanic_cost, mechanic_parts_used,
          report_date, truck_gvwr, trailer_chipper_gvwr, medical_card_required,
          drivers_license_number, drivers_license_class, drivers_license_exp,
          drivers_license_required, has_medical_card, medical_card_exp,
          copy_of_registration, copy_of_insurance, aerial_notes
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
          hydraulic_photo_path, mechanic_fixes, last_mechanic_updated_at,
          mechanic_cost, mechanic_parts_used, additional_photo_paths
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

  // Call hook unconditionally, before any conditional returns
  const prefersReducedMotion = useReducedMotion();

  // ==========================================================================
  // ACCESS DENIED
  // ==========================================================================

  if (!hasAccess) {
    return (
      <DashboardLayout title="Equipment Logs">
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-6 border border-purple-500/20" aria-hidden>
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-sm text-white/60">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <DashboardLayout title="Equipment Logs" hideHeader>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-8">
        {/* Hero - compressed, mobile-optimized */}
        <header className="mb-4 sm:mb-6 md:mb-8">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="rounded-xl sm:rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/60 via-purple-950/80 to-black/90 overflow-hidden shadow-lg sm:shadow-xl shadow-purple-500/10"
          >
            <div className="px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4 sm:mb-5">
                <span className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl bg-purple-600/40 border border-purple-500/30 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-purple-100">
                  <HardHat className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" aria-hidden />
                  General Foreman
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg bg-black/30 border border-purple-500/20 text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-purple-200/80">
                  {role === "admin" ? "Admin" : "Gen Foreman"}
                </span>
              </div>
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-0.5 sm:w-1 h-10 xs:h-12 sm:h-16 md:h-20 rounded-full bg-gradient-to-b from-purple-400 via-violet-500 to-purple-600 flex-shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
                    Equipment Logs
                  </h1>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base text-white/70 max-w-xl">
                    Combined DVIR and equipment inspection oversight
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </header>

        {/* Stats - compressed, mobile-optimized */}
        <ScrollRevealSection delay={0}>
          <div className="mb-4 sm:mb-6">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05, ease: [0.4, 0, 0.2, 1] }}
              className="rounded-xl sm:rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-800/50 via-purple-900/60 to-violet-950/80 p-4 sm:p-5 md:p-6 shadow-lg shadow-purple-500/10 transition-shadow duration-200 hover:shadow-purple-500/15"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-5 md:gap-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/30 border border-purple-400/30 flex items-center justify-center flex-shrink-0" aria-hidden>
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-purple-200" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-purple-200/80 mb-0.5 sm:mb-1">Needs Review</p>
                    <p className="text-2xl xs:text-3xl sm:text-4xl font-bold text-white tabular-nums leading-tight">
                      {stats.needsReview}
                      <span className="ml-1.5 sm:ml-2 text-sm sm:text-base font-medium text-purple-200/60">items</span>
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-4 md:gap-6">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300/70" aria-hidden />
                    <span className="text-[10px] sm:text-xs uppercase tracking-wider text-purple-200/50">DVIR</span>
                    <span className="text-lg sm:text-xl font-bold text-white/90 tabular-nums">{failedDvirCount}</span>
                  </div>
                  <div className="w-px h-6 sm:h-8 bg-purple-400/20" aria-hidden />
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300/70" aria-hidden />
                    <span className="text-[10px] sm:text-xs uppercase tracking-wider text-purple-200/50">Equipment</span>
                    <span className="text-lg sm:text-xl font-bold text-white/90 tabular-nums">
                      {equipmentInspections.filter((i) => inspectionHasFailures(i)).length}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </ScrollRevealSection>

        {/* Tabs - compressed, mobile-optimized */}
        <ScrollRevealSection delay={0.05}>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4 sm:mb-6">
            {[
              { id: "dvir" as const, label: "DVIR Reports", icon: Truck, count: stats.totalDvir },
              { id: "equipment" as const, label: "Equipment Inspections", icon: Wrench, count: stats.totalEquip },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0a1d] min-h-[44px] touch-target ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-purple-500 to-violet-500 text-white shadow-lg shadow-purple-500/25"
                    : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:border-purple-500/30 hover:text-white"
                }`}
                aria-pressed={activeTab === tab.id}
                aria-label={`${tab.label}, ${tab.count} items`}
              >
                <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" aria-hidden />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.id === "dvir" ? "DVIR" : "Equipment"}</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold tabular-nums ${activeTab === tab.id ? "bg-white/20" : "bg-white/10"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`ml-auto inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0a1d] min-h-[44px] min-w-[44px] touch-target ${
                showFilters
                  ? "bg-purple-500/20 border border-purple-500/40 text-purple-200"
                  : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:border-purple-500/20 hover:text-white/80"
              }`}
              aria-pressed={showFilters}
              aria-label={showFilters ? "Hide filters" : "Show filters"}
            >
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">Filters</span>
            </button>
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
