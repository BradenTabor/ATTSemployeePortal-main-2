// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UnblockUserRequest {
  userId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: appUser, error: appUserError } = await supabaseClient
      .from("app_users")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (appUserError || !appUser || appUser.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as UnblockUserRequest;
    const { userId } = body;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId === user.id) {
      return new Response(JSON.stringify({ error: "Cannot unblock yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: targetAuth, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getErr || !targetAuth?.user) {
      return new Response(JSON.stringify({ error: "User not found", details: getErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const targetEmail = targetAuth.user.email ?? "unknown";

    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: "0s",
    });
    if (banErr) {
      console.error("Failed to remove ban:", banErr);
      return new Response(JSON.stringify({ error: "Failed to unblock user", details: banErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("app_users")
      .update({
        status: "active",
        blocked_at: null,
        blocked_reason: null,
      })
      .eq("user_id", userId);
    if (updateErr) {
      console.error("Failed to update app_users status:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to update user status", details: updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: logErr } = await supabaseAdmin.from("user_management_log").insert({
      action_type: "unblock",
      target_user_id: userId,
      target_user_email: targetEmail,
      performed_by_user_id: appUser.id,
      reason: null,
    });
    if (logErr) {
      console.error("Failed to write audit log:", logErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: "User unblocked successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("unblock-user error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
