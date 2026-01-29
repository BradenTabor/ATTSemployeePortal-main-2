import { useMemo } from 'react';
import { useFormValidation, type ValidationRule } from '../useFormValidation';
import { validators } from '../../lib/formValidation';
import type { DailyJsaFormState } from '../../pages/forms/DailyJSAForm';

/**
 * Custom hook for JSA form validation
 * Handles all validation rules and manages validation state
 * Extracted to reduce DailyJSAForm component size
 */
export function useJSAFormValidation(form: DailyJsaFormState) {
  // Validation rules for JSA form
  const validationRules = useMemo<ValidationRule<DailyJsaFormState>[]>(() => [
    {
      field: 'jobDate',
      validator: (value: unknown) => validators.required(value) || (typeof value === 'string' && value?.trim() ? null : "Job date is required"),
    },
    {
      field: 'workLocation',
      validator: (value: unknown) => validators.required(value) || (typeof value === 'string' && value?.trim() ? null : "Work location is required"),
    },
    {
      field: 'ocContact',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) {
          return "OC Name & Telephone is required";
        }
        return validators.phone(value);
      },
    },
    {
      field: 'docContact',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) {
          return "DOC Telephone is required";
        }
        return validators.phone(value);
      },
    },
    {
      field: 'gfContact',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) {
          return "GF & Telephone is required";
        }
        return validators.phone(value);
      },
    },
    {
      field: 'safetyContact',
      validator: (value: unknown) => {
        if (!value || !String(value).trim()) {
          return "Safety & Telephone is required";
        }
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
    {
      field: 'employeeSignature',
      validator: (value: unknown, form?: unknown) => {
        const state = form as DailyJsaFormState | undefined;
        if (state?.employeeSignaturePath?.trim()) return null;
        return validators.signature(value);
      },
    },
  ], []);

  // Form validation hook - use FormValidationState type for constraint compatibility
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

  // Additional validation for complex fields
  const additionalErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    
    // Spans validation (at least one span with location or hazards)
    const hasValidSpan = form.spans.some(s => s.location.trim() || s.hazards.trim());
    if (!hasValidSpan && form.spans.length > 0) {
      errs.spans = "At least one span must have location or hazards filled";
    }
    
    return errs;
  }, [form.spans]);

  // Combined errors (filter out undefined values)
  const allErrors = useMemo(() => {
    const combined: Record<string, string> = {};
    
    // Add validation errors (filter out undefined)
    Object.entries(errors).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        combined[key] = value;
      }
    });
    
    // Add additional errors (filter out undefined)
    Object.entries(additionalErrors).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        combined[key] = value;
      }
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
