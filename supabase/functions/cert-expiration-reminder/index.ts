// @ts-nocheck
/**
 * Certification Expiration Reminder
 *
 * Run daily via Supabase Cron. Finds active certs expiring in 30/14/7 days or
 * today, creates notification_events, upserts into certification_expiration_notifications
 * (idempotent), and calls notifications-dispatch.
 *
 * Invoke with x-internal-key: INTERNAL_SECRET.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WINDOWS = [
  { days: 30, type: "30_day" as const },
  { days: 14, type: "14_day" as const },
  { days: 7, type: "7_day" as const },
  { days: 0, type: "expired" as const },
];

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

  let processed = 0;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  for (const { days, type } of WINDOWS) {
    let targetDate: string;
    if (days === 0) {
      targetDate = today;
    } else {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      targetDate = d.toISOString().slice(0, 10);
    }

    const targetStart = `${targetDate}T00:00:00.000Z`;
    const targetEnd = `${targetDate}T23:59:59.999Z`;

    const q = supabase
      .from("certification_records")
      .select("id, user_id, certification_type_id, expires_at")
      .eq("status", "active");

    q.gte("expires_at", targetStart).lte("expires_at", targetEnd);

    const { data: certs, error: certErr } = await q;

    if (certErr) {
      console.error(`[cert-expiration-reminder] ${type} fetch failed:`, certErr);
      continue;
    }

    if (!certs?.length) continue;

    for (const cert of certs) {
      const { data: existing } = await supabase
        .from("certification_expiration_notifications")
        .select("id")
        .eq("certification_record_id", cert.id)
        .eq("notification_type", type)
        .maybeSingle();

      if (existing) continue;

      const { data: ct } = await supabase
        .from("certification_types")
        .select("name")
        .eq("id", cert.certification_type_id)
        .single();

      const certName = ct?.name ?? "Certification";
      const expDate = new Date(cert.expires_at).toLocaleDateString();
      const isExpired = type === "expired";
      const title = isExpired
        ? `Certification expired: ${certName}`
        : `Certification expiring in ${days} days: ${certName}`;
      const body = isExpired
        ? `Your ${certName} certification expired on ${expDate}. Renew to maintain compliance.`
        : `Your ${certName} certification expires on ${expDate}. Renew now to maintain compliance.`;

      const { data: ev, error: evErr } = await supabase
        .from("notification_events")
        .insert({
          category: "certification_expiry",
          severity: isExpired ? "high" : "medium",
          target_type: "user",
          target_ref: cert.user_id,
          title,
          body,
          url: "/resources",
          entity_type: "certification",
          entity_id: cert.id,
        })
        .select("id")
        .single();

      if (evErr || !ev) {
        console.error(`[cert-expiration-reminder] event insert failed:`, evErr);
        continue;
      }

      await supabase.from("certification_expiration_notifications").upsert(
        {
          certification_record_id: cert.id,
          notification_type: type,
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
        console.warn(`[cert-expiration-reminder] dispatch failed for ${ev.id}:`, await dispatchRes.text());
      }

      processed++;
    }
  }

  return new Response(JSON.stringify({ success: true, processed }), {
    headers: { "Content-Type": "application/json" },
  });
});
