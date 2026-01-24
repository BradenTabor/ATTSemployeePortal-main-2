/**
 * Scroll to Error Utility
 * 
 * Provides smooth scrolling to form fields with validation errors,
 * accounting for fixed headers and providing visual feedback.
 */

export interface ScrollToErrorOptions {
  /**
   * Offset from top of viewport (default: 120px for fixed headers)
   */
  offset?: number;
  
  /**
   * Scroll behavior (default: 'smooth')
   */
  behavior?: ScrollBehavior;
  
  /**
   * Duration of highlight animation in ms (default: 2000)
   */
  highlightDuration?: number;
  
  /**
   * Number of highlight pulses (default: 3)
   */
  highlightPulses?: number;
}

/**
 * Scroll to a form field and highlight it
 * 
 * @param fieldId - The ID or name attribute of the field
 * @param options - Scroll and highlight options
 */
export function scrollToField(
  fieldId: string,
  options?: ScrollToErrorOptions
): void {
  const {
    offset = 120,
    behavior = 'smooth',
    highlightDuration = 2000,
  } = options || {};

  // Use requestAnimationFrame to ensure DOM is ready (especially for multi-step forms)
  requestAnimationFrame(() => {
    // Try to find element by ID first, then by name attribute
    const element = 
      document.getElementById(fieldId) ||
      document.querySelector(`[name="${fieldId}"]`) ||
      document.querySelector(`[data-field-id="${fieldId}"]`);

    if (!element) {
      console.warn(`[scrollToError] Field not found: ${fieldId}`);
      return;
    }

    // Calculate scroll position accounting for fixed header
    const elementRect = element.getBoundingClientRect();
    const y = elementRect.top + window.scrollY - offset;

    // Scroll to element
    window.scrollTo({ top: y, behavior });

    // Highlight field with pulse animation
    element.classList.add('validation-highlight');
    
    // Remove highlight after duration
    setTimeout(() => {
      element.classList.remove('validation-highlight');
    }, highlightDuration);

    // Focus element for keyboard users (after scroll completes)
    setTimeout(() => {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLButtonElement
      ) {
        element.focus();
        
        // For select elements, also open the dropdown if possible
        if (element instanceof HTMLSelectElement) {
          // Note: Programmatic opening of select dropdowns is limited by browser security
          // This will at least focus the element
        }
      }
    }, behavior === 'smooth' ? 500 : 0);
  });
}

/**
 * Scroll to the first error in a form
 * 
 * @param errors - Object mapping field names to error messages
 * @param options - Scroll and highlight options
 */
export function scrollToFirstError(
  errors: Record<string, string | undefined>,
  options?: ScrollToErrorOptions
): void {
  const firstErrorField = Object.keys(errors).find(key => errors[key]);
  
  if (firstErrorField) {
    scrollToField(firstErrorField, options);
  }
}

/**
 * Get the field ID for a given field name
 * Useful for generating consistent IDs across forms
 */
export function getFieldId(fieldName: string, formType?: string): string {
  if (formType) {
    return `${formType}-${fieldName}`;
  }
  return fieldName;
}
