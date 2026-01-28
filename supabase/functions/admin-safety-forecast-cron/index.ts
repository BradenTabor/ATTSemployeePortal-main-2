// Deno type declaration for IDE support (runtime provides actual implementation)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

/**
 * Supabase Edge Function: Admin Safety Forecast
 * 
 * Runs at 6:30 AM CST Monday-Friday to:
 * 1. Fetch active work sites with GPS coordinates
 * 2. Get weather forecasts for each site via OpenWeatherMap
 * 3. Analyze crew composition and experience levels
 * 4. Detect equipment defects from recent DVIR/inspections
 * 5. Calculate multiplicative risk scores per site
 * 6. Send HTML email to admin recipients
 * 7. Send push notifications to leadership if risk >= ELEVATED
 * 
 * @see directives/admin_safety_forecast_6_30am.md
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Import from extracted modules
import { SiteRiskData, AlgorithmConfig } from './types.ts';
import { getTodayInTimezone, isWeekday, isMonday } from './utils.ts';
import { getWeatherForSite } from './weather.ts';
import { calculateRiskScore, getRiskLevel, DEFAULT_ALGORITHM_CONFIG } from './risk.ts';
import { 
  getActiveWorkSites, 
  getCrewForSite, 
  analyzeCrewRisk, 
  getRecentDefects,
  getActiveAlgorithmConfig,
  saveRiskScoresToHistory,
  RiskScoreHistoryRecord
} from './data.ts';
import { generateForecastEmail, sendGmailEmail } from './email.ts';
import { sendLeadershipPushNotifications } from './notifications.ts';

// =============================================================================
// CORS HEADERS
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_TIMEZONE = 'America/Chicago';

// Gmail Configuration
const GMAIL_USER = Deno.env.get('GMAIL_USER') || 'allterraintreeservice.po@gmail.com';
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') || '';

// Fallback recipients (used if DB fetch fails or list empty)
const FALLBACK_RECIPIENTS = (Deno.env.get('ADMIN_EMAIL_RECIPIENTS') || 
  'bradenleetabor@gmail.com,shane@alltts.com,dusty@alltts.com,mike@alltts.com,steve@alltts.com,brandon@alltts.com'
).split(',').map(e => e.trim()).filter(Boolean);

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

async function getEmailRecipients(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  listKey: 'compliance_summary' | 'safety_forecast',
  fallback: string[]
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('email_recipient_lists')
      .select('email')
      .eq('list_key', listKey);

    if (error) {
      console.error('[Forecast] Recipients DB error:', error);
      return fallback;
    }
    if (!data || data.length === 0) {
      console.warn('[Forecast] No recipients for', listKey, ', using fallback');
      return fallback;
    }
    const emails = data.map((r: { email: string }) => r.email).filter(isValidEmail);
    if (emails.length === 0) {
      console.error('[Forecast] All fetched emails invalid, using fallback');
      return fallback;
    }
    console.log('[Forecast] Loaded', emails.length, 'recipients for', listKey);
    return emails;
  } catch (err) {
    console.error('[Forecast] Recipients error:', err);
    return fallback;
  }
}

// Weather API
const OPENWEATHER_API_KEY = Deno.env.get('OPENWEATHERMAP_API_KEY') || '';

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[Forecast] Starting at', new Date().toISOString());

  try {
    // Parse optional parameters
    let body: { dryRun?: boolean; skipWeekendCheck?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // No body provided
    }
    const dryRun = body.dryRun || false;
    const skipWeekendCheck = body.skipWeekendCheck || false;

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine date
    const dateFor = getTodayInTimezone(DEFAULT_TIMEZONE);
    const isMondayFlag = isMonday(dateFor, DEFAULT_TIMEZONE);

    if (!skipWeekendCheck && !isWeekday(dateFor, DEFAULT_TIMEZONE)) {
      console.log('[Forecast] Skipping - weekend:', dateFor);
      return new Response(
        JSON.stringify({ success: true, status: 'skipped', reason: 'weekend' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch algorithm config for calibration-aware calculations
    console.log('[Forecast] Fetching algorithm config...');
    const algorithmConfig = await getActiveAlgorithmConfig(supabase);
    const algorithmVersion = algorithmConfig?.version || DEFAULT_ALGORITHM_CONFIG.version;
    if (algorithmConfig) {
      console.log('[Forecast] Using algorithm config:', algorithmVersion);
    } else {
      console.log('[Forecast] No active config found, using defaults');
    }

    // Fetch data
    console.log('[Forecast] Fetching work sites...');
    const sites = await getActiveWorkSites(supabase);
    console.log('[Forecast] Found', sites.length, 'active sites');

    console.log('[Forecast] Fetching recent defects...');
    const allDefects = await getRecentDefects(supabase);
    console.log('[Forecast] Found', allDefects.length, 'critical defects');

    // Calculate risk for each site
    const siteRisks: SiteRiskData[] = [];
    const historyRecords: RiskScoreHistoryRecord[] = [];
    let hasWeatherError = false;

    for (const site of sites) {
      console.log('[Forecast] Processing site:', site.name);
      
      const weather = await getWeatherForSite(site.latitude, site.longitude, OPENWEATHER_API_KEY);
      if (weather.conditions.includes('unavailable') || weather.conditions.includes('error')) {
        hasWeatherError = true;
      }

      const crewResult = await getCrewForSite(supabase, site.id, dateFor, site.crew_id);
      const crewRisk = analyzeCrewRisk(crewResult);

      // Filter defects for trucks potentially assigned to this site (simplified)
      const siteDefects = allDefects.slice(0, 3); // For now, show top defects

      // Calculate risk using algorithm config (for calibration)
      const riskScore = calculateRiskScore(weather, crewRisk, siteDefects, isMondayFlag, algorithmConfig || undefined);

      siteRisks.push({
        site,
        weather,
        crew: crewRisk,
        defects: siteDefects,
        riskScore,
      });

      // Prepare history record for calibration tracking
      historyRecords.push({
        date_for: dateFor,
        work_site_id: site.id,
        work_site_name: site.name,
        total_score: riskScore.total,
        risk_level: riskScore.level,
        weather_factors: riskScore.breakdown.weatherFactors,
        crew_factors: riskScore.breakdown.crewFactors,
        equipment_factors: riskScore.breakdown.equipmentFactors,
        temporal_factors: riskScore.breakdown.temporalFactors,
        top_drivers: riskScore.drivers,
        recommendations: riskScore.recommendations,
        algorithm_version: algorithmVersion,
      });
    }

    // Save risk scores to history for calibration (non-blocking)
    if (!dryRun && historyRecords.length > 0) {
      console.log('[Forecast] Saving', historyRecords.length, 'risk scores to history...');
      const { saved, failed } = await saveRiskScoresToHistory(supabase, historyRecords);
      console.log('[Forecast] Saved', saved, 'risk scores, failed:', failed);
    }

    // Sort by risk (highest first)
    siteRisks.sort((a, b) => b.riskScore.total - a.riskScore.total);

    // Calculate overall company risk
    const overallScore = siteRisks.length > 0
      ? Math.max(...siteRisks.map(s => s.riskScore.total))
      : 1.0;
    
    // Aggregate drivers and recommendations
    const allDrivers = siteRisks.flatMap(s => s.riskScore.drivers);
    const driverCounts = new Map<string, number>();
    for (const d of allDrivers) {
      driverCounts.set(d, (driverCounts.get(d) || 0) + 1);
    }
    const topDrivers = [...driverCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([d]) => d);

    const allRecommendations = [...new Set(siteRisks.flatMap(s => s.riskScore.recommendations))];

    const overallRisk = {
      total: overallScore,
      level: getRiskLevel(overallScore, algorithmConfig || undefined),
      drivers: topDrivers,
      recommendations: allRecommendations.slice(0, 6),
    };

    // Company-wide factors
    const companyFactors: string[] = [];
    if (isMondayFlag) {
      companyFactors.push('Monday baseline risk factor applied (+10%)');
    }
    if (allDefects.length > 5) {
      companyFactors.push(`${allDefects.length} critical equipment defects company-wide`);
    }
    if (hasWeatherError) {
      companyFactors.push('Weather data unavailable for some sites - manual verification recommended');
    }

    // Generate and send email
    const { subject, textBody, htmlBody } = generateForecastEmail(
      dateFor,
      overallRisk,
      siteRisks,
      companyFactors,
      hasWeatherError,
      DEFAULT_TIMEZONE
    );

    let emailResult: { success: boolean; error?: string } = { success: false, error: 'Skipped (dry run)' };
    let recipients: string[] = [];
    if (!dryRun) {
      recipients = await getEmailRecipients(supabase, 'safety_forecast', FALLBACK_RECIPIENTS);
      emailResult = await sendGmailEmail(
        subject,
        textBody,
        htmlBody,
        GMAIL_USER,
        GMAIL_APP_PASSWORD,
        recipients
      );
      const { error: logErr } = await supabase.from('email_send_log').insert({
        list_key: 'safety_forecast',
        recipients,
        success: emailResult.success,
        error_message: emailResult.error ?? null,
      });
      if (logErr) console.error('[Forecast] Failed to write email_send_log:', logErr);
    }

    // Send push notifications for elevated risk
    if (!dryRun) {
      await sendLeadershipPushNotifications(supabase, overallRisk, dateFor);
    }

    const duration = Date.now() - startTime;
    console.log('[Forecast] Complete in', duration, 'ms');

    return new Response(
      JSON.stringify({
        success: true,
        status: 'completed',
        dateFor,
        sitesProcessed: sites.length,
        algorithmVersion,
        overallRisk: {
          score: overallRisk.total,
          level: overallRisk.level,
        },
        historyRecordsSaved: dryRun ? 0 : historyRecords.length,
        emailSent: emailResult.success,
        emailError: emailResult.error,
        dryRun,
        duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Forecast] Error:', errorMsg);
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
