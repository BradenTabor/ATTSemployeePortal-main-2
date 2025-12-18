import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  FormEvent,
  ReactNode,
  useCallback,
} from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Camera, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CONFIG} from "../lib/config";
import { logger } from "../lib/logger"; 
import { cn } from "../lib/utils";
import { DateField } from "../components/forms/GlassyPickers";

type ExtraPhotos = {
  tire?: File;
  coolant?: File;
  damage?: File;
  mileage?: File; // used for Detail-clean Truck Photo
};

type ChecklistValue = "" | "P" | "F";

interface ChecklistItem {
  id: string;
  label: string;
}

// Fixed truck number list for dropdowns
const TRUCK_NUMBERS = [
  "B132",
  "B103",
  "B114",
  "B122",
  "B124",
  "B137",
  "B151",
  "158",
  "149",
  "104",
  "155",
  "139",
  "141",
  "125",
];

// Trailer numbers dropdown list
const TRAILER_NUMBERS = [
  "148-TEXAS ",
  "150-LAMAR",
  "153-TRACTOR SUPPLY",
  "154-Load Trail",
];

// Chipper numbers dropdown list
const CHIPPER_NUMBERS = [
  "C-15",
  "C-16",
  "C-21",
  "C-27",
  "C-28",
  "C-30",
  "C-34",
  "C-53",
  "C-54",
];

// SECTION B – Vehicle / Trailer checklist (from DVIR PDF)
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

// Aerial lift checklist (bottom section of PDF)
const AERIAL_LIFT_ITEMS: ChecklistItem[] = [
  { id: "hydraulic_oil_level", label: "Oil Level in Hydraulic Reservoir" },
  { id: "hydraulic_system_leaks", label: "Hydraulic System free of Leaks" },
  { id: "hydraulic_cylinders_leaks", label: "Hydraulic Cylinders free of Leaks" },
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

/* ------------------------------------------------------------------
   Layout Helpers
-------------------------------------------------------------------*/

interface SectionCardProps {
  title: string;
  subtitle?: string;
  badge?: string;
  children: ReactNode;
}

const SectionCard = ({ title, subtitle, badge, children }: SectionCardProps) => (
  <section 
    className="rounded-3xl border border-white/10 bg-gradient-to-br from-gray-900/80 via-gray-900/40 to-gray-900/10 p-6 space-y-5"
    style={{
      boxShadow: '0px 4px 25px 8px rgba(0, 0, 0, 0.65), 0px 20px 25px -5px rgba(0, 0, 0, 0.1), 0px 8px 10px -6px rgba(0, 0, 0, 0.1)',
    }}
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] tracking-[0.3em] uppercase text-emerald-200/70">
          {badge || "DOT COMPLIANT"}
        </p>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-white/70 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </section>
);

interface UploadTileProps {
  label: string;
  description?: string;
  required?: boolean;
  status: boolean;
  onClick: () => void;
}

const UploadTile = ({ label, description, required, status, onClick }: UploadTileProps) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.04] px-4 py-3 text-left transition-all hover:border-emerald-400/40 hover:bg-white/[0.07]"
  >
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-2.5 text-emerald-200">
        <Camera className="w-4 h-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-white flex items-center gap-1">
          {label}
          {required && <span className="text-rose-300 text-[11px]">* Required</span>}
        </p>
        {description && <p className="text-xs text-white/60">{description}</p>}
      </div>
    </div>
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold transition-colors",
        status ? "text-emerald-300" : "text-amber-200"
      )}
    >
      {status ? (
        <>
          <CheckCircle2 className="w-4 h-4" />
          Captured
        </>
      ) : (
        <>
          <AlertTriangle className="w-4 h-4" />
          Pending
        </>
      )}
    </span>
  </button>
);

/* ------------------------------------------------------------------
   Signature Pad Component
-------------------------------------------------------------------*/

interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  getImageBlob: () => Promise<Blob | null>;
}

interface SignaturePadProps {
  label: string;
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ label }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const strokesRef = useRef<{ x: number; y: number }[][]>([]);
    const currentStrokeRef = useRef<{ x: number; y: number }[] | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawing, setHasDrawing] = useState(false);

    const redraw = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = "#fdfdfd";
      ctx.fillRect(0, 0, rect.width, rect.height);
      strokesRef.current.forEach((stroke) => {
        ctx.beginPath();
        stroke.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
      });
    }, []);

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#0f172a";
      ctxRef.current = ctx;
      redraw();
    }, [redraw]);

    useEffect(() => {
      resizeCanvas();
      const handleResize = () => resizeCanvas();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [resizeCanvas]);

    const handleClear = () => {
      strokesRef.current = [];
      currentStrokeRef.current = null;
      redraw();
      setHasDrawing(false);
    };

    const handleUndo = () => {
      if (!strokesRef.current.length) return;
      strokesRef.current.pop();
      redraw();
      setHasDrawing(strokesRef.current.length > 0);
    };

    useImperativeHandle(ref, () => ({
      clear: handleClear,
      isEmpty() {
        return !hasDrawing;
      },
      async getImageBlob() {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawing) return null;
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob || null), "image/png");
        });
      },
    }));

    const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const ctx = ctxRef.current;
      if (!ctx) return;
      const point = getPoint(event);
      if (!point) return;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      currentStrokeRef.current = [point];
      setIsDrawing(true);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing || !currentStrokeRef.current) return;
      const ctx = ctxRef.current;
      if (!ctx) return;
      const point = getPoint(event);
      if (!point) return;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      currentStrokeRef.current.push(point);
      setHasDrawing(true);
    };

    const handlePointerUp = () => {
      setIsDrawing(false);
      if (currentStrokeRef.current && currentStrokeRef.current.length) {
        strokesRef.current.push(currentStrokeRef.current);
      }
      currentStrokeRef.current = null;
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>{label}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!hasDrawing}
              className="text-[11px] text-white/60 hover:text-white disabled:opacity-30 disabled:hover:text-white/60 transition"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-white/60 hover:text-white transition"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            className="w-full h-36 md:h-44 touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
        <p className="text-[11px] text-white/50">
          Use your finger or stylus. Undo or clear as needed before submitting.
        </p>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";

/* ------------------------------------------------------------------
   DVIR Form Component
-------------------------------------------------------------------*/

export default function DVIRForm() {
  // Mechanic section
  const [mechTruckNumber, setMechTruckNumber] = useState("");
  const [deficiencyCorrected, setDeficiencyCorrected] = useState("");
  const [mechanicRemarks, setMechanicRemarks] = useState("");
  const [mechanicDate, setMechanicDate] = useState("");

  // NEW: mechanic section dropdown toggle
  const [isMechanicOpen, setIsMechanicOpen] = useState(false);

  // SECTION A – Vehicle / Driver info
  const [truckNumber, setTruckNumber] = useState("");
  const [mileage, setMileage] = useState("");
  const [chipperNumber, setChipperNumber] = useState("");
  const [trailerNumber, setTrailerNumber] = useState("");
  const [truckGvwr, setTruckGvwr] = useState("");
  const [trailerChipperGvwr, setTrailerChipperGvwr] = useState("");
  const [medicalCardRequired, setMedicalCardRequired] = useState<
    "" | "YES" | "NO"
  >("");
  const [driversName, setDriversName] = useState("");
  const [driversLicenseNumber, setDriversLicenseNumber] = useState("");
  const [driversLicenseClass, setDriversLicenseClass] = useState("");
  const [driversLicenseExp, setDriversLicenseExp] = useState("");
  const [driversLicenseRequired, setDriversLicenseRequired] = useState("");
  const [hasMedicalCard, setHasMedicalCard] = useState<"" | "YES" | "NO">("");
  const [medicalCardExp, setMedicalCardExp] = useState("");

  // 🔽 Auto-populate driver info from app_users
  useEffect(() => {
    const loadDriverInfo = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          logger.error("Error getting auth user:", userError);
          return;
        }
        if (!user) {
          logger.warn("No authenticated user found for DVIR form.");
          return;
        }

        const { data, error } = await supabase
          .from("app_users")
          .select(
            "full_name, drivers_license_number, drivers_license_class, drivers_license_expiration"
          )
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          logger.error("Error loading app_users for DVIR:", error);
          return;
        }
        if (!data) {
          logger.warn("No app_users record found for user:", user.id);
          return;
        }

        const formatDateForDisplay = (value: string | null) => {
          if (!value) return "";
          if (value.includes("/") && value.split("/").length === 3) return value;
          const parts = value.split("-");
          if (parts.length === 3) {
            const [y, m, d] = parts;
            return `${m}/${d}/${y}`;
          }
          return value;
        };

        if (data.full_name) {
          setDriversName(data.full_name);
        }
        if (data.drivers_license_number) {
          setDriversLicenseNumber(data.drivers_license_number);
        }
        if (data.drivers_license_class) {
          setDriversLicenseClass(data.drivers_license_class);
        }
        if (data.drivers_license_expiration) {
          setDriversLicenseExp(
            formatDateForDisplay(
              data.drivers_license_expiration as unknown as string
            )
          );
        }
      } catch (err) {
        logger.error("Unexpected error loading driver info for DVIR:", err);
      }
    };

    loadDriverInfo();
  }, []);

  const [copyOfRegistration, setCopyOfRegistration] = useState<
    "" | "YES" | "NO"
  >("");
  const [copyOfInsurance, setCopyOfInsurance] = useState<"" | "YES" | "NO">("");
  const [driversSignatureSectionA, setDriversSignatureSectionA] =
    useState("");

  // SECTION B – Vehicle / Trailer checklist
  const [vehicleTrailerChecklist, setVehicleTrailerChecklist] = useState<
    Record<string, ChecklistValue>
  >({});

  // Notes
  const [notes, setNotes] = useState("");

  // Aerial lift section
  const [aerialChecklist, setAerialChecklist] = useState<
    Record<string, ChecklistValue>
  >({});
  const [aerialNotes, setAerialNotes] = useState("");

  // Camera-related state
  const [oilDipstickPhoto, setOilDipstickPhoto] = useState<File | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<ExtraPhotos>({});

  const oilInputRef = useRef<HTMLInputElement | null>(null);
  const tireInputRef = useRef<HTMLInputElement | null>(null);
  const coolantInputRef = useRef<HTMLInputElement | null>(null);
  const damageInputRef = useRef<HTMLInputElement | null>(null);
  const mileageInputRef = useRef<HTMLInputElement | null>(null);

  // Signature pad refs
  const finalDriverSigRef = useRef<SignaturePadHandle | null>(null);
  const generalForemanSigRef = useRef<SignaturePadHandle | null>(null);
  const mechanicSigRef = useRef<SignaturePadHandle | null>(null);
  const driverApprovalSigRef = useRef<SignaturePadHandle | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 🔔 Auto-hide toast messages after 4 seconds
  useEffect(() => {
    if (!success && !error) return;

    const timer = setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [success, error]);

  function handleExtraPhotoChange(type: keyof ExtraPhotos, file?: File) {
    setExtraPhotos((prev) => ({
      ...prev,
      [type]: file,
    }));
  }

  function handleChecklistChange(
    section: "vehicle" | "aerial",
    id: string,
    value: ChecklistValue
  ) {
    if (section === "vehicle") {
      setVehicleTrailerChecklist((prev) => ({ ...prev, [id]: value }));
    } else {
      setAerialChecklist((prev) => ({ ...prev, [id]: value }));
    }
  }

  async function uploadPhoto(file: File, fieldName: string): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id || "anonymous";

    const ext = file.name.split(".").pop() || "jpg";
    // Bucket: dvir-photos
    // Path:   dvir-photos/<userId>/<timestamp>-fieldName.ext
    const filePath = `dvir-photos/${userId}/${Date.now()}-${fieldName}.${ext}`;

    const { error } = await supabase.storage
      .from("dvir-photos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      logger.error(`Error uploading ${fieldName}`, error);
      throw error;
    }

    return filePath;
  }

  async function uploadSignatureFromPad(
    padRef: React.RefObject<SignaturePadHandle>,
    fieldName: string
  ): Promise<string | null> {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return null;
    const blob = await pad.getImageBlob();
    if (!blob) return null;

    const file = new File([blob], `${fieldName}.png`, { type: "image/png" });
    const path = await uploadPhoto(file, `signature_${fieldName}`);
    return path;
  }

  // 🔐 Submit handler with explicit session check so RLS auth.uid() works
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Basic front-end checks
    if (!oilDipstickPhoto) {
      setError("Oil dipstick photo is required.");
      return;
    }

    if (!truckNumber.trim() || !mileage.trim() || !driversName.trim()) {
      setError("Truck number, mileage, and driver's name are required.");
      return;
    }

    try {
      setSubmitting(true);

      // 1) Ensure we have an authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        logger.error("Auth error in DVIR submit (getUser):", userError);
        setError(`Unable to load user: ${userError.message}`);
        return;
      }

      if (!user) {
        logger.error("No authenticated user in DVIR submit");
        setError("You must be logged in to submit a DVIR.");
        return;
      }

      // 2) Ensure Supabase session/JWT is loaded so RLS auth.uid() is not null
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        logger.error("Auth session error in DVIR submit (getSession):", sessionError);
        setError("Unable to verify your session. Please refresh the page and try again.");
        return;
      }

      if (!session) {
        logger.warn("No active session in DVIR submit – auth still hydrating?");
        setError("Your session is still loading. Please wait a moment and try again.");
        return;
      }

      const userId = user.id;
      const userEmail = user.email ?? null;

      // 3) Upload required oil dipstick photo
      logger.debug("Uploading oil dipstick photo...");
      const oilDipstickPath = await uploadPhoto(oilDipstickPhoto, "oil_dipstick");
      logger.debug("Oil dipstick uploaded:", oilDipstickPath);

      // 4) Upload optional photos
      let tirePhotoPath: string | null = null;
      let coolantPhotoPath: string | null = null;
      let damagePhotoPath: string | null = null;
      let detailCleanTruckPhotoPath: string | null = null;

      if (extraPhotos.tire) {
        logger.debug("Uploading tire photo...");
        tirePhotoPath = await uploadPhoto(extraPhotos.tire, "tire");
      }
      if (extraPhotos.coolant) {
        logger.debug("Uploading coolant photo...");
        coolantPhotoPath = await uploadPhoto(extraPhotos.coolant, "coolant");
      }
      if (extraPhotos.damage) {
        logger.debug("Uploading damage photo...");
        damagePhotoPath = await uploadPhoto(extraPhotos.damage, "damage");
      }
      if (extraPhotos.mileage) {
        logger.debug("Uploading detail-clean truck photo...");
        detailCleanTruckPhotoPath = await uploadPhoto(
          extraPhotos.mileage,
          "detail-clean_truck"
        );
      }

      // 5) Upload signatures (if signed)
      logger.debug("Uploading signatures (if any)...");
      const finalDriverSigPath = await uploadSignatureFromPad(
        finalDriverSigRef,
        "final_driver_signature"
      );
      const generalForemanSigPath = await uploadSignatureFromPad(
        generalForemanSigRef,
        "general_foreman_signature"
      );
      const mechanicSigPath = await uploadSignatureFromPad(
        mechanicSigRef,
        "mechanic_signature"
      );
      const driverApprovalSigPath = await uploadSignatureFromPad(
        driverApprovalSigRef,
        "driver_approval_signature"
      );

      // 6) Build common payload object once
      const commonPayload = {
        user_id: userId,
        user_email: userEmail,
        created_at: new Date().toISOString(),

        // Section A
        truck_number: truckNumber,
        mileage,
        chipper_number: chipperNumber || null,
        trailer_number: trailerNumber || null,
        truck_gvwr: truckGvwr || null,
        trailer_chipper_gvwr: trailerChipperGvwr || null,
        medical_card_required: medicalCardRequired || null,
        drivers_name: driversName,
        drivers_license_number: driversLicenseNumber || null,
        drivers_license_class: driversLicenseClass || null,
        drivers_license_exp: driversLicenseExp || null,
        drivers_license_required: driversLicenseRequired || null,
        has_medical_card: hasMedicalCard || null,
        medical_card_exp: medicalCardExp || null,
        copy_of_registration: copyOfRegistration || null,
        copy_of_insurance: copyOfInsurance || null,
        drivers_signature_section_a: driversSignatureSectionA || null,

        // Checklists & notes
        vehicle_trailer_checklist: vehicleTrailerChecklist,
        notes: notes || null,
        aerial_checklist: aerialChecklist,
        aerial_notes: aerialNotes || null,

        // Signatures
        final_driver_signature: finalDriverSigPath,
        general_foreman_signature: generalForemanSigPath,
        mechanic_truck_number: mechTruckNumber || null,
        mechanic_date: mechanicDate || null,
        deficiency_corrected: deficiencyCorrected || null,
        mechanic_remarks: mechanicRemarks || null,
        mechanic_signature: mechanicSigPath,
        driver_approval_signature: driverApprovalSigPath,

        // Photos
        oil_dipstick_path: oilDipstickPath,
        tire_photo_path: tirePhotoPath,
        coolant_photo_path: coolantPhotoPath,
        damage_photo_path: damagePhotoPath,
        detail_clean_truck_photo_path: detailCleanTruckPhotoPath,
      };

      // 7) FIRST save to Supabase (DB is the source of truth)
      logger.debug("Inserting DVIR into dvir_reports...");
     const { error: insertError } = await supabase
  .from("dvir_reports")
  .insert({
    // ✅ Do NOT send user_id – DB will default it to auth.uid()

    // Section A
    truck_number: truckNumber,
    mileage: Number(mileage),
    chipper_number: chipperNumber || null,
    trailer_number: trailerNumber || null,
    truck_gvwr: truckGvwr || null,
    trailer_chipper_gvwr: trailerChipperGvwr || null,
    medical_card_required: medicalCardRequired || null,
    drivers_name: driversName,
    drivers_license_number: driversLicenseNumber || null,
    drivers_license_class: driversLicenseClass || null,
    drivers_license_exp: driversLicenseExp || null,
    drivers_license_required: driversLicenseRequired || null,
    has_medical_card: hasMedicalCard || null,
    medical_card_exp: medicalCardExp || null,
    copy_of_registration: copyOfRegistration || null,
    copy_of_insurance: copyOfInsurance || null,
    drivers_signature_section_a: driversSignatureSectionA || null,

    // Vehicle / Trailer checklist
    vehicle_trailer_checklist: vehicleTrailerChecklist,

    // Notes
    notes: notes || null,

    // Aerial lift
    aerial_checklist: aerialChecklist,
    aerial_notes: aerialNotes || null,

    // Final sign-off (store signature image paths)
    final_driver_signature: finalDriverSigPath,
    general_foreman_signature: generalForemanSigPath,

    // Mechanic section
    mechanic_truck_number: mechTruckNumber || null,
    mechanic_date: mechanicDate || null,
    deficiency_corrected: deficiencyCorrected || null,
    mechanic_remarks: mechanicRemarks || null,
    mechanic_signature: mechanicSigPath,
    driver_approval_signature: driverApprovalSigPath,

    // Photo paths
    oil_dipstick_path: oilDipstickPath,
    tire_photo_path: tirePhotoPath,
    coolant_photo_path: coolantPhotoPath,
    damage_photo_path: damagePhotoPath,
    detail_clean_truck_photo_path: detailCleanTruckPhotoPath,
  });

      if (insertError) {
        logger.error("Supabase insert error (dvir_reports):", insertError);
        setError(`Failed to save DVIR to the database: ${insertError.message}`);
        return;
      }

      logger.info("DVIR row inserted successfully. Sending to Make webhook...");

      // 8) THEN send to Make.com webhook (non-blocking for DB save)
      if (!CONFIG.make.dvirWebhook) {
        throw new Error("DVIR webhook URL is not configured");
      }

      const webhookRes = await fetch(
        CONFIG.make.dvirWebhook,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commonPayload),
        }
      );

      if (!webhookRes.ok) {
        const text = await webhookRes.text();
        logger.error("Make webhook error:", text);
        // Don't undo the successful DB insert, just warn the user
        setError(
          "DVIR was saved, but there was an issue sending data to the automation webhook."
        );
        return;
      }

      logger.info("Make webhook call succeeded.");

      // ✅ Success – show message & reset form
      setSuccess("DVIR submitted successfully.");
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Reset Section A
      setTruckNumber("");
      setMileage("");
      setChipperNumber("");
      setTrailerNumber("");
      setTruckGvwr("");
      setTrailerChipperGvwr("");
      setMedicalCardRequired("");
      setDriversName("");
      setDriversLicenseNumber("");
      setDriversLicenseClass("");
      setDriversLicenseExp("");
      setDriversLicenseRequired("");
      setHasMedicalCard("");
      setMedicalCardExp("");
      setCopyOfRegistration("");
      setCopyOfInsurance("");
      setDriversSignatureSectionA("");

      // Reset checklists & notes
      setVehicleTrailerChecklist({});
      setNotes("");
      setAerialChecklist({});
      setAerialNotes("");

      // Reset mechanic section
      setMechTruckNumber("");
      setMechanicDate("");
      setDeficiencyCorrected("");
      setMechanicRemarks("");
      setIsMechanicOpen(false);

      // Reset photos
      setOilDipstickPhoto(null);
      setExtraPhotos({});

      // Clear signature pads
      finalDriverSigRef.current?.clear();
      generalForemanSigRef.current?.clear();
      mechanicSigRef.current?.clear();
      driverApprovalSigRef.current?.clear();
    } catch (err: unknown) {
      logger.error("Unexpected error in DVIR handleSubmit:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong submitting the DVIR (unexpected error).";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout title="Daily Vehicle Inspection (DVIR)">
      <div className="max-w-4xl mx-auto">
        {/* Toast notifications */}
        {(success || error) && (
          <div className="fixed top-4 right-4 z-50">
            <div
              className={`rounded-lg px-4 py-3 text-sm shadow-lg ${
                success
                  ? "bg-emerald-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {success || error}
            </div>
          </div>
        )}

        {/* Info banner */}
        <div 
          className="mb-4 rounded-3xl border-4 border-yellow-500 px-4 py-3 text-xs text-white"
          style={{
            backgroundColor: 'rgba(112, 84, 0, 0.45)',
            boxShadow: '0px 4px 18px 4px rgba(0, 0, 0, 1)',
          }}
        >
          At the start of each shift, drivers must inspect their vehicles and
          report any deficiency that could affect safety or result in a breakdown.
          Complete Section A, then Section B, record any deficiencies in the Notes
          section, and review with your supervisor. Oil dipstick photo is required.
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION A – Vehicle / Driver Information */}
          <SectionCard
            title="Section A. Vehicle / Driver Information"
            subtitle="Complete before operating any ATTS vehicle. Fields marked with * are required."
            badge="Required"
          >
            {/* Truck / Trailer / GVWR row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* TRUCK NUMBER as dropdown */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  TRUCK NUMBER *
                </label>
                <select
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select Truck Number</option>
                  {TRUCK_NUMBERS.map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  MILEAGE *
                </label>
                <input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              {/* CHIPPER NUMBER as dropdown */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  CHIPPER NUMBER
                </label>
                <select
                  value={chipperNumber}
                  onChange={(e) => setChipperNumber(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select Chipper Number</option>
                  {CHIPPER_NUMBERS.map((chip) => (
                    <option key={chip} value={chip}>
                      {chip}
                    </option>
                  ))}
                </select>
              </div>

              {/* TRAILER NUMBER as dropdown */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  TRAILER NUMBER
                </label>
                <select
                  value={trailerNumber}
                  onChange={(e) => setTrailerNumber(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select Trailer Number</option>
                  {TRAILER_NUMBERS.map((trail) => (
                    <option key={trail} value={trail}>
                      {trail}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  TRUCK GVWR
                </label>
                <input
                  value={truckGvwr}
                  onChange={(e) => setTruckGvwr(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  TRAILER / CHIPPER GVWR
                </label>
                <input
                  value={trailerChipperGvwr}
                  onChange={(e) => setTrailerChipperGvwr(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            {/* Medical card required */}
            <div>
              <label className="block text-xs text-gray-300 mb-1">
                IS A MEDICAL CARD REQUIRED
              </label>
              <div className="flex gap-3 text-xs text-gray-200">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="medical_card_required"
                    value="YES"
                    checked={medicalCardRequired === "YES"}
                    onChange={() => setMedicalCardRequired("YES")}
                  />
                  YES
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="medical_card_required"
                    value="NO"
                    checked={medicalCardRequired === "NO"}
                    onChange={() => setMedicalCardRequired("NO")}
                  />
                  NO
                </label>
              </div>
            </div>

            {/* Driver + License fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  DRIVERS NAME *
                </label>
                <input
                  value={driversName}
                  onChange={(e) => setDriversName(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  DRIVERS LICENSE NUMBER
                </label>
                <input
                  value={driversLicenseNumber}
                  onChange={(e) => setDriversLicenseNumber(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  DRIVERS LICENSE CLASS
                </label>
                <input
                  value={driversLicenseClass}
                  onChange={(e) => setDriversLicenseClass(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  DRIVERS LICENSE EXP. (MM/DD/YYYY)
                </label>
                <input
                  value={driversLicenseExp}
                  onChange={(e) => setDriversLicenseExp(e.target.value)}
                  placeholder="MM/DD/YYYY"
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            {/* License required + medical card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  DRIVERS LICENSE REQUIRED
                </label>
                <input
                  value={driversLicenseRequired}
                  onChange={(e) =>
                    setDriversLicenseRequired(e.target.value)
                  }
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  DO YOU HAVE A MEDICAL CARD
                </label>
                <div className="flex gap-3 text-xs text-gray-200">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="has_medical_card"
                      value="YES"
                      checked={hasMedicalCard === "YES"}
                      onChange={() => setHasMedicalCard("YES")}
                    />
                    YES
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="has_medical_card"
                      value="NO"
                      checked={hasMedicalCard === "NO"}
                      onChange={() => setHasMedicalCard("NO")}
                    />
                    NO
                  </label>
                </div>
              </div>
            </div>

            {/* Medical card exp + copies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DateField
                label="MEDICAL CARD EXPIRATION (MM/DD/YYYY)"
                value={medicalCardExp}
                onValueChange={setMedicalCardExp}
                helperText="Required for DOT compliance"
                containerClassName="text-white"
                labelClassName="text-xs tracking-wide text-gray-300"
                className="bg-black/70 border-gray-700 focus:ring-emerald-400/50"
              />

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  COPY OF REGISTRATION
                </label>
                <div className="flex gap-3 text-xs text-gray-200">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="copy_registration"
                      value="YES"
                      checked={copyOfRegistration === "YES"}
                      onChange={() => setCopyOfRegistration("YES")}
                    />
                    YES
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="copy_registration"
                      value="NO"
                      checked={copyOfRegistration === "NO"}
                      onChange={() => setCopyOfRegistration("NO")}
                    />
                    NO
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  COPY OF INSURANCE
                </label>
                <div className="flex gap-3 text-xs text-gray-200">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="copy_insurance"
                      value="YES"
                      checked={copyOfInsurance === "YES"}
                      onChange={() => setCopyOfInsurance("YES")}
                    />
                    YES
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="copy_insurance"
                      value="NO"
                      checked={copyOfInsurance === "NO"}
                      onChange={() => setCopyOfInsurance("NO")}
                    />
                    NO
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  DRIVERS SIGNATURE (Section A) – printed name
                </label>
                <input
                  value={driversSignatureSectionA}
                  onChange={(e) =>
                    setDriversSignatureSectionA(e.target.value)
                  }
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
          </SectionCard>

          {/* SECTION B – Vehicle / Trailer Inspection Checklist */}
          <SectionCard
            title="Section B. Vehicle / Trailer Inspection Checklist"
            subtitle='Mark "P" for pass and "F" for fail. Describe deficiencies in the Notes section.'
            badge="Inspection"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VEHICLE_TRAILER_ITEMS.map((item) => {
                const value = vehicleTrailerChecklist[item.id] || "";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-black/50 px-3 py-2"
                  >
                    <span className="text-xs text-gray-100 pr-2">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("vehicle", item.id, "P")
                        }
                        className={`
                          px-2 py-1 text-[10px] rounded-md border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus:outline-none focus:ring-1 focus:ring-emerald-400
                          ${
                            value === "P"
                              ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-emerald-400/70 hover:text-emerald-200"
                          }
                        `}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("vehicle", item.id, "F")
                        }
                        className={`
                          px-2 py-1 text-[10px] rounded-md border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus:outline-none focus:ring-1 focus:ring-red-400
                          ${
                            value === "F"
                              ? "bg-red-600 border-red-400 text-white shadow-[0_0_10px_rgba(248,113,113,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-red-400/70 hover:text-red-200"
                          }
                        `}
                      >
                        F
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Photos (Camera Capture) */}
          <SectionCard
            title="Photo Evidence"
            subtitle="Capture the required oil dipstick photo plus any additional context that helps maintenance."
            badge="Media"
          >
            {/* Hidden inputs */}
            <input
              ref={oilInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setOilDipstickPhoto(file);
              }}
            />
            <input
              ref={tireInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleExtraPhotoChange("tire", file);
              }}
            />
            <input
              ref={coolantInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleExtraPhotoChange("coolant", file);
              }}
            />
            <input
              ref={damageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleExtraPhotoChange("damage", file);
              }}
            />
            <input
              ref={mileageInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleExtraPhotoChange("mileage", file);
              }}
            />

            <div className="space-y-4">
              <UploadTile
                label="Oil Dipstick Photo"
                description="Required before submitting this DVIR"
                required
                status={Boolean(oilDipstickPhoto)}
                onClick={() => oilInputRef.current?.click()}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <UploadTile
                  label="Tire Tread"
                  description="Optional"
                  status={Boolean(extraPhotos.tire)}
                  onClick={() => tireInputRef.current?.click()}
                />
                <UploadTile
                  label="Coolant Level"
                  description="Optional"
                  status={Boolean(extraPhotos.coolant)}
                  onClick={() => coolantInputRef.current?.click()}
                />
                <UploadTile
                  label="Vehicle Damage"
                  description="Optional"
                  status={Boolean(extraPhotos.damage)}
                  onClick={() => damageInputRef.current?.click()}
                />
                <UploadTile
                  label="Detail / Clean Truck"
                  description="Optional"
                  status={Boolean(extraPhotos.mileage)}
                  onClick={() => mileageInputRef.current?.click()}
                />
              </div>
            </div>
          </SectionCard>

          {/* NOTES */}
          <SectionCard
            title="Notes & Deficiencies"
            subtitle="Describe every deficiency that needs attention. These notes appear in the mechanic review."
            badge="Documentation"
          >
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              placeholder="Example: Right tail light not functioning, noted during inspection."
            />
          </SectionCard>

          {/* Aerial Lift Section */}
          <SectionCard
            title="Aerial Lift Inspection (If Equipped)"
            subtitle='Only complete for vehicles with aerial lifts. Mark "P" for pass and "F" for fail.'
            badge="Aerial"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AERIAL_LIFT_ITEMS.map((item) => {
                const value = aerialChecklist[item.id] || "";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-black/50 px-3 py-2"
                  >
                    <span className="text-xs text-gray-100 pr-2">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("aerial", item.id, "P")
                        }
                        className={`
                          px-2 py-1 text-[10px] rounded-md border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus:outline-none focus:ring-1 focus:ring-emerald-400
                          ${
                            value === "P"
                              ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-emerald-400/70 hover:text-emerald-200"
                          }
                        `}
                      >
                        P
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleChecklistChange("aerial", item.id, "F")
                        }
                        className={`
                          px-2 py-1 text-[10px] rounded-md border
                          transition-transform transition-colors duration-150
                          active:scale-95 focus:outline-none focus:ring-1 focus:ring-red-400
                          ${
                            value === "F"
                              ? "bg-red-600 border-red-400 text-white shadow-[0_0_10px_rgba(248,113,113,0.4)]"
                              : "bg-black/70 border-gray-600 text-gray-300 hover:border-red-400/70 hover:text-red-200"
                          }
                        `}
                      >
                        F
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs text-white/70 mb-1">NOTES</label>
              <textarea
                value={aerialNotes}
                onChange={(e) => setAerialNotes(e.target.value)}
                rows={3}
                className="w-full rounded-2xl bg-black/60 border border-white/10 px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              />
            </div>
          </SectionCard>

          {/* Final Sign-off with signature pads */}
          <SectionCard
            title="Driver & Foreman Sign-off"
            subtitle="Certify that today's inspection is complete and deficiencies have been communicated."
            badge="Signatures"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SignaturePad
                ref={finalDriverSigRef}
                label="Driver Signature (draw)"
              />
              <SignaturePad
                ref={generalForemanSigRef}
                label="General Foreman Signature (draw)"
              />
            </div>
          </SectionCard>

          {/* Mechanic Section – collapsible */}
          <SectionCard
            title="Mechanic Review (Complete if deficiencies exist)"
            subtitle="Only mechanics should complete this section after addressing noted issues."
            badge="Mechanic"
          >
            <button
              type="button"
              onClick={() => setIsMechanicOpen((prev) => !prev)}
              className="w-full flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:border-emerald-400/30"
            >
              <span>{isMechanicOpen ? "Hide mechanic form" : "Open mechanic form"}</span>
              <span className="text-xs text-white/60">{isMechanicOpen ? "▲" : "▼"}</span>
            </button>

            {isMechanicOpen && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">
                      Truck Number
                    </label>
                    <select
                      value={mechTruckNumber}
                      onChange={(e) => setMechTruckNumber(e.target.value)}
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select Truck Number</option>
                      {TRUCK_NUMBERS.map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">
                      Date (MM/DD/YYYY)
                    </label>
                    <input
                      value={mechanicDate}
                      onChange={(e) => setMechanicDate(e.target.value)}
                      placeholder="MM/DD/YYYY"
                      className="w-full rounded-2xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-white/70 mb-1">
                    Noted Deficiency Corrected
                  </label>
                  <input
                    value={deficiencyCorrected}
                    onChange={(e) => setDeficiencyCorrected(e.target.value)}
                    className="w-full rounded-2xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/70 mb-1">
                    Remarks by Mechanic
                  </label>
                  <textarea
                    value={mechanicRemarks}
                    onChange={(e) => setMechanicRemarks(e.target.value)}
                    rows={2}
                    className="w-full rounded-2xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-white"
                  />
                </div>

                <SignaturePad
                  ref={mechanicSigRef}
                  label="Mechanic Signature (draw)"
                />
              </div>
            )}
          </SectionCard>

          {/* Submit */}
          <SectionCard
            title="Submit & Certify DVIR"
            subtitle="Submission locks this inspection to today's date and triggers any required follow-up."
            badge="Compliance"
          >
            <ul className="text-xs text-white/70 space-y-1">
              <li>• I have reviewed all sections and confirmed accuracy.</li>
              <li>• Any deficiencies are documented and communicated.</li>
              <li>• Required oil dipstick photo has been captured.</li>
            </ul>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90"
              style={{
                background: 'linear-gradient(90deg, rgba(16, 185, 129, 1) 0%, rgba(3, 3, 3, 1) 100%)',
              }}
            >
              {submitting ? "Submitting..." : "Submit DVIR"}
            </button>
          </SectionCard>
        </form>
      </div>
    </DashboardLayout>
  );
}
