import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../../layouts/DashboardLayout";
import CardListSkeleton from "../../components/skeletons/CardListSkeleton";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { logger } from "../../lib/logger";
import type { DVIRFormState, ChecklistValue } from "./dvir/types";
import {
  HistoryPageShell,
  HistoryPagination,
  HistoryEmptyState,
  HistoryErrorState,
  DvirDetailModal,
} from "../../components/history";
import { BlurFade } from "../../components/ui/blur-fade";
import { glass } from "../../lib/glass";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fuel,
  MapPin,
  Truck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";


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
  { id: "safety_equipment", label: "Safety Equipment (First Aid, Fire Ext., Spare Fuses, etc.)" },
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
  { id: "hydraulic_cylinders_leaks", label: "Hydraulic Cylinders free of Leaks" },
  { id: "fasteners_tight", label: "Fasteners at Proper Tightness" },
  { id: "booms_no_cracks", label: "Booms free of Cracks and Damage" },
  { id: "booms_no_debris", label: "Booms and Components free of Debris or Obstructions" },
  { id: "boom_functions_working", label: "All Boom Functions Working Properly" },
  { id: "grease_fittings_recent", label: "All Grease Fittings greased within 5 days" },
  { id: "dielectric_test_up_to_date", label: "Dielectric Inspection Test Up to Date" },
];

function getFailedItems(report: DVIRReport) {
  const vehicleFails: string[] = [];
  const aerialFails: string[] = [];
  if (report.vehicle_trailer_checklist) {
    for (const item of VEHICLE_TRAILER_ITEMS) {
      const val = report.vehicle_trailer_checklist[item.id];
      if (val === "F") vehicleFails.push(item.label);
    }
  }
  if (report.aerial_checklist) {
    for (const item of AERIAL_LIFT_ITEMS) {
      const val = report.aerial_checklist[item.id];
      if (val === "F") aerialFails.push(item.label);
    }
  }
  return { vehicleFails, aerialFails, allFails: [...vehicleFails, ...aerialFails] };
}

function getStatus(report: DVIRReport): "failed" | "passed" {
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
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [searchParams] = useSearchParams();
  
  // Initialize state from URL params
  const [reports, setReports] = useState<DVIRReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchTermFromUrl = searchParams.get('search') || '';
  // Validate page parameter: must be numeric, default to 1 if invalid
  const pageParam = searchParams.get('page') || '1';
  const pageFromUrl = /^\d+$/.test(pageParam) ? parseInt(pageParam, 10) : 1;
  const [searchTerm, setSearchTerm] = useState(searchTermFromUrl);
  const [selectedReport, setSelectedReport] = useState<DVIRReport | null>(null);

  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState(isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl);
  const [totalReports, setTotalReports] = useState<number | null>(null);

  // Sync URL params when search or page changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) {
      params.set('search', searchTerm.trim());
    }
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    }
    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [searchTerm, currentPage]);

  // Initialize search term from URL on mount (only if different)
  useEffect(() => {
    if (searchTermFromUrl && searchTerm !== searchTermFromUrl) {
      setSearchTerm(searchTermFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTermFromUrl]); // Only run on mount/URL change, not when searchTerm changes

  const getPublicUrl = useCallback((path?: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from("dvir-photos").getPublicUrl(path);
    return data.publicUrl ?? null;
  }, []);

  const isStoragePath = useCallback(
    (s: string) => /[/\\]/.test(s) || /\.(png|jpe?g|webp)$/i.test(s),
    []
  );

  const totalPages =
    totalReports != null && totalReports > 0
      ? Math.max(1, Math.ceil(totalReports / pageSize))
      : 1;

  const fetchDVIRReports = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error: supabaseError, count } = await supabase
        .from("dvir_reports")
        .select(
          `
          id, created_at, user_id, truck_number, mileage, chipper_number,
          trailer_number, truck_gvwr, trailer_chipper_gvwr, medical_card_required,
          drivers_name, drivers_license_number, drivers_license_class, drivers_license_exp,
          drivers_license_required, has_medical_card, medical_card_exp,
          copy_of_registration, copy_of_insurance, notes, vehicle_trailer_checklist,
          aerial_checklist, aerial_notes, mechanic_truck_number, mechanic_date,
          deficiency_corrected, mechanic_remarks, final_driver_signature,
          general_foreman_signature, mechanic_signature, driver_approval_signature,
          oil_dipstick_path, tire_photo_path, coolant_photo_path, damage_photo_path,
          detail_clean_truck_photo_path
        `,
          { count: "exact" }
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (supabaseError) throw supabaseError;
      setReports((data as DVIRReport[]) || []);
      setTotalReports(typeof count === "number" ? count : data?.length ?? 0);
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

  // Reset to page 1 when search term changes (but preserve in URL)
  useEffect(() => {
    if (searchTerm !== searchTermFromUrl) {
      setCurrentPage(1);
    }
  }, [searchTerm, searchTermFromUrl]);

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
        .map((v) => v ?? "")
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [reports, searchTerm]);

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
      .filter((e) => e.path)
      .map((e) => {
        const url = getPublicUrl(e.path);
        return url ? { label: e.label, url } : null;
      })
      .filter((e): e is { label: string; url: string } => Boolean(e));
  }, [selectedReport, getPublicUrl]);

  const signatureEntries = useMemo(() => {
    if (!selectedReport) return [];
    const base = [
      { label: "Final Driver Signature", path: selectedReport.final_driver_signature },
      { label: "General Foreman Signature", path: selectedReport.general_foreman_signature },
      { label: "Mechanic Signature", path: selectedReport.mechanic_signature },
      { label: "Driver Approval Signature", path: selectedReport.driver_approval_signature },
    ];
    const out: { label: string; url?: string; text?: string }[] = [];
    for (const e of base) {
      const path = e.path?.trim();
      if (!path) continue;
      if (isStoragePath(path)) {
        const url = getPublicUrl(path);
        if (url) out.push({ label: e.label, url });
      } else {
        out.push({ label: e.label, text: path });
      }
    }
    return out;
  }, [selectedReport, getPublicUrl, isStoragePath]);

  const handleReportClick = (r: DVIRReport) => setSelectedReport(r);
  const closeDetail = () => setSelectedReport(null);

  // Handle "Use as Template" - transform report to form state and navigate
  const handleUseAsTemplate = useCallback((report: DVIRReport) => {
    // Transform DVIRReport to DVIRFormState (excluding photos and signatures)
    const templateData: Partial<DVIRFormState> = {
      truckNumber: report.truck_number || "",
      mileage: report.mileage?.toString() || "",
      chipperNumber: report.chipper_number || "",
      trailerNumber: report.trailer_number || "",
      truckGvwr: report.truck_gvwr || "",
      trailerChipperGvwr: report.trailer_chipper_gvwr || "",
      medicalCardRequired: (report.medical_card_required as "" | "YES" | "NO") || "",
      driversName: report.drivers_name || "",
      driversLicenseNumber: report.drivers_license_number || "",
      driversLicenseClass: report.drivers_license_class || "",
      driversLicenseExp: report.drivers_license_exp || "",
      driversLicenseRequired: (report.drivers_license_required as "" | "YES" | "NO") || "",
      hasMedicalCard: (report.has_medical_card as "" | "YES" | "NO") || "",
      medicalCardExp: report.medical_card_exp || "",
      copyOfRegistration: (report.copy_of_registration as "" | "YES" | "NO") || "",
      copyOfInsurance: (report.copy_of_insurance as "" | "YES" | "NO") || "",
      vehicleTrailerChecklist: (report.vehicle_trailer_checklist as Record<string, ChecklistValue>) || {},
      notes: report.notes || "",
      aerialChecklist: (report.aerial_checklist as Record<string, ChecklistValue>) || {},
      aerialNotes: report.aerial_notes || "",
      mechTruckNumber: report.mechanic_truck_number || "",
      deficiencyCorrected: report.deficiency_corrected || "",
      mechanicRemarks: report.mechanic_remarks || "",
      mechanicDate: report.mechanic_date || "",
      isMechanicOpen: false,
      // Don't copy signatures - user needs to sign new form
      finalDriverSignature: "",
      generalForemanSignature: "",
      mechanicSignature: "",
      driverApprovalSignature: "",
    };

    // Store template data in sessionStorage
    sessionStorage.setItem('dvir-template', JSON.stringify(templateData));
    
    // Navigate to DVIR form
    navigate('/forms/dvir');
    
    // Close modal
    setSelectedReport(null);
  }, [navigate]);

  return (
    <DashboardLayout title="DVIR History">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <HistoryPageShell
          subtitle="Fleet compliance"
          title="Vehicle Inspection History"
          description="Review your DVIR submissions, track deficiencies, and access inspection photos and signatures."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search by truck number, driver, or notes…"
          variant="emerald"
          totalCount={totalReports}
        />

        {loading ? (
          <BlurFade delay={0.1} inView={false}>
            <CardListSkeleton rows={3} variant="emerald" className="py-4" />
          </BlurFade>
        ) : error ? (
          <HistoryErrorState message={error} />
        ) : filteredReports.length === 0 ? (
          <HistoryEmptyState
            title="No DVIRs match your filters"
            description={
              reports.length === 0
                ? "You have not submitted a DVIR yet. Complete your first inspection to see it here."
                : "Try a different keyword or clear filters to view the full list."
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredReports.map((report, index) => {
                const { allFails } = getFailedItems(report);
                const status = getStatus(report);
                const mechanicFlag = hasMechanicUpdate(report);
                return (
                  <BlurFade
                    key={report.id}
                    delay={index * 0.04}
                    inView={false}
                    className="h-full"
                  >
                    <motion.button
                      type="button"
                      onClick={() => handleReportClick(report)}
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.005 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.995 }}
                      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                      className={`group w-full text-left ${glass.card} p-4 sm:p-5 hover:border-emerald-400/30 focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 outline-none transition-all duration-200 h-full flex flex-col`}
                      aria-label={`View DVIR: Truck ${report.truck_number || "N/A"}${report.trailer_number ? `, Trailer ${report.trailer_number}` : ""}`}
                    >
                      {/* Top row: truck + status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
                            <Truck className="w-4 h-4 text-emerald-300" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <p className="text-base sm:text-lg font-semibold text-white truncate">
                              Truck {report.truck_number || "N/A"}
                            </p>
                            <p className="text-xs text-white/40 font-mono">
                              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold flex-shrink-0 ${
                            status === "failed"
                              ? "border-red-500/40 bg-red-500/15 text-red-200"
                              : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                          }`}
                        >
                          {status === "failed" ? (
                            <>
                              <AlertTriangle className="w-3 h-3" aria-hidden />
                              {allFails.length} Fail{allFails.length !== 1 ? "s" : ""}
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3" aria-hidden />
                              Passed
                            </>
                          )}
                        </span>
                      </div>

                      {/* Metadata chips */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/60 flex-1">
                        <span className="inline-flex items-center gap-1">
                          <Fuel className="w-3.5 h-3.5 text-white/30" aria-hidden />
                          {report.mileage?.toLocaleString() ?? "—"} mi
                        </span>
                        {report.trailer_number && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-white/30" aria-hidden />
                            Trailer {report.trailer_number}
                          </span>
                        )}
                        {mechanicFlag && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-200">
                            <Clock className="w-3 h-3" aria-hidden />
                            Mechanic update
                          </span>
                        )}
                      </div>

                      {/* Notes preview */}
                      {report.notes && (
                        <p className="mt-3 pt-3 border-t border-white/[0.06] text-xs text-white/50 line-clamp-2 italic">
                          {report.notes}
                        </p>
                      )}
                    </motion.button>
                  </BlurFade>
                );
              })}
            </div>

            <HistoryPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalReports ?? 0}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              label="Reports"
              variant="emerald"
              compact
            />
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedReport && (() => {
          const failed = getFailedItems(selectedReport);
          return (
            <DvirDetailModal
              truckNumber={selectedReport.truck_number}
              submittedAt={selectedReport.created_at}
              status={getStatus(selectedReport)}
              failCount={failed.allFails.length}
              hasMechanicUpdate={hasMechanicUpdate(selectedReport)}
              vehicleFails={failed.vehicleFails}
              aerialFails={failed.aerialFails}
              chipperNumber={selectedReport.chipper_number}
              trailerNumber={selectedReport.trailer_number}
              mileage={selectedReport.mileage}
              truckGvwr={selectedReport.truck_gvwr}
              driversName={selectedReport.drivers_name}
              driversLicenseNumber={selectedReport.drivers_license_number}
              driversLicenseClass={selectedReport.drivers_license_class}
              medicalCardExp={selectedReport.medical_card_exp}
              notes={selectedReport.notes}
              aerialNotes={selectedReport.aerial_notes}
              mediaEntries={mediaEntries}
              signatureEntries={signatureEntries}
              onClose={closeDetail}
              onUseAsTemplate={() => selectedReport && handleUseAsTemplate(selectedReport)}
            />
          );
        })()}
      </AnimatePresence>
    </DashboardLayout>
  );
}
