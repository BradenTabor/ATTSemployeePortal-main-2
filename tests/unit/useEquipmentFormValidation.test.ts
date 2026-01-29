/**
 * useEquipmentFormValidation hook unit tests (BL-002)
 *
 * Tests validation rules for Daily Equipment Inspection form:
 * required fields (submittedBy, equipmentType, equipmentNumber),
 * general checklist completion, and hydraulic photo requirement.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEquipmentFormValidation } from '../../src/hooks/equipment';
import {
  GENERAL_ITEMS,
  type EquipmentFormState,
  type PhotoState,
  type ChecklistValue,
} from '../../src/pages/forms/equipmentConstants';

const today = new Date().toISOString().split('T')[0];

function createEmptyFormState(overrides: Partial<EquipmentFormState> = {}): EquipmentFormState {
  return {
    submittedBy: '',
    equipmentType: '',
    equipmentNumber: '',
    inspectionDate: today,
    template: '',
    notes: '',
    generalChecklist: {},
    specificChecklist: {},
    ...overrides,
  };
}

function createFullGeneralChecklist(): Record<string, ChecklistValue> {
  const out: Record<string, ChecklistValue> = {};
  GENERAL_ITEMS.forEach((item) => {
    out[item.id] = 'P';
  });
  return out;
}

function createValidFormState(overrides: Partial<EquipmentFormState> = {}): EquipmentFormState {
  return createEmptyFormState({
    submittedBy: 'Test User',
    equipmentType: 'Jarraff',
    equipmentNumber: 'J-109',
    generalChecklist: createFullGeneralChecklist(),
    ...overrides,
  });
}

describe('useEquipmentFormValidation', () => {
  describe('required fields', () => {
    it('returns submittedBy error when empty', () => {
      const form = createEmptyFormState();
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      act(() => {
        result.current.validateAll();
      });
      // validators.required() returns "This field is required" for empty values
      expect(result.current.getFieldError('submittedBy')).toBe('This field is required');
      expect(result.current.allErrors.submittedBy).toBe('This field is required');
    });

    it('returns equipmentType error when empty', () => {
      const form = createEmptyFormState({ submittedBy: 'User' });
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      act(() => {
        result.current.validateAll();
      });
      expect(result.current.getFieldError('equipmentType')).toBe('This field is required');
    });

    it('returns equipmentNumber error when empty', () => {
      const form = createEmptyFormState({
        submittedBy: 'User',
        equipmentType: 'Jarraff',
      });
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      act(() => {
        result.current.validateAll();
      });
      expect(result.current.getFieldError('equipmentNumber')).toBe('Select an equipment number');
    });

    it('returns equipmentNumber error when number does not match type', () => {
      const form = createEmptyFormState({
        submittedBy: 'User',
        equipmentType: 'Jarraff',
        equipmentNumber: 'G-126', // Geo-Boy number with Jarraff type
      });
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      act(() => {
        result.current.validateAll();
      });
      expect(result.current.getFieldError('equipmentNumber')).toBe(
        'Select a valid equipment number for the chosen type'
      );
    });

    it('accepts valid equipment number for selected type', () => {
      const form = createEmptyFormState({
        submittedBy: 'User',
        equipmentType: 'Jarraff',
        equipmentNumber: 'J-109',
      });
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      expect(result.current.getFieldError('equipmentNumber')).toBeUndefined();
    });
  });

  describe('general checklist', () => {
    it('returns error when checklist is incomplete', () => {
      const form = createEmptyFormState({
        submittedBy: 'User',
        equipmentType: 'Jarraff',
        equipmentNumber: 'J-109',
        generalChecklist: { engine_oil_level: 'P' },
      });
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      act(() => {
        result.current.validateAll();
      });
      const err = result.current.getFieldError('generalChecklist');
      expect(err).toBeDefined();
      expect(err).toContain('Complete general checklist');
      expect(err).toContain(`1/${GENERAL_ITEMS.length}`);
    });

    it('accepts when all general checklist items are checked', () => {
      const form = createValidFormState();
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      expect(result.current.getFieldError('generalChecklist')).toBeUndefined();
    });
  });

  describe('hydraulic photo', () => {
    it('returns hydraulicPhoto error when no hydraulic photo', () => {
      const form = createValidFormState();
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      expect(result.current.additionalErrors.hydraulicPhoto).toBe(
        'Hydraulic fluid level photo is required before submitting'
      );
      expect(result.current.allErrors.hydraulicPhoto).toBe(
        'Hydraulic fluid level photo is required before submitting'
      );
      expect(result.current.getFieldError('hydraulicPhoto')).toBe(
        'Hydraulic fluid level photo is required before submitting'
      );
    });

    it('clears hydraulicPhoto error when hydraulic photo provided', () => {
      const form = createValidFormState();
      const hydraulicFile = new File([''], 'hydraulic.jpg', { type: 'image/jpeg' });
      const photos: PhotoState = { hydraulic: hydraulicFile };
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      expect(result.current.additionalErrors.hydraulicPhoto).toBeUndefined();
      expect(result.current.allErrors.hydraulicPhoto).toBeUndefined();
      expect(result.current.getFieldError('hydraulicPhoto')).toBeUndefined();
    });
  });

  describe('validateAll', () => {
    it('returns isValid false when required fields missing', () => {
      const form = createEmptyFormState();
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      let validationResult: { isValid: boolean };
      act(() => {
        result.current.markSubmitAttempted();
        validationResult = result.current.validateAll();
      });

      expect(validationResult!.isValid).toBe(false);
    });

    it('surfaces hydraulicPhoto in allErrors when hydraulic photo missing', () => {
      const form = createValidFormState();
      const photos: PhotoState = {};
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      expect(result.current.allErrors.hydraulicPhoto).toBe(
        'Hydraulic fluid level photo is required before submitting'
      );
      // validateAll() only runs rule-based validation; submit handler must also check additionalErrors/allErrors
      act(() => {
        result.current.markSubmitAttempted();
      });
      expect(result.current.getFieldError('hydraulicPhoto')).toBeDefined();
    });

    it('returns isValid true when form and hydraulic photo are valid', () => {
      const form = createValidFormState();
      const hydraulicFile = new File([''], 'hydraulic.jpg', { type: 'image/jpeg' });
      const photos: PhotoState = { hydraulic: hydraulicFile };
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      let validationResult: { isValid: boolean };
      act(() => {
        result.current.markSubmitAttempted();
        validationResult = result.current.validateAll();
      });

      expect(validationResult!.isValid).toBe(true);
      expect(Object.keys(result.current.allErrors).length).toBe(0);
    });
  });

  describe('equipment type / number consistency', () => {
    it.each([
      ['Geo-Boy', 'G-126'],
      ['Grapple', '211'],
      ['Mulcher', '212'],
      ['Skidsteer', '118'],
    ] as const)('accepts valid %s with number %s', (type, number) => {
      const form = createEmptyFormState({
        submittedBy: 'User',
        equipmentType: type,
        equipmentNumber: number,
        generalChecklist: createFullGeneralChecklist(),
      });
      const hydraulicFile = new File([''], 'hydraulic.jpg', { type: 'image/jpeg' });
      const photos: PhotoState = { hydraulic: hydraulicFile };
      const { result } = renderHook(() => useEquipmentFormValidation(form, photos));

      expect(result.current.getFieldError('equipmentNumber')).toBeUndefined();
      expect(result.current.getFieldError('equipmentType')).toBeUndefined();
    });
  });
});
