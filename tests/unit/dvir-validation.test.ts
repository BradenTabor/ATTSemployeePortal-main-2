/**
 * DVIR Form Validation Unit Tests
 * 
 * Tests validation logic for Daily Vehicle Inspection Report forms.
 * These tests verify client-side validation before submission.
 */

import { describe, it, expect } from 'vitest';
import {
  createValidDVIR,
  createMinimalDVIR,
  createDVIRMissingOilDipstick,
  createDVIRMissingTruckNumber,
  createDVIRMissingDriverName,
  createDVIRWithXSSPayload,
  createDVIRWithUnicode,
  createDVIRWithFailures,
  MILEAGE_BOUNDARY_VALUES,
  type DVIRTestData,
} from '../factories/dvirFactory';
import { validators } from '../../src/lib/formValidation';

/**
 * DVIR Validation Rules (extracted from DVIRForm.tsx)
 * 
 * Required fields:
 * - truck_number: non-empty string
 * - drivers_name: non-empty string  
 * - mileage: valid positive number
 * - oil_dipstick_path: non-empty (photo required)
 * - vehicle_trailer_checklist: all items must be filled (P or F)
 * - signature: at least one (driver or foreman) required
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate truck number
 */
function validateTruckNumber(value: string | undefined | null): ValidationResult {
  const errors: string[] = [];
  
  if (!value || !value.trim()) {
    errors.push('Truck number is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate driver's name
 */
function validateDriversName(value: string | undefined | null): ValidationResult {
  const errors: string[] = [];
  
  if (!value || !value.trim()) {
    errors.push('Driver\'s name is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate mileage
 */
/** previousMileage kept in signature for call-site compatibility; no longer used (suggestion only in production). */
function validateMileage(
  value: number | string | undefined | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature compatibility
  _previousMileage?: number | null
): ValidationResult {
  const errors: string[] = [];
  
  // Check if provided
  if (value === undefined || value === null || value === '') {
    errors.push('Mileage is required');
    return { valid: false, errors };
  }
  
  // Convert to number if string
  let mileageNum: number;
  if (typeof value === 'string') {
    // Strip non-numeric characters (commas, etc)
    const cleaned = value.replace(/[^\d.-]/g, '');
    mileageNum = parseFloat(cleaned);
  } else {
    mileageNum = value;
  }
  
  // Check if valid number
  if (isNaN(mileageNum)) {
    errors.push('Mileage must be a valid number');
    return { valid: false, errors };
  }
  
  // Check if negative
  if (mileageNum < 0) {
    errors.push('Mileage cannot be negative');
  }

  // previousMileage is suggestion only in production; no rejection when lower.

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate oil dipstick photo
 */
function validateOilDipstickPhoto(path: string | undefined | null): ValidationResult {
  const errors: string[] = [];
  
  if (!path || !path.trim()) {
    errors.push('Oil dipstick photo is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate vehicle/trailer checklist completeness
 */
function validateChecklist(
  checklist: Record<string, string> | undefined | null,
  requiredItems: string[]
): ValidationResult {
  const errors: string[] = [];
  
  if (!checklist) {
    errors.push('Vehicle checklist is required');
    return { valid: false, errors };
  }
  
  const filledItems = Object.entries(checklist)
    .filter(([, value]) => value === 'P' || value === 'F')
    .map(([key]) => key);
  
  const missingItems = requiredItems.filter(item => !filledItems.includes(item));
  
  if (missingItems.length > 0) {
    errors.push(`Complete all checklist items: ${filledItems.length}/${requiredItems.length} filled`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that at least one signature is present
 */
function validateSignatures(
  driverSignature: string | undefined | null,
  foremanSignature: string | undefined | null
): ValidationResult {
  const errors: string[] = [];
  
  const hasDriverSig = driverSignature && driverSignature.trim().length > 0;
  const hasForemanSig = foremanSignature && foremanSignature.trim().length > 0;
  
  if (!hasDriverSig && !hasForemanSig) {
    errors.push('At least one signature (driver or foreman) is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize text input for XSS prevention
 */
function sanitizeText(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Full DVIR form validation
 */
function validateDVIRForm(data: Partial<DVIRTestData>): ValidationResult {
  const errors: string[] = [];
  
  // Validate required fields
  const truckResult = validateTruckNumber(data.truck_number);
  errors.push(...truckResult.errors);
  
  const driverResult = validateDriversName(data.drivers_name);
  errors.push(...driverResult.errors);
  
  const mileageResult = validateMileage(data.mileage);
  errors.push(...mileageResult.errors);
  
  const photoResult = validateOilDipstickPhoto(data.oil_dipstick_path);
  errors.push(...photoResult.errors);
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('DVIR Validation', () => {
  describe('Truck Number Validation', () => {
    it('accepts valid truck number', () => {
      const result = validateTruckNumber('TEST-001');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty truck number', () => {
      const result = validateTruckNumber('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Truck number is required');
    });

    it('rejects whitespace-only truck number', () => {
      const result = validateTruckNumber('   ');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Truck number is required');
    });

    it('rejects null truck number', () => {
      const result = validateTruckNumber(null);
      expect(result.valid).toBe(false);
    });

    it('rejects undefined truck number', () => {
      const result = validateTruckNumber(undefined);
      expect(result.valid).toBe(false);
    });

    it('accepts truck number with special characters', () => {
      const result = validateTruckNumber('T-101/A');
      expect(result.valid).toBe(true);
    });
  });

  describe('Driver Name Validation', () => {
    it('accepts valid driver name', () => {
      const result = validateDriversName('John Doe');
      expect(result.valid).toBe(true);
    });

    it('rejects empty driver name', () => {
      const result = validateDriversName('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Driver\'s name is required');
    });

    it('rejects whitespace-only driver name', () => {
      const result = validateDriversName('   ');
      expect(result.valid).toBe(false);
    });

    it('accepts names with accented characters', () => {
      const result = validateDriversName('José García');
      expect(result.valid).toBe(true);
    });

    it('accepts names with unicode characters', () => {
      const result = validateDriversName('田中太郎');
      expect(result.valid).toBe(true);
    });
  });

  describe('Mileage Validation', () => {
    it('accepts valid positive mileage', () => {
      const result = validateMileage(50000);
      expect(result.valid).toBe(true);
    });

    it('accepts zero mileage (new vehicle)', () => {
      const result = validateMileage(MILEAGE_BOUNDARY_VALUES.zero);
      expect(result.valid).toBe(true);
    });

    it('accepts mileage of 1 (boundary)', () => {
      const result = validateMileage(MILEAGE_BOUNDARY_VALUES.minimum);
      expect(result.valid).toBe(true);
    });

    it('accepts high mileage (999,999)', () => {
      const result = validateMileage(MILEAGE_BOUNDARY_VALUES.high);
      expect(result.valid).toBe(true);
    });

    it('accepts million mileage', () => {
      const result = validateMileage(MILEAGE_BOUNDARY_VALUES.million);
      expect(result.valid).toBe(true);
    });

    it('accepts INT MAX mileage', () => {
      const result = validateMileage(MILEAGE_BOUNDARY_VALUES.intMax);
      expect(result.valid).toBe(true);
    });

    it('rejects negative mileage', () => {
      const result = validateMileage(MILEAGE_BOUNDARY_VALUES.negative);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mileage cannot be negative');
    });

    it('accepts decimal mileage', () => {
      const result = validateMileage(MILEAGE_BOUNDARY_VALUES.decimal);
      expect(result.valid).toBe(true);
    });

    it('rejects non-numeric mileage string', () => {
      const result = validateMileage('abc');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mileage must be a valid number');
    });

    it('rejects empty mileage', () => {
      const result = validateMileage('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mileage is required');
    });

    it('rejects null mileage', () => {
      const result = validateMileage(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mileage is required');
    });

    it('accepts mileage string with commas', () => {
      const result = validateMileage('50,000');
      expect(result.valid).toBe(true);
    });

    it('accepts mileage lower than previous reading (suggestion only)', () => {
      const result = validateMileage(40000, 50000);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts mileage equal to previous reading', () => {
      const result = validateMileage(50000, 50000);
      expect(result.valid).toBe(true);
    });

    it('accepts mileage higher than previous reading', () => {
      const result = validateMileage(60000, 50000);
      expect(result.valid).toBe(true);
    });
  });

  describe('Oil Dipstick Photo Validation', () => {
    it('accepts valid photo path', () => {
      const result = validateOilDipstickPhoto('dvir-photos/user123/oil-dipstick.jpg');
      expect(result.valid).toBe(true);
    });

    it('rejects empty photo path', () => {
      const result = validateOilDipstickPhoto('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Oil dipstick photo is required');
    });

    it('rejects null photo path', () => {
      const result = validateOilDipstickPhoto(null);
      expect(result.valid).toBe(false);
    });

    it('rejects undefined photo path', () => {
      const result = validateOilDipstickPhoto(undefined);
      expect(result.valid).toBe(false);
    });

    it('rejects whitespace-only photo path', () => {
      const result = validateOilDipstickPhoto('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('Checklist Validation', () => {
    const REQUIRED_ITEMS = ['brakes', 'lights', 'tires', 'mirrors', 'horn'];

    it('accepts complete checklist with all P values', () => {
      const checklist = {
        brakes: 'P',
        lights: 'P',
        tires: 'P',
        mirrors: 'P',
        horn: 'P',
      };
      const result = validateChecklist(checklist, REQUIRED_ITEMS);
      expect(result.valid).toBe(true);
    });

    it('accepts complete checklist with mixed P and F values', () => {
      const checklist = {
        brakes: 'P',
        lights: 'F',
        tires: 'P',
        mirrors: 'F',
        horn: 'P',
      };
      const result = validateChecklist(checklist, REQUIRED_ITEMS);
      expect(result.valid).toBe(true);
    });

    it('rejects incomplete checklist', () => {
      const checklist = {
        brakes: 'P',
        lights: 'P',
        // Missing tires, mirrors, horn
      };
      const result = validateChecklist(checklist, REQUIRED_ITEMS);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Complete all checklist items');
    });

    it('rejects checklist with empty values', () => {
      const checklist = {
        brakes: 'P',
        lights: '',
        tires: 'P',
        mirrors: '',
        horn: 'P',
      };
      const result = validateChecklist(checklist, REQUIRED_ITEMS);
      expect(result.valid).toBe(false);
    });

    it('rejects null checklist', () => {
      const result = validateChecklist(null, REQUIRED_ITEMS);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Vehicle checklist is required');
    });
  });

  describe('Signature Validation', () => {
    it('accepts driver signature only', () => {
      const result = validateSignatures('data:image/png;base64,ABC123', null);
      expect(result.valid).toBe(true);
    });

    it('accepts foreman signature only', () => {
      const result = validateSignatures(null, 'data:image/png;base64,DEF456');
      expect(result.valid).toBe(true);
    });

    it('accepts both signatures', () => {
      const result = validateSignatures(
        'data:image/png;base64,ABC123',
        'data:image/png;base64,DEF456'
      );
      expect(result.valid).toBe(true);
    });

    it('rejects when both signatures are missing', () => {
      const result = validateSignatures(null, null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one signature (driver or foreman) is required');
    });

    it('rejects when both signatures are empty strings', () => {
      const result = validateSignatures('', '');
      expect(result.valid).toBe(false);
    });

    it('rejects when both signatures are whitespace', () => {
      const result = validateSignatures('   ', '   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('Full Form Validation', () => {
    it('accepts valid complete DVIR', () => {
      const dvir = createValidDVIR();
      const result = validateDVIRForm(dvir);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts minimal valid DVIR', () => {
      const dvir = createMinimalDVIR();
      const result = validateDVIRForm(dvir);
      expect(result.valid).toBe(true);
    });

    it('rejects DVIR missing oil dipstick photo', () => {
      const dvir = createDVIRMissingOilDipstick();
      const result = validateDVIRForm(dvir);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Oil dipstick photo is required');
    });

    it('rejects DVIR missing truck number', () => {
      const dvir = createDVIRMissingTruckNumber();
      const result = validateDVIRForm(dvir);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Truck number is required');
    });

    it('rejects DVIR missing driver name', () => {
      const dvir = createDVIRMissingDriverName();
      const result = validateDVIRForm(dvir);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Driver\'s name is required');
    });

    it('collects multiple validation errors', () => {
      const dvir: Partial<DVIRTestData> = {
        // All required fields missing
      };
      const result = validateDVIRForm(dvir);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Security - XSS Prevention', () => {
    it('sanitizes script tags', () => {
      const input = '<script>alert("XSS")</script>';
      const sanitized = sanitizeText(input);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('sanitizes event handlers', () => {
      const input = '<img src=x onerror=alert("XSS")>';
      const sanitized = sanitizeText(input);
      expect(sanitized).not.toContain('<img');
    });

    it('preserves normal text', () => {
      const input = 'Normal driver notes';
      const sanitized = sanitizeText(input);
      expect(sanitized).toBe(input);
    });

    it('handles XSS payload from factory', () => {
      const dvir = createDVIRWithXSSPayload();
      const sanitizedNotes = sanitizeText(dvir.notes || '');
      expect(sanitizedNotes).not.toContain('<script>');
    });
  });

  describe('Data Integrity - Unicode Support', () => {
    it('accepts unicode in driver name', () => {
      const result = validateDriversName('José García 日本語');
      expect(result.valid).toBe(true);
    });

    it('accepts emoji in notes (via factory)', () => {
      const dvir = createDVIRWithUnicode();
      expect(dvir.notes).toContain('🚛');
      // Notes field doesn't have validation, just ensure it doesn't break
      const result = validateDVIRForm(dvir);
      expect(result.valid).toBe(true);
    });

    it('accepts RTL text in notes', () => {
      const dvir = createValidDVIR({
        notes: 'Hebrew text: עברית',
      });
      const result = validateDVIRForm(dvir);
      expect(result.valid).toBe(true);
    });
  });
});

describe('DVIR Factory Functions', () => {
  it('createValidDVIR produces valid data', () => {
    const dvir = createValidDVIR();
    expect(dvir.truck_number).toBeDefined();
    expect(dvir.drivers_name).toBeDefined();
    expect(dvir.oil_dipstick_path).toBeDefined();
    expect(dvir.mileage).toBeGreaterThan(0);
  });

  it('createValidDVIR accepts overrides', () => {
    const dvir = createValidDVIR({ truck_number: 'CUSTOM-001' });
    expect(dvir.truck_number).toBe('CUSTOM-001');
  });

  it('createMinimalDVIR has only required fields', () => {
    const dvir = createMinimalDVIR();
    expect(dvir.truck_number).toBeDefined();
    expect(dvir.drivers_name).toBeDefined();
    expect(dvir.oil_dipstick_path).toBeDefined();
    expect(dvir.mileage).toBeDefined();
    // Optional fields should not be defined or be null
    expect(dvir.aerial_notes).toBeUndefined();
  });

  it('createDVIRWithFailures has F values in checklist', () => {
    const dvir = createDVIRWithFailures();
    expect(dvir.vehicle_trailer_checklist?.brakes).toBe('F');
  });

  it('MILEAGE_BOUNDARY_VALUES covers all test cases', () => {
    expect(MILEAGE_BOUNDARY_VALUES.zero).toBe(0);
    expect(MILEAGE_BOUNDARY_VALUES.minimum).toBe(1);
    expect(MILEAGE_BOUNDARY_VALUES.negative).toBeLessThan(0);
    expect(MILEAGE_BOUNDARY_VALUES.intMax).toBe(2147483647);
  });
});

/**
 * Regression: Production mileage validator (formValidation.ts)
 * Ensures the app's validator allows same reading and small daily adjustments.
 */
describe('DVIR mileage validation (production validator)', () => {
  it('accepts odometer reading equal to previous (regression: bug fix)', () => {
    const result = validators.mileage('12000', 12000);
    expect(result).toBeNull();
  });

  it('accepts odometer reading equal to previous when passed as number', () => {
    const result = validators.mileage(50000, 50000);
    expect(result).toBeNull();
  });

  it('accepts odometer reading greater than previous', () => {
    const result = validators.mileage('12001', 12000);
    expect(result).toBeNull();
  });

  it('accepts odometer reading less than previous (suggestion only)', () => {
    const result = validators.mileage('11999', 12000);
    expect(result).toBeNull();
  });

  it('accepts odometer reading of 1 with large previous mileage', () => {
    const result = validators.mileage('1', 50000);
    expect(result).toBeNull();
  });
});
