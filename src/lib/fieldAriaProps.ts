/**
 * getFieldAriaProps helper
 * 
 * Helper to get field props for accessibility.
 * Exported from a separate file to avoid fast refresh warnings.
 */

export function getFieldAriaProps(
  fieldId: string,
  error?: string,
  touched?: boolean
) {
  const errorId = `${fieldId}-error`;
  const hasError = touched && !!error;

  return {
    id: fieldId,
    'aria-invalid': hasError,
    'aria-describedby': hasError ? errorId : undefined,
    'aria-required': true,
  };
}
