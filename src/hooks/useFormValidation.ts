/**
 * useFormValidation Hook
 * 
 * Manages form validation state with progressive disclosure and real-time feedback.
 * Extends existing validation patterns instead of duplicating logic.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Validator, AsyncValidator } from '../lib/formValidation';
import { debounce } from '../lib/debounce';
import { logger } from '../lib/logger';

export interface ValidationRule<T = Record<string, unknown>> {
  field: keyof T;
  validator: Validator<unknown>;
  validateOn?: 'change' | 'blur' | 'submit';
}

export interface AsyncValidationRule<T = Record<string, unknown>> {
  field: keyof T;
  validator: AsyncValidator<unknown>;
  debounce?: number; // Default 300ms
}

export interface UseFormValidationOptions<T> {
  /**
   * Validate fields on change (debounced)
   */
  validateOnChange?: boolean;
  
  /**
   * Show errors only after submit attempt
   */
  showErrorsAfterSubmitAttempt?: boolean;
  
  /**
   * Debounce delay for change validation (default: 300ms)
   */
  debounceDelay?: number;
  
  /**
   * Async validation rules
   */
  asyncRules?: AsyncValidationRule<T>[];
  
  /**
   * Form type for telemetry (optional)
   */
  formType?: string;
}

/**
 * Form validation hook
 */
export function useFormValidation<T extends Record<string, unknown>>(
  form: T,
  rules: ValidationRule<T>[],
  options: UseFormValidationOptions<T> = {}
): UseFormValidationReturn<T> {
  const {
    validateOnChange = true,
    showErrorsAfterSubmitAttempt = false,
    debounceDelay = 300,
    asyncRules = [],
    formType,
  } = options;

  // Error state
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  
  // Async error state
  const [asyncErrors, setAsyncErrors] = useState<Partial<Record<keyof T, string>>>({});
  
  // Touched state (fields user has interacted with)
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());
  
  // Validating state (for async validators)
  const [validating, setValidating] = useState<Set<keyof T>>(new Set());
  
  // Submit attempt tracking
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Validate a single field
  const validateField = useCallback(
    (field: keyof T): string | null => {
      const rule = rules.find((r) => r.field === field);
      if (!rule) return null;

      const error = rule.validator(form[field], form);
      return error;
    },
    [form, rules]
  );

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    const startTime = performance.now();
    const newErrors: Partial<Record<keyof T, string>> = {};

    rules.forEach((rule) => {
      const error = rule.validator(form[rule.field], form);
      if (error) {
        newErrors[rule.field] = error;
      }
    });

    setErrors(newErrors);
    
    const duration = performance.now() - startTime;
    const isValid = Object.keys(newErrors).length === 0;
    
    // Log validation performance
    if (formType) {
      logger.info('form_validation_complete', {
        form_type: formType,
        duration_ms: Math.round(duration),
        field_count: rules.length,
        error_count: Object.keys(newErrors).length,
        is_valid: isValid,
        timestamp: new Date().toISOString(),
      });
    }
    
    return isValid;
  }, [form, rules, formType]);

  // Abort controllers for async validation cancellation
  const abortControllersRef = useRef<Map<keyof T, AbortController>>(new Map());

  // Async field validation with cancellation support
  const validateFieldAsync = useCallback(
    async (field: keyof T): Promise<string | null> => {
      const rule = asyncRules.find((r) => r.field === field);
      if (!rule) return null;

      // Cancel previous validation for this field
      abortControllersRef.current.get(field)?.abort();
      
      const controller = new AbortController();
      abortControllersRef.current.set(field, controller);

      setValidating((prev) => new Set([...prev, field]));

      try {
        // Pass abort signal to validator if it supports it
        // Validators should check signal.aborted and handle AbortError
        const error = await rule.validator(form[field], form, controller.signal);
        
        // Check if validation was cancelled
        if (controller.signal.aborted) {
          return null;
        }
        
        setAsyncErrors((prev) => {
          const next = { ...prev };
          if (error) {
            next[field] = error;
          } else {
            // Remove the field from errors if it's now valid (don't store undefined)
            delete next[field];
          }
          return next;
        });
        return error;
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }
        
        const errorMessage = err instanceof Error ? err.message : 'Validation failed';
        setAsyncErrors((prev) => ({
          ...prev,
          [field]: errorMessage,
        }));
        return errorMessage;
      } finally {
        setValidating((prev) => {
          const next = new Set(prev);
          next.delete(field);
          return next;
        });
        abortControllersRef.current.delete(field);
      }
    },
    [form, asyncRules]
  );

  // Cleanup abort controllers on unmount
  useEffect(() => {
    const controllersToClean = abortControllersRef.current;
    return () => {
      controllersToClean.forEach(controller => controller.abort());
    };
  }, []);

  // Debounced validation for change events
  const debouncedValidateRef = useRef<((field: keyof T) => void) | undefined>();

  useEffect(() => {
    debouncedValidateRef.current = debounce<[keyof T]>((field: keyof T) => {
      const error = validateField(field);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[field] = error;
        } else {
          // Remove the field from errors if it's now valid (don't store undefined)
          delete next[field];
        }
        return next;
      });
    }, debounceDelay);
  }, [validateField, debounceDelay]);

  // Mark field as touched
  const touchField = useCallback((field: keyof T) => {
    setTouched((prev) => new Set([...prev, field]));
    
    // Validate immediately when touched
    const error = validateField(field);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        // Remove the field from errors if it's now valid (don't store undefined)
        delete next[field];
      }
      return next;
    });
  }, [validateField]);

  // Should show error for this field?
  const shouldShowError = useCallback(
    (field: keyof T): boolean => {
      if (showErrorsAfterSubmitAttempt) {
        return submitAttempted && (!!errors[field] || !!asyncErrors[field]);
      }
      return touched.has(field) && (!!errors[field] || !!asyncErrors[field]);
    },
    [submitAttempted, touched, errors, asyncErrors, showErrorsAfterSubmitAttempt]
  );

  // Get combined error for a field (sync + async)
  const getFieldError = useCallback(
    (field: keyof T): string | undefined => {
      return errors[field] || asyncErrors[field];
    },
    [errors, asyncErrors]
  );

  // Handle field change with validation
  const handleFieldChange = useCallback(
    (field: keyof T) => {
      // Update form is handled by parent component
      // This just handles validation
      
      if (validateOnChange && debouncedValidateRef.current) {
        debouncedValidateRef.current(field);
      }
      
      // Clear error when user starts typing (optimistic)
      if (errors[field] || asyncErrors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
        setAsyncErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [validateOnChange, errors, asyncErrors]
  );

  // Handle field blur with validation
  const handleFieldBlur = useCallback(
    (field: keyof T) => {
      touchField(field);
      
      // Instant validation on blur
      const error = validateField(field);
      setErrors((prev) => {
        const next = { ...prev };
        if (error) {
          next[field] = error;
        } else {
          // Remove the field from errors if it's now valid (don't store undefined)
          delete next[field];
        }
        return next;
      });
      
      // Trigger async validation if rule exists
      const asyncRule = asyncRules.find((r) => r.field === field);
      if (asyncRule) {
        validateFieldAsync(field);
      }
    },
    [touchField, validateField, asyncRules, validateFieldAsync]
  );

  // Mark submit as attempted
  const markSubmitAttempted = useCallback(() => {
    setSubmitAttempted(true);
    
    // Validate all fields on submit attempt
    validateAll();
  }, [validateAll]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
    setAsyncErrors({});
    setTouched(new Set());
    setSubmitAttempted(false);
  }, []);

  // Clear error for specific field
  const clearFieldError = useCallback((field: keyof T) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setAsyncErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);


  // Get error count
  const errorCount = useMemo(() => {
    return Object.keys(errors).length + Object.keys(asyncErrors).length;
  }, [errors, asyncErrors]);

  // Combined error getter (checks both sync and async)
  const getError = useCallback((field: keyof T): string | null => {
    return errors[field] || asyncErrors[field] || null;
  }, [errors, asyncErrors]);

  // Combined validity check (accounts for async validation in progress)
  // Filter out undefined/null errors - only count actual error messages
  const isValid = useMemo(() => {
    const hasSyncErrors = Object.values(errors).some(err => err && typeof err === 'string');
    const hasAsyncErrors = Object.values(asyncErrors).some(err => err && typeof err === 'string');
    return (
      !hasSyncErrors &&
      !hasAsyncErrors &&
      validating.size === 0
    );
  }, [errors, asyncErrors, validating]);

  return {
    // Error state
    errors,
    asyncErrors,
    getFieldError,
    getError, // Alias for convenience
    
    // Validation functions
    validateField,
    validateAll,
    validateFieldAsync,
    
    // Field interaction
    touchField,
    handleFieldChange,
    handleFieldBlur,
    shouldShowError,
    
    // Submit handling
    markSubmitAttempted,
    
    // State
    touched,
    validating,
    submitAttempted,
    
    // Status
    isValid,
    errorCount,
    
    // Utilities
    clearErrors,
    clearFieldError,
  };
}

/**
 * Return type for useFormValidation hook
 */
export interface UseFormValidationReturn<T> {
  /** Map of field errors (sync validation) */
  errors: Partial<Record<keyof T, string>>;
  /** Map of async validation errors */
  asyncErrors: Partial<Record<keyof T, string>>;
  /** Set of fields currently being validated asynchronously */
  validating: Set<keyof T>;
  /** Validate a single field (sync) */
  validateField: (field: keyof T) => string | null;
  /** Validate all fields (sync) */
  validateAll: () => boolean;
  /** Validate a single field (async) */
  validateFieldAsync: (field: keyof T) => Promise<string | null>;
  /** Mark field as touched (user interacted) */
  touchField: (field: keyof T) => void;
  /** Should this field's error be shown? */
  shouldShowError: (field: keyof T) => boolean;
  /** Mark that a submit attempt was made (show all errors) */
  markSubmitAttempted: () => void;
  /** Are all fields valid? (sync + async, accounts for validation in progress) */
  isValid: boolean;
  /** Get combined error for a field (sync or async) */
  getError: (field: keyof T) => string | null;
  /** Get combined error for a field (alias for getError) */
  getFieldError: (field: keyof T) => string | undefined;
  /** Handle field change with validation */
  handleFieldChange: (field: keyof T) => void;
  /** Handle field blur with validation */
  handleFieldBlur: (field: keyof T) => void;
  /** Touched fields set */
  touched: Set<keyof T>;
  /** Submit attempt tracking */
  submitAttempted: boolean;
  /** Error count */
  errorCount: number;
  /** Clear all errors */
  clearErrors: () => void;
  /** Clear error for specific field */
  clearFieldError: (field: keyof T) => void;
}
