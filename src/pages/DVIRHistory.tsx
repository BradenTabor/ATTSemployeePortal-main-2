import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";
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

export default function DVIRHistory() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DVIRReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
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
          `
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (isMounted && data) {
          setReports(data as DVIRReport[]);
        }
      } catch (err: any) {
        console.error("Error loading DVIR history:", err);
        if (isMounted) setError("Failed to load your DVIR history.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return "Unknown date";
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
        <div>
          <h1 className="text-xl font-semibold text-white">
            Your Daily Vehicle Inspection Reports
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Review your submitted DVIRs, see which items were marked as failed,
            and check if mechanics have recorded any corrections.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading your DVIR history...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div className="rounded-lg border border-gray-700 bg-black/60 px-4 py-3 text-xs text-gray-300">
            You haven&apos;t submitted any DVIRs yet.
          </div>
        )}

        {!loading && !error && reports.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Total reports: {reports.length}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-red-200">
                <AlertTriangle className="w-3 h-3" />
                Reports with fails: {totalFailed}
              </span>
            </div>

            <div className="space-y-2">
              {reports.map((r) => {
                const { vehicleFails, aerialFails, allFails } = getFailedItems(r);
                const status = getStatus(r);
                const mechanicFlag = hasMechanicUpdate(r);
                const isOpen = expandedId === r.id;

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-gray-700 bg-black/60 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(r.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left text-xs hover:bg-white/5 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            Truck {r.truck_number || "N/A"}
                          </span>
                          {status === "failed" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-400/70 bg-red-500/20 px-2 py-0.5 text-[10px] text-red-100">
                              <AlertTriangle className="w-3 h-3" />
                              Items marked Fail: {allFails.length}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/70 bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-100">
                              <CheckCircle2 className="w-3 h-3" />
                              All items passed
                            </span>
                          )}
                          {mechanicFlag && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-100">
                              <Clock className="w-3 h-3" />
                              Mechanic updated
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {formatDateTime(r.created_at)} · Mileage:{" "}
                          {r.mileage != null ? r.mileage : "N/A"}
                        </div>
                        {allFails.length > 0 && (
                          <div className="text-[11px] text-red-100/90 truncate max-w-[280px]">
                            Checklist fails: {allFails.join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="ml-3 text-gray-400">
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-700 px-4 py-3 text-xs text-gray-200 space-y-3">
                        {/* Failed items breakdown */}
                        {allFails.length > 0 ? (
                          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
                            <div className="text-[11px] font-semibold text-red-100 mb-1">
                              Failed Checklist Items ({allFails.length})
                            </div>
                            {vehicleFails.length > 0 && (
                              <div className="mb-1">
                                <div className="text-[11px] text-red-200/90">
                                  Vehicle / Trailer:
                                </div>
                                <ul className="list-disc list-inside text-[11px] text-red-100">
                                  {vehicleFails.map((label) => (
                                    <li key={label}>{label}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {aerialFails.length > 0 && (
                              <div>
                                <div className="text-[11px] text-red-200/90">
                                  Aerial Lift:
                                </div>
                                <ul className="list-disc list-inside text-[11px] text-red-100">
                                  {aerialFails.map((label) => (
                                    <li key={label}>{label}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-100">
                            No failed items on this DVIR. Good job.
                          </div>
                        )}

                        {/* Driver notes */}
                        <div>
                          <div className="text-[11px] text-gray-400 mb-1">
                            Your Notes
                          </div>
                          <div className="rounded-lg border border-gray-700 bg-black/60 px-3 py-2 text-[11px] text-gray-200 min-h-[48px]">
                            {r.notes?.trim()
                              ? r.notes
                              : "No notes were added to this DVIR."}
                          </div>
                        </div>

                        {/* Mechanic section */}
                        <div className="rounded-lg border border-gray-700 bg-black/70 px-3 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="text-[11px] text-gray-400">
                              Mechanic Updates
                            </div>
                            {mechanicFlag && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-100">
                                <Clock className="w-3 h-3" />
                                Updated
                              </span>
                            )}
                          </div>

                          {mechanicFlag ? (
                            <div className="space-y-1 text-[11px] text-gray-200">
                              {r.mechanic_truck_number && (
                                <div>
                                  <span className="text-gray-400">
                                    Mechanic Truck:{" "}
                                  </span>
                                  {r.mechanic_truck_number}
                                </div>
                              )}
                              {r.mechanic_date && (
                                <div>
                                  <span className="text-gray-400">
                                    Mechanic Date:{" "}
                                  </span>
                                  {formatDateOnly(r.mechanic_date)}
                                </div>
                              )}
                              {r.deficiency_corrected && (
                                <div>
                                  <span className="text-gray-400">
                                    Deficiency Corrected:{" "}
                                  </span>
                                  {r.deficiency_corrected}
                                </div>
                              )}
                              {r.mechanic_remarks && (
                                <div>
                                  <span className="text-gray-400">
                                    Remarks:{" "}
                                  </span>
                                  {r.mechanic_remarks}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-400">
                              No mechanic updates have been recorded yet.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
