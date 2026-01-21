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
import { createClient } from '@supabase/supabase-js';

// Import from extracted modules
import { SiteRiskData } from './types.ts';
import { getTodayInTimezone, isWeekday, isMonday } from './utils.ts';
import { getWeatherForSite } from './weather.ts';
import { calculateRiskScore, getRiskLevel } from './risk.ts';
import { getActiveWorkSites, getCrewForSite, analyzeCrewRisk, getRecentDefects } from './data.ts';
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

// Admin email recipients
const ADMIN_RECIPIENTS = (Deno.env.get('ADMIN_EMAIL_RECIPIENTS') || 
  'bradenleetabor@gmail.com,shane@alltts.com,dusty@alltts.com,mike@alltts.com,steve@alltts.com,brandon@alltts.com'
).split(',').map(e => e.trim());

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

    // Fetch data
    console.log('[Forecast] Fetching work sites...');
    const sites = await getActiveWorkSites(supabase);
    console.log('[Forecast] Found', sites.length, 'active sites');

    console.log('[Forecast] Fetching recent defects...');
    const allDefects = await getRecentDefects(supabase);
    console.log('[Forecast] Found', allDefects.length, 'critical defects');

    // Calculate risk for each site
    const siteRisks: SiteRiskData[] = [];
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

      const riskScore = calculateRiskScore(weather, crewRisk, siteDefects, isMondayFlag);

      siteRisks.push({
        site,
        weather,
        crew: crewRisk,
        defects: siteDefects,
        riskScore,
      });
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
      level: getRiskLevel(overallScore),
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
    if (!dryRun) {
      emailResult = await sendGmailEmail(
        subject,
        textBody,
        htmlBody,
        GMAIL_USER,
        GMAIL_APP_PASSWORD,
        ADMIN_RECIPIENTS
      );
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
        overallRisk: {
          score: overallRisk.total,
          level: overallRisk.level,
        },
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
