/**
 * JSA Form Validation Unit Tests
 * 
 * Tests validation logic for Job Safety Analysis forms.
 * These tests verify client-side validation before submission.
 */

import { describe, it, expect } from 'vitest';
import {
  createValidJSA,
  createMinimalDraftJSA,
  createCompletedJSA,
  createJSAMissingSignature,
  createJSAMissingJobDate,
  createJSAMissingLocation,
  createJSAWithMaxSpans,
  createJSAWithAllHazards,
  createJSAWithPPEReplacement,
  createJSAForStatusTransition,
  STATUS_TRANSITIONS,
  STEP_VALIDATION_REQUIREMENTS,
  type JSATestData,
  type JsaSpan,
} from '../factories/jsaFactory';

/**
 * JSA Validation Rules (extracted from DailyJSAForm.tsx)
 * 
 * For completion (isFormValid):
 * - job_date: required, non-empty
 * - work_location: required, non-empty (trimmed)
 * - employee_signature: required, non-empty (trimmed)
 * 
 * For save (any mode):
 * - All emergency contacts must have valid phone numbers
 * 
 * Draft mode allows saving with minimal data.
 */

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Phone validation pattern from JSA form
const PHONE_PATTERN = /[+\d][\d\s().-]{6,}/;

/**
 * Validate job date
 */
function validateJobDate(value: string | undefined | null): ValidationResult {
  const errors: string[] = [];
  
  if (!value || !value.trim()) {
    errors.push('Job date is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate work location
 */
function validateWorkLocation(value: string | undefined | null): ValidationResult {
  const errors: string[] = [];
  
  if (!value || !value.trim()) {
    errors.push('Work location is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate employee signature
 */
function validateEmployeeSignature(value: string | undefined | null): ValidationResult {
  const errors: string[] = [];
  
  if (!value || !value.trim()) {
    errors.push('Employee signature is required');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate phone number format
 */
function validatePhoneNumber(value: string | undefined | null, fieldLabel: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value || !value.trim()) {
    errors.push(`${fieldLabel} is required`);
    return { valid: false, errors };
  }
  
  if (!PHONE_PATTERN.test(value.trim())) {
    errors.push(`${fieldLabel} must contain a valid phone number`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate emergency contacts (all required with phone numbers)
 */
function validateEmergencyContacts(data: Partial<JSATestData>): ValidationResult {
  const errors: string[] = [];
  
  const contacts = [
    { value: data.oc_contact, label: 'OC Contact' },
    { value: data.doc_contact, label: 'DOC Contact' },
    { value: data.gf_contact, label: 'GF Contact' },
    { value: data.safety_contact, label: 'Safety Contact' },
  ];
  
  for (const contact of contacts) {
    const result = validatePhoneNumber(contact.value, contact.label);
    errors.push(...result.errors);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate spans array
 */
function validateSpans(spans: JsaSpan[] | undefined | null): ValidationResult {
  const errors: string[] = [];
  
  if (!spans) {
    return { valid: true, errors }; // Spans are optional
  }
  
  if (spans.length > 21) {
    errors.push('Maximum 21 spans allowed');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate status transition
 */
function validateStatusTransition(
  currentStatus: 'draft' | 'completed' | null,
  targetStatus: 'draft' | 'completed',
  hasRequiredFields: boolean
): ValidationResult {
  const errors: string[] = [];
  
  // Can always transition to draft
  if (targetStatus === 'draft') {
    return { valid: true, errors };
  }
  
  // To complete, must have required fields
  if (targetStatus === 'completed' && !hasRequiredFields) {
    errors.push('Cannot complete JSA without required fields (date, location, signature)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if JSA form is valid for completion
 */
function isJSAFormValid(data: Partial<JSATestData>): boolean {
  return Boolean(data.job_date) &&
         Boolean(data.work_location?.trim()) &&
         Boolean(data.employee_signature?.trim());
}

/**
 * Full JSA form validation for completion
 */
function validateJSAForCompletion(data: Partial<JSATestData>): ValidationResult {
  const errors: string[] = [];
  
  const dateResult = validateJobDate(data.job_date);
  errors.push(...dateResult.errors);
  
  const locationResult = validateWorkLocation(data.work_location);
  errors.push(...locationResult.errors);
  
  const signatureResult = validateEmployeeSignature(data.employee_signature);
  errors.push(...signatureResult.errors);
  
  const contactsResult = validateEmergencyContacts(data);
  errors.push(...contactsResult.errors);
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate JSA for draft save (minimal requirements)
 */
function validateJSAForDraft(data: Partial<JSATestData>): ValidationResult {
  const errors: string[] = [];
  
  // For draft, only emergency contacts with phone numbers are validated
  // (based on the form logic that validates contacts before any save)
  if (data.oc_contact || data.doc_contact || data.gf_contact || data.safety_contact) {
    const contactsResult = validateEmergencyContacts(data);
    // Only add errors if contacts are partially filled
    const hasAnyContact = [
      data.oc_contact,
      data.doc_contact, 
      data.gf_contact,
      data.safety_contact
    ].some(c => c && c.trim());
    
    if (hasAnyContact) {
      errors.push(...contactsResult.errors);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('JSA Validation', () => {
  describe('Job Date Validation', () => {
    it('accepts valid date string', () => {
      const result = validateJobDate('2026-01-16');
      expect(result.valid).toBe(true);
    });

    it('rejects empty date', () => {
      const result = validateJobDate('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Job date is required');
    });

    it('rejects null date', () => {
      const result = validateJobDate(null);
      expect(result.valid).toBe(false);
    });

    it('rejects undefined date', () => {
      const result = validateJobDate(undefined);
      expect(result.valid).toBe(false);
    });

    it('rejects whitespace-only date', () => {
      const result = validateJobDate('   ');
      expect(result.valid).toBe(false);
    });
  });

  describe('Work Location Validation', () => {
    it('accepts valid location', () => {
      const result = validateWorkLocation('123 Main Street, Austin TX');
      expect(result.valid).toBe(true);
    });

    it('rejects empty location', () => {
      const result = validateWorkLocation('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Work location is required');
    });

    it('rejects whitespace-only location', () => {
      const result = validateWorkLocation('   ');
      expect(result.valid).toBe(false);
    });

    it('accepts location with special characters', () => {
      const result = validateWorkLocation('Hwy 290 & I-35, Exit #42');
      expect(result.valid).toBe(true);
    });

    it('accepts unicode in location', () => {
      const result = validateWorkLocation('123 Café Street, Austin');
      expect(result.valid).toBe(true);
    });
  });

  describe('Employee Signature Validation', () => {
    it('accepts valid signature', () => {
      const result = validateEmployeeSignature('John Doe');
      expect(result.valid).toBe(true);
    });

    it('rejects empty signature', () => {
      const result = validateEmployeeSignature('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Employee signature is required');
    });

    it('rejects whitespace-only signature', () => {
      const result = validateEmployeeSignature('   ');
      expect(result.valid).toBe(false);
    });

    it('accepts signature with special characters', () => {
      const result = validateEmployeeSignature('J. Doe Jr.');
      expect(result.valid).toBe(true);
    });
  });

  describe('Phone Number Validation', () => {
    it('accepts valid US phone number', () => {
      const result = validatePhoneNumber('555-0100', 'Test Contact');
      expect(result.valid).toBe(true);
    });

    it('accepts phone with area code', () => {
      const result = validatePhoneNumber('(512) 555-0100', 'Test Contact');
      expect(result.valid).toBe(true);
    });

    it('accepts phone with country code', () => {
      const result = validatePhoneNumber('+1 512 555 0100', 'Test Contact');
      expect(result.valid).toBe(true);
    });

    it('accepts simple numeric phone', () => {
      const result = validatePhoneNumber('5550100', 'Test Contact');
      expect(result.valid).toBe(true);
    });

    it('rejects empty phone', () => {
      const result = validatePhoneNumber('', 'OC Contact');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('OC Contact is required');
    });

    it('rejects phone without enough digits', () => {
      const result = validatePhoneNumber('123', 'Test Contact');
      expect(result.valid).toBe(false);
    });

    it('rejects text-only value', () => {
      const result = validatePhoneNumber('call me', 'Test Contact');
      expect(result.valid).toBe(false);
    });
  });

  describe('Emergency Contacts Validation', () => {
    it('accepts all valid contacts', () => {
      const jsa = createValidJSA();
      const result = validateEmergencyContacts(jsa);
      expect(result.valid).toBe(true);
    });

    it('rejects when OC contact missing', () => {
      const jsa = createValidJSA({ oc_contact: '' });
      const result = validateEmergencyContacts(jsa);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('OC Contact'))).toBe(true);
    });

    it('rejects when contact has invalid phone', () => {
      const jsa = createValidJSA({ doc_contact: 'John (no phone)' });
      const result = validateEmergencyContacts(jsa);
      expect(result.valid).toBe(false);
    });
  });

  describe('Spans Validation', () => {
    it('accepts empty spans array', () => {
      const result = validateSpans([]);
      expect(result.valid).toBe(true);
    });

    it('accepts valid spans', () => {
      const jsa = createValidJSA();
      const result = validateSpans(jsa.spans);
      expect(result.valid).toBe(true);
    });

    it('accepts maximum 21 spans', () => {
      const jsa = createJSAWithMaxSpans();
      expect(jsa.spans?.length).toBe(21);
      const result = validateSpans(jsa.spans);
      expect(result.valid).toBe(true);
    });

    it('rejects more than 21 spans', () => {
      const spans = Array.from({ length: 22 }, (_, i) => ({
        id: `span-${i}`,
        location: `Location ${i}`,
        hazards: `Hazards ${i}`,
      }));
      const result = validateSpans(spans);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 21 spans allowed');
    });

    it('accepts null spans (optional)', () => {
      const result = validateSpans(null);
      expect(result.valid).toBe(true);
    });
  });

  describe('Status Transition Validation', () => {
    it('allows draft to draft transition', () => {
      const result = validateStatusTransition('draft', 'draft', false);
      expect(result.valid).toBe(true);
    });

    it('allows draft to completed with required fields', () => {
      const result = validateStatusTransition('draft', 'completed', true);
      expect(result.valid).toBe(true);
    });

    it('rejects draft to completed without required fields', () => {
      const result = validateStatusTransition('draft', 'completed', false);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Cannot complete JSA');
    });

    it('allows completed to draft transition', () => {
      const result = validateStatusTransition('completed', 'draft', true);
      expect(result.valid).toBe(true);
    });

    it('allows completed to completed transition', () => {
      const result = validateStatusTransition('completed', 'completed', true);
      expect(result.valid).toBe(true);
    });

    it('allows null status to draft', () => {
      const result = validateStatusTransition(null, 'draft', false);
      expect(result.valid).toBe(true);
    });
  });

  describe('Form Validity Check (isFormValid)', () => {
    it('returns true for complete JSA', () => {
      const jsa = createValidJSA();
      expect(isJSAFormValid(jsa)).toBe(true);
    });

    it('returns false without job date', () => {
      const jsa = createJSAMissingJobDate();
      expect(isJSAFormValid(jsa as JSATestData)).toBe(false);
    });

    it('returns false without work location', () => {
      const jsa = createJSAMissingLocation();
      expect(isJSAFormValid(jsa as JSATestData)).toBe(false);
    });

    it('returns false without signature', () => {
      const jsa = createJSAMissingSignature();
      expect(isJSAFormValid(jsa)).toBe(false);
    });

    it('returns false with whitespace-only location', () => {
      const jsa = createValidJSA({ work_location: '   ' });
      expect(isJSAFormValid(jsa)).toBe(false);
    });

    it('returns false with whitespace-only signature', () => {
      const jsa = createValidJSA({ employee_signature: '   ' });
      expect(isJSAFormValid(jsa)).toBe(false);
    });
  });

  describe('Full Form Validation for Completion', () => {
    it('accepts valid complete JSA', () => {
      const jsa = createValidJSA();
      const result = validateJSAForCompletion(jsa);
      expect(result.valid).toBe(true);
    });

    it('accepts completed JSA from factory', () => {
      const jsa = createCompletedJSA();
      const result = validateJSAForCompletion(jsa);
      expect(result.valid).toBe(true);
    });

    it('rejects JSA missing signature', () => {
      const jsa = createJSAMissingSignature();
      const result = validateJSAForCompletion(jsa);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Employee signature is required');
    });

    it('collects multiple validation errors', () => {
      const jsa: Partial<JSATestData> = {
        // Missing all required fields
      };
      const result = validateJSAForCompletion(jsa);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Draft Save Validation', () => {
    it('accepts minimal draft JSA', () => {
      const jsa = createMinimalDraftJSA();
      const result = validateJSAForDraft(jsa);
      expect(result.valid).toBe(true);
    });

    it('accepts draft with empty contacts', () => {
      const jsa: Partial<JSATestData> = {
        job_date: '2026-01-16',
        work_location: 'Test Location',
      };
      const result = validateJSAForDraft(jsa);
      expect(result.valid).toBe(true);
    });
  });
});

describe('JSA Factory Functions', () => {
  it('createValidJSA produces valid data', () => {
    const jsa = createValidJSA();
    expect(jsa.job_date).toBeDefined();
    expect(jsa.work_location).toBeDefined();
    expect(jsa.employee_signature).toBeDefined();
    expect(jsa.status).toBe('draft');
  });

  it('createValidJSA accepts overrides', () => {
    const jsa = createValidJSA({ work_location: 'Custom Location' });
    expect(jsa.work_location).toBe('Custom Location');
  });

  it('createMinimalDraftJSA has minimal fields', () => {
    const jsa = createMinimalDraftJSA();
    expect(jsa.job_date).toBeDefined();
    expect(jsa.work_location).toBeDefined();
    expect(jsa.status).toBe('draft');
    expect(jsa.spans).toEqual([]);
  });

  it('createCompletedJSA has completed status', () => {
    const jsa = createCompletedJSA();
    expect(jsa.status).toBe('completed');
    expect(jsa.completed_at).toBeDefined();
    expect(jsa.status_history?.length).toBeGreaterThan(0);
  });

  it('createJSAMissingSignature has null signature', () => {
    const jsa = createJSAMissingSignature();
    expect(jsa.employee_signature).toBeNull();
    expect(jsa.status).toBe('draft');
  });

  it('createJSAWithMaxSpans has 21 spans', () => {
    const jsa = createJSAWithMaxSpans();
    expect(jsa.spans?.length).toBe(21);
  });

  it('createJSAWithAllHazards has all hazards flagged', () => {
    const jsa = createJSAWithAllHazards();
    expect(jsa.hazards_present?.lines_energized).toBe(true);
    expect(jsa.traffic_hazards?.heavy_traffic).toBe(true);
  });

  it('createJSAWithPPEReplacement has replacement items', () => {
    const jsa = createJSAWithPPEReplacement();
    expect(jsa.ppe?.hard_hats.condition).toBe('needs_replaced');
  });

  it('createJSAForStatusTransition creates proper initial state', () => {
    const draftJsa = createJSAForStatusTransition('draft');
    expect(draftJsa.status).toBe('draft');
    
    const completedJsa = createJSAForStatusTransition('completed');
    expect(completedJsa.status).toBe('completed');
  });
});

describe('JSA Step Validation Requirements', () => {
  it('step 1 requires job date and work location', () => {
    expect(STEP_VALIDATION_REQUIREMENTS.step1_job_info).toContain('job_date');
    expect(STEP_VALIDATION_REQUIREMENTS.step1_job_info).toContain('work_location');
  });

  it('step 6 requires employee signature', () => {
    expect(STEP_VALIDATION_REQUIREMENTS.step6_review).toContain('employee_signature');
  });

  it('all steps have defined requirements', () => {
    expect(STEP_VALIDATION_REQUIREMENTS.step1_job_info).toBeDefined();
    expect(STEP_VALIDATION_REQUIREMENTS.step2_safety_ppe).toBeDefined();
    expect(STEP_VALIDATION_REQUIREMENTS.step3_conditions).toBeDefined();
    expect(STEP_VALIDATION_REQUIREMENTS.step4_hazards).toBeDefined();
    expect(STEP_VALIDATION_REQUIREMENTS.step5_spans).toBeDefined();
    expect(STEP_VALIDATION_REQUIREMENTS.step6_review).toBeDefined();
  });
});

describe('JSA Status Transitions', () => {
  it('defines all valid transitions', () => {
    expect(STATUS_TRANSITIONS.draftToDraft.valid).toBe(true);
    expect(STATUS_TRANSITIONS.draftToComplete.valid).toBe(true);
    expect(STATUS_TRANSITIONS.completeToDraft.valid).toBe(true);
    expect(STATUS_TRANSITIONS.completeToComplete.valid).toBe(true);
  });
});
