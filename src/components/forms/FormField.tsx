import { ReactNode, cloneElement, isValidElement, useId } from 'react';
import { cn } from '../../lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
  /**
   * Optional field ID for accessibility. If not provided, one will be generated.
   * Use this to associate the label with the input via htmlFor/id.
   */
  fieldId?: string;
}

export function FormField({
  label,
  error,
  required,
  hint,
  children,
  className,
  fieldId: providedFieldId,
}: FormFieldProps) {
  // Generate a unique ID if not provided
  const generatedId = useId();
  const fieldId = providedFieldId || generatedId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className={cn('space-y-2', className)}>
      <label 
        htmlFor={fieldId}
        className="text-xs uppercase tracking-[0.3em] text-[#f3d9a4]/70 flex items-center gap-1"
      >
        {label}
        {required && <span className="text-amber-400" aria-label="required">*</span>}
      </label>

      {/* Clone children to add accessibility attributes */}
      {isValidElement(children)
        ? cloneElement(children as React.ReactElement, {
            id: fieldId,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': [error ? errorId : null, hint && !error ? hintId : null]
              .filter(Boolean)
              .join(' ') || undefined,
            ...(children.props || {}),
          })
        : children}

      {hint && !error && (
        <p id={hintId} className="text-xs text-white/40">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-400 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-red-400" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

