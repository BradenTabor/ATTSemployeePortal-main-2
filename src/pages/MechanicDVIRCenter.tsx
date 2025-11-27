import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabaseClient";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  Loader2,
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

// SECTION B – Vehicle / Trailer checklist (same IDs/labels as DVIRForm)
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

// Aerial lift checklist (same IDs/labels as DVIRForm)
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

export default function MechanicDVIRCenter() {
  const { role } = useAuth();

  const [reports, setReports] = useState<DVIRReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Mechanic update form state
  const [updateTruckNumber, setUpdateTruckNumber] = useState("");
  const [updateDate, setUpdateDate] = useState("");
  const [updateDeficiencyCorrected, setUpdateDeficiencyCorrected] =
    useState("");
  const [updateRemarks, setUpdateRemarks] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Hard guard (on top of ProtectedRoute) to avoid accidental exposure
  if (role && role !== "mechanic" && role !== "admin") {
    return (
      <DashboardLayout title="Mechanic DVIR Center">
        <div className="max-w-xl mx-auto mt-10 text-center text-sm text-gray-300">
          You do not have permission to view this page.
        </div>
      </DashboardLayout>
    );
  }

  // Load all DVIR reports visible via RLS
  useEffect(() => {
    let isMounted = true;

    const fetchReports = async () => {
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
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (isMounted && data) {
          setReports(data as DVIRReport[]);
        }
      } catch (err) {
        console.error("Error loading DVIR reports for mechanic center:", err);
        if (isMounted) {
          setError("Failed to load DVIR reports.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchReports();
    return () => {
      isMounted = false;
    };
  }, []);

  const failedReports = useMemo(
    () => reports.filter((r) => getStatus(r) === "failed"),
    [reports]
  );
  const passedReports = useMemo(
    () => reports.filter((r) => getStatus(r) === "passed"),
    [reports]
  );

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedId) || null,
    [reports, selectedId]
  );

  // Hydrate mechanic update form when selection changes
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

      // Refresh local state
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

      setSaveMessage("Mechanic update saved.");
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      console.error("Error saving mechanic DVIR update:", err);
      setSaveMessage("Failed to save mechanic update.");
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setSavingUpdate(false);
    }
  };

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return "Unknown date";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  const formatDateOnly = (value: string | null | undefined) => {
    if (!value) return "";
    // supports ISO or MM/DD/YYYY
    if (value.includes("/") && value.split("/").length === 3) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  return (
    <DashboardLayout title="Mechanic DVIR Center">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-400" />
              DVIR Review &amp; Mechanic Updates
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">
              See all submitted DVIRs for the fleet, grouped by passed and
              failed. Open one at a time to view failed items and record what
              has been fixed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-red-200">
              <AlertTriangle className="w-3 h-3" />
              Failed / Needs review
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              Passed
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-yellow-200">
              <Clock className="w-3 h-3" />
              Mechanic updated
            </span>
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading DVIR reports...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        {/* Top layout: Failed vs Passed lists */}
        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Failed */}
            <div className="rounded-2xl border border-red-500/40 bg-black/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-semibold text-white">
                    DVIRs with Fails
                  </h2>
                </div>
                <span className="text-[11px] text-gray-400">
                  {failedReports.length} record
                  {failedReports.length === 1 ? "" : "s"}
                </span>
              </div>

              {failedReports.length === 0 ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-100">
                  No failed DVIRs found.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {failedReports.map((r) => {
                    const { allFails } = getFailedItems(r);
                    const isSelected = r.id === selectedId;
                    const mechanicFlag = hasMechanicUpdate(r);

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectReport(r.id)}
                        className={`w-full text-left rounded-xl border px-3 py-2 text-xs transition-all
                          ${
                            isSelected
                              ? "border-red-400 bg-red-500/10 shadow-[0_0_12px_rgba(248,113,113,0.3)]"
                              : "border-red-500/30 bg-black/60 hover:border-red-400/80 hover:bg-red-500/5"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-red-100">
                              Truck {r.truck_number || "N/A"}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatDateTime(r.created_at)} · Driver:{" "}
                              {r.drivers_name || "Unknown"}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-400/70 bg-red-500/20 px-2 py-0.5 text-[10px] text-red-100">
                              <AlertTriangle className="w-3 h-3" />
                              Checklist fails: {allFails.length}
                            </span>
                            {allFails.length > 0 && (
                              <span className="text-[10px] text-red-100/80 truncate max-w-[200px]">
                                {allFails.join(", ")}
                              </span>
                            )}
                            {mechanicFlag && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-100">
                                <Clock className="w-3 h-3" />
                                Updated
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Passed */}
            <div className="rounded-2xl border border-emerald-500/40 bg-black/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">
                    Passed DVIRs
                  </h2>
                </div>
                <span className="text-[11px] text-gray-400">
                  {passedReports.length} record
                  {passedReports.length === 1 ? "" : "s"}
                </span>
              </div>

              {passedReports.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100">
                  No passed DVIRs found.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {passedReports.map((r) => {
                    const isSelected = r.id === selectedId;
                    const mechanicFlag = hasMechanicUpdate(r);

                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectReport(r.id)}
                        className={`w-full text-left rounded-xl border px-3 py-2 text-xs transition-all
                          ${
                            isSelected
                              ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                              : "border-emerald-500/30 bg-black/60 hover:border-emerald-400/80 hover:bg-emerald-500/5"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-emerald-100">
                              Truck {r.truck_number || "N/A"}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatDateTime(r.created_at)} · Driver:{" "}
                              {r.drivers_name || "Unknown"}
                            </span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/70 bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-100">
                              <CheckCircle2 className="w-3 h-3" />
                              All items pass
                            </span>
                            {mechanicFlag && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-100">
                                <Clock className="w-3 h-3" />
                                Updated
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom: Selected DVIR details + Mechanic update form */}
        <div className="rounded-2xl border border-gray-700 bg-black/60 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">
              Selected DVIR Details &amp; Mechanic Updates
            </h2>
            <p className="text-[11px] text-gray-400">
              Only one DVIR is active at a time to keep this view clean.
            </p>
          </div>

          {!selectedReport ? (
            <div className="text-xs text-gray-400">
              Select a DVIR from the lists above to review details and add
              mechanic updates.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
              {/* Left: DVIR data preview */}
              <div className="rounded-xl border border-gray-700 bg-black/70 px-4 py-3 space-y-3 text-xs text-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-gray-400">
                      DVIR Summary
                    </div>
                    <div className="text-sm font-semibold text-white">
                      Truck {selectedReport.truck_number || "N/A"}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Driver: {selectedReport.drivers_name || "Unknown"} ·{" "}
                      {formatDateTime(selectedReport.created_at)}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Mileage:{" "}
                      {selectedReport.mileage != null
                        ? selectedReport.mileage
                        : "N/A"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatus(selectedReport) === "failed" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-400/70 bg-red-500/20 px-2 py-0.5 text-[10px] text-red-100">
                        <AlertTriangle className="w-3 h-3" />
                        Has failed items
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/70 bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-100">
                        <CheckCircle2 className="w-3 h-3" />
                        All items passed
                      </span>
                    )}
                    {hasMechanicUpdate(selectedReport) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/60 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-100">
                        <Clock className="w-3 h-3" />
                        Mechanic updated
                      </span>
                    )}
                  </div>
                </div>

                {/* Failed items breakdown */}
                {(() => {
                  const { vehicleFails, aerialFails, allFails } =
                    getFailedItems(selectedReport);

                  if (allFails.length === 0) {
                    return (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-100">
                        No failed checklist items on this DVIR.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
                        <div className="text-[11px] font-semibold text-red-100 mb-1">
                          Failed Items ({allFails.length})
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
                    </div>
                  );
                })()}

                {/* Driver notes */}
                <div>
                  <div className="text-[11px] text-gray-400 mb-1">
                    Driver Notes
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-black/60 px-3 py-2 text-[11px] text-gray-200 min-h-[48px]">
                    {selectedReport.notes?.trim()
                      ? selectedReport.notes
                      : "No notes provided."}
                  </div>
                </div>
              </div>

              {/* Right: Mechanic update form */}
              <div className="rounded-xl border border-emerald-600/40 bg-black/70 px-4 py-3 space-y-3 text-xs text-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-gray-400">
                      Mechanic Update
                    </div>
                    <div className="text-sm font-semibold text-white">
                      Record what was fixed
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-300 mb-1">
                      Mechanic Truck Number
                    </label>
                    <input
                      value={updateTruckNumber}
                      onChange={(e) => setUpdateTruckNumber(e.target.value)}
                      className="w-full rounded-md bg-black/80 border border-gray-700 px-2 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-300 mb-1">
                      Mechanic Date
                    </label>
                    <input
                      type="date"
                      value={updateDate}
                      onChange={(e) => setUpdateDate(e.target.value)}
                      className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white [color-scheme:dark]"
                    />
                    {selectedReport.mechanic_date && (
                      <p className="mt-1 text-[10px] text-gray-500">
                        Current stored date:{" "}
                        {formatDateOnly(selectedReport.mechanic_date)}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">
                    Noted Deficiency Corrected
                  </label>
                  <input
                    value={updateDeficiencyCorrected}
                    onChange={(e) =>
                      setUpdateDeficiencyCorrected(e.target.value)
                    }
                    placeholder="Summary of what was corrected"
                    className="w-full rounded-md bg-black/80 border border-gray-700 px-2 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-300 mb-1">
                    Mechanic Remarks
                  </label>
                  <textarea
                    value={updateRemarks}
                    onChange={(e) => setUpdateRemarks(e.target.value)}
                    rows={3}
                    className="w-full rounded-md bg-black/80 border border-gray-700 px-2 py-1.5 text-xs text-white"
                    placeholder="Details about repairs, parts used, or remaining issues"
                  />
                </div>

                {saveMessage && (
                  <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
                    {saveMessage}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveUpdate}
                  disabled={savingUpdate}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingUpdate && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  {savingUpdate ? "Saving..." : "Save Mechanic Update"}
                </button>

                <p className="text-[10px] text-gray-500 mt-1">
                  Saving will update the DVIR record in Supabase. Drivers will
                  see these corrections in their DVIR history.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
