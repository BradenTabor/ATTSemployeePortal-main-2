/**
 * Field Name Map Unit Tests
 * 
 * Tests for snake_case ↔ camelCase field mapping utilities
 * used by Smart Defaults feature.
 */

import { describe, it, expect } from 'vitest';
import {
  FIELD_NAME_MAP,
  REVERSE_FIELD_MAP,
  FIELD_LABELS,
  mapSuggestionsToFormKeys,
  mapFormKeysToDbColumns,
  getFieldLabel,
} from '@/services/safety-agent/lib/fieldNameMap';

// =============================================================================
// CONSTANTS TESTS
// =============================================================================

describe('FIELD_NAME_MAP', () => {
  it('contains dvir mappings', () => {
    expect(FIELD_NAME_MAP.dvir).toBeDefined();
    expect(Object.keys(FIELD_NAME_MAP.dvir).length).toBeGreaterThan(0);
  });

  it('contains jsa mappings', () => {
    expect(FIELD_NAME_MAP.jsa).toBeDefined();
    expect(Object.keys(FIELD_NAME_MAP.jsa).length).toBeGreaterThan(0);
  });

  it('maps dvir database columns to camelCase', () => {
    expect(FIELD_NAME_MAP.dvir['truck_number']).toBe('truckNumber');
    expect(FIELD_NAME_MAP.dvir['chipper_number']).toBe('chipperNumber');
    expect(FIELD_NAME_MAP.dvir['trailer_number']).toBe('trailerNumber');
    expect(FIELD_NAME_MAP.dvir['truck_gvwr']).toBe('truckGvwr');
    expect(FIELD_NAME_MAP.dvir['medical_card_required']).toBe('medicalCardRequired');
  });

  it('maps jsa database columns to camelCase', () => {
    expect(FIELD_NAME_MAP.jsa['work_location']).toBe('workLocation');
    expect(FIELD_NAME_MAP.jsa['circuit_number']).toBe('circuitNumber');
    expect(FIELD_NAME_MAP.jsa['nearest_hospital']).toBe('nearestHospital');
    expect(FIELD_NAME_MAP.jsa['oc_contact']).toBe('ocContact');
  });
});

describe('REVERSE_FIELD_MAP', () => {
  it('is the inverse of FIELD_NAME_MAP for dvir', () => {
    for (const [dbKey, formKey] of Object.entries(FIELD_NAME_MAP.dvir)) {
      expect(REVERSE_FIELD_MAP.dvir[formKey]).toBe(dbKey);
    }
  });

  it('is the inverse of FIELD_NAME_MAP for jsa', () => {
    for (const [dbKey, formKey] of Object.entries(FIELD_NAME_MAP.jsa)) {
      expect(REVERSE_FIELD_MAP.jsa[formKey]).toBe(dbKey);
    }
  });
});

describe('FIELD_LABELS', () => {
  it('has labels for dvir fields', () => {
    expect(FIELD_LABELS.truckNumber).toBe('Truck Number');
    expect(FIELD_LABELS.chipperNumber).toBe('Chipper Number');
    expect(FIELD_LABELS.trailerNumber).toBe('Trailer Number');
    expect(FIELD_LABELS.medicalCardRequired).toBe('Medical Card Required');
  });

  it('has labels for jsa fields', () => {
    expect(FIELD_LABELS.workLocation).toBe('Work Location');
    expect(FIELD_LABELS.nearestHospital).toBe('Nearest Hospital');
    expect(FIELD_LABELS.ocContact).toBe('OC Contact');
    expect(FIELD_LABELS.gfContact).toBe('GF Contact');
  });
});

// =============================================================================
// FUNCTION TESTS
// =============================================================================

describe('mapSuggestionsToFormKeys', () => {
  it('transforms dvir database keys to form keys', () => {
    const dbSuggestions = {
      truck_number: { value: 'B132', confidence: 'high' },
      chipper_number: { value: 'C45', confidence: 'medium' },
    };

    const result = mapSuggestionsToFormKeys(dbSuggestions, 'dvir');

    expect(result.truckNumber).toEqual({ value: 'B132', confidence: 'high' });
    expect(result.chipperNumber).toEqual({ value: 'C45', confidence: 'medium' });
    // Original keys should not exist
    expect(result['truck_number' as keyof typeof result]).toBeUndefined();
  });

  it('transforms jsa database keys to form keys', () => {
    const dbSuggestions = {
      work_location: { value: '123 Main St', confidence: 'high' },
      nearest_hospital: { value: 'Memorial Hospital', confidence: 'medium' },
      oc_contact: { value: '555-1234', confidence: 'low' },
    };

    const result = mapSuggestionsToFormKeys(dbSuggestions, 'jsa');

    expect(result.workLocation).toEqual({ value: '123 Main St', confidence: 'high' });
    expect(result.nearestHospital).toEqual({ value: 'Memorial Hospital', confidence: 'medium' });
    expect(result.ocContact).toEqual({ value: '555-1234', confidence: 'low' });
  });

  it('preserves keys not in the mapping', () => {
    const dbSuggestions = {
      truck_number: { value: 'B132' },
      unknown_field: { value: 'test' },
    };

    const result = mapSuggestionsToFormKeys(dbSuggestions, 'dvir');

    expect(result.truckNumber).toEqual({ value: 'B132' });
    // Unknown fields should be preserved as-is
    expect(result.unknown_field).toEqual({ value: 'test' });
  });

  it('handles empty suggestions object', () => {
    const result = mapSuggestionsToFormKeys({}, 'dvir');
    expect(result).toEqual({});
  });

  it('preserves all properties of suggestion values', () => {
    const dbSuggestions = {
      truck_number: {
        value: 'B132',
        reason: 'Used 5 times',
        confidence: 'high' as const,
        source: 'frequency' as const,
      },
    };

    const result = mapSuggestionsToFormKeys(dbSuggestions, 'dvir');

    expect(result.truckNumber).toEqual({
      value: 'B132',
      reason: 'Used 5 times',
      confidence: 'high',
      source: 'frequency',
    });
  });
});

describe('mapFormKeysToDbColumns', () => {
  it('transforms dvir form keys back to database columns', () => {
    const formData = {
      truckNumber: 'B132',
      chipperNumber: 'C45',
      trailerNumber: 'T99',
    };

    const result = mapFormKeysToDbColumns(formData, 'dvir');

    expect(result.truck_number).toBe('B132');
    expect(result.chipper_number).toBe('C45');
    expect(result.trailer_number).toBe('T99');
  });

  it('transforms jsa form keys back to database columns', () => {
    const formData = {
      workLocation: '123 Main St',
      nearestHospital: 'Memorial Hospital',
      circuitNumber: 'CKT-001',
    };

    const result = mapFormKeysToDbColumns(formData, 'jsa');

    expect(result.work_location).toBe('123 Main St');
    expect(result.nearest_hospital).toBe('Memorial Hospital');
    expect(result.circuit_number).toBe('CKT-001');
  });

  it('preserves keys not in the mapping', () => {
    const formData = {
      truckNumber: 'B132',
      customField: 'custom value',
    };

    const result = mapFormKeysToDbColumns(formData, 'dvir');

    expect(result.truck_number).toBe('B132');
    expect(result.customField).toBe('custom value');
  });

  it('handles empty data object', () => {
    const result = mapFormKeysToDbColumns({}, 'jsa');
    expect(result).toEqual({});
  });

  it('is inverse of mapSuggestionsToFormKeys', () => {
    // Round-trip test: db -> form -> db should preserve values
    const original = {
      truck_number: 'B132',
      chipper_number: 'C45',
    };

    const asForm = mapSuggestionsToFormKeys(original, 'dvir');
    const backToDb = mapFormKeysToDbColumns(asForm, 'dvir');

    expect(backToDb).toEqual(original);
  });
});

describe('getFieldLabel', () => {
  it('returns known labels for dvir fields', () => {
    expect(getFieldLabel('truckNumber')).toBe('Truck Number');
    expect(getFieldLabel('chipperNumber')).toBe('Chipper Number');
    expect(getFieldLabel('medicalCardRequired')).toBe('Medical Card Required');
  });

  it('returns known labels for jsa fields', () => {
    expect(getFieldLabel('workLocation')).toBe('Work Location');
    expect(getFieldLabel('nearestHospital')).toBe('Nearest Hospital');
    expect(getFieldLabel('ocContact')).toBe('OC Contact');
  });

  it('converts camelCase to Title Case for unknown fields', () => {
    expect(getFieldLabel('unknownField')).toBe('Unknown Field');
    expect(getFieldLabel('someNewField')).toBe('Some New Field');
    expect(getFieldLabel('anotherTestCase')).toBe('Another Test Case');
  });

  it('handles single word fields', () => {
    expect(getFieldLabel('name')).toBe('Name');
    expect(getFieldLabel('status')).toBe('Status');
  });

  it('handles fields with multiple consecutive capitals', () => {
    expect(getFieldLabel('userID')).toBe('User I D');
    expect(getFieldLabel('apiURL')).toBe('Api U R L');
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  it('handles boolean values in suggestions', () => {
    const dbSuggestions = {
      medical_card_required: { value: true, confidence: 'high' },
      has_medical_card: { value: false, confidence: 'medium' },
    };

    const result = mapSuggestionsToFormKeys(dbSuggestions, 'dvir');

    expect(result.medicalCardRequired).toEqual({ value: true, confidence: 'high' });
    expect(result.hasMedicalCard).toEqual({ value: false, confidence: 'medium' });
  });

  it('handles null and undefined values', () => {
    const dbSuggestions = {
      truck_number: { value: null },
      chipper_number: { value: undefined },
    };

    const result = mapSuggestionsToFormKeys(dbSuggestions, 'dvir');

    expect(result.truckNumber).toEqual({ value: null });
    expect(result.chipperNumber).toEqual({ value: undefined });
  });

  it('handles numeric values', () => {
    const dbSuggestions = {
      truck_gvwr: { value: 10000, confidence: 'high' },
    };

    const result = mapSuggestionsToFormKeys(dbSuggestions, 'dvir');

    expect(result.truckGvwr).toEqual({ value: 10000, confidence: 'high' });
  });

  it('preserves special characters in values', () => {
    const dbSuggestions = {
      work_location: { value: "123 Main St, Suite #4 (Building A)" },
    };

    const result = mapSuggestionsToFormKeys(dbSuggestions, 'jsa');

    expect(result.workLocation.value).toBe("123 Main St, Suite #4 (Building A)");
  });
});
