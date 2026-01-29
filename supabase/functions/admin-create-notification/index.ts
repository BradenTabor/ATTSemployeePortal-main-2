// @ts-nocheck
/**
 * admin-create-notification Edge Function
 *
 * SECURE GATEWAY for admin users to create and dispatch notifications.
 *
 * Two auth paths:
 * A) User JWT (frontend): Validate Authorization Bearer (user JWT with sub), verify admin role, then create/dispatch.
 * B) Internal (webhooks/cron): Validate x-internal-key === INTERNAL_SECRET. No user JWT required.
 *    Used by signup webhook (app_users INSERT), etc. Handles webhook payload { type, table, record }.
 *
 * Security Flow (user path):
 * 1. Validate auth token from Authorization header (must have sub claim)
 * 2. Query app_users to verify caller has 'admin' role
 * 3. Create notification event in database
 * 4. Call notifications-dispatch internally (server-to-server)
 * 5. Return results to frontend
 *
 * Internal path: skip 1–2, parse body (signup webhook or CreateNotificationRequest), create → dispatch → worker.
 * IMPORTANT: INTERNAL_SECRET is NEVER exposed to frontend.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-internal-key",
};

// Environment variables (set in Supabase Dashboard → Edge Functions → Secrets)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET")!;

// Type definitions (mirrored from frontend for consistency)
type NotificationCategory = "schedule" | "announcement" | "safety_alert" | "job_update" | "rto_decision" | "admin_notice";
type NotificationSeverity = "low" | "medium" | "high" | "critical";
type NotificationTargetType = "all" | "role" | "crew" | "user";

interface CreateNotificationRequest {
  category: NotificationCategory;
  severity: NotificationSeverity;
  target_type: NotificationTargetType;
  target_ref?: string | null;
  title: string;
  body?: string;
  url?: string;
  entity_type?: string;
  entity_id?: string;
  actor_user_id?: string | null;
}

/** Signup webhook payload (app_users INSERT) when using admin-create-notification as target. */
interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: {
    user_id?: string;
    email?: string | null;
    full_name?: string | null;
    role?: string;
    [key: string]: unknown;
  };
  old_record?: unknown;
}

interface SuccessResponse {
  success: true;
  event_id: string;
  dispatched: number;
  skipped: number;
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

Deno.serve(async (req: Request) => {
  // ===========================================
  // Handle CORS preflight
  // ===========================================
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const internalKey = req.headers.get("x-internal-key");
    const isInternal = !!(internalKey && INTERNAL_SECRET && internalKey === INTERNAL_SECRET);

    if (isInternal) {
      // ===========================================
      // Internal path (webhooks, cron): no user JWT required
      // ===========================================
      const rawBody = await req.json();
      const webhook = rawBody as WebhookPayload;

      if (webhook.type === "INSERT" && webhook.table === "app_users" && webhook.record) {
        // Signup webhook payload (e.g. from app_users INSERT trigger)
        const record = webhook.record;
        const role = record.role ?? "employee";
        const user_id = record.user_id;
        const email = record.email ?? "";
        const full_name = (record.full_name ?? "").trim();

        if (!user_id) {
          console.warn("[admin-create-notification] Internal signup: record missing user_id, skipping");
          return new Response(JSON.stringify({ success: true, event_id: "", dispatched: 0, skipped: 0 }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (role !== "employee") {
          return new Response(JSON.stringify({ success: true, event_id: "", dispatched: 0, skipped: 0 }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const displayName = full_name || email || "A new user";
        const title = "New signup";
        const bodyText = `${displayName} just created an account.`;
        const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
        const actorUserId = user_id === ZERO_UUID ? null : user_id;
        const entityId = user_id === ZERO_UUID ? null : user_id;

        const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: event, error: evErr } = await svc
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

        if (evErr || !event) {
          console.error("[admin-create-notification] Internal signup: create event failed", evErr);
          const errRes: ErrorResponse = { success: false, error: "Failed to create notification event", details: evErr?.message };
          return new Response(JSON.stringify(errRes), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const dispatchUrl = `${SUPABASE_URL}/functions/v1/notifications-dispatch`;
        const dispatchRes = await fetch(dispatchUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "x-internal-key": INTERNAL_SECRET,
          },
          body: JSON.stringify({ event_id: event.id }),
        });
        let dispatched = 0;
        let skipped = 0;
        if (dispatchRes.ok) {
          const dr = await dispatchRes.json();
          dispatched = dr.dispatched ?? 0;
          skipped = dr.skipped ?? 0;
        } else {
          console.error("[admin-create-notification] Internal signup: dispatch failed", await dispatchRes.text());
        }

        const workerUrl = `${SUPABASE_URL}/functions/v1/notifications-worker`;
        try {
          await fetch(workerUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "x-internal-key": INTERNAL_SECRET,
            },
            body: JSON.stringify({}),
          });
        } catch (we) {
          console.error("[admin-create-notification] Internal signup: worker failed", we);
        }

        return new Response(JSON.stringify({ success: true, event_id: event.id, dispatched, skipped }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Internal create-notification request (CreateNotificationRequest)
      const body = rawBody as CreateNotificationRequest;
      if (!body.category || !body.severity || !body.target_type || !body.title) {
        const res: ErrorResponse = { success: false, error: "Missing required fields: category, severity, target_type, title" };
        return new Response(JSON.stringify(res), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const validCategories: NotificationCategory[] = ["schedule", "announcement", "safety_alert", "job_update", "rto_decision", "admin_notice"];
      const validSeverities: NotificationSeverity[] = ["low", "medium", "high", "critical"];
      const validTargetTypes: NotificationTargetType[] = ["all", "role", "crew", "user"];
      if (!validCategories.includes(body.category) || !validSeverities.includes(body.severity) || !validTargetTypes.includes(body.target_type)) {
        const res: ErrorResponse = { success: false, error: "Invalid category, severity, or target_type" };
        return new Response(JSON.stringify(res), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if ((body.target_type === "role" || body.target_type === "crew") && !body.target_ref) {
        const res: ErrorResponse = { success: false, error: `target_ref required for target_type '${body.target_type}'` };
        return new Response(JSON.stringify(res), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (body.target_type === "user" && !body.target_ref) {
        const res: ErrorResponse = { success: false, error: "target_ref required for target_type 'user' when using internal auth" };
        return new Response(JSON.stringify(res), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const actorUserId = body.actor_user_id ?? null;
      const targetRef = body.target_ref ?? null;
      const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: event, error: evErr } = await svc
        .from("notification_events")
        .insert({
          category: body.category,
          severity: body.severity,
          target_type: body.target_type,
          target_ref: targetRef,
          title: body.title,
          body: body.body ?? null,
          url: body.url ?? null,
          actor_user_id: actorUserId,
          entity_type: body.entity_type ?? null,
          entity_id: body.entity_id ?? null,
        })
        .select("id")
        .single();

      if (evErr || !event) {
        const errRes: ErrorResponse = { success: false, error: "Failed to create notification event", details: evErr?.message };
        return new Response(JSON.stringify(errRes), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const dispatchUrl = `${SUPABASE_URL}/functions/v1/notifications-dispatch`;
      const dispatchRes = await fetch(dispatchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "x-internal-key": INTERNAL_SECRET },
        body: JSON.stringify({ event_id: event.id }),
      });
      let dispatched = 0;
      let skipped = 0;
      if (dispatchRes.ok) {
        const dr = await dispatchRes.json();
        dispatched = dr.dispatched ?? 0;
        skipped = dr.skipped ?? 0;
      }
      const workerUrl = `${SUPABASE_URL}/functions/v1/notifications-worker`;
      try {
        await fetch(workerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "x-internal-key": INTERNAL_SECRET },
          body: JSON.stringify({}),
        });
      } catch (_) {}
      return new Response(JSON.stringify({ success: true, event_id: event.id, dispatched, skipped }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===========================================
    // User path: require JWT with sub + admin role
    // ===========================================
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[admin-create-notification] Missing authorization header");
      return new Response(JSON.stringify({ success: false, error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("[admin-create-notification] Invalid auth token:", userError?.message);
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redactedUserId = user.id.substring(0, 4) + "..." + user.id.substring(user.id.length - 4);
    console.log(`[admin-create-notification] Authenticated user: ${redactedUserId}`);

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: appUser, error: appUserError } = await serviceClient
      .from("app_users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (appUserError || !appUser) {
      console.error("[admin-create-notification] Failed to fetch app_user:", appUserError?.message);
      return new Response(JSON.stringify({ success: false, error: "User profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (appUser.role !== "admin") {
      console.warn(`[admin-create-notification] Non-admin user attempted access: ${redactedUserId} (role: ${appUser.role})`);
      return new Response(JSON.stringify({ success: false, error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`[admin-create-notification] Admin access verified for user: ${redactedUserId}`);

    const body: CreateNotificationRequest = await req.json();

    // Validate required fields
    if (!body.category || !body.severity || !body.target_type || !body.title) {
      console.error("[admin-create-notification] Missing required fields");
      const response: ErrorResponse = { 
        success: false, 
        error: "Missing required fields: category, severity, target_type, title" 
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate category
    const validCategories: NotificationCategory[] = ["schedule", "announcement", "safety_alert", "job_update", "rto_decision", "admin_notice"];
    if (!validCategories.includes(body.category)) {
      const response: ErrorResponse = { success: false, error: `Invalid category: ${body.category}` };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate severity
    const validSeverities: NotificationSeverity[] = ["low", "medium", "high", "critical"];
    if (!validSeverities.includes(body.severity)) {
      const response: ErrorResponse = { success: false, error: `Invalid severity: ${body.severity}` };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate target_type
    const validTargetTypes: NotificationTargetType[] = ["all", "role", "crew", "user"];
    if (!validTargetTypes.includes(body.target_type)) {
      const response: ErrorResponse = { success: false, error: `Invalid target_type: ${body.target_type}` };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate target_ref is provided when needed
    if ((body.target_type === "role" || body.target_type === "crew") && !body.target_ref) {
      const response: ErrorResponse = { 
        success: false, 
        error: `target_ref is required when target_type is '${body.target_type}'` 
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[admin-create-notification] Creating event:`, {
      category: body.category,
      severity: body.severity,
      target_type: body.target_type,
      target_ref: body.target_ref,
      title: body.title.substring(0, 50),
    });

    // ===========================================
    // Step 4: Create Notification Event in Database
    // ===========================================
    // Reuse service role client (from admin check) for inserting into notification_events
    // For "user" target type with "Just Me" option, use the current user's ID
    const targetRef = body.target_type === "user" && !body.target_ref 
      ? user.id 
      : body.target_ref;

    const { data: event, error: eventError } = await serviceClient
      .from("notification_events")
      .insert({
        category: body.category,
        severity: body.severity,
        target_type: body.target_type,
        target_ref: targetRef,
        title: body.title,
        body: body.body || null,
        url: body.url || null,
        actor_user_id: user.id, // Audit trail: who created this notification
        entity_type: body.entity_type || null,
        entity_id: body.entity_id || null,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      console.error("[admin-create-notification] Failed to create event:", eventError);
      const response: ErrorResponse = { 
        success: false, 
        error: "Failed to create notification event",
        details: eventError?.message,
      };
      return new Response(JSON.stringify(response), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[admin-create-notification] Event created: ${event.id}`);

    // ===========================================
    // Step 5: Call notifications-dispatch (Server-to-Server)
    // ===========================================
    // This internal call uses INTERNAL_SECRET - NEVER exposed to frontend
    const dispatchUrl = `${SUPABASE_URL}/functions/v1/notifications-dispatch`;
    
    const dispatchResponse = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-internal-key": INTERNAL_SECRET, // Server-side only secret
      },
      body: JSON.stringify({ event_id: event.id }),
    });

    if (!dispatchResponse.ok) {
      const errorText = await dispatchResponse.text();
      console.error("[admin-create-notification] Dispatch failed:", dispatchResponse.status, errorText);
      
      // Event was created, but dispatch failed - return partial success
      const response: SuccessResponse = {
        success: true,
        event_id: event.id,
        dispatched: 0,
        skipped: 0,
      };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dispatchResult = await dispatchResponse.json();
    console.log(`[admin-create-notification] Dispatch complete:`, dispatchResult);

    // ===========================================
    // Step 6: Call notifications-worker to send push notifications
    // ===========================================
    // Trigger the worker to process the outbox immediately
    const workerUrl = `${SUPABASE_URL}/functions/v1/notifications-worker`;
    
    try {
      const workerResponse = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-internal-key": INTERNAL_SECRET,
        },
        body: JSON.stringify({}),
      });

      if (workerResponse.ok) {
        const workerResult = await workerResponse.json();
        console.log(`[admin-create-notification] Worker complete:`, workerResult);
      } else {
        console.warn(`[admin-create-notification] Worker returned non-200:`, workerResponse.status);
      }
    } catch (workerError) {
      // Don't fail the request if worker fails - notifications are still in outbox
      console.error("[admin-create-notification] Worker call failed:", workerError);
    }

    // ===========================================
    // Step 7: Return Success Response
    // ===========================================
    const response: SuccessResponse = {
      success: true,
      event_id: event.id,
      dispatched: dispatchResult.dispatched || 0,
      skipped: dispatchResult.skipped || 0,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[admin-create-notification] Unexpected error:", error);
    const response: ErrorResponse = { 
      success: false, 
      error: "Internal server error",
      details: error instanceof Error ? error.message : undefined,
    };
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

