/**
 * Shared constants and types for Daily Equipment Inspection form and useEquipmentFormValidation.
 * Extracted to avoid circular dependency between form page and validation hook.
 */

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

export type EquipmentTemplate = "sky_trim" | "geo_boy" | "skid_steer" | "";

export interface EquipmentFormState {
  submittedBy: string;
  equipmentType: EquipmentTypeOption | "";
  equipmentNumber: string;
  inspectionDate: string;
  template: EquipmentTemplate;
  notes: string;
  generalChecklist: Record<string, ChecklistValue>;
  specificChecklist: Record<string, ChecklistValue>;
}

export type PhotoTypes = "overview" | "damage" | "attachments" | "hydraulic";
export type PhotoState = Partial<Record<PhotoTypes, File>>;

/**
 * Extended form state type for validation that includes photo fields.
 * Used by useEquipmentFormValidation and DailyEquipmentInspectionForm.
 */
export type EquipmentFormFieldKey = keyof EquipmentFormState | "photos" | "hydraulicPhoto";
