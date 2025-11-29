import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { PaginationControls } from "../components/PaginationControls";
import { logger } from "../lib/logger";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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
  notes: string | null;
  vehicle_trailer_checklist: Record<string, ChecklistValue> | null;
  aerial_checklist: Record<string, ChecklistValue> | null;
  mechanic_truck_number: string | null;
  mechanic_date: string | null;
  deficiency_corrected: string | null;
  mechanic_remarks: string | null;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 🔢 Pagination State
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalReports, setTotalReports] = useState<number | null>(null);

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
          drivers_name,
          notes,
          vehicle_trailer_checklist,
          aerial_checklist,
          mechanic_truck_number,
          mechanic_date,
          deficiency_corrected,
          mechanic_remarks
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
    } catch (err: any) {
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

  const formatDateTime = (iso: string | null | undefined) => {
    if (! iso) return "Unknown date";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  const formatDateOnly = (value: string | null | undefined) => {
    if (!value) return "";
    if (value.includes("/") && value.split("/").length === 3) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const totalFailed = useMemo(
    () =>
      reports.reduce((acc, r) => {
        const { allFails } = getFailedItems(r);
        return acc + (allFails.length > 0 ? 1 : 0);
      }, 0),
    [reports]
  );

  return (
    <DashboardLayout title="DVIR History">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold text-white">
            Your Daily Vehicle Inspection Reports
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Review your submitted DVIRs, see which items were marked as failed,
            and check if mechanics have recorded any corrections.
          </p>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-gray-300 py-8"
          >
            <Loader2 className="w-5 h-5 animate-spin text-green-500" />
            Loading your DVIR history...
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            {error}
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && !error && reports.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-gray-700 bg-black/60 px-6 py-8 text-center"
          >
            <CheckCircle2 className="w-12 h-12 text-gray-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">
              No DVIRs Yet
            </h3>
            <p className="text-sm text-gray-400">
              You haven&apos;t submitted any DVIRs yet. Start by creating one! 
            </p>
          </motion.div>
        )}

        {/* Reports List */}
        {! loading && !error && reports.length > 0 && (
          <>
            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-wrap items-center gap-3"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                Page {currentPage} of {totalPages}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200">
                <AlertTriangle className="w-4 h-4" />
                {totalFailed} of {totalReports} reports with failures
              </span>
            </motion.div>

            {/* Reports Cards */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="space-y-3"
            >
              <AnimatePresence>
                {reports.map((r, index) => {
                  const { vehicleFails, aerialFails, allFails } = getFailedItems(r);
                  const status = getStatus(r);
                  const mechanicFlag = hasMechanicUpdate(r);
                  const isOpen = expandedId === r.id;

                  return (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.05 }}
                      className="rounded-2xl border border-gray-700 bg-black/60 overflow-hidden hover:border-gray-600 transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggle(r.id)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-semibold text-white">
                              Truck {r.truck_number || "N/A"}
                            </span>
                            {status === "failed" ?  (
                              <span className="inline-flex items-center gap-1 rounded-full border border-red-400/70 bg-red-500/20 px-2. 5 py-1 text-xs font-medium text-red-100 flex-shrink-0">
                                <AlertTriangle className="w-3 h-3" />
                                {allFails. length} Fails
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/70 bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-100 flex-shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                All Passed
                              </span>
                            )}
                            {mechanicFlag && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-100 flex-shrink-0">
                                <Clock className="w-3 h-3" />
                                Mechanic Updated
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDateTime(r.created_at)} · Mileage:{" "}
                            {r.mileage != null ? r.mileage. toLocaleString() : "N/A"}
                          </div>
                          {allFails.length > 0 && (
                            <div className="text-xs text-red-100/80 truncate">
                              Fails: {allFails.join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="ml-3 text-gray-400 flex-shrink-0">
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-gray-700 px-5 py-4 text-xs text-gray-200 space-y-4"
                          >
                            {/* Failed items breakdown */}
                            {allFails.length > 0 ?  (
                              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
                                <div className="text-xs font-semibold text-red-100 mb-2">
                                  Failed Checklist Items ({allFails.length})
                                </div>
                                {vehicleFails.length > 0 && (
                                  <div className="mb-2">
                                    <div className="text-xs text-red-200/90 font-medium mb-1">
                                      Vehicle / Trailer:
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-red-100 space-y-0. 5">
                                      {vehicleFails.map((label) => (
                                        <li key={label}>{label}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {aerialFails.length > 0 && (
                                  <div>
                                    <div className="text-xs text-red-200/90 font-medium mb-1">
                                      Aerial Lift:
                                    </div>
                                    <ul className="list-disc list-inside text-xs text-red-100 space-y-0.5">
                                      {aerialFails.map((label) => (
                                        <li key={label}>{label}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100">
                                ✓ No failed items on this DVIR.  Good job!
                              </div>
                            )}

                            {/* Driver notes */}
                            <div>
                              <div className="text-xs text-gray-400 font-medium mb-2">
                                Your Notes
                              </div>
                              <div className="rounded-lg border border-gray-700 bg-black/60 px-4 py-3 text-xs text-gray-200 min-h-[48px]">
                                {r.notes?. trim()
                                  ? r.notes
                                  : "No notes were added to this DVIR."}
                              </div>
                            </div>

                            {/* Mechanic section */}
                            <div className="rounded-lg border border-gray-700 bg-black/70 px-4 py-3">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="text-xs text-gray-400 font-medium">
                                  Mechanic Updates
                                </div>
                                {mechanicFlag && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-medium text-yellow-100">
                                    <Clock className="w-3 h-3" />
                                    Updated
                                  </span>
                                )}
                              </div>

                              {mechanicFlag ?  (
                                <div className="space-y-2 text-xs text-gray-200">
                                  {r.mechanic_truck_number && (
                                    <div>
                                      <span className="text-gray-400">
                                        Mechanic Truck:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {r.mechanic_truck_number}
                                      </span>
                                    </div>
                                  )}
                                  {r. mechanic_date && (
                                    <div>
                                      <span className="text-gray-400">
                                        Mechanic Date:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {formatDateOnly(r.mechanic_date)}
                                      </span>
                                    </div>
                                  )}
                                  {r.deficiency_corrected && (
                                    <div>
                                      <span className="text-gray-400">
                                        Deficiency Corrected:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {r. deficiency_corrected}
                                      </span>
                                    </div>
                                  )}
                                  {r. mechanic_remarks && (
                                    <div>
                                      <span className="text-gray-400">
                                        Remarks:{" "}
                                      </span>
                                      <span className="font-medium">
                                        {r.mechanic_remarks}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400">
                                  No mechanic updates have been recorded yet.
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {/* Pagination Footer */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalReports}
              loading={loading}
              pageSize={pageSize}
              onPreviousClick={() =>
                setCurrentPage((prev) => Math.max(1, prev - 1))
              }
              onNextClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              label="reports"
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}