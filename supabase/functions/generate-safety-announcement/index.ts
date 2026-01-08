/**
 * Supabase Edge Function: Generate Daily Safety Announcement
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
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'https://esm.sh/openai@4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { windowHours = 24, dryRun = false } = await req.json().catch(() => ({}));

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const internalSecret = Deno.env.get('INTERNAL_SECRET') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY secret is not set. Run: supabase secrets set OPENAI_API_KEY=sk-your-key');
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    // =========================================================================
    // Step 1: Fetch all data sources in parallel
    // =========================================================================
    const [jsaResult, dvirResult, equipmentResult] = await Promise.all([
      // Fetch JSAs - using correct column names from schema
      supabase
        .from('daily_jsa')
        .select('hazards_present, ppe, weather_conditions, weather_hazards, jobs_performed, notes')
        .gte('created_at', windowStart),
      
      // Fetch DVIRs
      supabase
        .from('dvir_reports')
        .select('truck_number, vehicle_trailer_checklist, aerial_checklist, notes, aerial_notes, deficiency_corrected')
        .gte('created_at', windowStart),
      
      // Fetch Equipment Inspections - using correct column names
      supabase
        .from('daily_equipment_inspections')
        .select('equipment_type, equipment_number, general_checklist, specific_checklist, notes')
        .gte('created_at', windowStart),
    ]);

    if (jsaResult.error) throw jsaResult.error;
    if (dvirResult.error) throw dvirResult.error;
    if (equipmentResult.error) throw equipmentResult.error;

    const jsas = jsaResult.data || [];
    const dvirs = dvirResult.data || [];
    const equipmentInspections = equipmentResult.data || [];

    // =========================================================================
    // Step 2: Aggregate JSA data
    // =========================================================================
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
      
      // weather_conditions is a JSON object like { conditions: { sunny: true }, modifiers: { windy: true } }
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

    const topPPE = [...ppeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // =========================================================================
    // Step 3: Aggregate DVIR data
    // =========================================================================
    const dvirIssues: DvirIssue[] = [];
    let dvirWithIssues = 0;

    for (const dvir of dvirs) {
      let hasIssue = false;
      
      // Check vehicle/trailer checklist for failures
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
      
      // Check aerial checklist for failures
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

    // =========================================================================
    // Step 4: Aggregate Equipment Inspection data
    // =========================================================================
    const equipmentIssues: EquipmentIssue[] = [];
    let equipmentWithIssues = 0;

    for (const inspection of equipmentInspections) {
      let hasIssue = false;
      
      // Check general_checklist for failures (JSONB field)
      if (inspection.general_checklist && typeof inspection.general_checklist === 'object') {
        const checklist = inspection.general_checklist as Record<string, unknown>;
        for (const [key, value] of Object.entries(checklist)) {
          // Check for fail/false values
          if (value === false || value === 'fail' || value === 'Fail' || value === 'no' || value === 'No') {
            hasIssue = true;
            equipmentIssues.push({
              type: key.replace(/_/g, ' '),
              equipmentType: `${inspection.equipment_type || 'Unknown'} #${inspection.equipment_number || '?'}`,
            });
          }
        }
      }
      
      // Check specific_checklist for failures (JSONB field)
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

    // =========================================================================
    // Step 5: Generate announcement with OpenAI
    // =========================================================================
    const today = new Date();
    const todayFormatted = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    // Format date for database (YYYY-MM-DD)
    const todayDate = today.toISOString().split('T')[0];

    const totalSubmissions = jsas.length + dvirs.length + equipmentInspections.length;

    const userPrompt = `Date: ${todayFormatted}
Time Window: Last ${windowHours} hours

=== JSA FORMS (${jsas.length} submissions) ===
Top Hazards:
${topHazards.length > 0 ? topHazards.map((h, i) => `${i + 1}. ${h.hazard} - ${h.count} mentions`).join('\n') : 'None reported'}

PPE Mentioned:
${topPPE.length > 0 ? topPPE.map(([p, c], i) => `${i + 1}. ${p} - ${c} mentions`).join('\n') : 'None specified'}

Near-misses: ${nearMissCount} reported
Weather conditions: ${[...weatherConditions].join(', ') || 'None specified'}

=== DVIR REPORTS (${dvirs.length} inspections) ===
Vehicles with issues: ${dvirWithIssues}
${dvirIssues.length > 0 ? `Key issues:\n${dvirIssues.slice(0, 5).map(i => `- Truck ${i.truckNumber}: ${i.type}`).join('\n')}` : 'No vehicle defects reported'}

=== EQUIPMENT INSPECTIONS (${equipmentInspections.length} inspections) ===
Equipment with issues: ${equipmentWithIssues}
${equipmentIssues.length > 0 ? `Key issues:\n${equipmentIssues.slice(0, 5).map(i => `- ${i.equipmentType}: ${i.type}`).join('\n')}` : 'All equipment passed inspection'}

Generate a comprehensive safety announcement. The message should be informative and actionable.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a safety communication assistant for ATTS, a professional tree services company.
Generate concise, actionable safety announcements based on JSA forms, DVIR vehicle inspections, and equipment inspections.
Prioritize: near-misses > equipment failures > top hazards > PPE reminders.

Return JSON format:
{
  "title": "Safety Briefing - {full date like January 8, 2026}",
  "message": "The main announcement message - be direct, actionable, and mention specific hazards or issues. Can be 2-4 sentences."
}`,
        },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const generated = JSON.parse(completion.choices[0].message.content || '{}');

    // =========================================================================
    // Step 6: Save to announcements table (unless dry run)
    // =========================================================================
    let announcementId = null;
    let notificationResult = { dispatched: 0, skipped: 0 };
    
    if (!dryRun) {
      // Generate a unique title - add time to ensure uniqueness for same-day runs
      const timeStr = new Date().toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      const baseTitle = generated.title || `Safety Briefing - ${todayFormatted}`;
      // Only add time suffix if running multiple times per day
      const uniqueTitle = `${baseTitle} (${timeStr})`;
      
      // Insert into the main announcements table
      const { data: saved, error: saveError } = await supabase
        .from('announcements')
        .insert({
          title: uniqueTitle,
          message: generated.message || 'Stay safe today! Check your PPE and equipment before starting work.',
          author: 'Safety AI',
          date: todayDate,
        })
        .select('id')
        .single();

      if (saveError) {
        console.error('Failed to save announcement:', saveError);
        throw saveError;
      } else {
        announcementId = saved?.id;
        console.log('Announcement saved with ID:', announcementId);
      }

      // =========================================================================
      // Step 7: Send HIGH PRIORITY push notification to all users
      // =========================================================================
      try {
        // Create notification event in database
        const notificationBody = generated.message?.length > 200 
          ? generated.message.substring(0, 197) + '...'
          : generated.message;
        
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
          console.error('Failed to create notification event:', eventError);
        } else if (notificationEvent && internalSecret) {
          console.log('Notification event created:', notificationEvent.id);
          
          // Call notifications-dispatch to send push notifications
          const dispatchResponse = await fetch(`${supabaseUrl}/functions/v1/notifications-dispatch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
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
            console.log('Push notifications dispatched:', notificationResult);
          } else {
            console.error('Failed to dispatch notifications:', await dispatchResponse.text());
          }
        } else if (!internalSecret) {
          console.warn('INTERNAL_SECRET not set - push notifications skipped');
        }
      } catch (notificationError) {
        // Don't fail the whole request if notification fails
        console.error('Error sending push notification:', notificationError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        announcement: {
          title: generated.title,
          body: generated.message,
          summary: generated.message?.substring(0, 240) || '',
        },
        announcementId,
        stats: {
          jsaCount: jsas.length,
          dvirCount: dvirs.length,
          equipmentCount: equipmentInspections.length,
          totalSubmissions,
          topHazards,
          nearMissCount,
          tokensUsed: completion.usage?.total_tokens || 0,
        },
        notification: notificationResult,
        dryRun,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
