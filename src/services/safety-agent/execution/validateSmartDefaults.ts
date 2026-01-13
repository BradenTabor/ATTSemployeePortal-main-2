/**
 * Smart Form Defaults: Validation
 * 
 * Validates AI responses and enforces the field allowlist.
 * Ensures only eligible fields receive suggestions and AI output
 * matches expected schema.
 * 
 * @module validateSmartDefaults
 */

import { ELIGIBLE_FIELDS } from './getSmartDefaultsCandidates';

// =============================================================================
// TYPES
// =============================================================================

export interface SuggestionValue {
  value: string | boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'frequency' | 'recency' | 'ai_tiebreak';
}

export interface AITieBreakResponse {
  field: string;
  value: string;
  reason: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: Record<string, SuggestionValue>;
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Check if a field is in the allowlist for the given form type
 */
export function isFieldAllowed(field: string, formType: 'dvir' | 'jsa'): boolean {
  const allowedFields = ELIGIBLE_FIELDS[formType];
  return allowedFields?.includes(field) ?? false;
}

/**
 * Validate AI tie-break response
 * 
 * Ensures:
 * 1. Response has required fields (field, value, reason)
 * 2. Field is in the allowlist
 * 3. Value exists in the original candidates
 * 
 * @param response - Parsed AI response
 * @param formType - Form type for allowlist check
 * @param validCandidates - Original candidate values to validate against
 * @returns Validation result with errors if invalid
 */
export function validateAIResponse(
  response: unknown,
  formType: 'dvir' | 'jsa',
  validCandidates: (string | boolean)[]
): ValidationResult {
  const errors: string[] = [];

  // Check if response is an object
  if (!response || typeof response !== 'object') {
    return {
      valid: false,
      errors: ['AI response is not a valid object'],
    };
  }

  const resp = response as Record<string, unknown>;

  // Check required fields
  if (typeof resp.field !== 'string') {
    errors.push('Missing or invalid "field" in AI response');
  }

  if (resp.value === undefined || resp.value === null) {
    errors.push('Missing "value" in AI response');
  }

  if (typeof resp.reason !== 'string') {
    errors.push('Missing or invalid "reason" in AI response');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Check field is in allowlist
  const field = resp.field as string;
  if (!isFieldAllowed(field, formType)) {
    return {
      valid: false,
      errors: [`Field "${field}" is not in the allowlist for ${formType}`],
    };
  }

  // Check value exists in candidates (hallucination prevention)
  const value = resp.value;
  const valueStr = String(value);
  const candidateStrs = validCandidates.map(c => String(c));
  
  if (!candidateStrs.includes(valueStr)) {
    return {
      valid: false,
      errors: [
        `AI suggested value "${valueStr}" is not in the original candidates. ` +
        `Valid candidates: ${candidateStrs.join(', ')}`
      ],
    };
  }

  return { valid: true, errors: [] };
}

/**
 * Sanitize suggestions object by removing non-allowlisted fields
 * 
 * @param suggestions - Raw suggestions object
 * @param formType - Form type for allowlist check
 * @returns Sanitized suggestions with only allowed fields
 */
export function sanitizeSuggestions(
  suggestions: Record<string, SuggestionValue>,
  formType: 'dvir' | 'jsa'
): Record<string, SuggestionValue> {
  const sanitized: Record<string, SuggestionValue> = {};
  const allowedFields = ELIGIBLE_FIELDS[formType] || [];

  for (const [field, value] of Object.entries(suggestions)) {
    if (allowedFields.includes(field)) {
      sanitized[field] = value;
    }
  }

  return sanitized;
}

/**
 * Validate a single suggestion value
 */
export function validateSuggestionValue(
  value: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!value || typeof value !== 'object') {
    return { valid: false, errors: ['Suggestion value is not an object'] };
  }

  const v = value as Record<string, unknown>;

  // Check value field
  if (v.value === undefined || v.value === null) {
    errors.push('Missing "value" field');
  } else if (typeof v.value !== 'string' && typeof v.value !== 'boolean') {
    errors.push('"value" must be a string or boolean');
  }

  // Check reason field
  if (typeof v.reason !== 'string') {
    errors.push('Missing or invalid "reason" field');
  }

  // Check confidence field
  const validConfidences = ['high', 'medium', 'low'];
  if (!validConfidences.includes(v.confidence as string)) {
    errors.push(`Invalid "confidence" value. Must be one of: ${validConfidences.join(', ')}`);
  }

  // Check source field
  const validSources = ['frequency', 'recency', 'ai_tiebreak'];
  if (!validSources.includes(v.source as string)) {
    errors.push(`Invalid "source" value. Must be one of: ${validSources.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate entire suggestions response
 * 
 * @param suggestions - Suggestions object to validate
 * @param formType - Form type for allowlist check
 * @returns Validation result with sanitized suggestions if valid
 */
export function validateSuggestionsResponse(
  suggestions: unknown,
  formType: 'dvir' | 'jsa'
): ValidationResult {
  const errors: string[] = [];

  if (!suggestions || typeof suggestions !== 'object') {
    return {
      valid: false,
      errors: ['Suggestions must be an object'],
    };
  }

  const suggestionsObj = suggestions as Record<string, unknown>;
  const sanitized: Record<string, SuggestionValue> = {};

  for (const [field, value] of Object.entries(suggestionsObj)) {
    // Check if field is allowed
    if (!isFieldAllowed(field, formType)) {
      errors.push(`Field "${field}" is not allowed for ${formType}`);
      continue;
    }

    // Validate the suggestion value
    const valueValidation = validateSuggestionValue(value);
    if (!valueValidation.valid) {
      errors.push(`Field "${field}": ${valueValidation.errors.join(', ')}`);
      continue;
    }

    sanitized[field] = value as SuggestionValue;
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Get list of allowed fields for a form type
 */
export function getAllowedFields(formType: 'dvir' | 'jsa'): string[] {
  return ELIGIBLE_FIELDS[formType] || [];
}

export default {
  isFieldAllowed,
  validateAIResponse,
  sanitizeSuggestions,
  validateSuggestionValue,
  validateSuggestionsResponse,
  getAllowedFields,
};
