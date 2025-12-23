import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { motion, AnimatePresence, useReducedMotion, useInView } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import CardListSkeleton from "../components/skeletons/CardListSkeleton";
import TableSkeleton from "../components/skeletons/TableSkeleton";
import { DateField } from "../components/forms/GlassyPickers";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
} from "../components/admin/AdminPremiumScaffold";
import {
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Loader2,
  Search,
  X,
  ChevronRight,
  Images,
  FileSignature,
  Truck,
  Shield,
  Flame,
  ListChecks,
  ClipboardList,
  ChevronLeft,
} from "lucide-react";
import { logger } from "../lib/logger";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useRef } from "react";

// Scroll reveal wrapper component
function ScrollRevealSection({ 
  children, 
  delay = 0,
  className = "" 
}: { 
  children: React.ReactNode; 
  delay?: number;
  className?: string;
}) {
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
  truck_gvwr: string | null;
  trailer_chipper_gvwr: string | null;
  medical_card_required: string | null;
  drivers_license_number: string | null;
  drivers_license_class: string | null;
  drivers_license_exp: string | null;
  drivers_license_required: string | null;
  has_medical_card: string | null;
  medical_card_exp: string | null;
  copy_of_registration: string | null;
  copy_of_insurance: string | null;
  drivers_signature_section_a: string | null;
  notes: string | null;
  vehicle_trailer_checklist: Record<string, ChecklistValue> | null;
  aerial_checklist: Record<string, ChecklistValue> | null;
  aerial_notes: string | null;
  mechanic_truck_number: string | null;
  mechanic_date: string | null;
  deficiency_corrected: string | null;
  mechanic_remarks: string | null;
  final_driver_signature: string | null;
  general_foreman_signature: string | null;
  mechanic_signature: string | null;
  driver_approval_signature: string | null;
  oil_dipstick_path: string;
  tire_photo_path: string | null;
  coolant_photo_path: string | null;
  damage_photo_path: string | null;
  detail_clean_truck_photo_path: string | null;
}

const VEHICLE_TRAILER_ITEMS: ChecklistItem[] = [
  { id: "air_compressor", label: "Air Compressor" },
  { id: "air_line", label: "Air Line" },
  { id: "batteries", label: "Batteries" },
  { id: "service_brakes", label: "Service Brakes" },
  { id: "brake_connections", label: "Brake Connections" },
  { id: "parking_brakes", label: "Parking Brakes" },
  { id: "clutch", label: "Clutch" },
  { id: "AC/heater", label: "AC/Heater" },
  { id: "defroster", label: "Defroster" },
  { id: "drive_line", label: "Drive Line" },
  { id: "engine", label: "Engine" },
  { id: "fifth_wheel", label: "Fifth Wheel" },
  { id: "horn", label: "Horn" },
  { id: "head_lights", label: "Head Lights" },
  {
    id: "safety_equipment",
    label: "Safety Equipment (First Aid, Fire Ext., Spare Fuses, etc.)",
  },
  { id: "taillights", label: "Taillights" },
  { id: "brake_lights", label: "Brake Lights" },
  { id: "turn_indicators", label: "Turn Indicators" },
  { id: "dash_lights", label: "Dash Lights" },
  { id: "safety_lights", label: "Safety Lights" },
  { id: "clearance_lights", label: "Clearance Lights" },
  { id: "mirrors", label: "Mirrors" },
  { id: "muffler", label: "Muffler" },
  { id: "oil_pressure", label: "Oil Pressure" },
  { id: "radiator", label: "Radiator" },
  { id: "fuel_tanks", label: "Fuel Tanks" },
  { id: "rear_end", label: "Rear End" },
  { id: "springs", label: "Springs" },
  { id: "starter", label: "Starter" },
  { id: "steering", label: "Steering" },
  { id: "tires", label: "Tires" },
  { id: "wheels", label: "Wheels" },
  { id: "windows", label: "Windows" },
  { id: "windshield_wipers", label: "Windshield Wipers" },
  { id: "reflectors", label: "Reflectors" },
  { id: "trailer_tires", label: "Trailer Tires" },
  { id: "trailer_wheels", label: "Trailer Wheels" },
  { id: "trailer_brakes", label: "Trailer Brakes" },
  { id: "trailer_brake_connections", label: "Trailer Brake Connections" },
  { id: "trailer_doors", label: "Trailer Doors" },
  { id: "trailer_springs", label: "Trailer Springs" },
  { id: "trailer_lights_all", label: "Trailer Lights (All)" },
  { id: "landing_gear", label: "Landing Gear" },
  { id: "trailer_hitch", label: "Trailer Hitch" },
  { id: "coupling_chains", label: "Coupling Chains" },
  { id: "axles", label: "Axles" },
  { id: "trailer_floor", label: "Trailer Floor" },
];

const AERIAL_LIFT_ITEMS: ChecklistItem[] = [
  { id: "hydraulic_oil_level", label: "Oil Level in Hydraulic Reservoir" },
  { id: "hydraulic_system_leaks", label: "Hydraulic System free of Leaks" },
  {
    id: "hydraulic_cylinders_leaks",
    label: "Hydraulic Cylinders free of Leaks",
  },
  { id: "fasteners_tight", label: "Fasteners at Proper Tightness" },
  { id: "booms_no_cracks", label: "Booms free of Cracks and Damage" },
  {
    id: "booms_no_debris",
    label: "Booms and Components free of Debris or Obstructions",
  },
  {
    id: "boom_functions_working",
    label: "All Boom Functions Working Properly",
  },
  {
    id: "grease_fittings_recent",
    label: "All Grease Fittings greased within 5 days",
  },
  {
    id: "dielectric_test_up_to_date",
    label: "Dielectric Inspection Test Up to Date",
  },
];

function getFailedItems(report: DVIRReport) {
  const vehicleFails: string[] = [];
  const aerialFails: string[] = [];

  if (report.vehicle_trailer_checklist) {
    for (const item of VEHICLE_TRAILER_ITEMS) {
      const val = report.vehicle_trailer_checklist[item.id];
      if (val === "F") {
        vehicleFails.push(item.label);
      }
    }
  }

  if (report.aerial_checklist) {
    for (const item of AERIAL_LIFT_ITEMS) {
      const val = report.aerial_checklist[item.id];
      if (val === "F") {
        aerialFails.push(item.label);
      }
    }
  }

  return { vehicleFails, aerialFails, allFails: [...vehicleFails, ...aerialFails] };
}

function getStatus(report: DVIRReport) {
  const { allFails } = getFailedItems(report);
  return allFails.length > 0 ? "failed" : "passed";
}

function hasMechanicUpdate(report: DVIRReport) {
  return Boolean(
    report.deficiency_corrected ||
      report.mechanic_remarks ||
      report.mechanic_date
  );
}

// Animation variants - defined outside component for stable references
const listItemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: Math.min(i * 0.02, 0.15), // Cap max delay for better performance
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  }),
};

// Reduced motion variants
const listItemVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

// Stable page transition configs
const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

const pageTransitionReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.1 },
};

// Memoized report list item component - COMPACT VERSION
const ReportListItem = memo(function ReportListItem({
  report,
  index,
  isSelected,
  onSelect,
  formatDateTime,
  prefersReducedMotion,
}: {
  report: DVIRReport;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  formatDateTime: (iso: string | null | undefined) => string;
  prefersReducedMotion: boolean | null;
}) {
  const { allFails } = getFailedItems(report);
  const mechanicFlag = hasMechanicUpdate(report);
  const status = getStatus(report);

  return (
    <motion.button
      custom={index}
      variants={prefersReducedMotion ? listItemVariantsReduced : listItemVariants}
      initial="hidden"
      animate="visible"
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 transition-all duration-150 flex items-center gap-2.5 group ${
        isSelected
          ? "bg-gradient-to-r from-[#ff9350]/20 to-[#ff9350]/5 border-l-2 border-l-[#ff9350]"
          : "border-l-2 border-l-transparent hover:bg-white/[0.03]"
      }`}
    >
      {/* Status indicator dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        status === "failed" ? "bg-red-400" : "bg-emerald-400"
      }`} />
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm text-white truncate">
            {report.truck_number || "N/A"}
          </span>
          {mechanicFlag && (
            <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] text-amber-300 font-medium">
              Fixed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-white/50 truncate">
            {report.drivers_name || "Unknown"}
          </span>
          <span className="text-[10px] text-white/30">•</span>
          <span className="text-[10px] text-white/40">
            {formatDateTime(report.created_at)}
          </span>
        </div>
      </div>
      
      {/* Right side */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {allFails.length > 0 && (
          <span className="text-[10px] font-medium text-red-300 bg-red-500/15 px-1.5 py-0.5 rounded">
            {allFails.length}
          </span>
        )}
        <ChevronRight className={`w-4 h-4 transition-all ${
          isSelected ? "text-[#ff9350]" : "text-white/20 group-hover:text-white/40"
        }`} />
      </div>
    </motion.button>
  );
});

export default function MechanicDVIRCenter() {
  const { role, session } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const unauthorized = role && role !== "mechanic" && role !== "admin";

  const [reports, setReports] = useState<DVIRReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [activeTab, setActiveTab] = useState<"failed" | "passed">("failed");

  // Pagination State
  const pageSize = 15;
  const [currentPage, setCurrentPage] = useState(1);

  // Mechanic update form state
  const [updateTruckNumber, setUpdateTruckNumber] = useState("");
  const [updateDate, setUpdateDate] = useState("");
  const [updateDeficiencyCorrected, setUpdateDeficiencyCorrected] = useState("");
  const [updateRemarks, setUpdateRemarks] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const getPublicUrl = useCallback((path?: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("dvir-photos").getPublicUrl(path);
    return data.publicUrl ?? null;
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: supabaseError } = await supabase
        .from("dvir_reports")
        .select(
          `
            id,
            created_at,
            user_id,
            truck_number,
            mileage,
            drivers_name,
            chipper_number,
            trailer_number,
            truck_gvwr,
            trailer_chipper_gvwr,
            medical_card_required,
            drivers_license_number,
            drivers_license_class,
            drivers_license_exp,
            drivers_license_required,
            has_medical_card,
            medical_card_exp,
            copy_of_registration,
            copy_of_insurance,
            drivers_signature_section_a,
            notes,
            vehicle_trailer_checklist,
            aerial_checklist,
            aerial_notes,
            mechanic_truck_number,
            mechanic_date,
            deficiency_corrected,
            mechanic_remarks,
            final_driver_signature,
            general_foreman_signature,
            mechanic_signature,
            driver_approval_signature,
            oil_dipstick_path,
            tire_photo_path,
            coolant_photo_path,
            damage_photo_path,
            detail_clean_truck_photo_path
          `
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (supabaseError) throw supabaseError;

      setReports(data as DVIRReport[] || []);
    } catch (err) {
      logger.error("Error loading DVIR reports for mechanic center:", err);
      setError("Failed to load DVIR reports.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Filter reports based on active tab and search
  const filteredReports = useMemo(() => {
    let filtered = reports;

    // Filter by status
    if (activeTab === "failed") {
      filtered = filtered.filter((r) => getStatus(r) === "failed");
    } else {
      filtered = filtered.filter((r) => getStatus(r) === "passed");
    }

    // Filter by search query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.truck_number?.toLowerCase().includes(query) ||
          r.drivers_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [reports, activeTab, debouncedSearchQuery]);

  const failedReports = useMemo(
    () => reports.filter((r) => getStatus(r) === "failed"),
    [reports]
  );
  const passedReports = useMemo(
    () => reports.filter((r) => getStatus(r) === "passed"),
    [reports]
  );
  const mechanicUpdatedCount = useMemo(
    () => reports.filter((r) => hasMechanicUpdate(r)).length,
    [reports]
  );

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedId) || null,
    [reports, selectedId]
  );

  const mediaEntries = useMemo(() => {
    if (!selectedReport) return [];
    const base = [
      { label: "Oil Dipstick", path: selectedReport.oil_dipstick_path },
      { label: "Tire Photo", path: selectedReport.tire_photo_path },
      { label: "Coolant Photo", path: selectedReport.coolant_photo_path },
      { label: "Damage Photo", path: selectedReport.damage_photo_path },
      { label: "Detail / Clean Truck Photo", path: selectedReport.detail_clean_truck_photo_path },
    ];
    return base
      .filter((entry) => entry.path)
      .map((entry) => {
        const url = getPublicUrl(entry.path);
        return url ? { label: entry.label, url } : null;
      })
      .filter((entry): entry is { label: string; url: string } => Boolean(entry));
  }, [selectedReport, getPublicUrl]);

  const signatureEntries = useMemo(() => {
    if (!selectedReport) return [];
    const base = [
      { label: "Final Driver Signature", path: selectedReport.final_driver_signature },
      { label: "General Foreman Signature", path: selectedReport.general_foreman_signature },
      { label: "Mechanic Signature", path: selectedReport.mechanic_signature },
      { label: "Driver Approval Signature", path: selectedReport.driver_approval_signature },
      { label: "Section A Signature", path: selectedReport.drivers_signature_section_a },
    ];
    return base
      .filter((entry) => entry.path)
      .map((entry) => {
        const url = getPublicUrl(entry.path);
        return url ? { label: entry.label, url } : null;
      })
      .filter((entry): entry is { label: string; url: string } => Boolean(entry));
  }, [selectedReport, getPublicUrl]);

  useEffect(() => {
    if (!selectedReport) {
      setUpdateTruckNumber("");
      setUpdateDate("");
      setUpdateDeficiencyCorrected("");
      setUpdateRemarks("");
      return;
    }

    setUpdateTruckNumber(selectedReport.mechanic_truck_number || "");
    setUpdateDate(selectedReport.mechanic_date || "");
    setUpdateDeficiencyCorrected(selectedReport.deficiency_corrected || "");
    setUpdateRemarks(selectedReport.mechanic_remarks || "");
  }, [selectedReport]);

  const handleSelectReport = (reportId: string) => {
    setSaveMessage(null);
    setSelectedId((prev) => (prev === reportId ? null : reportId));
  };

  const handleSaveUpdate = async () => {
    if (!selectedReport) return;

    try {
      setSavingUpdate(true);
      setSaveMessage(null);

      const { error } = await supabase
        .from("dvir_reports")
        .update({
          mechanic_truck_number: updateTruckNumber || null,
          mechanic_date: updateDate || null,
          deficiency_corrected: updateDeficiencyCorrected || null,
          mechanic_remarks: updateRemarks || null,
        })
        .eq("id", selectedReport.id);

      if (error) throw error;

      setReports((prev) =>
        prev.map((r) =>
          r.id === selectedReport.id
            ? {
                ...r,
                mechanic_truck_number: updateTruckNumber || null,
                mechanic_date: updateDate || null,
                deficiency_corrected: updateDeficiencyCorrected || null,
                mechanic_remarks: updateRemarks || null,
              }
            : r
        )
      );

      setSaveMessage("✅ Mechanic update saved successfully!");
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      logger.error("Error saving mechanic DVIR update:", err);
      setSaveMessage("❌ Failed to save update. Please try again.");
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setSavingUpdate(false);
    }
  };

  const formatDateTime = (iso: string | null | undefined) => {
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
  };

  const clearFilters = () => {
    setSearchQuery("");
    setActiveTab("failed");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || activeTab !== "failed";

  const totalPages =
    filteredReports.length > 0
      ? Math.max(1, Math.ceil(filteredReports.length / pageSize))
      : 1;

  // Hero configuration for AdminPremiumScaffold - Compact
  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Mechanics",
      eyebrowIcon: <Flame className="w-3.5 h-3.5 text-amber-400" />,
      heading: "DVIR Center",
      description: "Review inspections and document repairs",
      badges: [
        {
          label: role === "admin" ? "ADMIN" : "MECH",
          icon: <Wrench className="w-3.5 h-3.5 text-amber-400" />,
          variant: "solid",
        },
      ],
    }),
    [role]
  );

  // Side panel content - COMPACT with better color contrast
  const sidePanel = (
    <div className="space-y-4">
      {/* Stats grid - compact */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Review",
            value: failedReports.length,
            icon: AlertTriangle,
            gradient: "from-red-500/20 to-red-600/10",
            border: "border-red-500/30",
            iconColor: "text-red-400",
            valueColor: "text-red-300",
          },
          {
            label: "Passed",
            value: passedReports.length,
            icon: CheckCircle2,
            gradient: "from-emerald-500/20 to-emerald-600/10",
            border: "border-emerald-500/30",
            iconColor: "text-emerald-400",
            valueColor: "text-emerald-300",
          },
          {
            label: "Fixed",
            value: mechanicUpdatedCount,
            icon: Wrench,
            gradient: "from-amber-500/20 to-amber-600/10",
            border: "border-amber-500/30",
            iconColor: "text-amber-400",
            valueColor: "text-amber-300",
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 + 0.2 }}
            className={`rounded-xl border ${stat.border} bg-gradient-to-br ${stat.gradient} p-2.5 text-center`}
          >
            <stat.icon className={`w-4 h-4 ${stat.iconColor} mx-auto mb-1`} />
            <div className={`text-xl font-bold ${stat.valueColor}`}>{stat.value}</div>
            <div className="text-[9px] uppercase tracking-wider text-white/50">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Quick tip - more subtle */}
      <div className="rounded-xl border border-white/5 bg-black/20 p-3">
        <p className="text-[11px] text-white/50 leading-relaxed">
          <span className="text-amber-400 font-medium">Tip:</span> Focus on "Need Review" DVIRs first.
        </p>
      </div>

      {/* User info - minimal */}
      <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/5">
        <span>{session?.user?.email?.split("@")[0] || "User"}</span>
        <span className="uppercase font-medium text-amber-400/70">{role}</span>
      </div>
    </div>
  );

  if (unauthorized) {
    return (
      <DashboardLayout title="Mechanic DVIR Center">
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-gray-400">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Mechanic DVIR Center">
      <div className="w-full min-h-screen bg-gradient-to-br from-[#1a0804] via-[#0f0402] to-[#0a0201]">
        <AdminPremiumScaffold
          hero={heroConfig}
          sidePanel={sidePanel}
          theme="ember"
        >
          <div className="space-y-4">
            {/* Compact Filter Bar - Not collapsible for faster access */}
            <ScrollRevealSection delay={0}>
              <div className="rounded-xl border border-[#ff9350]/15 bg-gradient-to-r from-[#0c0402] to-[#120805] p-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Status Toggle */}
                  <div className="flex gap-1 p-1 bg-black/30 rounded-lg border border-white/5">
                    {[
                      { id: "failed", label: "Need Review", icon: AlertTriangle, count: failedReports.length, color: "text-red-400" },
                      { id: "passed", label: "Passed", icon: CheckCircle2, count: passedReports.length, color: "text-emerald-400" },
                    ].map(({ id, label, icon: Icon, count, color }) => (
                      <button
                        key={id}
                        onClick={() => {
                          setActiveTab(id as "failed" | "passed");
                          setCurrentPage(1);
                        }}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                          activeTab === id
                            ? "bg-gradient-to-r from-[#ff9350] to-[#e87830] text-white shadow-md"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${activeTab === id ? "text-white" : color}`} />
                        <span className="hidden sm:inline">{label}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          activeTab === id ? "bg-white/20" : "bg-white/10"
                        }`}>
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      placeholder="Search truck or driver..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-8 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#ff9350]/50 focus:border-[#ff9350]/30 transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentPage(1);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Clear filters */}
                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 transition-all"
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </ScrollRevealSection>

            {/* DVIR Records Section - Compact */}
            <ScrollRevealSection delay={0.1}>
              {/* Loading / Error */}
              {loading && (
                <div className="space-y-3">
                  <div className="hidden lg:block">
                    <TableSkeleton rows={5} columns={4} variant="ember" />
                  </div>
                  <div className="lg:hidden">
                    <CardListSkeleton rows={4} variant="ember" />
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              {!loading && !error && (
                <div className="grid gap-4 lg:grid-cols-3">
                  {/* Left: Reports List - Compact */}
                  <div className="rounded-xl border border-white/10 bg-[#080403] overflow-hidden flex flex-col">
                    {/* Compact header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-white/5 to-transparent border-b border-white/5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${activeTab === "failed" ? "bg-red-400" : "bg-emerald-400"}`} />
                        <span className="text-xs font-medium text-white/80">
                          {activeTab === "failed" ? "Need Review" : "Passed"}
                        </span>
                        <span className="text-[10px] text-white/40">({filteredReports.length})</span>
                      </div>
                      {/* Compact pagination */}
                      {filteredReports.length > 0 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] text-white/50 min-w-[40px] text-center">
                            {currentPage}/{totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Scrollable list - more compact */}
                    <div className="max-h-[500px] overflow-y-auto flex-1 divide-y divide-white/[0.03]">
                      {filteredReports.length === 0 ? (
                        <div className="p-4 text-center text-white/50">
                          <CheckCircle2 className="w-8 h-8 text-white/20 mx-auto mb-2" />
                          <p className="text-xs">
                            {searchQuery ? "No matches" : activeTab === "failed" ? "All clear!" : "No records"}
                          </p>
                        </div>
                      ) : (
                        filteredReports.map((report, index) => (
                          <ReportListItem
                            key={report.id}
                            report={report}
                            index={index}
                            isSelected={report.id === selectedId}
                            onSelect={() => handleSelectReport(report.id)}
                            formatDateTime={formatDateTime}
                            prefersReducedMotion={prefersReducedMotion}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right: Detail View - Compact */}
                  <div className="lg:col-span-2">
                    <AnimatePresence mode="wait">
                      {!selectedReport ? (
                        <motion.div
                          key="empty-state"
                          {...(prefersReducedMotion ? pageTransitionReduced : pageTransition)}
                          className="h-full min-h-[300px] rounded-xl border border-white/5 bg-[#050302] p-6 flex flex-col items-center justify-center text-center"
                        >
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-3">
                            <ClipboardList className="w-5 h-5 text-amber-400/70" />
                          </div>
                          <p className="text-sm font-medium text-white/80 mb-0.5">
                            Select a DVIR
                          </p>
                          <p className="text-xs text-white/40">
                            Choose a report to view details
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={selectedId}
                          {...(prefersReducedMotion ? pageTransitionReduced : pageTransition)}
                          className="space-y-3"
                        >
                          {/* Report Details Card - Compact */}
                          <div className="rounded-xl border border-white/10 bg-[#050302] overflow-hidden">
                            {/* Card Header - Compact with contrast */}
                            <div className="bg-gradient-to-r from-amber-500/8 to-transparent border-b border-white/5 px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                                    <Truck className="w-5 h-5 text-amber-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="text-base font-semibold text-white truncate">
                                      Truck {selectedReport.truck_number || "N/A"}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-white/50">
                                      <span className="truncate">{selectedReport.drivers_name || "Unknown"}</span>
                                      <span className="text-white/20">•</span>
                                      <span>{selectedReport.mileage?.toLocaleString() || "—"} mi</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {hasMechanicUpdate(selectedReport) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/15 border border-amber-500/25 rounded text-[10px] font-medium text-amber-300">
                                      <Wrench className="w-3 h-3" />
                                      Fixed
                                    </span>
                                  )}
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                      getStatus(selectedReport) === "failed"
                                        ? "bg-red-500/15 text-red-300 border border-red-500/25"
                                        : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                                    }`}
                                  >
                                    {getStatus(selectedReport) === "failed" ? (
                                      <>
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Review
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Passed
                                      </>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Card Body - Compact */}
                            <div className="px-4 py-4 space-y-4">
                              {/* Failed Items - Compact */}
                              {(() => {
                                const { vehicleFails, aerialFails, allFails } = getFailedItems(selectedReport);

                                if (allFails.length === 0) {
                                  return (
                                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                      <span className="text-sm text-emerald-300">All items passed</span>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-medium text-red-300">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                      {allFails.length} Failed Item{allFails.length !== 1 ? "s" : ""}
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                      {vehicleFails.length > 0 && (
                                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 max-h-40 overflow-y-auto">
                                          <div className="text-[10px] uppercase tracking-wider text-red-300/70 mb-1.5">Vehicle / Trailer</div>
                                          <ul className="space-y-1">
                                            {vehicleFails.map((label) => (
                                              <li key={label} className="flex items-start gap-1.5 text-xs text-red-200/80">
                                                <span className="w-1 h-1 bg-red-400 rounded-full mt-1.5 flex-shrink-0" />
                                                {label}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {aerialFails.length > 0 && (
                                        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-2.5 max-h-40 overflow-y-auto">
                                          <div className="text-[10px] uppercase tracking-wider text-orange-300/70 mb-1.5">Aerial Lift</div>
                                          <ul className="space-y-1">
                                            {aerialFails.map((label) => (
                                              <li key={label} className="flex items-start gap-1.5 text-xs text-orange-200/80">
                                                <span className="w-1 h-1 bg-orange-400 rounded-full mt-1.5 flex-shrink-0" />
                                                {label}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Driver Notes & Vehicle Details - Compact row */}
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                                  <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Driver Notes</div>
                                  <p className="text-xs text-white/60 line-clamp-2">
                                    {selectedReport.notes?.trim() || "No notes"}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                                  <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Vehicle Info</div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-white/50">
                                    <span>Chipper: {selectedReport.chipper_number || "—"}</span>
                                    <span>Trailer: {selectedReport.trailer_number || "—"}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Full Checklist Review - Collapsible & Compact */}
                              <details className="group">
                                <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                                  <span className="flex items-center gap-1.5">
                                    <ListChecks className="w-3.5 h-3.5 text-amber-400/70" />
                                    Full Checklist Review
                                  </span>
                                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                                </summary>
                                <div className="grid gap-2 sm:grid-cols-2 pt-2">
                                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                                    <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Vehicle / Trailer</div>
                                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                                      {VEHICLE_TRAILER_ITEMS.map((item) => {
                                        const value = selectedReport.vehicle_trailer_checklist?.[item.id];
                                        const status = value === "P" ? "pass" : value === "F" ? "fail" : "pending";
                                        return (
                                          <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                            <span className="truncate">{item.label}</span>
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                              status === "pass" ? "bg-emerald-400" : status === "fail" ? "bg-red-400" : "bg-white/20"
                                            }`} />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                                    <div className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Aerial Lift</div>
                                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                                      {AERIAL_LIFT_ITEMS.map((item) => {
                                        const value = selectedReport.aerial_checklist?.[item.id];
                                        const status = value === "P" ? "pass" : value === "F" ? "fail" : "pending";
                                        return (
                                          <div key={item.id} className="flex items-center justify-between py-1 text-[11px] text-white/60 gap-2">
                                            <span className="truncate">{item.label}</span>
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                              status === "pass" ? "bg-emerald-400" : status === "fail" ? "bg-red-400" : "bg-white/20"
                                            }`} />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </details>

                              {/* Photos Section - Collapsible */}
                              <details className="group">
                                <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                                  <span className="flex items-center gap-1.5">
                                    <Images className="w-3.5 h-3.5 text-amber-400/70" />
                                    Photos ({mediaEntries.length})
                                  </span>
                                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                                </summary>
                                {mediaEntries.length === 0 ? (
                                  <p className="text-[11px] text-white/40 pt-1">No photos uploaded</p>
                                ) : (
                                  <div className="grid grid-cols-3 gap-2 pt-2">
                                    {mediaEntries.map((media) => (
                                      <a
                                        key={media.label}
                                        href={media.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/img block rounded-lg border border-white/5 bg-black/30 overflow-hidden transition-all hover:border-amber-500/30"
                                      >
                                        <img src={media.url} alt={media.label} className="h-20 w-full object-cover transition-transform duration-200 group-hover/img:scale-105" />
                                        <div className="px-1.5 py-1 text-[9px] text-white/40 truncate">{media.label}</div>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </details>

                              {/* Signatures Section - Collapsible */}
                              <details className="group">
                                <summary className="flex items-center justify-between cursor-pointer py-2 text-xs font-medium text-white/60 hover:text-white/80 transition-colors">
                                  <span className="flex items-center gap-1.5">
                                    <FileSignature className="w-3.5 h-3.5 text-amber-400/70" />
                                    Signatures ({signatureEntries.length})
                                  </span>
                                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
                                </summary>
                                {signatureEntries.length === 0 ? (
                                  <p className="text-[11px] text-white/40 pt-1">No signatures</p>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2 pt-2">
                                    {signatureEntries.map((signature) => (
                                      <a
                                        key={signature.label}
                                        href={signature.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-lg border border-white/5 bg-black/30 p-2 transition-all hover:border-amber-500/30"
                                      >
                                        <div className="text-[9px] text-white/40 mb-1 truncate">{signature.label}</div>
                                        <img src={signature.url} alt={signature.label} className="h-16 w-full object-contain" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </details>
                            </div>
                          </div>

                          {/* Mechanic Update Form - Compact with contrast */}
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
                                  <input
                                    value={updateTruckNumber}
                                    onChange={(e) => setUpdateTruckNumber(e.target.value)}
                                    placeholder="e.g., 101"
                                    className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
                                  />
                                </div>
                                <DateField
                                  label="Date"
                                  value={updateDate}
                                  onValueChange={setUpdateDate}
                                  variant="ember"
                                  containerClassName="text-white [&_label]:text-[10px] [&_label]:uppercase [&_label]:tracking-wider [&_label]:text-white/40 [&_label]:mb-1"
                                  labelClassName="!text-[10px] !uppercase !tracking-wider !text-white/40"
                                  className="!rounded-lg !py-2 !px-3 !text-sm border-amber-500/20"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Fix Applied</label>
                                <input
                                  value={updateDeficiencyCorrected}
                                  onChange={(e) => setUpdateDeficiencyCorrected(e.target.value)}
                                  placeholder="e.g., Replaced brake pads..."
                                  className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Remarks</label>
                                <textarea
                                  value={updateRemarks}
                                  onChange={(e) => setUpdateRemarks(e.target.value)}
                                  rows={2}
                                  placeholder="Additional notes..."
                                  className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all resize-none"
                                />
                              </div>

                              <AnimatePresence>
                                {saveMessage && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    className={`rounded-lg px-3 py-2 text-xs font-medium ${
                                      saveMessage.includes("✅")
                                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                                        : "bg-red-500/10 border border-red-500/20 text-red-300"
                                    }`}
                                  >
                                    {saveMessage}
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <button
                                type="button"
                                onClick={handleSaveUpdate}
                                disabled={savingUpdate}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg hover:shadow-amber-500/20"
                              >
                                {savingUpdate ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Save Update
                                  </>
                                )}
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
        </AdminPremiumScaffold>
      </div>
    </DashboardLayout>
  );
}
