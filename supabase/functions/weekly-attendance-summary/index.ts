// @ts-nocheck
/**
 * Supabase Edge Function: Weekly Attendance Summary
 *
 * Sends a weekly email every Monday at 7:00 AM CDT (cron: 0 12 * * 1) with
 * attendance data for the previous work week (Mon–Fri). Uses America/Chicago
 * for date math. Idempotent: re-running for the same week sends another email.
 *
 * Body: { "dryRun": true } to skip email and DB write (testing).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendGmailEmail } from "../_shared/gmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_TIMEZONE = "America/Chicago";
const GMAIL_USER = Deno.env.get("GMAIL_USER") || "allterraintreeservice.po@gmail.com";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") || "";
const ATTS_LOGO_URL = Deno.env.get("ATTS_LOGO_URL") || "";

const FALLBACK_RECIPIENTS = (
  Deno.env.get("WEEKLY_ATTENDANCE_SUMMARY_FALLBACK_RECIPIENTS") ||
  "bradenleetabor@gmail.com,shane@alltts.com,dusty@alltts.com,mike@alltts.com,steve@alltts.com,brandon@alltts.com"
)
  .split(",")
  .map((e: string) => e.trim())
  .filter(Boolean);

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Get "today" as YYYY-MM-DD in America/Chicago. */
function getTodayInChicago(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: DEFAULT_TIMEZONE });
}

/**
 * Compute previous Monday and Friday (last full work week) in America/Chicago.
 * Works regardless of which day the function runs (Monday, manual trigger, retry).
 */
function getLastWeekRange(): { startDate: string; endDate: string } {
  const todayStr = getTodayInChicago();
  const [y, m, d] = todayStr.split("-").map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const dow = todayUtc.getUTCDay();
  const daysBack = dow === 1 ? 7 : dow === 0 ? 6 : dow - 1;
  todayUtc.setUTCDate(todayUtc.getUTCDate() - daysBack);
  const startDate = todayUtc.toISOString().slice(0, 10);
  const endDate = new Date(
    Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() + 4)
  )
    .toISOString()
    .slice(0, 10);
  return { startDate, endDate };
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    timeZone: DEFAULT_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ATTENDANCE_ROLES = ["employee", "foreman", "general_foreman", "mechanic", "safety_officer"];

interface AttendanceRecord {
  user_id: string;
  date: string;
  status: string;
}

interface UserRow {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface SummaryRow {
  user_id: string;
  full_name: string | null;
  email: string;
  role: string;
  days_present: number;
  days_absent: number;
  days_ncns: number;
  days_rto: number;
  total_days: number;
  attendance_rate: number;
}

async function getEmailRecipients(
  supabase: ReturnType<typeof createClient>,
  fallback: string[]
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("email_recipient_lists")
      .select("email")
      .eq("list_key", "weekly_attendance_summary");
    if (error) {
      console.error("[Recipients] DB error:", error.message);
      return fallback;
    }
    if (!data?.length) {
      console.warn("[Recipients] No recipients, using fallback");
      return fallback;
    }
    const emails = data.map((r: { email: string }) => r.email).filter(isValidEmail);
    return emails.length ? emails : fallback;
  } catch (err) {
    console.error("[Recipients] Error:", err);
    return fallback;
  }
}

async function fetchAttendanceData(
  supabase: ReturnType<typeof createClient>,
  startDate: string,
  endDate: string
): Promise<{ users: UserRow[]; records: AttendanceRecord[] }> {
  const { data: users, error: usersError } = await supabase
    .from("app_users")
    .select("user_id, full_name, email, role")
    .eq("status", "active")
    .in("role", ATTENDANCE_ROLES)
    .not("email", "ilike", "%@atts.test")
    .order("full_name", { ascending: true });

  if (usersError) {
    throw new Error("Failed to load employees: " + usersError.message);
  }

  const { data: records, error: recordsError } = await supabase
    .from("daily_attendance")
    .select("user_id, date, status")
    .gte("date", startDate)
    .lte("date", endDate);

  if (recordsError) {
    throw new Error("Failed to load attendance: " + recordsError.message);
  }

  return {
    users: (users ?? []) as UserRow[],
    records: (records ?? []) as AttendanceRecord[],
  };
}

const WORK_DAYS_PER_WEEK = 5;

function buildSummary(
  users: UserRow[],
  records: AttendanceRecord[],
  startDate: string,
  endDate: string
): { rows: SummaryRow[]; totalPresent: number; totalAbsent: number; totalNcns: number; totalRto: number; overallRate: number } {
  const byUser = new Map<string, { present: number; absent: number; ncns: number; rto: number }>();
  for (const u of users) {
    byUser.set(u.user_id, { present: 0, absent: 0, ncns: 0, rto: 0 });
  }
  for (const r of records) {
    const row = byUser.get(r.user_id);
    if (!row) continue;
    switch (r.status) {
      case "present":
        row.present++;
        break;
      case "absent":
        row.absent++;
        break;
      case "ncns":
        row.ncns++;
        break;
      case "rto":
        row.rto++;
        break;
    }
  }

  let totalPresent = 0,
    totalAbsent = 0,
    totalNcns = 0,
    totalRto = 0;
  const rows: SummaryRow[] = users.map((u) => {
    const counts = byUser.get(u.user_id) || { present: 0, absent: 0, ncns: 0, rto: 0 };
    const { present, absent, ncns, rto } = counts;
    totalPresent += present;
    totalAbsent += absent;
    totalNcns += ncns;
    totalRto += rto;
    const rate =
      WORK_DAYS_PER_WEEK > 0 ? Math.round((present / WORK_DAYS_PER_WEEK) * 100) : 0;
    return {
      user_id: u.user_id,
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      days_present: present,
      days_absent: absent,
      days_ncns: ncns,
      days_rto: rto,
      total_days: WORK_DAYS_PER_WEEK,
      attendance_rate: rate,
    };
  });

  const personDays = users.length * WORK_DAYS_PER_WEEK;
  const overallRate = personDays > 0 ? Math.round((totalPresent / personDays) * 100) : 0;

  return {
    rows: rows.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")),
    totalPresent,
    totalAbsent,
    totalNcns,
    totalRto,
    overallRate,
  };
}

function buildEmailHtml(params: {
  startDate: string;
  endDate: string;
  startDisplay: string;
  endDisplay: string;
  rows: SummaryRow[];
  totalPresent: number;
  totalAbsent: number;
  totalNcns: number;
  totalRto: number;
  overallRate: number;
  employeeCount: number;
  generatedAt: string;
}): string {
  const {
    startDisplay,
    endDisplay,
    rows,
    totalPresent,
    totalAbsent,
    totalNcns,
    totalRto,
    overallRate,
    employeeCount,
    generatedAt,
  } = params;
  const logo = ATTS_LOGO_URL || "";

  const tableRows = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;">${escapeHtml(r.full_name ?? "")}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;">${escapeHtml(r.role)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;">${r.days_present}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;">${r.days_absent}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;">${r.days_ncns}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;">${r.days_rto}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;">${r.total_days}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;">${r.attendance_rate}%</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>ATTS Weekly Attendance Summary</title></head>
<body style="font-family:Arial,sans-serif;background-color:#f4f4f4;margin:0;padding:0;">
<div style="max-width:800px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#1e3a8a 0%,#3b82f6 100%);color:#ffffff;padding:24px 20px;text-align:center;">
    ${logo ? `<img src="${escapeHtml(logo)}" alt="ATTS" style="max-width:180px;margin-bottom:8px;">` : ""}
    <h1 style="margin:0;font-size:22px;font-weight:bold;">Weekly Attendance Summary</h1>
    <p style="margin:8px 0 0;font-size:14px;opacity:0.95;">${escapeHtml(startDisplay)} – ${escapeHtml(endDisplay)}</p>
  </div>
  <div style="padding:24px 20px;border-bottom:1px solid #e5e7eb;">
    <h2 style="color:#1e3a8a;font-size:16px;margin:0 0 12px;">Summary</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td style="padding:6px 0;color:#6b7280;">Total present</td><td style="padding:6px 0;font-weight:bold;">${totalPresent}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Total absent</td><td style="padding:6px 0;">${totalAbsent}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Total NCNS</td><td style="padding:6px 0;">${totalNcns}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Total RTO</td><td style="padding:6px 0;">${totalRto}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Overall attendance rate</td><td style="padding:6px 0;font-weight:bold;">${overallRate}%</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Employees</td><td style="padding:6px 0;">${employeeCount}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280;">Work days</td><td style="padding:6px 0;">5</td></tr>
    </table>
  </div>
  <div style="padding:24px 20px;">
    <h2 style="color:#1e3a8a;font-size:16px;margin:0 0 12px;">By employee</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
    <thead><tr style="background:#f3f4f6;">
    <th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb;">Name</th>
    <th style="padding:8px 12px;text-align:left;border:1px solid #e5e7eb;">Role</th>
    <th style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;">Present</th>
    <th style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;">Absent</th>
    <th style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;">NCNS</th>
    <th style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;">RTO</th>
    <th style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;">Days</th>
    <th style="padding:8px 12px;text-align:center;border:1px solid #e5e7eb;">Rate %</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
    </table>
  </div>
  <div style="background:#f9fafb;padding:16px 20px;text-align:center;color:#6b7280;font-size:12px;">Generated ${escapeHtml(generatedAt)} (America/Chicago)</div>
</div>
</body>
</html>`;
}

function buildTextBody(params: {
  startDisplay: string;
  endDisplay: string;
  totalPresent: number;
  totalAbsent: number;
  totalNcns: number;
  totalRto: number;
  overallRate: number;
  employeeCount: number;
  rows: SummaryRow[];
}): string {
  const { startDisplay, endDisplay, totalPresent, totalAbsent, totalNcns, totalRto, overallRate, employeeCount, rows } = params;
  let text = `ATTS Weekly Attendance Summary\n${startDisplay} – ${endDisplay}\n\n`;
  text += `Summary: Present ${totalPresent}, Absent ${totalAbsent}, NCNS ${totalNcns}, RTO ${totalRto}. Overall rate: ${overallRate}%. Employees: ${employeeCount}. Work days: 5.\n\n`;
  text += "By employee:\nName\tRole\tPresent\tAbsent\tNCNS\tRTO\tDays\tRate %\n";
  for (const r of rows) {
    text += `${r.full_name ?? ""}\t${r.role}\t${r.days_present}\t${r.days_absent}\t${r.days_ncns}\t${r.days_rto}\t${r.total_days}\t${r.attendance_rate}%\n`;
  }
  return text;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("[WeeklyAttendance] Starting at", new Date().toISOString());

  let body: { dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // no body
  }
  const dryRun = body.dryRun === true;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { startDate, endDate } = getLastWeekRange();
    const startDisplay = formatDisplayDate(startDate);
    const endDisplay = formatDisplayDate(endDate);

    const { users, records } = await fetchAttendanceData(supabase, startDate, endDate);
    const summary = buildSummary(users, records, startDate, endDate);

    const generatedAt = new Date().toLocaleString("en-US", {
      timeZone: DEFAULT_TIMEZONE,
      dateStyle: "medium",
      timeStyle: "short",
    });

    const htmlBody = buildEmailHtml({
      startDate,
      endDate,
      startDisplay,
      endDisplay,
      rows: summary.rows,
      totalPresent: summary.totalPresent,
      totalAbsent: summary.totalAbsent,
      totalNcns: summary.totalNcns,
      totalRto: summary.totalRto,
      overallRate: summary.overallRate,
      employeeCount: users.length,
      generatedAt,
    });
    const textBody = buildTextBody({
      startDisplay,
      endDisplay,
      totalPresent: summary.totalPresent,
      totalAbsent: summary.totalAbsent,
      totalNcns: summary.totalNcns,
      totalRto: summary.totalRto,
      overallRate: summary.overallRate,
      employeeCount: users.length,
      rows: summary.rows,
    });
    const subject = `ATTS Weekly Attendance Summary — Week of ${startDisplay} – ${endDisplay}`;

    let emailSent = false;
    let emailError: string | null = null;
    const recipients: string[] = [];

    if (!dryRun) {
      const recs = await getEmailRecipients(supabase, FALLBACK_RECIPIENTS);
      recipients.push(...recs);
      const emailResult = await sendGmailEmail(recipients, subject, textBody, htmlBody, {
        gmailUser: GMAIL_USER,
        gmailAppPassword: GMAIL_APP_PASSWORD,
        fromLabel: "ATTS",
      });
      emailSent = emailResult.success;
      emailError = emailResult.error ?? null;
      await supabase.from("email_send_log").insert({
        list_key: "weekly_attendance_summary",
        recipients: recs,
        success: emailSent,
        error_message: emailError,
      });
    }

    const duration = Date.now() - startTime;
    console.log("[WeeklyAttendance] Completed in", duration, "ms", dryRun ? "(dry run)" : "");

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        startDate,
        endDate,
        startDisplay,
        endDisplay,
        employeeCount: users.length,
        totalPresent: summary.totalPresent,
        overallRate: summary.overallRate,
        emailSent,
        emailError: emailError ?? undefined,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[WeeklyAttendance] Error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
