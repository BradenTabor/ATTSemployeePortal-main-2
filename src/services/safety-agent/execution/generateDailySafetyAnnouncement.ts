/**
 * Generate Daily Safety Announcement
 * 
 * This module generates safety announcements based on multiple data sources:
 * - JSA (Job Safety Analysis) submissions
 * - DVIR (Daily Vehicle Inspection Reports)
 * - Daily Equipment Inspections
 * 
 * Uses OpenAI's API to aggregate and synthesize safety trends.
 * 
 * @module generateDailySafetyAnnouncement
 */

import { safetyLogger } from '../lib/logger';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { jsonCompletion, isOpenAIConfigured, getDefaultModel } from '../lib/openai';
import { formatDateYMD, nowISO } from '../lib/time';
import type {
  JsaSubmission,
  JsaAggregation,
  DvirReport,
  DvirAggregation,
  EquipmentInspectionReport,
  EquipmentAggregation,
  SafetyDataAggregation,
  HazardCount,
  GeneratedAnnouncement,
  GenerateAnnouncementOptions,
  GenerateAnnouncementResult,
} from '../types';

// =============================================================================
// CHARACTER LIMITS
// =============================================================================

/**
 * Target character limit for the announcement body (ideal length)
 * Optimized for SMS/push notification readability
 */
export const BODY_TARGET_CHAR_LIMIT = 238;

/**
 * Absolute maximum character limit for the announcement body
 * Must NEVER exceed this limit
 */
export const BODY_MAX_CHAR_LIMIT = 283;

/**
 * Maximum character limit for the summary field
 * Used for push notifications and SMS
 */
export const SUMMARY_MAX_CHAR_LIMIT = 240;

// =============================================================================
// PROMPT TEMPLATE
// =============================================================================

const SYSTEM_PROMPT = `You are a safety communication assistant for ATTS, a tree services company. Your job is to generate concise, actionable safety announcements based on recent safety data from multiple sources:
- JSA (Job Safety Analysis) forms
- DVIR (Daily Vehicle Inspection Reports)  
- Daily Equipment Inspections

## CRITICAL: Character Limits (STRICTLY ENFORCED)
- body: Target 238 characters, MAXIMUM 283 characters (including spaces and punctuation)
- summary: MAXIMUM 240 characters

## Rules
1. GROUNDING: Only include claims supported by the provided data
2. NO FABRICATION: Never invent incidents, injuries, or statistics
3. ANONYMITY: Never include employee names or identifying details
4. CLARITY: Use simple, direct language
5. ACTIONABLE: Focus on what employees should do, not just what to avoid
6. BREVITY: Body MUST be under 283 characters, aim for 238
7. PRIORITIZE: Focus on most critical safety items across all data sources

## Output Format (JSON)
{
  "title": "Safety Update - {date}",
  "body": "Main message - MAX 283 chars, target 238 chars. Be direct and actionable.",
  "summary": "One sentence summary for push notifications (max 240 chars)",
  "sections": {
    "overview": "Brief intro mentioning submission counts from all sources",
    "topHazards": [{ "hazard": "Name", "count": 0, "note": "Brief context" }],
    "ppeReminders": ["PPE item 1", "PPE item 2"],
    "equipmentAlerts": ["Equipment issue 1", "Vehicle issue 2"],
    "expectations": ["Today's expectation 1", "Today's expectation 2"]
  }
}`;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate and optionally truncate the announcement body to meet character limits.
 */
export function validateBodyLength(body: string): { 
  body: string; 
  charCount: number;
  truncated: boolean;
  withinTarget: boolean;
} {
  const charCount = body.length;
  
  if (charCount <= BODY_TARGET_CHAR_LIMIT) {
    return { body, charCount, truncated: false, withinTarget: true };
  }
  
  if (charCount <= BODY_MAX_CHAR_LIMIT) {
    safetyLogger.warn('Body exceeds target but within max limit', {
      charCount,
      targetLimit: BODY_TARGET_CHAR_LIMIT,
      maxLimit: BODY_MAX_CHAR_LIMIT,
    });
    return { body, charCount, truncated: false, withinTarget: false };
  }
  
  // Must truncate - find a good break point
  const truncateAt = findTruncationPoint(body, BODY_MAX_CHAR_LIMIT - 3); // -3 for "..."
  const truncatedBody = body.slice(0, truncateAt) + '...';
  
  safetyLogger.warn('Body truncated to meet max character limit', {
    originalCharCount: charCount,
    truncatedCharCount: truncatedBody.length,
    maxLimit: BODY_MAX_CHAR_LIMIT,
  });
  
  return { 
    body: truncatedBody, 
    charCount: truncatedBody.length, 
    truncated: true, 
    withinTarget: false 
  };
}

/**
 * Validate and optionally truncate the summary to meet character limit.
 */
export function validateSummaryLength(summary: string): {
  summary: string;
  charCount: number;
  truncated: boolean;
} {
  const charCount = summary.length;
  
  if (charCount <= SUMMARY_MAX_CHAR_LIMIT) {
    return { summary, charCount, truncated: false };
  }
  
  const truncateAt = findTruncationPoint(summary, SUMMARY_MAX_CHAR_LIMIT - 3);
  const truncatedSummary = summary.slice(0, truncateAt) + '...';
  
  safetyLogger.warn('Summary truncated to meet character limit', {
    originalCharCount: charCount,
    truncatedCharCount: truncatedSummary.length,
    maxLimit: SUMMARY_MAX_CHAR_LIMIT,
  });
  
  return { summary: truncatedSummary, charCount: truncatedSummary.length, truncated: true };
}

/**
 * Find a good truncation point (end of word or sentence).
 */
function findTruncationPoint(text: string, maxLength: number): number {
  if (text.length <= maxLength) return text.length;
  
  // Try to find end of sentence
  const sentenceEnd = text.lastIndexOf('. ', maxLength);
  if (sentenceEnd > maxLength * 0.7) return sentenceEnd + 1;
  
  // Try to find end of word
  const wordEnd = text.lastIndexOf(' ', maxLength);
  if (wordEnd > maxLength * 0.5) return wordEnd;
  
  // Fall back to hard cut
  return maxLength;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Fetch JSA submissions for the given time window.
 */
export async function fetchJsaSubmissions(windowHours: number): Promise<JsaSubmission[]> {
  const supabase = getSupabaseAdmin();
  
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  
  safetyLogger.info('Fetching JSA submissions', { windowHours, windowStart });
  
  const { data, error } = await supabase
    .from('daily_jsa')
    .select('id, user_id, job_site, hazards, ppe_required, controls, weather_conditions, near_miss, notes, created_at')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false });

  if (error) {
    safetyLogger.error('Failed to fetch JSA submissions', { error: error.message });
    throw new Error(`Failed to fetch JSA submissions: ${error.message}`);
  }

  safetyLogger.info('Fetched JSA submissions', { count: data?.length || 0 });
  return (data as JsaSubmission[]) || [];
}

/**
 * Fetch DVIR reports for the given time window.
 */
export async function fetchDvirReports(windowHours: number): Promise<DvirReport[]> {
  const supabase = getSupabaseAdmin();
  
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  
  safetyLogger.info('Fetching DVIR reports', { windowHours, windowStart });
  
  const { data, error } = await supabase
    .from('dvir_reports')
    .select('id, user_id, created_at, truck_number, vehicle_trailer_checklist, aerial_checklist, notes, aerial_notes, deficiency_corrected, mechanic_remarks')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false });

  if (error) {
    safetyLogger.error('Failed to fetch DVIR reports', { error: error.message });
    // Don't throw - DVIR data is supplementary
    return [];
  }

  safetyLogger.info('Fetched DVIR reports', { count: data?.length || 0 });
  return (data as DvirReport[]) || [];
}

/**
 * Fetch equipment inspection reports for the given time window.
 */
export async function fetchEquipmentInspections(windowHours: number): Promise<EquipmentInspectionReport[]> {
  const supabase = getSupabaseAdmin();
  
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  
  safetyLogger.info('Fetching equipment inspections', { windowHours, windowStart });
  
  const { data, error } = await supabase
    .from('daily_equipment_inspections')
    .select('id, user_id, created_at, equipment_type, equipment_number, general_checklist, specific_checklist, notes')
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false });

  if (error) {
    safetyLogger.error('Failed to fetch equipment inspections', { error: error.message });
    // Don't throw - equipment data is supplementary
    return [];
  }

  safetyLogger.info('Fetched equipment inspections', { count: data?.length || 0 });
  return (data as EquipmentInspectionReport[]) || [];
}

/**
 * Fetch all safety data sources in parallel.
 */
export async function fetchAllSafetyData(windowHours: number): Promise<{
  jsa: JsaSubmission[];
  dvir: DvirReport[];
  equipment: EquipmentInspectionReport[];
}> {
  const [jsa, dvir, equipment] = await Promise.all([
    fetchJsaSubmissions(windowHours),
    fetchDvirReports(windowHours),
    fetchEquipmentInspections(windowHours),
  ]);

  return { jsa, dvir, equipment };
}

// =============================================================================
// DATA AGGREGATION
// =============================================================================

/**
 * Aggregate hazards, PPE, and other data from JSA submissions.
 */
export function aggregateJsaData(submissions: JsaSubmission[]): JsaAggregation {
  const hazardCounts = new Map<string, number>();
  const ppeCounts = new Map<string, number>();
  const controlCounts = new Map<string, number>();
  const jobSites = new Set<string>();
  const weatherConditions = new Set<string>();
  let nearMissCount = 0;

  for (const jsa of submissions) {
    // Count hazards
    if (jsa.hazards && Array.isArray(jsa.hazards)) {
      for (const hazard of jsa.hazards) {
        const normalized = normalizeString(hazard);
        if (normalized) {
          hazardCounts.set(normalized, (hazardCounts.get(normalized) || 0) + 1);
        }
      }
    }

    // Count PPE
    if (jsa.ppe_required && Array.isArray(jsa.ppe_required)) {
      for (const ppe of jsa.ppe_required) {
        const normalized = normalizeString(ppe);
        if (normalized) {
          ppeCounts.set(normalized, (ppeCounts.get(normalized) || 0) + 1);
        }
      }
    }

    // Count controls
    if (jsa.controls && Array.isArray(jsa.controls)) {
      for (const control of jsa.controls) {
        const normalized = normalizeString(control);
        if (normalized) {
          controlCounts.set(normalized, (controlCounts.get(normalized) || 0) + 1);
        }
      }
    }

    // Track job sites
    if (jsa.job_site) {
      jobSites.add(jsa.job_site);
    }

    // Track weather
    if (jsa.weather_conditions) {
      weatherConditions.add(jsa.weather_conditions);
    }

    // Count near misses
    if (jsa.near_miss) {
      nearMissCount++;
    }
  }

  return {
    totalCount: submissions.length,
    hazardCounts,
    ppeCounts,
    controlCounts,
    nearMissCount,
    jobSites,
    weatherConditions,
  };
}

/**
 * Aggregate data from DVIR reports.
 */
export function aggregateDvirData(reports: DvirReport[]): DvirAggregation {
  const vehicleIssues = new Map<string, number>();
  const aerialIssues = new Map<string, number>();
  const truckNumbers = new Set<string>();
  let deficiencyCount = 0;

  for (const dvir of reports) {
    // Track truck numbers
    if (dvir.truck_number) {
      truckNumbers.add(dvir.truck_number);
    }

    // Count deficiencies
    if (dvir.deficiency_corrected === 'yes' || dvir.mechanic_remarks) {
      deficiencyCount++;
    }

    // Extract issues from vehicle/trailer checklist
    if (dvir.vehicle_trailer_checklist) {
      for (const [key, value] of Object.entries(dvir.vehicle_trailer_checklist)) {
        // Count items marked as defective or needing attention
        if (value === false || value === 'defective' || value === 'needs_repair') {
          const normalized = normalizeString(key.replace(/_/g, ' '));
          vehicleIssues.set(normalized, (vehicleIssues.get(normalized) || 0) + 1);
        }
      }
    }

    // Extract issues from aerial checklist
    if (dvir.aerial_checklist) {
      for (const [key, value] of Object.entries(dvir.aerial_checklist)) {
        if (value === false || value === 'defective' || value === 'needs_repair') {
          const normalized = normalizeString(key.replace(/_/g, ' '));
          aerialIssues.set(normalized, (aerialIssues.get(normalized) || 0) + 1);
        }
      }
    }
  }

  return {
    totalCount: reports.length,
    deficiencyCount,
    vehicleIssues,
    aerialIssues,
    truckNumbers,
  };
}

/**
 * Aggregate data from equipment inspections.
 */
export function aggregateEquipmentData(inspections: EquipmentInspectionReport[]): EquipmentAggregation {
  const equipmentTypes = new Map<string, number>();
  const issuesCounts = new Map<string, number>();
  const equipmentNumbers = new Set<string>();

  for (const inspection of inspections) {
    // Track equipment types
    if (inspection.equipment_type) {
      const normalized = normalizeString(inspection.equipment_type);
      equipmentTypes.set(normalized, (equipmentTypes.get(normalized) || 0) + 1);
    }

    // Track equipment numbers
    if (inspection.equipment_number) {
      equipmentNumbers.add(inspection.equipment_number);
    }

    // Extract issues from general checklist
    if (inspection.general_checklist) {
      for (const [key, value] of Object.entries(inspection.general_checklist)) {
        if (value === false || value === 'defective' || value === 'needs_repair' || value === 'fail') {
          const normalized = normalizeString(key.replace(/_/g, ' '));
          issuesCounts.set(normalized, (issuesCounts.get(normalized) || 0) + 1);
        }
      }
    }

    // Extract issues from specific checklist
    if (inspection.specific_checklist) {
      for (const [key, value] of Object.entries(inspection.specific_checklist)) {
        if (value === false || value === 'defective' || value === 'needs_repair' || value === 'fail') {
          const normalized = normalizeString(key.replace(/_/g, ' '));
          issuesCounts.set(normalized, (issuesCounts.get(normalized) || 0) + 1);
        }
      }
    }
  }

  return {
    totalCount: inspections.length,
    equipmentTypes,
    issuesCounts,
    equipmentNumbers,
  };
}

/**
 * Combine all data sources into a unified aggregation.
 */
export function aggregateAllSafetyData(
  jsa: JsaSubmission[],
  dvir: DvirReport[],
  equipment: EquipmentInspectionReport[]
): SafetyDataAggregation {
  const jsaAgg = aggregateJsaData(jsa);
  const dvirAgg = aggregateDvirData(dvir);
  const equipmentAgg = aggregateEquipmentData(equipment);

  // Calculate combined totals
  const totalHazards = jsaAgg.hazardCounts.size;
  const totalIssues = dvirAgg.vehicleIssues.size + dvirAgg.aerialIssues.size + equipmentAgg.issuesCounts.size;

  return {
    jsa: jsaAgg,
    dvir: dvirAgg,
    equipment: equipmentAgg,
    totals: {
      totalSubmissions: jsaAgg.totalCount + dvirAgg.totalCount + equipmentAgg.totalCount,
      totalHazards,
      totalIssues,
      nearMissCount: jsaAgg.nearMissCount,
    },
  };
}

/**
 * Normalize a string for consistent aggregation.
 */
function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Get top N items from a Map, sorted by count descending.
 */
export function getTopItems(
  counts: Map<string, number>,
  limit: number = 5
): HazardCount[] {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([hazard, count]) => ({
      hazard: capitalizeFirst(hazard),
      count,
    }));
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// PROMPT BUILDING
// =============================================================================

/**
 * Build the user prompt for announcement generation using all data sources.
 */
function buildUserPrompt(aggregation: SafetyDataAggregation, windowHours: number): string {
  const today = formatDateYMD(new Date());
  const topHazards = getTopItems(aggregation.jsa.hazardCounts, 5);
  const topPPE = getTopItems(aggregation.jsa.ppeCounts, 5);
  const topVehicleIssues = getTopItems(aggregation.dvir.vehicleIssues, 3);
  const topEquipmentIssues = getTopItems(aggregation.equipment.issuesCounts, 3);
  
  let prompt = `Date: ${today}
Window: Last ${windowHours} hours

=== SUBMISSION COUNTS ===
JSA Forms: ${aggregation.jsa.totalCount}
DVIR Reports: ${aggregation.dvir.totalCount}
Equipment Inspections: ${aggregation.equipment.totalCount}
Total Submissions: ${aggregation.totals.totalSubmissions}

=== JSA DATA ===
Top Hazards Identified:
${topHazards.length > 0 ? topHazards.map((h, i) => `${i + 1}. ${h.hazard} - ${h.count} mentions`).join('\n') : 'None reported'}

PPE Requirements Noted:
${topPPE.length > 0 ? topPPE.map((p, i) => `${i + 1}. ${p.hazard} - ${p.count} mentions`).join('\n') : 'None reported'}

Near-misses: ${aggregation.jsa.nearMissCount} reported`;

  if (aggregation.jsa.weatherConditions.size > 0) {
    prompt += `\nWeather conditions: ${Array.from(aggregation.jsa.weatherConditions).join(', ')}`;
  }

  prompt += `\n
=== DVIR DATA ===
Vehicles inspected: ${aggregation.dvir.totalCount}
Deficiencies found: ${aggregation.dvir.deficiencyCount}`;

  if (topVehicleIssues.length > 0) {
    prompt += `\nVehicle/Trailer Issues:
${topVehicleIssues.map((i, idx) => `${idx + 1}. ${i.hazard} - ${i.count} reports`).join('\n')}`;
  }

  prompt += `\n
=== EQUIPMENT INSPECTION DATA ===
Equipment inspected: ${aggregation.equipment.totalCount}`;

  if (topEquipmentIssues.length > 0) {
    prompt += `\nEquipment Issues Found:
${topEquipmentIssues.map((i, idx) => `${idx + 1}. ${i.hazard} - ${i.count} reports`).join('\n')}`;
  }

  prompt += `\n
Generate a safety announcement synthesizing insights from ALL data sources. Prioritize the most critical safety items. Remember: body max 283 chars (target 238), summary max 240 chars.`;

  return prompt;
}

/**
 * Build a low-data prompt when insufficient submissions are available.
 */
function buildLowDataPrompt(totalCount: number, minRequired: number): string {
  const today = formatDateYMD(new Date());
  
  return `Date: ${today}
Total Submissions: ${totalCount} (below minimum threshold of ${minRequired})

Generate a "low data" safety reminder. Since we have insufficient submissions across JSA, DVIR, and equipment inspections, focus on general safety reminders rather than specific trends.

The body should acknowledge limited data and provide standard safety reminders. Remember: body max 283 chars (target 238), summary max 240 chars.`;
}

// =============================================================================
// LLM RESPONSE PARSING
// =============================================================================

interface LLMAnnouncementResponse {
  title: string;
  body: string;
  summary: string;
  sections: {
    overview: string;
    topHazards: Array<{ hazard: string; count: number; note?: string }>;
    ppeReminders: string[];
    equipmentAlerts?: string[];
    expectations: string[];
  };
}

/**
 * Validate and transform LLM response to GeneratedAnnouncement.
 */
function parseAndValidateResponse(
  response: LLMAnnouncementResponse,
  aggregation: SafetyDataAggregation,
  windowHours: number,
  promptVersion: string,
  model: string
): { announcement: GeneratedAnnouncement; truncated: boolean } {
  // Validate body length
  const bodyValidation = validateBodyLength(response.body || '');
  const summaryValidation = validateSummaryLength(response.summary || '');

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowHours * 60 * 60 * 1000);

  const announcement: GeneratedAnnouncement = {
    title: response.title || `Safety Update - ${formatDateYMD(new Date())}`,
    body: bodyValidation.body,
    summary: summaryValidation.summary,
    sections: {
      overview: response.sections?.overview || '',
      topHazards: response.sections?.topHazards || [],
      ppeReminders: response.sections?.ppeReminders || [],
      expectations: response.sections?.expectations || [],
    },
    metadata: {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      jsaCount: aggregation.jsa.totalCount,
      promptVersion,
      model,
      generatedAt: nowISO(),
      bodyCharCount: bodyValidation.charCount,
      summaryCharCount: summaryValidation.charCount,
    },
  };

  return {
    announcement,
    truncated: bodyValidation.truncated || summaryValidation.truncated,
  };
}

// =============================================================================
// MAIN GENERATION FUNCTION
// =============================================================================

/**
 * Generate a daily safety announcement from all safety data sources.
 * 
 * @param options Generation options
 * @returns Result with generated announcement or error
 */
export async function generateDailySafetyAnnouncement(
  options: GenerateAnnouncementOptions = {}
): Promise<GenerateAnnouncementResult> {
  const {
    windowHours = 24,
    minSubmissions = 3,
    promptVersion = 'v1',
    mode = 'draft',
    model = getDefaultModel(),
    temperature = 0.3,
  } = options;

  safetyLogger.info('Starting announcement generation', {
    windowHours,
    minSubmissions,
    promptVersion,
    mode,
    model,
  });

  // Check if OpenAI is configured
  if (!isOpenAIConfigured()) {
    safetyLogger.error('OpenAI API key not configured');
    return {
      success: false,
      error: 'OpenAI API key not configured. Set OPENAI_API_KEY environment variable.',
    };
  }

  try {
    // Step 1: Fetch all safety data sources in parallel
    safetyLogger.info('Fetching data from all safety sources...');
    const { jsa, dvir, equipment } = await fetchAllSafetyData(windowHours);
    
    // Step 2: Aggregate all data
    const aggregation = aggregateAllSafetyData(jsa, dvir, equipment);

    safetyLogger.info('Data aggregation complete', {
      jsaCount: aggregation.jsa.totalCount,
      dvirCount: aggregation.dvir.totalCount,
      equipmentCount: aggregation.equipment.totalCount,
      totalSubmissions: aggregation.totals.totalSubmissions,
    });

    // Step 3: Determine if we have enough data
    const isLowData = aggregation.totals.totalSubmissions < minSubmissions;
    
    // Step 4: Build prompt
    const userPrompt = isLowData
      ? buildLowDataPrompt(aggregation.totals.totalSubmissions, minSubmissions)
      : buildUserPrompt(aggregation, windowHours);

    safetyLogger.info('Calling OpenAI for announcement generation', {
      isLowData,
      totalSubmissions: aggregation.totals.totalSubmissions,
    });

    // Step 5: Call OpenAI
    const llmResult = await jsonCompletion<LLMAnnouncementResponse>(
      {
        systemPrompt: SYSTEM_PROMPT,
        userMessage: userPrompt,
        model,
        temperature,
        maxTokens: 1024,
      }
    );

    if (!llmResult.success || !llmResult.data) {
      safetyLogger.error('LLM generation failed', { error: llmResult.error });
      return {
        success: false,
        error: llmResult.error || 'Failed to generate announcement',
      };
    }

    // Step 6: Validate and transform response
    const { announcement, truncated } = parseAndValidateResponse(
      llmResult.data,
      aggregation,
      windowHours,
      promptVersion,
      llmResult.model || model
    );

    // Add token usage to metadata
    if (llmResult.usage) {
      announcement.metadata.tokenUsage = llmResult.usage;
    }

    safetyLogger.info('Announcement generated successfully', {
      bodyCharCount: announcement.metadata.bodyCharCount,
      summaryCharCount: announcement.metadata.summaryCharCount,
      truncated,
      lowData: isLowData,
      tokenUsage: llmResult.usage,
      dataSources: {
        jsa: aggregation.jsa.totalCount,
        dvir: aggregation.dvir.totalCount,
        equipment: aggregation.equipment.totalCount,
      },
    });

    // Step 7: Optionally save to database (if mode is 'draft' or 'auto_publish')
    let announcementId: string | undefined;
    
    if (mode === 'draft' || mode === 'auto_publish') {
      announcementId = await saveAnnouncement(announcement, mode === 'auto_publish', aggregation);
    }

    return {
      success: true,
      announcement,
      announcementId,
      lowData: isLowData,
      truncated,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    safetyLogger.error('Announcement generation failed', { error: errorMessage });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Save announcement to the database.
 */
async function saveAnnouncement(
  announcement: GeneratedAnnouncement,
  publish: boolean,
  aggregation?: SafetyDataAggregation
): Promise<string | undefined> {
  try {
    const supabase = getSupabaseAdmin();
    
    const metadata = {
      ...announcement.metadata,
      dataSources: aggregation ? {
        jsaCount: aggregation.jsa.totalCount,
        dvirCount: aggregation.dvir.totalCount,
        equipmentCount: aggregation.equipment.totalCount,
        totalSubmissions: aggregation.totals.totalSubmissions,
        nearMissCount: aggregation.totals.nearMissCount,
      } : undefined,
    };

    const { data, error } = await supabase
      .from('safety_announcements')
      .insert({
        title: announcement.title,
        body: announcement.body,
        summary: announcement.summary,
        sections: announcement.sections,
        metadata,
        status: publish ? 'published' : 'draft',
        published_at: publish ? nowISO() : null,
      })
      .select('id')
      .single();

    if (error) {
      safetyLogger.warn('Failed to save announcement to database', { error: error.message });
      return undefined;
    }

    safetyLogger.info('Announcement saved to database', { 
      id: data?.id, 
      status: publish ? 'published' : 'draft' 
    });
    return data?.id;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    safetyLogger.warn('Failed to save announcement', { error: errorMessage });
    return undefined;
  }
}

/**
 * Legacy export for aggregateHazards (returns HazardCount array).
 */
export async function aggregateHazards(submissions: JsaSubmission[]): Promise<HazardCount[]> {
  const aggregation = aggregateJsaData(submissions);
  return getTopItems(aggregation.hazardCounts, 10);
}

export default generateDailySafetyAnnouncement;
