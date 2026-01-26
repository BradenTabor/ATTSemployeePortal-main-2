/**
 * ValidatedField Component
 * 
 * Wrapper component for form fields with validation feedback.
 * Provides error states, inline messages, and accessibility support.
 */

import { ReactNode, cloneElement, isValidElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ValidatedFieldProps {
  /**
   * Field label
   */
  label: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Whether field has been touched/interacted with
   */
  touched?: boolean;
  
  /**
   * Whether field is required
   */
  required?: boolean;
  
  /**
   * Field content (input, select, etc.)
   */
  children: ReactNode;
  
  /**
   * Callback when field loses focus
   */
  onBlur?: () => void;
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Field ID for accessibility (used in aria-describedby)
   */
  fieldId?: string;
  
  /**
   * Show success indicator when valid
   */
  showSuccess?: boolean;
  
  /**
   * Helper/hint text
   */
  hint?: string;
  
  /**
   * Whether field is currently validating (async)
   */
  validating?: boolean;
}

/**
 * ValidatedField component
 */
export function ValidatedField({
  label,
  error,
  touched = false,
  required = false,
  children,
  onBlur,
  className,
  fieldId,
  showSuccess = false,
  hint,
  validating = false,
}: ValidatedFieldProps) {
  const showError = touched && error;
  const showSuccessIndicator = touched && !error && showSuccess;
  const errorId = fieldId ? `${fieldId}-error` : undefined;
  const hintId = fieldId && !showError ? `${fieldId}-hint` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Label */}
      <label
        htmlFor={fieldId}
        className="block text-xs font-semibold text-white/80 uppercase tracking-wide"
      >
        {label}
        {required && <span className="text-amber-400 ml-1">*</span>}
      </label>

      {/* Field container */}
      <div className="relative">
        {/* Field content with error/success styling */}
        <div
          className={cn(
            'relative',
            showError && 'ring-2 ring-rose-500/50 rounded-lg',
            showSuccessIndicator && 'ring-2 ring-emerald-500/50 rounded-lg'
          )}
          onBlur={onBlur}
        >
          {isValidElement(children) && fieldId
            ? cloneElement(children as React.ReactElement, {
                'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
                'aria-invalid': showError ? true : undefined,
              })
            : children}
        </div>

        {/* Error icon overlay */}
        {showError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
        )}

        {/* Success icon overlay */}
        {showSuccessIndicator && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        )}

        {/* Validating indicator */}
        <AnimatePresence mode="wait">
          {validating && !showError && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence mode="wait">
        {showError && (
          <motion.p
            id={errorId}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-rose-400 flex items-center gap-1.5"
          >
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>{error}</span>
          </motion.p>
        )}
      </AnimatePresence>

      {/* Hint text (shown when no error) */}
      {!showError && hint && (
        <p
          id={hintId}
          className="text-xs text-white/40"
        >
          {hint}
        </p>
      )}
    </div>
  );
}
