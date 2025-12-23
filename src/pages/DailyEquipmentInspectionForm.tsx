import {
  useState,
  useRef,
  useEffect,
  FormEvent,
  useCallback,
  MutableRefObject,
  useMemo,
} from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Camera } from "lucide-react";
import { logger } from "../lib/logger";
import { DateField } from "../components/forms/GlassyPickers";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../contexts/AuthContext";

type ChecklistValue = "" | "P" | "F";

interface ChecklistItem {
  id: string;
  label: string;
}

// General checklist items (Section A)
const GENERAL_ITEMS: ChecklistItem[] = [
  { id: "engine_oil_level", label: "Engine oil level" },
  { id: "engine_coolant_level", label: "Engine coolant level" },
  { id: "hydraulic_fluid_level", label: "Hydraulic fluid level" },
  { id: "engine_bay_debris", label: "Engine bay clear of debris" },
  { id: "windshield", label: "Windshield" },
  { id: "seat", label: "Seat" },
  { id: "steering_systems", label: "Steering systems" },
  { id: "lights_signals", label: "Lights & warning signals" },
  { id: "housekeeping", label: "Housekeeping / cab cleanliness" },
  { id: "muffler", label: "Muffler" },
  { id: "seat_belts", label: "Seat belts" },
  { id: "mirrors_cameras", label: "Mirrors / backup cameras" },
  { id: "backup_beepers", label: "Backup beepers" },
  { id: "battery_cables", label: "Battery cables secure" },
  { id: "wipers", label: "Windshield wipers" },
  { id: "brakes", label: "Brakes" },
  { id: "fire_extinguisher", label: "Fire extinguisher" },
  { id: "first_aid_kit", label: "First aid kit" },
  { id: "emergency_kill", label: "Emergency kill switch" },
  { id: "grease", label: "Grease (within last 8 hours)" },
];

// Specific equipment checklist groups (Section B)
const SKY_TRIM_ITEMS: ChecklistItem[] = [
  { id: "tires", label: "Tires" },
  { id: "wheels", label: "Wheels / lugs" },
  { id: "steps_handles", label: "Steps / handles" },
  { id: "doors_latches", label: "Doors / latches" },
  { id: "lift_arms", label: "Lift arms / booms" },
  { id: "outriggers_stabilizers", label: "Outriggers / stabilizers" },
  { id: "controls", label: "Controls" },
  { id: "system_function", label: "System function test" },
];

const GEO_BOY_ITEMS: ChecklistItem[] = [
  { id: "tracks_tires", label: "Tracks / tires" },
  { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
  { id: "safety_flaps", label: "Safety flaps / guards" },
  { id: "teeth", label: "Teeth / cutting head" },
  { id: "hydraulic_lines", label: "Hydraulic lines" },
  { id: "attachments", label: "Attachments secure" },
  { id: "system_function", label: "System function test" },
];

const SKID_STEER_ITEMS: ChecklistItem[] = [
  { id: "tracks_tires", label: "Tracks / tires" },
  { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
  { id: "steps_handles", label: "Steps / handles" },
  { id: "doors_latches", label: "Doors / latches" },
  { id: "lift_arms", label: "Lift arms" },
  { id: "attachments", label: "Attachments (mulcher / grapple)" },
  { id: "safety_flaps", label: "Safety flaps / guards" },
  { id: "system_function", label: "System function test" },
];

type EquipmentTemplate = "sky_trim" | "geo_boy" | "skid_steer" | "";

function getSpecificItems(template: EquipmentTemplate): ChecklistItem[] {
  switch (template) {
    case "sky_trim":
      return SKY_TRIM_ITEMS;
    case "geo_boy":
      return GEO_BOY_ITEMS;
    case "skid_steer":
      return SKID_STEER_ITEMS;
    default:
      return [];
  }
}

type PhotoTypes = "overview" | "damage" | "attachments" | "hydraulic";

type PhotoState = Partial<Record<PhotoTypes, File>>;

const BUCKET_NAME = "equipment-inspection-photos";

const PHOTO_DEFINITIONS: Array<{
  key: PhotoTypes;
  label: string;
  description?: string;
  required?: boolean;
}> = [
  {
    key: "overview",
    label: "Equipment Overview",
    description: "Capture a wide photo of the machine.",
  },
  {
    key: "damage",
    label: "Damage / Wear",
    description: "Highlight any defects or wear areas.",
  },
  {
    key: "attachments",
    label: "Attachments / Teeth",
    description: "Mulcher head, grapple, or accessories.",
  },
  {
    key: "hydraulic",
    label: "Hydraulic Fluid Level",
    description: "Required for compliance",
    required: true,
  },
];

const REQUIRED_PHOTO_KEYS = PHOTO_DEFINITIONS.filter((photo) => photo.required).map(
  (photo) => photo.key
);

const PHOTO_KEYS_ORDER = PHOTO_DEFINITIONS.map((photo) => photo.key);

const calcPercentage = (current: number, total: number) =>
  total === 0 ? 0 : Math.round((current / total) * 100);

const EQUIPMENT_TYPE_OPTIONS = ["Geo-Boy", "Grapple", "Jarraff", "Mulcher", "Skidsteer"] as const;
type EquipmentTypeOption = (typeof EQUIPMENT_TYPE_OPTIONS)[number];

const EQUIPMENT_NUMBERS_BY_TYPE: Record<EquipmentTypeOption, string[]> = {
  "Geo-Boy": ["G-126", "G-140", "G-157"],
  Grapple: ["211"],
  Jarraff: ["J-109", "J-119", "J-129", "J-138", "J-152"],
  Mulcher: ["212", "213"],
  Skidsteer: ["118", "135", "136"],
};

export default function DailyEquipmentInspectionForm() {
  const { user } = useAuth();
  const [submittedBy, setSubmittedBy] = useState("");
  const [equipmentType, setEquipmentType] = useState<EquipmentTypeOption | "">("");
  const [equipmentNumber, setEquipmentNumber] = useState("");
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [template, setTemplate] = useState<EquipmentTemplate>("");

  const [notes, setNotes] = useState("");
  const [generalChecklist, setGeneralChecklist] = useState<
    Record<string, ChecklistValue>
  >({});
  const [specificChecklist, setSpecificChecklist] = useState<
    Record<string, ChecklistValue>
  >({});

  const [photos, setPhotos] = useState<PhotoState>({});
  const overviewRef = useRef<HTMLInputElement | null>(null);
  const damageRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<HTMLInputElement | null>(null);
  const hydraulicRef = useRef<HTMLInputElement | null>(null);
  const photoRefs: Record<PhotoTypes, MutableRefObject<HTMLInputElement | null>> = {
    overview: overviewRef,
    damage: damageRef,
    attachments: attachmentsRef,
    hydraulic: hydraulicRef,
  };
  const submitterPrefilledRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleChecklistChange(
    type: "general" | "specific",
    id: string,
    value: ChecklistValue
  ) {
    if (type === "general") {
      setGeneralChecklist((prev) => ({ ...prev, [id]: value }));
    } else {
      setSpecificChecklist((prev) => ({ ...prev, [id]: value }));
    }
  }

  function handlePhotoChange(kind: PhotoTypes, file?: File) {
    setPhotos((prev) => {
      const next = { ...prev };
      if (file) {
        next[kind] = file;
      } else {
        delete next[kind];
      }
      return next;
    });
  }

  const uploadPhoto = useCallback(
    async (file: File, kind: PhotoTypes) => {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeEquipment = equipmentNumber.trim().replace(/\s+/g, "-").toLowerCase() || "equipment";
      const safeUserBucket = user?.id ?? "anonymous";
      const safeDate = inspectionDate || new Date().toISOString().slice(0, 10);
      const uniqueId =
        typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const objectPath = `${safeUserBucket}/${safeDate}/${kind}-${safeEquipment}-${uniqueId}.${extension}`;

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(objectPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });

      if (error) {
        throw error;
      }

      return objectPath;
    },
    [equipmentNumber, inspectionDate, user?.id]
  );

  const handleEquipmentTypeSelect = (value: EquipmentTypeOption | "") => {
    setEquipmentType(value);
    setEquipmentNumber("");
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const submitterName = submittedBy.trim();
    if (!submitterName) {
      setError("Submitted By is required.");
      return;
    }

    if (!equipmentType) {
      setError("Select an equipment type.");
      return;
    }

    const trimmedNumber = equipmentNumber.trim();
    if (!trimmedNumber || !availableEquipmentNumbers.includes(trimmedNumber)) {
      setError("Select a valid equipment number for the chosen type.");
      return;
    }

    if (!user?.id) {
      setError("You must be signed in to submit an inspection.");
      return;
    }

    const missingRequired = REQUIRED_PHOTO_KEYS.filter((key) => !photos[key]);
    if (missingRequired.length > 0) {
      setError("Hydraulic fluid level photo is required before submitting.");
      return;
    }

    setSubmitting(true);

    const uploadedPaths: string[] = [];
    const photoPathMap: Partial<Record<PhotoTypes, string>> = {};

    try {
      for (const key of PHOTO_KEYS_ORDER) {
        const file = photos[key];
        if (!file) continue;
        const objectPath = await uploadPhoto(file, key);
        photoPathMap[key] = objectPath;
        uploadedPaths.push(objectPath);
      }

      const payload = {
        user_id: user.id,
        submitted_by: submitterName,
        equipment_type: equipmentType,
        equipment_number: trimmedNumber,
        inspection_date: inspectionDate,
        template: template || null,
        notes: notes.trim() ? notes.trim() : null,
        general_checklist: generalChecklist,
        specific_checklist: specificChecklist,
        overview_photo_path: photoPathMap.overview ?? null,
        damage_photo_path: photoPathMap.damage ?? null,
        attachments_photo_path: photoPathMap.attachments ?? null,
        hydraulic_photo_path: photoPathMap.hydraulic ?? null,
      };

      const { error: insertError } = await supabase
        .from("daily_equipment_inspections")
        .insert(payload);

      if (insertError) {
        throw insertError;
      }

      setSuccess("Daily equipment inspection submitted.");
      setSubmittedBy(defaultSubmitterName);
      setEquipmentType("");
      setEquipmentNumber("");
      setTemplate("");
      setGeneralChecklist({});
      setSpecificChecklist({});
      setPhotos({});
      setNotes("");
    } catch (err: unknown) {
      logger.error("Failed to submit daily equipment inspection:", err);
      if (uploadedPaths.length) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      }
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong submitting the inspection."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const specificItems = useMemo(() => getSpecificItems(template), [template]);

  const generalCompleteCount = useMemo(
    () =>
      Object.values(generalChecklist).filter((value) => value === "P" || value === "F")
        .length,
    [generalChecklist]
  );

  const specificCompleteCount = useMemo(
    () =>
      specificItems.reduce((count, item) => {
        const value = specificChecklist[item.id];
        return count + (value === "P" || value === "F" ? 1 : 0);
      }, 0),
    [specificChecklist, specificItems]
  );

  const photoProgress = useMemo(() => {
    const captured = PHOTO_KEYS_ORDER.filter((key) => Boolean(photos[key])).length;
    const requiredCaptured = REQUIRED_PHOTO_KEYS.filter((key) => Boolean(photos[key])).length;
    return {
      total: PHOTO_KEYS_ORDER.length,
      captured,
      requiredCaptured,
    };
  }, [photos]);

  const heroStats = useMemo(
    () => [
      {
        label: "General Items",
        value: `${generalCompleteCount}/${GENERAL_ITEMS.length}`,
        hint: `${calcPercentage(generalCompleteCount, GENERAL_ITEMS.length)}% logged`,
      },
      {
        label: "Specific Items",
        value: `${specificCompleteCount}/${specificItems.length || 0}`,
        hint:
          specificItems.length === 0
            ? "Select template"
            : `${calcPercentage(specificCompleteCount, specificItems.length)}% logged`,
      },
      {
        label: "Photos Captured",
        value: `${photoProgress.captured}/${photoProgress.total}`,
        hint: `${photoProgress.requiredCaptured}/${REQUIRED_PHOTO_KEYS.length} required`,
      },
    ],
    [
      generalCompleteCount,
      specificCompleteCount,
      specificItems.length,
      photoProgress.captured,
      photoProgress.total,
      photoProgress.requiredCaptured,
    ]
  );

  const requiredPhotosComplete = REQUIRED_PHOTO_KEYS.every((key) => Boolean(photos[key]));
  const generalPercent = calcPercentage(generalCompleteCount, GENERAL_ITEMS.length);
  const specificPercent = calcPercentage(specificCompleteCount, specificItems.length || 0);
  const photoPercent = calcPercentage(photoProgress.captured, photoProgress.total);
  const defaultSubmitterName = useMemo(() => {
    const meta = user?.user_metadata ?? {};
    const nameCandidates = [
      (meta.full_name as string | undefined)?.trim(),
      (meta.fullName as string | undefined)?.trim(),
      (meta.name as string | undefined)?.trim(),
      user?.email?.split("@")[0],
    ];
    return nameCandidates.find((value) => value && value.length > 0) || "";
  }, [user]);

  useEffect(() => {
    if (!submitterPrefilledRef.current && defaultSubmitterName) {
      setSubmittedBy(defaultSubmitterName);
      submitterPrefilledRef.current = true;
    }
  }, [defaultSubmitterName]);

  const availableEquipmentNumbers = useMemo(
    () => (equipmentType ? EQUIPMENT_NUMBERS_BY_TYPE[equipmentType] ?? [] : []),
    [equipmentType]
  );

  return (
    <DashboardLayout title="Daily Equipment Inspection">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-10 space-y-4 sm:space-y-5">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a2218] via-[#031510] to-[#010407] p-4 sm:p-5 shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -right-6 h-48 w-48 bg-emerald-500/15 blur-[100px]" />
          </div>
          <div className="relative space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-2">
                <p className="text-[9px] tracking-[0.4em] uppercase text-emerald-200/80">
                  Safety First
                </p>
                <h1 className="text-lg sm:text-xl font-semibold text-white">
                  Daily Equipment Inspection
                </h1>
                <p className="text-xs text-white/70 hidden sm:block max-w-xl">
                  Capture condition, checklist outcomes, and photo evidence before each shift.
                </p>
              </div>
              <div className="hidden lg:block min-w-[180px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-[10px] text-white/75">
                <p className="text-[9px] uppercase tracking-[0.3em] text-emerald-200 mb-2">Tips</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Good lighting helps review</li>
                  <li>Capture today's attachments</li>
                </ul>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {heroStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-white"
                >
                  <p className="text-[9px] uppercase tracking-[0.25em] text-white/60 truncate">
                    {stat.label}
                  </p>
                  <p className="text-lg sm:text-xl font-semibold mt-1">{stat.value}</p>
                  <p className="text-[10px] text-white/60 truncate">{stat.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          {/* Card: Equipment Info */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#07140f] via-[#050a0f] to-[#020205] p-4 sm:p-5 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                  Step 1 · Equipment
                </p>
                <h2 className="text-sm sm:text-base font-semibold text-white">Equipment Info</h2>
              </div>
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[9px] text-white/70">
                Required
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1">
                  Submitted By *
                </label>
                <input
                  value={submittedBy}
                  onChange={(e) => setSubmittedBy(e.target.value)}
                  placeholder="Operator name"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1">
                  Type *
                </label>
                <select
                  value={equipmentType}
                  onChange={(e) => handleEquipmentTypeSelect(e.target.value as EquipmentTypeOption | "")}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                >
                  <option value="">Select type</option>
                  {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1">
                  Number *
                </label>
                <select
                  value={equipmentNumber}
                  onChange={(e) => setEquipmentNumber(e.target.value)}
                  disabled={!equipmentType}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60 disabled:opacity-40"
                >
                  <option value="">{equipmentType ? "Select #" : "Type first"}</option>
                  {availableEquipmentNumbers.map((number) => (
                    <option key={number} value={number}>{number}</option>
                  ))}
                </select>
              </div>

              <DateField
                label="Date"
                value={inspectionDate}
                onValueChange={setInspectionDate}
                helperText="Today"
                containerClassName="text-white"
                labelClassName="text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1"
                className="rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder:text-white/40 focus:ring-emerald-400/60 focus:border-emerald-400/60"
              />

              <div>
                <label className="block text-[10px] uppercase tracking-[0.25em] text-white/60 mb-1">
                  Template
                </label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as EquipmentTemplate)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                >
                  <option value="">Select</option>
                  <option value="sky_trim">Sky Trim/Jarraff</option>
                  <option value="geo_boy">Geo Boy</option>
                  <option value="skid_steer">Skid Steer</option>
                </select>
              </div>
            </div>
          </section>

          {/* Card: General Checklist */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#050b0f] via-[#04080c] to-[#010205] p-4 sm:p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                  Step 2 · General
                </p>
                <h2 className="text-sm sm:text-base font-semibold text-white">General Checklist</h2>
              </div>
              <div className="text-right text-[10px] text-white/60">
                <p>{generalCompleteCount}/{GENERAL_ITEMS.length}</p>
                <p>{generalPercent}%</p>
              </div>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-200 transition-all"
                style={{ width: `${generalPercent}%` }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              {GENERAL_ITEMS.map((item) => {
                const value = generalChecklist[item.id] || "";
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                  >
                    <span className="text-xs text-white/80 truncate">{item.label}</span>
                    <div className="inline-flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleChecklistChange("general", item.id, "P")}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
                          value === "P"
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChecklistChange("general", item.id, "F")}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
                          value === "F"
                            ? "border-rose-400 bg-rose-500/20 text-rose-100"
                            : "border-white/10 bg-white/5 text-white/60"
                        }`}
                      >
                        Fail
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Card: Specific Equipment Checklist */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#050b11] via-[#04070b] to-[#010204] p-4 sm:p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                  Step 3 · Specific
                </p>
                <h2 className="text-sm sm:text-base font-semibold text-white">Equipment Specific</h2>
              </div>
              <div className="text-right text-[10px] text-white/60">
                <p>{specificCompleteCount}/{specificItems.length || 0}</p>
                <p>{specificItems.length === 0 ? "Select template" : `${specificPercent}%`}</p>
              </div>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-200 transition-all"
                style={{ width: `${specificItems.length === 0 ? 0 : specificPercent}%` }}
              />
            </div>

            {specificItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-3 py-4 text-xs text-white/60 text-center">
                Select template above to load items
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                {specificItems.map((item) => {
                  const value = specificChecklist[item.id] || "";
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
                    >
                      <span className="text-xs text-white/80 truncate">{item.label}</span>
                      <div className="inline-flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleChecklistChange("specific", item.id, "P")}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
                            value === "P"
                              ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                              : "border-white/10 bg-white/5 text-white/60"
                          }`}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChecklistChange("specific", item.id, "F")}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition touch-manipulation ${
                            value === "F"
                              ? "border-rose-400 bg-rose-500/20 text-rose-100"
                              : "border-white/10 bg-white/5 text-white/60"
                          }`}
                        >
                          Fail
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Card: Photos (Camera Capture) */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#051313] via-[#040909] to-[#020405] p-4 sm:p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                  Step 4 · Photos
                </p>
                <h2 className="text-sm sm:text-base font-semibold text-white">Photo Evidence</h2>
              </div>
              <div className="text-right text-[10px] text-white/60">
                <p>{photoProgress.captured}/{photoProgress.total}</p>
                <p>{photoProgress.requiredCaptured}/{REQUIRED_PHOTO_KEYS.length} req</p>
              </div>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-200 transition-all"
                style={{ width: `${photoPercent}%` }}
              />
            </div>

            {PHOTO_DEFINITIONS.map((photo) => (
              <input
                key={`${photo.key}-input`}
                ref={(node) => {
                  photoRefs[photo.key].current = node;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  handlePhotoChange(photo.key, file);
                }}
              />
            ))}

            <div className="grid grid-cols-2 gap-2">
              {PHOTO_DEFINITIONS.map((photo) => {
                const captured = Boolean(photos[photo.key]);
                return (
                  <button
                    key={photo.key}
                    type="button"
                    onClick={() => photoRefs[photo.key].current?.click()}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-emerald-400/40 touch-manipulation"
                  >
                    <span className="inline-flex items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-1.5 text-emerald-200 flex-shrink-0">
                      <Camera className="w-3.5 h-3.5" />
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold text-white truncate">
                        {photo.label}
                        {photo.required && <span className="text-rose-300 ml-1">*</span>}
                      </span>
                      <span
                        className={`text-[9px] font-medium ${
                          captured
                            ? "text-emerald-300"
                            : photo.required
                            ? "text-rose-300/80"
                            : "text-white/40"
                        }`}
                      >
                        {captured ? "✓ Done" : photo.required ? "Required" : "Optional"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Card: Notes & Submit Combined */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#070f12] via-[#05080a] to-[#020305] p-4 sm:p-5 space-y-3 shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <div>
              <p className="text-[9px] tracking-[0.3em] uppercase text-emerald-200/70">
                Optional
              </p>
              <h2 className="text-sm sm:text-base font-semibold text-white">Notes</h2>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
              placeholder="Describe deficiencies, damage, or follow-ups..."
            />
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[10px] text-white/60 pt-1">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${requiredPhotosComplete ? "bg-emerald-300" : "bg-rose-300"}`} />
                <span>{requiredPhotosComplete ? "Photos complete" : "Hydraulic photo needed"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span>{generalCompleteCount + specificCompleteCount > 0 ? "Progress saved" : "Complete checklist"}</span>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:shadow-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
            >
              {submitting ? "Submitting..." : "Submit Inspection"}
            </button>
          </section>
        </form>
      </div>
    </DashboardLayout>
  );
}
