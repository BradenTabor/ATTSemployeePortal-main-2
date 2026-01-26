/**
 * Field Name Mapping for Smart Form Defaults
 * 
 * Maps database column names (snake_case) to React form state keys (camelCase).
 * Required because:
 * - Database uses: work_location, truck_number, etc.
 * - React forms use: workLocation, truckNumber, etc.
 * 
 * @module fieldNameMap
 */

/**
 * Maps database column names to form state keys
 * Key: database column (snake_case)
 * Value: form state key (camelCase)
 */
export const FIELD_NAME_MAP: Record<string, Record<string, string>> = {
  dvir: {
    // Database column -> Form state key
    'truck_number': 'truckNumber',
    'chipper_number': 'chipperNumber',
    'trailer_number': 'trailerNumber',
    'truck_gvwr': 'truckGvwr',
    'trailer_chipper_gvwr': 'trailerChipperGvwr',
    'medical_card_required': 'medicalCardRequired',
    'has_medical_card': 'hasMedicalCard',
    'copy_of_registration': 'copyOfRegistration',
    'copy_of_insurance': 'copyOfInsurance',
  },
  jsa: {
    'work_location': 'workLocation',
    'circuit_number': 'circuitNumber',
    'nearest_hospital': 'nearestHospital',
    'nearest_clinic': 'nearestClinic',
    'oc_contact': 'ocContact',
    'doc_contact': 'docContact',
    'gf_contact': 'gfContact',
    'safety_contact': 'safetyContact',
    'call_in_time': 'callInTime',
    'call_out_time': 'callOutTime',
  },
  equipment: {
    'submitted_by': 'submittedBy',
    'equipment_type': 'equipmentType',
    'equipment_number': 'equipmentNumber',
  },
};

/**
 * Reverse mapping (form key -> database column)
 * Useful for converting form state back to database format
 */
export const REVERSE_FIELD_MAP: Record<string, Record<string, string>> = {
  dvir: Object.fromEntries(
    Object.entries(FIELD_NAME_MAP.dvir).map(([k, v]) => [v, k])
  ),
  jsa: Object.fromEntries(
    Object.entries(FIELD_NAME_MAP.jsa).map(([k, v]) => [v, k])
  ),
  equipment: Object.fromEntries(
    Object.entries(FIELD_NAME_MAP.equipment).map(([k, v]) => [v, k])
  ),
};

/**
 * Transform suggestions from database keys to form keys
 * 
 * @param suggestions - Object with database column names as keys
 * @param formType - 'dvir' or 'jsa'
 * @returns Object with form state keys (camelCase)
 * 
 * @example
 * ```ts
 * const dbSuggestions = { truck_number: { value: 'B132', ... } };
 * const formSuggestions = mapSuggestionsToFormKeys(dbSuggestions, 'dvir');
 * // Result: { truckNumber: { value: 'B132', ... } }
 * ```
 */
export function mapSuggestionsToFormKeys<T>(
  suggestions: Record<string, T>,
  formType: 'dvir' | 'jsa' | 'equipment'
): Record<string, T> {
  const map = FIELD_NAME_MAP[formType] || {};
  return Object.entries(suggestions).reduce((acc, [dbKey, value]) => {
    const formKey = map[dbKey] || dbKey;
    acc[formKey] = value;
    return acc;
  }, {} as Record<string, T>);
}

/**
 * Transform form keys back to database column names
 * 
 * @param data - Object with form state keys (camelCase)
 * @param formType - 'dvir' or 'jsa'
 * @returns Object with database column names (snake_case)
 */
export function mapFormKeysToDbColumns<T>(
  data: Record<string, T>,
  formType: 'dvir' | 'jsa' | 'equipment'
): Record<string, T> {
  const map = REVERSE_FIELD_MAP[formType] || {};
  return Object.entries(data).reduce((acc, [formKey, value]) => {
    const dbKey = map[formKey] || formKey;
    acc[dbKey] = value;
    return acc;
  }, {} as Record<string, T>);
}

/**
 * Human-readable display labels for form fields
 * Used in the SmartDefaultsPanel UI
 */
export const FIELD_LABELS: Record<string, string> = {
  // DVIR fields (camelCase keys)
  truckNumber: 'Truck Number',
  chipperNumber: 'Chipper Number',
  trailerNumber: 'Trailer Number',
  truckGvwr: 'Truck GVWR',
  trailerChipperGvwr: 'Trailer/Chipper GVWR',
  medicalCardRequired: 'Medical Card Required',
  hasMedicalCard: 'Has Medical Card',
  copyOfRegistration: 'Copy of Registration',
  copyOfInsurance: 'Copy of Insurance',
  // JSA fields (camelCase keys)
  workLocation: 'Work Location',
  circuitNumber: 'Circuit Number',
  nearestHospital: 'Nearest Hospital',
  nearestClinic: 'Nearest Clinic',
  ocContact: 'OC Contact',
  docContact: 'DOC Contact',
  gfContact: 'GF Contact',
  safetyContact: 'Safety Contact',
  callInTime: 'Call-in Time',
  callOutTime: 'Call-out Time',
  // Equipment fields (camelCase keys)
  submittedBy: 'Submitted By',
  equipmentType: 'Equipment Type',
  equipmentNumber: 'Equipment Number',
};

/**
 * Get the display label for a field
 * Falls back to formatting the field name if not found
 * 
 * @param field - Field name (camelCase)
 * @returns Human-readable label
 */
export function getFieldLabel(field: string): string {
  if (FIELD_LABELS[field]) {
    return FIELD_LABELS[field];
  }
  // Fallback: convert camelCase to Title Case
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}
