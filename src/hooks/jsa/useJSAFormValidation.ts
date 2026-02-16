import { useMemo } from 'react';
import { useFormValidation, type ValidationRule } from '../useFormValidation';
import { validators } from '../../lib/formValidation';
import type { DailyJsaFormState } from '../../pages/forms/DailyJSAForm';

function jobDateValidator(value: unknown): string | null {
  return validators.required(value) || (typeof value === 'string' && value?.trim() ? null : "Job date is required");
}

function workLocationValidator(value: unknown): string | null {
  return validators.required(value) || (typeof value === 'string' && value?.trim() ? null : "Work location is required");
}

function employeeSignatureValidator(value: unknown, form?: unknown): string | null {
  const state = form as DailyJsaFormState | undefined;
  if (state?.employeeSignaturePath?.trim()) return null;
  return validators.signature(value);
}

/**
 * Returns validation rules for the given submission type.
 * Paper mode: date, location, at least one photo, signature.
 * Digital mode: full form rules including contacts, jobs, spans.
 */
export function getValidationRules(submissionType: 'digital' | 'paper'): ValidationRule<DailyJsaFormState>[] {
  const shared: ValidationRule<DailyJsaFormState>[] = [
    { field: 'jobDate', validator: jobDateValidator },
    { field: 'workLocation', validator: workLocationValidator },
    { field: 'employeeSignature', validator: employeeSignatureValidator },
  ];

  if (submissionType === 'paper') {
    return [
      ...shared,
      {
        field: 'jsaPhotoPaths',
        validator: (value: unknown) =>
          Array.isArray(value) && value.length > 0 ? null : 'At least one photo is required',
      },
    ];
  }

  return [
    ...shared,
    {
      field: 'ocContact',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) return "OC Name & Telephone is required";
        return validators.phone(value);
      },
    },
    {
      field: 'docContact',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) return "DOC Telephone is required";
        return validators.phone(value);
      },
    },
    {
      field: 'gfContact',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) return "GF & Telephone is required";
        return validators.phone(value);
      },
    },
    {
      field: 'safetyContact',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) return "Safety & Telephone is required";
        return validators.phone(value);
      },
    },
    {
      field: 'jobsPerformed',
      validator: (value: unknown) => {
        if (!value || (Array.isArray(value) && value.length === 0)) {
          return "Select at least one job performed";
        }
        return null;
      },
    },
  ];
}

/**
 * Custom hook for JSA form validation.
 * Rules branch on form.submissionType (paper vs digital).
 */
export function useJSAFormValidation(form: DailyJsaFormState) {
  const validationRules = useMemo<ValidationRule<DailyJsaFormState>[]>(
    () => getValidationRules(form.submissionType),
    [form.submissionType]
  );

  type FormValidationState = DailyJsaFormState & Record<string, unknown>;
  const {
    errors,
    getFieldError,
    shouldShowError,
    validateAll,
    markSubmitAttempted,
    handleFieldBlur,
  } = useFormValidation<FormValidationState>(form as FormValidationState, validationRules as ValidationRule<FormValidationState>[], {
    validateOnChange: true,
    showErrorsAfterSubmitAttempt: false,
  });

  // Additional validation: spans (digital only)
  const additionalErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (form.submissionType === 'paper') return errs;
    const hasValidSpan = form.spans.some(s => s.location.trim() || s.hazards.trim());
    if (!hasValidSpan && form.spans.length > 0) {
      errs.spans = "At least one span must have location or hazards filled";
    }
    return errs;
  }, [form.submissionType, form.spans]);

  const allErrors = useMemo(() => {
    const combined: Record<string, string> = {};
    Object.entries(errors).forEach(([key, value]) => {
      if (value && typeof value === 'string') combined[key] = value;
    });
    Object.entries(additionalErrors).forEach(([key, value]) => {
      if (value && typeof value === 'string') combined[key] = value;
    });
    return combined;
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
