/**
 * Supabase Edge Function: Generate Daily Safety Announcement
 * 
 * Scheduled to run at 7:00 AM CST Monday-Friday.
 * 
 * Fetches JSA, DVIR, and Equipment data from Supabase and generates
 * a safety announcement using OpenAI. Saves to the main announcements table
 * and sends a high-priority push notification to all users.
 * 
 * Deploy: supabase functions deploy generate-safety-announcement
 * 
 * Set secrets:
 *   supabase secrets set OPENAI_API_KEY=sk-your-key
 *   supabase secrets set INTERNAL_SECRET=your-internal-secret
 * 
 * Schedule (pg_cron):
 *   0 13 * * 1-5 -- 7 AM CST (13:00 UTC) Mon-Fri
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

const DEFAULT_TIMEZONE = 'America/Chicago';
const DEFAULT_WINDOW_HOURS = 48;
const MIN_SUBMISSIONS = 3;
const BODY_MAX_CHARS = 283;
const BODY_TARGET_CHARS = 238;
const SUMMARY_MAX_CHARS = 240;

// =============================================================================
// TYPES
// =============================================================================

interface HazardCount {
  hazard: string;
  count: number;
}

interface DvirIssue {
  type: string;
  truckNumber: string;
}

interface EquipmentIssue {
  type: string;
  equipmentType: string;
}

interface AggregatedStats {
  jsaCount: number;
  dvirCount: number;
  equipmentCount: number;
  totalSubmissions: number;
  topHazards: HazardCount[];
  topPPE: [string, number][];
  nearMissCount: number;
  weatherConditions: string[];
  dvirWithIssues: number;
  dvirIssues: DvirIssue[];
  equipmentWithIssues: number;
  equipmentIssues: EquipmentIssue[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get today's date in the specified timezone (YYYY-MM-DD format)
 */
function getTodayInTimezone(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Check if the given date is a weekday (Monday-Friday)
 */
function isWeekday(dateFor: string, timezone: string): boolean {
  const date = new Date(dateFor + 'T12:00:00');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayName = formatter.format(date);
  return !['Sat', 'Sun'].includes(dayName);
}

/**
 * Format date for display (e.g., "Saturday, January 11, 2026")
 */
function formatDateLong(timezone: string): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Truncate text at a word or sentence boundary
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  const truncateAt = maxLength - 3; // Room for "..."
  
  // Try to find end of sentence
  const sentenceEnd = text.lastIndexOf('. ', truncateAt);
  if (sentenceEnd > truncateAt * 0.7) {
    return text.slice(0, sentenceEnd + 1);
  }
  
  // Try to find end of word
  const wordEnd = text.lastIndexOf(' ', truncateAt);
  if (wordEnd > truncateAt * 0.5) {
    return text.slice(0, wordEnd) + '...';
  }
  
  // Hard truncate
  return text.slice(0, truncateAt) + '...';
}

// =============================================================================
// SYSTEM PROMPT (v2 - Enhanced)
// =============================================================================

const SYSTEM_PROMPT = `You are a safety communication assistant for ATTS (All Terrain Tree Service), a professional tree services company.

Your job is to generate clear, concise, and actionable safety announcements based on real safety data from multiple sources:
- JSA (Job Safety Analysis) forms
- DVIR (Daily Vehicle Inspection Reports)
- Daily Equipment Inspections

## CRITICAL CHARACTER LIMITS (STRICTLY ENFORCED)
- message: Target ${BODY_TARGET_CHARS} characters, MAXIMUM ${BODY_MAX_CHARS} characters
- The message MUST be under ${BODY_MAX_CHARS} characters including spaces and punctuation

## Content Priority (in order)
1. Near-misses (highest priority - these indicate close calls)
2. Equipment/vehicle failures or deficiencies
3. Top hazards identified in JSAs
4. PPE reminders based on data
5. Weather considerations

## Rules
1. GROUNDING: Only include claims supported by the provided data
2. NO FABRICATION: Never invent incidents, injuries, or statistics
3. ACTIONABLE: Tell employees what TO DO, not just what to avoid
4. SPECIFIC: Mention specific hazard counts and equipment issues when available
5. BREVITY: Be direct and concise - every word must count

## Output Format (JSON)
{
  "title": "Safety Briefing - {Full Date}",
  "message": "Main announcement - MUST be under ${BODY_MAX_CHARS} chars. Be direct, specific, and actionable. Start with key data points."
}

## Good Example (154 chars)
"26 reports filed. Top hazard: Falls (8). 2 trucks need brake checks. Verify fall protection before climbing. Inspect equipment pre-departure. Stay alert!"

## Bad Example (too vague, not grounded)
"Safety is important. Remember to be careful today. Watch out for hazards and wear your PPE."`;

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[SafetyAnnouncement] Starting at', new Date().toISOString());

  try {
    // Parse request body with defaults
    const body = await req.json().catch(() => ({}));
    const windowHours = body.windowHours ?? DEFAULT_WINDOW_HOURS;
    const dryRun = body.dryRun ?? false;
    const skipWeekendCheck = body.skipWeekendCheck ?? false;

    console.log('[SafetyAnnouncement] Config:', { windowHours, dryRun, skipWeekendCheck });

    // =======================================================================
    // Step 0: Check if today is a weekday (skip weekends)
    // =======================================================================
    const todayDate = getTodayInTimezone(DEFAULT_TIMEZONE);
    
    if (!skipWeekendCheck && !isWeekday(todayDate, DEFAULT_TIMEZONE)) {
      console.log('[SafetyAnnouncement] Skipping - weekend:', todayDate);
      return new Response(
        JSON.stringify({
          success: true,
          status: 'skipped',
          reason: 'weekend',
          dateFor: todayDate,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================================
    // Step 1: Initialize clients
    // =======================================================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const internalSecret = Deno.env.get('INTERNAL_SECRET') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY secret is not set. Run: supabase secrets set OPENAI_API_KEY=sk-your-key');
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    // =======================================================================
    // Step 2: Fetch all data sources in parallel
    // =======================================================================
    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
    console.log('[SafetyAnnouncement] Fetching data since:', windowStart);

    const [jsaResult, dvirResult, equipmentResult] = await Promise.all([
      // Fetch JSAs
      supabase
        .from('daily_jsa')
        .select('hazards_present, ppe, weather_conditions, weather_hazards, jobs_performed, notes')
        .gte('created_at', windowStart),
      
      // Fetch DVIRs
      supabase
        .from('dvir_reports')
        .select('truck_number, vehicle_trailer_checklist, aerial_checklist, notes, aerial_notes, deficiency_corrected')
        .gte('created_at', windowStart),
      
      // Fetch Equipment Inspections
      supabase
        .from('daily_equipment_inspections')
        .select('equipment_type, equipment_number, general_checklist, specific_checklist, notes')
        .gte('created_at', windowStart),
    ]);

    // Handle errors gracefully
    if (jsaResult.error) {
      console.error('[SafetyAnnouncement] JSA fetch error:', jsaResult.error.message);
    }
    if (dvirResult.error) {
      console.error('[SafetyAnnouncement] DVIR fetch error:', dvirResult.error.message);
    }
    if (equipmentResult.error) {
      console.error('[SafetyAnnouncement] Equipment fetch error:', equipmentResult.error.message);
    }

    const jsas = jsaResult.data || [];
    const dvirs = dvirResult.data || [];
    const equipmentInspections = equipmentResult.data || [];

    console.log('[SafetyAnnouncement] Data fetched - JSA:', jsas.length, 'DVIR:', dvirs.length, 'Equipment:', equipmentInspections.length);

    // =======================================================================
    // Step 3: Aggregate JSA data
    // =======================================================================
    const hazardCounts = new Map<string, number>();
    const ppeCounts = new Map<string, number>();
    let nearMissCount = 0;
    const weatherConditions = new Set<string>();

    for (const jsa of jsas) {
      // hazards_present is a JSON object like { "Electrical Contact": true, "Falls": true }
      if (jsa.hazards_present && typeof jsa.hazards_present === 'object') {
        for (const [hazard, isPresent] of Object.entries(jsa.hazards_present)) {
          if (isPresent === true) {
            hazardCounts.set(hazard, (hazardCounts.get(hazard) || 0) + 1);
          }
        }
      }
      
      // ppe is a JSON object like { "Hard Hat": { required: true, condition: "good" } }
      if (jsa.ppe && typeof jsa.ppe === 'object') {
        for (const [ppeItem, state] of Object.entries(jsa.ppe)) {
          if (state && typeof state === 'object' && (state as { required?: boolean }).required) {
            ppeCounts.set(ppeItem, (ppeCounts.get(ppeItem) || 0) + 1);
          }
        }
      }
      
      // Check notes for near-miss mentions
      if (jsa.notes && typeof jsa.notes === 'string') {
        const notesLower = jsa.notes.toLowerCase();
        if (notesLower.includes('near miss') || notesLower.includes('near-miss') || notesLower.includes('close call')) {
          nearMissCount++;
        }
      }
      
      // weather_conditions is a JSON object
      if (jsa.weather_conditions && typeof jsa.weather_conditions === 'object') {
        const wc = jsa.weather_conditions as { conditions?: Record<string, boolean>; modifiers?: Record<string, boolean> };
        if (wc.conditions) {
          for (const [condition, isActive] of Object.entries(wc.conditions)) {
            if (isActive === true) weatherConditions.add(condition);
          }
        }
        if (wc.modifiers) {
          for (const [modifier, isActive] of Object.entries(wc.modifiers)) {
            if (isActive === true) weatherConditions.add(modifier);
          }
        }
      }
      
      // Also check weather_hazards text field
      if (jsa.weather_hazards && typeof jsa.weather_hazards === 'string' && jsa.weather_hazards.trim()) {
        weatherConditions.add(jsa.weather_hazards.trim());
      }
    }

    const topHazards: HazardCount[] = [...hazardCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hazard, count]) => ({ hazard, count }));

    const topPPE: [string, number][] = [...ppeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // =======================================================================
    // Step 4: Aggregate DVIR data
    // =======================================================================
    const dvirIssues: DvirIssue[] = [];
    let dvirWithIssues = 0;

    for (const dvir of dvirs) {
      let hasIssue = false;
      
      if (dvir.vehicle_trailer_checklist) {
        const checklist = dvir.vehicle_trailer_checklist as Record<string, unknown>;
        for (const [key, value] of Object.entries(checklist)) {
          if (value === false || value === 'fail' || value === 'Fail') {
            hasIssue = true;
            dvirIssues.push({
              type: key.replace(/_/g, ' '),
              truckNumber: dvir.truck_number || 'Unknown',
            });
          }
        }
      }
      
      if (dvir.aerial_checklist) {
        const checklist = dvir.aerial_checklist as Record<string, unknown>;
        for (const [key, value] of Object.entries(checklist)) {
          if (value === false || value === 'fail' || value === 'Fail') {
            hasIssue = true;
            dvirIssues.push({
              type: `Aerial: ${key.replace(/_/g, ' ')}`,
              truckNumber: dvir.truck_number || 'Unknown',
            });
          }
        }
      }
      
      if (hasIssue) dvirWithIssues++;
    }

    // =======================================================================
    // Step 5: Aggregate Equipment Inspection data
    // =======================================================================
    const equipmentIssues: EquipmentIssue[] = [];
    let equipmentWithIssues = 0;

    for (const inspection of equipmentInspections) {
      let hasIssue = false;
      
      if (inspection.general_checklist && typeof inspection.general_checklist === 'object') {
        const checklist = inspection.general_checklist as Record<string, unknown>;
        for (const [key, value] of Object.entries(checklist)) {
          if (value === false || value === 'fail' || value === 'Fail' || value === 'no' || value === 'No') {
            hasIssue = true;
            equipmentIssues.push({
              type: key.replace(/_/g, ' '),
              equipmentType: `${inspection.equipment_type || 'Unknown'} #${inspection.equipment_number || '?'}`,
            });
          }
        }
      }
      
      if (inspection.specific_checklist && typeof inspection.specific_checklist === 'object') {
        const checklist = inspection.specific_checklist as Record<string, unknown>;
        for (const [key, value] of Object.entries(checklist)) {
          if (value === false || value === 'fail' || value === 'Fail' || value === 'no' || value === 'No') {
            hasIssue = true;
            equipmentIssues.push({
              type: key.replace(/_/g, ' '),
              equipmentType: `${inspection.equipment_type || 'Unknown'} #${inspection.equipment_number || '?'}`,
            });
          }
        }
      }
      
      if (hasIssue) equipmentWithIssues++;
    }

    // =======================================================================
    // Step 6: Build aggregated stats
    // =======================================================================
    const totalSubmissions = jsas.length + dvirs.length + equipmentInspections.length;
    
    const stats: AggregatedStats = {
      jsaCount: jsas.length,
      dvirCount: dvirs.length,
      equipmentCount: equipmentInspections.length,
      totalSubmissions,
      topHazards,
      topPPE,
      nearMissCount,
      weatherConditions: [...weatherConditions],
      dvirWithIssues,
      dvirIssues,
      equipmentWithIssues,
      equipmentIssues,
    };

    console.log('[SafetyAnnouncement] Stats aggregated:', {
      totalSubmissions,
      nearMissCount,
      topHazardsCount: topHazards.length,
      dvirWithIssues,
      equipmentWithIssues,
    });

    // =======================================================================
    // Step 7: Generate announcement with OpenAI
    // =======================================================================
    const todayFormatted = formatDateLong(DEFAULT_TIMEZONE);
    const isLowData = totalSubmissions < MIN_SUBMISSIONS;

    let userPrompt: string;
    
    if (isLowData) {
      userPrompt = `Date: ${todayFormatted}
Time Window: Last ${windowHours} hours
Total Submissions: ${totalSubmissions} (below minimum threshold of ${MIN_SUBMISSIONS})

Generate a "low data" safety reminder. Since we have limited submissions across JSA, DVIR, and equipment inspections, focus on general safety reminders rather than specific trends.

The message should acknowledge limited data and provide standard safety reminders for tree service work.`;
    } else {
      userPrompt = `Date: ${todayFormatted}
Time Window: Last ${windowHours} hours

=== SUBMISSION SUMMARY ===
Total Reports: ${totalSubmissions}
- JSA Forms: ${jsas.length}
- DVIR Reports: ${dvirs.length}
- Equipment Inspections: ${equipmentInspections.length}

=== JSA DATA ===
Top Hazards Identified:
${topHazards.length > 0 ? topHazards.map((h, i) => `${i + 1}. ${h.hazard} - ${h.count} mentions`).join('\n') : 'None reported'}

PPE Requirements Noted:
${topPPE.length > 0 ? topPPE.map(([p, c], i) => `${i + 1}. ${p} - ${c} mentions`).join('\n') : 'None specified'}

Near-misses reported: ${nearMissCount}
Weather conditions: ${[...weatherConditions].join(', ') || 'None specified'}

=== DVIR DATA ===
Total vehicle inspections: ${dvirs.length}
Vehicles with issues: ${dvirWithIssues}
${dvirIssues.length > 0 ? `Key vehicle issues:\n${dvirIssues.slice(0, 3).map(i => `- Truck ${i.truckNumber}: ${i.type}`).join('\n')}` : 'No vehicle defects reported'}

=== EQUIPMENT DATA ===
Total equipment inspections: ${equipmentInspections.length}
Equipment with issues: ${equipmentWithIssues}
${equipmentIssues.length > 0 ? `Key equipment issues:\n${equipmentIssues.slice(0, 3).map(i => `- ${i.equipmentType}: ${i.type}`).join('\n')}` : 'All equipment passed inspection'}

Generate a safety announcement that synthesizes the most important findings. Remember: message MUST be under ${BODY_MAX_CHARS} characters.`;
    }

    console.log('[SafetyAnnouncement] Calling OpenAI...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 512,
    });

    const generated = JSON.parse(completion.choices[0].message.content || '{}');
    
    // Validate and potentially truncate the message
    let message = generated.message || 'Stay safe today! Complete your JSA, inspect equipment, and wear required PPE.';
    const originalLength = message.length;
    
    if (message.length > BODY_MAX_CHARS) {
      console.warn('[SafetyAnnouncement] Message too long, truncating:', message.length, '->', BODY_MAX_CHARS);
      message = truncateText(message, BODY_MAX_CHARS);
    }

    console.log('[SafetyAnnouncement] Generated message:', message.length, 'chars');

    // =======================================================================
    // Step 8: Save to announcements table (unless dry run)
    // =======================================================================
    let announcementId = null;
    let notificationResult: { dispatched: number; skipped: number; failed?: number } = { dispatched: 0, skipped: 0 };
    
    if (!dryRun) {
      // Generate title with time for uniqueness
      const timeStr = new Date().toLocaleTimeString('en-US', { 
        timeZone: DEFAULT_TIMEZONE,
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true,
      });
      const baseTitle = generated.title || `Safety Briefing - ${todayFormatted}`;
      const uniqueTitle = `${baseTitle} (${timeStr})`;
      
      console.log('[SafetyAnnouncement] Saving to database...');
      
      const { data: saved, error: saveError } = await supabase
        .from('announcements')
        .insert({
          title: uniqueTitle,
          message: message,
          author: 'Safety AI',
          date: todayDate,
          raw_data: {
            source: 'safety_agent',
            stats,
            windowHours,
            promptVersion: 'v2',
            model: 'gpt-4o-mini',
            generatedAt: new Date().toISOString(),
            messageCharCount: message.length,
            originalCharCount: originalLength,
            truncated: originalLength > BODY_MAX_CHARS,
            lowData: isLowData,
          },
        })
        .select('id')
        .single();

      if (saveError) {
        console.error('[SafetyAnnouncement] Failed to save:', saveError.message);
        throw saveError;
      }
      
      announcementId = saved?.id;
      console.log('[SafetyAnnouncement] Saved with ID:', announcementId);

      // =====================================================================
      // Step 9: Send push notification
      // =====================================================================
      try {
        const notificationBody = message.length > 200 
          ? message.substring(0, 197) + '...'
          : message;
        
        console.log('[SafetyAnnouncement] Creating notification event...');
        
        const { data: notificationEvent, error: eventError } = await supabase
          .from('notification_events')
          .insert({
            category: 'safety_alert',
            severity: 'high',
            target_type: 'all',
            target_ref: null,
            title: `⚠️ ${uniqueTitle}`,
            body: notificationBody,
            url: '/announcements',
            entity_type: 'announcement',
            entity_id: announcementId,
          })
          .select('id')
          .single();

        if (eventError) {
          console.error('[SafetyAnnouncement] Failed to create notification event:', eventError.message);
        } else if (notificationEvent && internalSecret) {
          console.log('[SafetyAnnouncement] Notification event created:', notificationEvent.id);
          
          // Call notifications-dispatch
          const dispatchResponse = await fetch(`${supabaseUrl}/functions/v1/notifications-dispatch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'x-internal-key': internalSecret,
            },
            body: JSON.stringify({ event_id: notificationEvent.id }),
          });

          if (dispatchResponse.ok) {
            const dispatchResult = await dispatchResponse.json();
            notificationResult = {
              dispatched: dispatchResult.dispatched || 0,
              skipped: dispatchResult.skipped || 0,
            };
            console.log('[SafetyAnnouncement] Outbox entries created:', notificationResult);
            
            // Call notifications-worker to actually send the push notifications
            console.log('[SafetyAnnouncement] Triggering notifications-worker...');
            const workerResponse = await fetch(`${supabaseUrl}/functions/v1/notifications-worker`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'x-internal-key': internalSecret,
              },
              body: JSON.stringify({}),
            });

            if (workerResponse.ok) {
              const workerResult = await workerResponse.json();
              console.log('[SafetyAnnouncement] Worker result:', workerResult);
              notificationResult = {
                dispatched: workerResult.sent || 0,
                skipped: workerResult.skipped || 0,
                failed: workerResult.failed || 0,
              };
            } else {
              const workerError = await workerResponse.text();
              console.error('[SafetyAnnouncement] Worker failed:', workerError);
            }
          } else {
            const errorText = await dispatchResponse.text();
            console.error('[SafetyAnnouncement] Failed to dispatch notifications:', errorText);
          }
        } else if (!internalSecret) {
          console.warn('[SafetyAnnouncement] INTERNAL_SECRET not set - push notifications skipped');
        }
      } catch (notificationError) {
        console.error('[SafetyAnnouncement] Notification error:', notificationError);
        // Don't fail the whole request
      }
    } else {
      console.log('[SafetyAnnouncement] Dry run - skipping save and notification');
    }

    // =======================================================================
    // Step 10: Return response
    // =======================================================================
    const duration = Date.now() - startTime;
    console.log('[SafetyAnnouncement] Completed in', duration, 'ms');

    return new Response(
      JSON.stringify({
        success: true,
        status: 'success',
        dateFor: todayDate,
        announcement: {
          title: generated.title,
          body: message,
          summary: message.substring(0, SUMMARY_MAX_CHARS),
          charCount: message.length,
          truncated: originalLength > BODY_MAX_CHARS,
        },
        announcementId,
        stats: {
          jsaCount: jsas.length,
          dvirCount: dvirs.length,
          equipmentCount: equipmentInspections.length,
          totalSubmissions,
          topHazards,
          nearMissCount,
          dvirWithIssues,
          equipmentWithIssues,
          tokensUsed: completion.usage?.total_tokens || 0,
        },
        notification: notificationResult,
        dryRun,
        lowData: isLowData,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SafetyAnnouncement] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        status: 'failed',
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
