import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, useInView } from "framer-motion";
import {
  Truck,
  Wrench,
  Shield,
  ClipboardList,
  Search,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Camera,
  Images,
  FileSignature,
  Flame,
  ListChecks,
  Loader2,
} from "lucide-react";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import TableSkeleton from "../../components/skeletons/TableSkeleton";
import CardListSkeleton from "../../components/skeletons/CardListSkeleton";
import { TextEffect } from "../../components/ui/TextEffect";
import { getDeviceCapabilities } from "../../lib/mobilePerf";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { logger } from "../../lib/logger";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type ChecklistValue = "" | "P" | "F";

interface ChecklistItem {
  id: string;
  label: string;
}

interface DVIRReport {
  id: string;
  created_at: string;
  user_id: string | null;
  truck_number: string | null;
  mileage: number | null;
  drivers_name: string | null;
  chipper_number: string | null;
  trailer_number: string | null;
  notes: string | null;
  vehicle_trailer_checklist: Record<string, ChecklistValue> | null;
  aerial_checklist: Record<string, ChecklistValue> | null;
  mechanic_truck_number: string | null;
  mechanic_date: string | null;
  deficiency_corrected: string | null;
  mechanic_remarks: string | null;
  oil_dipstick_path: string;
  tire_photo_path: string | null;
  coolant_photo_path: string | null;
  damage_photo_path: string | null;
  detail_clean_truck_photo_path: string | null;
  final_driver_signature: string | null;
  general_foreman_signature: string | null;
  mechanic_signature: string | null;
  driver_approval_signature: string | null;
}

interface EquipmentInspection {
  id: string;
  created_at: string;
  submitted_by: string | null;
  equipment_type: string;
  equipment_number: string;
  inspection_date: string;
  template: string | null;
  notes: string | null;
  general_checklist: Record<string, ChecklistValue> | null;
  specific_checklist: Record<string, ChecklistValue> | null;
  overview_photo_path: string | null;
  damage_photo_path: string | null;
  attachments_photo_path: string | null;
  hydraulic_photo_path: string | null;
  mechanic_fixes: string | null;
  last_mechanic_updated_at: string | null;
}

// =============================================================================
// CHECKLIST DEFINITIONS
// =============================================================================

const VEHICLE_TRAILER_ITEMS: ChecklistItem[] = [
  { id: "air_compressor", label: "Air Compressor" },
  { id: "air_line", label: "Air Line" },
  { id: "batteries", label: "Batteries" },
  { id: "service_brakes", label: "Service Brakes" },
  { id: "parking_brakes", label: "Parking Brakes" },
  { id: "clutch", label: "Clutch" },
  { id: "defroster", label: "Defroster" },
  { id: "engine", label: "Engine" },
  { id: "horn", label: "Horn" },
  { id: "head_lights", label: "Head Lights" },
  { id: "taillights", label: "Taillights" },
  { id: "brake_lights", label: "Brake Lights" },
  { id: "turn_indicators", label: "Turn Indicators" },
  { id: "mirrors", label: "Mirrors" },
  { id: "oil_pressure", label: "Oil Pressure" },
  { id: "radiator", label: "Radiator" },
  { id: "steering", label: "Steering" },
  { id: "tires", label: "Tires" },
  { id: "wheels", label: "Wheels" },
  { id: "windows", label: "Windows" },
  { id: "windshield_wipers", label: "Windshield Wipers" },
];

const AERIAL_LIFT_ITEMS: ChecklistItem[] = [
  { id: "hydraulic_oil_level", label: "Oil Level in Hydraulic Reservoir" },
  { id: "hydraulic_system_leaks", label: "Hydraulic System free of Leaks" },
  { id: "fasteners_tight", label: "Fasteners at Proper Tightness" },
  { id: "booms_no_cracks", label: "Booms free of Cracks and Damage" },
  { id: "boom_functions_working", label: "All Boom Functions Working" },
  { id: "grease_fittings_recent", label: "Grease Fittings greased (5 days)" },
];

const GENERAL_EQUIPMENT_ITEMS: ChecklistItem[] = [
  { id: "engine_oil_level", label: "Engine oil level" },
  { id: "engine_coolant_level", label: "Engine coolant level" },
  { id: "hydraulic_fluid_level", label: "Hydraulic fluid level" },
  { id: "steering_systems", label: "Steering systems" },
  { id: "lights_signals", label: "Lights & warning signals" },
  { id: "brakes", label: "Brakes" },
  { id: "fire_extinguisher", label: "Fire extinguisher" },
  { id: "emergency_kill", label: "Emergency kill switch" },
];

const SPECIFIC_ITEMS: Record<string, ChecklistItem[]> = {
  sky_trim: [
    { id: "tires", label: "Tires" },
    { id: "lift_arms", label: "Lift arms / booms" },
    { id: "outriggers_stabilizers", label: "Outriggers / stabilizers" },
    { id: "system_function", label: "System function test" },
  ],
  geo_boy: [
    { id: "tracks_tires", label: "Tracks / tires" },
    { id: "teeth", label: "Teeth / cutting head" },
    { id: "hydraulic_lines", label: "Hydraulic lines" },
    { id: "system_function", label: "System function test" },
  ],
  skid_steer: [
    { id: "tracks_tires", label: "Tracks / tires" },
    { id: "lift_arms", label: "Lift arms" },
    { id: "attachments", label: "Attachments (mulcher / grapple)" },
    { id: "system_function", label: "System function test" },
  ],
};

const EQUIPMENT_TYPE_OPTIONS = ["Geo-Boy", "Grapple", "Jarraff", "Mulcher", "Skidsteer"];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getFailedDVIRItems(report: DVIRReport) {
  const vehicleFails: string[] = [];
  const aerialFails: string[] = [];
  if (report.vehicle_trailer_checklist) {
    for (const item of VEHICLE_TRAILER_ITEMS) {
      if (report.vehicle_trailer_checklist[item.id] === "F") {
        vehicleFails.push(item.label);
      }
    }
  }
  if (report.aerial_checklist) {
    for (const item of AERIAL_LIFT_ITEMS) {
      if (report.aerial_checklist[item.id] === "F") {
        aerialFails.push(item.label);
      }
    }
  }
  return { vehicleFails, aerialFails, allFails: [...vehicleFails, ...aerialFails] };
}

function getDVIRStatus(report: DVIRReport) {
  const { allFails } = getFailedDVIRItems(report);
  return allFails.length > 0 ? "failed" : "passed";
}

function hasMechanicUpdate(report: DVIRReport) {
  return Boolean(report.deficiency_corrected || report.mechanic_remarks || report.mechanic_date);
}

function inspectionHasFailures(inspection: EquipmentInspection) {
  const general = inspection.general_checklist || {};
  const specific = inspection.specific_checklist || {};
  return Object.values(general).some((v) => v === "F") || Object.values(specific).some((v) => v === "F");
}

function getSpecificItems(template?: string | null) {
  if (!template) return [];
  return SPECIFIC_ITEMS[template as keyof typeof SPECIFIC_ITEMS] || [];
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "Unknown date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// SCROLL REVEAL COMPONENT
// =============================================================================

function ScrollRevealSection({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: Math.min(i * 0.02, 0.12), duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  }),
};

const listItemVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

const detailTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

const detailTransitionReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.1 },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MechanicEquipmentLogs() {
  const { role } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const hasAccess = role === "mechanic" || role === "admin";

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
  const dvirPageSize = 15;

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
  const equipmentPageSize = 12;
  const [equipmentTotalCount, setEquipmentTotalCount] = useState(0);

  // DVIR Mechanic update form state
  const [dvirUpdateTruckNumber, setDvirUpdateTruckNumber] = useState("");
  const [dvirUpdateDate, setDvirUpdateDate] = useState("");
  const [dvirUpdateDeficiency, setDvirUpdateDeficiency] = useState("");
  const [dvirUpdateRemarks, setDvirUpdateRemarks] = useState("");
  const [savingDvirUpdate, setSavingDvirUpdate] = useState(false);
  const [dvirSaveMessage, setDvirSaveMessage] = useState<string | null>(null);

  // Equipment Mechanic update form state
  const [equipmentMechanicNotes, setEquipmentMechanicNotes] = useState("");
  const [savingEquipmentFix, setSavingEquipmentFix] = useState(false);
  const [equipmentSaveMessage, setEquipmentSaveMessage] = useState<string | null>(null);

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

      const { data, error: supabaseError } = await supabase
        .from("dvir_reports")
        .select(`
          id, created_at, user_id, truck_number, mileage, drivers_name,
          chipper_number, trailer_number, notes, vehicle_trailer_checklist,
          aerial_checklist, mechanic_truck_number, mechanic_date,
          deficiency_corrected, mechanic_remarks, oil_dipstick_path,
          tire_photo_path, coolant_photo_path, damage_photo_path,
          detail_clean_truck_photo_path, final_driver_signature,
          general_foreman_signature, mechanic_signature, driver_approval_signature
        `)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (supabaseError) throw supabaseError;
      setDvirReports((data as DVIRReport[]) || []);
    } catch (err) {
      logger.error("Error loading DVIR reports:", err);
      setDvirError("Failed to load DVIR reports.");
      setDvirReports([]);
    } finally {
      setDvirLoading(false);
    }
  }, [hasAccess, dvirPage, dvirPageSize]);

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
  }, [hasAccess, equipmentPage, equipmentPageSize, equipmentType, debouncedEquipmentSearch]);

  useEffect(() => {
    if (hasAccess) fetchEquipmentInspections();
  }, [fetchEquipmentInspections, hasAccess]);

  // ==========================================================================
  // FILTERED DATA
  // ==========================================================================

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

  const filteredEquipmentInspections = useMemo(() => {
    let filtered = equipmentInspections;
    if (equipmentStatus === "attention") {
      filtered = filtered.filter((i) => inspectionHasFailures(i));
    } else if (equipmentStatus === "passed") {
      filtered = filtered.filter((i) => !inspectionHasFailures(i));
    }
    return filtered;
  }, [equipmentInspections, equipmentStatus]);

  const selectedDvir = useMemo(() => dvirReports.find((r) => r.id === selectedDvirId) || null, [dvirReports, selectedDvirId]);
  const selectedEquipment = useMemo(() => equipmentInspections.find((i) => i.id === selectedEquipmentId) || null, [equipmentInspections, selectedEquipmentId]);

  // Populate DVIR form when selection changes
  useEffect(() => {
    if (!selectedDvir) {
      setDvirUpdateTruckNumber("");
      setDvirUpdateDate("");
      setDvirUpdateDeficiency("");
      setDvirUpdateRemarks("");
      return;
    }
    setDvirUpdateTruckNumber(selectedDvir.mechanic_truck_number || "");
    setDvirUpdateDate(selectedDvir.mechanic_date || "");
    setDvirUpdateDeficiency(selectedDvir.deficiency_corrected || "");
    setDvirUpdateRemarks(selectedDvir.mechanic_remarks || "");
  }, [selectedDvir]);

  // Populate Equipment form when selection changes
  useEffect(() => {
    if (!selectedEquipment) {
      setEquipmentMechanicNotes("");
      return;
    }
    setEquipmentMechanicNotes(selectedEquipment.mechanic_fixes || "");
  }, [selectedEquipment]);

  // Save DVIR mechanic update
  const handleSaveDvirUpdate = async () => {
    if (!selectedDvir) return;
    try {
      setSavingDvirUpdate(true);
      setDvirSaveMessage(null);
      const { error } = await supabase.from("dvir_reports").update({
        mechanic_truck_number: dvirUpdateTruckNumber || null,
        mechanic_date: dvirUpdateDate || null,
        deficiency_corrected: dvirUpdateDeficiency || null,
        mechanic_remarks: dvirUpdateRemarks || null,
      }).eq("id", selectedDvir.id);
      if (error) throw error;
      setDvirReports((prev) => prev.map((r) => r.id === selectedDvir.id ? { ...r, mechanic_truck_number: dvirUpdateTruckNumber || null, mechanic_date: dvirUpdateDate || null, deficiency_corrected: dvirUpdateDeficiency || null, mechanic_remarks: dvirUpdateRemarks || null } : r));
      setDvirSaveMessage("Fix recorded successfully!");
      setTimeout(() => setDvirSaveMessage(null), 4000);
    } catch (err) {
      logger.error("Error saving DVIR update:", err);
      setDvirSaveMessage("Failed to save. Please try again.");
      setTimeout(() => setDvirSaveMessage(null), 4000);
    } finally {
      setSavingDvirUpdate(false);
    }
  };

  // Save Equipment mechanic fix
  const handleSaveEquipmentFix = async () => {
    if (!selectedEquipment) return;
    try {
      setSavingEquipmentFix(true);
      setEquipmentSaveMessage(null);
      const { error } = await supabase.from("daily_equipment_inspections").update({
        mechanic_fixes: equipmentMechanicNotes.trim() || null,
        last_mechanic_updated_at: new Date().toISOString(),
      }).eq("id", selectedEquipment.id);
      if (error) throw error;
      setEquipmentInspections((prev) => prev.map((i) => i.id === selectedEquipment.id ? { ...i, mechanic_fixes: equipmentMechanicNotes.trim() || null, last_mechanic_updated_at: new Date().toISOString() } : i));
      setEquipmentSaveMessage("Fix recorded successfully!");
      setTimeout(() => setEquipmentSaveMessage(null), 4000);
    } catch (err) {
      logger.error("Error saving equipment fix:", err);
      setEquipmentSaveMessage("Failed to save. Please try again.");
      setTimeout(() => setEquipmentSaveMessage(null), 4000);
    } finally {
      setSavingEquipmentFix(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const dvirNeedsReview = dvirReports.filter((r) => getDVIRStatus(r) === "failed").length;
    const dvirFixed = dvirReports.filter((r) => hasMechanicUpdate(r)).length;
    const equipNeedsReview = equipmentInspections.filter((i) => inspectionHasFailures(i)).length;
    const equipFixed = equipmentInspections.filter((i) => i.mechanic_fixes?.trim()).length;
    return {
      totalDvir: dvirReports.length,
      totalEquip: equipmentInspections.length,
      needsReview: dvirNeedsReview + equipNeedsReview,
      fixed: dvirFixed + equipFixed,
    };
  }, [dvirReports, equipmentInspections]);

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
    return base.filter((e) => e.path).map((e) => {
      const url = getDvirPublicUrl(e.path);
      return url ? { label: e.label, url } : null;
    }).filter((e): e is { label: string; url: string } => Boolean(e));
  }, [selectedDvir, getDvirPublicUrl]);

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

  const dvirTotalPages = Math.max(1, Math.ceil(filteredDvirReports.length / dvirPageSize));
  const equipmentTotalPages = Math.max(1, Math.ceil(equipmentTotalCount / equipmentPageSize));

  // ==========================================================================
  // ACCESS DENIED
  // ==========================================================================

  if (!hasAccess) {
    return (
      <DashboardLayout title="Fleet & Equipment Center">
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
    <DashboardLayout title="Fleet & Equipment Center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pb-4 pt-4 sm:pt-6">
          {/* Premium Glass Header - Ember Theme */}
          <div className="mb-5 md:mb-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="relative">
              <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5)]" style={{ backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', background: 'linear-gradient(145deg, rgba(45, 20, 8, 0.6) 0%, rgba(20, 8, 4, 0.5) 50%, rgba(10, 4, 2, 0.4) 100%)', boxShadow: 'inset 0 0 15px rgba(255, 147, 80, 0.08), 0 8px 32px rgba(0,0,0,0.5)' }}>
                <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)' }} />
                <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />
                <div className="absolute top-0 left-0 w-24 h-24 rounded-full opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255, 147, 80, 0.3) 0%, transparent 70%)', filter: 'blur(15px)' }} />
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
                <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-white/[0.1] to-transparent" />

                <div className="relative px-5 py-4 md:px-7 md:py-5">
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-200">Mechanics</span>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a0804]/60 border border-amber-500/20">
                      <Wrench className="w-3 h-3 text-amber-400" />
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-200/70">{role === "admin" ? "ADMIN" : "MECH"}</span>
                    </motion.div>
                  </div>
                  <div className="flex items-center gap-4">
                    <motion.div initial={{ scaleY: 0, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} className="w-1 h-14 md:h-16 rounded-full bg-gradient-to-b from-amber-400 via-orange-500 to-red-600 origin-top flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(251, 146, 60, 0.4), 0 0 40px rgba(251, 146, 60, 0.2)' }} />
                    <div className="flex-1 min-w-0">
                      {enableAnimations ? (
                        <TextEffect as="h1" preset="blurSlide" per="char" delay={0.15} className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight" segmentWrapperClassName="bg-gradient-to-r from-white via-amber-100 to-white/90 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,146,60,0.3)]">
                          Fleet & Equipment Center
                        </TextEffect>
                      ) : (
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-amber-100 to-white/90 bg-clip-text text-transparent">Fleet & Equipment Center</h1>
                      )}
                      <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="mt-1.5 md:mt-2 text-xs sm:text-sm text-amber-200/50 font-medium leading-relaxed max-w-xl">
                        Review and repair DVIR reports and equipment inspections
                      </motion.p>
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-black/[0.15] to-transparent" />
              </div>
            </motion.div>
          </div>

          {/* Stats Summary */}
          <ScrollRevealSection delay={0}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: "DVIR Reports", value: stats.totalDvir, icon: Truck, color: "text-amber-400" },
                { label: "Equipment Inspections", value: stats.totalEquip, icon: Wrench, color: "text-orange-400" },
                { label: "Needs Review", value: stats.needsReview, icon: AlertTriangle, color: "text-red-400" },
                { label: "Fixes Logged", value: stats.fixed, icon: CheckCircle2, color: "text-emerald-400" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-[#ff9350]/20 bg-gradient-to-br from-[#2d1409]/50 to-[#0a0402]/70 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                    <span className="text-[10px] uppercase tracking-wider text-amber-200/50">{stat.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </ScrollRevealSection>

          {/* Tab Navigation */}
          <ScrollRevealSection delay={0.05}>
            <div className="flex gap-2 mb-5">
              {[
                { id: "dvir" as const, label: "DVIR Reports", icon: Truck, count: stats.totalDvir },
                { id: "equipment" as const, label: "Equipment Inspections", icon: Wrench, count: stats.totalEquip },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-[#ff9350] to-[#e87830] text-white shadow-[0_8px_25px_rgba(255,147,80,0.35)]"
                      : "bg-[#0a0402]/70 border border-[#ff9350]/20 text-amber-200/80 hover:border-[#ff9350]/40 hover:text-white"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? "bg-white/20" : "bg-white/10"}`}>{tab.count}</span>
                </button>
              ))}
            </div>
          </ScrollRevealSection>

          {/* DVIR TAB CONTENT */}
          {activeTab === "dvir" && (
            <div className="space-y-4">
              {/* DVIR Filter Bar */}
              <ScrollRevealSection delay={0}>
                <div className="rounded-xl border border-[#ff9350]/15 bg-gradient-to-r from-[#0c0402] to-[#120805] p-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex gap-1 p-1 bg-black/30 rounded-lg border border-white/5">
                      {[
                        { id: "failed" as const, label: "Need Review", icon: AlertTriangle, count: failedDvirCount, color: "text-red-400" },
                        { id: "passed" as const, label: "Passed", icon: CheckCircle2, count: passedDvirCount, color: "text-emerald-400" },
                      ].map(({ id, label, icon: Icon, count, color }) => (
                        <button
                          key={id}
                          onClick={() => { setDvirStatus(id); setDvirPage(1); }}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                            dvirStatus === id
                              ? "bg-gradient-to-r from-[#ff9350] to-[#e87830] text-white shadow-md"
                              : "text-white/60 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${dvirStatus === id ? "text-white" : color}`} />
                          <span className="hidden sm:inline">{label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${dvirStatus === id ? "bg-white/20" : "bg-white/10"}`}>{count}</span>
                        </button>
                      ))}
                    </div>
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        type="text"
                        placeholder="Search truck or driver..."
                        value={dvirSearch}
                        onChange={(e) => { setDvirSearch(e.target.value); setDvirPage(1); }}
                        className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#ff9350]/50 transition-all"
                      />
                      {dvirSearch && (
                        <button onClick={() => { setDvirSearch(""); setDvirPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollRevealSection>

              {/* DVIR Content */}
              <ScrollRevealSection delay={0.1}>
                {dvirLoading && (
                  <div className="space-y-3">
                    <div className="hidden lg:block"><TableSkeleton rows={5} columns={4} variant="ember" /></div>
                    <div className="lg:hidden"><CardListSkeleton rows={4} variant="ember" /></div>
                  </div>
                )}
                {dvirError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{dvirError}</div>}
                {!dvirLoading && !dvirError && (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {/* DVIR List Panel */}
                    <div className="rounded-xl border border-white/10 bg-[#080403] overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${dvirStatus === "failed" ? "bg-red-400" : "bg-emerald-400"}`} />
                          <span className="text-xs font-medium text-white/80">{dvirStatus === "failed" ? "Need Review" : "Passed"}</span>
                          <span className="text-[10px] text-white/40">({filteredDvirReports.length})</span>
                        </div>
                        {filteredDvirReports.length > 0 && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setDvirPage((p) => Math.max(1, p - 1))} disabled={dvirPage === 1} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-white/50 min-w-[40px] text-center">{dvirPage}/{dvirTotalPages}</span>
                            <button onClick={() => setDvirPage((p) => Math.min(dvirTotalPages, p + 1))} disabled={dvirPage === dvirTotalPages} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="max-h-[500px] overflow-y-auto flex-1 divide-y divide-white/[0.03]">
                        {filteredDvirReports.length === 0 ? (
                          <div className="p-4 text-center text-white/50">
                            <CheckCircle2 className="w-8 h-8 text-white/20 mx-auto mb-2" />
                            <p className="text-xs">{dvirSearch ? "No matches" : dvirStatus === "failed" ? "All clear!" : "No records"}</p>
                          </div>
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
                                onClick={() => setSelectedDvirId(isSelected ? null : report.id)}
                                className={`w-full text-left px-3 py-2.5 transition-all duration-150 flex items-center gap-2.5 group ${
                                  isSelected ? "bg-gradient-to-r from-[#ff9350]/20 to-[#ff9350]/5 border-l-2 border-l-[#ff9350]" : "border-l-2 border-l-transparent hover:bg-white/[0.03]"
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "failed" ? "bg-red-400" : "bg-emerald-400"}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm text-white truncate">{report.truck_number || "N/A"}</span>
                                    {mechanicFlag && <span className="inline-flex items-center px-1.5 py-0.5 bg-[#ff9350]/20 border border-[#ff9350]/30 rounded text-[9px] text-[#ffd5b0] font-medium">Fixed</span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-white/50 truncate">{report.drivers_name || "Unknown"}</span>
                                    <span className="text-[10px] text-white/30">•</span>
                                    <span className="text-[10px] text-white/40">{formatDateTime(report.created_at)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {allFails.length > 0 && <span className="text-[10px] font-medium text-red-300 bg-red-500/15 px-1.5 py-0.5 rounded">{allFails.length}</span>}
                                  <ChevronRight className={`w-4 h-4 transition-all ${isSelected ? "text-[#ff9350]" : "text-white/20 group-hover:text-white/40"}`} />
                                </div>
                              </motion.button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* DVIR Detail Panel */}
                    <div className="lg:col-span-2">
                      <AnimatePresence mode="wait">
                        {!selectedDvir ? (
                          <motion.div key="empty-state" {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} className="h-full min-h-[300px] rounded-xl border border-white/5 bg-[#050302] p-6 flex flex-col items-center justify-center text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#ff9350]/10 border border-[#ff9350]/20 mb-3">
                              <ClipboardList className="w-5 h-5 text-[#ff9350]/70" />
                            </div>
                            <p className="text-sm font-medium text-white/80 mb-0.5">Select a DVIR</p>
                            <p className="text-xs text-white/40">Choose a report to view details</p>
                          </motion.div>
                        ) : (
                          <motion.div key={selectedDvirId} {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} className="space-y-3">
                            <div className="rounded-xl border border-white/10 bg-[#050302] overflow-hidden">
                              <div className="bg-gradient-to-r from-[#ff9350]/8 to-transparent border-b border-white/5 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff9350]/20 to-[#e87830]/10 border border-[#ff9350]/20 flex items-center justify-center flex-shrink-0">
                                      <Truck className="w-5 h-5 text-[#ff9350]" />
                                    </div>
                                    <div className="min-w-0">
                                      <h3 className="text-base font-semibold text-white truncate">Truck {selectedDvir.truck_number || "N/A"}</h3>
                                      <div className="flex items-center gap-2 text-xs text-white/50">
                                        <span className="truncate">{selectedDvir.drivers_name || "Unknown"}</span>
                                        <span className="text-white/20">•</span>
                                        <span>{selectedDvir.mileage?.toLocaleString() || "—"} mi</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {hasMechanicUpdate(selectedDvir) && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#ff9350]/15 border border-[#ff9350]/25 rounded text-[10px] font-medium text-[#ffd5b0]">
                                        <Wrench className="w-3 h-3" />Fixed
                                      </span>
                                    )}
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${getDVIRStatus(selectedDvir) === "failed" ? "bg-red-500/15 text-red-300 border border-red-500/25" : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"}`}>
                                      {getDVIRStatus(selectedDvir) === "failed" ? <><AlertTriangle className="w-3.5 h-3.5" />Review</> : <><CheckCircle2 className="w-3.5 h-3.5" />Passed</>}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="px-4 py-4 space-y-4">
                                {(() => {
                                  const { vehicleFails, aerialFails, allFails } = getFailedDVIRItems(selectedDvir);
                                  if (allFails.length === 0) {
                                    return <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /><span className="text-sm text-emerald-300">All items passed</span></div>;
                                  }
                                  return (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 text-xs font-medium text-red-300"><AlertTriangle className="w-3.5 h-3.5" />{allFails.length} Failed Item{allFails.length !== 1 ? "s" : ""}</div>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {vehicleFails.length > 0 && (
                                          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 max-h-40 overflow-y-auto">
                                            <div className="text-[10px] uppercase tracking-wider text-red-300/70 mb-1.5">Vehicle / Trailer</div>
                                            <ul className="space-y-1">{vehicleFails.map((label) => <li key={label} className="flex items-start gap-1.5 text-xs text-red-200/80"><span className="w-1 h-1 bg-red-400 rounded-full mt-1.5 flex-shrink-0" />{label}</li>)}</ul>
                                          </div>
                                        )}
                                        {aerialFails.length > 0 && (
                                          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-2.5 max-h-40 overflow-y-auto">
                                            <div className="text-[10px] uppercase tracking-wider text-orange-300/70 mb-1.5">Aerial Lift</div>
                                            <ul className="space-y-1">{aerialFails.map((label) => <li key={label} className="flex items-start gap-1.5 text-xs text-orange-200/80"><span className="w-1 h-1 bg-orange-400 rounded-full mt-1.5 flex-shrink-0" />{label}</li>)}</ul>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                                    <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Driver Notes</div>
                                    <p className="text-xs text-white/60 line-clamp-2">{selectedDvir.notes?.trim() || "No notes"}</p>
                                  </div>
                                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                                    <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Vehicle Info</div>
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-white/50">
                                      <span>Chipper: {selectedDvir.chipper_number || "—"}</span>
                                      <span>Trailer: {selectedDvir.trailer_number || "—"}</span>
                                    </div>
                                  </div>
                                </div>
                                {hasMechanicUpdate(selectedDvir) && (
                                  <div className="rounded-lg border border-[#ff9350]/20 bg-[#ff9350]/5 p-2.5">
                                    <div className="text-[10px] uppercase tracking-wider text-[#ff9350]/70 mb-1.5">Mechanic Fix</div>
                                    <p className="text-xs text-white/70">{selectedDvir.deficiency_corrected || "—"}</p>
                                    {selectedDvir.mechanic_remarks && <p className="text-xs text-white/50 mt-1">Remarks: {selectedDvir.mechanic_remarks}</p>}
                                    {selectedDvir.mechanic_date && <p className="text-[10px] text-white/40 mt-1">Date: {selectedDvir.mechanic_date}</p>}
                                  </div>
                                )}
                                <details className="group">
                                  <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                                    <span className="flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5 text-[#ff9350]/70" />Full Checklist Review</span>
                                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                                  </summary>
                                  <div className="grid gap-2 sm:grid-cols-2 pt-2">
                                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                                      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Vehicle / Trailer</div>
                                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                                        {VEHICLE_TRAILER_ITEMS.map((item) => {
                                          const value = selectedDvir.vehicle_trailer_checklist?.[item.id];
                                          const status = value === "P" ? "pass" : value === "F" ? "fail" : "pending";
                                          return (
                                            <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                              <span className="truncate">{item.label}</span>
                                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "pass" ? "bg-emerald-400" : status === "fail" ? "bg-red-400" : "bg-white/20"}`} />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                                      <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Aerial Lift</div>
                                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                                        {AERIAL_LIFT_ITEMS.map((item) => {
                                          const value = selectedDvir.aerial_checklist?.[item.id];
                                          const status = value === "P" ? "pass" : value === "F" ? "fail" : "pending";
                                          return (
                                            <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                              <span className="truncate">{item.label}</span>
                                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "pass" ? "bg-emerald-400" : status === "fail" ? "bg-red-400" : "bg-white/20"}`} />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </details>
                                <details className="group">
                                  <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                                    <span className="flex items-center gap-1.5"><Images className="w-3.5 h-3.5 text-[#ff9350]/70" />Photos ({dvirMediaEntries.length})</span>
                                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                                  </summary>
                                  {dvirMediaEntries.length === 0 ? <p className="text-[11px] text-white/40 pt-1">No photos uploaded</p> : (
                                    <div className="grid grid-cols-3 gap-2 pt-2">
                                      {dvirMediaEntries.map((media) => (
                                        <a key={media.label} href={media.url} target="_blank" rel="noopener noreferrer" className="group/img block rounded-lg border border-white/5 bg-black/30 overflow-hidden transition-all hover:border-[#ff9350]/30">
                                          <img src={media.url} alt={media.label} className="h-20 w-full object-cover transition-transform duration-200 group-hover/img:scale-105" />
                                          <div className="px-1.5 py-1 text-[9px] text-white/40 truncate">{media.label}</div>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </details>
                                <details className="group">
                                  <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                                    <span className="flex items-center gap-1.5"><FileSignature className="w-3.5 h-3.5 text-[#ff9350]/70" />Signatures ({dvirSignatureEntries.length})</span>
                                    <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                                  </summary>
                                  {dvirSignatureEntries.length === 0 ? <p className="text-[11px] text-white/40 pt-1">No signatures</p> : (
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                      {dvirSignatureEntries.map((sig) => (
                                        <a key={sig.label} href={sig.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-white/5 bg-black/30 p-2 transition-all hover:border-[#ff9350]/30">
                                          <div className="text-[9px] text-white/40 mb-1 truncate">{sig.label}</div>
                                          <img src={sig.url} alt={sig.label} className="h-16 w-full object-contain" />
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </details>
                              </div>
                            </div>

                            {/* DVIR Mechanic Update Form */}
                            <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-[#050302] overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-amber-500/10">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                                  </div>
                                  <span className="text-sm font-medium text-white">Record Fix</span>
                                </div>
                              </div>
                              <div className="px-4 py-3 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Truck #</label>
                                    <input value={dvirUpdateTruckNumber} onChange={(e) => setDvirUpdateTruckNumber(e.target.value)} placeholder="e.g., 101" className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all" />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Date</label>
                                    <input type="date" value={dvirUpdateDate} onChange={(e) => setDvirUpdateDate(e.target.value)} className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all [color-scheme:dark]" />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Fix Applied</label>
                                  <input value={dvirUpdateDeficiency} onChange={(e) => setDvirUpdateDeficiency(e.target.value)} placeholder="e.g., Replaced brake pads..." className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all" />
                                </div>
                                <div>
                                  <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Remarks</label>
                                  <textarea value={dvirUpdateRemarks} onChange={(e) => setDvirUpdateRemarks(e.target.value)} rows={2} placeholder="Additional notes..." className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all resize-none" />
                                </div>
                                <AnimatePresence>
                                  {dvirSaveMessage && (
                                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className={`rounded-lg px-3 py-2 text-xs font-medium ${dvirSaveMessage.includes("success") ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}>
                                      {dvirSaveMessage}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                <button type="button" onClick={handleSaveDvirUpdate} disabled={savingDvirUpdate} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:shadow-amber-500/20">
                                  {savingDvirUpdate ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><CheckCircle2 className="w-4 h-4" />Save Update</>}
                                </button>
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
          )}

          {/* EQUIPMENT TAB CONTENT */}
          {activeTab === "equipment" && (
            <div className="space-y-4">
              {/* Equipment Filter Bar */}
              <ScrollRevealSection delay={0}>
                <div className="rounded-xl border border-[#ff9350]/15 bg-gradient-to-r from-[#0c0402] to-[#120805] p-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative">
                      <select value={equipmentStatus} onChange={(e) => { setEquipmentStatus(e.target.value as typeof equipmentStatus); setEquipmentPage(1); }} className="w-full sm:w-auto bg-black/30 border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#ff9350]/50 appearance-none cursor-pointer transition-all">
                        <option value="attention">Needs Attention</option>
                        <option value="all">All Inspections</option>
                        <option value="passed">Passed Only</option>
                      </select>
                      <ClipboardList className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#ff9350]/60 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select value={equipmentType} onChange={(e) => { setEquipmentType(e.target.value); setEquipmentPage(1); }} className="w-full sm:w-auto bg-black/30 border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#ff9350]/50 appearance-none cursor-pointer transition-all">
                        <option value="">All Types</option>
                        {EQUIPMENT_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <Wrench className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#ff9350]/60 pointer-events-none" />
                    </div>
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input value={equipmentSearch} onChange={(e) => { setEquipmentSearch(e.target.value); setEquipmentPage(1); }} placeholder="Search equipment or operator..." className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#ff9350]/50 transition-all" />
                      {equipmentSearch && (
                        <button onClick={() => { setEquipmentSearch(""); setEquipmentPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollRevealSection>

              {/* Equipment Content */}
              <ScrollRevealSection delay={0.1}>
                {equipmentLoading && (
                  <div className="space-y-3">
                    <div className="hidden lg:block"><TableSkeleton rows={5} columns={4} variant="ember" /></div>
                    <div className="lg:hidden"><CardListSkeleton rows={4} variant="ember" /></div>
                  </div>
                )}
                {equipmentError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{equipmentError}</div>}
                {!equipmentLoading && !equipmentError && (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {/* Equipment List Panel */}
                    <div className="rounded-xl border border-white/10 bg-[#080403] overflow-hidden flex flex-col">
                      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${equipmentStatus === "attention" ? "bg-red-400" : equipmentStatus === "passed" ? "bg-emerald-400" : "bg-[#ff9350]"}`} />
                          <span className="text-xs font-medium text-white/80">{equipmentStatus === "attention" ? "Attention" : equipmentStatus === "passed" ? "Passed" : "All"}</span>
                          <span className="text-[10px] text-white/40">({filteredEquipmentInspections.length})</span>
                        </div>
                        {equipmentTotalCount > 0 && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEquipmentPage((p) => Math.max(1, p - 1))} disabled={equipmentPage === 1} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-white/50 min-w-[40px] text-center">{equipmentPage}/{equipmentTotalPages}</span>
                            <button onClick={() => setEquipmentPage((p) => Math.min(equipmentTotalPages, p + 1))} disabled={equipmentPage === equipmentTotalPages} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="max-h-[500px] overflow-y-auto flex-1 divide-y divide-white/[0.03]">
                        {filteredEquipmentInspections.length === 0 ? (
                          <div className="p-4 text-center text-white/50">
                            <ClipboardList className="w-8 h-8 text-white/20 mx-auto mb-2" />
                            <p className="text-xs">No matches found</p>
                          </div>
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
                                onClick={() => setSelectedEquipmentId(isSelected ? null : inspection.id)}
                                className={`w-full text-left px-3 py-2.5 transition-all duration-150 flex items-center gap-2.5 group ${
                                  isSelected ? "bg-gradient-to-r from-[#ff9350]/20 to-[#ff9350]/5 border-l-2 border-l-[#ff9350]" : "border-l-2 border-l-transparent hover:bg-white/[0.03]"
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasFailures ? "bg-red-400" : "bg-emerald-400"}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm text-white truncate">{inspection.equipment_number || "N/A"}</span>
                                    <span className="text-[10px] text-white/40 truncate">{inspection.equipment_type || ""}</span>
                                    {hasFix && <span className="inline-flex items-center px-1.5 py-0.5 bg-[#ff9350]/20 border border-[#ff9350]/30 rounded text-[9px] text-[#ffd5b0] font-medium">Fixed</span>}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-white/50 truncate">{inspection.submitted_by || "Unknown"}</span>
                                    <span className="text-[10px] text-white/30">•</span>
                                    <span className="text-[10px] text-white/40">{new Date(inspection.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                  </div>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-all flex-shrink-0 ${isSelected ? "text-[#ff9350]" : "text-white/20 group-hover:text-white/40"}`} />
                              </motion.button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Equipment Detail Panel */}
                    <div className="lg:col-span-2">
                      <AnimatePresence mode="wait">
                        {!selectedEquipment ? (
                          <motion.div key="empty-state" {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} className="h-full min-h-[300px] rounded-xl border border-white/5 bg-[#050302] p-6 flex flex-col items-center justify-center text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#ff9350]/10 border border-[#ff9350]/20 mb-3">
                              <ClipboardList className="w-5 h-5 text-[#ff9350]/70" />
                            </div>
                            <p className="text-sm font-medium text-white/80 mb-0.5">Select an inspection</p>
                            <p className="text-xs text-white/40">Choose a record to view details</p>
                          </motion.div>
                        ) : (
                          <motion.div key={selectedEquipmentId} {...(prefersReducedMotion ? detailTransitionReduced : detailTransition)} className="space-y-3">
                            <div className="rounded-xl border border-white/10 bg-[#050302] overflow-hidden">
                              <div className="bg-gradient-to-r from-[#ff9350]/8 to-transparent border-b border-white/5 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#ff9350]/20 to-[#e87830]/10 border border-[#ff9350]/20 flex items-center justify-center flex-shrink-0">
                                      <Wrench className="w-5 h-5 text-[#ff9350]" />
                                    </div>
                                    <div className="min-w-0">
                                      <h3 className="text-base font-semibold text-white truncate">{selectedEquipment.equipment_number || "Unknown"}</h3>
                                      <div className="flex items-center gap-2 text-xs text-white/50">
                                        <span>{selectedEquipment.equipment_type || "Equipment"}</span>
                                        <span className="text-white/20">•</span>
                                        <span>{new Date(selectedEquipment.inspection_date).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {selectedEquipment.mechanic_fixes && (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#ff9350]/15 border border-[#ff9350]/25 rounded text-[10px] font-medium text-[#ffd5b0]">
                                        <Wrench className="w-3 h-3" />Fixed
                                      </span>
                                    )}
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${inspectionHasFailures(selectedEquipment) ? "bg-red-500/15 text-red-300 border border-red-500/25" : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"}`}>
                                      {inspectionHasFailures(selectedEquipment) ? <><AlertTriangle className="w-3.5 h-3.5" />Review</> : <><CheckCircle2 className="w-3.5 h-3.5" />Passed</>}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="px-4 py-4 space-y-4">
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
                                {selectedEquipment.mechanic_fixes && (
                                  <div className="rounded-lg border border-[#ff9350]/20 bg-[#ff9350]/5 p-2.5">
                                    <div className="text-[10px] uppercase tracking-wider text-[#ff9350]/70 mb-1.5">Mechanic Fix</div>
                                    <p className="text-xs text-white/70">{selectedEquipment.mechanic_fixes}</p>
                                    {selectedEquipment.last_mechanic_updated_at && <p className="text-[10px] text-white/40 mt-1">Updated {new Date(selectedEquipment.last_mechanic_updated_at).toLocaleDateString()}</p>}
                                  </div>
                                )}
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
                                          const status = value === "P" ? "pass" : value === "F" ? "fail" : "pending";
                                          return (
                                            <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                              <span className="truncate">{item.label}</span>
                                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "pass" ? "bg-emerald-400" : status === "fail" ? "bg-red-400" : "bg-white/20"}`} />
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
                                            const status = value === "P" ? "pass" : value === "F" ? "fail" : "pending";
                                            return (
                                              <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                                <span className="truncate">{item.label}</span>
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status === "pass" ? "bg-emerald-400" : status === "fail" ? "bg-red-400" : "bg-white/20"}`} />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </details>
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
                            </div>

                            {/* Equipment Mechanic Fix Form */}
                            <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-[#050302] overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-amber-500/10">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                                  </div>
                                  <span className="text-sm font-medium text-white">Record Fix</span>
                                </div>
                                {selectedEquipment.last_mechanic_updated_at && (
                                  <span className="text-[10px] text-white/40">Updated {new Date(selectedEquipment.last_mechanic_updated_at).toLocaleDateString()}</span>
                                )}
                              </div>
                              <div className="px-4 py-3 space-y-3">
                                <textarea value={equipmentMechanicNotes} onChange={(e) => setEquipmentMechanicNotes(e.target.value)} rows={2} placeholder="Describe the fix, parts used, or follow-up needed..." className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all resize-none" />
                                <AnimatePresence>
                                  {equipmentSaveMessage && (
                                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className={`rounded-lg px-3 py-2 text-xs font-medium ${equipmentSaveMessage.includes("success") ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border border-red-500/20 text-red-300"}`}>
                                      {equipmentSaveMessage}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                <button type="button" onClick={handleSaveEquipmentFix} disabled={savingEquipmentFix} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:shadow-amber-500/20">
                                  {savingEquipmentFix ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><CheckCircle2 className="w-4 h-4" />Save Update</>}
                                </button>
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
          )}
        </div>
    </DashboardLayout>
  );
}

