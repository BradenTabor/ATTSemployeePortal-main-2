// @ts-nocheck
/**
 * Supabase Edge Function: Weekly Safety Audit Report
 *
 * Runs every Friday at 5:00 PM CST (cron: 0 23 * * 5) to:
 * 1. Aggregate compliance, incidents, hazards, certifications, weather for last 7 days
 * 2. Generate ATTS-branded HTML email
 * 3. Send to weekly_safety_audit recipients
 * 4. Insert into weekly_safety_reports and email_send_log
 * 5. Optionally append a summary row to Google Sheets (Phase 3; set GOOGLE_SHEETS_* env vars).
 *
 * Body: { "dryRun": true } to skip email, DB write, and Sheets (testing).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_TIMEZONE = 'America/Chicago';
const GMAIL_USER = Deno.env.get('GMAIL_USER') || 'allterraintreeservice.po@gmail.com';
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') || '';
const ATTS_LOGO_URL = Deno.env.get('ATTS_LOGO_URL') || '';

const FALLBACK_RECIPIENTS = (
  Deno.env.get('WEEKLY_SAFETY_REPORT_FALLBACK_RECIPIENTS') ||
  'bradenleetabor@gmail.com,shane@alltts.com,dusty@alltts.com,mike@alltts.com,steve@alltts.com,brandon@alltts.com'
)
  .split(',')
  .map((e: string) => e.trim())
  .filter(Boolean);

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isWorkDay(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay();
  return day >= 1 && day <= 5;
}

// -----------------------------------------------------------------------------
// Recipients
// -----------------------------------------------------------------------------
async function getEmailRecipients(
  supabase: ReturnType<typeof createClient>,
  listKey: 'weekly_safety_audit',
  fallback: string[]
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('email_recipient_lists')
      .select('email')
      .eq('list_key', listKey);
    if (error) {
      console.error('[Recipients] DB error:', error.message);
      return fallback;
    }
    if (!data?.length) {
      console.warn('[Recipients] No recipients, using fallback');
      return fallback;
    }
    const emails = data.map((r: { email: string }) => r.email).filter(isValidEmail);
    return emails.length ? emails : fallback;
  } catch (err) {
    console.error('[Recipients] Error:', err);
    return fallback;
  }
}

// -----------------------------------------------------------------------------
// Gmail SMTP (same pattern as admin-compliance-cron)
// -----------------------------------------------------------------------------
function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

async function sendGmailEmail(
  recipients: string[],
  subject: string,
  textBody: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  if (!GMAIL_APP_PASSWORD) {
    return { success: false, error: 'GMAIL_APP_PASSWORD not configured' };
  }
  if (recipients.length === 0) {
    return { success: false, error: 'No recipients' };
  }
  try {
    const boundary = `boundary_${Date.now()}`;
    const rawEmail = [
      `From: ATTS Safety Compliance <${GMAIL_USER}>`,
      `To: ${recipients.join(', ')}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      '',
      textBody,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      '',
      htmlBody,
      '',
      `--${boundary}--`,
    ].join('\r\n');

    const conn = await Deno.connectTls({ hostname: 'smtp.gmail.com', port: 465 });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    async function sendCmd(cmd: string): Promise<string> {
      await conn.write(encoder.encode(cmd + '\r\n'));
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }
    async function readResp(): Promise<string> {
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      return decoder.decode(buf.subarray(0, n || 0));
    }

    await readResp();
    await sendCmd('EHLO localhost');
    await sendCmd('AUTH LOGIN');
    await sendCmd(base64Encode(GMAIL_USER));
    const passResp = await sendCmd(base64Encode(GMAIL_APP_PASSWORD.replace(/\s/g, '')));
    if (!passResp.includes('235')) {
      conn.close();
      return { success: false, error: 'Authentication failed' };
    }
    await sendCmd(`MAIL FROM:<${GMAIL_USER}>`);
    for (const r of recipients) await sendCmd(`RCPT TO:<${r}>`);
    await sendCmd('DATA');
    await conn.write(encoder.encode(rawEmail + '\r\n.\r\n'));
    await readResp();
    await sendCmd('QUIT');
    conn.close();
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

// -----------------------------------------------------------------------------
// Compliance metrics (RPC + required users)
// -----------------------------------------------------------------------------
async function getComplianceMetrics(
  supabase: ReturnType<typeof createClient>,
  reportStartStr: string,
  reportEndStr: string,
  prevStartStr: string,
  prevEndStr: string
) {
  const { data: dailySummaries } = await supabase.rpc('get_compliance_summary_by_day', {
    p_date_from: reportStartStr,
    p_date_to: reportEndStr,
  });
  const rows = Array.isArray(dailySummaries) ? dailySummaries : [];
  const workDays = rows.filter((r: { date: string }) => isWorkDay(r.date));
  const workDayCount = workDays.length;

  const { count: requiredUsers } = await supabase
    .from('app_users')
    .select('*', { count: 'exact', head: true })
    .in('role', ['employee', 'foreman'])
    .not('email', 'is', null);
  const required = requiredUsers ?? 0;
  const expectedUserDays = required > 0 && workDayCount > 0 ? required * workDayCount : 0;

  const sumDvirUsers = workDays.reduce((s: number, r: { dvir_users?: number }) => s + (Number(r.dvir_users) || 0), 0);
  const sumJsaUsers = workDays.reduce((s: number, r: { jsa_users?: number }) => s + (Number(r.jsa_users) || 0), 0);
  const sumEquipUsers = workDays.reduce((s: number, r: { equipment_users?: number }) => s + (Number(r.equipment_users) || 0), 0);

  const dvirRate = expectedUserDays > 0 ? Math.round((sumDvirUsers / expectedUserDays) * 1000) / 10 : 0;
  const jsaRate = expectedUserDays > 0 ? Math.round((sumJsaUsers / expectedUserDays) * 1000) / 10 : 0;
  const equipRate = expectedUserDays > 0 ? Math.round((sumEquipUsers / expectedUserDays) * 1000) / 10 : 0;

  // Previous week for trend
  const { data: prevRows } = await supabase.rpc('get_compliance_summary_by_day', {
    p_date_from: prevStartStr,
    p_date_to: prevEndStr,
  });
  const prevWorkDays = (Array.isArray(prevRows) ? prevRows : []).filter((r: { date: string }) => isWorkDay(r.date));
  const prevExpected = required > 0 && prevWorkDays.length > 0 ? required * prevWorkDays.length : 0;
  const prevSumDvir = prevWorkDays.reduce((s: number, r: { dvir_users?: number }) => s + (Number(r.dvir_users) || 0), 0);
  const prevSumJsa = prevWorkDays.reduce((s: number, r: { jsa_users?: number }) => s + (Number(r.jsa_users) || 0), 0);
  const prevSumEquip = prevWorkDays.reduce((s: number, r: { equipment_users?: number }) => s + (Number(r.equipment_users) || 0), 0);
  const prevDvirRate = prevExpected > 0 ? Math.round((prevSumDvir / prevExpected) * 1000) / 10 : 0;
  const prevJsaRate = prevExpected > 0 ? Math.round((prevSumJsa / prevExpected) * 1000) / 10 : 0;
  const prevEquipRate = prevExpected > 0 ? Math.round((prevSumEquip / prevExpected) * 1000) / 10 : 0;

  // Top 5 non-compliant: count missing submissions per user
  const { data: requiredUserList } = await supabase
    .from('app_users')
    .select('user_id, full_name, role')
    .in('role', ['employee', 'foreman'])
    .not('email', 'is', null);
  const users = requiredUserList || [];
  const nonCompliant: { name: string; role: string; missingCount: number }[] = [];
  for (const u of users) {
    const uid = u.user_id;
    const [dvirRes, jsaRes, equipRes] = await Promise.all([
      supabase.from('dvir_reports').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('report_date', reportStartStr).lte('report_date', reportEndStr),
      supabase.from('daily_jsa').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('job_date', reportStartStr).lte('job_date', reportEndStr),
      supabase.from('daily_equipment_inspections').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('inspection_date', reportStartStr).lte('inspection_date', reportEndStr),
    ]);
    const dvirCount = dvirRes.count ?? 0;
    const jsaCount = jsaRes.count ?? 0;
    const equipCount = equipRes.count ?? 0;
    const expected = workDayCount * 3;
    const actual = dvirCount + jsaCount + equipCount;
    const missing = Math.max(0, expected - actual);
    if (missing > 0) {
      nonCompliant.push({
        name: u.full_name || 'Unknown',
        role: u.role || 'employee',
        missingCount: missing,
      });
    }
  }
  nonCompliant.sort((a, b) => b.missingCount - a.missingCount);
  const topNonCompliant = nonCompliant.slice(0, 5);

  return {
    dvirComplianceRate: dvirRate,
    jsaComplianceRate: jsaRate,
    equipmentComplianceRate: equipRate,
    activeUsers: required,
    workDays: workDayCount,
    topNonCompliant,
    trends: {
      dvir: { delta: dvirRate - prevDvirRate, label: dvirRate >= prevDvirRate ? '↑' : '↓', class: dvirRate >= prevDvirRate ? 'up' : 'down' },
      jsa: { delta: jsaRate - prevJsaRate, label: jsaRate >= prevJsaRate ? '↑' : '↓', class: jsaRate >= prevJsaRate ? 'up' : 'down' },
      equipment: { delta: equipRate - prevEquipRate, label: equipRate >= prevEquipRate ? '↑' : '↓', class: equipRate >= prevEquipRate ? 'up' : 'down' },
    },
  };
}

// -----------------------------------------------------------------------------
// Incident metrics
// -----------------------------------------------------------------------------
const SEVERITY_LABELS: Record<string, string> = {
  near_miss: 'Near Miss',
  first_aid: 'First Aid Only',
  recordable: 'Recordable',
  lost_time: 'Lost Time',
  fatality: 'Fatality',
};

async function getIncidentMetrics(
  supabase: ReturnType<typeof createClient>,
  reportStartStr: string,
  reportEndStr: string,
  prevStartStr: string,
  prevEndStr: string
) {
  const { data: incidents } = await supabase
    .from('safety_incidents')
    .select('*')
    .gte('incident_date', reportStartStr)
    .lte('incident_date', reportEndStr);
  const list = incidents || [];
  const total = list.length;
  const oshaRecordable = list.filter((i: { osha_reportable?: boolean }) => i.osha_reportable).length;
  const nearMisses = list.filter((i: { severity: string }) => i.severity === 'near_miss').length;
  const firstAid = list.filter((i: { severity: string }) => i.severity === 'first_aid').length;

  const bySite: Record<string, number> = {};
  for (const i of list) {
    const site = i.work_site_name || 'Unknown';
    bySite[site] = (bySite[site] || 0) + 1;
  }
  const topWorkSites = Object.entries(bySite)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const { count: prevCount } = await supabase
    .from('safety_incidents')
    .select('*', { count: 'exact', head: true })
    .gte('incident_date', prevStartStr)
    .lte('incident_date', prevEndStr);
  const prevTotal = prevCount ?? 0;
  const incidentDelta = total - prevTotal;
  const trendLabel = incidentDelta > 0 ? '↑' : incidentDelta < 0 ? '↓' : '→';
  const trendClass = incidentDelta <= 0 ? 'up' : 'down';

  return {
    totalIncidents: total,
    oshaRecordable,
    nearMisses,
    firstAidOnly: firstAid,
    list,
    topWorkSites,
    severityLabels: SEVERITY_LABELS,
    trend: { delta: incidentDelta, label: trendLabel, class: trendClass },
  };
}

// -----------------------------------------------------------------------------
// Hazard / defect aggregation (inline, same logic as generate-safety-announcement)
// -----------------------------------------------------------------------------
function aggregateJsaHazards(jsas: { hazards_present?: Record<string, boolean> }[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const j of jsas) {
    if (!j.hazards_present || typeof j.hazards_present !== 'object') continue;
    for (const [h, v] of Object.entries(j.hazards_present)) {
      if (v === true) counts.set(h, (counts.get(h) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
}

function aggregateDvirDefects(dvirs: { vehicle_trailer_checklist?: Record<string, unknown>; aerial_checklist?: Record<string, unknown> }[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of dvirs) {
    for (const checklist of [d.vehicle_trailer_checklist, d.aerial_checklist]) {
      if (!checklist || typeof checklist !== 'object') continue;
      for (const [key, value] of Object.entries(checklist)) {
        if (value === false || value === 'fail' || value === 'Fail') {
          const label = key.replace(/_/g, ' ');
          counts.set(label, (counts.get(label) || 0) + 1);
        }
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
}

function aggregateEquipmentDefects(
  inspections: { general_checklist?: Record<string, unknown>; specific_checklist?: Record<string, unknown> }[]
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const i of inspections) {
    for (const checklist of [i.general_checklist, i.specific_checklist]) {
      if (!checklist || typeof checklist !== 'object') continue;
      for (const [key, value] of Object.entries(checklist)) {
        if (value === false || value === 'fail' || value === 'Fail' || value === 'no' || value === 'No') {
          const label = key.replace(/_/g, ' ');
          counts.set(label, (counts.get(label) || 0) + 1);
        }
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
}

async function getHazardDefectMetrics(
  supabase: ReturnType<typeof createClient>,
  reportStartStr: string,
  reportEndStr: string
) {
  const [jsaRes, dvirRes, equipRes] = await Promise.all([
    supabase.from('daily_jsa').select('hazards_present').gte('job_date', reportStartStr).lte('job_date', reportEndStr),
    supabase.from('dvir_reports').select('vehicle_trailer_checklist,aerial_checklist').gte('report_date', reportStartStr).lte('report_date', reportEndStr),
    supabase.from('daily_equipment_inspections').select('general_checklist,specific_checklist').gte('inspection_date', reportStartStr).lte('inspection_date', reportEndStr),
  ]);
  const jsas = jsaRes.data || [];
  const dvirs = dvirRes.data || [];
  const equips = equipRes.data || [];

  const topJsaHazards = aggregateJsaHazards(jsas);
  const topDvirDefects = aggregateDvirDefects(dvirs);
  const topEquipDefects = aggregateEquipmentDefects(equips);

  let outOfServiceCount = 0;
  for (const d of dvirs) {
    const v = d.vehicle_trailer_checklist;
    const a = d.aerial_checklist;
    const hasFail = (c: Record<string, unknown> | undefined) =>
      c && Object.values(c).some((v) => v === false || v === 'fail' || v === 'Fail');
    if (hasFail(v as Record<string, unknown>) || hasFail(a as Record<string, unknown>)) outOfServiceCount++;
  }
  for (const e of equips) {
    const g = e.general_checklist;
    const s = e.specific_checklist;
    const hasFail = (c: Record<string, unknown> | undefined) =>
      c && Object.values(c).some((v) => v === false || v === 'fail' || v === 'Fail' || v === 'no' || v === 'No');
    if (hasFail(g as Record<string, unknown>) || hasFail(s as Record<string, unknown>)) outOfServiceCount++;
  }

  return {
    topJsaHazards,
    topDvirDefects,
    topEquipDefects,
    outOfServiceCount,
  };
}

// -----------------------------------------------------------------------------
// Weather (from JSA only)
// -----------------------------------------------------------------------------
async function getWeatherMetrics(
  supabase: ReturnType<typeof createClient>,
  reportStartStr: string,
  reportEndStr: string
) {
  const { data: jsas } = await supabase
    .from('daily_jsa')
    .select('job_date, weather_conditions, weather_hazards')
    .gte('job_date', reportStartStr)
    .lte('job_date', reportEndStr);
  const list = jsas || [];
  const adverseKeywords = ['rain', 'snow', 'wind', 'extreme', 'cold', 'heat', 'storm', 'ice'];
  let daysWithAdverse = 0;
  let jsasCitingWeather = 0;
  const daysSet = new Set<string>();
  for (const j of list) {
    const cond = JSON.stringify(j.weather_conditions || {}).toLowerCase();
    const hazards = String(j.weather_hazards || '').toLowerCase();
    const adverse = adverseKeywords.some((k) => cond.includes(k) || hazards.includes(k));
    if (adverse) {
      jsasCitingWeather++;
      if (j.job_date) daysSet.add(j.job_date);
    }
  }
  daysWithAdverse = daysSet.size;
  return { daysWithAdverseWeather: daysWithAdverse, jsasCitingWeatherHazard: jsasCitingWeather };
}

// -----------------------------------------------------------------------------
// Certification metrics
// -----------------------------------------------------------------------------
async function getCertificationMetrics(
  supabase: ReturnType<typeof createClient>,
  reportStartStr: string,
  reportEndStr: string,
  prevStartStr: string,
  prevEndStr: string
) {
  const now = new Date().toISOString();
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const endOfReportDay = reportEndStr + 'T23:59:59.999Z';
  const { count: completed } = await supabase
    .from('certification_records')
    .select('*', { count: 'exact', head: true })
    .not('certified_at', 'is', null)
    .gte('certified_at', reportStartStr)
    .lte('certified_at', endOfReportDay);
  const { data: expiring } = await supabase
    .from('certification_records')
    .select('id, user_id, certification_type_id, expires_at')
    .gte('expires_at', now)
    .lte('expires_at', in30)
    .in('status', ['active', 'pending', 'written_passed']);
  const { data: overdue } = await supabase
    .from('certification_records')
    .select('id, user_id, certification_type_id, expires_at')
    .lt('expires_at', now)
    .in('status', ['active', 'pending', 'written_passed']);
  const expiringCount = expiring?.length ?? 0;
  const overdueCount = overdue?.length ?? 0;

  const endOfPrevDay = prevEndStr + 'T23:59:59.999Z';
  const { count: prevCompleted } = await supabase
    .from('certification_records')
    .select('*', { count: 'exact', head: true })
    .not('certified_at', 'is', null)
    .gte('certified_at', prevStartStr)
    .lte('certified_at', endOfPrevDay);
  const certDelta = (completed ?? 0) - (prevCompleted ?? 0);
  const certTrendLabel = certDelta > 0 ? '↑' : certDelta < 0 ? '↓' : '→';
  const certTrendClass = certDelta >= 0 ? 'up' : 'down';

  return {
    certificationsCompleted: completed ?? 0,
    certificationsExpiring: expiringCount,
    certificationsOverdue: overdueCount,
    trend: { delta: certDelta, label: certTrendLabel, class: certTrendClass },
  };
}

// -----------------------------------------------------------------------------
// HTML email template
// -----------------------------------------------------------------------------
function buildEmailHtml(params: {
  weekStart: string;
  weekEnd: string;
  reportStartDisplay: string;
  reportEndDisplay: string;
  compliance: Awaited<ReturnType<typeof getComplianceMetrics>>;
  incidents: Awaited<ReturnType<typeof getIncidentMetrics>>;
  hazards: Awaited<ReturnType<typeof getHazardDefectMetrics>>;
  weather: Awaited<ReturnType<typeof getWeatherMetrics>>;
  certifications: Awaited<ReturnType<typeof getCertificationMetrics>>;
  generatedAt: string;
}) {
  const {
    weekStart,
    weekEnd,
    reportStartDisplay,
    reportEndDisplay,
    compliance,
    incidents,
    hazards,
    weather,
    certifications,
    generatedAt,
  } = params;
  const logo = ATTS_LOGO_URL || '';
  const c = compliance;
  const i = incidents;
  const h = hazards;
  const w = weather;
  const cert = certifications;

  const nonCompliantRows =
    c.topNonCompliant.length > 0
      ? c.topNonCompliant
          .map(
            (u) =>
              `<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.role)}</td><td>${u.missingCount}</td></tr>`
          )
          .join('')
      : '';

  const incidentRows = (i.list as { incident_date: string; severity: string; incident_type: string; work_site_name?: string }[])
    .map(
      (inc) =>
        `<tr><td>${inc.incident_date}</td><td>${escapeHtml(SEVERITY_LABELS[inc.severity] || inc.severity)}</td><td>${escapeHtml(inc.incident_type)}</td><td>${escapeHtml(inc.work_site_name || '')}</td><td>—</td></tr>`
    )
    .join('');

  const hazardList = h.topJsaHazards.map((x) => `<li>${escapeHtml(x.name)} — ${x.count} JSAs</li>`).join('') || '<li>None</li>';
  const dvirList = h.topDvirDefects.map((x) => `<li>${escapeHtml(x.name)} — ${x.count} reports</li>`).join('') || '<li>None</li>';
  const equipList = h.topEquipDefects.map((x) => `<li>${escapeHtml(x.name)} — ${x.count} inspections</li>`).join('') || '<li>None</li>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ATTS Weekly Safety Audit Report</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 800px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
    .header img { max-width: 200px; margin-bottom: 10px; }
    .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
    .header p { margin: 5px 0 0; font-size: 14px; opacity: 0.9; }
    .section { padding: 25px 30px; border-bottom: 1px solid #e5e7eb; }
    .section:last-child { border-bottom: none; }
    .section h2 { color: #1e3a8a; font-size: 18px; margin: 0 0 15px; border-left: 4px solid #3b82f6; padding-left: 10px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .metric-card { background: #f9fafb; border-radius: 6px; padding: 15px; border-left: 3px solid #3b82f6; }
    .metric-card .label { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px; }
    .metric-card .value { font-size: 24px; font-weight: bold; color: #1e3a8a; }
    .metric-card .trend { font-size: 12px; margin-top: 5px; }
    .metric-card .trend.up { color: #10b981; }
    .metric-card .trend.down { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #f3f4f6; text-align: left; padding: 10px; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px; font-size: 14px; color: #1f2937; border-bottom: 1px solid #e5e7eb; }
    .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 6px; margin-top: 15px; }
    .alert .title { font-weight: bold; color: #92400e; margin-bottom: 5px; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
    .footer a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logo ? `<img src="${escapeHtml(logo)}" alt="ATTS Logo">` : ''}
      <h1>Weekly Safety Audit Report</h1>
      <p>Week of ${reportStartDisplay} to ${reportEndDisplay}</p>
    </div>
    <div class="section">
      <h2>Compliance Summary</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">DVIR Compliance</div>
          <div class="value">${c.dvirComplianceRate}%</div>
          <div class="trend ${c.trends.dvir.class}">${c.trends.dvir.label} ${Math.abs(c.trends.dvir.delta).toFixed(1)}% vs last week</div>
        </div>
        <div class="metric-card">
          <div class="label">JSA Compliance</div>
          <div class="value">${c.jsaComplianceRate}%</div>
          <div class="trend ${c.trends.jsa.class}">${c.trends.jsa.label} ${Math.abs(c.trends.jsa.delta).toFixed(1)}% vs last week</div>
        </div>
        <div class="metric-card">
          <div class="label">Equipment Compliance</div>
          <div class="value">${c.equipmentComplianceRate}%</div>
          <div class="trend ${c.trends.equipment.class}">${c.trends.equipment.label} ${Math.abs(c.trends.equipment.delta).toFixed(1)}% vs last week</div>
        </div>
        <div class="metric-card">
          <div class="label">Active Users</div>
          <div class="value">${c.activeUsers}</div>
        </div>
      </div>
      <p><strong>OSHA Context:</strong> OSHA 1926.20(b) requires documented safety programs. Compliance rates demonstrate proactive hazard identification (JSA) and equipment safety (DVIR, Equipment Inspections).</p>
      ${c.topNonCompliant.length > 0 ? `
      <div class="alert">
        <div class="title">Top Non-Compliant Users This Week</div>
        <table><thead><tr><th>Name</th><th>Role</th><th>Missing Forms</th></tr></thead><tbody>${nonCompliantRows}</tbody></table>
      </div>` : ''}
    </div>
    <div class="section">
      <h2>Incident &amp; Near-Miss Summary</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">Total Incidents</div>
          <div class="value">${i.totalIncidents}</div>
          <div class="trend ${i.trend.class}">${i.trend.label} ${i.trend.delta} vs last week</div>
        </div>
        <div class="metric-card">
          <div class="label">OSHA Recordable</div>
          <div class="value">${i.oshaRecordable}</div>
        </div>
        <div class="metric-card">
          <div class="label">Near Misses</div>
          <div class="value">${i.nearMisses}</div>
        </div>
        <div class="metric-card">
          <div class="label">First Aid Only</div>
          <div class="value">${i.firstAidOnly}</div>
        </div>
      </div>
      <p><strong>OSHA Context:</strong> OSHA 1904.4-1904.7 requires recording work-related injuries/illnesses within 7 calendar days.</p>
      ${i.totalIncidents > 0 ? `<table><thead><tr><th>Date</th><th>Severity</th><th>Type</th><th>Work Site</th><th>Status</th></tr></thead><tbody>${incidentRows}</tbody></table>` : ''}
    </div>
    <div class="section">
      <h2>Hazard &amp; Defect Summary</h2>
      <p><strong>Top 5 JSA Hazards:</strong></p>
      <ol>${hazardList}</ol>
      <p><strong>Top 5 DVIR Defects:</strong></p>
      <ol>${dvirList}</ol>
      <p><strong>Top 5 Equipment Defects:</strong></p>
      <ol>${equipList}</ol>
      ${h.outOfServiceCount > 0 ? `<div class="alert"><div class="title">Out-of-Service Equipment/Vehicles</div><div class="message">${h.outOfServiceCount} vehicles/equipment with defects this week.</div></div>` : ''}
      <p><strong>OSHA Context:</strong> OSHA 1926.20(b)(2) requires hazard identification and communication.</p>
    </div>
    <div class="section">
      <h2>Weather Impact Summary</h2>
      <div class="metric-grid">
        <div class="metric-card"><div class="label">Days with Adverse Weather</div><div class="value">${w.daysWithAdverseWeather}</div></div>
        <div class="metric-card"><div class="label">JSAs Citing Weather Hazard</div><div class="value">${w.jsasCitingWeatherHazard}</div></div>
      </div>
      <p><strong>OSHA Context:</strong> OSHA 1926.20(b)(2) requires identification of environmental hazards.</p>
    </div>
    <div class="section">
      <h2>Training &amp; Certification Summary</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="label">Certifications Completed</div>
          <div class="value">${cert.certificationsCompleted}</div>
          <div class="trend ${cert.trend.class}">${cert.trend.label} ${cert.trend.delta} vs last week</div>
        </div>
        <div class="metric-card"><div class="label">Expiring in 30 Days</div><div class="value">${cert.certificationsExpiring}</div></div>
        <div class="metric-card"><div class="label">Overdue</div><div class="value">${cert.certificationsOverdue}</div></div>
      </div>
      ${cert.certificationsExpiring > 0 || cert.certificationsOverdue > 0 ? `<div class="alert"><div class="title">Certification Action Required</div><div class="message">${cert.certificationsExpiring} expiring in 30 days. ${cert.certificationsOverdue} overdue.</div></div>` : ''}
      <p><strong>OSHA Context:</strong> OSHA 1926.21(b)(2) requires documentation of employee training.</p>
    </div>
    <div class="section">
      <h2>OSHA Regulatory Reminders</h2>
      <ul>
        <li><strong>OSHA 300 Log:</strong> Annual summary (300A) must be posted February 1 – April 30.</li>
        <li><strong>1910.269:</strong> Job briefings required for line-clearance tree work near power lines.</li>
        <li><strong>1904.4:</strong> Record work-related injuries/illnesses within 7 calendar days.</li>
        <li><strong>49 CFR 396:</strong> DVIR records must be retained for 3 months.</li>
        <li><strong>ANSI Z133:</strong> Tree care operations safety standard.</li>
      </ul>
    </div>
    <div class="footer">
      <p>Generated automatically by ATTS Safety Compliance System on ${generatedAt}</p>
      <p>Questions? Contact <a href="mailto:safety@atts.com">safety@atts.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -----------------------------------------------------------------------------
// Google Sheets (Phase 3) — service account JWT + append
// -----------------------------------------------------------------------------
function base64UrlEncode(input: string | Uint8Array): string {
  const raw = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let b64 = '';
  for (let i = 0; i < raw.length; i++) b64 += String.fromCharCode(raw[i]);
  b64 = btoa(b64);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  const pem = sa.private_key;
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);

  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(message)
  );
  const sigB64 = base64UrlEncode(new Uint8Array(sig));
  const jwt = `${message}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token failed: ${tokenRes.status} ${err}`);
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) throw new Error('Google token response missing access_token');
  return tokenData.access_token;
}

interface SheetsRow {
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  dvirCompliance: number;
  jsaCompliance: number;
  equipmentCompliance: number;
  activeUsers: number;
  totalIncidents: number;
  oshaRecordable: number;
  nearMisses: number;
  firstAidOnly: number;
  outOfServiceCount: number;
  certificationsCompleted: number;
  certificationsExpiring: number;
  certificationsOverdue: number;
  topHazard: string;
  topHazardCount: number;
  topDvirDefect: string;
  topDvirDefectCount: number;
  reportUrl?: string;
}

async function appendWeeklySafetyReportToSheets(row: SheetsRow): Promise<{ success: boolean; error?: string }> {
  const json = Deno.env.get('GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON');
  const spreadsheetId = Deno.env.get('GOOGLE_SHEETS_SAFETY_AUDIT_ID');
  if (!json || !spreadsheetId) {
    console.warn('[Sheets] GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON or GOOGLE_SHEETS_SAFETY_AUDIT_ID not set');
    return { success: false, error: 'Sheets not configured' };
  }
  try {
    const accessToken = await getGoogleAccessToken(json);
    const values = [
      [
        row.weekStart,
        row.weekEnd,
        row.generatedAt,
        row.dvirCompliance,
        row.jsaCompliance,
        row.equipmentCompliance,
        row.activeUsers,
        row.totalIncidents,
        row.oshaRecordable,
        row.nearMisses,
        row.firstAidOnly,
        row.outOfServiceCount,
        row.certificationsCompleted,
        row.certificationsExpiring,
        row.certificationsOverdue,
        row.topHazard,
        row.topHazardCount,
        row.topDvirDefect,
        row.topDvirDefectCount,
        row.reportUrl ?? '',
      ],
    ];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Weekly%20Safety%20Audit%20Reports!A:T:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Sheets append: ${res.status} ${err}` };
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[Sheets] Error:', msg);
    return { success: false, error: msg };
  }
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[WeeklyAudit] Starting at', new Date().toISOString());

  let body: { dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // no body
  }
  const dryRun = body.dryRun === true;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const reportEnd = new Date();
    const reportStart = new Date(reportEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(reportStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const reportStartStr = toDateStr(reportStart);
    const reportEndStr = toDateStr(reportEnd);
    const prevStartStr = toDateStr(prevStart);
    const prevEndStr = toDateStr(prevEnd);
    const reportStartDisplay = formatDisplayDate(reportStartStr);
    const reportEndDisplay = formatDisplayDate(reportEndStr);

    const [compliance, incidents, hazards, weather, certifications] = await Promise.all([
      getComplianceMetrics(supabase, reportStartStr, reportEndStr, prevStartStr, prevEndStr),
      getIncidentMetrics(supabase, reportStartStr, reportEndStr, prevStartStr, prevEndStr),
      getHazardDefectMetrics(supabase, reportStartStr, reportEndStr),
      getWeatherMetrics(supabase, reportStartStr, reportEndStr),
      getCertificationMetrics(supabase, reportStartStr, reportEndStr, prevStartStr, prevEndStr),
    ]);

    const generatedAt = new Date().toLocaleString('en-US', {
      timeZone: DEFAULT_TIMEZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const htmlBody = buildEmailHtml({
      weekStart: reportStartStr,
      weekEnd: reportEndStr,
      reportStartDisplay,
      reportEndDisplay,
      compliance,
      incidents,
      hazards,
      weather,
      certifications,
      generatedAt,
    });
    const textBody = `ATTS Weekly Safety Audit Report — Week of ${reportStartDisplay} to ${reportEndDisplay}. View email in HTML.`;
    const subject = `ATTS Weekly Safety Audit Report — Week of ${reportStartDisplay} to ${reportEndDisplay}`;

    let emailSent = false;
    let emailError: string | null = null;
    const recipients: string[] = [];

    if (!dryRun) {
      const recs = await getEmailRecipients(supabase, 'weekly_safety_audit', FALLBACK_RECIPIENTS);
      recipients.push(...recs);
      const emailResult = await sendGmailEmail(recipients, subject, textBody, htmlBody);
      emailSent = emailResult.success;
      emailError = emailResult.error ?? null;
      await supabase.from('email_send_log').insert({
        list_key: 'weekly_safety_audit',
        recipients: recs,
        success: emailSent,
        error_message: emailError,
      });
    }

    const reportData = {
      compliance,
      incidents: {
        totalIncidents: incidents.totalIncidents,
        oshaRecordable: incidents.oshaRecordable,
        nearMisses: incidents.nearMisses,
        firstAidOnly: incidents.firstAidOnly,
        trend: incidents.trend,
      },
      hazards,
      weather,
      certifications,
    };

    let sheetsUpdated = false;
    let reportId: string | null = null;

    if (!dryRun) {
      const { data: inserted, error: insertErr } = await supabase
        .from('weekly_safety_reports')
        .insert({
          week_start_date: reportStartStr,
          week_end_date: reportEndStr,
          report_data: reportData,
          email_sent: emailSent,
          email_sent_at: emailSent ? new Date().toISOString() : null,
          sheets_updated: false,
          error: emailError,
        })
        .select('id')
        .single();
      if (insertErr) {
        console.error('[WeeklyAudit] Insert weekly_safety_reports failed:', insertErr);
        throw new Error(insertErr.message);
      }
      reportId = inserted?.id ?? null;

      const sheetsRow: SheetsRow = {
        weekStart: reportStartStr,
        weekEnd: reportEndStr,
        generatedAt: new Date().toISOString(),
        dvirCompliance: compliance.dvirComplianceRate,
        jsaCompliance: compliance.jsaComplianceRate,
        equipmentCompliance: compliance.equipmentComplianceRate,
        activeUsers: compliance.activeUsers,
        totalIncidents: incidents.totalIncidents,
        oshaRecordable: incidents.oshaRecordable,
        nearMisses: incidents.nearMisses,
        firstAidOnly: incidents.firstAidOnly,
        outOfServiceCount: hazards.outOfServiceCount,
        certificationsCompleted: certifications.certificationsCompleted,
        certificationsExpiring: certifications.certificationsExpiring,
        certificationsOverdue: certifications.certificationsOverdue,
        topHazard: hazards.topJsaHazards[0]?.name ?? '',
        topHazardCount: hazards.topJsaHazards[0]?.count ?? 0,
        topDvirDefect: hazards.topDvirDefects[0]?.name ?? '',
        topDvirDefectCount: hazards.topDvirDefects[0]?.count ?? 0,
      };
      const sheetsResult = await appendWeeklySafetyReportToSheets(sheetsRow);
      if (sheetsResult.success && reportId) {
        sheetsUpdated = true;
        await supabase
          .from('weekly_safety_reports')
          .update({
            sheets_updated: true,
            sheets_updated_at: new Date().toISOString(),
          })
          .eq('id', reportId);
      } else if (sheetsResult.error) {
        console.warn('[WeeklyAudit] Google Sheets append failed:', sheetsResult.error);
        if (reportId) {
          await supabase
            .from('weekly_safety_reports')
            .update({ error: (emailError || '') + (emailError ? '; ' : '') + `Sheets: ${sheetsResult.error}` })
            .eq('id', reportId);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log('[WeeklyAudit] Completed in', duration, 'ms', dryRun ? '(dry run)' : '');

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        weekStart: reportStartStr,
        weekEnd: reportEndStr,
        emailSent,
        emailError: emailError ?? undefined,
        sheetsUpdated,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[WeeklyAudit] Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
