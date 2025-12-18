import { useEffect, useMemo, useState, useCallback, memo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { PaginationControls } from "../components/PaginationControls";
import CardListSkeleton from "../components/skeletons/CardListSkeleton";
import TableSkeleton from "../components/skeletons/TableSkeleton";
import { DateField } from "../components/forms/GlassyPickers";
import { EmberCollapsibleSection } from "../components/mechanic/EmberCollapsibleSection";
import AdminPremiumScaffold, {
  type AdminHeroConfig,
} from "../components/admin/AdminPremiumScaffold";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Loader2,
  Search,
  X,
  ChevronRight,
  TrendingUp,
  Images,
  FileSignature,
  Truck,
  Shield,
  Flame,
  Filter,
  ListChecks,
  ClipboardList,
} from "lucide-react";
import { logger } from "../lib/logger";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

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

const CHECKLIST_STATUS_STYLES = {
  pass: "bg-[#052015] text-[#7ef2c8] border border-[#2a8a63]/50",
  fail: "bg-[#2a0b02] text-[#ffb199] border border-[#ff6b4a]/40",
  pending: "bg-white/5 text-white/60 border border-white/10",
};

function getChecklistStatusLabel(value?: ChecklistValue) {
  if (value === "P") {
    return { label: "Pass", className: CHECKLIST_STATUS_STYLES.pass };
  }
  if (value === "F") {
    return { label: "Fail", className: CHECKLIST_STATUS_STYLES.fail };
  }
  return { label: "Not Checked", className: CHECKLIST_STATUS_STYLES.pending };
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

// Memoized report list item component for better performance
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

  return (
    <motion.button
      custom={index}
      variants={prefersReducedMotion ? listItemVariantsReduced : listItemVariants}
      initial="hidden"
      animate="visible"
      onClick={onSelect}
      className={`w-full text-left px-4 py-4 transition-colors duration-150 ${
        isSelected
          ? "bg-[#ff9350]/15 border-l-2 border-l-[#ff9350]"
          : "border-l-2 border-l-transparent"
      }`}
      style={{
        background: isSelected ? undefined : 'linear-gradient(90deg, rgba(5, 5, 5, 0.05) 0%, rgba(121, 72, 42, 1) 50%, rgba(255, 147, 80, 1) 100%)',
        boxShadow: isSelected ? undefined : 'inset 0px 4px 25px 15px rgba(0, 0, 0, 0.85)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#ff9350]/70" />
            Truck {report.truck_number || "N/A"}
          </div>
          <div className="text-xs text-white/65 truncate mt-1">
            {report.drivers_name || "Unknown Driver"}
          </div>
          <div className="text-xs text-white/45 mt-1">
            {formatDateTime(report.created_at)}
          </div>
          {allFails.length > 0 && (
            <div className="text-xs text-[#ff8a65] mt-1">
              {allFails.length} fail{allFails.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {mechanicFlag && (
            <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#ffde8b]/15 border border-[#ffde8b]/30 rounded-full text-[10px] text-[#ffeac1]">
              <Clock className="w-3 h-3" />
            </div>
          )}
          {isSelected && <ChevronRight className="w-5 h-5 text-[#ff9350]" />}
        </div>
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

  // Hero configuration for AdminPremiumScaffold
  const heroConfig = useMemo<AdminHeroConfig>(
    () => ({
      eyebrow: "Ember Mechanics",
      eyebrowIcon: <Flame className="w-4 h-4 text-[#ff9350]" />,
      heading: "DVIR Review Center",
      description:
        "Focused triage for failed inspections and quick mechanic sign-offs. Review driver vehicle inspection reports and document repairs.",
      badges: [
        {
          label: role === "admin" ? "ADMIN" : "MECHANIC",
          icon: <Wrench className="w-4 h-4 text-[#ff9350]" />,
          variant: "solid",
        },
        {
          label: "Real-time Updates",
          icon: <Truck className="w-4 h-4 text-[#ffb48a]" />,
          variant: "outline",
        },
      ],
    }),
    [role]
  );

  // Side panel content
  const sidePanel = (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ff9350]/10 border border-[#ff9350]/30 rounded-full text-[0.65rem] font-semibold tracking-[0.3em] uppercase text-[#ffd4b8] mb-4">
          <Truck className="w-4 h-4 text-[#ff9350]" />
          Quick Stats
        </div>
        <h3 className="text-xl font-semibold text-white">DVIR Overview</h3>
        <p className="text-sm text-[#ffd4b8]/80 mt-1">
          Monitor fleet inspection status at a glance.
        </p>
      </div>

      <div className="space-y-3">
        {[
          {
            label: "Need Review",
            value: failedReports.length,
            icon: AlertTriangle,
            color: "text-[#ffb199]",
            bgColor: "bg-[#ff6b4a]/15",
            borderColor: "border-[#ff6b4a]/30",
          },
          {
            label: "Passed",
            value: passedReports.length,
            icon: CheckCircle2,
            color: "text-[#7ef2c8]",
            bgColor: "bg-[#10b981]/15",
            borderColor: "border-[#10b981]/30",
          },
          {
            label: "Mechanic Updated",
            value: mechanicUpdatedCount,
            icon: Wrench,
            color: "text-[#ffd4b8]",
            bgColor: "bg-[#ff9350]/15",
            borderColor: "border-[#ff9350]/30",
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 + 0.3 }}
            className={`rounded-2xl border ${stat.borderColor} ${stat.bgColor} p-4 flex items-center justify-between`}
          >
            <div className="flex items-center gap-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-sm text-white/90">{stat.label}</span>
            </div>
            <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
          </motion.div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs text-[#ffd4b8]/70 leading-relaxed">
          <strong className="text-[#ff9350]">Tip:</strong> Focus on "Need Review" DVIRs first. Document all repairs clearly for driver visibility.
        </p>
      </div>

      <div className="pt-2 border-t border-white/10">
        <p className="text-xs text-[#ffd4b8]/60">
          Logged in as <span className="text-[#ff9350] font-medium">{session?.user?.email?.split("@")[0] || "User"}</span>
        </p>
        <p className="text-xs text-[#ffd4b8]/60 mt-1">
          Role: <span className="text-white/80 font-medium uppercase">{role}</span>
        </p>
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
          <div className="space-y-6">
            {/* Search & Filters Section */}
            <EmberCollapsibleSection
              id="dvir-filters"
              title="Search & Filters"
              subtitle="Filter DVIRs by status or search by truck/driver"
              storageKey="dvir-filters-collapsed"
              defaultOpen={true}
              icon={<Filter className="w-5 h-5 md:w-6 md:h-6 text-[#ff9350]" />}
              headerAction={
                hasActiveFilters ? (
                  <motion.button
                    type="button"
                    onClick={clearFilters}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#ff9350]/15 border border-[#ff9350]/30 text-[#ffb48a] hover:bg-[#ff9350]/25 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Clear Filters
                  </motion.button>
                ) : undefined
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                {/* Status Tabs */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.35em] text-[#ffd4b8]/60 block">
                    Status Filter
                  </label>
                  <div className="flex gap-2 bg-[#0c0402]/80 rounded-xl border border-[#ff9350]/20 p-1.5">
                    {[
                      { id: "failed", label: "Need Review", icon: AlertTriangle, count: failedReports.length },
                      { id: "passed", label: "Passed", icon: CheckCircle2, count: passedReports.length },
                    ].map(({ id, label, icon: Icon, count }) => (
                      <motion.button
                        key={id}
                        onClick={() => {
                          setActiveTab(id as "failed" | "passed");
                          setCurrentPage(1);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                          activeTab === id
                            ? "bg-gradient-to-r from-[#ff9350] to-[#ffb48a] text-[#2a0d03] shadow-lg shadow-[#ff9350]/25"
                            : "text-white/70 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          activeTab === id ? "bg-black/20 text-white" : "bg-white/10 text-white"
                        }`}>
                          {count}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Search */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.35em] text-[#ffd4b8]/60 block">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#ff9350]/60" />
                    <input
                      type="text"
                      placeholder="Truck number or driver name..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full bg-[#0c0402]/80 border border-[#ff9350]/25 rounded-xl pl-11 pr-10 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff9350]/50 transition-all hover:border-[#ff9350]/40"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setCurrentPage(1);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </EmberCollapsibleSection>

            {/* DVIR Records Section */}
            <EmberCollapsibleSection
              id="dvir-records"
              title="DVIR Records"
              subtitle={`${filteredReports.length} report${filteredReports.length !== 1 ? "s" : ""} found`}
              storageKey="dvir-records-collapsed"
              defaultOpen={true}
              icon={<ListChecks className="w-5 h-5 md:w-6 md:h-6 text-[#ff9350]" />}
            >
              {/* Loading / Error */}
              {loading && (
                <div className="space-y-4">
                  <div className="hidden lg:block">
                    <TableSkeleton rows={6} columns={5} variant="ember" />
                  </div>
                  <div className="lg:hidden">
                    <CardListSkeleton rows={4} variant="ember" />
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              {!loading && !error && (
                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Left: Reports List */}
                  <div className="rounded-2xl border border-[#ff9350]/20 bg-[#0a0302]/90 backdrop-blur-sm overflow-hidden flex flex-col">
                    <div className="bg-gradient-to-r from-[#ff9350]/15 to-[#ffb48a]/10 px-4 py-3 border-b border-white/5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-[#ff9350]" />
                          {activeTab === "failed" ? "Need Review" : "Passed"} ({filteredReports.length})
                        </h3>
                        <span className="text-[0.65rem] uppercase tracking-[0.25em] text-white/50">
                          {currentPage}/{totalPages}
                        </span>
                      </div>
                    </div>

                    <div className="max-h-[720px] overflow-y-auto flex-1 divide-y divide-white/5">
                      {filteredReports.length === 0 ? (
                        <div className="p-6 text-center text-white/60">
                          <CheckCircle2 className="w-12 h-12 text-white/30 mx-auto mb-3" />
                          <p className="text-sm">
                            {searchQuery
                              ? "No reports match your search"
                              : activeTab === "failed"
                              ? "No DVIRs need review"
                              : "No passed DVIRs"}
                          </p>
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={clearFilters}
                              className="mt-3 text-[#ff9350] hover:text-white text-xs font-semibold"
                            >
                              Clear all filters
                            </button>
                          )}
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

                    {filteredReports.length > pageSize && (
                      <div className="border-t border-white/5">
                        <PaginationControls
                          currentPage={currentPage}
                          totalPages={totalPages}
                          totalItems={filteredReports.length}
                          loading={loading}
                          pageSize={pageSize}
                          onPreviousClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          onNextClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          label="reports"
                        />
                      </div>
                    )}
                  </div>

                  {/* Right: Detail View */}
                  <div className="lg:col-span-2">
                    <AnimatePresence mode="wait">
                      {!selectedReport ? (
                        <motion.div
                          key="empty-state"
                          {...(prefersReducedMotion ? pageTransitionReduced : pageTransition)}
                          className="h-full min-h-[400px] rounded-2xl border border-white/10 bg-[#0a0302]/80 p-10 flex flex-col items-center justify-center text-center"
                        >
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#ff9350]/10 border border-[#ff9350]/30 mb-4">
                            <TrendingUp className="w-7 h-7 text-[#ffb48a]" />
                          </div>
                          <p className="text-lg font-semibold text-white mb-1">
                            Select a DVIR to Review
                          </p>
                          <p className="text-sm text-white/60 max-w-md mx-auto">
                            Choose a report from the list to view details and record mechanic updates.
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={selectedId}
                          {...(prefersReducedMotion ? pageTransitionReduced : pageTransition)}
                          className="space-y-6"
                        >
                          {/* Report Details Card */}
                          <div className="rounded-2xl border border-[#ff9350]/20 bg-[#0a0302]/90 overflow-hidden">
                            {/* Card Header */}
                            <div className="bg-gradient-to-r from-[#ff9350]/10 to-transparent border-b border-white/5 px-6 py-5">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.35em] text-[#ff9350]/80">
                                    DVIR Summary
                                  </p>
                                  <h3 className="text-2xl font-bold text-white mt-1">
                                    Truck {selectedReport.truck_number || "N/A"}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-white/60">
                                    <span>Driver: {selectedReport.drivers_name || "Unknown"}</span>
                                    <span>•</span>
                                    <span>Mileage: {selectedReport.mileage?.toLocaleString() || "N/A"}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                                      getStatus(selectedReport) === "failed"
                                        ? "bg-[#2a0b02] text-[#ffb199] border border-[#ff6b4a]/40"
                                        : "bg-[#052015] text-[#7ef2c8] border border-[#2a8a63]/40"
                                    }`}
                                  >
                                    {getStatus(selectedReport) === "failed" ? (
                                      <>
                                        <AlertTriangle className="w-4 h-4" />
                                        Needs Review
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        All Passed
                                      </>
                                    )}
                                  </span>
                                  {hasMechanicUpdate(selectedReport) && (
                                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffde8b]/15 border border-[#ffde8b]/30 rounded-full text-xs font-medium text-[#ffeac1]">
                                      <Clock className="w-3 h-3" />
                                      Mechanic Updated
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Card Body */}
                            <div className="px-6 py-6 space-y-6">
                              {/* Failed Items */}
                              {(() => {
                                const { vehicleFails, aerialFails, allFails } = getFailedItems(selectedReport);

                                if (allFails.length === 0) {
                                  return (
                                    <div className="rounded-xl border border-[#2a8a63]/40 bg-[#052015] p-4">
                                      <div className="flex items-start gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                                        <div>
                                          <h4 className="font-semibold text-white">All Items Passed ✓</h4>
                                          <p className="text-sm text-white/70 mt-1">
                                            No deficiencies recorded on this DVIR.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="space-y-4">
                                    <h4 className="font-semibold text-white flex items-center gap-2">
                                      <AlertTriangle className="w-5 h-5 text-red-400" />
                                      Failed Checklist Items ({allFails.length})
                                    </h4>

                                    {vehicleFails.length > 0 && (
                                      <div className="rounded-xl border border-[#ff6b4a]/30 bg-[#2a0b02]/60 p-4 max-h-60 overflow-y-auto">
                                        <h5 className="font-medium text-[#ffb199] mb-3">Vehicle / Trailer</h5>
                                        <ul className="space-y-2">
                                          {vehicleFails.map((label) => (
                                            <li key={label} className="flex items-start gap-2 text-sm text-[#ffd8cb]">
                                              <span className="w-1.5 h-1.5 bg-[#ff6b4a] rounded-full mt-1.5 flex-shrink-0" />
                                              {label}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {aerialFails.length > 0 && (
                                      <div className="rounded-xl border border-orange-500/30 bg-[#2a1200]/60 p-4 max-h-60 overflow-y-auto">
                                        <h5 className="font-medium text-orange-200 mb-3">Aerial Lift</h5>
                                        <ul className="space-y-2">
                                          {aerialFails.map((label) => (
                                            <li key={label} className="flex items-start gap-2 text-sm text-orange-100">
                                              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-1.5 flex-shrink-0" />
                                              {label}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Driver Notes */}
                              <div>
                                <h4 className="font-semibold text-white mb-2">Driver Notes</h4>
                                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                                  {selectedReport.notes?.trim() || "No additional notes provided."}
                                </div>
                              </div>

                              {/* Vehicle Details */}
                              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1 text-sm text-white/80">
                                <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-2">Vehicle Details</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <p>Chipper #: {selectedReport.chipper_number || "—"}</p>
                                  <p>Trailer #: {selectedReport.trailer_number || "—"}</p>
                                  <p>Truck GVWR: {selectedReport.truck_gvwr || "—"}</p>
                                  <p>Trailer/Chipper GVWR: {selectedReport.trailer_chipper_gvwr || "—"}</p>
                                </div>
                              </div>

                              {/* Full Checklist Review */}
                              <div className="space-y-4">
                                <h4 className="font-semibold text-white">Full Checklist Review</h4>
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <h5 className="text-sm font-semibold text-white mb-3">Vehicle / Trailer</h5>
                                    <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                                      {VEHICLE_TRAILER_ITEMS.map((item) => {
                                        const value = selectedReport.vehicle_trailer_checklist?.[item.id];
                                        const { label: statusLabel, className: chipClass } = getChecklistStatusLabel(value);
                                        return (
                                          <div key={item.id} className="flex items-center justify-between py-2 text-sm text-white/80 gap-3">
                                            <span className="pr-2">{item.label}</span>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${chipClass}`}>
                                              {statusLabel}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                                    <h5 className="text-sm font-semibold text-white mb-3">Aerial Lift</h5>
                                    <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                                      {AERIAL_LIFT_ITEMS.map((item) => {
                                        const value = selectedReport.aerial_checklist?.[item.id];
                                        const { label: statusLabel, className: chipClass } = getChecklistStatusLabel(value);
                                        return (
                                          <div key={item.id} className="flex items-center justify-between py-2 text-sm text-white/80 gap-3">
                                            <span className="pr-2">{item.label}</span>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${chipClass}`}>
                                              {statusLabel}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Photos Section */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-white flex items-center gap-2">
                                  <Images className="w-4 h-4 text-[#ffb48a]" />
                                  Inspection Photos
                                </h4>
                                {mediaEntries.length === 0 ? (
                                  <p className="text-sm text-white/60">No photos were uploaded with this DVIR.</p>
                                ) : (
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    {mediaEntries.map((media) => (
                                      <a
                                        key={media.label}
                                        href={media.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group block rounded-xl border border-white/10 bg-white/5 overflow-hidden transition-all hover:border-[#ff9350]/30"
                                      >
                                        <div className="p-3 text-xs uppercase tracking-[0.3em] text-white/50">{media.label}</div>
                                        <img src={media.url} alt={media.label} className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Signatures Section */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-white flex items-center gap-2">
                                  <FileSignature className="w-4 h-4 text-[#ffb48a]" />
                                  Signatures
                                </h4>
                                {signatureEntries.length === 0 ? (
                                  <p className="text-sm text-white/60">No signature files were attached to this DVIR.</p>
                                ) : (
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    {signatureEntries.map((signature) => (
                                      <a
                                        key={signature.label}
                                        href={signature.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3 transition-all hover:border-[#ff9350]/30"
                                      >
                                        <p className="text-xs uppercase tracking-[0.3em] text-white/50">{signature.label}</p>
                                        <img src={signature.url} alt={signature.label} className="h-32 w-full object-contain bg-black/30 rounded-lg" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Mechanic Update Form */}
                          <div className="rounded-2xl border border-[#ff9350]/25 bg-gradient-to-br from-[#150602]/90 to-[#0a0201]/90 overflow-hidden">
                            <div className="bg-gradient-to-r from-[#ff9350]/10 to-transparent border-b border-[#ff9350]/20 px-6 py-5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.35em] text-[#ff9350]/80">Mechanic Fix Log</p>
                                  <h3 className="text-lg font-bold text-white mt-1">Record Mechanic Fix</h3>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-[#ff9350]/15 border border-[#ff9350]/30 flex items-center justify-center">
                                  <Wrench className="w-5 h-5 text-[#ffb48a]" />
                                </div>
                              </div>
                            </div>

                            <div className="px-6 py-6 space-y-5">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-white mb-2">Mechanic Truck Number</label>
                                  <input
                                    value={updateTruckNumber}
                                    onChange={(e) => setUpdateTruckNumber(e.target.value)}
                                    placeholder="e.g., Truck 101"
                                    className="w-full bg-[#0a0302]/80 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff9350]/50 transition-all hover:border-[#ff9350]/30"
                                  />
                                </div>
                                <DateField
                                  label="Service Date"
                                  value={updateDate}
                                  onValueChange={setUpdateDate}
                                  helperText="When this repair occurred"
                                  containerClassName="text-white"
                                  className="bg-[#0a0302]/80 border-white/15 focus:ring-[#ff9350]/60 focus:border-[#ff9350]/40"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-white mb-2">Deficiency Corrected</label>
                                <input
                                  value={updateDeficiencyCorrected}
                                  onChange={(e) => setUpdateDeficiencyCorrected(e.target.value)}
                                  placeholder="e.g., Replaced brake pads, checked fluid levels..."
                                  className="w-full bg-[#0a0302]/80 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff9350]/50 transition-all hover:border-[#ff9350]/30"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-white mb-2">Additional Remarks</label>
                                <textarea
                                  value={updateRemarks}
                                  onChange={(e) => setUpdateRemarks(e.target.value)}
                                  rows={4}
                                  placeholder="Document any additional details, parts used, or recommendations..."
                                  className="w-full bg-[#0a0302]/80 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ff9350]/50 transition-all resize-none hover:border-[#ff9350]/30"
                                />
                              </div>

                              <AnimatePresence>
                                {saveMessage && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className={`rounded-xl p-3 text-sm font-medium ${
                                      saveMessage.includes("✅")
                                        ? "bg-[#052015] border border-[#2a8a63]/40 text-[#7ef2c8]"
                                        : "bg-[#2a0b02] border border-[#ff6b4a]/30 text-[#ffb199]"
                                    }`}
                                  >
                                    {saveMessage}
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                type="button"
                                onClick={handleSaveUpdate}
                                disabled={savingUpdate}
                                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#ff9350] to-[#ffb48a] px-6 py-3 text-base font-semibold text-[#2a0d03] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_10px_25px_rgba(255,147,80,0.25)] hover:shadow-[0_15px_30px_rgba(255,147,80,0.35)]"
                              >
                                {savingUpdate ? (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <Wrench className="w-5 h-5" />
                                    Save Mechanic Update
                                  </>
                                )}
                              </motion.button>

                              <p className="text-xs text-white/60 text-center">
                                Your updates will be visible to drivers in their DVIR history
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </EmberCollapsibleSection>
          </div>
        </AdminPremiumScaffold>
      </div>
    </DashboardLayout>
  );
}
