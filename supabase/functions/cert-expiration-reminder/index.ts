// @ts-nocheck
/**
 * Certification Expiration Reminder
 *
 * Run daily via Supabase Cron.
 * 1) Built-in certs: hardcoded [30, 14, 7, 0] days (see plan: data-driven reminder_days for built-in is a follow-up).
 * 2) External certs: per-type reminder_days[] from external_certification_types.
 * Creates notification_events, idempotent log in certification_expiration_notifications, calls notifications-dispatch.
 *
 * Invoke with x-internal-key: INTERNAL_SECRET.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Built-in cert windows (data-driven reminder_days for built-in is a follow-up)
const BUILTIN_WINDOWS = [
  { days: 30, type: "30_day" as const },
  { days: 14, type: "14_day" as const },
  { days: 7, type: "7_day" as const },
  { days: 0, type: "expired" as const },
];

async function dispatchEvent(supabase: ReturnType<typeof createClient>, eventId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "x-internal-key": INTERNAL_SECRET,
    },
    body: JSON.stringify({ event_id: eventId }),
  });
  if (!res.ok) {
    console.warn(`[cert-expiration-reminder] dispatch failed for ${eventId}:`, await res.text());
  }
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

  let processed = 0;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // ---- Built-in certs (existing logic) ----
  for (const { days, type } of BUILTIN_WINDOWS) {
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
      console.error(`[cert-expiration-reminder] built-in ${type} fetch failed:`, certErr);
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
          url: "/profile",
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
      await dispatchEvent(supabase, ev.id);
      processed++;
    }
  }

  // ---- External certs: per-type reminder_days ----
  const { data: extTypes, error: extTypesErr } = await supabase
    .from("external_certification_types")
    .select("id, name, reminder_days")
    .eq("is_active", true);
  if (extTypesErr || !extTypes?.length) {
    if (extTypesErr) console.error("[cert-expiration-reminder] external types fetch failed:", extTypesErr);
  } else {
    for (const extType of extTypes as { id: string; name: string; reminder_days: number[] | null }[]) {
      const reminderDays = Array.isArray(extType.reminder_days) ? extType.reminder_days : [];
      const windows: { days: number; type: string }[] = reminderDays
        .filter((d) => d > 0)
        .map((d) => ({ days: d, type: `${d}_day` }));
      windows.push({ days: 0, type: "expired" });

      for (const { days, type } of windows) {
        let targetDate: string;
        if (days === 0) {
          targetDate = today;
        } else {
          const d = new Date(now);
          d.setDate(d.getDate() + days);
          targetDate = d.toISOString().slice(0, 10);
        }
        const { data: extCerts, error: extCertsErr } = await supabase
          .from("worker_external_certifications")
          .select("id, user_id, expiration_date")
          .eq("status", "active")
          .eq("external_certification_type_id", extType.id)
          .eq("expiration_date", targetDate);
        if (extCertsErr || !extCerts?.length) continue;

        for (const c of extCerts as { id: string; user_id: string; expiration_date: string }[]) {
          const { data: existing } = await supabase
            .from("certification_expiration_notifications")
            .select("id")
            .eq("external_certification_id", c.id)
            .eq("notification_type", type)
            .maybeSingle();
          if (existing) continue;

          const certName = extType.name ?? "Certification";
          const expDate = new Date(c.expiration_date).toLocaleDateString();
          const isExpired = type === "expired";
          const title = isExpired
            ? `Certification expired: ${certName}`
            : `Certification expiring in ${days} days: ${certName}`;
          const body = isExpired
            ? `Your ${certName} certification expired on ${expDate}. Contact HR to renew.`
            : `Your ${certName} certification expires on ${expDate}. Contact HR to renew.`;

          const { data: ev, error: evErr } = await supabase
            .from("notification_events")
            .insert({
              category: "certification_expiry",
              severity: isExpired ? "high" : "medium",
              target_type: "user",
              target_ref: c.user_id,
              title,
              body,
              url: "/profile",
              entity_type: "worker_external_certification",
              entity_id: c.id,
            })
            .select("id")
            .single();
          if (evErr || !ev) continue;

          await supabase.from("certification_expiration_notifications").insert({
            external_certification_id: c.id,
            notification_type: type,
            scheduled_for: now.toISOString(),
            sent_at: now.toISOString(),
          });
          await dispatchEvent(supabase, ev.id);
          processed++;
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true, processed }), {
    headers: { "Content-Type": "application/json" },
  });
});
