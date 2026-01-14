/**
 * Supabase Edge Function: Get Smart Form Defaults
 * 
 * Returns AI-assisted suggestions for DVIR and JSA form fields based on
 * user's submission history. Uses deterministic-first approach with
 * optional AI tie-breaking.
 * 
 * ## Authentication
 * Requires valid Supabase auth token in Authorization header.
 * 
 * ## Deploy
 * supabase functions deploy get-smart-defaults
 * 
 * ## Set secrets
 * supabase secrets set OPENAI_API_KEY=sk-your-key
 * supabase secrets set SMART_DEFAULTS_ENABLED=true
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4';

// =============================================================================
// CONFIGURATION
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10; // requests per hour
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const WINDOW_DAYS = 7;
const LOGIC_VERSION = 'v1.0.0-2026-01-15';

// =============================================================================
// TYPES (Duplicated from src/ due to Deno import limitations)
// =============================================================================

interface CandidateValue {
  value: string | boolean;
  count: number;
  lastUsed: string;
}

interface CandidateResult {
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

interface SuggestionValue {
  value: string | boolean;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'frequency' | 'recency' | 'ai_tiebreak';
}

interface SmartDefaultsResponse {
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

// =============================================================================
// FIELD CONFIGURATION (Duplicated from src/)
// =============================================================================

const ELIGIBLE_FIELDS: Record<string, string[]> = {
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
  ],
};

const CONTACT_FIELDS = new Set([
  'oc_contact',
  'doc_contact',
  'gf_contact',
  'safety_contact',
]);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isContactField(field: string): boolean {
  return CONTACT_FIELDS.has(field);
}

function calculateConfidence(
  candidateCount: number,
  totalSubmissions: number
): 'high' | 'medium' | 'low' {
  if (totalSubmissions === 0) return 'low';
  const percentage = (candidateCount / totalSubmissions) * 100;
  if (percentage >= 80) return 'high';
  if (percentage >= 50) return 'medium';
  return 'low';
}

function extractCandidatesForField(
  field: string,
  submissions: Record<string, unknown>[]
): CandidateValue[] {
  const valueMap = new Map<string, CandidateValue>();

  for (const submission of submissions) {
    let value = submission[field];
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) value = JSON.stringify(value);

    const stringKey = String(value);
    const createdAt = submission.created_at as string || new Date().toISOString();

    const existing = valueMap.get(stringKey);
    if (existing) {
      existing.count++;
      if (createdAt > existing.lastUsed) existing.lastUsed = createdAt;
    } else {
      const originalValue = typeof submission[field] === 'boolean'
        ? submission[field] as boolean
        : stringKey;
      valueMap.set(stringKey, { value: originalValue, count: 1, lastUsed: createdAt });
    }
  }

  return Array.from(valueMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
  });
}

function selectWinner(
  field: string,
  candidates: CandidateValue[],
  totalSubmissions: number
): CandidateResult {
  const result: CandidateResult = { field, candidates, needsAITieBreak: false };

  if (candidates.length === 0) return result;

  if (candidates.length === 1) {
    const winner = candidates[0];
    result.winner = {
      value: winner.value,
      confidence: calculateConfidence(winner.count, totalSubmissions),
      reason: `Used ${winner.count} time${winner.count > 1 ? 's' : ''} in last 7 days`,
      source: 'frequency',
    };
    return result;
  }

  const topCount = candidates[0].count;
  const tiedCandidates = candidates.filter(c => c.count === topCount);

  if (tiedCandidates.length === 1) {
    const winner = tiedCandidates[0];
    result.winner = {
      value: winner.value,
      confidence: calculateConfidence(winner.count, totalSubmissions),
      reason: `Most frequent (${winner.count}x in last 7 days)`,
      source: 'frequency',
    };
    return result;
  }

  // Tie exists
  if (isContactField(field)) {
    const mostRecent = tiedCandidates.sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    )[0];
    result.winner = {
      value: mostRecent.value,
      confidence: 'low',
      reason: 'Most recently used contact',
      source: 'recency',
    };
    return result;
  }

  result.needsAITieBreak = true;
  result.tiedValues = tiedCandidates.map(c => c.value);
  return result;
}

function buildWarnings(submissionsAnalyzed: number): string[] {
  const warnings: string[] = [];
  if (submissionsAnalyzed === 0) {
    warnings.push(`No submissions found in the last ${WINDOW_DAYS} days.`);
  } else if (submissionsAnalyzed < 3) {
    warnings.push(
      `Only ${submissionsAnalyzed} submission${submissionsAnalyzed > 1 ? 's' : ''} found. ` +
      'Suggestions may be less accurate.'
    );
  }
  return warnings;
}

// =============================================================================
// AI TIE-BREAK
// =============================================================================

const AI_SYSTEM_PROMPT = `You are a form default selector for a tree service company employee portal.
Your task is to select the best default value when multiple candidates have equal frequency.

Rules:
1. ONLY select from the provided candidates (never invent new values)
2. Prefer more recent usage over older usage
3. Provide a brief, factual reason (max 10 words)
4. Return JSON only

Format: { "field": "field_name", "value": "selected_value", "reason": "brief explanation" }`;

async function aiTieBreak(
  field: string,
  candidates: CandidateValue[],
  openaiKey: string
): Promise<{ value: string | boolean; reason: string } | null> {
  // CRITICAL: Never send contact fields to AI
  if (isContactField(field)) {
    const mostRecent = [...candidates].sort(
      (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
    )[0];
    return { value: mostRecent.value, reason: 'Most recently used contact' };
  }

  try {
    const candidateList = candidates.map(c => {
      const daysAgo = Math.round(
        (Date.now() - new Date(c.lastUsed).getTime()) / (1000 * 60 * 60 * 24)
      );
      return `- ${c.value}: Used ${c.count}x (most recent: ${daysAgo} days ago)`;
    }).join('\n');

    const userPrompt = `Field: ${field}\nCandidates:\n${candidateList}\n\nSelect the best default value.`;

    const openai = new OpenAI({ apiKey: openaiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { field: string; value: string; reason: string };

    // Validate AI didn't hallucinate
    const validValues = candidates.map(c => String(c.value));
    if (!validValues.includes(String(parsed.value))) {
      console.error('[AI] Hallucination detected - value not in candidates:', parsed.value);
      return null;
    }

    return { value: parsed.value, reason: parsed.reason };
  } catch (error) {
    console.error('[AI] Tie-break error:', error);
    return null;
  }
}

// =============================================================================
// CACHING (In-Memory - Edge Functions don't support Deno KV)
// =============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// In-memory cache (persists across warm invocations within same isolate)
const memoryCache = new Map<string, CacheEntry<SmartDefaultsResponse>>();
const rateLimitCache = new Map<string, CacheEntry<number>>();

function cleanExpiredEntries<T>(cache: Map<string, CacheEntry<T>>): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      cache.delete(key);
    }
  }
}

function getFromCache(key: string): SmartDefaultsResponse | null {
  cleanExpiredEntries(memoryCache);
  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    return null;
  }
  return entry.value;
}

function setCache(key: string, value: SmartDefaultsResponse): void {
  // Limit cache size to prevent memory issues
  if (memoryCache.size > 100) {
    cleanExpiredEntries(memoryCache);
    // If still too large, clear oldest entries
    if (memoryCache.size > 100) {
      const keysToDelete = Array.from(memoryCache.keys()).slice(0, 50);
      keysToDelete.forEach(k => memoryCache.delete(k));
    }
  }
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// =============================================================================
// RATE LIMITING (In-Memory)
// =============================================================================

function checkRateLimit(userId: string): boolean {
  cleanExpiredEntries(rateLimitCache);
  const key = `ratelimit:${userId}`;
  const entry = rateLimitCache.get(key);
  const now = Date.now();

  if (!entry || entry.expiresAt < now) {
    // Start new window
    rateLimitCache.set(key, {
      value: 1,
      expiresAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (entry.value >= RATE_LIMIT_MAX) {
    return false;
  }

  // Increment counter
  rateLimitCache.set(key, {
    value: entry.value + 1,
    expiresAt: entry.expiresAt,
  });
  return true;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Check feature flag
    const enabled = Deno.env.get('SMART_DEFAULTS_ENABLED');
    if (enabled === 'false') {
      return jsonResponse({
        suggestions: {},
        method: 'disabled',
        warnings: ['Smart defaults feature is disabled'],
        meta: { submissions_analyzed: 0, processing_time_ms: 0, logic_version: LOGIC_VERSION },
      });
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const formType = body.form_type as 'dvir' | 'jsa';

    if (!formType || !['dvir', 'jsa'].includes(formType)) {
      return jsonResponse({ error: 'Invalid form_type. Must be "dvir" or "jsa"' }, 400);
    }

    // Rate limiting
    const allowed = checkRateLimit(user.id);
    if (!allowed) {
      return jsonResponse({ error: 'Rate limit exceeded. Try again later.' }, 429);
    }

    // Check cache
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `${user.id}:${formType}:${today}`;
    const cached = getFromCache(cacheKey);

    if (cached) {
      return jsonResponse({
        ...cached,
        meta: { ...cached.meta, from_cache: true },
      });
    }

    // Query user's submission history
    const tableName = formType === 'dvir' ? 'dvir_reports' : 'daily_jsa';
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);

    // Optimized: Only fetch fields we need for suggestions (vs SELECT *)
    // This reduces payload by ~80% and improves performance
    const fieldList = formType === 'dvir'
      ? 'truck_number, chipper_number, trailer_number, truck_gvwr, trailer_chipper_gvwr, medical_card_required, has_medical_card, copy_of_registration, copy_of_insurance, created_at'
      : 'work_location, circuit_number, nearest_hospital, nearest_clinic, oc_contact, doc_contact, gf_contact, safety_contact, created_at';

    const { data: submissions, error: queryError } = await supabase
      .from(tableName)
      .select(fieldList)
      .eq('user_id', user.id)
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(25);

    if (queryError) {
      console.error('[DB] Query error:', queryError);
      return jsonResponse({
        suggestions: {},
        method: 'error',
        warnings: ['Unable to load submission history'],
        meta: { submissions_analyzed: 0, processing_time_ms: Date.now() - startTime, logic_version: LOGIC_VERSION },
      });
    }

    const submissionsData = (submissions || []) as Record<string, unknown>[];
    const submissionsAnalyzed = submissionsData.length;
    const warnings = buildWarnings(submissionsAnalyzed);
    const eligibleFields = ELIGIBLE_FIELDS[formType] || [];

    // Extract candidates for each field
    const candidates: Record<string, CandidateResult> = {};
    for (const field of eligibleFields) {
      const fieldCandidates = extractCandidatesForField(field, submissionsData);
      candidates[field] = selectWinner(field, fieldCandidates, submissionsAnalyzed);
    }

    // Build suggestions
    const suggestions: Record<string, SuggestionValue> = {};
    let usedAI = false;
    const dryRun = Deno.env.get('DRY_RUN') === 'true';
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    for (const [field, result] of Object.entries(candidates)) {
      if (result.candidates.length === 0) continue;

      // Clear winner
      if (result.winner && !result.needsAITieBreak) {
        suggestions[field] = {
          value: result.winner.value,
          reason: result.winner.reason,
          confidence: result.winner.confidence,
          source: result.winner.source,
        };
        continue;
      }

      // Tie exists
      if (result.needsAITieBreak && result.tiedValues) {
        const tiedCandidates = result.candidates.filter(
          c => result.tiedValues!.includes(c.value)
        );

        // Contact fields always use recency
        if (isContactField(field)) {
          const mostRecent = [...tiedCandidates].sort(
            (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
          )[0];
          suggestions[field] = {
            value: mostRecent.value,
            reason: 'Most recently used contact',
            confidence: 'low',
            source: 'recency',
          };
          continue;
        }

        // Try AI tie-break
        if (!dryRun && openaiKey) {
          const aiResult = await aiTieBreak(field, tiedCandidates, openaiKey);
          if (aiResult) {
            usedAI = true;
            suggestions[field] = {
              value: aiResult.value,
              reason: aiResult.reason,
              confidence: 'low',
              source: 'ai_tiebreak',
            };
            continue;
          }
        }

        // Fallback to recency
        const mostRecent = [...tiedCandidates].sort(
          (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
        )[0];
        suggestions[field] = {
          value: mostRecent.value,
          reason: dryRun ? 'Most recent (dry-run mode)' : 'Most recently used',
          confidence: 'low',
          source: 'recency',
        };
      }
    }

    const response: SmartDefaultsResponse = {
      suggestions,
      method: usedAI ? 'ai_assisted' : 'deterministic',
      warnings: warnings.length > 0 ? warnings : undefined,
      meta: {
        submissions_analyzed: submissionsAnalyzed,
        processing_time_ms: Date.now() - startTime,
        logic_version: LOGIC_VERSION,
      },
    };

    // Cache the response
    setCache(cacheKey, response);

    return jsonResponse(response);
  } catch (error) {
    console.error('[Error]', error);
    return jsonResponse({
      suggestions: {},
      method: 'error',
      warnings: ['An unexpected error occurred'],
      meta: {
        submissions_analyzed: 0,
        processing_time_ms: Date.now() - startTime,
        logic_version: LOGIC_VERSION,
      },
    });
  }
});
