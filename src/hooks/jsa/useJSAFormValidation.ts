import { useMemo } from 'react';
import { useFormValidation, type ValidationRule } from '../useFormValidation';
import { validators } from '../../lib/formValidation';
import type { DailyJsaFormState } from '../../pages/forms/dailyJSAFormState';

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

  // Additional validation: spans (digital only), electrical hazards
  const additionalErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (form.submissionType === 'paper') return errs;
    const hasValidSpan = form.spans.some(s => s.location.trim() || s.hazards.trim());
    if (!hasValidSpan && form.spans.length > 0) {
      errs.spans = "At least one span must have location or hazards filled";
    }
    const electricalKeys = ['lines_energized', 'secondary_voltage', 'open_wire_secondary'];
    const hasElectricalHazard = electricalKeys.some(k => form.hazardsPresent?.[k]);
    const elec = (form as { electricalHazardData?: { voltage_kv: number; utility_company_contacted: boolean; crew_qualifications_verified: boolean; crew_qualification_issues?: string[]; second_worker_required?: boolean; second_worker_name?: string } | null }).electricalHazardData;
    if (hasElectricalHazard) {
      if (!elec || elec.voltage_kv <= 0 || elec.voltage_kv === -1) {
        errs.electricalHazardData = "Select voltage when electrical hazards are present";
      } else if (!elec.utility_company_contacted) {
        errs.electricalHazardData = "Utility company must be contacted (or acknowledge reason)";
      } else if (!elec.crew_qualifications_verified || (elec.crew_qualification_issues?.length ?? 0) > 0) {
        errs.electricalHazardData = "Crew qualifications must be verified (all qualified)";
      } else if (elec.voltage_kv > 0.75 && !elec.second_worker_name?.trim()) {
        errs.electricalHazardData = "Second qualified worker name required for voltage >750V";
      }
    }
    return errs;
  }, [form]);

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
