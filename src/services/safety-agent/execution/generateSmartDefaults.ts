/**
 * Smart Form Defaults: AI Tie-Breaking
 * 
 * Handles AI-assisted tie-breaking when deterministic candidate extraction
 * finds ambiguous results (multiple candidates with equal frequency).
 * 
 * CRITICAL: Contact fields are NEVER sent to AI. They use recency fallback.
 * 
 * @module generateSmartDefaults
 */

import { jsonCompletion } from '../lib/openai';
import { isContactField } from '../lib/contactFields';
import { safetyLogger } from '../lib/logger';
import {
  getSmartDefaultsCandidates,
  type CandidateResult,
  type CandidateValue,
  type GetCandidatesOptions,
} from './getSmartDefaultsCandidates';
import {
  validateAIResponse,
  type SuggestionValue,
} from './validateSmartDefaults';

// =============================================================================
// TYPES
// =============================================================================

export interface GenerateSmartDefaultsOptions extends GetCandidatesOptions {
  /** Skip AI calls (for testing or dry-run mode) */
  dryRun?: boolean;
}

export interface GenerateSmartDefaultsResult {
  suggestions: Record<string, SuggestionValue>;
  method: 'deterministic' | 'ai_assisted';
  warnings: string[];
  meta: {
    submissions_analyzed: number;
    processing_time_ms: number;
    ai_calls_made: number;
    fields_with_suggestions: number;
  };
}

// =============================================================================
// AI PROMPTS
// =============================================================================

const AI_SYSTEM_PROMPT = `You are a form default selector for a tree service company employee portal.
Your task is to select the best default value when multiple candidates have equal frequency.

Rules:
1. ONLY select from the provided candidates (never invent new values)
2. Prefer more recent usage over older usage
3. Provide a brief, factual reason (max 10 words)
4. Return JSON only

Format: { "field": "field_name", "value": "selected_value", "reason": "brief explanation" }`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build the user prompt for AI tie-breaking
 */
function buildAIUserPrompt(
  field: string,
  candidates: CandidateValue[]
): string {
  const candidateList = candidates.map(c => {
    const daysAgo = Math.round(
      (Date.now() - new Date(c.lastUsed).getTime()) / (1000 * 60 * 60 * 24)
    );
    return `- ${c.value}: Used ${c.count}x (most recent: ${daysAgo} days ago)`;
  }).join('\n');

  return `Field: ${field}
Candidates:
${candidateList}

Select the best default value.`;
}

/**
 * Call AI to break a tie between candidates
 * 
 * @param field - Field name
 * @param candidates - Tied candidates
 * @returns AI selection or null if failed
 */
async function aiTieBreak(
  field: string,
  candidates: CandidateValue[],
  formType: 'dvir' | 'jsa'
): Promise<{ value: string | boolean; reason: string } | null> {
  // CRITICAL: Never send contact fields to AI
  if (isContactField(field)) {
    safetyLogger.warn('Attempted to send contact field to AI - using recency fallback', { field });
    const mostRecent = [...candidates].sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    )[0];
    return {
      value: mostRecent.value,
      reason: 'Most recently used contact',
    };
  }

  try {
    const userPrompt = buildAIUserPrompt(field, candidates);
    
    safetyLogger.info('Calling AI for tie-break', {
      field,
      candidateCount: candidates.length,
    });

    const result = await jsonCompletion<{ field: string; value: string; reason: string }>({
      systemPrompt: AI_SYSTEM_PROMPT,
      userMessage: userPrompt,
      model: 'gpt-4o-mini',
      temperature: 0.1, // Very low for deterministic output
      maxTokens: 100,
    });

    if (!result.success || !result.data) {
      safetyLogger.error('AI tie-break failed', {
        field,
        error: result.error,
      });
      return null;
    }

    // Validate AI response
    const validCandidates = candidates.map(c => c.value);
    const validation = validateAIResponse(result.data, formType, validCandidates);

    if (!validation.valid) {
      safetyLogger.error('AI response validation failed', {
        field,
        errors: validation.errors,
        aiResponse: result.data,
      });
      return null;
    }

    safetyLogger.info('AI tie-break successful', {
      field,
      selectedValue: result.data.value,
      reason: result.data.reason,
    });

    return {
      value: result.data.value,
      reason: result.data.reason,
    };
  } catch (error) {
    safetyLogger.error('AI tie-break exception', {
      field,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Use recency as fallback when AI is unavailable or for contact fields
 */
function recencyFallback(
  candidates: CandidateValue[]
): { value: string | boolean; reason: string } {
  const mostRecent = [...candidates].sort(
    (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
  )[0];
  
  return {
    value: mostRecent.value,
    reason: 'Most recently used',
  };
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Generate smart defaults for a user's form
 * 
 * This function:
 * 1. Gets candidates from user history (deterministic)
 * 2. For fields with clear winners, uses those directly
 * 3. For fields with ties, calls AI to break the tie (unless dryRun)
 * 4. Falls back to recency if AI fails
 * 
 * @param options - Configuration options
 * @returns Suggestions for each eligible field
 * 
 * @example
 * ```ts
 * const result = await generateSmartDefaults({
 *   userId: 'user-123',
 *   formType: 'dvir',
 *   windowDays: 7,
 *   dryRun: false,
 * });
 * 
 * // Result:
 * // {
 * //   suggestions: {
 * //     truck_number: { value: 'B132', confidence: 'high', ... },
 * //   },
 * //   method: 'deterministic', // or 'ai_assisted'
 * //   warnings: [],
 * //   meta: { ... },
 * // }
 * ```
 */
export async function generateSmartDefaults(
  options: GenerateSmartDefaultsOptions
): Promise<GenerateSmartDefaultsResult> {
  const startTime = Date.now();
  const { dryRun = false, ...candidateOptions } = options;

  // Step 1: Get candidates (deterministic)
  const candidateResult = await getSmartDefaultsCandidates(candidateOptions);
  
  const suggestions: Record<string, SuggestionValue> = {};
  let aiCallsMade = 0;
  let usedAI = false;

  // Step 2: Process each field
  for (const [field, result] of Object.entries(candidateResult.candidates)) {
    const candidateData = result as CandidateResult;
    
    // Skip fields with no candidates
    if (candidateData.candidates.length === 0) {
      continue;
    }

    // Case 1: Clear winner from deterministic analysis
    if (candidateData.winner && !candidateData.needsAITieBreak) {
      suggestions[field] = {
        value: candidateData.winner.value,
        reason: candidateData.winner.reason,
        confidence: candidateData.winner.confidence,
        source: candidateData.winner.source,
      };
      continue;
    }

    // Case 2: Tie exists - need to break it
    if (candidateData.needsAITieBreak && candidateData.tiedValues) {
      // Get the tied candidates
      const tiedCandidates = candidateData.candidates.filter(
        c => candidateData.tiedValues!.includes(c.value)
      );

      // Contact fields always use recency (never AI)
      if (isContactField(field)) {
        const fallback = recencyFallback(tiedCandidates);
        suggestions[field] = {
          value: fallback.value,
          reason: fallback.reason,
          confidence: 'low',
          source: 'recency',
        };
        continue;
      }

      // Non-contact fields: try AI if not in dry-run mode
      if (!dryRun) {
        aiCallsMade++;
        const aiResult = await aiTieBreak(field, tiedCandidates, options.formType);
        
        if (aiResult) {
          usedAI = true;
          suggestions[field] = {
            value: aiResult.value,
            reason: aiResult.reason,
            confidence: 'low', // AI tie-breaks are low confidence
            source: 'ai_tiebreak',
          };
          continue;
        }
      }

      // Fallback: use recency if AI failed or dry-run
      const fallback = recencyFallback(tiedCandidates);
      suggestions[field] = {
        value: fallback.value,
        reason: dryRun ? 'Most recent (dry-run mode)' : fallback.reason,
        confidence: 'low',
        source: 'recency',
      };
    }
  }

  const processingTime = Date.now() - startTime;

  return {
    suggestions,
    method: usedAI ? 'ai_assisted' : 'deterministic',
    warnings: candidateResult.warnings,
    meta: {
      submissions_analyzed: candidateResult.submissionsAnalyzed,
      processing_time_ms: processingTime,
      ai_calls_made: aiCallsMade,
      fields_with_suggestions: Object.keys(suggestions).length,
    },
  };
}

export default generateSmartDefaults;
