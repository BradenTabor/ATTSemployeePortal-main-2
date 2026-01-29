// @ts-nocheck
/**
 * notify-admins-new-signup Edge Function
 *
 * INTERNAL ONLY – invoked by a Database Webhook when a row is inserted into app_users.
 * Sends a push notification to all admin-role users when someone signs up and creates an account.
 *
 * Setup:
 * 1. In Supabase Dashboard → Database → Webhooks, create a webhook:
 *    - Table: app_users
 *    - Events: Insert
 *    - URL: https://<project-ref>.supabase.co/functions/v1/notify-admins-new-signup
 *    - HTTP Headers: x-internal-key = <your INTERNAL_SECRET from Edge Function secrets>
 * 2. Ensure INTERNAL_SECRET is set in Edge Function secrets (same as admin-create-notification).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-internal-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET")!;

interface WebhookPayload {
  type: string;
  table: string;
  schema: string;
  record: {
    user_id?: string;
    email?: string | null;
    full_name?: string | null;
    role?: string;
    [key: string]: unknown;
  };
  old_record: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // GET: allow Dashboard URL validation (no auth) so "Webhook not found" does not appear when saving
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, name: "notify-admins-new-signup" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const internalKey = req.headers.get("x-internal-key");
    const authHeader = req.headers.get("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const valid =
      (internalKey && internalKey === INTERNAL_SECRET) ||
      (bearerToken && bearerToken === INTERNAL_SECRET) ||
      (bearerToken && bearerToken === SUPABASE_SERVICE_ROLE_KEY);
    if (!valid) {
      console.error("[notify-admins-new-signup] Unauthorized: invalid or missing x-internal-key or Authorization Bearer (INTERNAL_SECRET or service_role)");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: WebhookPayload = await req.json();

    if (body.type !== "INSERT" || body.table !== "app_users") {
      return new Response(JSON.stringify({ ok: true, skipped: "not an app_users INSERT" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const record = body.record || {};
    const role = record.role ?? "employee";
    const user_id = record.user_id;
    const email = record.email ?? "";
    const full_name = (record.full_name ?? "").trim();

    if (!user_id) {
      console.warn("[notify-admins-new-signup] record missing user_id, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: "no user_id" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role !== "employee") {
      return new Response(JSON.stringify({ ok: true, skipped: "role is not employee" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const displayName = full_name || email || "A new user";
    const title = "New signup";
    const bodyText = `${displayName} just created an account.`;

    // Use null for actor_user_id when user_id is not in auth.users (e.g. curl test with fake UUID)
    // so the insert doesn't violate notification_events_actor_user_id_fkey.
    const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
    const actorUserId = user_id === ZERO_UUID ? null : user_id;
    const entityId = user_id === ZERO_UUID ? null : user_id;

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: event, error: eventError } = await serviceClient
      .from("notification_events")
      .insert({
        category: "admin_notice",
        severity: "medium",
        target_type: "role",
        target_ref: "admin",
        title,
        body: bodyText,
        url: "/admin/users",
        actor_user_id: actorUserId,
        entity_type: "user",
        entity_id: entityId,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      console.error("[notify-admins-new-signup] Failed to create event:", eventError);
      return new Response(
        JSON.stringify({ error: "Failed to create notification event", details: eventError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dispatchUrl = `${SUPABASE_URL}/functions/v1/notifications-dispatch`;
    const dispatchResponse = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-internal-key": INTERNAL_SECRET,
      },
      body: JSON.stringify({ event_id: event.id }),
    });

    if (!dispatchResponse.ok) {
      const errText = await dispatchResponse.text();
      console.error("[notify-admins-new-signup] Dispatch failed:", dispatchResponse.status, errText);
    } else {
      const dispatchResult = await dispatchResponse.json();
      console.log("[notify-admins-new-signup] Dispatched:", dispatchResult);
    }

    const workerUrl = `${SUPABASE_URL}/functions/v1/notifications-worker`;
    try {
      await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-internal-key": INTERNAL_SECRET,
        },
        body: JSON.stringify({}),
      });
    } catch (workerErr) {
      console.error("[notify-admins-new-signup] Worker call failed:", workerErr);
    }

    return new Response(
      JSON.stringify({ ok: true, event_id: event.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[notify-admins-new-signup] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
