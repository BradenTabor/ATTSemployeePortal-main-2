// @ts-nocheck
/**
 * Supabase Edge Function: Admin Compliance Summary
 *
 * Runs at 9:00 AM CST Monday-Friday to:
 * 1. Determine compliant users (DVIR + Equipment + JSA) and JSA sharing (shared_with_users)
 * 2. Send admin email: compliant employees list + JSA sharing + ATTS logo (no summary or non-compliant list)
 * 3. Send manager emails (unchanged: direct reports who are non-compliant)
 * 4. Send payload to Make.com webhook (includes compliantUsers, jsaSharing; nonCompliantUsers kept, deprecated for email display)
 *
 * Degradation: JSA query failure → email sent with compliant list only + note; never append "✓ All Compliant" if any fetch failed.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { sendGmailEmail } from '../_shared/gmail.ts';

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

const REQUIRED_ROLES = ['employee', 'foreman'];
const DEFAULT_TIMEZONE = 'America/Chicago';
const DEFAULT_CUTOFF = '09:00';

// Gmail Configuration
const GMAIL_USER = Deno.env.get('GMAIL_USER') || 'allterraintreeservice.po@gmail.com';
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') || '';

// Fallback recipients (used if DB fetch fails or list empty)
const FALLBACK_RECIPIENTS = [
  'bradenleetabor@gmail.com',
  'shane@alltts.com',
  'dusty@alltts.com',
  'mike@alltts.com',
  'steve@alltts.com',
  'brandon@alltts.com',
];

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// Make.com webhook
const MAKE_WEBHOOK_URL = Deno.env.get('MAKE_WEBHOOK_URL') || 'https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc';

// ATTS logo (publicly accessible URL; if unset, header is text-only)
const ATTS_LOGO_URL = Deno.env.get('ATTS_LOGO_URL') || '';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format "shared with" list: "X" | "X and Y" | "X, Y, and Z". Uses full_name with email fallback. */
function formatSharedWithList(users: Array<{ full_name?: string; email?: string }>): string {
  const names = users
    .map((u) => (u.full_name || u.email || 'Unknown').trim())
    .filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
}

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

function isWeekday(dateFor: string, timezone: string): boolean {
  const date = new Date(dateFor + 'T12:00:00');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dayName = formatter.format(date);
  return !['Sat', 'Sun'].includes(dayName);
}

function buildCutoffTimestamp(dateFor: string, timeLocal: string, timezone: string): Date {
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

function formatDateLong(dateFor: string): string {
  const date = new Date(dateFor + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// =============================================================================
// EMAIL GENERATION
// =============================================================================

interface NonCompliantUser {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  missingForms: string[];
  /** Phase 2: app_users.id of this user's manager (null if unset) */
  managerId: string | null;
}

interface CompliantUser {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
}

/** User with at least one form completed; shows which of DVIR, Equipment, JSA they completed. */
interface FormCompletionUser {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  hasDvir: boolean;
  hasEquipment: boolean;
  hasJsa: boolean;
}

interface JsaSharingEntry {
  submitterName: string;
  sharedWith: Array<{ full_name?: string; email?: string }>;
}

/** Format one user's form status: "DVIR ✓, Equipment ✗, JSA ✓" */
function formatFormStatus(u: FormCompletionUser): string {
  const d = u.hasDvir ? '✓' : '✗';
  const e = u.hasEquipment ? '✓' : '✗';
  const j = u.hasJsa ? '✓' : '✗';
  return `DVIR ${d}, Equipment ${e}, JSA ${j}`;
}

/**
 * Generate admin compliance email: form completion (all users with at least one form + which forms) + JSA sharing + logo.
 * When jsaDataUnavailable is true, JSA sharing section shows a note instead of data.
 * Subject gets "✓ All Compliant" only when allRequiredCompliant is true and !jsaDataUnavailable (no fetch errors).
 */
function generateEmailContent(
  dateFor: string,
  formCompletionList: FormCompletionUser[],
  jsaSharing: JsaSharingEntry[],
  logoUrl: string,
  options: { allRequiredCompliant: boolean; jsaDataUnavailable?: boolean }
): { subject: string; textBody: string; htmlBody: string } {
  const dateLong = formatDateLong(dateFor);
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });

  const suffix = options.allRequiredCompliant && !options.jsaDataUnavailable ? ' ✓ All Compliant' : '';
  const subject = `ATTS Daily Safety Form Compliance Report – ${dateLong}${suffix}`;

  // ---- Text body ----
  let textBody = `ATTS DAILY SAFETY FORM COMPLIANCE REPORT\n`;
  textBody += `==========================================\n\n`;
  textBody += `Date: ${dateLong}\n`;
  textBody += `Report Generated: ${timestamp}\n\n`;

  textBody += `FORM COMPLETION\n`;
  textBody += `---------------\n`;
  if (formCompletionList.length === 0) {
    textBody += `No employees submitted any forms for this date.\n\n`;
  } else {
    for (const u of formCompletionList) {
      textBody += `• ${u.fullName || 'Unknown'} (${u.role}) – ${u.email} – ${formatFormStatus(u)}\n`;
    }
    textBody += `\n`;
  }

  textBody += `JSA SHARING\n`;
  textBody += `-----------\n`;
  if (options.jsaDataUnavailable) {
    textBody += `JSA sharing data was unavailable for this report.\n\n`;
  } else if (jsaSharing.length === 0) {
    textBody += `No JSA forms were shared with other users for this date.\n\n`;
  } else {
    for (const entry of jsaSharing) {
      const list = formatSharedWithList(entry.sharedWith);
      if (list) {
        textBody += `• ${entry.submitterName} completed their Daily JSA and shared it with ${list}.\n`;
      }
    }
    textBody += `\n`;
  }

  textBody += `---\n`;
  textBody += `Thank you for reviewing this compliance report.\n\n`;
  textBody += `ATTS Safety Compliance System\n`;

  // ---- HTML body ----
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="ATTS Logo" style="max-width: 200px; height: auto; display: block;" />`
    : '';

  let formCompletionHtml = '';
  if (formCompletionList.length === 0) {
    formCompletionHtml = `<p style="color:#6b7280;">No employees submitted any forms for this date.</p>`;
  } else {
    formCompletionHtml = `<ul style="margin:0;padding-left:20px;">`;
    for (const u of formCompletionList) {
      const status = formatFormStatus(u);
      formCompletionHtml += `<li style="margin-bottom:4px;"><strong>${escapeHtml(u.fullName || 'Unknown')}</strong> (${escapeHtml(u.role)}) – <a href="mailto:${escapeHtml(u.email)}">${escapeHtml(u.email)}</a> – ${escapeHtml(status)}</li>`;
    }
    formCompletionHtml += `</ul>`;
  }

  let jsaHtml = '';
  if (options.jsaDataUnavailable) {
    jsaHtml = `<p style="color:#6b7280;">JSA sharing data was unavailable for this report.</p>`;
  } else if (jsaSharing.length === 0) {
    jsaHtml = `<p style="color:#6b7280;">No JSA forms were shared with other users for this date.</p>`;
  } else {
    jsaHtml = `<ul style="margin:0;padding-left:20px;">`;
    for (const entry of jsaSharing) {
      const list = formatSharedWithList(entry.sharedWith);
      if (list) {
        jsaHtml += `<li style="margin-bottom:4px;"><strong>${escapeHtml(entry.submitterName)}</strong> completed their Daily JSA and shared it with ${escapeHtml(list)}.</li>`;
      }
    }
    jsaHtml += `</ul>`;
  }

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:600px;margin:0 auto;padding:20px;">
<div style="background:linear-gradient(135deg,#166534 0%,#15803d 100%);color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;">${logoHtml}<h1 style="margin:0;font-size:18px;">ATTS DAILY SAFETY FORM COMPLIANCE REPORT</h1></div>
<div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;"><p style="margin:0 0 8px 0;"><strong>Date:</strong> ${escapeHtml(dateLong)}</p><p style="margin:0;"><strong>Generated:</strong> ${escapeHtml(timestamp)}</p></div>
<div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 12px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Form Completion</h2>${formCompletionHtml}</div>
<div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 12px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">JSA Sharing</h2>${jsaHtml}</div>
<div style="background:#f9fafb;padding:16px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;font-size:12px;color:#6b7280;"><p style="margin:0;">Thank you for reviewing this compliance report.</p><p style="margin:8px 0 0 0;"><strong>ATTS Safety Compliance System</strong></p></div></body></html>`;

  return { subject, textBody, htmlBody };
}

// =============================================================================
// MANAGER-SPECIFIC EMAIL (Phase 2: individual manager notifications)
// =============================================================================

function generateManagerEmailContent(
  dateFor: string,
  managerName: string | null,
  directReports: NonCompliantUser[]
): { subject: string; textBody: string; htmlBody: string } {
  const dateLong = formatDateLong(dateFor);
  const name = managerName || 'Manager';
  const subject = directReports.length > 0
    ? `ATTS Compliance – Your team: ${directReports.length} missing forms (${dateLong})`
    : `ATTS Compliance – Your team: all clear (${dateLong})`;

  let textBody = `ATTS – Compliance summary for your direct reports\n`;
  textBody += `==========================================\n\n`;
  textBody += `Date: ${dateLong}\n\n`;
  if (directReports.length === 0) {
    textBody += `All of your direct reports have submitted their required safety forms.\n\n`;
  } else {
    textBody += `The following direct reports have not submitted all required forms:\n\n`;
    for (let i = 0; i < directReports.length; i++) {
      const u = directReports[i];
      textBody += `  ${i + 1}. ${u.fullName || 'Unknown'} (${u.role}) – ${u.email}\n`;
      textBody += `     Missing: ${u.missingForms.join(', ')}\n`;
    }
    textBody += `\nPlease follow up with them as needed.\n\n`;
  }
  textBody += `---\nATTS Safety Compliance System\n`;

  let listHtml = '';
  if (directReports.length > 0) {
    listHtml = '<ul style="margin:0;padding-left:20px;">';
    for (const u of directReports) {
      listHtml += `<li style="margin-bottom:6px;"><strong>${u.fullName || 'Unknown'}</strong> (${u.role}) – ${u.email}<br><small style="color:#666;">Missing: ${u.missingForms.join(', ')}</small></li>`;
    }
    listHtml += '</ul>';
  } else {
    listHtml = '<p style="color:#166534;">All of your direct reports have submitted their required safety forms.</p>';
  }

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:600px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,#166534 0%,#15803d 100%);color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="margin:0;font-size:18px;">Compliance summary – your team</h1></div><div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;"><p style="margin:0;"><strong>Hi ${name},</strong></p><p style="margin:8px 0 0 0;">Date: ${dateLong}</p></div><div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 12px 0;font-size:16px;">Your direct reports</h2>${listHtml}</div><div style="background:#f9fafb;padding:16px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;font-size:12px;color:#6b7280;"><p style="margin:0;">ATTS Safety Compliance System</p></div></body></html>`;

  return { subject, textBody, htmlBody };
}

// =============================================================================
// RECIPIENTS - Fetch from DB with fallback
// =============================================================================

type SupabaseClient = ReturnType<typeof createClient>;

async function getEmailRecipients(
  supabase: SupabaseClient,
  listKey: 'compliance_summary' | 'safety_forecast',
  fallback: string[]
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('email_recipient_lists')
      .select('email')
      .eq('list_key', listKey);

    if (error) {
      console.error(`[Recipients] DB error for ${listKey}:`, error.message);
      console.warn('[Recipients] Using fallback:', fallback.join(', '));
      return fallback;
    }
    if (!data || data.length === 0) {
      console.warn(`[Recipients] No recipients for ${listKey}, using fallback`);
      return fallback;
    }
    const emails = data.map((r: { email: string }) => r.email).filter(isValidEmail);
    if (emails.length === 0) {
      console.error('[Recipients] All fetched emails invalid, using fallback');
      return fallback;
    }
    console.log(`[Recipients] Loaded ${emails.length} for ${listKey}`);
    return emails;
  } catch (err) {
    console.error('[Recipients] Unexpected error:', err);
    return fallback;
  }
}

// =============================================================================
// WEBHOOK SENDING
// =============================================================================

async function sendToWebhook(payload: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    console.log('[Webhook] Response status:', response.status);
    return { success: response.ok };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Webhook] Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[Compliance] Starting at', new Date().toISOString());

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine date and check weekday
    const dateFor = getTodayInTimezone(DEFAULT_TIMEZONE);
    
    if (!isWeekday(dateFor, DEFAULT_TIMEZONE)) {
      console.log('[Compliance] Skipping - weekend:', dateFor);
      return new Response(
        JSON.stringify({ success: true, status: 'skipped', reason: 'weekend' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cutoffUtc = buildCutoffTimestamp(dateFor, DEFAULT_CUTOFF, DEFAULT_TIMEZONE);
    const dayStart = buildCutoffTimestamp(dateFor, '00:00', DEFAULT_TIMEZONE);

    // Fetch required users (include manager_id for Phase 2 manager emails)
    const { data: requiredUsers, error: usersError } = await supabase
      .from('app_users')
      .select('id, user_id, email, full_name, role, manager_id')
      .in('role', REQUIRED_ROLES)
      .not('email', 'is', null)
      .not('email', 'ilike', '%@atts.test');

    if (usersError) throw new Error(`Failed to fetch users: ${usersError.message}`);

    console.log('[Compliance] Found', requiredUsers?.length || 0, 'required users');

    // Fetch submissions in parallel (JSA includes shared_with_users for sharing section)
    const [dvirResult, equipmentResult, jsaResult] = await Promise.all([
      supabase.from('dvir_reports').select('user_id').eq('report_date', dateFor).lt('created_at', cutoffUtc.toISOString()).not('user_id', 'is', null),
      supabase.from('daily_equipment_inspections').select('user_id').eq('inspection_date', dateFor).lt('created_at', cutoffUtc.toISOString()).not('user_id', 'is', null),
      supabase.from('daily_jsa').select('user_id, shared_with_users').gte('created_at', dayStart.toISOString()).lt('created_at', cutoffUtc.toISOString()).not('user_id', 'is', null),
    ]);

    const dvirSubmitters = new Set((dvirResult.data || []).map((d: { user_id: string }) => d.user_id));
    const equipmentSubmitters = new Set((equipmentResult.data || []).map((d: { user_id: string }) => d.user_id));
    const jsaRows = jsaResult.data || [];
    const jsaSubmitters = new Set(jsaRows.map((d: { user_id: string }) => d.user_id));

    // Level 2 degradation: if JSA query failed, we still send email but without JSA sharing data
    const jsaDataUnavailable = !!jsaResult.error;
    if (jsaResult.error) {
      console.warn('[Compliance] JSA query failed (degraded mode):', jsaResult.error.message);
    }

    console.log('[Compliance] Submissions - DVIR:', dvirSubmitters.size, 'Equipment:', equipmentSubmitters.size, 'JSA:', jsaSubmitters.size);

    const totalRequired = requiredUsers?.length || 0;
    const formCompletionList: FormCompletionUser[] = [];
    const nonCompliantUsers: NonCompliantUser[] = [];

    for (const user of requiredUsers || []) {
      const hasDvir = dvirSubmitters.has(user.user_id);
      const hasEquipment = equipmentSubmitters.has(user.user_id);
      const hasJsa = jsaSubmitters.has(user.user_id);

      if (hasDvir || hasEquipment || hasJsa) {
        formCompletionList.push({
          userId: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          hasDvir,
          hasEquipment,
          hasJsa,
        });
      }

      if (!(hasDvir && hasEquipment && hasJsa)) {
        const missingForms: string[] = [];
        if (!hasDvir) missingForms.push('DVIR');
        if (!hasEquipment) missingForms.push('Equipment Inspection');
        if (!hasJsa) missingForms.push('Daily JSA');
        nonCompliantUsers.push({
          userId: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          missingForms,
          managerId: user.manager_id ?? null,
        });
      }
    }

    // Sort form completion: most forms first (3, 2, 1), then by full name
    const completedCount = (u: FormCompletionUser) => (u.hasDvir ? 1 : 0) + (u.hasEquipment ? 1 : 0) + (u.hasJsa ? 1 : 0);
    formCompletionList.sort((a, b) => {
      const ca = completedCount(a);
      const cb = completedCount(b);
      if (cb !== ca) return cb - ca;
      const na = (a.fullName || '').trim().toLowerCase();
      const nb = (b.fullName || '').trim().toLowerCase();
      if (!na && !nb) return 0;
      if (!na) return 1;
      if (!nb) return -1;
      return na.localeCompare(nb);
    });
    nonCompliantUsers.sort((a, b) => b.missingForms.length - a.missingForms.length);

    const compliantUsers: CompliantUser[] = formCompletionList
      .filter((u) => u.hasDvir && u.hasEquipment && u.hasJsa)
      .map((u) => ({ userId: u.userId, email: u.email, fullName: u.fullName, role: u.role }));

    // Build JSA sharing list (only rows with non-empty shared_with_users; validate array)
    const jsaSharing: JsaSharingEntry[] = [];
    try {
      for (const row of jsaRows) {
        const shared = row.shared_with_users;
        if (!Array.isArray(shared) || shared.length === 0) continue;
        const submitter = (requiredUsers || []).find((u) => u.user_id === row.user_id);
        const submitterName = submitter?.full_name || 'Unknown';
        if (!submitter && row.user_id) {
          console.warn('[Compliance] JSA submitter not in requiredUsers:', row.user_id);
        }
        jsaSharing.push({
          submitterName,
          sharedWith: shared.map((u: { full_name?: string; email?: string }) => ({
            full_name: u?.full_name,
            email: u?.email,
          })),
        });
      }
      jsaSharing.sort((a, b) => a.submitterName.localeCompare(b.submitterName));
    } catch (err) {
      console.warn('[Compliance] Error building jsaSharing:', err);
    }

    console.log('[Compliance] Form completion entries:', formCompletionList.length, 'Non-compliant:', nonCompliantUsers.length, 'JSA sharing entries:', jsaSharing.length);

    const allRequiredCompliant = totalRequired > 0 && compliantUsers.length === totalRequired && !jsaDataUnavailable;

    // Generate email content (form completion list + JSA sharing + logo)
    const { subject, textBody, htmlBody } = generateEmailContent(
      dateFor,
      formCompletionList,
      jsaSharing,
      ATTS_LOGO_URL,
      { allRequiredCompliant, jsaDataUnavailable }
    );

    // Fetch recipients from DB (fallback to defaults)
    const recipients = await getEmailRecipients(supabase, 'compliance_summary', FALLBACK_RECIPIENTS);

    // Send email via Gmail (shared helper)
    console.log('[Compliance] Sending email via Gmail...');
    const emailResult = await sendGmailEmail(recipients, subject, textBody, htmlBody, {
      gmailUser: GMAIL_USER,
      gmailAppPassword: GMAIL_APP_PASSWORD,
      fromLabel: 'ATTS Safety Compliance',
    });

    // Log send attempt
    const { error: logErr } = await supabase.from('email_send_log').insert({
      list_key: 'compliance_summary',
      recipients,
      success: emailResult.success,
      error_message: emailResult.error ?? null,
    });
    if (logErr) console.error('[Compliance] Failed to write email_send_log:', logErr);

    // Phase 2: Send individual manager emails (direct reports only)
    const managerIds = [...new Set(nonCompliantUsers.map(u => u.managerId).filter(Boolean))] as string[];
    let managerEmailsSent = 0;
    if (managerIds.length > 0) {
      const { data: managers, error: managersError } = await supabase
        .from('app_users')
        .select('id, email, full_name')
        .in('id', managerIds)
        .not('email', 'is', null);

      if (!managersError && managers && managers.length > 0) {
        for (const manager of managers) {
          const managerEmail = manager.email;
          if (!managerEmail || !isValidEmail(managerEmail)) continue;
          const directReports = nonCompliantUsers.filter(u => u.managerId === manager.id);
          if (directReports.length === 0) continue;
          const { subject, textBody, htmlBody } = generateManagerEmailContent(
            dateFor,
            manager.full_name ?? null,
            directReports
          );
          const mgrResult = await sendGmailEmail([managerEmail], subject, textBody, htmlBody, {
            gmailUser: GMAIL_USER,
            gmailAppPassword: GMAIL_APP_PASSWORD,
            fromLabel: 'ATTS Safety Compliance',
          });
          if (mgrResult.success) managerEmailsSent++;
          await supabase.from('email_send_log').insert({
            list_key: 'manager_compliance',
            recipients: [managerEmail],
            success: mgrResult.success,
            error_message: mgrResult.error ?? null,
          });
        }
        console.log('[Compliance] Manager emails sent:', managerEmailsSent, 'of', managers.length);
      }
    }

    // Send to Make.com webhook (nonCompliantUsers kept for backward compatibility; deprecated for email display)
    console.log('[Compliance] Sending to webhook...');
    const webhookPayload = {
      type: 'admin_compliance_summary',
      dateFor,
      subject,
      emailBody: textBody,
      recipients,
      summary: {
        totalRequired: totalRequired,
        totalCompliant: compliantUsers.length,
        totalNonCompliant: nonCompliantUsers.length,
      },
      formCompletionList,
      compliantUsers,
      jsaSharing,
      /** @deprecated Email no longer displays non-compliant list; payload kept for Make.com/Sheets flows */
      nonCompliantUsers,
      emailSent: emailResult.success,
      timestamp: new Date().toISOString(),
    };
    const webhookResult = await sendToWebhook(webhookPayload);

    const duration = Date.now() - startTime;
    console.log('[Compliance] Completed in', duration, 'ms');

    return new Response(
      JSON.stringify({
        success: true,
        status: 'success',
        dateFor,
        summary: {
          totalRequired: totalRequired,
          totalCompliant: compliantUsers.length,
          totalNonCompliant: nonCompliantUsers.length,
        },
        emailSent: emailResult.success,
        emailError: emailResult.error,
        managerEmailsSent,
        webhookSent: webhookResult.success,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Compliance] Error:', errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
