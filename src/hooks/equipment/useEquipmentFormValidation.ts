import { useMemo, useCallback } from 'react';
import { useFormValidation, type ValidationRule } from '../useFormValidation';
import { validators } from '../../lib/formValidation';
import type { EquipmentFormState, PhotoState, EquipmentFormFieldKey } from '../../pages/forms/equipmentConstants';
import { GENERAL_ITEMS, EQUIPMENT_NUMBERS_BY_TYPE } from '../../pages/forms/equipmentConstants';

/** Base form state type used by validation hook */
type ExtendedFormState = EquipmentFormState & { photos?: PhotoState };

/**
 * Custom hook for Equipment Inspection form validation.
 * Handles all validation rules and manages validation state.
 * Aligns with useDVIRFormValidation and useJSAFormValidation pattern.
 */
export function useEquipmentFormValidation(
  form: EquipmentFormState,
  photos: PhotoState
) {
  const validationRules = useMemo<ValidationRule<ExtendedFormState>[]>(() => [
    {
      field: 'submittedBy',
      validator: (value: unknown) => validators.required(value) || (typeof value === 'string' && value?.trim() ? null : "Submitted By is required"),
    },
    {
      field: 'equipmentType',
      validator: (value: unknown) => validators.required(value) || (value ? null : "Select an equipment type"),
    },
    {
      field: 'equipmentNumber',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) {
          return "Select an equipment number";
        }
        const currentAvailable = form.equipmentType ? EQUIPMENT_NUMBERS_BY_TYPE[form.equipmentType as keyof typeof EQUIPMENT_NUMBERS_BY_TYPE] ?? [] : [];
        if (!currentAvailable.includes(String(value).trim())) {
          return "Select a valid equipment number for the chosen type";
        }
        return null;
      },
    },
    {
      field: 'generalChecklist',
      validator: (value: unknown) => {
        const count = Object.keys((value as Record<string, unknown>) || {}).filter(
          (key) => (value as Record<string, unknown>)[key] === "P" || (value as Record<string, unknown>)[key] === "F" || (value as Record<string, unknown>)[key] === "N/A"
        ).length;
        if (count < GENERAL_ITEMS.length) {
          return `Complete general checklist: ${count}/${GENERAL_ITEMS.length} items checked`;
        }
        return null;
      },
    },
  ], [form.equipmentType]);

  const extendedFormState = useMemo(() => ({
    ...form,
    photos,
  }), [form, photos]);

  const {
    errors,
    getFieldError: baseGetFieldError,
    shouldShowError: baseShouldShowError,
    validateAll,
    markSubmitAttempted,
    handleFieldBlur: baseHandleFieldBlur,
    touched,
  } = useFormValidation(extendedFormState, validationRules, {
    validateOnChange: true,
    showErrorsAfterSubmitAttempt: false,
  });

  const additionalErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!photos.hydraulic) {
      errs.hydraulicPhoto = "Hydraulic fluid level photo is required before submitting";
    }
    return errs;
  }, [photos.hydraulic]);

  const allErrors = useMemo(() => {
    return { ...errors, ...additionalErrors };
  }, [errors, additionalErrors]);

  /**
   * Extended getFieldError that includes additionalErrors (e.g. hydraulicPhoto).
   * Accepts EquipmentFormFieldKey to support both base form fields and extended fields.
   */
  const getFieldError = useCallback((field: EquipmentFormFieldKey): string | undefined => {
    // Check base form errors first
    const baseField = field as keyof ExtendedFormState;
    const baseError = baseGetFieldError(baseField);
    if (baseError) return baseError;
    // Check additional errors (e.g. hydraulicPhoto)
    return additionalErrors[field];
  }, [baseGetFieldError, additionalErrors]);

  /**
   * Extended shouldShowError that handles additional fields like hydraulicPhoto.
   */
  const shouldShowError = useCallback((field: EquipmentFormFieldKey): boolean => {
    // For extended fields like hydraulicPhoto, always show error if present
    if (field === 'hydraulicPhoto') {
      return !!additionalErrors.hydraulicPhoto;
    }
    // Use base implementation for standard form fields
    return baseShouldShowError(field as keyof ExtendedFormState);
  }, [baseShouldShowError, additionalErrors]);

  /**
   * Extended handleFieldBlur - passes through to base for standard fields.
   */
  const handleFieldBlur = useCallback((field: EquipmentFormFieldKey): void => {
    // Only call base handler for actual form fields (not synthetic fields like hydraulicPhoto)
    if (field !== 'hydraulicPhoto') {
      baseHandleFieldBlur(field as keyof ExtendedFormState);
    }
  }, [baseHandleFieldBlur]);

  return {
    errors,
    getFieldError,
    shouldShowError,
    validateAll,
    markSubmitAttempted,
    handleFieldBlur,
    additionalErrors,
    allErrors,
    touched,
  };
}
