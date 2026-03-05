// @ts-nocheck
/**
 * Monthly Compliance Summary — executive email on the 1st of each month (8 AM CST).
 * Auth: x-internal-key or Bearer service role. Query params: ?month=YYYY-MM, ?dry_run=true.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendGmailEmail } from "../_shared/gmail.ts";
import {
  buildMonthlyReportHtml,
  type MonthlyReportData,
  type SmsSectionData,
  type ComplianceSectionData,
  type CrewRankingRow,
  type RepeatOffenderRow,
  type IncidentsSectionData,
  type DataQualitySectionData,
} from "../_shared/buildMonthlyReportHtml.ts";

const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_USER = Deno.env.get("GMAIL_USER") ?? "";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";

const TZ = "America/Chicago";
const FIELD_ROLES = ["employee", "foreman", "general_foreman", "mechanic"];
const HIGH_RISK_NEAR_MISS_TYPES = ["electrical", "fall", "struck_by"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function getMonthRange(monthParam: string | null): { monthLabel: string; monthStart: string; monthEnd: string; monthDisplay: string; year: number } {
  let year: number;
  let month: number;
  const today = getChicagoToday();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m;
  } else {
    const prev = new Date(today + "T12:00:00.000Z");
    prev.setUTCMonth(prev.getUTCMonth() - 1);
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth() + 1;
  }
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0);
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
  const monthLabel = `${year}-${String(month).padStart(2, "0")}`;
  const monthDisplay = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });
  return { monthLabel, monthStart, monthEnd, monthDisplay, year };
}

function isWeekday(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00.000Z");
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

function getWeekLabel(dateStr: string, monthStart: string): string {
  const start = new Date(monthStart + "T12:00:00.000Z");
  const d = new Date(dateStr + "T12:00:00.000Z");
  const diff = Math.floor((d.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `Week ${diff + 1}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const internalKey = req.headers.get("x-internal-key");
  const authHeader = req.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const allowed =
    (INTERNAL_SECRET && internalKey === INTERNAL_SECRET) ||
    (SUPABASE_SERVICE_ROLE_KEY && bearer === SUPABASE_SERVICE_ROLE_KEY);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");
  const dryRun = url.searchParams.get("dry_run")?.toLowerCase() === "true";

  const startTime = Date.now();
  console.log("[MonthlySummary] Starting", { monthParam, dryRun });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { monthLabel, monthStart, monthEnd, monthDisplay, year } = getMonthRange(monthParam);
    const [y, m] = monthStart.split("-").map(Number);
    const prevFirst = new Date(y, m - 2, 1);
    const prevMonthStart = `${prevFirst.getFullYear()}-${String(prevFirst.getMonth() + 1).padStart(2, "0")}-01`;
    const prevLastDay = new Date(prevFirst.getFullYear(), prevFirst.getMonth() + 1, 0);
    const prevMonthEnd = `${prevFirst.getFullYear()}-${String(prevFirst.getMonth() + 1).padStart(2, "0")}-${String(prevLastDay.getDate()).padStart(2, "0")}`;

    const [
      smsLogCurrent,
      smsLogPrev,
      announcementsCurrent,
      announcementsPrev,
      answersCurrent,
      answersPrev,
      appUsers,
      userAbsences,
      userAbsencesPrev,
      companyCalendar,
      companyCalendarPrev,
      crewMembersRows,
      crewsRows,
      incidentsRows,
    ] = await Promise.all([
      supabase
        .from("sms_escalation_send_log")
        .select("tier, success, total_price, date_checked")
        .gte("date_checked", monthStart)
        .lte("date_checked", monthEnd),
      supabase
        .from("sms_escalation_send_log")
        .select("tier, success, total_price")
        .gte("date_checked", prevMonthStart)
        .lte("date_checked", prevMonthEnd),
      supabase.from("announcements").select("id, date").gte("date", monthStart).lte("date", monthEnd),
      supabase.from("announcements").select("id, date").gte("date", prevMonthStart).lte("date", prevMonthEnd),
      supabase
        .from("safety_briefing_answers")
        .select("user_id, briefing_date")
        .gte("briefing_date", monthStart)
        .lte("briefing_date", monthEnd),
      supabase
        .from("safety_briefing_answers")
        .select("user_id, briefing_date")
        .gte("briefing_date", prevMonthStart)
        .lte("briefing_date", prevMonthEnd),
      supabase
        .from("app_users")
        .select("id, user_id, full_name, role, status, manager_id, phone_number")
        .in("role", FIELD_ROLES)
        .eq("status", "active")
        .not("email", "ilike", "%@atts.test"),
      supabase.from("user_absences").select("user_id, date").gte("date", monthStart).lte("date", monthEnd),
      supabase.from("user_absences").select("user_id, date").gte("date", prevMonthStart).lte("date", prevMonthEnd),
      supabase.from("company_calendar").select("date").gte("date", monthStart).lte("date", monthEnd),
      supabase.from("company_calendar").select("date").gte("date", prevMonthStart).lte("date", prevMonthEnd),
      supabase.from("crew_members").select("user_id, crew_id"),
      supabase.from("crews").select("id, name"),
      supabase
        .from("safety_incidents")
        .select("severity, incident_type")
        .gte("incident_date", monthStart)
        .lte("incident_date", monthEnd),
    ]);

    const fieldUsers = (appUsers.data ?? []).filter((u: { status: string }) => u.status === "active");
    const absenceSet = new Set(
      (userAbsences.data ?? []).map((a: { user_id: string; date: string }) => `${a.user_id}:${String(a.date).slice(0, 10)}`)
    );
    const calendarOffSet = new Set((companyCalendar.data ?? []).map((c: { date: string }) => String(c.date).slice(0, 10)));
    const crewByUserId = new Map<string, string>();
    (crewsRows.data ?? []).forEach((c: { id: string; name: string }) => {
      (crewMembersRows.data ?? [])
        .filter((cm: { crew_id: string }) => cm.crew_id === c.id)
        .forEach((cm: { user_id: string }) => crewByUserId.set(cm.user_id, c.name));
    });

    const byTier = (rows: { tier: number; success: boolean; total_price: number | null }[]) => {
      const out: Record<0 | 1 | 2, { count: number; cost: number }> = {
        0: { count: 0, cost: 0 },
        1: { count: 0, cost: 0 },
        2: { count: 0, cost: 0 },
      };
      rows.forEach((r) => {
        const t = r.tier as 0 | 1 | 2;
        if (r.success) {
          out[t].count += 1;
          out[t].cost += Number(r.total_price ?? 0);
        }
      });
      return out;
    };

    const smsRowsCurrent = smsLogCurrent.data ?? [];
    const smsRowsPrev = smsLogPrev.data ?? [];
    const tierCurrent = byTier(smsRowsCurrent);
    const tierPrev = byTier(smsRowsPrev);
    const totalSent = tierCurrent[0].count + tierCurrent[1].count + tierCurrent[2].count;
    const totalCost = tierCurrent[0].cost + tierCurrent[1].cost + tierCurrent[2].cost;
    const prevSent =
      tierPrev[0].count + tierPrev[1].count + tierPrev[2].count || null;
    const prevCost =
      tierPrev[0].cost + tierPrev[1].cost + tierPrev[2].cost;
    const sms: SmsSectionData = {
      totalSent,
      totalCost,
      byTier: tierCurrent,
      errorCount: smsRowsCurrent.filter((r: { success: boolean }) => !r.success).length,
      prevMonthSent: prevSent === 0 ? null : prevSent,
      prevMonthCost: prevSent === 0 ? null : prevCost,
    };

    const announcementDates = [...new Set((announcementsCurrent.data ?? []).map((a: { date: string }) => String(a.date).slice(0, 10)))];
    const briefingDays = announcementDates.filter(
      (d) => isWeekday(d) && !calendarOffSet.has(d)
    );
    const answersByDate = new Map<string, Set<string>>();
    (answersCurrent.data ?? []).forEach((a: { user_id: string; briefing_date: string }) => {
      const d = String(a.briefing_date).slice(0, 10);
      if (!answersByDate.has(d)) answersByDate.set(d, new Set());
      answersByDate.get(d)!.add(a.user_id);
    });

    const dailyRates: { date: string; rate: number }[] = [];
    let totalRate = 0;
    let countRate = 0;
    briefingDays.forEach((d) => {
      const expected = fieldUsers.length - (fieldUsers as { user_id: string }[]).filter((u) => absenceSet.has(`${u.user_id}:${d}`)).length;
      const actual = answersByDate.get(d)?.size ?? 0;
      const rate = expected > 0 ? (actual / expected) * 100 : 0;
      dailyRates.push({ date: d, rate });
      totalRate += rate;
      countRate += 1;
    });
    const monthlyAvgRate = countRate > 0 ? totalRate / countRate : null;
    const prevCalendarOffSet = new Set((companyCalendarPrev.data ?? []).map((c: { date: string }) => String(c.date).slice(0, 10)));
    const prevAnnouncementDates = [...new Set((announcementsPrev.data ?? []).map((a: { date: string }) => String(a.date).slice(0, 10)))];
    const prevBriefingDays = prevAnnouncementDates.filter((d) => isWeekday(d) && !prevCalendarOffSet.has(d));
    const answersPrevByDate = new Map<string, Set<string>>();
    (answersPrev.data ?? []).forEach((a: { user_id: string; briefing_date: string }) => {
      const d = String(a.briefing_date).slice(0, 10);
      if (!answersPrevByDate.has(d)) answersPrevByDate.set(d, new Set());
      answersPrevByDate.get(d)!.add(a.user_id);
    });
    const prevAbsenceSet = new Set(
      (userAbsencesPrev.data ?? []).map((a: { user_id: string; date: string }) => `${a.user_id}:${String(a.date).slice(0, 10)}`)
    );
    let prevMonthAvgRate: number | null = null;
    if (prevBriefingDays.length > 0) {
      const prevFieldUserCount = fieldUsers.length;
      let prevTotal = 0;
      prevBriefingDays.forEach((d) => {
        const expected = prevFieldUserCount - (fieldUsers as { user_id: string }[]).filter((u) => prevAbsenceSet.has(`${u.user_id}:${d}`)).length;
        const actual = answersPrevByDate.get(d)?.size ?? 0;
        prevTotal += expected > 0 ? (actual / expected) * 100 : 0;
      });
      prevMonthAvgRate = prevTotal / prevBriefingDays.length;
    }
    const bestDay = dailyRates.length ? dailyRates.reduce((a, b) => (a.rate >= b.rate ? a : b)) : null;
    const worstDay = dailyRates.length ? dailyRates.reduce((a, b) => (a.rate <= b.rate ? a : b)) : null;
    const weekGroups = new Map<string, number[]>();
    dailyRates.forEach(({ date, rate }) => {
      const w = getWeekLabel(date, monthStart);
      if (!weekGroups.has(w)) weekGroups.set(w, []);
      weekGroups.get(w)!.push(rate);
    });
    const weekBreakdown = [...weekGroups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([weekLabel, rates]) => ({
        weekLabel,
        rate: rates.reduce((s, r) => s + r, 0) / rates.length,
      }));

    const compliance: ComplianceSectionData = {
      monthlyAvgRate,
      prevMonthAvgRate,
      bestDay: bestDay ? { date: bestDay.date, rate: bestDay.rate } : null,
      worstDay: worstDay ? { date: worstDay.date, rate: worstDay.rate } : null,
      weekBreakdown,
      hasAnyBriefingDays: briefingDays.length > 0,
    };

    const crewRates = new Map<string, { completed: number; expected: number }>();
    fieldUsers.forEach((u: { user_id: string }) => {
      const crew = crewByUserId.get(u.user_id) ?? "Unassigned";
      if (!crewRates.has(crew)) crewRates.set(crew, { completed: 0, expected: 0 });
      const rec = crewRates.get(crew)!;
      briefingDays.forEach((d) => {
        if (absenceSet.has(`${u.user_id}:${d}`)) return;
        rec.expected += 1;
        if (answersByDate.get(d)?.has(u.user_id)) rec.completed += 1;
      });
    });
    const crews: CrewRankingRow[] = [...crewRates.entries()]
      .map(([name, { completed, expected }]) => ({
        name,
        rate: expected > 0 ? (completed / expected) * 100 : 0,
        below80: expected > 0 && (completed / expected) * 100 < 80,
      }))
      .sort((a, b) => b.rate - a.rate);

    const missCountByUser = new Map<string, number>();
    fieldUsers.forEach((u: { user_id: string }) => {
      let misses = 0;
      briefingDays.forEach((d) => {
        if (absenceSet.has(`${u.user_id}:${d}`)) return;
        if (answersByDate.get(d)?.has(u.user_id)) return;
        misses += 1;
      });
      if (misses >= 3) missCountByUser.set(u.user_id, misses);
    });
    const managerIds = new Set((fieldUsers as { manager_id: string | null }[]).map((u) => u.manager_id).filter(Boolean));
    const managersData = await supabase
      .from("app_users")
      .select("id, full_name")
      .in("id", [...managerIds]);
    const managerNameById = new Map<string, string>();
    (managersData.data ?? []).forEach((m: { id: string; full_name: string | null }) => {
      managerNameById.set(m.id, m.full_name ?? "Unknown");
    });
    const repeatOffenders: RepeatOffenderRow[] = [...missCountByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([userId, misses]) => {
        const u = fieldUsers.find((x: { user_id: string }) => x.user_id === userId) as {
          user_id: string;
          full_name: string | null;
          manager_id: string | null;
        };
        const crew = crewByUserId.get(userId) ?? "Unassigned";
        const supervisorName = u.manager_id ? managerNameById.get(u.manager_id) ?? "—" : "—";
        return {
          name: u.full_name ?? "Unknown",
          crew,
          misses,
          supervisorName,
        };
      });

    const incidentsList = incidentsRows.data ?? [];
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let highRiskNearMissCount = 0;
    incidentsList.forEach((i: { severity: string; incident_type: string }) => {
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
      byType[i.incident_type] = (byType[i.incident_type] ?? 0) + 1;
      if (
        i.severity === "near_miss" &&
        HIGH_RISK_NEAR_MISS_TYPES.includes(i.incident_type)
      ) {
        highRiskNearMissCount += 1;
      }
    });

    const incidents: IncidentsSectionData = {
      total: incidentsList.length,
      bySeverity,
      byType,
      highRiskNearMissCount,
    };

    const noPhoneCount = fieldUsers.filter(
      (u: { phone_number: string | null }) => !u.phone_number || String(u.phone_number).trim() === ""
    ).length;
    const noManagerCount = fieldUsers.filter((u: { manager_id: string | null }) => !u.manager_id).length;
    const managerIdsList = [...managerIds] as string[];
    const managersWithPhone = managerIdsList.length
      ? await supabase.from("app_users").select("id, phone_number").in("id", managerIdsList)
      : { data: [] };
    const managerNoPhoneCount = (managersWithPhone.data ?? []).filter(
      (m: { phone_number: string | null }) => !m.phone_number || String(m.phone_number).trim() === ""
    ).length;

    const dataQuality: DataQualitySectionData = {
      noPhoneCount,
      noManagerCount,
      managerNoPhoneCount,
      prevNoPhone: null,
      prevNoManager: null,
      prevManagerNoPhone: null,
    };

    const noBriefingsInMonth = briefingDays.length === 0;

    const reportData: MonthlyReportData = {
      monthLabel,
      monthDisplay,
      year,
      sms,
      compliance,
      crews,
      repeatOffenders,
      incidents,
      dataQuality,
      noBriefingsInMonth,
    };

    const { subject, textBody, htmlBody } = buildMonthlyReportHtml(reportData);

    if (dryRun) {
      const duration = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          success: true,
          status: "dry_run",
          subject,
          htmlBody,
          textBody,
          metrics: {
            monthLabel,
            totalSmsSent: sms.totalSent,
            totalSmsCost: sms.totalCost,
            overallComplianceRate: compliance.monthlyAvgRate,
            briefingDaysCount: briefingDays.length,
            recipientCount: 0,
          },
          durationMs: duration,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: recipientsRows } = await supabase
      .from("monthly_summary_recipients")
      .select("email")
      .eq("active", true);
    const recipients = (recipientsRows ?? [])
      .map((r: { email: string }) => r.email?.trim())
      .filter((e: string) => e && /^[^@]+@[^@]+\.[^@]+$/.test(e));

    if (recipients.length === 0) {
      console.warn("[MonthlySummary] No active recipients; skipping send.");
      return new Response(
        JSON.stringify({ success: true, status: "skipped", reason: "no_recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResult = await sendGmailEmail(recipients, subject, textBody, htmlBody, {
      gmailUser: GMAIL_USER,
      gmailAppPassword: GMAIL_APP_PASSWORD,
      fromLabel: "ATTS Safety Compliance",
    });

    const logPayload = {
      month_label: monthLabel,
      recipient_count: recipients.length,
      overall_compliance_rate: compliance.monthlyAvgRate,
      total_sms_sent: sms.totalSent,
      total_sms_cost: sms.totalCost,
      report_html: htmlBody,
      success: emailResult.success,
      error_message: emailResult.error ?? null,
    };

    const { error: insertError } = await supabase.from("monthly_summary_send_log").insert(logPayload);

    if (insertError) {
      if (insertError.code === "23505") {
        console.warn("[MonthlySummary] Already sent for", monthLabel, insertError.message);
        return new Response(
          JSON.stringify({ success: true, status: "already_sent", monthLabel }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("[MonthlySummary] Failed to insert send_log:", insertError);
    }

    if (!emailResult.success) {
      console.error("[MonthlySummary] Email send failed:", emailResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          error: emailResult.error,
          message: "Manual re-run: invoke the function with ?month=" + monthLabel + " to regenerate.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const duration = Date.now() - startTime;
    console.log("[MonthlySummary] Sent in", duration, "ms to", recipients.length, "recipients");
    return new Response(
      JSON.stringify({
        success: true,
        status: "sent",
        monthLabel,
        recipientCount: recipients.length,
        durationMs: duration,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[MonthlySummary] Error:", msg);
    return new Response(
      JSON.stringify({
        success: false,
        error: msg,
        message: "Manual re-run: invoke the function with ?month=YYYY-MM to regenerate.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
