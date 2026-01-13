/**
 * Contact Fields Configuration for Smart Form Defaults
 * 
 * Contact fields contain personally identifiable information (PII) such as
 * names and phone numbers. These fields must NEVER be sent to AI services
 * like OpenAI to protect user privacy.
 * 
 * This module is used in both:
 * - Edge Function (supabase/functions/get-smart-defaults)
 * - Execution scripts (src/services/safety-agent/execution)
 * 
 * @module contactFields
 */

/**
 * Set of contact field names (database column format, snake_case)
 * These fields contain PII and must not be sent to AI
 */
export const CONTACT_FIELDS = new Set([
  'oc_contact',
  'doc_contact',
  'gf_contact',
  'safety_contact',
]);

/**
 * Set of contact field names in camelCase format
 * Used for frontend validation
 */
export const CONTACT_FIELDS_CAMEL = new Set([
  'ocContact',
  'docContact',
  'gfContact',
  'safetyContact',
]);

/**
 * Check if a field is a contact field (snake_case)
 * 
 * @param field - Field name in snake_case format
 * @returns true if the field contains contact/PII data
 * 
 * @example
 * ```ts
 * isContactField('oc_contact'); // true
 * isContactField('truck_number'); // false
 * ```
 */
export function isContactField(field: string): boolean {
  return CONTACT_FIELDS.has(field);
}

/**
 * Check if a field is a contact field (camelCase)
 * 
 * @param field - Field name in camelCase format
 * @returns true if the field contains contact/PII data
 * 
 * @example
 * ```ts
 * isContactFieldCamel('ocContact'); // true
 * isContactFieldCamel('truckNumber'); // false
 * ```
 */
export function isContactFieldCamel(field: string): boolean {
  return CONTACT_FIELDS_CAMEL.has(field);
}

/**
 * Redact contact field values from an array of submissions
 * Used before sending data to AI for tie-breaking
 * 
 * @param submissions - Array of submission records
 * @returns Submissions with contact values replaced by '[CONTACT]'
 * 
 * @example
 * ```ts
 * const submissions = [{ oc_contact: 'John Doe 555-1234', truck_number: 'B132' }];
 * const redacted = redactContactFields(submissions);
 * // Result: [{ oc_contact: '[CONTACT]', truck_number: 'B132' }]
 * ```
 */
export function redactContactFields(
  submissions: Record<string, unknown>[]
): Record<string, unknown>[] {
  return submissions.map(submission => {
    const redacted = { ...submission };
    CONTACT_FIELDS.forEach(field => {
      if (redacted[field]) {
        redacted[field] = '[CONTACT]';
      }
    });
    return redacted;
  });
}
