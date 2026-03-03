import { useMemo } from 'react';
import type { DVIRFormState } from '../../pages/forms/dvir';
import { useFormValidation, type ValidationRule } from '../useFormValidation';
import { validators } from '../../lib/formValidation';
import { VEHICLE_TRAILER_ITEMS } from '../../pages/forms/dvir';

/**
 * Custom hook for DVIR form validation
 * Handles all validation rules and manages validation state
 * Extracted to reduce DVIRForm component size
 */
export function useDVIRFormValidation(
  form: DVIRFormState,
  oilDipstickPhoto: File | null,
  previousMileage: number | null
) {
  // Validation rules for DVIR form
  const validationRules = useMemo<ValidationRule<DVIRFormState & { oilDipstickPhoto?: File | null }>[]>(() => [
    {
      field: 'truckNumber',
      validator: (value: unknown) => validators.required(value) || (typeof value === 'string' && value?.trim() ? null : "Please select a truck number"),
    },
    {
      field: 'driversName',
      validator: (value: unknown) => validators.required(value) || (typeof value === 'string' && value?.trim() ? null : "Driver's name is required"),
    },
    {
      field: 'mileage',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) {
          return "Odometer reading is required";
        }
        const numVal = Number(String(value).trim());
        if (Number.isNaN(numVal) || numVal < 0) {
          return "Odometer reading must be a valid number";
        }
        return validators.mileage(value, previousMileage);
      },
    },
    {
      field: 'vehicleTrailerChecklist',
      validator: (value: unknown) => {
        const count = Object.keys((value as Record<string, unknown>) || {}).length;
        if (count < VEHICLE_TRAILER_ITEMS.length) {
          return `Complete vehicle inspection: ${count}/${VEHICLE_TRAILER_ITEMS.length} items checked`;
        }
        return null;
      },
    },
  ], [previousMileage]);

  // Extended form state for validation (includes non-persisted fields)
  const extendedFormState = useMemo(() => ({
    ...form,
    oilDipstickPhoto,
  }), [form, oilDipstickPhoto]);

  // Form validation hook
  const {
    errors,
    getFieldError,
    shouldShowError,
    validateAll,
    markSubmitAttempted,
    handleFieldBlur,
  } = useFormValidation(extendedFormState, validationRules, {
    validateOnChange: true,
    showErrorsAfterSubmitAttempt: false,
  });

  // Additional validation for non-form-state fields
  const additionalErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    
    if (!oilDipstickPhoto) {
      errs.oilDipstickPhoto = "Oil dipstick photo is required";
    }
    
    const hasDriver = Boolean(form.finalDriverSignature?.trim());
    const hasForeman = Boolean(form.generalForemanSignature?.trim());
    if (!hasDriver && !hasForeman) {
      errs.signature = "At least one signature (Driver or Foreman) is required";
    }

    const vehicleHasFail = Object.values(form.vehicleTrailerChecklist).some((v) => v === "F");
    const aerialHasFail = Object.values(form.aerialChecklist).some((v) => v === "F");
    if (vehicleHasFail && !form.notes?.trim()) {
      errs.notes = "Defect notes are required when items are marked Fail.";
    }
    if (aerialHasFail && !form.aerialNotes?.trim()) {
      errs.aerialNotes = "Defect notes are required when aerial items are marked Fail.";
    }
    
    return errs;
  }, [oilDipstickPhoto, form.finalDriverSignature, form.generalForemanSignature, form.vehicleTrailerChecklist, form.aerialChecklist, form.notes, form.aerialNotes]);

  // Combined errors
  const allErrors = useMemo(() => {
    return { ...errors, ...additionalErrors };
  }, [errors, additionalErrors]);

  return {
    errors,
    getFieldError,
    shouldShowError,
    validateAll,
    markSubmitAttempted,
    handleFieldBlur,
    additionalErrors,
    allErrors,
  };
}
