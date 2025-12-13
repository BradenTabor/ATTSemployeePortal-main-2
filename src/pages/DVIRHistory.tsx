import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import CardListSkeleton from "../components/skeletons/CardListSkeleton";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { PaginationControls } from "../components/PaginationControls";
import { logger } from "../lib/logger";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  CalendarClock,
  Fuel,
  Truck,
  Activity,
  MapPin,
  Images,
  FileSignature,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

// SAME checklist definitions as DVIRForm & MechanicDVIRCenter
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
      const val = report. aerial_checklist[item.id];
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

export default function DVIRHistory() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DVIRReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReport, setSelectedReport] = useState<DVIRReport | null>(null);

  // 🔢 Pagination State
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReports, setTotalReports] = useState<number | null>(null);

  const getPublicUrl = useCallback((path?: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("dvir-photos").getPublicUrl(path);
    return data.publicUrl ?? null;
  }, []);

  const totalPages =
    totalReports && totalReports > 0
      ?  Math.max(1, Math.ceil(totalReports / pageSize))
      : 1;

  const fetchDVIRReports = useCallback(async () => {
    if (!user?. id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 🔢 Calculate the row range for the current page
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
          chipper_number,
          trailer_number,
          truck_gvwr,
          trailer_chipper_gvwr,
          medical_card_required,
          drivers_name,
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
        .eq("user_id", user.id)
        . order("created_at", { ascending: false })
        .range(from, to);

      if (supabaseError) throw supabaseError;

      setReports(data as DVIRReport[] || []);

      // Store total count for pagination
      if (typeof count === "number") {
        setTotalReports(count);
      } else {
        setTotalReports(data?. length ??  0);
      }
    } catch (err: unknown) {
      logger.error("Error loading DVIR history:", err);
      setError("Failed to load your DVIR history.");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, currentPage, pageSize]);

  useEffect(() => {
    fetchDVIRReports();
  }, [fetchDVIRReports]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const formatDateTime = (iso: string | null | undefined) => {
    if (! iso) return "Unknown date";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  const filteredReports = useMemo(() => {
    if (!searchTerm.trim()) return reports;
    const query = searchTerm.trim().toLowerCase();
    return reports.filter((report) => {
      const haystack = [
        report.truck_number,
        report.drivers_name,
        report.notes,
        report.deficiency_corrected,
        report.mechanic_remarks,
      ]
        .map((value) => value ?? "")
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [reports, searchTerm]);

  const visibleReports = filteredReports.length;

  const totalFailed = useMemo(
    () =>
      filteredReports.reduce((acc, r) => {
        const { allFails } = getFailedItems(r);
        return acc + (allFails.length > 0 ? 1 : 0);
      }, 0),
    [filteredReports]
  );

  const lastSubmitted = filteredReports[0]?.created_at ?? null;
  const lastSubmittedRelative = lastSubmitted
    ? formatDistanceToNow(new Date(lastSubmitted), { addSuffix: true })
    : "—";

  const averageMileage =
    filteredReports.length > 0
      ? Math.round(
          filteredReports.reduce((acc, report) => acc + (report.mileage ?? 0), 0) /
            filteredReports.length
        )
      : null;

  const handleReportClick = (report: DVIRReport) => {
    setSelectedReport(report);
  };

  const closeDetail = () => setSelectedReport(null);

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

  return (
    <DashboardLayout title="DVIR History">
      <div className="w-full max-w-6xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-emerald-200/80">
                Fleet compliance
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Daily Vehicle Inspection History
          </h1>
              <p className="text-sm text-white/70 mt-2 max-w-2xl">
                Review every DVIR you have submitted, track unresolved deficiencies, and
                surface photos or signatures instantly when field teams ask for proof.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.4em] text-white/60">
              <Activity className="w-4 h-4 text-emerald-300" />
              Auto-synced
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-lg shadow-emerald-500/5">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-300" />
                Total Reports
              </p>
              <p className="text-4xl font-black text-white mt-3">
                {totalReports ?? reports.length}
              </p>
              <p className="text-xs text-white/60 mt-1">Across all pages</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-lg shadow-emerald-500/5">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                Active Fails
              </p>
              <p className="text-4xl font-black text-white mt-3">
                {totalFailed}
              </p>
              <p className="text-xs text-white/60 mt-1">
                In current view ({visibleReports} shown)
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-lg shadow-emerald-500/5">
              <p className="text-xs uppercase tracking-[0.4em] text-white/40 flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-emerald-300" />
                Last Submitted
              </p>
              <p className="text-2xl font-semibold text-white mt-3">
                {lastSubmittedRelative}
              </p>
              <p className="text-xs text-white/60 mt-1">
                Avg mileage {averageMileage ? averageMileage.toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl p-5 space-y-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                Quick filters
              </p>
              <p className="text-sm text-white/60">
                Search by truck, driver, or notes. Pagination automatically syncs with Supabase.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search truck number, driver name, or keywords..."
                  className="w-full rounded-2xl bg-white/5 border border-white/10 pl-11 pr-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/40 outline-none transition"
                />
              </div>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="px-4 py-3 rounded-2xl border border-white/10 text-white/70 text-sm hover:text-white hover:border-white/30 transition"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {loading ? (
          <CardListSkeleton rows={3} variant="emerald" className="py-4" />
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            {error}
          </motion.div>
        ) : visibleReports === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl px-6 py-12 text-center space-y-3"
          >
            <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto" />
            <h3 className="text-xl font-semibold text-white">No DVIRs match your filters</h3>
            <p className="text-sm text-white/60">
              {reports.length === 0
                ? "You have not submitted a DVIR yet. Complete your first inspection to see it here."
                : "Try a different keyword or clear filters to view the full list."}
            </p>
          </motion.div>
        ) : (
          <>
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            >
              {filteredReports.map((report, index) => {
                const { allFails } = getFailedItems(report);
                const status = getStatus(report);
                const mechanicFlag = hasMechanicUpdate(report);
                  return (
                  <motion.button
                    key={report.id}
                    type="button"
                    onClick={() => handleReportClick(report)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    className="group text-left rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5 hover:border-emerald-400/50 hover:shadow-emerald-500/20 hover:shadow-2xl transition-all"
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-white/40">
                          Truck
                        </p>
                        <p className="text-2xl font-semibold text-white">
                          {report.truck_number || "N/A"}
                        </p>
                      </div>
                      <div
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                          status === "failed"
                            ? "border-red-400/60 bg-red-500/10 text-red-100"
                            : "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                        }`}
                      >
                        {status === "failed" ? (
                          <>
                                <AlertTriangle className="w-3 h-3" />
                            {allFails.length} Fails
                          </>
                            ) : (
                          <>
                                <CheckCircle2 className="w-3 h-3" />
                            Cleared
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/70">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-4 h-4 text-emerald-300" />
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Fuel className="w-4 h-4 text-emerald-300" />
                        Mileage {report.mileage?.toLocaleString() ?? "N/A"}
                      </span>
                      {report.trailer_number && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-emerald-300" />
                          Trailer {report.trailer_number}
                              </span>
                            )}
                            {mechanicFlag && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-2 py-0.5 text-[11px] text-yellow-100">
                                <Clock className="w-3 h-3" />
                          Mechanic update
                              </span>
                            )}
                          </div>
                    {report.notes && (
                      <p className="mt-3 text-sm text-white/60 line-clamp-2">
                        “{report.notes}”
                      </p>
                    )}
                  </motion.button>
                  );
                })}
            </motion.div>

            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalReports}
              loading={loading}
              pageSize={pageSize}
              onPreviousClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              onNextClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              label="reports"
            />
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70"
              onClick={closeDetail}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="relative z-50 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-white/10 bg-slate-950/95 p-6 sm:p-8 shadow-2xl space-y-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                    Truck
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white break-normal">
                    {selectedReport.truck_number || "N/A"}
                  </h2>
                  <p className="text-sm text-white/60">
                    Submitted {formatDateTime(selectedReport.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                      getStatus(selectedReport) === "failed"
                        ? "border-red-400/60 bg-red-500/10 text-red-100"
                        : "border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
                    }`}
                  >
                    {getStatus(selectedReport) === "failed" ? (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        Failures present
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        All systems go
                      </>
                    )}
                  </span>
                  {hasMechanicUpdate(selectedReport) && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-100">
                      <Clock className="w-3 h-3" />
                      Mechanic updated
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="rounded-2xl border border-white/20 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/40 transition"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm text-white/80">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-white/50">
                    <Truck className="w-4 h-4 text-emerald-300" />
                    Vehicle
                  </div>
                  <p>Chipper #{selectedReport.chipper_number || "—"}</p>
                  <p>Trailer #{selectedReport.trailer_number || "—"}</p>
                  <p>Mileage {selectedReport.mileage?.toLocaleString() ?? "—"}</p>
                  <p>GVWR Truck {selectedReport.truck_gvwr || "—"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm text-white/80">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-white/50">
                    <Fuel className="w-4 h-4 text-emerald-300" />
                    Driver & Compliance
                  </div>
                  <p>Driver: {selectedReport.drivers_name}</p>
                  <p>License #: {selectedReport.drivers_license_number || "—"}</p>
                  <p>Class: {selectedReport.drivers_license_class || "—"}</p>
                  <p>Med Card Exp: {selectedReport.medical_card_exp || "—"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white">Checklist & Notes</h3>
                {(() => {
                  const { vehicleFails, aerialFails, allFails } = getFailedItems(selectedReport);
                  if (allFails.length === 0) {
                    return (
                      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
                        No failed items recorded for this inspection.
                      </div>
                    );
                  }
                  return (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 space-y-3 text-sm text-red-50 max-h-64 overflow-y-auto">
                      {vehicleFails.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-[0.4em] text-red-200 mb-1">
                            Vehicle / Trailer
                          </p>
                          <ul className="list-disc list-inside space-y-1">
                            {vehicleFails.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aerialFails.length > 0 && (
                        <div>
                          <p className="text-xs uppercase tracking-[0.4em] text-red-200 mb-1">
                            Aerial Lift
                          </p>
                          <ul className="list-disc list-inside space-y-1">
                            {aerialFails.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50 mb-2">
                      Driver Notes
                    </p>
                    <p className="text-sm text-white/80 min-h-[60px]">
                      {selectedReport.notes?.trim() || "No notes were provided."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.4em] text-white/50 mb-2">
                      Aerial Notes
                    </p>
                    <p className="text-sm text-white/80 min-h-[60px]">
                      {selectedReport.aerial_notes?.trim() || "No aerial notes were provided."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Images className="w-4 h-4 text-emerald-300" />
                  Inspection Photos
                </h3>
                {mediaEntries.length === 0 ? (
                  <p className="text-sm text-white/60">No photos were uploaded for this DVIR.</p>
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
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-emerald-300" />
                  Signatures
                </h3>
                {signatureEntries.length === 0 ? (
                  <p className="text-sm text-white/60">No signatures are attached to this report.</p>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}