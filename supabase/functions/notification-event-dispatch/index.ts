// @ts-nocheck
/**
 * notification-event-dispatch Edge Function
 *
 * Invoked by a Supabase Database Webhook when a row is INSERTed into notification_events.
 * Forwards the new event to notifications-dispatch so outbox rows are created and push
 * notifications are sent. Used by trigger-created events (e.g. external cert grant/revocation).
 *
 * Setup (one-time):
 * 1. Deploy this function: supabase functions deploy notification-event-dispatch
 * 2. In Supabase Dashboard → Database → Webhooks → Create a new webhook:
 *    - Name: e.g. "Dispatch on notification_events insert"
 *    - Table: notification_events
 *    - Events: Insert
 *    - Type: Supabase Edge Functions
 *    - Function: notification-event-dispatch
 *    - Or HTTP: URL = https://<project-ref>.supabase.co/functions/v1/notification-event-dispatch
 *      Headers: x-internal-key = <INTERNAL_SECRET from Edge Function secrets>
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-internal-key",
};

interface WebhookPayload {
  type: string;
  table: string;
  schema: string;
  record: { id?: string; [key: string]: unknown };
  old_record: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, name: "notification-event-dispatch" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const key = req.headers.get("x-internal-key");
  if (!key || key !== INTERNAL_SECRET) {
    console.error("[notification-event-dispatch] Unauthorized: missing or invalid x-internal-key");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = (await req.json()) as WebhookPayload;
    if (body.type !== "INSERT" || body.table !== "notification_events") {
      return new Response(
        JSON.stringify({ ok: true, skipped: "not notification_events INSERT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventId = body.record?.id;
    if (!eventId || typeof eventId !== "string") {
      console.error("[notification-event-dispatch] Missing or invalid record.id");
      return new Response(
        JSON.stringify({ error: "Missing record.id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dispatchRes = await fetch(`${SUPABASE_URL}/functions/v1/notifications-dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-internal-key": INTERNAL_SECRET,
      },
      body: JSON.stringify({ event_id: eventId }),
    });

    if (!dispatchRes.ok) {
      const errText = await dispatchRes.text();
      console.error("[notification-event-dispatch] dispatch failed:", dispatchRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Dispatch failed", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await dispatchRes.json();
    console.log("[notification-event-dispatch] Dispatched event:", eventId, result);
    return new Response(
      JSON.stringify({ ok: true, event_id: eventId, dispatched: result.dispatched ?? 0, skipped: result.skipped ?? 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[notification-event-dispatch] Error:", e);
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
