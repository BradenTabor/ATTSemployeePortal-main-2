/**
 * Supabase Edge Function: Generate Maintenance Summary
 * 
 * Generates AI-powered maintenance recommendations for a vehicle.
 * Uses caching to minimize OpenAI API calls - regenerates only when:
 * 1. New DVIR is logged for the truck
 * 2. New maintenance is logged
 * 3. 7 days since last generation
 * 
 * ## Authentication
 * Requires authenticated user (mechanic or admin role)
 * 
 * ## Deploy
 * supabase functions deploy generate-maintenance-summary
 * 
 * ## Secrets
 * supabase secrets set OPENAI_API_KEY=sk-your-key
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

const CACHE_EXPIRY_DAYS = 7;
const MAX_SUMMARY_LENGTH = 200;

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const SYSTEM_PROMPT = `You are a fleet maintenance advisor for ATTS (All Terrain Tree Service).

Your job is to generate brief, actionable maintenance recommendations based on vehicle data.

## Rules
1. Be concise - responses should be 1-3 sentences, under 200 characters total
2. Prioritize urgent issues (overdue maintenance, recent DVIR failures)
3. Be specific about what needs attention
4. Don't fabricate - only mention issues present in the data

## Examples
Good: "Oil change overdue by 1,200 miles. Tire rotation due soon. Recent brake light failure should be addressed."
Bad: "This vehicle needs regular maintenance to ensure safe operation." (too vague)`;

// =============================================================================
// TYPES
// =============================================================================

interface MaintenanceData {
  truckNumber: string;
  currentMileage: number;
  milesSinceOilChange: number;
  lastOilChangeDate: string | null;
  oilChangeInterval: number;
  milesSinceTireRotation: number;
  lastTireRotationDate: string | null;
  tireRotationInterval: number;
  recentDvirFailures: string[];
  urgencyLevel: 'overdue' | 'due_soon' | 'upcoming' | 'ok';
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function buildPrompt(data: MaintenanceData): string {
  return `Generate a maintenance summary for this vehicle:

Truck: ${data.truckNumber}
Current Mileage: ${data.currentMileage.toLocaleString()}

Oil Change Status:
- Miles since last: ${data.milesSinceOilChange.toLocaleString()}
- Last service: ${data.lastOilChangeDate || 'Never'}
- Interval: ${data.oilChangeInterval.toLocaleString()} miles
- Status: ${data.milesSinceOilChange >= data.oilChangeInterval ? 'OVERDUE' : data.milesSinceOilChange >= data.oilChangeInterval * 0.8 ? 'DUE SOON' : 'OK'}

Tire Rotation Status:
- Miles since last: ${data.milesSinceTireRotation.toLocaleString()}
- Last service: ${data.lastTireRotationDate || 'Never'}
- Interval: ${data.tireRotationInterval.toLocaleString()} miles
- Status: ${data.milesSinceTireRotation >= data.tireRotationInterval ? 'OVERDUE' : data.milesSinceTireRotation >= data.tireRotationInterval * 0.8 ? 'DUE SOON' : 'OK'}

Recent DVIR Failures: ${data.recentDvirFailures.length > 0 ? data.recentDvirFailures.join(', ') : 'None'}

Overall Status: ${data.urgencyLevel.toUpperCase()}

Generate a brief (under 200 chars) actionable summary.`;
}

function shouldRegenerateSummary(
  aiSummaryGeneratedAt: string | null,
  currentMileageDate: string | null,
  lastMaintenanceDate: string | null
): boolean {
  if (!aiSummaryGeneratedAt) return true;
  
  const generatedAt = new Date(aiSummaryGeneratedAt);
  const now = new Date();
  
  // Check if cache expired (7 days)
  const daysSinceGeneration = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceGeneration >= CACHE_EXPIRY_DAYS) return true;
  
  // Check if new DVIR was logged after summary
  if (currentMileageDate) {
    const mileageDate = new Date(currentMileageDate);
    if (mileageDate > generatedAt) return true;
  }
  
  // Check if new maintenance was logged after summary
  if (lastMaintenanceDate) {
    const maintDate = new Date(lastMaintenanceDate);
    if (maintDate > generatedAt) return true;
  }
  
  return false;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('[MaintenanceSummary] Starting...');

  try {
    // =======================================================================
    // Authentication
    // =======================================================================
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated and has mechanic/admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check role
    const { data: appUser, error: roleError } = await supabase
      .from('app_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !appUser || !['admin', 'mechanic'].includes(appUser.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================================
    // Parse request
    // =======================================================================
    const body = await req.json().catch(() => ({}));
    const truckNumber = body.truck_number?.toString().toUpperCase().trim();
    const forceRegenerate = body.force_regenerate ?? false;

    if (!truckNumber) {
      return new Response(
        JSON.stringify({ error: 'truck_number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[MaintenanceSummary] Processing truck:', truckNumber);

    // Use service role client for database operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // =======================================================================
    // Fetch current schedule data
    // =======================================================================
    const { data: schedule, error: scheduleError } = await serviceClient
      .from('maintenance_schedules')
      .select('*')
      .eq('truck_number', truckNumber)
      .single();

    if (scheduleError || !schedule) {
      return new Response(
        JSON.stringify({ error: 'Maintenance schedule not found for truck' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================================
    // Check cache validity
    // =======================================================================
    const needsRegeneration = forceRegenerate || shouldRegenerateSummary(
      schedule.ai_summary_generated_at,
      schedule.current_mileage_date,
      schedule.updated_at
    );

    if (!needsRegeneration && schedule.ai_summary) {
      console.log('[MaintenanceSummary] Returning cached summary');
      return new Response(
        JSON.stringify({
          success: true,
          summary: schedule.ai_summary,
          cached: true,
          generated_at: schedule.ai_summary_generated_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================================
    // Fetch recent DVIR failures (only unfixed ones)
    // =======================================================================
    const { data: recentDvirs, error: dvirError } = await serviceClient
      .from('dvir_reports')
      .select('vehicle_trailer_checklist, aerial_checklist, deficiency_corrected, mechanic_date')
      .eq('truck_number', truckNumber)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentFailures: string[] = [];
    if (recentDvirs) {
      for (const dvir of recentDvirs) {
        // Skip DVIRs that have been fixed by a mechanic
        const hasBeenFixed = Boolean(
          (dvir.deficiency_corrected as string | null)?.trim() || 
          dvir.mechanic_date
        );
        if (hasBeenFixed) {
          continue; // This DVIR was fixed, don't show its failures
        }
        
        if (dvir.vehicle_trailer_checklist) {
          for (const [key, value] of Object.entries(dvir.vehicle_trailer_checklist as Record<string, string>)) {
            if (value === 'F') {
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              if (!recentFailures.includes(label)) recentFailures.push(label);
            }
          }
        }
        if (dvir.aerial_checklist) {
          for (const [key, value] of Object.entries(dvir.aerial_checklist as Record<string, string>)) {
            if (value === 'F') {
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              if (!recentFailures.includes(label)) recentFailures.push(label);
            }
          }
        }
      }
    }

    // =======================================================================
    // Calculate maintenance status
    // =======================================================================
    const currentMileage = schedule.current_mileage || 0;
    const milesSinceOilChange = Math.max(0, currentMileage - (schedule.last_oil_change_mileage || 0));
    const milesSinceTireRotation = Math.max(0, currentMileage - (schedule.last_tire_rotation_mileage || 0));
    
    const oilOverdue = milesSinceOilChange >= schedule.oil_change_interval_miles;
    const tireOverdue = milesSinceTireRotation >= schedule.tire_rotation_interval_miles;
    const oilDueSoon = milesSinceOilChange >= schedule.oil_change_interval_miles * 0.8;
    const tireDueSoon = milesSinceTireRotation >= schedule.tire_rotation_interval_miles * 0.8;

    let urgencyLevel: MaintenanceData['urgencyLevel'] = 'ok';
    if (oilOverdue || tireOverdue) urgencyLevel = 'overdue';
    else if (oilDueSoon || tireDueSoon) urgencyLevel = 'due_soon';
    else if (milesSinceOilChange >= schedule.oil_change_interval_miles * 0.6 || 
             milesSinceTireRotation >= schedule.tire_rotation_interval_miles * 0.6) {
      urgencyLevel = 'upcoming';
    }

    const maintenanceData: MaintenanceData = {
      truckNumber,
      currentMileage,
      milesSinceOilChange,
      lastOilChangeDate: schedule.last_oil_change_date,
      oilChangeInterval: schedule.oil_change_interval_miles,
      milesSinceTireRotation,
      lastTireRotationDate: schedule.last_tire_rotation_date,
      tireRotationInterval: schedule.tire_rotation_interval_miles,
      recentDvirFailures: recentFailures.slice(0, 5),
      urgencyLevel,
    };

    // =======================================================================
    // Generate summary with OpenAI
    // =======================================================================
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      // Return a fallback summary if no OpenAI key
      const fallbackSummary = urgencyLevel === 'overdue' 
        ? `Maintenance overdue. Oil: ${milesSinceOilChange.toLocaleString()} mi. Tires: ${milesSinceTireRotation.toLocaleString()} mi.`
        : urgencyLevel === 'due_soon'
        ? `Maintenance due soon. Schedule service within the next 1,000 miles.`
        : `Maintenance current. Next oil change in ${(schedule.oil_change_interval_miles - milesSinceOilChange).toLocaleString()} mi.`;
      
      return new Response(
        JSON.stringify({
          success: true,
          summary: fallbackSummary,
          cached: false,
          fallback: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[MaintenanceSummary] Generating with OpenAI...');
    
    const openai = new OpenAI({ apiKey: openaiKey });
    const prompt = buildPrompt(maintenanceData);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    let summary = completion.choices[0].message.content || '';
    
    // Truncate if needed
    if (summary.length > MAX_SUMMARY_LENGTH) {
      const lastPeriod = summary.lastIndexOf('.', MAX_SUMMARY_LENGTH);
      summary = lastPeriod > 100 ? summary.slice(0, lastPeriod + 1) : summary.slice(0, MAX_SUMMARY_LENGTH - 3) + '...';
    }

    console.log('[MaintenanceSummary] Generated:', summary.length, 'chars');

    // =======================================================================
    // Cache the summary
    // =======================================================================
    const now = new Date().toISOString();
    
    const { error: updateError } = await serviceClient
      .from('maintenance_schedules')
      .update({
        ai_summary: summary,
        ai_summary_generated_at: now,
        updated_at: now,
      })
      .eq('truck_number', truckNumber);

    if (updateError) {
      console.error('[MaintenanceSummary] Failed to cache:', updateError.message);
    }

    // =======================================================================
    // Return response
    // =======================================================================
    return new Response(
      JSON.stringify({
        success: true,
        summary,
        cached: false,
        generated_at: now,
        tokens_used: completion.usage?.total_tokens || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[MaintenanceSummary] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
