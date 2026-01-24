/**
 * Equipment Inspection Test Data Factory
 * 
 * Creates valid and invalid equipment inspection test data
 * for unit and integration tests.
 */

export type EquipmentType = 'Geo-Boy' | 'Grapple' | 'Jarraff' | 'Mulcher' | 'Skidsteer';

export type ChecklistValue = '' | 'P' | 'F' | 'N/A';

export interface EquipmentTestData {
  // Required fields
  equipment_type: EquipmentType | string;
  equipment_number: string;
  hydraulic_photo_path: string;
  submitted_by: string;
  inspection_date: string;
  
  // Optional fields
  user_id?: string;
  template?: string | null;
  notes?: string | null;
  
  // Checklists (JSONB)
  general_checklist?: Record<string, ChecklistValue> | null;
  specific_checklist?: Record<string, ChecklistValue> | null;
  
  // Photo paths
  overview_photo_path?: string | null;
  damage_photo_path?: string | null;
  attachments_photo_path?: string | null;
  
  // Mechanic fields
  mechanic_fixes?: string | null;
  last_mechanic_updated_at?: string | null;
  mechanic_cost?: number | null;
  mechanic_parts_used?: Array<{
    part_name: string;
    quantity: number;
    part_number?: string;
    cost?: number;
  }> | null;
}

/**
 * Equipment numbers by type
 */
export const EQUIPMENT_NUMBERS: Record<EquipmentType, string[]> = {
  'Geo-Boy': ['G-126', 'G-140', 'G-157'],
  'Grapple': ['211'],
  'Jarraff': ['J-109', 'J-119', 'J-129', 'J-138', 'J-152'],
  'Mulcher': ['212', '213'],
  'Skidsteer': ['118', '135', '136'],
};

/**
 * General checklist items (common to all equipment)
 */
export const GENERAL_CHECKLIST_ITEMS = [
  'engine_oil_level',
  'hydraulic_fluid_level',
  'coolant_level',
  'fuel_level',
  'air_filter',
  'belts_hoses',
  'battery',
  'lights',
  'safety_devices',
  'fire_extinguisher',
] as const;

/**
 * Specific checklist items by equipment type
 */
export const SPECIFIC_CHECKLIST_ITEMS: Record<EquipmentType, string[]> = {
  'Geo-Boy': ['mulcher_head', 'boom_controls', 'tracks', 'door_latches', 'cab_glass'],
  'Grapple': ['grapple_arms', 'hydraulic_cylinders', 'rotation_motor', 'teeth_condition'],
  'Jarraff': ['saw_arm', 'saw_blade', 'boom_extension', 'turret_rotation', 'bucket_controls'],
  'Mulcher': ['mulcher_head', 'teeth_condition', 'guards', 'drive_system'],
  'Skidsteer': ['bucket_attachment', 'lift_arms', 'tracks_wheels', 'backup_alarm'],
};

/**
 * Create a valid equipment inspection
 */
export function createValidEquipment(
  type: EquipmentType = 'Jarraff',
  overrides?: Partial<EquipmentTestData>
): EquipmentTestData {
  const today = new Date().toISOString().split('T')[0];
  const number = EQUIPMENT_NUMBERS[type][0];
  
  // Create passing general checklist
  const generalChecklist: Record<string, ChecklistValue> = {};
  GENERAL_CHECKLIST_ITEMS.forEach(item => {
    generalChecklist[item] = 'P';
  });
  
  // Create passing specific checklist
  const specificChecklist: Record<string, ChecklistValue> = {};
  SPECIFIC_CHECKLIST_ITEMS[type].forEach(item => {
    specificChecklist[item] = 'P';
  });
  
  return {
    equipment_type: type,
    equipment_number: number,
    hydraulic_photo_path: `test-photos/hydraulic-${type.toLowerCase()}.jpg`,
    submitted_by: 'Test Inspector',
    inspection_date: today,
    template: type,
    notes: `Test inspection for ${type} ${number} - all systems operational`,
    general_checklist: generalChecklist,
    specific_checklist: specificChecklist,
    overview_photo_path: `test-photos/overview-${type.toLowerCase()}.jpg`,
    ...overrides,
  };
}

/**
 * Create minimal valid equipment inspection
 */
export function createMinimalEquipment(
  type: EquipmentType = 'Jarraff',
  overrides?: Partial<EquipmentTestData>
): EquipmentTestData {
  const today = new Date().toISOString().split('T')[0];
  const number = EQUIPMENT_NUMBERS[type][0];
  
  return {
    equipment_type: type,
    equipment_number: number,
    hydraulic_photo_path: 'test-photos/hydraulic-minimal.jpg',
    submitted_by: 'Minimal Test Inspector',
    inspection_date: today,
    ...overrides,
  };
}

/**
 * Create equipment inspection for each type
 */
export function createEquipmentForAllTypes(): EquipmentTestData[] {
  const types: EquipmentType[] = ['Geo-Boy', 'Grapple', 'Jarraff', 'Mulcher', 'Skidsteer'];
  return types.map(type => createValidEquipment(type));
}

/**
 * Create equipment inspection missing hydraulic photo
 */
export function createEquipmentMissingHydraulicPhoto(): Partial<EquipmentTestData> {
  return {
    equipment_type: 'Jarraff',
    equipment_number: 'J-109',
    submitted_by: 'Test No Hydraulic',
    inspection_date: new Date().toISOString().split('T')[0],
    // hydraulic_photo_path intentionally missing
  };
}

/**
 * Create equipment inspection missing equipment type
 */
export function createEquipmentMissingType(): Partial<EquipmentTestData> {
  return {
    // equipment_type intentionally missing
    equipment_number: 'J-109',
    hydraulic_photo_path: 'test-photos/hydraulic.jpg',
    submitted_by: 'Test No Type',
    inspection_date: new Date().toISOString().split('T')[0],
  };
}

/**
 * Create equipment inspection with invalid number for type
 */
export function createEquipmentInvalidNumber(type: EquipmentType = 'Geo-Boy'): EquipmentTestData {
  return createValidEquipment(type, {
    equipment_number: 'INVALID-999', // Not a valid number for any type
  });
}

/**
 * Create equipment inspection missing submitter name
 */
export function createEquipmentMissingSubmitter(): Partial<EquipmentTestData> {
  return {
    equipment_type: 'Jarraff',
    equipment_number: 'J-109',
    hydraulic_photo_path: 'test-photos/hydraulic.jpg',
    // submitted_by intentionally missing
    inspection_date: new Date().toISOString().split('T')[0],
  };
}

/**
 * Create equipment inspection with failures
 */
export function createEquipmentWithFailures(type: EquipmentType = 'Jarraff'): EquipmentTestData {
  const inspection = createValidEquipment(type);
  
  // Mark some items as failed
  if (inspection.general_checklist) {
    inspection.general_checklist.hydraulic_fluid_level = 'F';
    inspection.general_checklist.belts_hoses = 'F';
  }
  
  if (inspection.specific_checklist) {
    const keys = Object.keys(inspection.specific_checklist);
    if (keys.length > 0) {
      inspection.specific_checklist[keys[0]] = 'F';
    }
  }
  
  inspection.notes = 'DEFICIENCIES: Hydraulic fluid low, belts need replacement, ' +
    'specific equipment issues noted';
  
  return inspection;
}

/**
 * Create equipment inspection for mechanic update testing
 */
export function createEquipmentForMechanicUpdate(): EquipmentTestData {
  return createEquipmentWithFailures('Jarraff', {
    mechanic_fixes: null,
    last_mechanic_updated_at: null,
    mechanic_cost: null,
    mechanic_parts_used: null,
  });
}

/**
 * Create mechanic update payload for equipment
 */
export function createEquipmentMechanicUpdate() {
  return {
    mechanic_fixes: 'Hydraulic fluid topped off, belts replaced, saw blade sharpened',
    last_mechanic_updated_at: new Date().toISOString(),
    mechanic_cost: 245.50,
    mechanic_parts_used: [
      { part_name: 'Hydraulic Fluid', quantity: 2, part_number: 'HF-001', cost: 45.00 },
      { part_name: 'Drive Belt', quantity: 1, part_number: 'DB-J109', cost: 125.50 },
      { part_name: 'Saw Blade', quantity: 1, part_number: 'SB-JARRAFF', cost: 75.00 },
    ],
  };
}

/**
 * Create equipment inspection with malformed checklist
 */
export function createEquipmentMalformedChecklist(): EquipmentTestData {
  return createValidEquipment('Jarraff', {
    general_checklist: 'not an object' as unknown as Record<string, ChecklistValue>,
    specific_checklist: ['array', 'instead', 'of', 'object'] as unknown as Record<string, ChecklistValue>,
  });
}

/**
 * Equipment type validation test cases
 */
export const EQUIPMENT_TYPE_VALIDATION = {
  validTypes: ['Geo-Boy', 'Grapple', 'Jarraff', 'Mulcher', 'Skidsteer'] as EquipmentType[],
  invalidTypes: ['Invalid', '', null, undefined, 'geo-boy', 'JARRAFF'],
};

/**
 * Equipment number validation test cases by type
 */
export const EQUIPMENT_NUMBER_VALIDATION: Record<EquipmentType, { valid: string[]; invalid: string[] }> = {
  'Geo-Boy': {
    valid: ['G-126', 'G-140', 'G-157'],
    invalid: ['G-999', 'J-109', '126', 'G126'],
  },
  'Grapple': {
    valid: ['211'],
    invalid: ['212', 'G-211', ''],
  },
  'Jarraff': {
    valid: ['J-109', 'J-119', 'J-129', 'J-138', 'J-152'],
    invalid: ['J-999', 'G-109', '109'],
  },
  'Mulcher': {
    valid: ['212', '213'],
    invalid: ['211', 'M-212', '214'],
  },
  'Skidsteer': {
    valid: ['118', '135', '136'],
    invalid: ['S-118', '137', ''],
  },
};
