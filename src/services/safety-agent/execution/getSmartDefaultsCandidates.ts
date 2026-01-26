/**
 * Smart Form Defaults: Candidate Extraction
 * 
 * Queries user's past DVIR/JSA submissions and extracts candidate values
 * for eligible fields. Computes frequency and recency scores to determine
 * deterministic winners or identify ties requiring AI assistance.
 * 
 * @module getSmartDefaultsCandidates
 */

import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { isContactField, redactContactFields } from '../lib/contactFields';

// =============================================================================
// TYPES
// =============================================================================

export interface CandidateValue {
  value: string | boolean;
  count: number;
  lastUsed: string; // ISO timestamp
}

export interface CandidateResult {
  field: string;
  candidates: CandidateValue[];
  winner?: {
    value: string | boolean;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    source: 'frequency' | 'recency';
  };
  needsAITieBreak: boolean;
  tiedValues?: (string | boolean)[];
}

export interface GetCandidatesOptions {
  userId: string;
  formType: 'dvir' | 'jsa';
  windowDays?: number;
  mockSubmissions?: Record<string, unknown>[]; // For testing
}

export interface GetCandidatesResult {
  candidates: Record<string, CandidateResult>;
  submissionsAnalyzed: number;
  warnings: string[];
}

// =============================================================================
// FIELD CONFIGURATION
// =============================================================================

/**
 * Eligible fields for each form type (database column names, snake_case)
 * These are the ONLY fields that can receive suggestions
 */
export const ELIGIBLE_FIELDS: Record<string, string[]> = {
  dvir: [
    'truck_number',
    'chipper_number',
    'trailer_number',
    'truck_gvwr',
    'trailer_chipper_gvwr',
    'medical_card_required',
    'has_medical_card',
    'copy_of_registration',
    'copy_of_insurance',
  ],
  jsa: [
    'work_location',
    'circuit_number',
    'nearest_hospital',
    'nearest_clinic',
    'oc_contact',
    'doc_contact',
    'gf_contact',
    'safety_contact',
    'call_in_time',
    'call_out_time',
  ],
};

// =============================================================================
// HELPER FUNCTIONS (Exported for Testing)
// =============================================================================

/**
 * Calculate confidence level based on frequency percentage
 */
export function calculateConfidence(
  candidateCount: number,
  totalSubmissions: number
): 'high' | 'medium' | 'low' {
  if (totalSubmissions === 0) return 'low';
  const percentage = (candidateCount / totalSubmissions) * 100;
  if (percentage >= 80) return 'high';
  if (percentage >= 50) return 'medium';
  return 'low';
}

/**
 * Extract candidates for a single field from submissions
 */
export function extractCandidatesForField(
  field: string,
  submissions: Record<string, unknown>[]
): CandidateValue[] {
  const valueMap = new Map<string, CandidateValue>();

  for (const submission of submissions) {
    let value = submission[field];
    
    // Skip null/undefined/empty values
    if (value === null || value === undefined || value === '') continue;
    
    // Handle arrays (e.g., jobs_performed) - stringify for comparison
    if (Array.isArray(value)) {
      value = JSON.stringify(value);
    }
    
    // Convert to string for map key
    const stringKey = String(value);
    const createdAt = submission.created_at as string || new Date().toISOString();
    
    const existing = valueMap.get(stringKey);
    if (existing) {
      existing.count++;
      // Update lastUsed if this submission is more recent
      if (createdAt > existing.lastUsed) {
        existing.lastUsed = createdAt;
      }
    } else {
      // Preserve original type for boolean values
      const originalValue = typeof submission[field] === 'boolean' 
        ? submission[field] as boolean
        : stringKey;
      
      valueMap.set(stringKey, {
        value: originalValue,
        count: 1,
        lastUsed: createdAt,
      });
    }
  }

  // Sort by count (desc), then by recency (desc)
  return Array.from(valueMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
  });
}

/**
 * Select winner from candidates using deterministic rules
 */
export function selectWinner(
  field: string,
  candidates: CandidateValue[],
  totalSubmissions: number
): CandidateResult {
  const result: CandidateResult = {
    field,
    candidates,
    needsAITieBreak: false,
  };

  if (candidates.length === 0) {
    return result;
  }

  if (candidates.length === 1) {
    // Single candidate - clear winner
    const winner = candidates[0];
    result.winner = {
      value: winner.value,
      confidence: calculateConfidence(winner.count, totalSubmissions),
      reason: `Used ${winner.count} time${winner.count > 1 ? 's' : ''} in last 7 days`,
      source: 'frequency',
    };
    return result;
  }

  // Multiple candidates - check for tie
  const topCount = candidates[0].count;
  const tiedCandidates = candidates.filter(c => c.count === topCount);

  if (tiedCandidates.length === 1) {
    // Clear frequency winner
    const winner = tiedCandidates[0];
    result.winner = {
      value: winner.value,
      confidence: calculateConfidence(winner.count, totalSubmissions),
      reason: `Most frequent (${winner.count}x in last 7 days)`,
      source: 'frequency',
    };
    return result;
  }

  // Tie exists - use recency as tiebreaker for contact fields
  // (Contact fields can't use AI tiebreaker due to privacy)
  if (isContactField(field)) {
    // Sort tied candidates by recency
    const mostRecent = tiedCandidates.sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    )[0];
    
    result.winner = {
      value: mostRecent.value,
      confidence: 'low', // Low confidence for contact fields with ties
      reason: 'Most recently used contact',
      source: 'recency',
    };
    return result;
  }

  // Non-contact field with tie - needs AI tiebreaker
  result.needsAITieBreak = true;
  result.tiedValues = tiedCandidates.map(c => c.value);
  
  return result;
}

/**
 * Build warnings based on data quality
 */
export function buildWarnings(
  submissionsAnalyzed: number,
  windowDays: number
): string[] {
  const warnings: string[] = [];
  
  if (submissionsAnalyzed === 0) {
    warnings.push(`No submissions found in the last ${windowDays} days.`);
  } else if (submissionsAnalyzed < 3) {
    warnings.push(
      `Only ${submissionsAnalyzed} submission${submissionsAnalyzed > 1 ? 's' : ''} found. ` +
      'Suggestions may be less accurate.'
    );
  }
  
  return warnings;
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Get smart default candidates for a user's form
 * 
 * @param options - Configuration options
 * @returns Candidates for each eligible field with deterministic winners or tie indicators
 * 
 * @example
 * ```ts
 * const result = await getSmartDefaultsCandidates({
 *   userId: 'user-123',
 *   formType: 'dvir',
 *   windowDays: 7,
 * });
 * 
 * // Result:
 * // {
 * //   candidates: {
 * //     truck_number: {
 * //       field: 'truck_number',
 * //       candidates: [{ value: 'B132', count: 5, lastUsed: '...' }],
 * //       winner: { value: 'B132', confidence: 'high', ... },
 * //       needsAITieBreak: false,
 * //     },
 * //     ...
 * //   },
 * //   submissionsAnalyzed: 7,
 * //   warnings: [],
 * // }
 * ```
 */
export async function getSmartDefaultsCandidates(
  options: GetCandidatesOptions
): Promise<GetCandidatesResult> {
  const { userId, formType, windowDays = 7, mockSubmissions } = options;
  
  const eligibleFields = ELIGIBLE_FIELDS[formType];
  if (!eligibleFields) {
    throw new Error(`Invalid form type: ${formType}`);
  }

  // Use mock submissions for testing, otherwise query database
  let submissions: Record<string, unknown>[];
  
  if (mockSubmissions) {
    submissions = mockSubmissions;
  } else {
    const supabase = getSupabaseAdmin();
    const tableName = formType === 'dvir' ? 'dvir_reports' : 'daily_jsa';
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    submissions = (data || []) as Record<string, unknown>[];
  }

  const submissionsAnalyzed = submissions.length;
  const warnings = buildWarnings(submissionsAnalyzed, windowDays);

  // Extract candidates for each eligible field
  const candidates: Record<string, CandidateResult> = {};
  
  for (const field of eligibleFields) {
    const fieldCandidates = extractCandidatesForField(field, submissions);
    candidates[field] = selectWinner(field, fieldCandidates, submissionsAnalyzed);
  }

  return {
    candidates,
    submissionsAnalyzed,
    warnings,
  };
}

/**
 * Get candidates with contact fields redacted (for AI processing)
 * This is a convenience wrapper that returns redacted submissions
 */
export async function getSmartDefaultsCandidatesRedacted(
  options: GetCandidatesOptions
): Promise<GetCandidatesResult & { redactedSubmissions: Record<string, unknown>[] }> {
  const result = await getSmartDefaultsCandidates(options);
  
  // Redact contact fields from submissions (if we need to pass to AI)
  const supabase = getSupabaseAdmin();
  const tableName = options.formType === 'dvir' ? 'dvir_reports' : 'daily_jsa';
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (options.windowDays || 7));

  const { data } = await supabase
    .from(tableName)
    .select('*')
    .eq('user_id', options.userId)
    .gte('created_at', windowStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  const redactedSubmissions = redactContactFields((data || []) as Record<string, unknown>[]);

  return {
    ...result,
    redactedSubmissions,
  };
}

export default getSmartDefaultsCandidates;
