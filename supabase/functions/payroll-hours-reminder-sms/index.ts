// @ts-nocheck
/**
 * Payroll Hours Reminder SMS
 *
 * Thu–Sat 8:00 AM America/Chicago (dual UTC crons + wall-clock guard).
 * Escalating reminders to submit payroll hours before Saturday.
 *
 * Invoke: x-internal-key: INTERNAL_SECRET or Bearer service role.
 * Body: { "dryRun": true } | { "dryRun": false, "force_day": 1|2|3 }
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

const TZ = "America/Chicago";
const BATCH_SIZE = 500;
const MAX_FIRST_NAME_LEN = 40;
const MAX_SMS_LEN = 160;

const DOW_TO_TIER: Record<number, 1 | 2 | 3> = { 4: 1, 5: 2, 6: 3 };

const BODY_WITH_NAME: Record<1 | 2 | 3, string> = {
  1: "ATTS: Hi {name}, friendly reminder to submit your payroll hours before Saturday. Open the ATTS app, Forms, Payroll Form. Reply STOP to opt out.",
  2: "ATTS: Hi {name}, payroll hours are due tomorrow (Saturday). Please submit today via the ATTS app, Forms, Payroll Form. Reply STOP to opt out.",
  3: "ATTS: Hi {name}, today is the deadline for payroll hours. Please submit as soon as you can via the ATTS app, Forms, Payroll Form. Reply STOP to opt out.",
};

const BODY_NO_NAME: Record<1 | 2 | 3, string> = {
  1: "ATTS: Friendly reminder to submit payroll hours before Saturday. ATTS app, Forms, Payroll Form. Reply STOP to opt out.",
  2: "ATTS: Payroll hours are due tomorrow (Saturday). Submit today via ATTS app, Forms, Payroll Form. Reply STOP to opt out.",
  3: "ATTS: Today is the deadline for payroll hours. Submit via ATTS app, Forms, Payroll Form. Reply STOP to opt out.",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** First name from full_name — same as safety-briefing-reminder-sms */
function getFirstName(fullName: string | null | undefined): string | null {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0]?.trim() ?? null;
  if (!first) return null;
  return first.length > MAX_FIRST_NAME_LEN ? first.slice(0, MAX_FIRST_NAME_LEN) : first;
}

function toGsm7(body: string): string {
  return body.replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim();
}

function toE164(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim().replace(/\D/g, "");
  if (!raw || raw.length < 10) return null;
  return raw.startsWith("1") && raw.length === 11 ? `+${raw}` : `+1${raw}`;
}

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

function getChicagoDayOfWeekParts(): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  });
  const day = formatter.format(new Date());
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[day] ?? -1;
}

function isEightAmChicago(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  return hour === 8 && minute >= 0 && minute < 5;
}

function buildMessageForTier(
  tier: 1 | 2 | 3,
  firstName: string | null,
): { body: string | null; reason?: string } {
  const template = firstName
    ? BODY_WITH_NAME[tier].replace("{name}", firstName)
    : BODY_NO_NAME[tier];
  const gsm = toGsm7(template);
  if (gsm.length <= MAX_SMS_LEN && gsm === toGsm7(gsm)) {
    return { body: gsm };
  }
  if (firstName) {
    const fallback = toGsm7(BODY_NO_NAME[tier]);
    if (fallback.length <= MAX_SMS_LEN) {
      return { body: fallback };
    }
    return { body: null, reason: "message_too_long" };
  }
  return { body: null, reason: gsm.length > MAX_SMS_LEN ? "message_too_long" : "non_gsm7" };
}

Deno.serve(async (req: Request) => {
  const internalKey = req.headers.get("x-internal-key");
  const authHeader = req.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const allowed =
    (INTERNAL_SECRET && internalKey === INTERNAL_SECRET) ||
    (SUPABASE_SERVICE_ROLE_KEY && bearer === SUPABASE_SERVICE_ROLE_KEY);
  if (!allowed) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { dryRun?: boolean; force_day?: number } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text) as { dryRun?: boolean; force_day?: number };
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const dryRun = body.dryRun === true;
  const forceDayRaw = body.force_day;
  const hasForceDay =
    forceDayRaw === 1 || forceDayRaw === 2 || forceDayRaw === 3;
  const forceDay = hasForceDay ? (forceDayRaw as 1 | 2 | 3) : null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const todayStr = getChicagoToday();

  if (!forceDay && !isEightAmChicago()) {
    return json({ skipped: true, reason: "Not 8 AM Central", date: todayStr });
  }

  const { data: settingsRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "payroll_reminder_sms_config")
    .maybeSingle();
  const cfg = settingsRow?.value as Record<string, unknown> | null;
  if (cfg?.enabled === false) {
    return json({ skipped: true, reason: "Disabled by admin", date: todayStr });
  }

  let tier: 1 | 2 | 3;
  if (forceDay) {
    tier = forceDay;
  } else {
    const dow = getChicagoDayOfWeekParts();
    const mapped = DOW_TO_TIER[dow];
    if (!mapped) {
      return json({
        skipped: true,
        reason: "Not payroll reminder day",
        date: todayStr,
        dayOfWeek: dow,
      });
    }
    tier = mapped;
  }

  if (tier === 1 || tier === 2) {
    const { data: companyOff } = await supabase
      .from("company_calendar")
      .select("date")
      .eq("date", todayStr)
      .limit(1)
      .maybeSingle();
    if (companyOff) {
      return json({
        skipped: true,
        reason: "Company calendar",
        date: todayStr,
        tier,
      });
    }
  }

  const { data: userRows, error: usersErr } = await supabase
    .from("app_users")
    .select("user_id, phone_number, full_name, sms_operational_opt_out")
    .eq("status", "active")
    .not("email", "ilike", "%@atts.test")
    .not("phone_number", "is", null);

  if (usersErr) {
    return json({ error: "Failed to load users", details: usersErr.message }, 500);
  }

  let excludedInvalidPhone = 0;
  let excludedOperationalOptOut = 0;
  const skippedUsers: { user_id: string; reason: string }[] = [];
  const toSend: { user_id: string; to: string; body: string }[] = [];

  for (const row of userRows ?? []) {
    if (row.sms_operational_opt_out === true) {
      excludedOperationalOptOut++;
      continue;
    }
    const phoneRaw = row.phone_number != null ? String(row.phone_number).trim() : "";
    if (!phoneRaw) continue;
    const e164 = toE164(phoneRaw);
    if (!e164) {
      excludedInvalidPhone++;
      continue;
    }
    const firstName = getFirstName(row.full_name);
    const built = buildMessageForTier(tier, firstName);
    if (!built.body) {
      skippedUsers.push({
        user_id: row.user_id,
        reason: built.reason ?? "invalid_message",
      });
      continue;
    }
    toSend.push({ user_id: row.user_id, to: e164, body: built.body });
  }

  const sampleMessages = {
    tier1: buildMessageForTier(1, "Alex").body,
    tier2: buildMessageForTier(2, "Alex").body,
    tier3: buildMessageForTier(3, "Alex").body,
  };

  if (dryRun) {
    return json({
      dryRun: true,
      date: todayStr,
      tier,
      eligible_count: toSend.length,
      excluded_invalid_phone: excludedInvalidPhone,
      excluded_operational_opt_out: excludedOperationalOptOut,
      skipped_users_count: skippedUsers.length,
      sample_messages: sampleMessages,
      would_send_tier: tier,
    });
  }

  const { data: logId, error: claimErr } = await supabase.rpc(
    "claim_payroll_reminder_sms_log",
    { p_date_checked: todayStr, p_tier: tier },
  );

  if (claimErr) {
    return json({ error: "Failed to claim send slot", details: claimErr.message }, 500);
  }
  if (!logId) {
    return json({
      skipped: true,
      reason: "Already sent or in progress",
      date: todayStr,
      tier,
    });
  }

  if (toSend.length === 0) {
    await supabase
      .from("payroll_reminder_sms_log")
      .update({
        recipient_count: 0,
        success: true,
        error_message: null,
        total_price: 0,
        employee_user_ids: [],
        results: {
          batches: [],
          skipped_users: skippedUsers,
          excluded_invalid_phone: excludedInvalidPhone,
          excluded_operational_opt_out: excludedOperationalOptOut,
        },
      })
      .eq("id", logId);
    return json({
      sent: 0,
      success: true,
      date: todayStr,
      tier,
      reason: "No eligible recipients",
    });
  }

  if (!CLICKSEND_USERNAME || !CLICKSEND_PASSWORD) {
    await supabase
      .from("payroll_reminder_sms_log")
      .update({
        recipient_count: 0,
        success: false,
        error_message: "ClickSend not configured",
        total_price: 0,
        employee_user_ids: [],
        results: { error: "ClickSend not configured" },
      })
      .eq("id", logId);
    return json({ error: "ClickSend not configured", eligibleCount: toSend.length }, 500);
  }

  const batches: {
    index: number;
    sent: number;
    failed: number;
    error?: string;
  }[] = [];
  let totalSent = 0;
  let totalFailed = 0;
  let totalPrice = 0;
  const allResults: unknown[] = [];

  for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
    const chunk = toSend.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    try {
      const messages = chunk.map((m) => ({
        to: m.to,
        body: m.body,
        source: "atts-payroll",
      }));
      const result = await sendSMS(messages, {
        username: CLICKSEND_USERNAME,
        password: CLICKSEND_PASSWORD,
        from: CLICKSEND_FROM_NUMBER,
      });
      const sent =
        result.results?.filter((r) => r.status === "SUCCESS" || r.status === "THROTTLED")
          .length ?? 0;
      const failed = (result.results?.length ?? 0) - sent;
      totalSent += sent;
      totalFailed += failed;
      totalPrice += result.totalPrice ?? 0;
      if (result.results) allResults.push(...result.results);
      batches.push({
        index: batchIndex,
        sent,
        failed,
        error: result.error,
      });
    } catch (e) {
      const errMsg = (e as Error).message;
      batches.push({
        index: batchIndex,
        sent: 0,
        failed: chunk.length,
        error: errMsg,
      });
      totalFailed += chunk.length;
    }
  }

  const success = totalFailed === 0 && totalSent > 0;
  const employeeUserIds = toSend.map((m) => m.user_id);

  await supabase
    .from("payroll_reminder_sms_log")
    .update({
      recipient_count: totalSent,
      success,
      error_message: success ? null : "Some batches failed or zero sent",
      total_price: totalPrice,
      employee_user_ids: employeeUserIds,
      results: {
        batches,
        skipped_users: skippedUsers,
        excluded_invalid_phone: excludedInvalidPhone,
        excluded_operational_opt_out: excludedOperationalOptOut,
        clicksend_results: allResults,
      },
    })
    .eq("id", logId);

  return json({
    sent: totalSent,
    failed: totalFailed,
    success,
    date: todayStr,
    tier,
    totalPrice,
    logId,
    batches,
  });
});
