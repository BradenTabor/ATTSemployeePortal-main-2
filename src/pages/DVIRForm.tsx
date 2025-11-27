import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  FormEvent,
} from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

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
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawing, setHasDrawing] = useState(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
    }, []);

    useImperativeHandle(ref, () => ({
      clear() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, rect.width, rect.height);
        setHasDrawing(false);
      },
      isEmpty() {
        return !hasDrawing;
      },
      async getImageBlob() {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawing) return null;
        return new Promise((resolve) => {
          canvas.toBlob((blob) => {
            resolve(blob || null);
          }, "image/png");
        });
      },
    }));

    const handlePointerDown = (
      e: React.PointerEvent<HTMLCanvasElement>
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      setIsDrawing(true);
    };

    const handlePointerMove = (
      e: React.PointerEvent<HTMLCanvasElement>
    ) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
      setHasDrawing(true);
    };

    const handlePointerUp = () => {
      setIsDrawing(false);
    };

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-xs text-gray-300 mb-1">
            {label}
          </label>
          <button
            type="button"
            onClick={() => ref && (ref as any).current?.clear?.()}
            className="text-[10px] text-gray-400 hover:text-white underline"
          >
            Clear
          </button>
        </div>
        <div className="rounded-md border border-gray-600 bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-28 touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
        <p className="text-[10px] text-gray-400">
          Sign inside the box with your finger or stylus.
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
  const navigate = useNavigate();

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
          console.error("Error getting auth user:", userError);
          return;
        }
        if (!user) {
          console.warn("No authenticated user found for DVIR form.");
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
          console.error("Error loading app_users for DVIR:", error);
          return;
        }
        if (!data) {
          console.warn("No app_users record found for user:", user.id);
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
        console.error("Unexpected error loading driver info for DVIR:", err);
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
      console.error(`Error uploading ${fieldName}`, error);
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
        console.error("Auth error in DVIR submit (getUser):", userError);
        setError(`Unable to load user: ${userError.message}`);
        return;
      }

      if (!user) {
        console.error("No authenticated user in DVIR submit");
        setError("You must be logged in to submit a DVIR.");
        return;
      }

      // 2) Ensure Supabase session/JWT is loaded so RLS auth.uid() is not null
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Auth session error in DVIR submit (getSession):", sessionError);
        setError("Unable to verify your session. Please refresh the page and try again.");
        return;
      }

      if (!session) {
        console.warn("No active session in DVIR submit – auth still hydrating?");
        setError("Your session is still loading. Please wait a moment and try again.");
        return;
      }

      const userId = user.id;
      const userEmail = user.email ?? null;

      // 3) Upload required oil dipstick photo
      console.log("Uploading oil dipstick photo...");
      const oilDipstickPath = await uploadPhoto(oilDipstickPhoto, "oil_dipstick");
      console.log("Oil dipstick uploaded:", oilDipstickPath);

      // 4) Upload optional photos
      let tirePhotoPath: string | null = null;
      let coolantPhotoPath: string | null = null;
      let damagePhotoPath: string | null = null;
      let detailCleanTruckPhotoPath: string | null = null;

      if (extraPhotos.tire) {
        console.log("Uploading tire photo...");
        tirePhotoPath = await uploadPhoto(extraPhotos.tire, "tire");
      }
      if (extraPhotos.coolant) {
        console.log("Uploading coolant photo...");
        coolantPhotoPath = await uploadPhoto(extraPhotos.coolant, "coolant");
      }
      if (extraPhotos.damage) {
        console.log("Uploading damage photo...");
        damagePhotoPath = await uploadPhoto(extraPhotos.damage, "damage");
      }
      if (extraPhotos.mileage) {
        console.log("Uploading detail-clean truck photo...");
        detailCleanTruckPhotoPath = await uploadPhoto(
          extraPhotos.mileage,
          "detail-clean_truck"
        );
      }

      // 5) Upload signatures (if signed)
      console.log("Uploading signatures (if any)...");
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
      console.log("Inserting DVIR into dvir_reports...");
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
        console.error("❌ Supabase insert error (dvir_reports):", insertError);
        setError(`Failed to save DVIR to the database: ${insertError.message}`);
        return;
      }

      console.log("✅ DVIR row inserted successfully. Sending to Make webhook...");

      // 8) THEN send to Make.com webhook (non-blocking for DB save)
      const webhookRes = await fetch(
        "https://hook.us2.make.com/24ocs936nykr05avzp2bhq46lxm6i3hz",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commonPayload),
        }
      );

      if (!webhookRes.ok) {
        const text = await webhookRes.text();
        console.error("❌ Make webhook error:", text);
        // Don't undo the successful DB insert, just warn the user
        setError(
          "DVIR was saved, but there was an issue sending data to the automation webhook."
        );
        return;
      }

      console.log("✅ Make webhook call succeeded.");

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
    } catch (err: any) {
      console.error("❌ Unexpected error in DVIR handleSubmit:", err);
      setError(
        err?.message || "Something went wrong submitting the DVIR (unexpected error)."
      );
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
        <div className="mb-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-100">
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
          <div className="rounded-2xl border border-green-700/40 bg-black/60 p-4 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">
                SECTION A. VEHICLE / DRIVER INFORMATION
              </h2>
              <span className="text-[10px] text-gray-400 uppercase">
                Required
              </span>
            </div>

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
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  MEDICAL CARD EXPIRATION (MM/DD/YYYY)
                </label>
                <input
                  type="date"
                  value={medicalCardExp}
                  onChange={(e) => setMedicalCardExp(e.target.value)}
                  className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white [color-scheme:dark]"
                />
              </div>

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
          </div>

          {/* SECTION B – Vehicle / Trailer Inspection Checklist */}
          <div className="rounded-2xl border border-green-700/40 bg-black/60 p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">
                SECTION B. VEHICLE / TRAILER INSPECTION CHECKLIST
              </h2>
              <span className="text-[10px] text-gray-400 uppercase">
                P = Pass, F = Fail
              </span>
            </div>
            <p className="text-[11px] text-gray-300">
              Check each vehicle/trailer component and mark &quot;P&quot; for passes
              inspection or &quot;F&quot; for fails inspection. Note components that don&apos;t
              pass and describe the deficiency in the Notes section.
            </p>

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
          </div>

          {/* Photos (Camera Capture) */}
          <div className="rounded-2xl border border-green-700/40 bg-black/50 p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-white">
                Photos (Camera Capture)
              </h2>
              <span className="text-[10px] text-gray-400 uppercase">
                Oil dipstick photo required
              </span>
            </div>

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

            <div className="space-y-3">
              {/* Required oil dipstick */}
              <button
                type="button"
                onClick={() => oilInputRef.current?.click()}
                className="w-full inline-flex items-center justify-between rounded-lg border border-green-600/50 bg-black/60 px-3 py-2 text-sm text-green-100"
              >
                <span className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Capture Oil Dipstick Photo *
                </span>
                <span className="text-[10px] text-gray-400">
                  {oilDipstickPhoto ? "Captured" : "Not captured"}
                </span>
              </button>

              {/* Optional photos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => tireInputRef.current?.click()}
                  className="inline-flex items-center justify-between rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs text-gray-100"
                >
                  <span className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Tire Tread (optional)
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {extraPhotos.tire ? "Captured" : "Not captured"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => coolantInputRef.current?.click()}
                  className="inline-flex items-center justify-between rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs text-gray-100"
                >
                  <span className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Coolant Level (optional)
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {extraPhotos.coolant ? "Captured" : "Not captured"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => damageInputRef.current?.click()}
                  className="inline-flex items-center justify-between rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs text-gray-100"
                >
                  <span className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Vehicle Damage (optional)
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {extraPhotos.damage ? "Captured" : "Not captured"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => mileageInputRef.current?.click()}
                  className="inline-flex items-center justify-between rounded-lg border border-gray-700 bg-black/50 px-3 py-2 text-xs text-gray-100"
                >
                  <span className="flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Detail-clean Truck Photo (optional)
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {extraPhotos.mileage ? "Captured" : "Not captured"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* NOTES */}
          <div className="rounded-2xl border border-green-700/40 bg-black/60 p-4 space-y-3">
            <h2 className="text-base font-semibold text-white">NOTES</h2>
            <p className="text-[11px] text-gray-300 mb-1">
              Describe in detail any deficiencies found during inspection.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
            />
          </div>

          {/* Aerial Lift Section */}
          <div className="rounded-2xl border border-green-700/40 bg-black/60 p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-white">
                Aerial Lift Inspection (If Equipped)
              </h2>
              <span className="text-[10px] text-gray-400 uppercase">
                P = Pass, F = Fail
              </span>
            </div>
            <p className="text-[11px] text-gray-300">
              This section is to be used for vehicles equipped with aerial lifts.
              Inspect each component and mark &quot;P&quot; for pass and &quot;F&quot; for fail.
            </p>

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
              <label className="block text-xs text-gray-300 mb-1">NOTES</label>
              <textarea
                value={aerialNotes}
                onChange={(e) => setAerialNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {/* Final Sign-off with signature pads */}
          <div className="rounded-2xl border border-green-700/40 bg-black/60 p-4 space-y-4">
            <p className="text-[11px] text-gray-300">
              By signing below, you are agreeing to have completed the Daily
              Vehicle Inspection Report to the best of your ability and reported
              any deficiencies.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SignaturePad
                ref={finalDriverSigRef}
                label="DRIVERS SIGNATURE (draw)"
              />
              <SignaturePad
                ref={generalForemanSigRef}
                label="GENERAL FOREMAN SIGNATURE (draw)"
              />
            </div>
          </div>

          {/* Mechanic Section – now collapsible, with signature pads */}
          <div className="rounded-2xl border border-green-700/40 bg-black/60">
            {/* Header / toggle */}
            <button
              type="button"
              onClick={() => setIsMechanicOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <h2 className="text-base font-semibold text-white">
                  Mechanics Only (Section)
                </h2>
                <p className="text-[11px] text-gray-300">
                  If deficiency noted, MECHANIC is to complete below.
                </p>
              </div>
              <span className="text-xs text-gray-300">
                {isMechanicOpen ? "Hide" : "Show"}
              </span>
            </button>

            {isMechanicOpen && (
              <div className="border-t border-green-700/40 px-4 pb-4 pt-3 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Mechanic Truck Number as dropdown */}
                  <div>
                    <label className="block text-xs text-gray-300 mb-1">
                      Truck Number
                    </label>
                    <select
                      value={mechTruckNumber}
                      onChange={(e) => setMechTruckNumber(e.target.value)}
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
                      Date (MM/DD/YYYY)
                    </label>
                    <input
                      value={mechanicDate}
                      onChange={(e) => setMechanicDate(e.target.value)}
                      placeholder="MM/DD/YYYY"
                      className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1">
                    Noted Deficiency Corrected
                  </label>
                  <input
                    value={deficiencyCorrected}
                    onChange={(e) =>
                      setDeficiencyCorrected(e.target.value)
                    }
                    className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 mb-1">
                    Remarks by Mechanic
                  </label>
                  <textarea
                    value={mechanicRemarks}
                    onChange={(e) => setMechanicRemarks(e.target.value)}
                    rows={2}
                    className="w-full rounded-md bg-black/70 border border-gray-700 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SignaturePad
                    ref={mechanicSigRef}
                    label="MECHANIC SIGNATURE (draw)"
                  />
                  <SignaturePad
                    ref={driverApprovalSigRef}
                    label="DRIVER APPROVAL SIGNATURE (draw)"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-green-600 hover:bg-green-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Submit DVIR"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
