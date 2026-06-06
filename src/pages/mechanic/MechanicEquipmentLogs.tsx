import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Truck,
  Wrench,
  Shield,
  AlertTriangle,
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

import {
  type DVIRReport,
  type EquipmentInspection,
  getDVIRStatus,
  hasMechanicUpdate,
  inspectionNeedsAttention,
  equipmentHasMechanicFix,
  getDateRangeStart,
  ScrollRevealSection,
  animationStyles,
  DVIRTab,
  EquipmentTab,
} from "./equipment-logs";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MechanicEquipmentLogs() {
  const { role, user } = useAuth();
  const hasAccess = role === "mechanic" || role === "admin";

  // Tab state
  const [activeTab, setActiveTab] = useState<"dvir" | "equipment">("dvir");

  // DVIR state
  const [dvirReports, setDvirReports] = useState<DVIRReport[]>([]);
  const [dvirLoading, setDvirLoading] = useState(true);
  const [dvirError, setDvirError] = useState<string | null>(null);
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

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Device capabilities
  const caps = useMemo(() => getDeviceCapabilities(), []);
  const enableAnimations = !caps.prefersReducedMotion && !caps.isMobile;

  // Storage helpers
  const getDvirPublicUrl = useCallback((path?: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("dvir-photos").getPublicUrl(path);
    return data.publicUrl ?? null;
  }, []);

  const getEquipmentPublicUrl = useCallback((path?: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("equipment-inspection-photos").getPublicUrl(path);
    return data.publicUrl ?? null;
  }, []);

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
  // COMPUTED STATS
  // ==========================================================================

  const stats = useMemo(() => {
    // DVIRs that still need review (have failures AND no mechanic fix)
    const dvirNeedsReview = dvirReports.filter((r) => getDVIRStatus(r) === "failed").length;
    // All DVIRs with mechanic updates
    const dvirFixed = dvirReports.filter((r) => hasMechanicUpdate(r)).length;
    
    // Equipment that still needs attention (has failures AND no mechanic fix)
    const equipNeedsReview = equipmentInspections.filter((i) => inspectionNeedsAttention(i)).length;
    // All equipment with mechanic fixes
    const equipFixed = equipmentInspections.filter((i) => equipmentHasMechanicFix(i)).length;
    
    return {
      totalDvir: dvirReports.length,
      totalEquip: equipmentInspections.length,
      needsReview: dvirNeedsReview + equipNeedsReview,
      fixed: dvirFixed + equipFixed,
      dvirNeedsReview,
      dvirFixed,
      equipNeedsReview,
      equipFixed,
    };
  }, [dvirReports, equipmentInspections]);

  // ==========================================================================
  // ACCESS DENIED
  // ==========================================================================

  if (!hasAccess) {
    return (
      <DashboardLayout title="Fleet & Equipment Center" pageHeading>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-amber-400" />
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
    <DashboardLayout title="Fleet & Equipment Center" pageHeading>
      {/* Custom CSS for animated gradients */}
      <style>{animationStyles}</style>
      
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 pb-4 pt-3 sm:pt-6">
          {/* ULTRA PREMIUM HEADER */}
          <div className="mb-4 md:mb-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="relative">
              {/* Main header card with solid background */}
              <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border-2 border-orange-500/40 shadow-2xl shadow-orange-500/20">
                {/* Solid gradient background for better readability */}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-900 via-amber-950 to-orange-950" />
                
                {/* Animated mesh gradient overlay */}
                <motion.div 
                  className="absolute inset-0 opacity-60"
                  animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  style={{
                    backgroundImage: `
                      radial-gradient(ellipse at 20% 20%, rgba(251, 146, 60, 0.4) 0%, transparent 50%),
                      radial-gradient(ellipse at 80% 80%, rgba(245, 158, 11, 0.3) 0%, transparent 50%),
                      radial-gradient(ellipse at 40% 60%, rgba(234, 88, 12, 0.3) 0%, transparent 40%)
                    `,
                    backgroundSize: '200% 200%',
                  }}
                />
                
                {/* Shimmer effect */}
                <div className="absolute inset-0 animate-shimmer pointer-events-none" />
                
                {/* Glowing orbs */}
                <motion.div
                  animate={{ x: [0, 20, 0], y: [0, -10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-0 left-1/4 w-40 h-40 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(251, 146, 60, 0.4) 0%, transparent 70%)', filter: 'blur(30px)' }}
                />
                <motion.div
                  animate={{ x: [0, -15, 0], y: [0, 15, 0], scale: [1, 0.9, 1] }}
                  transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute bottom-0 right-1/4 w-32 h-32 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)', filter: 'blur(25px)' }}
                />

                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
                
                {/* Content */}
                <div className="relative px-4 py-4 md:px-7 md:py-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        transition={{ duration: 0.4, delay: 0.2 }}
                        whileHover={{ scale: 1.05 }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 border border-orange-400/50 shadow-lg shadow-orange-500/30"
                      >
                        <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                          <Wrench className="w-4 h-4 text-white" />
                        </motion.div>
                        <span className="text-xs uppercase tracking-[0.15em] font-bold text-white">Mechanics Portal</span>
                      </motion.div>
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        transition={{ duration: 0.4, delay: 0.3 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 border border-orange-500/30"
                      >
                        <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-orange-200">{role === "admin" ? "ADMIN ACCESS" : "MECHANIC"}</span>
                      </motion.div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <motion.div 
                      initial={{ scaleY: 0, opacity: 0 }} 
                      animate={{ scaleY: 1, opacity: 1 }} 
                      transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="w-1.5 h-16 md:h-20 rounded-full bg-gradient-to-b from-orange-400 via-amber-500 to-yellow-500 origin-top flex-shrink-0 animate-pulse-glow" 
                    />
                    <div className="flex-1 min-w-0">
                      {enableAnimations ? (
                        <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-orange-200 to-amber-100 bg-clip-text text-transparent drop-shadow-[0_4px_20px_rgba(251,146,60,0.5)]">
                          Fleet & Equipment Center
                        </TextEffect>
                      ) : (
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-white via-orange-200 to-amber-100 bg-clip-text text-transparent">Fleet & Equipment Center</h1>
                      )}
                      <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-2 md:mt-3 text-sm sm:text-base text-orange-100/80 font-medium leading-relaxed max-w-xl">
                        Review and repair DVIR reports and equipment inspections
                      </motion.p>
                    </div>
                  </div>
                </div>
                
                {/* Bottom accent */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-400/60 to-transparent" />
              </div>
            </motion.div>
          </div>

          {/* SINGLE NEEDS REVIEW STAT */}
          <ScrollRevealSection delay={0}>
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              whileHover={{ scale: 1.01, y: -2 }}
              className="relative overflow-hidden rounded-2xl border-2 border-rose-500/50 bg-gradient-to-r from-rose-800 via-rose-900 to-red-950 p-5 shadow-2xl shadow-rose-500/20 mb-4"
            >
              {/* Animated background effects */}
              <motion.div 
                className="absolute inset-0 opacity-40"
                animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                style={{
                  backgroundImage: `
                    radial-gradient(ellipse at 20% 30%, rgba(244, 63, 94, 0.4) 0%, transparent 50%),
                    radial-gradient(ellipse at 80% 70%, rgba(225, 29, 72, 0.3) 0%, transparent 50%)
                  `,
                  backgroundSize: '200% 200%',
                }}
              />
              <div className="absolute inset-0 animate-shimmer opacity-20" />
              
              {/* Accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-400 via-red-400 to-rose-400" />
              
              {/* Content */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-xl shadow-rose-500/40 border border-rose-400/30"
                  >
                    <AlertTriangle className="w-7 h-7 text-white" />
                  </motion.div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-rose-200/80 font-bold mb-1">Items Requiring Attention</p>
                    <p className="text-sm text-rose-100/60">DVIR & Equipment issues pending review</p>
                  </div>
                </div>
                <div className="text-right">
                  <motion.p 
                    key={stats.needsReview}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl sm:text-6xl font-black text-white drop-shadow-[0_4px_20px_rgba(244,63,94,0.5)]"
                  >
                    {stats.needsReview}
                  </motion.p>
                  <p className="text-xs text-rose-200/60 font-medium mt-1">
                    {stats.dvirNeedsReview} DVIR • {stats.equipNeedsReview} Equipment
                  </p>
                </div>
              </div>
            </motion.div>
          </ScrollRevealSection>

          {/* TAB NAVIGATION */}
          <ScrollRevealSection delay={0.05}>
            <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
              {[
                { id: "dvir" as const, label: "DVIR Reports", shortLabel: "DVIR", icon: Truck, count: stats.totalDvir, badge: stats.dvirNeedsReview, gradient: "from-orange-600 to-amber-600" },
                { id: "equipment" as const, label: "Equipment Inspections", shortLabel: "Equipment", icon: Wrench, count: stats.totalEquip, badge: stats.equipNeedsReview, gradient: "from-amber-600 to-yellow-600" },
              ].map((tab, index) => (
                <motion.button
                  key={tab.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 ${
                    activeTab === tab.id
                      ? `bg-gradient-to-r ${tab.gradient} text-white shadow-2xl shadow-orange-500/40 border-2 border-orange-400/50`
                      : "bg-gradient-to-br from-gray-900 to-gray-950 border-2 border-gray-700/50 text-gray-300 hover:border-orange-500/50 hover:text-white"
                  }`}
                >
                  <motion.div
                    animate={activeTab === tab.id ? { rotate: [0, -10, 10, 0] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    <tab.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.div>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <motion.span 
                    key={tab.count}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      activeTab === tab.id 
                        ? "bg-white/25 text-white" 
                        : "bg-orange-500/20 text-orange-300"
                    }`}
                  >
                    {tab.count}
                  </motion.span>
                  {/* Attention badge */}
                  {tab.badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-rose-500 to-red-600 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-rose-500/50 border-2 border-white/20"
                    >
                      {tab.badge}
                    </motion.span>
                  )}
                </motion.button>
              ))}
              
              {/* Filter toggle button */}
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 border-2 ${
                  showFilters
                    ? "bg-gradient-to-r from-orange-600/20 to-amber-600/20 border-orange-500/50 text-orange-300 shadow-lg shadow-orange-500/20"
                    : "bg-gray-900/80 border-gray-700/50 text-gray-400 hover:text-white hover:border-orange-500/50"
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {showFilters && <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.5 }}><Zap className="w-3.5 h-3.5 text-orange-400" /></motion.div>}
              </motion.button>
            </div>
          </ScrollRevealSection>

          {/* DVIR TAB CONTENT */}
          {activeTab === "dvir" && (
            <DVIRTab
              dvirReports={dvirReports}
              dvirLoading={dvirLoading}
              dvirError={dvirError}
              dvirSearch={dvirSearch}
              setDvirSearch={setDvirSearch}
              dvirStatus={dvirStatus}
              setDvirStatus={setDvirStatus}
              dvirPage={dvirPage}
              setDvirPage={setDvirPage}
              dvirPageSize={dvirPageSize}
              setDvirPageSize={setDvirPageSize}
              dvirDateRange={dvirDateRange}
              setDvirDateRange={setDvirDateRange}
              dvirTotalCount={dvirTotalCount}
              showFilters={showFilters}
              isExporting={isExporting}
              setIsExporting={setIsExporting}
              exportSuccess={exportSuccess}
              setExportSuccess={setExportSuccess}
              userEmail={user?.email}
              debouncedDvirSearch={debouncedDvirSearch}
              onRefresh={fetchDvirReports}
              setDvirReports={setDvirReports}
              getDvirPublicUrl={getDvirPublicUrl}
            />
          )}

          {/* EQUIPMENT TAB CONTENT */}
          {activeTab === "equipment" && (
            <EquipmentTab
              equipmentInspections={equipmentInspections}
              equipmentLoading={equipmentLoading}
              equipmentError={equipmentError}
              equipmentSearch={equipmentSearch}
              setEquipmentSearch={setEquipmentSearch}
              equipmentStatus={equipmentStatus}
              setEquipmentStatus={setEquipmentStatus}
              equipmentType={equipmentType}
              setEquipmentType={setEquipmentType}
              equipmentPage={equipmentPage}
              setEquipmentPage={setEquipmentPage}
              equipmentPageSize={equipmentPageSize}
              setEquipmentPageSize={setEquipmentPageSize}
              equipmentDateRange={equipmentDateRange}
              setEquipmentDateRange={setEquipmentDateRange}
              equipmentTotalCount={equipmentTotalCount}
              showFilters={showFilters}
              isExporting={isExporting}
              setIsExporting={setIsExporting}
              exportSuccess={exportSuccess}
              setExportSuccess={setExportSuccess}
              userEmail={user?.email}
              debouncedEquipmentSearch={debouncedEquipmentSearch}
              onRefresh={fetchEquipmentInspections}
              setEquipmentInspections={setEquipmentInspections}
              getEquipmentPublicUrl={getEquipmentPublicUrl}
            />
          )}
        </div>
    </DashboardLayout>
  );
}
