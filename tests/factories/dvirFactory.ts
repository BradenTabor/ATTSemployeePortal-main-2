/**
 * DVIR Test Data Factory
 * 
 * Creates valid and invalid DVIR test data for unit and integration tests.
 * All test data uses the 'TEST-' prefix for easy cleanup.
 */

export interface DVIRTestData {
  // Required fields
  truck_number: string;
  mileage: number;
  drivers_name: string;
  oil_dipstick_path: string;
  
  // Optional fields
  chipper_number?: string | null;
  trailer_number?: string | null;
  truck_gvwr?: string | null;
  trailer_chipper_gvwr?: string | null;
  medical_card_required?: string | null;
  drivers_license_number?: string | null;
  drivers_license_class?: string | null;
  drivers_license_exp?: string | null;
  drivers_license_required?: string | null;
  has_medical_card?: string | null;
  medical_card_exp?: string | null;
  copy_of_registration?: string | null;
  copy_of_insurance?: string | null;
  drivers_signature_section_a?: string | null;
  
  // Checklists (JSONB)
  vehicle_trailer_checklist?: Record<string, 'P' | 'F' | ''> | null;
  aerial_checklist?: Record<string, 'P' | 'F' | ''> | null;
  
  // Notes
  notes?: string | null;
  aerial_notes?: string | null;
  
  // Signatures
  final_driver_signature?: string | null;
  general_foreman_signature?: string | null;
  
  // Mechanic section
  mechanic_truck_number?: string | null;
  mechanic_date?: string | null;
  deficiency_corrected?: string | null;
  mechanic_remarks?: string | null;
  mechanic_signature?: string | null;
  driver_approval_signature?: string | null;
  
  // Photo paths
  tire_photo_path?: string | null;
  coolant_photo_path?: string | null;
  damage_photo_path?: string | null;
  detail_clean_truck_photo_path?: string | null;
}

/**
 * Create a valid DVIR with all required fields
 */
export function createValidDVIR(overrides?: Partial<DVIRTestData>): DVIRTestData {
  return {
    truck_number: 'TEST-001',
    drivers_name: 'Test Driver',
    oil_dipstick_path: 'test-photos/oil-dipstick-valid.jpg',
    mileage: 50000,
    vehicle_trailer_checklist: {
      brakes: 'P',
      lights: 'P',
      tires: 'P',
      mirrors: 'P',
      horn: 'P',
      wipers: 'P',
      steering: 'P',
      coupling_devices: 'P',
      emergency_equipment: 'P',
    },
    chipper_number: 'C-101',
    trailer_number: 'TR-201',
    truck_gvwr: '26000',
    trailer_chipper_gvwr: '10000',
    medical_card_required: 'yes',
    drivers_license_number: 'DL123456789',
    drivers_license_class: 'A',
    drivers_license_exp: '12/31/2027',
    drivers_license_required: 'yes',
    has_medical_card: 'yes',
    medical_card_exp: '06/30/2026',
    copy_of_registration: 'yes',
    copy_of_insurance: 'yes',
    drivers_signature_section_a: 'data:image/png;base64,TEST_SIGNATURE_A',
    aerial_checklist: {
      boom_operation: 'P',
      outriggers: 'P',
      basket_controls: 'P',
      hydraulic_leaks: 'P',
      safety_devices: 'P',
    },
    notes: 'Test DVIR - all systems operational',
    aerial_notes: 'Aerial equipment in good condition',
    final_driver_signature: 'data:image/png;base64,TEST_SIGNATURE_FINAL',
    general_foreman_signature: 'data:image/png;base64,TEST_SIGNATURE_FOREMAN',
    tire_photo_path: 'test-photos/tire-valid.jpg',
    coolant_photo_path: 'test-photos/coolant-valid.jpg',
    ...overrides,
  };
}

/**
 * Create minimal valid DVIR (only required fields)
 */
export function createMinimalDVIR(overrides?: Partial<DVIRTestData>): DVIRTestData {
  return {
    truck_number: 'TEST-MIN-001',
    drivers_name: 'Minimal Test Driver',
    oil_dipstick_path: 'test-photos/oil-dipstick-minimal.jpg',
    mileage: 10000,
    ...overrides,
  };
}

/**
 * Create DVIR missing required oil dipstick photo
 */
export function createDVIRMissingOilDipstick(): Partial<DVIRTestData> {
  return {
    truck_number: 'TEST-NO-OIL-001',
    drivers_name: 'Test Driver No Oil',
    mileage: 25000,
    // oil_dipstick_path intentionally missing
  };
}

/**
 * Create DVIR missing required truck number
 */
export function createDVIRMissingTruckNumber(): Partial<DVIRTestData> {
  return {
    // truck_number intentionally missing
    drivers_name: 'Test Driver No Truck',
    oil_dipstick_path: 'test-photos/oil-dipstick.jpg',
    mileage: 25000,
  };
}

/**
 * Create DVIR missing required driver name
 */
export function createDVIRMissingDriverName(): Partial<DVIRTestData> {
  return {
    truck_number: 'TEST-NO-DRIVER-001',
    // drivers_name intentionally missing
    oil_dipstick_path: 'test-photos/oil-dipstick.jpg',
    mileage: 25000,
  };
}

/**
 * Create DVIR with invalid mileage values
 */
export function createDVIRWithInvalidMileage(mileage: number | string): Partial<DVIRTestData> {
  return {
    truck_number: 'TEST-BAD-MILEAGE-001',
    drivers_name: 'Test Driver Bad Mileage',
    oil_dipstick_path: 'test-photos/oil-dipstick.jpg',
    mileage: mileage as number, // Force type for testing invalid values
  };
}

/**
 * Mileage boundary test values
 */
export const MILEAGE_BOUNDARY_VALUES = {
  zero: 0,
  minimum: 1,
  typical: 50000,
  high: 999999,
  million: 1000000,
  intMax: 2147483647,
  negative: -1,
  decimal: 12345.67,
  nonNumeric: 'abc' as unknown as number,
  null: null as unknown as number,
  empty: '' as unknown as number,
};

/**
 * Create DVIR with XSS payload in notes (for security testing)
 */
export function createDVIRWithXSSPayload(): DVIRTestData {
  return createValidDVIR({
    truck_number: 'TEST-XSS-001',
    notes: '<script>alert("XSS")</script>',
    aerial_notes: '"><img src=x onerror=alert("XSS")>',
  });
}

/**
 * Create DVIR with SQL injection payload (for security testing)
 */
export function createDVIRWithSQLInjection(): DVIRTestData {
  return createValidDVIR({
    truck_number: "TEST-SQL'; DROP TABLE dvir_reports;--",
    notes: "1' OR '1'='1",
  });
}

/**
 * Create DVIR with unicode/emoji content
 */
export function createDVIRWithUnicode(): DVIRTestData {
  return createValidDVIR({
    truck_number: 'TEST-UNICODE-001',
    notes: '🚛 Test with unicode: café, naïve, 日本語, עברית',
    aerial_notes: '✅ All good! 🎉',
  });
}

/**
 * Create DVIR with checklist failures
 */
export function createDVIRWithFailures(): DVIRTestData {
  return createValidDVIR({
    truck_number: 'TEST-FAILURES-001',
    vehicle_trailer_checklist: {
      brakes: 'F',
      lights: 'P',
      tires: 'F',
      mirrors: 'P',
      horn: 'P',
      wipers: 'F',
      steering: 'P',
      coupling_devices: 'P',
      emergency_equipment: 'P',
    },
    notes: 'DEFICIENCIES: Brakes need adjustment, tires worn, wipers need replacement',
  });
}

/**
 * Create DVIR for mechanic update testing
 */
export function createDVIRForMechanicUpdate(): DVIRTestData {
  return createDVIRWithFailures({
    truck_number: 'TEST-MECH-UPDATE-001',
    mechanic_truck_number: null,
    mechanic_date: null,
    deficiency_corrected: null,
    mechanic_remarks: null,
    mechanic_signature: null,
  });
}

/**
 * Create mechanic update payload
 */
export function createMechanicUpdatePayload() {
  return {
    mechanic_truck_number: 'TEST-MECH-UPDATE-001',
    mechanic_date: new Date().toLocaleDateString('en-US'),
    deficiency_corrected: 'yes',
    mechanic_remarks: 'All deficiencies corrected. Brakes adjusted, tires replaced, new wipers installed.',
    mechanic_signature: 'data:image/png;base64,TEST_MECHANIC_SIGNATURE',
    driver_approval_signature: 'data:image/png;base64,TEST_DRIVER_APPROVAL',
  };
}
