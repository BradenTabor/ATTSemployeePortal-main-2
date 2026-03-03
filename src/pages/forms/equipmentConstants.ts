/**
 * Shared constants and types for Daily Equipment Inspection form and useEquipmentFormValidation.
 * Extracted to avoid circular dependency between form page and validation hook.
 */

import type { LOTOData } from "../../types/electricalHazard";

export type ChecklistValue = "" | "P" | "F" | "N/A";

export interface ChecklistItem {
  id: string;
  label: string;
}

export const GENERAL_ITEMS: ChecklistItem[] = [
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

export const EQUIPMENT_TYPE_OPTIONS = ["Geo-Boy", "Grapple", "Jarraff", "Mulcher", "Skidsteer"] as const;
export type EquipmentTypeOption = (typeof EQUIPMENT_TYPE_OPTIONS)[number];

export const EQUIPMENT_NUMBERS_BY_TYPE: Record<EquipmentTypeOption, string[]> = {
  "Geo-Boy": ["G-126", "G-140", "G-157"],
  Grapple: ["211"],
  Jarraff: ["J-109", "J-119", "J-129", "J-138", "J-152"],
  Mulcher: ["212", "213"],
  Skidsteer: ["118", "135", "136"],
};

export type EquipmentTemplate = "sky_trim" | "geo_boy" | "skid_steer" | "chipper" | "chainsaw" | "";

export interface EquipmentFormState {
  submittedBy: string;
  equipmentType: EquipmentTypeOption | "";
  equipmentNumber: string;
  inspectionDate: string;
  template: EquipmentTemplate;
  notes: string;
  generalChecklist: Record<string, ChecklistValue>;
  specificChecklist: Record<string, ChecklistValue>;
  /** LOTO procedure data when any item is Fail and template is chipper/sky_trim/geo_boy. Matches LOTOSection (LOTOData). */
  lotoData?: LOTOData | null;
}

export type PhotoTypes = "overview" | "damage" | "attachments" | "hydraulic";
export type PhotoState = Partial<Record<PhotoTypes, File>>;

/**
 * Extended form state type for validation that includes photo fields.
 * Used by useEquipmentFormValidation and DailyEquipmentInspectionForm.
 */
export type EquipmentFormFieldKey = keyof EquipmentFormState | "photos" | "hydraulicPhoto";

// ── Equipment-specific checklist groups (Section B) ──

export const SKY_TRIM_ITEMS: ChecklistItem[] = [
  { id: "tires", label: "Tires" },
  { id: "wheels", label: "Wheels / lugs" },
  { id: "steps_handles", label: "Steps / handles" },
  { id: "doors_latches", label: "Doors / latches" },
  { id: "lift_arms", label: "Lift arms / booms" },
  { id: "outriggers_stabilizers", label: "Outriggers / stabilizers" },
  { id: "controls", label: "Controls" },
  { id: "system_function", label: "System function test" },
];

export const GEO_BOY_ITEMS: ChecklistItem[] = [
  { id: "tracks_tires", label: "Tracks / tires" },
  { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
  { id: "safety_flaps", label: "Safety flaps / guards" },
  { id: "teeth", label: "Teeth / cutting head" },
  { id: "hydraulic_lines", label: "Hydraulic lines" },
  { id: "attachments", label: "Attachments secure" },
  { id: "system_function", label: "System function test" },
];

export const SKID_STEER_ITEMS: ChecklistItem[] = [
  { id: "tracks_tires", label: "Tracks / tires" },
  { id: "wheels_rollers", label: "Wheels / rollers / sprockets" },
  { id: "steps_handles", label: "Steps / handles" },
  { id: "doors_latches", label: "Doors / latches" },
  { id: "lift_arms", label: "Lift arms" },
  { id: "attachments", label: "Attachments (mulcher / grapple)" },
  { id: "safety_flaps", label: "Safety flaps / guards" },
  { id: "system_function", label: "System function test" },
];

// ANSI Z133 Section 8 — Chipper
export const CHIPPER_ITEMS: ChecklistItem[] = [
  { id: "infeed_hopper", label: "Infeed hopper condition" },
  { id: "discharge_chute", label: "Discharge chute clear and functional" },
  { id: "feed_control_bar", label: "Feed control bar operational" },
  { id: "chipper_knives", label: "Chipper knives/blades condition and sharpness" },
  { id: "chip_curtain", label: "Chip curtain intact" },
  { id: "emergency_stop", label: "Emergency stop functional (test before use)" },
  { id: "engine_guards", label: "Engine guards in place" },
  { id: "towing_hitch", label: "Towing hitch and safety chains" },
  { id: "debris_screen", label: "Debris screen intact" },
  { id: "safety_decals", label: "All safety decals legible" },
];

// 29 CFR 1910.266, ANSI Z133 Section 7 — Chainsaw
export const CHAINSAW_ITEMS: ChecklistItem[] = [
  { id: "chain_tension", label: "Chain tension correct" },
  { id: "chain_brake", label: "Chain brake functional (test)" },
  { id: "throttle_lockout", label: "Throttle trigger lockout functional" },
  { id: "muffler", label: "Muffler condition" },
  { id: "anti_vibration", label: "Anti-vibration mounts condition" },
  { id: "guide_bar", label: "Guide bar condition and wear" },
  { id: "chain_sharpness", label: "Chain sharpness" },
  { id: "bar_oil", label: "Bar oil level" },
  { id: "fuel_system", label: "Fuel system — no leaks" },
  { id: "spark_arrestor", label: "Spark arrestor condition" },
  { id: "handle_grip", label: "Handle condition and grip" },
];

export function getSpecificItems(template: EquipmentTemplate): ChecklistItem[] {
  switch (template) {
    case "sky_trim":
      return SKY_TRIM_ITEMS;
    case "geo_boy":
      return GEO_BOY_ITEMS;
    case "skid_steer":
      return SKID_STEER_ITEMS;
    case "chipper":
      return CHIPPER_ITEMS;
    case "chainsaw":
      return CHAINSAW_ITEMS;
    default:
      return [];
  }
}

export const PHOTO_DEFINITIONS: Array<{
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

export const REQUIRED_PHOTO_KEYS = PHOTO_DEFINITIONS.filter((photo) => photo.required).map(
  (photo) => photo.key
);

export const PHOTO_KEYS_ORDER = PHOTO_DEFINITIONS.map((photo) => photo.key);

export const EQUIPMENT_PHOTO_BUCKET = "equipment-inspection-photos";

export function getTodayChicagoDate(): string {
  const now = new Date();
  const chicagoDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const year = chicagoDate.getFullYear();
  const month = String(chicagoDate.getMonth() + 1).padStart(2, '0');
  const day = String(chicagoDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const calcPercentage = (current: number, total: number) =>
  total === 0 ? 0 : Math.round((current / total) * 100);

export function createInitialEquipmentFormState(): EquipmentFormState {
  return {
    submittedBy: "",
    equipmentType: "",
    equipmentNumber: "",
    inspectionDate: getTodayChicagoDate(),
    template: "",
    notes: "",
    generalChecklist: {},
    specificChecklist: {},
    lotoData: null,
  };
}

export function normalizeFormStateFromDraft(raw: EquipmentFormState): EquipmentFormState {
  const loto = raw.lotoData;
  if (loto == null) return raw;
  const asAny = loto as unknown as Record<string, unknown>;
  if (typeof asAny.procedure_followed === "boolean") return raw;
  const defaultDatetime = new Date().toISOString().slice(0, 16);
  return {
    ...raw,
    lotoData: {
      procedure_followed: false,
      lockout_device_applied: false,
      tagout_attached: false,
      zero_energy_verified: false,
      authorized_employee: typeof asAny.applied_by === "string" ? asAny.applied_by : "",
      lockout_datetime: typeof asAny.applied_at === "string" ? asAny.applied_at : defaultDatetime,
    },
  };
}
