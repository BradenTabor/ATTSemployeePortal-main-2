/**
 * Form Validation Utilities
 * 
 * Centralized validation rules and helpers for form validation.
 * Extracts and reuses existing validation patterns from forms.
 */

// Phone validation pattern extracted from DailyJSAForm.tsx
export const PHONE_PATTERN = /[+\d][\d\s().-]{6,}/;

/**
 * Validation result type
 */
export type ValidationResult = string | null; // null = valid, string = error message

/**
 * Base validator function type
 */
export type Validator<T = unknown> = (value: T, form?: unknown, context?: unknown) => ValidationResult;

/**
 * Async validator function type
 * Supports optional AbortSignal for cancellation
 */
export type AsyncValidator<T = unknown> = (
  value: T, 
  form?: unknown, 
  signal?: AbortSignal
) => Promise<ValidationResult>;

export const validators = {
  /**
   * Required field validator
   */
  required: (value: unknown): ValidationResult => {
    if (value === null || value === undefined) {
      return "This field is required";
    }
    if (typeof value === 'string' && !value.trim()) {
      return "This field is required";
    }
    if (Array.isArray(value) && value.length === 0) {
      return "At least one item is required";
    }
    if (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0) {
      return "This field is required";
    }
    return null;
  },

  /**
   * Phone number validator (reuses PHONE_PATTERN)
   */
  phone: (value: unknown): ValidationResult => {
    if (!value || !String(value).trim()) {
      return "Phone number is required";
    }
    if (!PHONE_PATTERN.test(String(value).trim())) {
      return "Enter a valid phone number (e.g., 555-123-4567)";
    }
    return null;
  },

  /**
   * Mileage validator
   */
  mileage: (value: unknown, previousMileage?: number | null): ValidationResult => {
    const num = typeof value === 'string' 
      ? parseInt(value.replace(/[^\d]/g, ''), 10)
      : typeof value === 'number'
      ? value
      : NaN;
    
    if (!value || isNaN(num) || num <= 0) {
      return "Enter a valid odometer reading";
    }
    
    if (previousMileage !== null && previousMileage !== undefined && num <= previousMileage) {
      return `Odometer reading must be greater than ${previousMileage.toLocaleString()} mi`;
    }
    
    return null;
  },

  /**
   * Numeric validator
   */
  numeric: (value: unknown): ValidationResult => {
    const num = typeof value === 'string' 
      ? parseFloat(value.replace(/[^\d.]/g, ''))
      : typeof value === 'number'
      ? value
      : NaN;
    
    if (isNaN(num)) {
      return "Enter a valid number";
    }
    return null;
  },

  /**
   * Positive number validator
   */
  positive: (value: unknown): ValidationResult => {
    const num = typeof value === 'string' 
      ? parseFloat(value.replace(/[^\d.]/g, ''))
      : typeof value === 'number'
      ? value
      : NaN;
    
    if (isNaN(num) || num <= 0) {
      return "Enter a number greater than zero";
    }
    return null;
  },

  /**
   * Email validator
   */
  email: (value: unknown): ValidationResult => {
    if (!value || !String(value).trim()) {
      return "Email is required";
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(String(value).trim())) {
      return "Enter a valid email address";
    }
    return null;
  },

  /**
   * Signature validator
   */
  signature: (value: unknown): ValidationResult => {
    if (!value || !String(value).trim()) {
      return "Signature is required before submitting";
    }
    return null;
  },

  /**
   * File/Photo validator
   */
  file: (file: File | null | undefined, required: boolean = true): ValidationResult => {
    if (required && !file) {
      return "Photo is required before submitting";
    }
    return null;
  },

  /**
   * Checklist completion validator
   */
  checklist: (
    checklist: Record<string, unknown>,
    requiredCount: number,
    label: string = "items"
  ): ValidationResult => {
    const completedCount = Object.keys(checklist).length;
    if (completedCount < requiredCount) {
      return `Complete ${label}: ${completedCount}/${requiredCount} ${label} checked`;
    }
    return null;
  },

  /**
   * At least one signature validator
   */
  atLeastOneSignature: (
    signatures: { driver?: boolean; foreman?: boolean; [key: string]: unknown }
  ): ValidationResult => {
    const hasSignature = Object.values(signatures).some(
      sig => sig === true || (typeof sig === 'string' && sig.trim())
    );
    if (!hasSignature) {
      return "At least one signature (Driver or Foreman) is required";
    }
    return null;
  },

  /**
   * Equipment number validator (validates against available options)
   */
  equipmentNumber: (
    value: unknown,
    availableNumbers: string[]
  ): ValidationResult => {
    if (!value || !String(value).trim()) {
      return "Select an equipment number";
    }
    if (!availableNumbers.includes(String(value).trim())) {
      return "Select a valid equipment number for the chosen type";
    }
    return null;
  },
};

/**
 * Combine multiple validators
 */
export function combineValidators<T = unknown>(
  ...validators: Validator<T>[]
): Validator<T> {
  return (value: T, form?: unknown, context?: unknown) => {
    for (const validator of validators) {
      const result = validator(value, form, context);
      if (result !== null) {
        return result;
      }
    }
    return null;
  };
}

/**
 * Create a custom validator with a custom error message
 */
export function createValidator<T = unknown>(
  test: (value: T, form?: unknown, context?: unknown) => boolean,
  errorMessage: string | ((value: T, form?: unknown, context?: unknown) => string)
): Validator<T> {
  return (value: T, form?: unknown, context?: unknown) => {
    if (!test(value, form, context)) {
      return typeof errorMessage === 'function' 
        ? errorMessage(value, form, context)
        : errorMessage;
    }
    return null;
  };
}
