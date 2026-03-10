// @ts-nocheck
/**
 * Safety Briefing Reminder SMS (Tier 0)
 *
 * Cron: 10:40 UTC Mon–Fri (5:40 AM CDT). Sends SMS to active field employees
 * who have not completed today's safety briefing. Runs 20 min after the push
 * reminder (10:20 UTC). Suppresses on company_calendar, user_absences, new hires.
 *
 * Invoke with x-internal-key: INTERNAL_SECRET or Bearer: service role.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/clicksend.ts";

const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLICKSEND_USERNAME = Deno.env.get("CLICKSEND_USERNAME") ?? "";
const CLICKSEND_PASSWORD = Deno.env.get("CLICKSEND_PASSWORD") ?? "";
const CLICKSEND_FROM_NUMBER = Deno.env.get("CLICKSEND_FROM_NUMBER") ?? "+18443781444";

const FIELD_ROLES = ["employee", "foreman", "general_foreman", "mechanic"];
const TZ = "America/Chicago";
const NEW_HIRE_DAYS = 5;
const SMS_PREFIX = "ATTS Safety: ";
const NO_NAME_BODY = SMS_PREFIX + "Good morning — your daily safety briefing is ready. Log in to the app to complete it before 8 AM to claim your reward points.";
const MAX_FIRST_NAME_LEN = 40; // keeps "ATTS Safety: Good morning {name} — your daily..." under 160 chars

/** First name from full_name (first segment); null if empty. Truncated to fit SMS length. */
function getFirstName(fullName: string | null | undefined): string | null {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0]?.trim() ?? null;
  if (!first) return null;
  return first.length > MAX_FIRST_NAME_LEN ? first.slice(0, MAX_FIRST_NAME_LEN) : first;
}

function buildReminderBody(firstName: string | null): string {
  if (!firstName) return NO_NAME_BODY;
  const withName = `${SMS_PREFIX}Good morning ${firstName} — your daily safety briefing is ready. Log in to the app to complete it before 8 AM to claim your reward points.`;
  return withName.length <= 160 ? withName : NO_NAME_BODY;
}

/** Today in Chicago as YYYY-MM-DD */
function getChicagoToday(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

Deno.serve(async (req: Request) => {
  const internalKey = req.headers.get("x-internal-key");
  const authHeader = req.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const allowed =
    (INTERNAL_SECRET && internalKey === INTERNAL_SECRET) ||
    (SUPABASE_SERVICE_ROLE_KEY && bearer === SUPABASE_SERVICE_ROLE_KEY);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const todayStr = getChicagoToday();
  const now = new Date();
  const dayOfWeek = new Date(now.toLocaleString("en-US", { timeZone: TZ })).getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Weekend", date: todayStr }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Company-wide suppression
  const { data: companyOff } = await supabase
    .from("company_calendar")
    .select("date")
    .eq("date", todayStr)
    .limit(1)
    .maybeSingle();
  if (companyOff) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Company calendar", date: todayStr }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Announcement for today (if none, no briefing to complete)
  const { data: announcementsToday } = await supabase
    .from("announcements")
    .select("id")
    .eq("date", todayStr)
    .limit(1);
  if (!announcementsToday?.length) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "No announcement for today", date: todayStr }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // New-hire cutoff: created_at > (now - 5 days) in Chicago
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - NEW_HIRE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 19);

  // User absences for today
  const { data: absentRows } = await supabase
    .from("user_absences")
    .select("user_id")
    .eq("date", todayStr);
  const absentSet = new Set((absentRows ?? []).map((r: { user_id: string }) => r.user_id));

  // Active field users (full_name for personalized morning nudge)
  const { data: fieldUsers, error: usersErr } = await supabase
    .from("app_users")
    .select("user_id, phone_number, created_at, full_name")
    .in("role", FIELD_ROLES)
    .eq("status", "active")
    .not("email", "ilike", "%@atts.test");
  if (usersErr || !fieldUsers?.length) {
    return new Response(
      JSON.stringify({ sent: 0, reason: "No field users or error", error: usersErr?.message }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Completed today (cross-reference by briefing_date OR announcement_id for robustness)
  const todayAnnouncementId = (announcementsToday as { id: string }[])[0].id;
  const { data: completed } = await supabase
    .from("safety_briefing_answers")
    .select("user_id")
    .or(`briefing_date.eq.${todayStr},announcement_id.eq.${todayAnnouncementId}`);
  const completedSet = new Set((completed ?? []).map((r: { user_id: string }) => r.user_id));

  const overdue: { user_id: string; phone_number: string; first_name: string | null }[] = [];
  for (const u of fieldUsers as { user_id: string; phone_number: string | null; created_at: string; full_name: string | null }[]) {
    if (completedSet.has(u.user_id)) continue;
    if (absentSet.has(u.user_id)) continue;
    if (u.created_at && u.created_at > cutoffStr) continue;
    const phone = (u.phone_number ?? "").trim().replace(/\D/g, "");
    if (!phone || phone.length < 10) continue;
    const e164 = phone.startsWith("+") ? phone : `+1${phone}`;
    overdue.push({
      user_id: u.user_id,
      phone_number: e164,
      first_name: getFirstName(u.full_name),
    });
  }

  // Idempotency: already sent tier 0 for today? (check before zero-overdue insert so we don't double-insert)
  const { data: existingLog } = await supabase
    .from("sms_escalation_send_log")
    .select("sent_at")
    .eq("tier", 0)
    .eq("date_checked", todayStr)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingLog?.sent_at) {
    const sentAtChicago = new Date(existingLog.sent_at).toLocaleDateString("en-CA", { timeZone: TZ });
    if (sentAtChicago === todayStr) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Already sent today", date: todayStr }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // Zero-overdue audit log: when nobody to notify, still log so admin can distinguish "ran, 0 overdue" from "cron failed"
  if (overdue.length === 0) {
    await supabase.from("sms_escalation_send_log").insert({
      tier: 0,
      date_checked: todayStr,
      overdue_count: 0,
      recipient_count: 0,
      success: true,
      error_message: null,
      total_price: 0,
      results: null,
      employee_user_ids: [],
    });
    return new Response(
      JSON.stringify({ sent: 0, reason: "No overdue users with phone", date: todayStr }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!CLICKSEND_USERNAME || !CLICKSEND_PASSWORD) {
    return new Response(
      JSON.stringify({ error: "ClickSend not configured", overdueCount: overdue.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const messages = overdue.map((o) => ({
    to: o.phone_number,
    body: buildReminderBody(o.first_name),
  }));
  const sendResult = await sendSMS(messages, {
    username: CLICKSEND_USERNAME,
    password: CLICKSEND_PASSWORD,
    from: CLICKSEND_FROM_NUMBER,
  });

  await supabase.from("sms_escalation_send_log").insert({
    tier: 0,
    date_checked: todayStr,
    overdue_count: overdue.length,
    recipient_count: overdue.length,
    success: sendResult.success,
    error_message: sendResult.error ?? null,
    total_price: sendResult.totalPrice ?? 0,
    results: sendResult.results ?? null,
    employee_user_ids: overdue.map((o) => o.user_id),
  });

  return new Response(
    JSON.stringify({
      sent: overdue.length,
      success: sendResult.success,
      date: todayStr,
      error: sendResult.error,
      totalPrice: sendResult.totalPrice,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
