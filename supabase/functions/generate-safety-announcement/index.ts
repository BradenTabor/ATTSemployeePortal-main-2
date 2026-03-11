// @ts-nocheck
/**
 * Supabase Edge Function: Generate Daily Safety Announcement
 * 
 * Scheduled to run at 5:00 AM Central Monday-Friday (matches reward claim window 5–8 AM).
 * Cron job name: safety-announcement-5am. 10:00 UTC = 5 AM CDT / 4 AM CST.
 * 
 * Fetches JSA, DVIR, and Equipment data from Supabase and generates
 * a safety announcement using OpenAI. Saves to the main announcements table
 * and sends a high-priority push notification to all users.
 * 
 * ## Authentication (Required)
 * This function requires authentication via ONE of:
 * 1. Authorization header with service role key: `Authorization: Bearer <service_role_key>`
 * 2. Internal secret header: `x-internal-secret: <internal_secret>`
 * 
 * The pg_cron job uses the service role key for authentication.
 * 
 * ## Deploy
 * supabase functions deploy generate-safety-announcement
 * 
 * ## Set secrets
 * supabase secrets set OPENAI_API_KEY=sk-your-key
 * supabase secrets set INTERNAL_SECRET=your-internal-secret
 * 
 * ## Schedule (pg_cron)
 * 0 10 * * 1-5 -- 5 AM Central (10:00 UTC) Mon-Fri
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4';

// Import from extracted modules
import type { HazardCount, DvirIssue, EquipmentIssue, AggregatedStats } from './types.ts';
import { 
  DEFAULT_TIMEZONE, 
  DEFAULT_WINDOW_HOURS, 
  MIN_SUBMISSIONS, 
  BODY_MAX_CHARS, 
  SUMMARY_MAX_CHARS 
} from './config.ts';
import { corsHeaders, getTodayInTimezone, isWeekday, formatDateLong, truncateText } from './utils.ts';
import { SYSTEM_PROMPT, LOW_DATA_MESSAGE } from './prompts.ts';
import { aggregateJsaData, aggregateDvirData, aggregateEquipmentData, buildUserPrompt } from './aggregation.ts';


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
    // =======================================================================
    // Authentication: Accept service role key OR internal secret
    // =======================================================================
    const authHeader = req.headers.get('authorization');
    const internalSecretHeader = req.headers.get('x-internal-secret');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const expectedInternalSecret = Deno.env.get('INTERNAL_SECRET');

    // Extract bearer token safely
    const bearerToken = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : null;

    const isServiceRole = bearerToken && bearerToken === serviceRoleKey;
    const isInternalSecret = internalSecretHeader && expectedInternalSecret && 
                             internalSecretHeader === expectedInternalSecret;

    // If neither auth method is valid, reject the request
    if (!isServiceRole && !isInternalSecret) {
      const hintCron = bearerToken === 'SERVICE_ROLE_KEY_PLACEHOLDER'
        ? 'Cron job is using placeholder key. Run: SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_DB_URL=... ./scripts/deploy-cron-auth.sh'
        : 'Provide either Authorization header (service role) or x-internal-secret header';
      console.warn('[SafetyAnnouncement] Unauthorized request:', {
        hasAuthHeader: !!authHeader,
        hasInternalSecret: !!internalSecretHeader,
        placeholderKey: bearerToken === 'SERVICE_ROLE_KEY_PLACEHOLDER',
        timestamp: new Date().toISOString()
      });

      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          hint: hintCron,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Log auth method for debugging
    console.log('[SafetyAnnouncement] Authenticated via:', isServiceRole ? 'service_role' : 'internal_secret');

    // Parse request body with defaults
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun ?? false;
    const skipWeekendCheck = body.skipWeekendCheck ?? false;

    // =======================================================================
    // Read admin-configurable settings from app_settings (single read)
    // =======================================================================
    const supabaseUrlEarly = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKeyEarly = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    let announcementConfig: Record<string, unknown> = {};
    if (supabaseUrlEarly && supabaseKeyEarly) {
      const earlyClient = createClient(supabaseUrlEarly, supabaseKeyEarly);
      const { data: settingsRow } = await earlyClient
        .from('app_settings')
        .select('value')
        .eq('key', 'safety_announcement_config')
        .maybeSingle();
      if (settingsRow?.value && typeof settingsRow.value === 'object') {
        announcementConfig = settingsRow.value as Record<string, unknown>;
      }
    }

    // Check if feature is disabled by admin
    if (announcementConfig.enabled === false && !dryRun) {
      console.log('[SafetyAnnouncement] Disabled via app_settings; skipping.');
      return new Response(
        JSON.stringify({ success: true, status: 'skipped', reason: 'disabled_by_admin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Override config with DB values (fall back to imported constants / request body)
    const windowHours = typeof announcementConfig.window_hours === 'number'
      ? announcementConfig.window_hours
      : (body.windowHours ?? DEFAULT_WINDOW_HOURS);
    const cfgMinSubmissions = typeof announcementConfig.min_submissions === 'number'
      ? announcementConfig.min_submissions
      : MIN_SUBMISSIONS;
    const cfgBodyMaxChars = typeof announcementConfig.body_max_chars === 'number'
      ? announcementConfig.body_max_chars
      : BODY_MAX_CHARS;
    const cfgSummaryMaxChars = typeof announcementConfig.summary_max_chars === 'number'
      ? announcementConfig.summary_max_chars
      : SUMMARY_MAX_CHARS;
    const cfgCustomPrompt = typeof announcementConfig.custom_prompt_instructions === 'string'
      ? announcementConfig.custom_prompt_instructions
      : '';

    console.log('[SafetyAnnouncement] Config:', { windowHours, dryRun, skipWeekendCheck, cfgMinSubmissions, cfgBodyMaxChars });

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
    // Step 3-6: Aggregate all data using extracted functions
    // =======================================================================
    const jsaStats = aggregateJsaData(jsas);
    const dvirStats = aggregateDvirData(dvirs);
    const equipmentStats = aggregateEquipmentData(equipmentInspections);
    
    const totalSubmissions = jsas.length + dvirs.length + equipmentInspections.length;
    
    const stats: AggregatedStats = {
      jsaCount: jsas.length,
      dvirCount: dvirs.length,
      equipmentCount: equipmentInspections.length,
      totalSubmissions,
      topHazards: jsaStats.topHazards,
      topPPE: jsaStats.topPPE,
      nearMissCount: jsaStats.nearMissCount,
      weatherConditions: jsaStats.weatherConditions,
      dvirWithIssues: dvirStats.dvirWithIssues,
      dvirIssues: dvirStats.dvirIssues,
      equipmentWithIssues: equipmentStats.equipmentWithIssues,
      equipmentIssues: equipmentStats.equipmentIssues,
    };

    // Destructure for easier access
    const {
      topHazards,
      topPPE,
      nearMissCount,
      dvirWithIssues,
      equipmentWithIssues,
      weatherConditions,
      jsaCount,
      dvirCount,
      equipmentCount,
      dvirIssues,
      equipmentIssues,
    } = stats;

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
    const isLowData = totalSubmissions < cfgMinSubmissions;

    let userPrompt: string;
    
    if (isLowData) {
      userPrompt = `Date: ${todayFormatted}
Time Window: Last ${windowHours} hours

Generate a warm, caring safety reminder for the ATTS team. Focus on general safety reminders for tree service work with a warm, family-oriented tone.

DO NOT mention anything about "limited data" or "few submissions" - just provide an encouraging safety message.

The message should:
- Start with a warm greeting like "Hey ATTS Family," or "Hey team,"
- Include appreciation for the crew's hard work
- Provide general safety reminders relevant to tree service work
- End with an encouraging phrase like "Stay safe out there!" or "Watch out for each other!"

Remember: NO statistics or data references in the message.`;
    } else {
      userPrompt = `Date: ${todayFormatted}
Time Window: Last ${windowHours} hours

=== CONTEXT DATA (for your reference only - DO NOT include these numbers in your message) ===

Top Hazards Identified:
${topHazards.length > 0 ? topHazards.map((h, i) => `${i + 1}. ${h.hazard}`).join('\n') : 'None reported'}

PPE Requirements Noted:
${topPPE.length > 0 ? topPPE.map(([p], i) => `${i + 1}. ${p}`).join('\n') : 'None specified'}

Near-misses reported: ${nearMissCount > 0 ? 'Yes - be extra cautious' : 'None'}
Weather conditions: ${[...weatherConditions].join(', ') || 'None specified'}

Vehicle/Equipment Issues:
${dvirWithIssues > 0 || equipmentWithIssues > 0 ? 'Some equipment needs attention - remind about pre-trip inspections' : 'All equipment passed inspection'}

=== YOUR TASK ===
Generate a warm, personalized safety message for the ATTS crew based on the conditions above.

CRITICAL REMINDERS:
- DO NOT include any statistics, counts, or numbers in your message
- DO NOT mention "X reports filed" or "X hazards identified"
- START with a warm greeting like "Hey ATTS Family," or "Hey team,"
- INCLUDE appreciation for the crew's work
- MENTION relevant conditions (weather, equipment reminders) naturally
- END with an encouraging phrase
- Message MUST be under ${cfgBodyMaxChars} characters`;
    }

    console.log('[SafetyAnnouncement] Calling OpenAI...');
    
    // Build system prompt with optional custom instructions from admin
    const systemPromptFull = cfgCustomPrompt
      ? `${SYSTEM_PROMPT}\n\n## Additional Instructions (from admin settings)\n${cfgCustomPrompt}`
      : SYSTEM_PROMPT;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPromptFull },
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
    
    if (message.length > cfgBodyMaxChars) {
      console.warn('[SafetyAnnouncement] Message too long, truncating:', message.length, '->', cfgBodyMaxChars);
      message = truncateText(message, cfgBodyMaxChars);
    }

    console.log('[SafetyAnnouncement] Generated message:', message.length, 'chars');

    // Build sections and relatedForms for briefing page (Phase 1)
    const overview = message.split(/[.!?]/)[0]?.trim() ? `${message.split(/[.!?]/)[0].trim()}.` : message.slice(0, 120);
    const sections = {
      overview,
      topHazards: topHazards.map((h) => ({ hazard: h.hazard, count: h.count, note: '' })),
      ppeReminders: (topPPE || []).map(([name]) => name),
      equipmentAlerts: [
        ...(dvirIssues || []).slice(0, 3).map((d) => `${d.type} (${d.truckNumber})`),
        ...(equipmentIssues || []).slice(0, 2).map((e) => `${e.type}: ${e.equipmentType}`),
      ],
      expectations: [
        'Complete pre-trip inspections before heading out.',
        'Wear required PPE at all times.',
        ...(nearMissCount > 0 ? ['Stay extra cautious — near-misses reported recently.'] : []),
      ].slice(0, 3),
    };
    const relatedForms: string[] = [];
    if (dvirCount > 0 || dvirWithIssues > 0) relatedForms.push('dvir');
    if (equipmentCount > 0 || equipmentWithIssues > 0) relatedForms.push('equipment');
    if (jsaCount > 0) relatedForms.push('jsa');

    // Optional: fetch today's conditions for the briefing page (conditions card)
    let conditions = null;
    const openWeatherKey = Deno.env.get('OPENWEATHER_API_KEY');
    const lat = Deno.env.get('OPENWEATHER_LAT');
    const lon = Deno.env.get('OPENWEATHER_LON');
    if (openWeatherKey && lat && lon) {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${openWeatherKey}`
        );
        if (res.ok) {
          const data = await res.json();
          const tempF = Math.round(Number(data.main?.temp ?? 70));
          const windSpeed = Math.round(Number(data.wind?.speed ?? 0));
          const desc = data.weather?.[0]?.description || 'Clear';
          conditions = {
            tempF,
            windSpeed,
            conditions: desc.charAt(0).toUpperCase() + desc.slice(1),
            note: 'Dress for the conditions; check your gear before heading out.',
          };
        }
      } catch (e) {
        console.warn('[SafetyAnnouncement] Weather fetch failed:', e);
      }
    }

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
            sections,
            relatedForms,
            ...(conditions ? { conditions } : {}),
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
          summary: message.substring(0, cfgSummaryMaxChars),
          charCount: message.length,
          truncated: originalLength > cfgBodyMaxChars,
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
