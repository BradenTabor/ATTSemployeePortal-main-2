// @ts-nocheck
/**
 * Certification Expiry Reminders + Pending Review Escalation + Admin Digest
 *
 * Invoked on a cron schedule. Three blocks:
 * 1. Expiry reminders (Phase 1 collect, Phase 2 dispatch): certification_records expiring in 30/14/7 days (UTC);
 *    only when cert type has that interval in reminder_days. One notification per worker. Severity: 30d=low, 14d=medium, 7d=high.
 * 2. Admin digest (Phase 3): When any cert is expiring in 30/14/7 days, one digest (push + email) to admins and safety_officer
 *    (deduped). Push via one notification_event (target_type=roles); email via Gmail, body capped per bucket, link to full view.
 * 3. Escalation: certification_attempts with status='submitted' older than escalation_hours; one notification to all admins.
 *
 * Order: Phase 1 collect all expiring data → Phase 2 per-worker notifications → Phase 3 digest event + email. No partial digest on error.
 *
 * Invoke with x-internal-key: INTERNAL_SECRET.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendGmailEmail } from "../_shared/gmail.ts";

const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GMAIL_USER = Deno.env.get("GMAIL_USER") ?? "allterraintreeservice.po@gmail.com";
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD") ?? "";

const REMINDER_DAYS = [30, 14, 7] as const;
const NOTIFICATION_TYPES: Record<number, string> = {
  30: "30_day",
  14: "14_day",
  7: "7_day",
};
const SEVERITY_BY_DAYS: Record<number, "low" | "medium" | "high"> = {
  30: "low",
  14: "medium",
  7: "high",
};
const DIGEST_CAP_PER_BUCKET = 10;
const DIGEST_FULL_VIEW_URL = "/admin/certifications";

interface WorkerItem {
  recordId: string;
  user_id: string;
  certification_type_id: string;
  certName: string;
  expires_at: string;
  days: number;
  notifType: string;
}

interface DigestBucketItem {
  user_id: string;
  userName: string;
  certName: string;
  expiresAt: string;
}

Deno.serve(async (req: Request) => {
  const key = req.headers.get("x-internal-key");
  if (!key || key !== INTERNAL_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const nowIso = now.toISOString();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // -------------------------------------------------------------------------
  // Phase 1: Collect all expiring cert data (no events, no dispatch)
  // -------------------------------------------------------------------------
  const workerItems: WorkerItem[] = [];
  const digestBuckets: Record<number, DigestBucketItem[]> = { 7: [], 14: [], 30: [] };

  for (const days of REMINDER_DAYS) {
    const targetDate = new Date(todayUtc);
    targetDate.setUTCDate(targetDate.getUTCDate() + days);
    const targetDateStr = targetDate.toISOString().slice(0, 10);
    const targetStart = `${targetDateStr}T00:00:00.000Z`;
    const targetEnd = `${targetDateStr}T23:59:59.999Z`;

    const { data: records, error: recErr } = await supabase
      .from("certification_records")
      .select("id, user_id, certification_type_id, expires_at")
      .eq("status", "active")
      .gte("expires_at", targetStart)
      .lte("expires_at", targetEnd);

    if (recErr || !records?.length) {
      if (recErr) console.error(`[cert-expiry-reminders] Phase 1 fetch error (${days}d):`, recErr);
      continue;
    }

    const certTypeIds = [...new Set(records.map((r: { certification_type_id: string }) => r.certification_type_id))];
    const { data: certTypes, error: ctErr } = await supabase
      .from("certification_types")
      .select("id, name, reminder_days")
      .in("id", certTypeIds);

    if (ctErr || !certTypes?.length) continue;

    const typesWithReminder = new Set(
      (certTypes as { id: string; name: string; reminder_days: number[] | null }[])
        .filter((ct) => Array.isArray(ct.reminder_days) && ct.reminder_days.includes(days))
        .map((ct) => ct.id)
    );
    const nameById = new Map(
      (certTypes as { id: string; name: string }[]).map((ct) => [ct.id, ct.name])
    );

    for (const cert of records as { id: string; user_id: string; certification_type_id: string; expires_at: string }[]) {
      if (!typesWithReminder.has(cert.certification_type_id)) continue;
      const certName = nameById.get(cert.certification_type_id) ?? "Certification";
      const notifType = NOTIFICATION_TYPES[days];
      workerItems.push({
        recordId: cert.id,
        user_id: cert.user_id,
        certification_type_id: cert.certification_type_id,
        certName,
        expires_at: cert.expires_at,
        days,
        notifType,
      });
      digestBuckets[days].push({
        user_id: cert.user_id,
        userName: "", // filled below
        certName,
        expiresAt: cert.expires_at.slice(0, 10),
      });
    }
  }

  // Resolve already-sent (single query)
  const existingSent = new Set<string>();
  if (workerItems.length > 0) {
    const recordIds = [...new Set(workerItems.map((w) => w.recordId))];
    const { data: existingRows } = await supabase
      .from("certification_expiration_notifications")
      .select("certification_record_id, notification_type")
      .in("certification_record_id", recordIds);
    (existingRows ?? []).forEach((r: { certification_record_id: string; notification_type: string }) => {
      existingSent.add(`${r.certification_record_id}:${r.notification_type}`);
    });
  }

  const toSend = workerItems.filter((w) => !existingSent.has(`${w.recordId}:${w.notifType}`));

  // Enrich digest buckets with user names (unique user_ids across all buckets)
  const allUserIds = [...new Set(([] as string[]).concat(...Object.values(digestBuckets).map((b) => b.map((i) => i.user_id))))];
  const userNameById = new Map<string, string>();
  if (allUserIds.length > 0) {
    const { data: users } = await supabase
      .from("app_users")
      .select("user_id, full_name")
      .in("user_id", allUserIds)
      .not("email", "ilike", "%@atts.test");
    (users ?? []).forEach((u: { user_id: string; full_name: string | null }) => {
      userNameById.set(u.user_id, (u.full_name || "Unknown").trim());
    });
  }
  for (const bucket of Object.values(digestBuckets)) {
    for (const item of bucket) {
      item.userName = userNameById.get(item.user_id) ?? "Unknown";
    }
  }

  const totalDigestItems = digestBuckets[7].length + digestBuckets[14].length + digestBuckets[30].length;
  const hasDigest = totalDigestItems > 0;

  // -------------------------------------------------------------------------
  // Phase 2: Per-worker notifications (severity by days)
  // -------------------------------------------------------------------------
  let notificationsSent = 0;
  for (const w of toSend) {
    const renewBefore = new Date(w.expires_at).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const body = `Your ${w.certName} certification expires in ${w.days} days. Renew before ${renewBefore}.`;
    const title = `${w.certName} expires in ${w.days} days`;
    const severity = SEVERITY_BY_DAYS[w.days];

    const { data: ev, error: evErr } = await supabase
      .from("notification_events")
      .insert({
        category: "certification_expiry",
        severity,
        target_type: "user",
        target_ref: w.user_id,
        title,
        body,
        url: "/resources",
        entity_type: "certification",
        entity_id: w.recordId,
      })
      .select("id")
      .single();

    if (evErr || !ev) {
      console.error("[cert-expiry-reminders] Phase 2 event insert failed:", evErr);
      continue;
    }

    await supabase.from("certification_expiration_notifications").upsert(
      {
        certification_record_id: w.recordId,
        notification_type: w.notifType,
        scheduled_for: now.toISOString(),
        sent_at: now.toISOString(),
      },
      { onConflict: "certification_record_id,notification_type" }
    );

    const dispatchRes = await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-internal-key": INTERNAL_SECRET,
      },
      body: JSON.stringify({ event_id: ev.id }),
    });
    if (!dispatchRes.ok) {
      console.warn(`[cert-expiry-reminders] Phase 2 dispatch failed for ${ev.id}:`, await dispatchRes.text());
    }
    notificationsSent++;
  }

  // -------------------------------------------------------------------------
  // Phase 3: One digest event + email (only when hasDigest)
  // -------------------------------------------------------------------------
  let digestPushSent = 0;
  let digestEmailSent = false;
  if (hasDigest) {
    const digestSeverity =
      digestBuckets[7].length > 0 ? "high" : digestBuckets[14].length > 0 ? "medium" : "low";
    const digestTitle = "Certification expiry digest";
    const digestBody = `${totalDigestItems} certification(s) expiring in the next 30 days. View details in the admin portal.`;

    const { data: digestEv, error: digestEvErr } = await supabase
      .from("notification_events")
      .insert({
        category: "certification_expiry_digest",
        severity: digestSeverity,
        target_type: "roles",
        target_ref: "admin,safety_officer",
        title: digestTitle,
        body: digestBody,
        url: DIGEST_FULL_VIEW_URL,
        entity_type: "certification",
      })
      .select("id")
      .single();

    if (!digestEvErr && digestEv) {
      const dispatchRes = await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-internal-key": INTERNAL_SECRET,
        },
        body: JSON.stringify({ event_id: digestEv.id }),
      });
      if (dispatchRes.ok) digestPushSent = 1;
      else console.warn("[cert-expiry-reminders] Phase 3 digest dispatch failed:", await dispatchRes.text());
    } else {
      console.error("[cert-expiry-reminders] Phase 3 digest event insert failed:", digestEvErr);
    }

    // Digest email: capped body, link to full view
    const formatBucket = (items: DigestBucketItem[], label: string): { text: string; html: string } => {
      const cap = DIGEST_CAP_PER_BUCKET;
      const shown = items.slice(0, cap);
      const rest = items.length - cap;
      const lines = shown.map((i) => `${i.userName} – ${i.certName} – ${i.expiresAt}`);
      if (rest > 0) lines.push(`… and ${rest} more. View full list: ${DIGEST_FULL_VIEW_URL}`);
      const text = `${label}\n${lines.join("\n")}\n`;
      const html = `<p><strong>${label}</strong></p><ul>${shown.map((i) => `<li>${i.userName} – ${i.certName} – ${i.expiresAt}</li>`).join("")}${rest > 0 ? `<li>… and ${rest} more. <a href="${DIGEST_FULL_VIEW_URL}">View full list</a></li>` : ""}</ul>`;
      return { text, html };
    };

    const b7 = formatBucket(digestBuckets[7], "Expiring in 7 days");
    const b14 = formatBucket(digestBuckets[14], "Expiring in 14 days");
    const b30 = formatBucket(digestBuckets[30], "Expiring in 30 days");

    const textBody = [b7.text, b14.text, b30.text].join("\n");
    const htmlBody = [
      "<p>Certification(s) are expiring in the next 30 days. Summary below (capped per bucket).</p>",
      b7.html,
      b14.html,
      b30.html,
      `<p><a href=\"${DIGEST_FULL_VIEW_URL}\">Open Admin Certifications</a></p>`,
    ].join("");

    let recipients: string[] = [];
    const { data: listRows } = await supabase
      .from("email_recipient_lists")
      .select("email")
      .eq("list_key", "certification_expiry_digest");
    if (listRows?.length) {
      recipients = (listRows as { email: string }[]).map((r) => r.email).filter(Boolean);
    }
    if (recipients.length === 0) {
      const { data: fallbackRows } = await supabase
        .from("app_users")
        .select("email")
        .in("role", ["admin", "safety_officer"])
        .not("email", "ilike", "%@atts.test");
      recipients = [...new Set((fallbackRows ?? []).map((r: { email: string }) => r.email).filter(Boolean))];
    }

    if (recipients.length > 0) {
      const subject = "ATTS Certification Expiry Digest";
      const emailResult = await sendGmailEmail(
        recipients,
        subject,
        textBody,
        htmlBody,
        { gmailUser: GMAIL_USER, gmailAppPassword: GMAIL_APP_PASSWORD, fromLabel: "ATTS" }
      );
      digestEmailSent = emailResult.success;
      if (!emailResult.success) {
        console.error("[cert-expiry-reminders] Digest email failed:", emailResult.error);
      }
      await supabase.from("email_send_log").insert({
        list_key: "certification_expiry_digest",
        recipients,
        success: digestEmailSent,
        error_message: emailResult.success ? null : (emailResult.error ?? "Unknown error"),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Block 2 (unchanged): Escalate submitted tests awaiting review
  // -------------------------------------------------------------------------
  let escalationSent = 0;
  const { data: certTypesEsc } = await supabase
    .from("certification_types")
    .select("id, escalation_hours")
    .not("escalation_hours", "is", null);

  if (certTypesEsc?.length) {
    let totalEscalated = 0;
    let maxHours = 0;
    const attemptIds: string[] = [];
    const escalatedPairs: { user_id: string; certification_type_id: string }[] = [];

    for (const ct of certTypesEsc as { id: string; escalation_hours: number }[]) {
      const hours = ct.escalation_hours ?? 48;
      const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

      const { data: attempts, error: attErr } = await supabase
        .from("certification_attempts")
        .select("id, user_id, certification_type_id")
        .eq("status", "submitted")
        .eq("certification_type_id", ct.id)
        .lt("submitted_at", cutoff)
        .or(`last_escalated_at.is.null,last_escalated_at.lt.${twentyFourHoursAgo}`);

      if (attErr || !attempts?.length) continue;

      const attemptsList = attempts as { id: string; user_id: string; certification_type_id: string }[];
      const userIds = [...new Set(attemptsList.map((a) => a.user_id))];

      const { data: recentRecords } = await supabase
        .from("certification_records")
        .select("user_id, certification_type_id")
        .eq("certification_type_id", ct.id)
        .in("user_id", userIds)
        .gte("last_escalated_at", twentyFourHoursAgo);

      const recentKeys = new Set(
        (recentRecords ?? []).map((r: { user_id: string; certification_type_id: string }) =>
          `${r.user_id}:${r.certification_type_id}`
        )
      );

      for (const a of attemptsList) {
        const key = `${a.user_id}:${a.certification_type_id}`;
        if (recentKeys.has(key)) continue;
        totalEscalated += 1;
        attemptIds.push(a.id);
        escalatedPairs.push({ user_id: a.user_id, certification_type_id: a.certification_type_id });
      }
      if (hours > maxHours) maxHours = hours;
    }

    const recordIdsToTouch: string[] = [];
    const pairsByCert = new Map<string, string[]>();
    for (const p of escalatedPairs) {
      const list = pairsByCert.get(p.certification_type_id) ?? [];
      list.push(p.user_id);
      pairsByCert.set(p.certification_type_id, list);
    }
    for (const [certTypeId, uids] of pairsByCert) {
      const { data: recs } = await supabase
        .from("certification_records")
        .select("id")
        .eq("certification_type_id", certTypeId)
        .in("user_id", uids);
      for (const r of recs ?? []) recordIdsToTouch.push(r.id);
    }

    if (totalEscalated > 0) {
      const N = maxHours || 48;
      const body = `${totalEscalated} certification test${totalEscalated === 1 ? "" : "s"} have been awaiting review for over ${N} hours.`;
      const title = "Certification tests awaiting review";

      const { data: evEsc, error: evEscErr } = await supabase
        .from("notification_events")
        .insert({
          category: "admin_notice",
          severity: "high",
          target_type: "role",
          target_ref: "admin",
          title,
          body,
          url: "/admin/certifications?tab=pending",
          entity_type: "certification",
        })
        .select("id")
        .single();

      if (!evEscErr && evEsc) {
        const dispatchRes = await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "x-internal-key": INTERNAL_SECRET,
          },
          body: JSON.stringify({ event_id: evEsc.id }),
        });
        if (dispatchRes.ok) escalationSent = 1;
        else console.warn("[cert-expiry-reminders] escalation dispatch failed:", await dispatchRes.text());
      } else {
        console.error("[cert-expiry-reminders] escalation event insert failed:", evEscErr);
      }

      if (attemptIds.length > 0) {
        await supabase
          .from("certification_attempts")
          .update({ last_escalated_at: nowIso })
          .in("id", attemptIds);
      }
      if (recordIdsToTouch.length > 0) {
        await supabase
          .from("certification_records")
          .update({ last_escalated_at: nowIso })
          .in("id", recordIdsToTouch);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      notifications_sent: notificationsSent,
      digest_push_sent: digestPushSent,
      digest_email_sent: digestEmailSent,
      escalation_sent: escalationSent,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
