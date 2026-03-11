// @ts-nocheck
/**
 * Safety Briefing Escalation SMS
 *
 * Cron: 16:00 UTC Mon–Fri (10 AM CST / 11 AM CDT). Sends SMS when active field
 * users have not completed the daily safety briefing (briefing-only; no reward check).
 *
 * ESCALATION_MODE (env): "single_day" (default) or "legacy".
 * - single_day: Notifies only for users who missed **today's** briefing (run date).
 *   Cutoff is 10 AM CST same-day; message body is e.g. "X of Y did not complete the Mar 9 briefing: [names]."
 * - legacy: Previous D1/D2 behavior (yesterday + two days ago, with "missed D2 but completed D1" etc.).
 *
 * Tier 1 = per-manager SMS (dynamic via manager_id); orphans (no manager or no manager phone) → tier 2.
 * Tier 2 = static recipients from sms_escalation_recipients (tier = 2).
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

const DEFAULT_FIELD_ROLES = ["employee", "foreman", "general_foreman", "mechanic"];
const TZ = "America/Chicago";
const MAX_NAMES_SHOWN = 10;
const MAX_LOOKBACK_DAYS = 5;
const NEW_HIRE_DAYS = 5;

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

/** Calendar days between dateStr and todayStr (both YYYY-MM-DD). */
function calendarDaysAgo(dateStr: string, todayStr: string): number {
  const d = new Date(dateStr + "T12:00:00.000Z");
  const t = new Date(todayStr + "T12:00:00.000Z");
  return Math.round((t.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
}

/** Previous business day: walk back skipping weekends and dates in calendarSet. */
function prevBusinessDayCalendarAware(dateStr: string, calendarSet: Set<string>): string {
  let d = new Date(dateStr + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || calendarSet.has(d.toISOString().slice(0, 10))) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

/** Two business days ago (skip weekends and company_calendar). */
function twoBusinessDaysAgoCalendarAware(dateStr: string, calendarSet: Set<string>): string {
  let d = new Date(dateStr + "T12:00:00.000Z");
  for (let i = 0; i < 2; i++) {
    d.setUTCDate(d.getUTCDate() - 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || calendarSet.has(d.toISOString().slice(0, 10))) {
      d.setUTCDate(d.getUTCDate() - 1);
    }
  }
  return d.toISOString().slice(0, 10);
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

/** Monday of the current week (Chicago calendar date). Noon-UTC anchor avoids
 *  DST spring-forward edge cases — we only need weekday math on a date string. */
function getCurrentWeekMonday(todayStr: string): string {
  const d = new Date(todayStr + "T12:00:00.000Z");
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
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

/** Normalize phone to E.164 (US: +1...) for ClickSend. Returns null for malformed or non-numeric values (e.g. "call main office"); callers treat null as "no valid phone" and route to orphan handling — we never attempt send and let ClickSend fail. */
function toE164(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim().replace(/\D/g, "");
  if (!raw || raw.length < 10) return null;
  return raw.startsWith("1") && raw.length === 11 ? `+${raw}` : `+1${raw}`;
}

/** Build SMS body with compliance ratio, missed-briefing phrasing, and STOP opt-out. */
function buildSMSBody(names: string[], totalOverdue: number, totalUsers: number, tier: 1 | 2, dateStr: string): string {
  const dateLabel = formatDateLabel(dateStr);
  const scope = tier === 1 ? "crew members" : "employees";
  const ratio = `${totalOverdue} of ${totalUsers} ${scope}`;
  const countLine = `${ratio} did not complete the ${dateLabel} briefing:`;

  const shown = names.slice(0, MAX_NAMES_SHOWN);
  const remaining = totalOverdue - shown.length;
  let nameList = shown.join(", ");
  if (remaining > 0) {
    nameList += ` +${remaining} more`;
  }

  const cta = tier === 1
    ? "Please follow up with each employee today."
    : "Immediate follow-up required.";

  return `ATTS Safety Briefing\n${countLine}\n${nameList}\n${cta}\nReply STOP to opt out.`;
}

/** Tier 2 body for single-day mode: one overdue list for today; optional line clarifying who has no supervisor (subset). */
function buildTier2BodySingleDay(
  overdueNames: string[],
  overdueCount: number,
  totalFieldUsers: number,
  orphanNames: string[],
  orphanCount: number,
  dateStr: string
): string {
  const dateLabel = formatDateLabel(dateStr);
  const shown = overdueNames.slice(0, MAX_NAMES_SHOWN);
  const nameList =
    overdueCount > MAX_NAMES_SHOWN
      ? shown.join(", ") + ` +${overdueCount - MAX_NAMES_SHOWN} more`
      : shown.join(", ");
  const parts: string[] = [
    "ATTS Safety Briefing",
    `${overdueCount} of ${totalFieldUsers} employees did not complete the ${dateLabel} briefing:`,
    nameList,
  ];
  if (orphanCount > 0) {
    const orphanList = orphanNames.slice(0, MAX_NAMES_SHOWN).join(", ") +
      (orphanCount > MAX_NAMES_SHOWN ? ` +${orphanCount - MAX_NAMES_SHOWN} more` : "");
    parts.push(`Of these, ${orphanCount} ${orphanCount === 1 ? "has" : "have"} no supervisor assigned: ${orphanList}.`);
  }
  parts.push("Immediate follow-up required.");
  parts.push("Reply STOP to opt out.");
  return parts.join("\n");
}

/** D2 section (legacy only): "missed D2 but completed D1" vs "Missed D2 and D1". */
function buildTier2D2Section(
  caughtUpNames: string[],
  caughtUpCount: number,
  stillBehindNames: string[],
  stillBehindCount: number,
  d2DateStr: string,
  d1DateStr: string,
  totalFieldUsers: number
): string {
  const d2Label = formatDateLabel(d2DateStr);
  const d1Label = formatDateLabel(d1DateStr);
  const parts: string[] = [];
  if (caughtUpCount > 0 && stillBehindCount === 0) {
    const shown = caughtUpNames.slice(0, MAX_NAMES_SHOWN);
    const rem = caughtUpCount - shown.length;
    parts.push(`${caughtUpCount} missed ${d2Label} but completed ${d1Label}: ${shown.join(", ")}${rem > 0 ? ` +${rem} more` : ""}.`);
  } else if (stillBehindCount > 0 && caughtUpCount === 0) {
    parts.push(`Missed ${d2Label} briefing: ${stillBehindCount} of ${totalFieldUsers} employees:`);
    const shown = stillBehindNames.slice(0, MAX_NAMES_SHOWN);
    const rem = stillBehindCount - shown.length;
    parts.push(shown.join(", ") + (rem > 0 ? ` +${rem} more` : ""));
  } else if (caughtUpCount > 0 && stillBehindCount > 0) {
    // "Also missed" depends on the caught-up line above providing context; keep these two lines together.
    parts.push(`${caughtUpCount} missed ${d2Label} but completed ${d1Label}.`);
    parts.push(`Also missed ${d2Label}: ${stillBehindNames.slice(0, MAX_NAMES_SHOWN).join(", ")}${stillBehindCount > MAX_NAMES_SHOWN ? ` +${stillBehindCount - MAX_NAMES_SHOWN} more` : ""}`);
  }
  return parts.join("\n");
}

/** Full Tier 2 body: header + pre-built D2 section (if any) + optional orphan block + CTA + STOP. */
function buildTier2BodyWithD2Section(
  d2Section: string,
  orphanNames: string[],
  orphanCount: number,
  d1DateStr: string
): string {
  const d1Label = formatDateLabel(d1DateStr);
  const parts: string[] = d2Section ? ["ATTS Safety Briefing", d2Section] : ["ATTS Safety Briefing"];
  if (orphanCount > 0) {
    parts.push(`Missed ${d1Label} (no supervisor): ${orphanCount} employee${orphanCount !== 1 ? "s" : ""}:`);
    const oShown = orphanNames.slice(0, MAX_NAMES_SHOWN);
    const oRem = orphanCount - oShown.length;
    parts.push(oShown.join(", ") + (oRem > 0 ? ` +${oRem} more` : ""));
  }
  parts.push("Immediate follow-up required.");
  parts.push("Reply STOP to opt out.");
  return parts.join("\n");
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

  let dryRun = req.headers.get("x-dry-run")?.toLowerCase() === "true";
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.dryRun === "boolean") dryRun = body.dryRun;
  } catch {
    // leave dryRun as-is
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Read briefing settings from app_settings (single read per invocation)
  let FIELD_ROLES = DEFAULT_FIELD_ROLES;
  {
    const { data: settingsRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "safety_briefing_config")
      .maybeSingle();
    const cfg = settingsRow?.value as Record<string, unknown> | null;
    if (cfg?.enabled === false && !dryRun) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Briefing disabled by admin" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (Array.isArray(cfg?.required_roles) && cfg.required_roles.length > 0) {
      FIELD_ROLES = cfg.required_roles as string[];
    }
  }

  const todayStr = getChicagoToday();
  const escMode = Deno.env.get("ESCALATION_MODE") ?? "single_day";

  if (escMode === "legacy") {
  // --- Legacy path: D1/D2, week reset, lookback, Tier 2 D2 section ---
  // Fetch company_calendar only for the bounded window needed for D1/D2 (35 days back); unbounded would add latency as table grows.
  const rangeStart = new Date(todayStr + "T12:00:00.000Z");
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 35);
  const rangeStartStr = rangeStart.toISOString().slice(0, 10);
  const { data: calendarRows } = await supabase
    .from("company_calendar")
    .select("date")
    .gte("date", rangeStartStr)
    .lte("date", todayStr);
  const calendarSet = new Set<string>((calendarRows ?? []).map((r: { date: string }) => String(r.date).slice(0, 10)));

  const D1 = prevBusinessDayCalendarAware(todayStr, calendarSet);
  const D2 = twoBusinessDaysAgoCalendarAware(todayStr, calendarSet);

  // Weekly reset: do not carry over escalation from previous week (resets each Monday)
  const weekMonday = getCurrentWeekMonday(todayStr);
  const skipTier1WeekReset = D1 < weekMonday;
  const skipTier2WeekReset = D2 < weekMonday;

  // Max lookback: skip tier if date is more than 5 calendar days ago
  const d1DaysAgo = calendarDaysAgo(D1, todayStr);
  const d2DaysAgo = calendarDaysAgo(D2, todayStr);
  const skipTier1Lookback = d1DaysAgo > MAX_LOOKBACK_DAYS;
  const skipTier2Lookback = d2DaysAgo > MAX_LOOKBACK_DAYS;

  // Defensive: do not escalate for a date that is in company_calendar (safety net)
  const skipTier1Calendar = calendarSet.has(D1);
  const skipTier2Calendar = calendarSet.has(D2);

  const errors: string[] = [];
  const tier1: { overdueCount: number; sent: boolean; skippedReason?: string; dateChecked?: string; dryRunWouldSend?: boolean; totalPrice?: number } = { overdueCount: 0, sent: false };
  const tier2: { overdueCount: number; sent: boolean; skippedReason?: string; dateChecked?: string; dryRunWouldSend?: boolean; totalPrice?: number } = { overdueCount: 0, sent: false };

  // Fetch announcements for D1 and D2 (normalize to YYYY-MM-DD)
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

  // User absences for D1 and D2. Dates are compared as plain date; D1/D2 are computed in America/Chicago — document that user_absences.date is the same canonical (Chicago) calendar date so there is no off-by-one.
  const { data: absenceRows } = await supabase
    .from("user_absences")
    .select("user_id, date")
    .in("date", [D1, D2]);
  const absentByDate: Record<string, Set<string>> = { [D1]: new Set(), [D2]: new Set() };
  (absenceRows ?? []).forEach((r: { user_id: string; date: string }) => {
    const d = String(r.date).slice(0, 10);
    if (absentByDate[d]) absentByDate[d].add(r.user_id);
  });

  type OverdueRow = { user_id: string; full_name: string | null; manager_id: string | null };

  // Fetch all active field users once (shared for D1/D2 checks), excluding new hires (< 5 calendar days)
  const newHireCutoff = new Date();
  newHireCutoff.setDate(newHireCutoff.getDate() - NEW_HIRE_DAYS);
  const newHireCutoffStr = newHireCutoff.toISOString().slice(0, 19);

  const { data: allFieldUsers, error: fuErr } = await supabase
    .from("app_users")
    .select("user_id, full_name, manager_id, created_at")
    .in("role", FIELD_ROLES)
    .eq("status", "active")
    .not("email", "ilike", "%@atts.test");
  if (fuErr || !allFieldUsers?.length) {
    return new Response(JSON.stringify({ tier1, tier2, errors: ["Failed to fetch field users: " + (fuErr?.message ?? "none found")] }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }
  const fieldUsers = allFieldUsers.filter(
    (u: { created_at: string | null }) => !u.created_at || u.created_at <= newHireCutoffStr
  ) as OverdueRow[];
  const totalFieldUsers = fieldUsers.length;

  // Per-manager crew counts (for tier 1 denominator: "3 of 8 crew members")
  const managerCrewCount: Record<string, number> = {};
  for (const u of fieldUsers) {
    if (u.manager_id) {
      managerCrewCount[u.manager_id] = (managerCrewCount[u.manager_id] ?? 0) + 1;
    }
  }

  interface OverdueResult {
    beforeCount: number;
    after: OverdueRow[];
    completedSetSize: number;
    announcementIdOnlyCount: number;
    /** User IDs who completed this date. Only the D1 result's is used downstream (to partition D2-overdue into current-on-D1 vs still-behind). */
    completedUserIds: string[];
  }
  const emptyResult: OverdueResult = { beforeCount: 0, after: [], completedSetSize: 0, announcementIdOnlyCount: 0, completedUserIds: [] };

  async function getOverdueForDate(
    D: string,
    absentSet: Set<string>
  ): Promise<OverdueResult> {
    if (calendarSet.has(D)) return emptyResult;
    if (!annByDate[D]) return emptyResult;
    if (!fieldUsers.length) return emptyResult;
    const announcementId = annByDate[D].id;
    // Cross-reference: match completions by briefing_date OR announcement_id
    const { data: completed, error: cErr } = await supabase
      .from("safety_briefing_answers")
      .select("user_id, briefing_date")
      .or(`briefing_date.eq.${D},announcement_id.eq.${announcementId}`);
    if (cErr) return emptyResult;
    const completedSet = new Set((completed ?? []).map((r: { user_id: string }) => r.user_id));
    const completedSetSize = completedSet.size;
    // Count completions matched ONLY by announcement_id (not by briefing_date) — measures how often the original bug would have caused false positives
    const announcementIdOnlyCount = (completed ?? []).filter(
      (r: { user_id: string; briefing_date: string }) => String(r.briefing_date).slice(0, 10) !== D
    ).length;
    const notCompleted = fieldUsers.filter((u) => !completedSet.has(u.user_id));
    const beforeCount = notCompleted.length;
    const after = notCompleted.filter((u) => !absentSet.has(u.user_id));
    return { beforeCount, after, completedSetSize, announcementIdOnlyCount, completedUserIds: [...completedSet] };
  }

  const resultD1 = await getOverdueForDate(D1, absentByDate[D1]);
  const resultD2 = await getOverdueForDate(D2, absentByDate[D2]);
  const { beforeCount: beforeD1, after: overdueD1Raw, completedSetSize: completedD1, announcementIdOnlyCount: annIdOnlyD1, completedUserIds: completedUserIdsD1 } = resultD1;
  const { beforeCount: beforeD2, after: overdueD2Raw, completedSetSize: completedD2, announcementIdOnlyCount: annIdOnlyD2 } = resultD2;

  // Partition D2-overdue: current on most recent day (completed D1) vs still behind (did not complete D1). Only D1's completedUserIds is used here.
  const completedD1UserIds = new Set(completedUserIdsD1);
  const overdueD2CaughtUp = overdueD2Raw.filter((u) => completedD1UserIds.has(u.user_id));
  const overdueD2StillBehind = overdueD2Raw.filter((u) => !completedD1UserIds.has(u.user_id));

  const suppressionLogTier1: Record<string, unknown> = {};
  const suppressionLogTier2: Record<string, unknown> = {};
  if (skipTier1Calendar) suppressionLogTier1.dates_skipped_calendar = [D1];
  if (skipTier2Calendar) suppressionLogTier2.dates_skipped_calendar = [D2];
  suppressionLogTier1.users_excluded_absences = absentByDate[D1].size;
  suppressionLogTier2.users_excluded_absences = absentByDate[D2].size;
  suppressionLogTier1.overdue_before = beforeD1;
  suppressionLogTier1.overdue_after = overdueD1Raw.length;
  suppressionLogTier2.overdue_before = beforeD2;
  suppressionLogTier2.overdue_after = overdueD2Raw.length;
  suppressionLogTier1.D1 = D1;
  suppressionLogTier1.announcement_id = annByDate[D1]?.id ?? null;
  suppressionLogTier1.completed_set_size = completedD1;
  suppressionLogTier1.field_users_count = totalFieldUsers;
  suppressionLogTier1.completions_matched_by_announcement_id_only = annIdOnlyD1;
  suppressionLogTier2.D2 = D2;
  suppressionLogTier2.announcement_id = annByDate[D2]?.id ?? null;
  suppressionLogTier2.completed_set_size = completedD2;
  suppressionLogTier2.field_users_count = totalFieldUsers;
  suppressionLogTier2.completions_matched_by_announcement_id_only = annIdOnlyD2;
  suppressionLogTier2.d2_caught_up_count = overdueD2CaughtUp.length;
  suppressionLogTier2.d2_still_behind_count = overdueD2StillBehind.length;

  // Tier 1: dynamic per-manager; orphans (no manager or no manager phone) → tier 2 and log
  const managerIds = [...new Set(overdueD1Raw.map((u) => u.manager_id).filter(Boolean))] as string[];
  let managerPhoneMap: Record<string, string> = {};
  if (managerIds.length > 0) {
    const { data: managers } = await supabase
      .from("app_users")
      .select("id, phone_number")
      .in("id", managerIds);
    (managers ?? []).forEach((m: { id: string; phone_number: string | null }) => {
      const e164 = toE164(m.phone_number);
      if (e164) managerPhoneMap[m.id] = e164;
    });
  }

  const orphaned: { user_id: string; full_name: string | null; reason: string }[] = [];
  const byManager: Record<string, OverdueRow[]> = {};
  for (const u of overdueD1Raw) {
    if (!u.manager_id) {
      orphaned.push({ user_id: u.user_id, full_name: u.full_name, reason: "no manager" });
      continue;
    }
    const phone = managerPhoneMap[u.manager_id];
    if (!phone) {
      orphaned.push({ user_id: u.user_id, full_name: u.full_name, reason: "no manager phone" });
      continue;
    }
    if (!byManager[u.manager_id]) byManager[u.manager_id] = [];
    byManager[u.manager_id].push(u);
  }

  const overdueD1 = overdueD1Raw.length;
  const overdueD2 = overdueD2Raw.length;
  tier1.overdueCount = overdueD1;
  tier2.overdueCount = overdueD2;

  const tier2CombinedCount = overdueD2Raw.length + orphaned.length;
  const tier2NamesOrphans = orphaned.map((u) => abbreviateName(u.full_name));
  const d2CaughtUpNames = overdueD2CaughtUp.map((u) => abbreviateName(u.full_name));
  const d2StillBehindNames = overdueD2StillBehind.map((u) => abbreviateName(u.full_name));
  const d2Section = buildTier2D2Section(
    d2CaughtUpNames,
    overdueD2CaughtUp.length,
    d2StillBehindNames,
    overdueD2StillBehind.length,
    D2,
    D1,
    totalFieldUsers
  );

  // Tier 2 static recipients only (tier 1 uses dynamic manager phones)
  const { data: recipients } = await supabase
    .from("sms_escalation_recipients")
    .select("tier, phone_e164, sort_order")
    .eq("is_active", true)
    .eq("tier", 2)
    .order("sort_order", { ascending: true });
  const tier2Phones = (recipients ?? []).map((r: { phone_e164: string }) => r.phone_e164);

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

  // --- Tier 1: send per-manager (and optionally one log row with orphaned_user_ids) ---
  const skipTier1 = skipTier1Lookback || skipTier1Calendar || skipTier1WeekReset || overdueD1 === 0;
  if (!skipTier1 && !tier1AlreadySent) {
    const managerEntries = Object.entries(byManager);
    if (managerEntries.length > 0 && (CLICKSEND_USERNAME && CLICKSEND_PASSWORD) && !dryRun) {
      const messages: { to: string; body: string }[] = [];
      for (const [_managerId, users] of managerEntries) {
        const names = users.map((u) => abbreviateName(u.full_name));
        const crewTotal = managerCrewCount[_managerId] ?? users.length;
        const body = buildSMSBody(names, users.length, crewTotal, 1, D1);
        const phone = managerPhoneMap[_managerId];
        if (phone) messages.push({ to: phone, body });
      }
      if (messages.length > 0) {
        const sendResult = await sendSMS(
          messages.map((m) => ({ to: m.to, body: m.body })),
          { username: CLICKSEND_USERNAME, password: CLICKSEND_PASSWORD, from: CLICKSEND_FROM_NUMBER }
        );
        tier1.sent = true;
        tier1.totalPrice = sendResult.totalPrice ?? 0;
        await supabase.from("sms_escalation_send_log").insert({
          tier: 1,
          date_checked: D1,
          overdue_count: overdueD1,
          recipient_count: messages.length,
          success: sendResult.success,
          error_message: sendResult.error ?? null,
          total_price: sendResult.totalPrice,
          results: sendResult.results ?? null,
          employee_user_ids: overdueD1Raw.map((u) => u.user_id),
          orphaned_user_ids: orphaned.map((o) => ({ user_id: o.user_id, reason: o.reason })),
          suppression_log: suppressionLogTier1,
        });
        if (sendResult.error) errors.push(`Tier1: ${sendResult.error}`);
      }
    } else if (managerEntries.length > 0 && !dryRun) {
      tier1.skippedReason = "ClickSend not configured";
    }
    if (dryRun && managerEntries.length > 0) tier1.dryRunWouldSend = true;
  } else {
    if (skipTier1Lookback) tier1.skippedReason = "Max lookback exceeded";
    else if (skipTier1Calendar) tier1.skippedReason = "Date in company_calendar";
    else if (skipTier1WeekReset) tier1.skippedReason = "Week reset (D1 before this Monday)";
    else if (overdueD1 === 0) tier1.skippedReason = "No overdue";
    else if (tier1AlreadySent) tier1.skippedReason = "Already sent today";
    // Zero-overdue audit log: insert so Slack/admin can distinguish "ran, nobody overdue" from "cron failed"
    if (overdueD1 === 0 && !tier1AlreadySent) {
      await supabase.from("sms_escalation_send_log").insert({
        tier: 1,
        date_checked: D1,
        overdue_count: 0,
        recipient_count: 0,
        success: true,
        error_message: null,
        total_price: 0,
        results: null,
        employee_user_ids: [],
        orphaned_user_ids: [],
        suppression_log: suppressionLogTier1,
      });
    }
  }
  tier1.dateChecked = D1;

  // --- Tier 2: static recipients; include D2 overdue + D1 orphans (routed to tier 2), allow overlap ---
  const skipTier2 = skipTier2Lookback || skipTier2Calendar || skipTier2WeekReset || tier2CombinedCount === 0 || tier2Phones.length === 0 || tier2AlreadySent;
  if (!skipTier2 && tier2Phones.length > 0 && (CLICKSEND_USERNAME && CLICKSEND_PASSWORD) && !dryRun) {
    const body =
      orphaned.length > 0
        ? buildTier2BodyWithD2Section(d2Section, tier2NamesOrphans, orphaned.length, D1)
        : `ATTS Safety Briefing\n${d2Section}\nImmediate follow-up required.\nReply STOP to opt out.`;
    const sendResult = await sendSMS(
      tier2Phones.map((to) => ({ to, body })),
      { username: CLICKSEND_USERNAME, password: CLICKSEND_PASSWORD, from: CLICKSEND_FROM_NUMBER }
    );
    tier2.sent = true;
    tier2.totalPrice = sendResult.totalPrice ?? 0;
    await supabase.from("sms_escalation_send_log").insert({
      tier: 2,
      date_checked: D2,
      overdue_count: tier2CombinedCount,
      recipient_count: tier2Phones.length,
      success: sendResult.success,
      error_message: sendResult.error ?? null,
      total_price: sendResult.totalPrice,
      results: sendResult.results ?? null,
      employee_user_ids: [...overdueD2Raw.map((u) => u.user_id), ...orphaned.map((o) => o.user_id)],
      orphaned_user_ids: orphaned.length > 0 ? orphaned.map((o) => ({ user_id: o.user_id, reason: o.reason })) : [],
      suppression_log: suppressionLogTier2,
    });
    if (sendResult.error) errors.push(`Tier2: ${sendResult.error}`);
  } else {
    if (skipTier2Lookback) tier2.skippedReason = "Max lookback exceeded";
    else if (skipTier2Calendar) tier2.skippedReason = "Date in company_calendar";
    else if (skipTier2WeekReset) tier2.skippedReason = "Week reset (D2 before this Monday)";
    else if (tier2CombinedCount === 0) tier2.skippedReason = "No overdue";
    else if (tier2Phones.length === 0) tier2.skippedReason = "No recipients";
    else if (tier2AlreadySent) tier2.skippedReason = "Already sent today";
    else if (dryRun && tier2Phones.length > 0 && tier2CombinedCount > 0) tier2.dryRunWouldSend = true;
    else if (!CLICKSEND_USERNAME || !CLICKSEND_PASSWORD) tier2.skippedReason = "ClickSend not configured";
    // Zero-overdue audit log
    if (tier2CombinedCount === 0 && !tier2AlreadySent) {
      await supabase.from("sms_escalation_send_log").insert({
        tier: 2,
        date_checked: D2,
        overdue_count: 0,
        recipient_count: 0,
        success: true,
        error_message: null,
        total_price: 0,
        results: null,
        employee_user_ids: [],
        orphaned_user_ids: [],
        suppression_log: suppressionLogTier2,
      });
    }
  }
  tier2.dateChecked = D2;

  // Verbose console log for first-week verification (suppression behavior)
  console.log("[safety-briefing-escalation-sms]", {
    todayStr,
    D1,
    D2,
    weekMonday,
    totalFieldUsers,
    calendarSetSize: calendarSet.size,
    skipTier1Lookback,
    skipTier2Lookback,
    skipTier1Calendar,
    skipTier2Calendar,
    skipTier1WeekReset,
    skipTier2WeekReset,
    overdueD1,
    overdueD2,
    completedD1,
    completedD2,
    annIdOnlyD1,
    annIdOnlyD2,
    tier2CombinedCount,
    d2CaughtUp: overdueD2CaughtUp.length,
    d2StillBehind: overdueD2StillBehind.length,
    orphanedCount: orphaned.length,
    suppressionLogTier1,
    suppressionLogTier2,
  });

  const payload: Record<string, unknown> = {
    tier1: { ...tier1 },
    tier2: { ...tier2 },
    errors: errors.length ? errors : undefined,
  };
  if (dryRun) {
    payload.dryRun = true;
    payload.totalFieldUsers = totalFieldUsers;
    payload.weekMonday = weekMonday;
    payload.weekResetApplied = { tier1: skipTier1WeekReset, tier2: skipTier2WeekReset };
    payload.suppressionLog = {
      tier1: suppressionLogTier1,
      tier2: suppressionLogTier2,
    };
    payload.verificationHint = "Confirm: overdue_before - overdue_after = users_excluded_absences. completions_matched_by_announcement_id_only > 0 means the cross-reference fix rescued late completions that the old briefing_date-only query would have missed.";
  }

  return new Response(
    JSON.stringify(payload),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
  }

  // --- Single-day path: only today's briefing; date_checked = todayStr for both tiers ---
  const calendarRowsSingle = await supabase
    .from("company_calendar")
    .select("date")
    .eq("date", todayStr);
  const calendarSetSingle = new Set<string>((calendarRowsSingle.data ?? []).map((r: { date: string }) => String(r.date).slice(0, 10)));
  const skipCalendar = calendarSetSingle.has(todayStr);

  const { data: annToday, error: annErrSingle } = await supabase
    .from("announcements")
    .select("id, date")
    .eq("date", todayStr)
    .maybeSingle();
  if (annErrSingle || !annToday) {
    const payloadSkip = {
      tier1: { overdueCount: 0, sent: false, skippedReason: "No announcement for today", dateChecked: todayStr },
      tier2: { overdueCount: 0, sent: false, skippedReason: "No announcement for today", dateChecked: todayStr },
      errors: annErrSingle ? [annErrSingle.message] : undefined,
    };
    return new Response(JSON.stringify(payloadSkip), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const annByDateSingle: Record<string, { id: string }> = { [todayStr]: { id: annToday.id } };

  const { data: absenceRowsSingle } = await supabase
    .from("user_absences")
    .select("user_id, date")
    .eq("date", todayStr);
  const absentToday = new Set<string>((absenceRowsSingle ?? []).map((r: { user_id: string }) => r.user_id));

  type OverdueRowSingle = { user_id: string; full_name: string | null; manager_id: string | null };
  const newHireCutoffSingle = new Date();
  newHireCutoffSingle.setDate(newHireCutoffSingle.getDate() - NEW_HIRE_DAYS);
  const newHireCutoffStrSingle = newHireCutoffSingle.toISOString().slice(0, 19);

  const { data: allFieldUsersSingle, error: fuErrSingle } = await supabase
    .from("app_users")
    .select("user_id, full_name, manager_id, created_at")
    .in("role", FIELD_ROLES)
    .eq("status", "active")
    .not("email", "ilike", "%@atts.test");
  if (fuErrSingle || !allFieldUsersSingle?.length) {
    const payloadErr = {
      tier1: { overdueCount: 0, sent: false, dateChecked: todayStr },
      tier2: { overdueCount: 0, sent: false, dateChecked: todayStr },
      errors: ["Failed to fetch field users: " + (fuErrSingle?.message ?? "none found")],
    };
    return new Response(JSON.stringify(payloadErr), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const fieldUsersSingle = allFieldUsersSingle.filter(
    (u: { created_at: string | null }) => !u.created_at || u.created_at <= newHireCutoffStrSingle
  ) as OverdueRowSingle[];
  const totalFieldUsersSingle = fieldUsersSingle.length;

  const managerCrewCountSingle: Record<string, number> = {};
  for (const u of fieldUsersSingle) {
    if (u.manager_id) managerCrewCountSingle[u.manager_id] = (managerCrewCountSingle[u.manager_id] ?? 0) + 1;
  }

  const announcementIdSingle = annByDateSingle[todayStr].id;
  const { data: completedSingle, error: cErrSingle } = await supabase
    .from("safety_briefing_answers")
    .select("user_id, briefing_date")
    .or(`briefing_date.eq.${todayStr},announcement_id.eq.${announcementIdSingle}`);
  const completedSetSingle = new Set((completedSingle ?? []).map((r: { user_id: string }) => r.user_id));
  const overdueTodayRaw = fieldUsersSingle
    .filter((u) => !completedSetSingle.has(u.user_id))
    .filter((u) => !absentToday.has(u.user_id));

  const errorsSingle: string[] = [];
  const tier1Single: { overdueCount: number; sent: boolean; skippedReason?: string; dateChecked?: string; dryRunWouldSend?: boolean; totalPrice?: number } = { overdueCount: 0, sent: false };
  const tier2Single: { overdueCount: number; sent: boolean; skippedReason?: string; dateChecked?: string; dryRunWouldSend?: boolean; totalPrice?: number } = { overdueCount: 0, sent: false };

  const suppressionLogTier1Single: Record<string, unknown> = {
    date_checked: todayStr,
    users_excluded_absences: absentToday.size,
    overdue_before: fieldUsersSingle.length - completedSetSingle.size,
    overdue_after: overdueTodayRaw.length,
    announcement_id: announcementIdSingle,
    completed_set_size: completedSetSingle.size,
    field_users_count: totalFieldUsersSingle,
  };
  const suppressionLogTier2Single: Record<string, unknown> = { ...suppressionLogTier1Single };

  if (skipCalendar) {
    suppressionLogTier1Single.dates_skipped_calendar = [todayStr];
    suppressionLogTier2Single.dates_skipped_calendar = [todayStr];
  }

  const managerIdsSingle = [...new Set(overdueTodayRaw.map((u) => u.manager_id).filter(Boolean))] as string[];
  let managerPhoneMapSingle: Record<string, string> = {};
  if (managerIdsSingle.length > 0) {
    const { data: managersSingle } = await supabase.from("app_users").select("id, phone_number").in("id", managerIdsSingle);
    (managersSingle ?? []).forEach((m: { id: string; phone_number: string | null }) => {
      const e164 = toE164(m.phone_number);
      if (e164) managerPhoneMapSingle[m.id] = e164;
    });
  }

  const orphanedSingle: { user_id: string; full_name: string | null; reason: string }[] = [];
  const byManagerSingle: Record<string, OverdueRowSingle[]> = {};
  for (const u of overdueTodayRaw) {
    if (!u.manager_id) {
      orphanedSingle.push({ user_id: u.user_id, full_name: u.full_name, reason: "no manager" });
      continue;
    }
    const phone = managerPhoneMapSingle[u.manager_id];
    if (!phone) {
      orphanedSingle.push({ user_id: u.user_id, full_name: u.full_name, reason: "no manager phone" });
      continue;
    }
    if (!byManagerSingle[u.manager_id]) byManagerSingle[u.manager_id] = [];
    byManagerSingle[u.manager_id].push(u);
  }

  const overdueCountSingle = overdueTodayRaw.length;
  tier1Single.overdueCount = overdueCountSingle;
  tier2Single.overdueCount = overdueCountSingle;

  const { data: recipientsSingle } = await supabase
    .from("sms_escalation_recipients")
    .select("tier, phone_e164, sort_order")
    .eq("is_active", true)
    .eq("tier", 2)
    .order("sort_order", { ascending: true });
  const tier2PhonesSingle = (recipientsSingle ?? []).map((r: { phone_e164: string }) => r.phone_e164);

  async function alreadySentTodaySingle(tier: number, dateChecked: string): Promise<boolean> {
    const { data } = await supabase
      .from("sms_escalation_send_log")
      .select("sent_at")
      .eq("tier", tier)
      .eq("date_checked", dateChecked)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data?.sent_at) return false;
    const sentAtChicago = new Date(data.sent_at).toLocaleDateString("en-CA", { timeZone: TZ });
    return sentAtChicago === todayStr;
  }
  const tier1AlreadySentSingle = await alreadySentTodaySingle(1, todayStr);
  const tier2AlreadySentSingle = await alreadySentTodaySingle(2, todayStr);

  const skipTier1Single = skipCalendar || overdueCountSingle === 0;
  if (!skipTier1Single && !tier1AlreadySentSingle) {
    const managerEntriesSingle = Object.entries(byManagerSingle);
    if (managerEntriesSingle.length > 0 && CLICKSEND_USERNAME && CLICKSEND_PASSWORD && !dryRun) {
      const messages: { to: string; body: string }[] = [];
      for (const [_mid, users] of managerEntriesSingle) {
        const phone = managerPhoneMapSingle[_mid];
        if (!phone) continue;
        const names = users.map((u) => abbreviateName(u.full_name));
        const crewTotal = managerCrewCountSingle[_mid] ?? users.length;
        messages.push({ to: phone, body: buildSMSBody(names, users.length, crewTotal, 1, todayStr) });
      }
      if (messages.length > 0) {
        const sendResult = await sendSMS(
          messages.map((m) => ({ to: m.to, body: m.body })),
          { username: CLICKSEND_USERNAME, password: CLICKSEND_PASSWORD, from: CLICKSEND_FROM_NUMBER }
        );
        tier1Single.sent = true;
        tier1Single.totalPrice = sendResult.totalPrice ?? 0;
        await supabase.from("sms_escalation_send_log").insert({
          tier: 1,
          date_checked: todayStr,
          overdue_count: overdueCountSingle,
          recipient_count: messages.length,
          success: sendResult.success,
          error_message: sendResult.error ?? null,
          total_price: sendResult.totalPrice,
          results: sendResult.results ?? null,
          employee_user_ids: overdueTodayRaw.map((u) => u.user_id),
          orphaned_user_ids: orphanedSingle.map((o) => ({ user_id: o.user_id, reason: o.reason })),
          suppression_log: suppressionLogTier1Single,
        });
        if (sendResult.error) errorsSingle.push(`Tier1: ${sendResult.error}`);
      }
    } else if (managerEntriesSingle.length > 0 && !dryRun) tier1Single.skippedReason = "ClickSend not configured";
    if (dryRun && managerEntriesSingle.length > 0) tier1Single.dryRunWouldSend = true;
  } else {
    if (skipCalendar) tier1Single.skippedReason = "Date in company_calendar";
    else if (overdueCountSingle === 0) tier1Single.skippedReason = "No overdue";
    else if (tier1AlreadySentSingle) tier1Single.skippedReason = "Already sent today";
    if (overdueCountSingle === 0 && !tier1AlreadySentSingle) {
      await supabase.from("sms_escalation_send_log").insert({
        tier: 1,
        date_checked: todayStr,
        overdue_count: 0,
        recipient_count: 0,
        success: true,
        error_message: null,
        total_price: 0,
        results: null,
        employee_user_ids: [],
        orphaned_user_ids: [],
        suppression_log: suppressionLogTier1Single,
      });
    }
  }
  tier1Single.dateChecked = todayStr;

  const tier2CombinedCountSingle = overdueCountSingle;
  const skipTier2Single = skipCalendar || tier2CombinedCountSingle === 0 || tier2PhonesSingle.length === 0 || tier2AlreadySentSingle;
  if (!skipTier2Single && tier2PhonesSingle.length > 0 && CLICKSEND_USERNAME && CLICKSEND_PASSWORD && !dryRun) {
    const overdueNamesSingle = overdueTodayRaw.map((u) => abbreviateName(u.full_name));
    const orphanNamesSingle = orphanedSingle.map((u) => abbreviateName(u.full_name));
    const bodySingle = buildTier2BodySingleDay(
      overdueNamesSingle,
      overdueCountSingle,
      totalFieldUsersSingle,
      orphanNamesSingle,
      orphanedSingle.length,
      todayStr
    );
    const sendResult = await sendSMS(
      tier2PhonesSingle.map((to) => ({ to, body: bodySingle })),
      { username: CLICKSEND_USERNAME, password: CLICKSEND_PASSWORD, from: CLICKSEND_FROM_NUMBER }
    );
    tier2Single.sent = true;
    tier2Single.totalPrice = sendResult.totalPrice ?? 0;
    await supabase.from("sms_escalation_send_log").insert({
      tier: 2,
      date_checked: todayStr,
      overdue_count: tier2CombinedCountSingle,
      recipient_count: tier2PhonesSingle.length,
      success: sendResult.success,
      error_message: sendResult.error ?? null,
      total_price: sendResult.totalPrice,
      results: sendResult.results ?? null,
      employee_user_ids: overdueTodayRaw.map((u) => u.user_id),
      orphaned_user_ids: orphanedSingle.map((o) => ({ user_id: o.user_id, reason: o.reason })),
      suppression_log: suppressionLogTier2Single,
    });
    if (sendResult.error) errorsSingle.push(`Tier2: ${sendResult.error}`);
  } else {
    if (skipCalendar) tier2Single.skippedReason = "Date in company_calendar";
    else if (tier2CombinedCountSingle === 0) tier2Single.skippedReason = "No overdue";
    else if (tier2PhonesSingle.length === 0) tier2Single.skippedReason = "No recipients";
    else if (tier2AlreadySentSingle) tier2Single.skippedReason = "Already sent today";
    else if (dryRun && tier2PhonesSingle.length > 0 && tier2CombinedCountSingle > 0) tier2Single.dryRunWouldSend = true;
    else if (!CLICKSEND_USERNAME || !CLICKSEND_PASSWORD) tier2Single.skippedReason = "ClickSend not configured";
    if (tier2CombinedCountSingle === 0 && !tier2AlreadySentSingle) {
      await supabase.from("sms_escalation_send_log").insert({
        tier: 2,
        date_checked: todayStr,
        overdue_count: 0,
        recipient_count: 0,
        success: true,
        error_message: null,
        total_price: 0,
        results: null,
        employee_user_ids: [],
        orphaned_user_ids: [],
        suppression_log: suppressionLogTier2Single,
      });
    }
  }
  tier2Single.dateChecked = todayStr;

  console.log("[safety-briefing-escalation-sms] single_day", {
    todayStr,
    totalFieldUsers: totalFieldUsersSingle,
    overdueCount: overdueCountSingle,
    orphanedCount: orphanedSingle.length,
  });

  const payloadSingle: Record<string, unknown> = {
    tier1: { ...tier1Single },
    tier2: { ...tier2Single },
    errors: errorsSingle.length ? errorsSingle : undefined,
  };
  if (dryRun) {
    payloadSingle.dryRun = true;
    payloadSingle.totalFieldUsers = totalFieldUsersSingle;
    payloadSingle.suppressionLog = { tier1: suppressionLogTier1Single, tier2: suppressionLogTier2Single };
    // Preview the would-be SMS bodies (single-day format)
    const overdueNamesSingle = overdueTodayRaw.map((u) => abbreviateName(u.full_name));
    const orphanNamesSingle = orphanedSingle.map((u) => abbreviateName(u.full_name));
    payloadSingle.smsBodyPreview = {
      tier2: buildTier2BodySingleDay(
        overdueNamesSingle,
        overdueCountSingle,
        totalFieldUsersSingle,
        orphanNamesSingle,
        orphanedSingle.length,
        todayStr
      ),
      tier1Example: (() => {
        const firstManager = Object.entries(byManagerSingle)[0];
        if (!firstManager) return null;
        const [_mid, users] = firstManager;
        const names = users.map((u) => abbreviateName(u.full_name));
        const crewTotal = managerCrewCountSingle[_mid] ?? users.length;
        return buildSMSBody(names, users.length, crewTotal, 1, todayStr);
      })(),
    };
  }

  return new Response(
    JSON.stringify(payloadSingle),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
