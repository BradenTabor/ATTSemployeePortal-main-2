// @ts-nocheck
/**
 * Supabase Edge Function: check-compliance-9am
 * 
 * This Edge Function runs the 9:00 AM compliance check for DVIR and
 * equipment inspections. It should be scheduled via Supabase cron
 * or called manually for testing.
 * 
 * Schedule: Daily at 9:00 AM America/Chicago (14:00 or 15:00 UTC depending on DST)
 * 
 * Environment Variables Required:
 * - SUPABASE_URL (auto-provided by Supabase)
 * - SUPABASE_SERVICE_ROLE_KEY (auto-provided by Supabase)
 * - MAKE_WEBHOOK_URL (your Make.com webhook)
 * - APP_BASE_URL (your app URL for links in emails)
 * - DRY_RUN (optional, default false)
 * - EMAIL_NOTIFICATIONS_ENABLED (optional, default true)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// =============================================================================
// CORS HEADERS
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

// =============================================================================
// TYPES
// =============================================================================

type NotificationType = 'missing_dvir' | 'missing_equipment' | 'missing_both';

interface ComplianceRunResult {
  runId: string;
  dateFor: string;
  requiredUserCount: number;
  missingDvirCount: number;
  missingEquipmentCount: number;
  missingBothCount: number;
  webhooksSent: number;
  webhooksSkipped: number;
  status: 'success' | 'failed';
  error?: string;
  dryRun: boolean;
}

interface RequiredUser {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface MissingSubmission {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  type: NotificationType;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const DEFAULT_TIMEZONE = 'America/Chicago';
const DEFAULT_CUTOFF = '09:00';
const RUN_TYPE = 'dvir_equipment_9am';
const REQUIRED_ROLES = ['employee', 'foreman'];

function getTodayInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

function buildCutoffTimestamp(
  dateFor: string,
  timeLocal: string = DEFAULT_CUTOFF,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const [year, month, day] = dateFor.split('-').map(Number);
  const [hours, minutes] = timeLocal.split(':').map(Number);
  
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  
  const tzFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const formatted = tzFormatter.format(utcDate);
  const [datePart, timePart] = formatted.split(', ');
  const [tzYear, tzMonth, tzDay] = datePart.split('-').map(Number);
  const [tzHour, tzMin] = timePart.split(':').map(Number);
  
  const utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const tzMs = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, 0, 0);
  const offsetMs = tzMs - utcMs;
  
  return new Date(utcMs - offsetMs);
}

function computeMissingType(hasDvir: boolean, hasEquipment: boolean): NotificationType | null {
  if (!hasDvir && !hasEquipment) return 'missing_both';
  if (!hasDvir) return 'missing_dvir';
  if (!hasEquipment) return 'missing_equipment';
  return null;
}

function getMissingItems(type: NotificationType): string[] {
  switch (type) {
    case 'missing_dvir':
      return ['DVIR (Daily Vehicle Inspection Report)'];
    case 'missing_equipment':
      return ['Daily Equipment Inspection'];
    case 'missing_both':
      return ['DVIR (Daily Vehicle Inspection Report)', 'Daily Equipment Inspection'];
    default:
      return [];
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  console.log('[check-compliance-9am] Starting compliance check...');

  try {
    // Parse optional parameters from query string or body
    let dateFor: string | undefined;
    let dryRun = Deno.env.get('DRY_RUN') === 'true';
    let notificationsEnabled = Deno.env.get('EMAIL_NOTIFICATIONS_ENABLED') !== 'false';

    // Try to get params from URL
    const url = new URL(req.url);
    if (url.searchParams.has('date')) {
      dateFor = url.searchParams.get('date')!;
    }
    if (url.searchParams.has('dry_run')) {
      dryRun = url.searchParams.get('dry_run') === 'true';
    }

    // Try to get params from body (for POST requests)
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.dateFor) dateFor = body.dateFor;
        if (body.dryRun !== undefined) dryRun = body.dryRun;
        if (body.notificationsEnabled !== undefined) notificationsEnabled = body.notificationsEnabled;
      } catch {
        // No body or invalid JSON, continue with defaults
      }
    }

    // Resolve configuration
    const timezone = DEFAULT_TIMEZONE;
    const cutoffLocal = DEFAULT_CUTOFF;
    const resolvedDateFor = dateFor || getTodayInTimezone(timezone);
    const cutoffUtc = buildCutoffTimestamp(resolvedDateFor, cutoffLocal, timezone);

    console.log(`[check-compliance-9am] Configuration:`, {
      dateFor: resolvedDateFor,
      cutoffUtc: cutoffUtc.toISOString(),
      dryRun,
      notificationsEnabled,
    });

    // Create Supabase service role client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create compliance run record
    const { data: runData, error: runError } = await supabase
      .from('compliance_runs')
      .insert({
        run_type: RUN_TYPE,
        date_for: resolvedDateFor,
        cutoff_time: cutoffUtc.toISOString(),
        timezone,
        dry_run: dryRun,
        status: 'running',
      })
      .select('id')
      .single();

    if (runError) {
      throw new Error(`Failed to create compliance run: ${runError.message}`);
    }

    const runId = runData.id;
    console.log(`[check-compliance-9am] Created run: ${runId}`);

    // Fetch required users
    const { data: users, error: usersError } = await supabase
      .from('app_users')
      .select('user_id, email, full_name, role')
      .in('role', REQUIRED_ROLES)
      .not('email', 'is', null)
      .not('email', 'ilike', '%@atts.test');

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const requiredUsers = (users || []).filter(u => u.email) as RequiredUser[];
    console.log(`[check-compliance-9am] Found ${requiredUsers.length} required users`);

    // Fetch DVIR submitters
    const { data: dvirData, error: dvirError } = await supabase
      .from('dvir_reports')
      .select('user_id')
      .eq('report_date', resolvedDateFor)
      .lt('created_at', cutoffUtc.toISOString())
      .not('user_id', 'is', null);

    if (dvirError) {
      throw new Error(`Failed to fetch DVIR: ${dvirError.message}`);
    }

    const dvirSubmitters = new Set((dvirData || []).map(d => d.user_id).filter(Boolean));

    // Fetch equipment submitters
    const { data: equipData, error: equipError } = await supabase
      .from('daily_equipment_inspections')
      .select('user_id')
      .eq('inspection_date', resolvedDateFor)
      .lt('created_at', cutoffUtc.toISOString())
      .not('user_id', 'is', null);

    if (equipError) {
      throw new Error(`Failed to fetch equipment: ${equipError.message}`);
    }

    const equipmentSubmitters = new Set((equipData || []).map(d => d.user_id).filter(Boolean));

    console.log(`[check-compliance-9am] Submissions: DVIR=${dvirSubmitters.size}, Equipment=${equipmentSubmitters.size}`);

    // Compute missing submissions
    const missingSubmissions: MissingSubmission[] = [];

    for (const user of requiredUsers) {
      const hasDvir = dvirSubmitters.has(user.user_id);
      const hasEquipment = equipmentSubmitters.has(user.user_id);
      const missingType = computeMissingType(hasDvir, hasEquipment);

      if (missingType) {
        missingSubmissions.push({
          userId: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          type: missingType,
        });
      }
    }

    // Count by type
    const missingDvirCount = missingSubmissions.filter(
      m => m.type === 'missing_dvir' || m.type === 'missing_both'
    ).length;
    const missingEquipmentCount = missingSubmissions.filter(
      m => m.type === 'missing_equipment' || m.type === 'missing_both'
    ).length;
    const missingBothCount = missingSubmissions.filter(
      m => m.type === 'missing_both'
    ).length;

    console.log(`[check-compliance-9am] Missing: total=${missingSubmissions.length}, dvir=${missingDvirCount}, equipment=${missingEquipmentCount}, both=${missingBothCount}`);

    // Process notifications
    let webhooksSent = 0;
    let webhooksSkipped = 0;

    const webhookUrl = Deno.env.get('MAKE_WEBHOOK_URL') || Deno.env.get('VITE_MAKE_DEN_WEBHOOK_URL') || 'https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc';
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://att-semployee-portal-main-2.vercel.app';

    for (const missing of missingSubmissions) {
      // Try to insert notification (idempotent)
      const { data: notifData, error: notifError } = await supabase
        .from('compliance_notifications')
        .insert({
          date_for: resolvedDateFor,
          user_id: missing.userId,
          notification_type: missing.type,
          sent_to: missing.email,
          status: 'pending',
        })
        .select('id')
        .single();

      if (notifError) {
        // Duplicate check
        if (notifError.code === '23505') {
          // SEC-005: Redact user ID in logs
          const redactedId = missing.userId.substring(0, 4) + '...' + missing.userId.substring(missing.userId.length - 4);
          console.log(`[check-compliance-9am] Skipping duplicate: ${redactedId}`);
          webhooksSkipped++;
          continue;
        }
        console.error(`[check-compliance-9am] Insert error: ${notifError.message}`);
        webhooksSkipped++;
        continue;
      }

      const notificationId = notifData.id;

      // Skip if dry run or notifications disabled
      if (dryRun || !notificationsEnabled) {
        const reason = dryRun ? 'dry_run' : 'notifications_disabled';
        // SEC-005: Redact user ID in logs
        const redactedId = missing.userId.substring(0, 4) + '...' + missing.userId.substring(missing.userId.length - 4);
        console.log(`[check-compliance-9am] Skipping webhook (${reason}): ${redactedId}`);
        
        await supabase
          .from('compliance_notifications')
          .update({ status: 'skipped', error: reason })
          .eq('id', notificationId);
        
        webhooksSkipped++;
        continue;
      }

      // Send webhook to Make.com
      try {
        const payload = {
          type: 'compliance_reminder',
          dateFor: resolvedDateFor,
          user: {
            id: missing.userId,
            email: missing.email,
            fullName: missing.fullName,
            role: missing.role,
          },
          missingType: missing.type,
          missingItems: getMissingItems(missing.type),
          appLink: `${appBaseUrl.replace(/\/$/, '')}/dashboard`,
          timestamp: nowISO(),
          notificationId,
        };

        console.log(`[check-compliance-9am] Sending webhook for ${missing.email}...`);

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let responseData: unknown;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        if (response.ok) {
          await supabase
            .from('compliance_notifications')
            .update({
              status: 'sent',
              sent_at: nowISO(),
              webhook_response: responseData,
            })
            .eq('id', notificationId);
          
          console.log(`[check-compliance-9am] Webhook sent: ${missing.email}`);
          webhooksSent++;
        } else {
          await supabase
            .from('compliance_notifications')
            .update({
              status: 'failed',
              error: `HTTP ${response.status}`,
              webhook_response: responseData,
            })
            .eq('id', notificationId);
          
          console.error(`[check-compliance-9am] Webhook failed: ${response.status}`);
          webhooksSkipped++;
        }
      } catch (webhookError) {
        const errorMsg = webhookError instanceof Error ? webhookError.message : 'Unknown error';
        
        await supabase
          .from('compliance_notifications')
          .update({ status: 'failed', error: errorMsg })
          .eq('id', notificationId);
        
        console.error(`[check-compliance-9am] Webhook exception: ${errorMsg}`);
        webhooksSkipped++;
      }
    }

    // Update compliance run with success
    await supabase
      .from('compliance_runs')
      .update({
        status: 'success',
        required_user_count: requiredUsers.length,
        missing_dvir_count: missingDvirCount,
        missing_equipment_count: missingEquipmentCount,
        missing_both_count: missingBothCount,
        webhooks_sent: webhooksSent,
        webhooks_skipped: webhooksSkipped,
        finished_at: nowISO(),
      })
      .eq('id', runId);

    const result: ComplianceRunResult = {
      runId,
      dateFor: resolvedDateFor,
      requiredUserCount: requiredUsers.length,
      missingDvirCount,
      missingEquipmentCount,
      missingBothCount,
      webhooksSent,
      webhooksSkipped,
      status: 'success',
      dryRun,
    };

    console.log(`[check-compliance-9am] Run completed:`, result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[check-compliance-9am] Fatal error: ${errorMessage}`);

    return new Response(
      JSON.stringify({ error: errorMessage, status: 'failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

