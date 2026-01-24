// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type ChecklistValue = "" | "P" | "F" | "N/A";

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface DVIRReport {
  id: string;
  created_at: string;
  user_id: string | null;
  truck_number: string | null;
  mileage: number | null;
  drivers_name: string | null;
  chipper_number: string | null;
  trailer_number: string | null;
  notes: string | null;
  vehicle_trailer_checklist: Record<string, ChecklistValue> | null;
  aerial_checklist: Record<string, ChecklistValue> | null;
  mechanic_truck_number: string | null;
  mechanic_date: string | null;
  deficiency_corrected: string | null;
  mechanic_remarks: string | null;
  oil_dipstick_path: string;
  tire_photo_path: string | null;
  coolant_photo_path: string | null;
  damage_photo_path: string | null;
  detail_clean_truck_photo_path: string | null;
  final_driver_signature: string | null;
  general_foreman_signature: string | null;
  mechanic_signature: string | null;
  driver_approval_signature: string | null;
}

export interface EquipmentInspection {
  id: string;
  created_at: string;
  submitted_by: string | null;
  equipment_type: string;
  equipment_number: string;
  inspection_date: string;
  template: string | null;
  notes: string | null;
  general_checklist: Record<string, ChecklistValue> | null;
  specific_checklist: Record<string, ChecklistValue> | null;
  overview_photo_path: string | null;
  damage_photo_path: string | null;
  attachments_photo_path: string | null;
  hydraulic_photo_path: string | null;
  mechanic_fixes: string | null;
  last_mechanic_updated_at: string | null;
}

// =============================================================================
// CHECKLIST DEFINITIONS
// =============================================================================

export const VEHICLE_TRAILER_ITEMS: ChecklistItem[] = [
  { id: "air_compressor", label: "Air Compressor" },
  { id: "air_line", label: "Air Line" },
  { id: "batteries", label: "Batteries" },
  { id: "service_brakes", label: "Service Brakes" },
  { id: "parking_brakes", label: "Parking Brakes" },
  { id: "clutch", label: "Clutch" },
  { id: "defroster", label: "Defroster" },
  { id: "engine", label: "Engine" },
  { id: "horn", label: "Horn" },
  { id: "head_lights", label: "Head Lights" },
  { id: "taillights", label: "Taillights" },
  { id: "brake_lights", label: "Brake Lights" },
  { id: "turn_indicators", label: "Turn Indicators" },
  { id: "mirrors", label: "Mirrors" },
  { id: "oil_pressure", label: "Oil Pressure" },
  { id: "radiator", label: "Radiator" },
  { id: "steering", label: "Steering" },
  { id: "tires", label: "Tires" },
  { id: "wheels", label: "Wheels" },
  { id: "windows", label: "Windows" },
  { id: "windshield_wipers", label: "Windshield Wipers" },
];

export const AERIAL_LIFT_ITEMS: ChecklistItem[] = [
  { id: "hydraulic_oil_level", label: "Oil Level in Hydraulic Reservoir" },
  { id: "hydraulic_system_leaks", label: "Hydraulic System free of Leaks" },
  { id: "fasteners_tight", label: "Fasteners at Proper Tightness" },
  { id: "booms_no_cracks", label: "Booms free of Cracks and Damage" },
  { id: "boom_functions_working", label: "All Boom Functions Working" },
  { id: "grease_fittings_recent", label: "Grease Fittings greased (5 days)" },
];

export const GENERAL_EQUIPMENT_ITEMS: ChecklistItem[] = [
  { id: "engine_oil_level", label: "Engine oil level" },
  { id: "engine_coolant_level", label: "Engine coolant level" },
  { id: "hydraulic_fluid_level", label: "Hydraulic fluid level" },
  { id: "steering_systems", label: "Steering systems" },
  { id: "lights_signals", label: "Lights & warning signals" },
  { id: "brakes", label: "Brakes" },
  { id: "fire_extinguisher", label: "Fire extinguisher" },
  { id: "emergency_kill", label: "Emergency kill switch" },
];

export const SPECIFIC_ITEMS: Record<string, ChecklistItem[]> = {
  sky_trim: [
    { id: "tires", label: "Tires" },
    { id: "lift_arms", label: "Lift arms / booms" },
    { id: "outriggers_stabilizers", label: "Outriggers / stabilizers" },
    { id: "system_function", label: "System function test" },
  ],
  geo_boy: [
    { id: "tracks_tires", label: "Tracks / tires" },
    { id: "teeth", label: "Teeth / cutting head" },
    { id: "hydraulic_lines", label: "Hydraulic lines" },
    { id: "system_function", label: "System function test" },
  ],
  skid_steer: [
    { id: "tracks_tires", label: "Tracks / tires" },
    { id: "lift_arms", label: "Lift arms" },
    { id: "attachments", label: "Attachments (mulcher / grapple)" },
    { id: "system_function", label: "System function test" },
  ],
};

export const EQUIPMENT_TYPE_OPTIONS = ["Geo-Boy", "Grapple", "Jarraff", "Mulcher", "Skidsteer"];
