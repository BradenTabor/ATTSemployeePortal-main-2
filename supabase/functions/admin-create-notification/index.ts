// @ts-nocheck
/**
 * admin-create-notification Edge Function
 * 
 * SECURE GATEWAY for admin users to create and dispatch notifications.
 * 
 * Security Flow:
 * 1. Validate auth token from Authorization header
 * 2. Query app_users to verify caller has 'admin' role
 * 3. Create notification event in database
 * 4. Call notifications-dispatch internally (server-to-server)
 * 5. Return results to frontend
 * 
 * IMPORTANT: INTERNAL_SECRET is NEVER exposed to frontend.
 * This function acts as the secure gateway between frontend and internal dispatch.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
    // ===========================================
    // Step 1: Validate Authorization Header
    // ===========================================
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      console.error("[admin-create-notification] Missing authorization header");
      const response: ErrorResponse = { success: false, error: "Missing authorization header" };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's auth token to validate their identity
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("[admin-create-notification] Invalid auth token:", userError?.message);
      const response: ErrorResponse = { success: false, error: "Unauthorized" };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[admin-create-notification] Authenticated user: ${user.id}`);

    // ===========================================
    // Step 2: Verify Admin Role
    // ===========================================
    const { data: appUser, error: appUserError } = await userClient
      .from("app_users")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (appUserError || !appUser) {
      console.error("[admin-create-notification] Failed to fetch app_user:", appUserError?.message);
      const response: ErrorResponse = { success: false, error: "User profile not found" };
      return new Response(JSON.stringify(response), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (appUser.role !== "admin") {
      console.warn(`[admin-create-notification] Non-admin user attempted access: ${user.id} (role: ${appUser.role})`);
      const response: ErrorResponse = { success: false, error: "Forbidden: Admin access required" };
      return new Response(JSON.stringify(response), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[admin-create-notification] Admin access verified for user: ${user.id}`);

    // ===========================================
    // Step 3: Parse and Validate Request Body
    // ===========================================
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
    // Use service role client for inserting into notification_events
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

