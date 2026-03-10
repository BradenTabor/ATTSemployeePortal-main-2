// @ts-nocheck
/**
 * Safety Briefing Reminder Push (pre–Tier 0)
 *
 * Cron: 10:20 UTC Mon–Fri (5:20 AM CDT). Sends a push notification to active
 * field users who have not completed today's safety briefing. Runs 20 min
 * after the daily safety announcement (10:00 UTC); SMS runs at 10:40 UTC.
 *
 * Invoke with x-internal-key: INTERNAL_SECRET or Bearer: service role.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FIELD_ROLES = ["employee", "foreman", "general_foreman", "mechanic"];
const TZ = "America/Chicago";
const NEW_HIRE_DAYS = 5;
const PUSH_TITLE = "Daily safety briefing ready";
const PUSH_BODY = "Complete your briefing before 8 AM to claim reward points.";

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

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - NEW_HIRE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 19);

  const { data: absentRows } = await supabase
    .from("user_absences")
    .select("user_id")
    .eq("date", todayStr);
  const absentSet = new Set((absentRows ?? []).map((r: { user_id: string }) => r.user_id));

  const { data: fieldUsers, error: usersErr } = await supabase
    .from("app_users")
    .select("user_id, created_at")
    .in("role", FIELD_ROLES)
    .eq("status", "active")
    .not("email", "ilike", "%@atts.test");
  if (usersErr || !fieldUsers?.length) {
    return new Response(
      JSON.stringify({ pushed: 0, reason: "No field users or error", error: usersErr?.message }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: completed } = await supabase
    .from("safety_briefing_answers")
    .select("user_id")
    .eq("briefing_date", todayStr);
  const completedSet = new Set((completed ?? []).map((r: { user_id: string }) => r.user_id));

  const overdueUserIds: string[] = [];
  for (const u of fieldUsers as { user_id: string; created_at: string | null }[]) {
    if (completedSet.has(u.user_id)) continue;
    if (absentSet.has(u.user_id)) continue;
    if (u.created_at && u.created_at > cutoffStr) continue;
    overdueUserIds.push(u.user_id);
  }

  if (overdueUserIds.length === 0) {
    return new Response(
      JSON.stringify({ pushed: 0, reason: "No overdue users", date: todayStr }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  let pushed = 0;
  for (const userId of overdueUserIds) {
    const { data: ev, error: evErr } = await supabase
      .from("notification_events")
      .insert({
        category: "safety_alert",
        severity: "medium",
        target_type: "user",
        target_ref: userId,
        title: PUSH_TITLE,
        body: PUSH_BODY,
        url: "/announcements",
        entity_type: "announcement",
        entity_id: announcementsToday[0]?.id ?? null,
      })
      .select("id")
      .single();

    if (evErr || !ev) {
      console.warn("[safety-briefing-reminder-push] event insert failed:", evErr);
      continue;
    }

    const dispatchRes = await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-internal-key": INTERNAL_SECRET,
      },
      body: JSON.stringify({ event_id: ev.id }),
    });
    if (dispatchRes.ok) {
      const dr = await dispatchRes.json();
      if ((dr.dispatched ?? 0) > 0) pushed++;
    }
  }

  // Process outbox so pushes go out promptly
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notifications-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-internal-key": INTERNAL_SECRET,
      },
      body: JSON.stringify({}),
    });
  } catch (_) {}

  return new Response(
    JSON.stringify({ pushed, overdueCount: overdueUserIds.length, date: todayStr }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
