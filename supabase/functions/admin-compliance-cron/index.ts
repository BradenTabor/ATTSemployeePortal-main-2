// @ts-nocheck
/**
 * Supabase Edge Function: Admin Compliance Summary
 * 
 * Runs at 9:00 AM CST Monday-Friday to:
 * 1. Check who hasn't submitted DVIR, Equipment, and JSA forms
 * 2. Send email directly via Gmail SMTP to admin recipients
 * 3. Send data to Make.com webhook for Google Sheets logging
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

// Admin email recipients
const ADMIN_RECIPIENTS = [
  'bradenleetabor@gmail.com',
  'shane@alltts.com',
  'dusty@alltts.com',
  'mike@alltts.com',
  'steve@alltts.com',
  'brandon@alltts.com',
  'weston@alltts.com',
];

// Make.com webhook
const MAKE_WEBHOOK_URL = Deno.env.get('MAKE_WEBHOOK_URL') || 'https://hook.us2.make.com/hdty3eds1lpldxt2ne4amq1dgdohmvpc';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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
}

function generateEmailContent(
  dateFor: string,
  totalRequired: number,
  compliantCount: number,
  nonCompliantUsers: NonCompliantUser[]
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

  const subject = nonCompliantUsers.length > 0
    ? `ATTS Compliance Report - ${dateLong} - ${nonCompliantUsers.length} Missing`
    : `ATTS Compliance Report - ${dateLong} - All Clear`;

  // Text body - simple format
  let textBody = `ATTS DAILY SAFETY FORM COMPLIANCE REPORT\n`;
  textBody += `==========================================\n\n`;
  textBody += `Date: ${dateLong}\n`;
  textBody += `Report Generated: ${timestamp}\n\n`;
  textBody += `SUMMARY\n`;
  textBody += `-------\n`;
  textBody += `Total Required Employees: ${totalRequired}\n`;
  textBody += `Compliant: ${compliantCount}\n`;
  textBody += `Non-Compliant: ${nonCompliantUsers.length}\n\n`;

  if (nonCompliantUsers.length > 0) {
    textBody += `NON-COMPLIANT EMPLOYEES\n`;
    textBody += `-----------------------\n\n`;

    const missingAll = nonCompliantUsers.filter(u => u.missingForms.length === 3);
    const missingTwo = nonCompliantUsers.filter(u => u.missingForms.length === 2);
    const missingOne = nonCompliantUsers.filter(u => u.missingForms.length === 1);

    let num = 1;

    if (missingAll.length > 0) {
      textBody += `MISSING ALL FORMS (DVIR, Equipment Inspection, Daily JSA):\n`;
      for (const user of missingAll) {
        textBody += `  ${num}. ${user.fullName || 'Unknown'} (${user.role}) - ${user.email}\n`;
        num++;
      }
      textBody += `\n`;
    }

    if (missingTwo.length > 0) {
      textBody += `MISSING TWO FORMS:\n`;
      for (const user of missingTwo) {
        textBody += `  ${num}. ${user.fullName || 'Unknown'} (${user.role}) - ${user.email}\n`;
        textBody += `      Missing: ${user.missingForms.join(', ')}\n`;
        num++;
      }
      textBody += `\n`;
    }

    if (missingOne.length > 0) {
      textBody += `MISSING ONE FORM:\n`;
      for (const user of missingOne) {
        textBody += `  ${num}. ${user.fullName || 'Unknown'} (${user.role}) - ${user.email}\n`;
        textBody += `      Missing: ${user.missingForms[0]}\n`;
        num++;
      }
      textBody += `\n`;
    }
  } else {
    textBody += `ALL CLEAR!\n`;
    textBody += `All employees have submitted their required safety forms.\n\n`;
  }

  textBody += `---\n`;
  textBody += `Thank you for reviewing this compliance report.\n`;
  textBody += `Please follow up with the listed employees as needed.\n\n`;
  textBody += `ATTS Safety Compliance System\n`;

  // HTML body - clean and simple
  let nonCompliantHtml = '';
  if (nonCompliantUsers.length > 0) {
    const missingAll = nonCompliantUsers.filter(u => u.missingForms.length === 3);
    const missingTwo = nonCompliantUsers.filter(u => u.missingForms.length === 2);
    const missingOne = nonCompliantUsers.filter(u => u.missingForms.length === 1);

    let num = 1;

    if (missingAll.length > 0) {
      nonCompliantHtml += `<h3 style="color:#dc2626;margin:16px 0 8px 0;font-size:14px;">MISSING ALL FORMS (DVIR, Equipment, JSA):</h3><ul style="margin:0;padding-left:20px;">`;
      for (const user of missingAll) {
        nonCompliantHtml += `<li style="margin-bottom:4px;"><strong>${num}. ${user.fullName || 'Unknown'}</strong> (${user.role}) - ${user.email}</li>`;
        num++;
      }
      nonCompliantHtml += `</ul>`;
    }

    if (missingTwo.length > 0) {
      nonCompliantHtml += `<h3 style="color:#f59e0b;margin:16px 0 8px 0;font-size:14px;">MISSING TWO FORMS:</h3><ul style="margin:0;padding-left:20px;">`;
      for (const user of missingTwo) {
        nonCompliantHtml += `<li style="margin-bottom:4px;"><strong>${num}. ${user.fullName || 'Unknown'}</strong> (${user.role}) - ${user.email}<br><small style="color:#666;">Missing: ${user.missingForms.join(', ')}</small></li>`;
        num++;
      }
      nonCompliantHtml += `</ul>`;
    }

    if (missingOne.length > 0) {
      nonCompliantHtml += `<h3 style="color:#eab308;margin:16px 0 8px 0;font-size:14px;">MISSING ONE FORM:</h3><ul style="margin:0;padding-left:20px;">`;
      for (const user of missingOne) {
        nonCompliantHtml += `<li style="margin-bottom:4px;"><strong>${num}. ${user.fullName || 'Unknown'}</strong> (${user.role}) - ${user.email}<br><small style="color:#666;">Missing: ${user.missingForms[0]}</small></li>`;
        num++;
      }
      nonCompliantHtml += `</ul>`;
    }
  } else {
    nonCompliantHtml = `<div style="background:#dcfce7;padding:16px;border-radius:8px;text-align:center;"><h3 style="color:#166534;margin:0;">ALL CLEAR</h3><p style="margin:8px 0 0 0;color:#166534;">All employees have submitted their required safety forms!</p></div>`;
  }

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:600px;margin:0 auto;padding:20px;"><div style="background:linear-gradient(135deg,#166534 0%,#15803d 100%);color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="margin:0;font-size:18px;">ATTS DAILY SAFETY FORM COMPLIANCE REPORT</h1></div><div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;"><p style="margin:0 0 8px 0;"><strong>Date:</strong> ${dateLong}</p><p style="margin:0;"><strong>Generated:</strong> ${timestamp}</p></div><div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 12px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">Summary</h2><table style="width:100%;"><tr><td>Total Required:</td><td style="text-align:right;font-weight:bold;">${totalRequired}</td></tr><tr><td style="color:#22c55e;">Compliant:</td><td style="text-align:right;font-weight:bold;color:#22c55e;">${compliantCount}</td></tr><tr><td style="color:#ef4444;">Non-Compliant:</td><td style="text-align:right;font-weight:bold;color:#ef4444;">${nonCompliantUsers.length}</td></tr></table></div><div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;"><h2 style="margin:0 0 12px 0;font-size:16px;border-bottom:2px solid #e5e7eb;padding-bottom:8px;">${nonCompliantUsers.length > 0 ? 'Non-Compliant Employees' : 'Compliance Status'}</h2>${nonCompliantHtml}</div><div style="background:#f9fafb;padding:16px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;font-size:12px;color:#6b7280;"><p style="margin:0;">Thank you for reviewing this compliance report.</p><p style="margin:8px 0 0 0;"><strong>ATTS Safety Compliance System</strong></p></div></body></html>`;

  return { subject, textBody, htmlBody };
}

// =============================================================================
// EMAIL SENDING - Using Gmail SMTP directly via raw socket
// =============================================================================

function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

async function sendGmailEmail(
  subject: string,
  textBody: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  if (!GMAIL_APP_PASSWORD) {
    console.error('[Email] GMAIL_APP_PASSWORD not configured');
    return { success: false, error: 'GMAIL_APP_PASSWORD not configured' };
  }

  try {
    // Create a simple HTML-only email (most reliable)
    const boundary = `boundary_${Date.now()}`;
    const toList = ADMIN_RECIPIENTS.join(', ');
    
    // Build the raw email
    const rawEmail = [
      `From: ATTS Safety Compliance <${GMAIL_USER}>`,
      `To: ${toList}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      ``,
      textBody,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      ``,
      htmlBody,
      ``,
      `--${boundary}--`,
    ].join('\r\n');

    // Connect to Gmail SMTP
    const conn = await Deno.connectTls({
      hostname: 'smtp.gmail.com',
      port: 465,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper to send command and read response
    async function sendCommand(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + '\r\n'));
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    // Helper to read initial response
    async function readResponse(): Promise<string> {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    // SMTP conversation
    let response = await readResponse();
    console.log('[SMTP] Initial:', response.trim());

    response = await sendCommand('EHLO localhost');
    console.log('[SMTP] EHLO:', response.substring(0, 50));

    response = await sendCommand('AUTH LOGIN');
    console.log('[SMTP] AUTH:', response.trim());

    response = await sendCommand(base64Encode(GMAIL_USER));
    console.log('[SMTP] User:', response.trim());

    const cleanPassword = GMAIL_APP_PASSWORD.replace(/\s/g, '');
    response = await sendCommand(base64Encode(cleanPassword));
    console.log('[SMTP] Pass:', response.substring(0, 20));

    if (!response.includes('235')) {
      conn.close();
      return { success: false, error: 'Authentication failed: ' + response };
    }

    response = await sendCommand(`MAIL FROM:<${GMAIL_USER}>`);
    console.log('[SMTP] FROM:', response.trim());

    for (const recipient of ADMIN_RECIPIENTS) {
      response = await sendCommand(`RCPT TO:<${recipient}>`);
      console.log('[SMTP] RCPT:', response.trim());
    }

    response = await sendCommand('DATA');
    console.log('[SMTP] DATA:', response.trim());

    // Send the email data
    await conn.write(encoder.encode(rawEmail + '\r\n.\r\n'));
    response = await readResponse();
    console.log('[SMTP] Sent:', response.trim());

    response = await sendCommand('QUIT');
    console.log('[SMTP] QUIT:', response.trim());

    conn.close();

    console.log('[Email] Successfully sent to', ADMIN_RECIPIENTS.length, 'recipients');
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Email] Failed to send:', errorMsg);
    return { success: false, error: errorMsg };
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

    // Fetch required users
    const { data: requiredUsers, error: usersError } = await supabase
      .from('app_users')
      .select('user_id, email, full_name, role')
      .in('role', REQUIRED_ROLES)
      .not('email', 'is', null);

    if (usersError) throw new Error(`Failed to fetch users: ${usersError.message}`);

    console.log('[Compliance] Found', requiredUsers?.length || 0, 'required users');

    // Fetch submissions in parallel
    const [dvirResult, equipmentResult, jsaResult] = await Promise.all([
      supabase.from('dvir_reports').select('user_id').eq('report_date', dateFor).lt('created_at', cutoffUtc.toISOString()).not('user_id', 'is', null),
      supabase.from('daily_equipment_inspections').select('user_id').eq('inspection_date', dateFor).lt('created_at', cutoffUtc.toISOString()).not('user_id', 'is', null),
      supabase.from('daily_jsa').select('user_id').gte('created_at', dayStart.toISOString()).lt('created_at', cutoffUtc.toISOString()).not('user_id', 'is', null),
    ]);

    const dvirSubmitters = new Set((dvirResult.data || []).map(d => d.user_id));
    const equipmentSubmitters = new Set((equipmentResult.data || []).map(d => d.user_id));
    const jsaSubmitters = new Set((jsaResult.data || []).map(d => d.user_id));

    console.log('[Compliance] Submissions - DVIR:', dvirSubmitters.size, 'Equipment:', equipmentSubmitters.size, 'JSA:', jsaSubmitters.size);

    // Compute non-compliant users
    const nonCompliantUsers: NonCompliantUser[] = [];
    let compliantCount = 0;

    for (const user of (requiredUsers || [])) {
      const hasDvir = dvirSubmitters.has(user.user_id);
      const hasEquipment = equipmentSubmitters.has(user.user_id);
      const hasJsa = jsaSubmitters.has(user.user_id);

      if (hasDvir && hasEquipment && hasJsa) {
        compliantCount++;
      } else {
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
        });
      }
    }

    // Sort by severity
    nonCompliantUsers.sort((a, b) => b.missingForms.length - a.missingForms.length);

    console.log('[Compliance] Compliant:', compliantCount, 'Non-compliant:', nonCompliantUsers.length);

    // Generate email content
    const { subject, textBody, htmlBody } = generateEmailContent(
      dateFor,
      requiredUsers?.length || 0,
      compliantCount,
      nonCompliantUsers
    );

    // Send email via Gmail
    console.log('[Compliance] Sending email via Gmail...');
    const emailResult = await sendGmailEmail(subject, textBody, htmlBody);

    // Send to Make.com webhook
    console.log('[Compliance] Sending to webhook...');
    const webhookPayload = {
      type: 'admin_compliance_summary',
      dateFor,
      subject,
      emailBody: textBody,
      recipients: ADMIN_RECIPIENTS,
      summary: {
        totalRequired: requiredUsers?.length || 0,
        totalCompliant: compliantCount,
        totalNonCompliant: nonCompliantUsers.length,
      },
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
          totalRequired: requiredUsers?.length || 0,
          totalCompliant: compliantCount,
          totalNonCompliant: nonCompliantUsers.length,
        },
        emailSent: emailResult.success,
        emailError: emailResult.error,
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
