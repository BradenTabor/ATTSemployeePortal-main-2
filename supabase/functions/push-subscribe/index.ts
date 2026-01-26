// @ts-nocheck
/**
 * push-subscribe Edge Function
 * 
 * Registers Web Push subscriptions for authenticated users.
 * Called by the frontend when a user enables push notifications.
 * 
 * Security:
 * - Requires valid auth token
 * - Subscriptions are linked to authenticated user
 * - Upserts to handle re-subscription after revocation
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface SubscribeRequest {
  subscription: PushSubscriptionJSON;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[push-subscribe] Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("[push-subscribe] Unauthorized:", userError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SEC-005: Redact user ID in logs
    const redactedUserId = user.id.substring(0, 4) + '...' + user.id.substring(user.id.length - 4);
    console.log(`[push-subscribe] User authenticated: ${redactedUserId}`);

    // Parse request body
    const body: SubscribeRequest = await req.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      console.error("[push-subscribe] Invalid subscription format");
      return new Response(
        JSON.stringify({ error: "Invalid subscription format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for database operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Upsert subscription (handles both new and re-activation)
    const { error: upsertError } = await serviceClient
      .from("push_subscriptions")
      .upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: req.headers.get("User-Agent") || "unknown",
        revoked_at: null, // Re-activate if previously revoked
        created_at: new Date().toISOString(),
      }, { 
        onConflict: "endpoint",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("[push-subscribe] Database error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[push-subscribe] Subscription saved for user ${redactedUserId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[push-subscribe] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

