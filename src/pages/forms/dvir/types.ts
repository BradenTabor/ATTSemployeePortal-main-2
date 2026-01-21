/**
 * DVIR Form Types and Constants
 * 
 * Type definitions, checklist items, and dropdown options for the DVIR form.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ExtraPhotos = {
  tire?: File;
  coolant?: File;
  damage?: File;
  mileage?: File; // used for Detail-clean Truck Photo
};

export type ChecklistValue = "" | "P" | "F";

export interface ChecklistItem {
  id: string;
  label: string;
}

/** Consolidated form state for persistence (excludes files/signatures which can't be serialized) */
export interface DVIRFormState {
  // Section A – Vehicle / Driver info
  truckNumber: string;
  mileage: string;
  chipperNumber: string;
  trailerNumber: string;
  truckGvwr: string;
  trailerChipperGvwr: string;
  medicalCardRequired: "" | "YES" | "NO";
  driversName: string;
  driversLicenseNumber: string;
  driversLicenseClass: string;
  driversLicenseExp: string;
  driversLicenseRequired: "" | "YES" | "NO";
  hasMedicalCard: "" | "YES" | "NO";
  medicalCardExp: string;
  copyOfRegistration: "" | "YES" | "NO";
  copyOfInsurance: "" | "YES" | "NO";
  driversSignatureSectionA: string;
  // Section B – Checklists
  vehicleTrailerChecklist: Record<string, ChecklistValue>;
  notes: string;
  aerialChecklist: Record<string, ChecklistValue>;
  aerialNotes: string;
  // Mechanic section
  mechTruckNumber: string;
  deficiencyCorrected: string;
  mechanicRemarks: string;
  mechanicDate: string;
  isMechanicOpen: boolean;
}

// =============================================================================
// INITIAL STATE FACTORY
// =============================================================================

export const createInitialDVIRFormState = (): DVIRFormState => ({
  truckNumber: "",
  mileage: "",
  chipperNumber: "",
  trailerNumber: "",
  truckGvwr: "",
  trailerChipperGvwr: "",
  medicalCardRequired: "",
  driversName: "",
  driversLicenseNumber: "",
  driversLicenseClass: "",
  driversLicenseExp: "",
  driversLicenseRequired: "",
  hasMedicalCard: "",
  medicalCardExp: "",
  copyOfRegistration: "",
  copyOfInsurance: "",
  driversSignatureSectionA: "",
  vehicleTrailerChecklist: {},
  notes: "",
  aerialChecklist: {},
  aerialNotes: "",
  mechTruckNumber: "",
  deficiencyCorrected: "",
  mechanicRemarks: "",
  mechanicDate: "",
  isMechanicOpen: false,
});

// =============================================================================
// DROPDOWN OPTIONS
// =============================================================================

/** Fixed truck number list for dropdowns */
export const TRUCK_NUMBERS = [
  "B132",
  "B103",
  "B114",
  "B122",
  "B124",
  "B137",
  "B151",
  "158",
  "149",
  "147",
  "104",
  "155",
  "139",
  "141",
  "125",
  "143",
];

/** Trailer numbers dropdown list */
export const TRAILER_NUMBERS = [
  "148-TEXAS ",
  "150-LAMAR",
  "153-TRACTOR SUPPLY",
  "154-Load Trail",
];

/** Chipper numbers dropdown list */
export const CHIPPER_NUMBERS = [
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

// =============================================================================
// CHECKLIST DEFINITIONS
// =============================================================================

/** SECTION B – Vehicle / Trailer checklist (from DVIR PDF) */
export const VEHICLE_TRAILER_ITEMS: ChecklistItem[] = [
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

/** Aerial lift checklist (bottom section of PDF) */
export const AERIAL_LIFT_ITEMS: ChecklistItem[] = [
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
