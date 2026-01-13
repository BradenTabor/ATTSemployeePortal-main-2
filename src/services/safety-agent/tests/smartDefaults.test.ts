/**
 * Smart Form Defaults - Unit Tests
 * 
 * Tests for candidate extraction, tie-breaking, and validation logic.
 * Uses mock data to avoid database and API calls.
 */

import { describe, it, expect } from 'vitest';
import {
  extractCandidatesForField,
  selectWinner,
  calculateConfidence,
  buildWarnings,
  ELIGIBLE_FIELDS,
} from '../execution/getSmartDefaultsCandidates';
import {
  isFieldAllowed,
  validateAIResponse,
  sanitizeSuggestions,
} from '../execution/validateSmartDefaults';
import {
  isContactField,
  redactContactFields,
  CONTACT_FIELDS,
} from '../lib/contactFields';
import {
  mapSuggestionsToFormKeys,
  FIELD_LABELS,
} from '../lib/fieldNameMap';

// =============================================================================
// CANDIDATE EXTRACTION TESTS
// =============================================================================

describe('extractCandidatesForField', () => {
  it('extracts candidates with correct counts', () => {
    const submissions = [
      { truck_number: 'B132', created_at: '2026-01-10T10:00:00Z' },
      { truck_number: 'B132', created_at: '2026-01-09T10:00:00Z' },
      { truck_number: 'B132', created_at: '2026-01-08T10:00:00Z' },
      { truck_number: 'B103', created_at: '2026-01-07T10:00:00Z' },
    ];

    const candidates = extractCandidatesForField('truck_number', submissions);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toEqual({
      value: 'B132',
      count: 3,
      lastUsed: '2026-01-10T10:00:00Z',
    });
    expect(candidates[1]).toEqual({
      value: 'B103',
      count: 1,
      lastUsed: '2026-01-07T10:00:00Z',
    });
  });

  it('sorts by count first, then by recency', () => {
    const submissions = [
      { truck_number: 'B103', created_at: '2026-01-10T10:00:00Z' }, // Most recent
      { truck_number: 'B132', created_at: '2026-01-09T10:00:00Z' },
      { truck_number: 'B132', created_at: '2026-01-08T10:00:00Z' },
    ];

    const candidates = extractCandidatesForField('truck_number', submissions);

    // B132 has higher count, so it comes first
    expect(candidates[0].value).toBe('B132');
    expect(candidates[0].count).toBe(2);
    expect(candidates[1].value).toBe('B103');
    expect(candidates[1].count).toBe(1);
  });

  it('handles empty submissions', () => {
    const candidates = extractCandidatesForField('truck_number', []);
    expect(candidates).toHaveLength(0);
  });

  it('skips null and empty values', () => {
    const submissions = [
      { truck_number: 'B132', created_at: '2026-01-10T10:00:00Z' },
      { truck_number: null, created_at: '2026-01-09T10:00:00Z' },
      { truck_number: '', created_at: '2026-01-08T10:00:00Z' },
      { truck_number: undefined, created_at: '2026-01-07T10:00:00Z' },
    ];

    const candidates = extractCandidatesForField('truck_number', submissions);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].value).toBe('B132');
  });

  it('handles boolean values correctly', () => {
    const submissions = [
      { medical_card_required: true, created_at: '2026-01-10T10:00:00Z' },
      { medical_card_required: true, created_at: '2026-01-09T10:00:00Z' },
      { medical_card_required: false, created_at: '2026-01-08T10:00:00Z' },
    ];

    const candidates = extractCandidatesForField('medical_card_required', submissions);

    expect(candidates).toHaveLength(2);
    expect(candidates[0].value).toBe(true);
    expect(candidates[0].count).toBe(2);
    expect(candidates[1].value).toBe(false);
    expect(candidates[1].count).toBe(1);
  });
});

// =============================================================================
// WINNER SELECTION TESTS
// =============================================================================

describe('selectWinner', () => {
  it('selects clear frequency winner', () => {
    const candidates = [
      { value: 'B132', count: 5, lastUsed: '2026-01-10T10:00:00Z' },
      { value: 'B103', count: 2, lastUsed: '2026-01-09T10:00:00Z' },
    ];

    const result = selectWinner('truck_number', candidates, 7);

    expect(result.winner).toBeDefined();
    expect(result.winner!.value).toBe('B132');
    expect(result.winner!.source).toBe('frequency');
    expect(result.needsAITieBreak).toBe(false);
  });

  it('identifies tie requiring AI', () => {
    const candidates = [
      { value: 'B132', count: 3, lastUsed: '2026-01-10T10:00:00Z' },
      { value: 'B103', count: 3, lastUsed: '2026-01-09T10:00:00Z' },
    ];

    const result = selectWinner('truck_number', candidates, 6);

    expect(result.needsAITieBreak).toBe(true);
    expect(result.tiedValues).toEqual(['B132', 'B103']);
    expect(result.winner).toBeUndefined();
  });

  it('uses recency fallback for contact fields with ties', () => {
    const candidates = [
      { value: 'John Doe 555-1234', count: 3, lastUsed: '2026-01-08T10:00:00Z' },
      { value: 'Jane Smith 555-5678', count: 3, lastUsed: '2026-01-10T10:00:00Z' }, // More recent
    ];

    const result = selectWinner('oc_contact', candidates, 6);

    // Contact fields should NOT need AI tie-break
    expect(result.needsAITieBreak).toBe(false);
    expect(result.winner).toBeDefined();
    expect(result.winner!.value).toBe('Jane Smith 555-5678'); // Most recent
    expect(result.winner!.source).toBe('recency');
    expect(result.winner!.confidence).toBe('low');
  });

  it('handles single candidate', () => {
    const candidates = [
      { value: 'B132', count: 5, lastUsed: '2026-01-10T10:00:00Z' },
    ];

    const result = selectWinner('truck_number', candidates, 5);

    expect(result.winner).toBeDefined();
    expect(result.winner!.value).toBe('B132');
    expect(result.needsAITieBreak).toBe(false);
  });

  it('handles empty candidates', () => {
    const result = selectWinner('truck_number', [], 0);

    expect(result.winner).toBeUndefined();
    expect(result.needsAITieBreak).toBe(false);
  });
});

// =============================================================================
// CONFIDENCE CALCULATION TESTS
// =============================================================================

describe('calculateConfidence', () => {
  it('returns high for 80%+ frequency', () => {
    expect(calculateConfidence(8, 10)).toBe('high');
    expect(calculateConfidence(10, 10)).toBe('high');
  });

  it('returns medium for 50-79% frequency', () => {
    expect(calculateConfidence(5, 10)).toBe('medium');
    expect(calculateConfidence(7, 10)).toBe('medium');
  });

  it('returns low for <50% frequency', () => {
    expect(calculateConfidence(4, 10)).toBe('low');
    expect(calculateConfidence(1, 10)).toBe('low');
  });

  it('returns low for zero submissions', () => {
    expect(calculateConfidence(0, 0)).toBe('low');
  });
});

// =============================================================================
// WARNINGS TESTS
// =============================================================================

describe('buildWarnings', () => {
  it('warns about no submissions', () => {
    const warnings = buildWarnings(0, 7);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('No submissions found');
  });

  it('warns about low submission count', () => {
    const warnings = buildWarnings(2, 7);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Only 2 submissions');
  });

  it('returns no warnings for sufficient submissions', () => {
    const warnings = buildWarnings(5, 7);
    expect(warnings).toHaveLength(0);
  });
});

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe('isFieldAllowed', () => {
  it('allows eligible DVIR fields', () => {
    expect(isFieldAllowed('truck_number', 'dvir')).toBe(true);
    expect(isFieldAllowed('chipper_number', 'dvir')).toBe(true);
    expect(isFieldAllowed('medical_card_required', 'dvir')).toBe(true);
  });

  it('allows eligible JSA fields', () => {
    expect(isFieldAllowed('work_location', 'jsa')).toBe(true);
    expect(isFieldAllowed('oc_contact', 'jsa')).toBe(true);
    expect(isFieldAllowed('nearest_hospital', 'jsa')).toBe(true);
  });

  it('rejects non-allowlisted fields', () => {
    expect(isFieldAllowed('hazards_present', 'jsa')).toBe(false);
    expect(isFieldAllowed('notes', 'dvir')).toBe(false);
    expect(isFieldAllowed('signatures', 'dvir')).toBe(false);
  });
});

describe('validateAIResponse', () => {
  it('validates correct AI response', () => {
    const response = {
      field: 'truck_number',
      value: 'B132',
      reason: 'Most recent usage',
    };
    const validCandidates = ['B132', 'B103'];

    const result = validateAIResponse(response, 'dvir', validCandidates);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects hallucinated values', () => {
    const response = {
      field: 'truck_number',
      value: 'FAKE123', // Not in candidates
      reason: 'Invented value',
    };
    const validCandidates = ['B132', 'B103'];

    const result = validateAIResponse(response, 'dvir', validCandidates);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not in the original candidates'))).toBe(true);
  });

  it('rejects non-allowlisted fields', () => {
    const response = {
      field: 'hazards_present', // Forbidden field
      value: 'Falls',
      reason: 'Common hazard',
    };
    const validCandidates = ['Falls', 'Electrical'];

    const result = validateAIResponse(response, 'jsa', validCandidates);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not in the allowlist'))).toBe(true);
  });

  it('rejects missing required fields', () => {
    const response = {
      field: 'truck_number',
      // Missing value and reason
    };
    const validCandidates = ['B132'];

    const result = validateAIResponse(response, 'dvir', validCandidates);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('sanitizeSuggestions', () => {
  it('removes non-allowlisted fields', () => {
    const suggestions = {
      truck_number: { value: 'B132', reason: 'test', confidence: 'high' as const, source: 'frequency' as const },
      hazards_present: { value: 'Falls', reason: 'test', confidence: 'high' as const, source: 'frequency' as const },
    };

    const sanitized = sanitizeSuggestions(suggestions, 'dvir');

    expect(sanitized).toHaveProperty('truck_number');
    expect(sanitized).not.toHaveProperty('hazards_present');
  });
});

// =============================================================================
// CONTACT FIELD TESTS
// =============================================================================

describe('isContactField', () => {
  it('identifies contact fields', () => {
    expect(isContactField('oc_contact')).toBe(true);
    expect(isContactField('doc_contact')).toBe(true);
    expect(isContactField('gf_contact')).toBe(true);
    expect(isContactField('safety_contact')).toBe(true);
  });

  it('rejects non-contact fields', () => {
    expect(isContactField('truck_number')).toBe(false);
    expect(isContactField('work_location')).toBe(false);
    expect(isContactField('nearest_hospital')).toBe(false);
  });
});

describe('redactContactFields', () => {
  it('redacts contact values', () => {
    const submissions = [
      {
        oc_contact: 'John Doe 555-1234',
        doc_contact: 'Jane Smith 555-5678',
        work_location: 'Main Street',
        truck_number: 'B132',
      },
    ];

    const redacted = redactContactFields(submissions);

    expect(redacted[0].oc_contact).toBe('[CONTACT]');
    expect(redacted[0].doc_contact).toBe('[CONTACT]');
    expect(redacted[0].work_location).toBe('Main Street'); // Not redacted
    expect(redacted[0].truck_number).toBe('B132'); // Not redacted
  });

  it('handles missing contact fields', () => {
    const submissions = [
      { truck_number: 'B132' },
    ];

    const redacted = redactContactFields(submissions);

    expect(redacted[0].truck_number).toBe('B132');
    expect(redacted[0].oc_contact).toBeUndefined();
  });
});

// =============================================================================
// FIELD NAME MAPPING TESTS
// =============================================================================

describe('mapSuggestionsToFormKeys', () => {
  it('transforms snake_case to camelCase for DVIR', () => {
    const suggestions = {
      truck_number: { value: 'B132', reason: 'test', confidence: 'high' as const, source: 'frequency' as const },
      chipper_number: { value: 'C-15', reason: 'test', confidence: 'medium' as const, source: 'frequency' as const },
    };

    const mapped = mapSuggestionsToFormKeys(suggestions, 'dvir');

    expect(mapped).toHaveProperty('truckNumber');
    expect(mapped).toHaveProperty('chipperNumber');
    expect(mapped).not.toHaveProperty('truck_number');
    expect(mapped).not.toHaveProperty('chipper_number');
  });

  it('transforms snake_case to camelCase for JSA', () => {
    const suggestions = {
      work_location: { value: 'Main St', reason: 'test', confidence: 'high' as const, source: 'frequency' as const },
      oc_contact: { value: 'John 555-1234', reason: 'test', confidence: 'low' as const, source: 'recency' as const },
    };

    const mapped = mapSuggestionsToFormKeys(suggestions, 'jsa');

    expect(mapped).toHaveProperty('workLocation');
    expect(mapped).toHaveProperty('ocContact');
    expect(mapped).not.toHaveProperty('work_location');
    expect(mapped).not.toHaveProperty('oc_contact');
  });

  it('preserves values during transformation', () => {
    const suggestions = {
      truck_number: { value: 'B132', reason: 'Most frequent', confidence: 'high' as const, source: 'frequency' as const },
    };

    const mapped = mapSuggestionsToFormKeys(suggestions, 'dvir');

    expect(mapped.truckNumber).toEqual(suggestions.truck_number);
  });
});

describe('FIELD_LABELS', () => {
  it('has labels for all DVIR fields', () => {
    const dvirFields = ['truckNumber', 'chipperNumber', 'trailerNumber', 'truckGvwr'];
    for (const field of dvirFields) {
      expect(FIELD_LABELS[field]).toBeDefined();
    }
  });

  it('has labels for all JSA fields', () => {
    const jsaFields = ['workLocation', 'circuitNumber', 'nearestHospital', 'ocContact'];
    for (const field of jsaFields) {
      expect(FIELD_LABELS[field]).toBeDefined();
    }
  });
});

// =============================================================================
// ELIGIBLE FIELDS CONFIGURATION TESTS
// =============================================================================

describe('ELIGIBLE_FIELDS', () => {
  it('has correct DVIR fields', () => {
    expect(ELIGIBLE_FIELDS.dvir).toContain('truck_number');
    expect(ELIGIBLE_FIELDS.dvir).toContain('chipper_number');
    expect(ELIGIBLE_FIELDS.dvir).toContain('trailer_number');
    expect(ELIGIBLE_FIELDS.dvir).toContain('medical_card_required');
    
    // Should NOT contain safety-critical fields
    expect(ELIGIBLE_FIELDS.dvir).not.toContain('notes');
    expect(ELIGIBLE_FIELDS.dvir).not.toContain('vehicle_trailer_checklist');
    expect(ELIGIBLE_FIELDS.dvir).not.toContain('mileage');
  });

  it('has correct JSA fields', () => {
    expect(ELIGIBLE_FIELDS.jsa).toContain('work_location');
    expect(ELIGIBLE_FIELDS.jsa).toContain('circuit_number');
    expect(ELIGIBLE_FIELDS.jsa).toContain('nearest_hospital');
    expect(ELIGIBLE_FIELDS.jsa).toContain('oc_contact');
    
    // Should NOT contain safety-critical fields
    expect(ELIGIBLE_FIELDS.jsa).not.toContain('hazards_present');
    expect(ELIGIBLE_FIELDS.jsa).not.toContain('ppe');
    expect(ELIGIBLE_FIELDS.jsa).not.toContain('weather_conditions');
  });
});

// =============================================================================
// CONTACT FIELDS CONFIGURATION TESTS
// =============================================================================

describe('CONTACT_FIELDS', () => {
  it('contains all contact fields', () => {
    expect(CONTACT_FIELDS.has('oc_contact')).toBe(true);
    expect(CONTACT_FIELDS.has('doc_contact')).toBe(true);
    expect(CONTACT_FIELDS.has('gf_contact')).toBe(true);
    expect(CONTACT_FIELDS.has('safety_contact')).toBe(true);
  });

  it('does not contain non-contact fields', () => {
    expect(CONTACT_FIELDS.has('work_location')).toBe(false);
    expect(CONTACT_FIELDS.has('truck_number')).toBe(false);
  });
});
