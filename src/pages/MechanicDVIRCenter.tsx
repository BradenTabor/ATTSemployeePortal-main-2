import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { PaginationControls } from "../components/PaginationControls";
import CardListSkeleton from "../components/skeletons/CardListSkeleton";
import TableSkeleton from "../components/skeletons/TableSkeleton";
import { DateField } from "../components/forms/GlassyPickers";
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

function MobileReportCard({
  report,
  isSelected,
  onSelect,
  formatDateTimeFn,
}: {
  report: DVIRReport;
  isSelected: boolean;
  onSelect: () => void;
  formatDateTimeFn: (iso: string | null | undefined) => string;
}) {
  const status = getStatus(report);
  const { allFails } = getFailedItems(report);
  const mechanicFlag = hasMechanicUpdate(report);

  const statusStyles =
    status === "failed"
      ? "bg-[#2a0b02] text-[#ffb199] border border-[#ff6b4a]/40"
      : "bg-[#052015] text-[#7ef2c8] border border-[#2a8a63]/40";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border ${
        isSelected ? "border-[#ff9350]" : "border-white/10"
      } bg-[#0f0401]/85 p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)] cursor-pointer`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/50">
            Truck
          </p>
          <p className="text-xl font-semibold text-white">
            {report.truck_number || "N/A"}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${statusStyles}`}
        >
          {status === "failed" ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {status}
        </span>
      </div>

      <div className="text-sm text-white/70 space-y-1">
        <p>{report.drivers_name || "Unknown driver"}</p>
        <p className="text-xs text-white/50">
          {formatDateTimeFn(report.created_at)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
        {allFails.length > 0 && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ff6b4a]/15 text-[#ffb199] border border-[#ff6b4a]/30">
            {allFails.length} fail{allFails.length !== 1 ? "s" : ""}
          </span>
        )}
        {mechanicFlag && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ffde8b]/20 text-[#fff0cd] border border-[#ffde8b]/30">
            <Clock className="w-3 h-3" />
            Mechanic update
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function MechanicDVIRCenter() {
  const { role } = useAuth();
  const unauthorized = role && role !== "mechanic" && role !== "admin";

  const [reports, setReports] = useState<DVIRReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [activeTab, setActiveTab] = useState<"failed" | "passed">("failed");

  // 🔢 Pagination State
  const pageSize = 15;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReports, setTotalReports] = useState<number | null>(null);

  // Mechanic update form state
  const [updateTruckNumber, setUpdateTruckNumber] = useState("");
  const [updateDate, setUpdateDate] = useState("");
  const [updateDeficiencyCorrected, setUpdateDeficiencyCorrected] =
    useState("");
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

      const { data, error: supabaseError, count } = await supabase
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
          `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (supabaseError) throw supabaseError;

      setReports(data as DVIRReport[] || []);

      if (typeof count === "number") {
        setTotalReports(count);
      } else {
        setTotalReports(data?.length ?? 0);
      }
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
        . from("dvir_reports")
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


  const totalPages =
    filteredReports.length > 0
      ? Math.max(1, Math.ceil(filteredReports.length / pageSize))
      : 1;

  if (unauthorized) {
    return (
      <DashboardLayout title="Mechanic DVIR Center">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">
              Access Denied
            </h2>
            <p className="text-gray-400">
              You do not have permission to view this page. 
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Mechanic DVIR Center">
      <div className="w-full min-h-screen bg-gradient-to-br from-[#2c1404] via-[#150602] to-[#2a0d03] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* ===== HEADER ===== */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-3 bg-[#ff9350]/15 rounded-xl border border-[#ff9350]/30">
                    <Wrench className="w-6 h-6 text-[#ffb48a]" />
                  </div>
                  <h1 className="text-3xl font-bold text-white">
                    DVIR Review Center
                  </h1>
                </div>
                <p className="text-white/70 max-w-2xl">
                  Review submitted DVIRs, flag failed inspections, and log repair actions with a premium ember surface.
                </p>
              </div>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-white/10 bg-[#1b0801]/65 p-4 shadow-[0_15px_35px_rgba(0,0,0,0.45)]"
              >
                <div className="text-white/60 text-xs font-semibold mb-1 tracking-[0.2em] uppercase">
                  Total DVIRs
                </div>
                <div className="text-2xl font-bold text-white">
                  {totalReports || 0}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-xl border border-[#ff6b4a]/35 bg-[#2a0b02]/85 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
              >
                <div className="text-[#ffb199] text-xs font-semibold mb-1 flex items-center gap-1 tracking-[0.2em] uppercase">
                  <AlertTriangle className="w-3 h-3" />
                  Need Review
                </div>
                <div className="text-2xl font-bold text-[#ff8a65]">
                  {failedReports.length}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl border border-[#ff9350]/35 bg-[#1b0801]/80 p-4"
              >
                <div className="text-[#ffd2ba] text-xs font-semibold mb-1 flex items-center gap-1 tracking-[0.2em] uppercase">
                  <CheckCircle2 className="w-3 h-3" />
                  Passed
                </div>
                <div className="text-2xl font-bold text-white">
                  {passedReports.length}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-xl border border-[#ffde8b]/35 bg-[#2a0d01]/80 p-4"
              >
                <div className="text-[#ffe0b0] text-xs font-semibold mb-1 flex items-center gap-1 tracking-[0.2em] uppercase">
                  <Clock className="w-3 h-3" />
                  Updated
                </div>
                <div className="text-2xl font-bold text-white">
                  {mechanicUpdatedCount}
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* ===== LOADING / ERROR ===== */}
          {loading && (
            <div className="mb-8 space-y-4">
              <div className="hidden lg:block">
                <TableSkeleton rows={6} columns={5} variant="ember" />
              </div>
              <div className="lg:hidden">
                <CardListSkeleton rows={4} variant="ember" />
              </div>
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-200"
            >
              {error}
            </motion.div>
          )}

          {!loading && !error && (
            <>
              {/* ===== TAB CONTROLS & SEARCH ===== */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-8 space-y-4"
              >
                {/* Tabs */}
                <div className="flex gap-2 bg-[#1b0801]/70 backdrop-blur-md rounded-2xl border border-[#ff9350]/25 p-1.5 w-fit">
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
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                        activeTab === id
                          ? "bg-[#ff9350] text-[#2a0d03] shadow-lg shadow-[#ff9350]/40"
                          : "text-white/65 hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                      <span className="ml-1 px-2 py-0.5 bg-white/10 rounded-full text-xs font-semibold text-white">
                        {count}
                      </span>
                    </motion.button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <input
                    type="text"
                    placeholder="Search by truck number or driver name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full bg-[#1b0801]/70 border border-[#ff9350]/30 rounded-2xl pl-10 pr-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#ff9350]/60 focus:border-transparent transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </motion.div>

              {/* ===== REPORTS GRID ===== */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Left: Reports List */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="lg:col-span-1 rounded-3xl border border-[#ff9350]/25 bg-[#0f0401]/85 backdrop-blur-xl overflow-hidden flex flex-col"
                >
                  {/* List Header */}
                  <div className="bg-gradient-to-r from-[#ff9350]/20 to-[#ffb48a]/15 border-b border-white/5 px-6 py-4 sticky top-0">
                    <h2 className="text-sm font-semibold text-white">
                      {activeTab === "failed" ? "Need Review" : "Passed"} ({filteredReports.length})
                    </h2>
                  </div>

                  {/* Reports List */}
                  <div className="overflow-y-auto flex-1">
                    <div className="hidden lg:block">
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
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {filteredReports.map((r, index) => {
                            const { allFails } = getFailedItems(r);
                            const isSelected = r.id === selectedId;
                            const mechanicFlag = hasMechanicUpdate(r);

                            return (
                              <motion.button
                                key={r.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => handleSelectReport(r.id)}
                                className={`w-full text-left px-6 py-4 border-b border-white/5 transition-all hover:bg-white/5 ${
                                  isSelected ? "bg-[#ff9350]/10 border-l-2 border-l-[#ff9350]" : ""
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-white truncate">
                                      Truck {r.truck_number || "N/A"}
                                    </div>
                                    <div className="text-xs text-white/65 truncate mt-1">
                                      {r.drivers_name || "Unknown Driver"}
                                    </div>
                                    <div className="text-xs text-white/45 mt-1">
                                      {formatDateTime(r.created_at)}
                                    </div>
                                    {allFails.length > 0 && (
                                      <div className="text-xs text-[#ff8a65] mt-1 truncate">
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
                                    {isSelected && (
                                      <ChevronRight className="w-5 h-5 text-[#ff9350]" />
                                    )}
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </div>

                    <div className="lg:hidden space-y-4 p-4">
                      {filteredReports.length === 0 ? (
                        <div className="text-center text-white/70 text-sm">
                          {searchQuery ? "No reports match your search" : "No DVIRs in this bucket."}
                        </div>
                      ) : (
                        filteredReports.map((report) => (
                          <MobileReportCard
                            key={report.id}
                            report={report}
                            isSelected={report.id === selectedId}
                            onSelect={() => handleSelectReport(report.id)}
                            formatDateTimeFn={formatDateTime}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* Pagination Footer */}
                  {filteredReports.length > pageSize && (
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredReports.length}
                      loading={loading}
                      pageSize={pageSize}
                      onPreviousClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      onNextClick={() =>
                        setCurrentPage((prev) =>
                          Math.min(totalPages, prev + 1)
                        )
                      }
                      label="reports"
                    />
                  )}
                </motion.div>

                {/* Right: Detail View */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="lg:col-span-2"
                >
                  <AnimatePresence mode="wait">
                    {!selectedReport ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full rounded-3xl border border-[#ff9350]/30 bg-gradient-to-br from-[#2a0d03]/80 to-[#140501]/85 backdrop-blur-md p-8 flex flex-col items-center justify-center text-center"
                      >
                        <div className="p-4 bg-[#ff9350]/10 rounded-2xl border border-[#ff9350]/30 mb-4">
                          <TrendingUp className="w-8 h-8 text-[#ffb48a]" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">
                          Select a DVIR to Review
                        </h3>
                        <p className="text-white/70 max-w-xs">
                          Choose a report from the list to view details and record mechanic updates.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={selectedId}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="space-y-6"
                      >
                        {/* Report Details Card */}
                        <div className="rounded-3xl border border-[#ff9350]/25 bg-[#0f0401]/85 backdrop-blur-md overflow-hidden">
                          {/* Card Header */}
                          <div className="bg-gradient-to-r from-[#ff9350]/25 to-[#ffb48a]/15 border-b border-white/5 px-8 py-6">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="text-sm text-white/60 mb-1 tracking-[0.3em] uppercase">
                                  DVIR Summary
                                </div>
                                <h3 className="text-2xl font-bold text-white">
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
                          <div className="px-8 py-6 space-y-6">
                            {/* Failed Items */}
                            {(() => {
                              const { vehicleFails, aerialFails, allFails } =
                                getFailedItems(selectedReport);

                              if (allFails.length === 0) {
                                return (
                                  <div className="rounded-2xl border border-[#2a8a63]/40 bg-[#052015] p-4">
                                    <div className="flex items-start gap-3">
                                      <CheckCircle2 className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <h4 className="font-semibold text-white">
                                          All Items Passed ✓
                                        </h4>
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
                                    <div className="rounded-2xl border border-[#ff6b4a]/30 bg-[#2a0b02]/60 p-4 max-h-60 overflow-y-auto pr-1 space-y-3">
                                      <h5 className="font-medium text-[#ffb199] mb-3">
                                        Vehicle / Trailer
                                      </h5>
                                      <ul className="space-y-2">
                                        {vehicleFails.map((label) => (
                                          <li
                                            key={label}
                                            className="flex items-start gap-2 text-sm text-[#ffd8cb]"
                                          >
                                            <span className="w-1.5 h-1.5 bg-[#ff6b4a] rounded-full mt-1.5 flex-shrink-0" />
                                            {label}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {aerialFails.length > 0 && (
                                    <div className="rounded-2xl border border-orange-500/30 bg-[#2a1200]/60 p-4 max-h-60 overflow-y-auto pr-1 space-y-3">
                                      <h5 className="font-medium text-orange-200 mb-3">
                                        Aerial Lift
                                      </h5>
                                      <ul className="space-y-2">
                                        {aerialFails.map((label) => (
                                          <li
                                            key={label}
                                            className="flex items-start gap-2 text-sm text-orange-100"
                                          >
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
                              <h4 className="font-semibold text-white mb-3">
                                Driver Notes
                              </h4>
                              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                                <p className="text-white/80 text-sm">
                                  {selectedReport.notes?.trim()
                                    ? selectedReport.notes
                                    : "No additional notes provided."}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1 text-sm text-white/80">
                              <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-1">
                                Vehicle Details
                              </p>
                              <p>Chipper #: {selectedReport.chipper_number || "—"}</p>
                              <p>Trailer #: {selectedReport.trailer_number || "—"}</p>
                              <p>Truck GVWR: {selectedReport.truck_gvwr || "—"}</p>
                              <p>Trailer/Chipper GVWR: {selectedReport.trailer_chipper_gvwr || "—"}</p>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1 text-sm text-white/80">
                                <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-1">
                                  Documentation
                                </p>
                                <p>Registration: {selectedReport.copy_of_registration || "—"}</p>
                                <p>Insurance: {selectedReport.copy_of_insurance || "—"}</p>
                                <p>Drivers Sig (Section A):{" "}
                                  {selectedReport.drivers_signature_section_a ? "On file" : "—"}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                                <p className="text-xs uppercase tracking-[0.3em] text-white/40 mb-1">
                                  Aerial Notes
                                </p>
                                <p>{selectedReport.aerial_notes?.trim() || "No aerial notes provided."}</p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h4 className="font-semibold text-white">
                                Full Checklist Review
                              </h4>
                              <div className="grid gap-4 lg:grid-cols-2">
                                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-white">
                                      Vehicle / Trailer
                                    </h5>
                                  </div>
                                  <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                                    {VEHICLE_TRAILER_ITEMS.map((item) => {
                                      const value =
                                        selectedReport.vehicle_trailer_checklist?.[item.id];
                                      const {
                                        label: statusLabel,
                                        className: chipClass,
                                      } = getChecklistStatusLabel(value);
                                      return (
                                        <div
                                          key={item.id}
                                          className="flex items-center justify-between py-2 text-sm text-white/80 gap-3"
                                        >
                                          <span className="pr-2">{item.label}</span>
                                          <span
                                            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${chipClass}`}
                                          >
                                            {statusLabel}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <h5 className="text-sm font-semibold text-white">
                                      Aerial Lift
                                    </h5>
                                  </div>
                                  <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                                    {AERIAL_LIFT_ITEMS.map((item) => {
                                      const value = selectedReport.aerial_checklist?.[item.id];
                                      const {
                                        label: statusLabel,
                                        className: chipClass,
                                      } = getChecklistStatusLabel(value);
                                      return (
                                        <div
                                          key={item.id}
                                          className="flex items-center justify-between py-2 text-sm text-white/80 gap-3"
                                        >
                                          <span className="pr-2">{item.label}</span>
                                          <span
                                            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${chipClass}`}
                                          >
                                            {statusLabel}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="font-semibold text-white flex items-center gap-2">
                                <Images className="w-4 h-4 text-emerald-300" />
                                Inspection Photos
                              </h4>
                              {mediaEntries.length === 0 ? (
                                <p className="text-sm text-white/60">
                                  No photos were uploaded with this DVIR.
                                </p>
                              ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {mediaEntries.map((media) => (
                                    <a
                                      key={media.label}
                                      href={media.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group block rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                                    >
                                      <div className="p-3 text-xs uppercase tracking-[0.3em] text-white/50">
                                        {media.label}
                                      </div>
                                      <img
                                        src={media.url}
                                        alt={media.label}
                                        className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                      />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <h4 className="font-semibold text-white flex items-center gap-2">
                                <FileSignature className="w-4 h-4 text-emerald-300" />
                                Signatures
                              </h4>
                              {signatureEntries.length === 0 ? (
                                <p className="text-sm text-white/60">
                                  No signature files were attached to this DVIR.
                                </p>
                              ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                  {signatureEntries.map((signature) => (
                                    <a
                                      key={signature.label}
                                      href={signature.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3 hover:border-emerald-400/40 transition"
                                    >
                                      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                                        {signature.label}
                                      </p>
                                      <img
                                        src={signature.url}
                                        alt={signature.label}
                                        className="h-32 w-full object-contain bg-black/30 rounded-xl"
                                      />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mechanic Update Form */}
                        <div className="rounded-3xl border border-[#ff9350]/25 bg-[#1a0500]/70 backdrop-blur-md overflow-hidden">
                          {/* Form Header */}
                          <div className="bg-gradient-to-r from-[#ff9350]/25 to-[#ffb48a]/15 border-b border-[#ff9350]/25 px-8 py-6">
                            <h3 className="text-lg font-bold text-white">
                              Record Mechanic Fix
                            </h3>
                            <p className="text-sm text-white/70 mt-1">
                              Document repairs and actions taken
                            </p>
                          </div>

                          {/* Form Body */}
                          <div className="px-8 py-6 space-y-5">
                            {/* Top Row: Truck Number & Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-white mb-2">
                                  Mechanic Truck Number
                                </label>
                                <input
                                  value={updateTruckNumber}
                                  onChange={(e) =>
                                    setUpdateTruckNumber(e.target.value)
                                  }
                                  placeholder="e.g., Truck 101"
                                  className="w-full bg-[#0b0200]/70 border border-white/10 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff9350]/50 focus:border-transparent transition-all"
                                />
                              </div>
                              <DateField
                                label="Service Date"
                                value={updateDate}
                                onValueChange={setUpdateDate}
                                helperText="When this repair occurred"
                                containerClassName="text-white"
                                className="bg-[#0b0200]/70 border-white/15 focus:ring-[#ff9350]/60 focus:border-[#ff9350]/40"
                              />
                            </div>

                            {/* Deficiency Corrected */}
                            <div>
                              <label className="block text-sm font-medium text-white mb-2">
                                Deficiency Corrected
                              </label>
                              <input
                                value={updateDeficiencyCorrected}
                                onChange={(e) =>
                                  setUpdateDeficiencyCorrected(e.target.value)
                                }
                                placeholder="e.g., Replaced brake pads, checked fluid levels..."
                                className="w-full bg-[#0b0200]/70 border border-white/10 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff9350]/50 focus:border-transparent transition-all"
                              />
                            </div>

                            {/* Mechanic Remarks */}
                            <div>
                              <label className="block text-sm font-medium text-white mb-2">
                                Additional Remarks
                              </label>
                              <textarea
                                value={updateRemarks}
                                onChange={(e) =>
                                  setUpdateRemarks(e.target.value)
                                }
                                rows={4}
                                placeholder="Document any additional details, parts used, or recommendations for next inspection..."
                                className="w-full bg-[#0b0200]/70 border border-white/10 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff9350]/50 focus:border-transparent transition-all resize-none"
                              />
                            </div>

                            {/* Save Message */}
                            <AnimatePresence>
                              {saveMessage && (
                                <motion.div
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className={`rounded-lg p-3 text-sm font-medium ${
                                    saveMessage.includes("✅")
                                      ? "bg-[#052015] border border-[#2a8a63]/40 text-[#7ef2c8]"
                                      : "bg-[#2a0b02] border border-[#ff6b4a]/30 text-[#ffb199]"
                                  }`}
                                >
                                  {saveMessage}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Save Button */}
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              type="button"
                              onClick={handleSaveUpdate}
                              disabled={savingUpdate}
                              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#ff9350] to-[#ffb48a] px-6 py-3 text-base font-semibold text-[#2a0d03] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#ff9350]/30"
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
                </motion.div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}