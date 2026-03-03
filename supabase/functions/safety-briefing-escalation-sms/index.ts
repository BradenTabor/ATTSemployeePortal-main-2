// @ts-nocheck
/**
 * Safety Briefing Escalation SMS
 *
 * Cron: 16:00 UTC Mon–Fri (10 AM CST / 11 AM CDT). Sends SMS to admins when
 * active field users are overdue on daily safety briefing (briefing-only; no reward check).
 * Tier 1 = 1 business day overdue → tier-1 recipients; Tier 2 = 2 business days → tier-2.
 *
 * Invoke with x-internal-key: INTERNAL_SECRET.
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
const MAX_NAMES_SHOWN = 10;

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

/** Format YYYY-MM-DD as "Feb 27" in America/Chicago */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Previous business day (skip weekend) from dateStr YYYY-MM-DD */
function prevBusinessDay(dateStr: string): string {
  let d = new Date(dateStr + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Two business days ago */
function twoBusinessDaysAgo(dateStr: string): string {
  let d = new Date(dateStr + "T12:00:00.000Z");
  for (let i = 0; i < 2; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

/** Abbreviate name to "First L." for SMS */
function abbreviateName(fullName: string | null): string {
  if (!fullName || !fullName.trim()) return "Unknown";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 12);
  const first = parts[0];
  const last = parts[parts.length - 1];
  const initial = last.charAt(0).toUpperCase();
  return `${first} ${initial}.`;
}

/** Build SMS body with tier label, date, up to 10 names, and actionable CTA. Multi-part is acceptable. */
function buildSMSBody(names: string[], totalOverdue: number, tier: 1 | 2, dateStr: string): string {
  const dateLabel = formatDateLabel(dateStr);
  const tierLabel = tier === 1 ? "1st Notice" : "2nd Notice";
  const header = `ATTS Safety Briefing - ${tierLabel} (${dateLabel})`;

  const verb = tier === 1
    ? "still need to complete their briefing"
    : "are overdue on their briefing";
  const countLine = `${totalOverdue} employee${totalOverdue !== 1 ? "s" : ""} ${verb}:`;

  const shown = names.slice(0, MAX_NAMES_SHOWN);
  const remaining = totalOverdue - shown.length;
  let nameList = shown.join(", ");
  if (remaining > 0) {
    nameList += ` and ${remaining} other${remaining !== 1 ? "s" : ""}`;
  }

  const cta = tier === 1
    ? "Please follow up with your crew."
    : "Immediate follow-up required.";

  return `${header}\n${countLine}\n${nameList}\n${cta}`;
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
  const D1 = prevBusinessDay(todayStr);
  const D2 = twoBusinessDaysAgo(todayStr);

  const errors: string[] = [];
  const tier1: { overdueCount: number; sent: boolean; skippedReason?: string } = { overdueCount: 0, sent: false };
  const tier2: { overdueCount: number; sent: boolean; skippedReason?: string } = { overdueCount: 0, sent: false };

  // Fetch announcements for D1 and D2 (date column may be date or timestamptz; normalize to YYYY-MM-DD)
  const { data: announcements, error: annErr } = await supabase
    .from("announcements")
    .select("id, date")
    .in("date", [D1, D2]);
  if (annErr) {
    errors.push(`Announcements: ${annErr.message}`);
    return new Response(JSON.stringify({ tier1, tier2, errors }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const annByDate: Record<string, { id: string }> = {};
  (announcements ?? []).forEach((a: { id: string; date: string }) => {
    const d = String(a.date).slice(0, 10);
    annByDate[d] = { id: a.id };
  });

  // Overdue users per date (briefing-only, active only)
  async function getOverdueForDate(D: string): Promise<{ user_id: string; full_name: string | null }[]> {
    if (!annByDate[D]) return [];
    const { data: fieldUsers, error: uErr } = await supabase
      .from("app_users")
      .select("user_id, full_name")
      .in("role", FIELD_ROLES)
      .eq("status", "active");
    if (uErr || !fieldUsers?.length) return [];
    const { data: completed, error: cErr } = await supabase
      .from("safety_briefing_answers")
      .select("user_id")
      .eq("briefing_date", D);
    if (cErr) return [];
    const completedSet = new Set((completed ?? []).map((r: { user_id: string }) => r.user_id));
    return fieldUsers.filter((u: { user_id: string }) => !completedSet.has(u.user_id));
  }

  const overdueD1 = await getOverdueForDate(D1);
  const overdueD2 = await getOverdueForDate(D2);
  tier1.overdueCount = overdueD1.length;
  tier2.overdueCount = overdueD2.length;

  // Recipients by tier (is_active = true, order by sort_order)
  const { data: recipients } = await supabase
    .from("sms_escalation_recipients")
    .select("tier, phone_e164, sort_order")
    .eq("is_active", true)
    .in("tier", [1, 2])
    .order("sort_order", { ascending: true });
  const tier1Phones = (recipients ?? []).filter((r: { tier: number }) => r.tier === 1).map((r: { phone_e164: string }) => r.phone_e164);
  const tier2Phones = (recipients ?? []).filter((r: { tier: number }) => r.tier === 2).map((r: { phone_e164: string }) => r.phone_e164);

  // Idempotency: already sent for (tier, date_checked) today (Chicago)?
  function alreadySentToday(tier: number, dateChecked: string): Promise<boolean> {
    return supabase
      .from("sms_escalation_send_log")
      .select("sent_at")
      .eq("tier", tier)
      .eq("date_checked", dateChecked)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.sent_at) return false;
        const sentAtChicago = new Date(data.sent_at).toLocaleDateString("en-CA", { timeZone: TZ });
        return sentAtChicago === todayStr;
      });
  }
  const tier1AlreadySent = await alreadySentToday(1, D1);
  const tier2AlreadySent = await alreadySentToday(2, D2);

  if (overdueD1.length > 0 && tier1Phones.length > 0 && !tier1AlreadySent) {
    if (!CLICKSEND_USERNAME || !CLICKSEND_PASSWORD) {
      tier1.skippedReason = "ClickSend not configured";
    } else {
      const names = overdueD1.map((u) => abbreviateName(u.full_name));
      const body = buildSMSBody(names, overdueD1.length, 1, D1);
      const sendResult = await sendSMS(
        tier1Phones.map((to) => ({ to, body })),
        { username: CLICKSEND_USERNAME, password: CLICKSEND_PASSWORD, from: CLICKSEND_FROM_NUMBER }
      );
      tier1.sent = true;
      await supabase.from("sms_escalation_send_log").insert({
        tier: 1,
        date_checked: D1,
        overdue_count: overdueD1.length,
        recipient_count: tier1Phones.length,
        success: sendResult.success,
        error_message: sendResult.error ?? null,
        total_price: sendResult.totalPrice,
        results: sendResult.results ?? null,
      });
      if (sendResult.error) errors.push(`Tier1: ${sendResult.error}`);
    }
  } else {
    if (overdueD1.length === 0) tier1.skippedReason = "No overdue";
    else if (tier1Phones.length === 0) tier1.skippedReason = "No recipients";
    else if (tier1AlreadySent) tier1.skippedReason = "Already sent today";
  }

  if (overdueD2.length > 0 && tier2Phones.length > 0 && !tier2AlreadySent) {
    if (!CLICKSEND_USERNAME || !CLICKSEND_PASSWORD) {
      tier2.skippedReason = "ClickSend not configured";
    } else {
      const names = overdueD2.map((u) => abbreviateName(u.full_name));
      const body = buildSMSBody(names, overdueD2.length, 2, D2);
      const sendResult = await sendSMS(
        tier2Phones.map((to) => ({ to, body })),
        { username: CLICKSEND_USERNAME, password: CLICKSEND_PASSWORD, from: CLICKSEND_FROM_NUMBER }
      );
      tier2.sent = true;
      await supabase.from("sms_escalation_send_log").insert({
        tier: 2,
        date_checked: D2,
        overdue_count: overdueD2.length,
        recipient_count: tier2Phones.length,
        success: sendResult.success,
        error_message: sendResult.error ?? null,
        total_price: sendResult.totalPrice,
        results: sendResult.results ?? null,
      });
      if (sendResult.error) errors.push(`Tier2: ${sendResult.error}`);
    }
  } else {
    if (overdueD2.length === 0) tier2.skippedReason = "No overdue";
    else if (tier2Phones.length === 0) tier2.skippedReason = "No recipients";
    else if (tier2AlreadySent) tier2.skippedReason = "Already sent today";
  }

  return new Response(
    JSON.stringify({
      tier1: { ...tier1, dateChecked: D1 },
      tier2: { ...tier2, dateChecked: D2 },
      errors: errors.length ? errors : undefined,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
