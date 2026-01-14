/**
 * Hook to fetch smart form defaults via Edge Function
 * 
 * Fetches AI-assisted suggestions for DVIR and JSA form fields based on
 * user's submission history. Automatically transforms database column names
 * (snake_case) to React form state keys (camelCase).
 * 
 * Usage:
 * ```tsx
 * const { suggestions, warnings, isLoading, error } = useSmartDefaults('dvir');
 * 
 * // suggestions keys are camelCase (e.g., 'truckNumber', 'workLocation')
 * if (suggestions?.truckNumber) {
 *   setTruckNumber(suggestions.truckNumber.value);
 * }
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import { toast } from '../lib/toast';
import { mapSuggestionsToFormKeys } from '../services/safety-agent/lib/fieldNameMap';

// =============================================================================
// TYPES
// =============================================================================

export interface SuggestionValue {
  value: string | boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'frequency' | 'recency' | 'ai_tiebreak';
}

export interface SmartDefaultsResponse {
  suggestions: Record<string, SuggestionValue>;
  method: 'deterministic' | 'ai_assisted' | 'disabled' | 'error';
  warnings?: string[];
  meta: {
    submissions_analyzed: number;
    processing_time_ms: number;
    from_cache?: boolean;
    logic_version?: string;
  };
}

export interface UseSmartDefaultsResult {
  /** Suggestions with camelCase keys (transformed from database snake_case) */
  suggestions: Record<string, SuggestionValue> | null;
  /** Original suggestions with snake_case keys (database format) */
  rawSuggestions: Record<string, SuggestionValue> | null;
  /** Warnings about data quality (e.g., low submission count) */
  warnings: string[];
  /** How suggestions were generated */
  method: 'deterministic' | 'ai_assisted' | 'disabled' | 'error' | null;
  /** Metadata about the request */
  meta: SmartDefaultsResponse['meta'] | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refetch suggestions */
  refetch: () => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Fetch smart form defaults for a given form type
 * 
 * @param formType - 'dvir' or 'jsa'
 * @returns Smart defaults result with transformed field names
 * 
 * @example
 * ```tsx
 * function DVIRForm() {
 *   const { suggestions, warnings, isLoading } = useSmartDefaults('dvir');
 *   
 *   const handleApplySuggestion = (field: string, value: string | boolean) => {
 *     // field is already camelCase (e.g., 'truckNumber')
 *     const setters = { truckNumber: setTruckNumber, ... };
 *     setters[field]?.(value);
 *   };
 *   
 *   return (
 *     <>
 *       {suggestions && <SmartDefaultsPanel suggestions={suggestions} ... />}
 *       <form>...</form>
 *     </>
 *   );
 * }
 * ```
 */
export function useSmartDefaults(formType: 'dvir' | 'jsa'): UseSmartDefaultsResult {
  const [data, setData] = useState<SmartDefaultsResponse | null>(null);
  // Start with loading=true so the skeleton shows immediately on mount
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 10-second timeout - Edge Functions can take 3-5s on cold starts
      // TODO: Optimize Edge Function response time (target <2s)
      // (Supabase SDK doesn't natively support AbortController)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000);
      });

      const fetchPromise = supabase.functions.invoke(
        'get-smart-defaults',
        {
          body: { form_type: formType },
        }
      );

      const { data: response, error: fnError } = await Promise.race([
        fetchPromise,
        timeoutPromise,
      ]);

      if (fnError) throw fnError;

      setData(response as SmartDefaultsResponse);

      // Telemetry: suggestions loaded
      if (response?.suggestions && Object.keys(response.suggestions).length > 0) {
        const suggestionCount = Object.keys(response.suggestions).length;
        
        logger.info('smart_defaults_shown', {
          form_type: formType,
          suggestion_count: suggestionCount,
          method: response.method,
          from_cache: response.meta?.from_cache,
        });

        // Show toast notification so user doesn't miss suggestions
        toast.info(
          'Smart Suggestions Ready',
          `${suggestionCount} field ${suggestionCount === 1 ? 'suggestion' : 'suggestions'} available`
        );

        // Scroll to panel after short delay (let animation complete)
        setTimeout(() => {
          const panel = document.getElementById('smart-defaults-panel');
          if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load suggestions';
      logger.warn('smart_defaults_fetch_failed', { form_type: formType, error: message });
      setError(message);
      // Silent degradation - form works normally without suggestions
    } finally {
      setIsLoading(false);
    }
  }, [formType]);

  // Fetch on mount
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // CRITICAL: Transform database keys (snake_case) to form state keys (camelCase)
  const normalizedSuggestions = useMemo(() => {
    if (!data?.suggestions) return null;
    return mapSuggestionsToFormKeys(data.suggestions, formType);
  }, [data?.suggestions, formType]);

  return {
    suggestions: normalizedSuggestions,
    rawSuggestions: data?.suggestions ?? null,
    warnings: data?.warnings ?? [],
    method: data?.method ?? null,
    meta: data?.meta ?? null,
    isLoading,
    error,
    refetch: fetchSuggestions,
  };
}

export default useSmartDefaults;
