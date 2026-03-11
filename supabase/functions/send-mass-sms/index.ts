// @ts-nocheck
/**
 * send-mass-sms Edge Function
 *
 * Admin-only: send a single mass SMS to all app users with a phone number who have
 * not opted out (sms_marketing_opt_out = false). Dry run by default; only send when
 * dryRun === false. Cooldown: 15 min after a completed send. Audit log: mass_sms_log
 * with status (completed | partial | failed) and batch_details.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS } from "../_shared/clicksend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLICKSEND_USERNAME = Deno.env.get("CLICKSEND_USERNAME") ?? "";
const CLICKSEND_PASSWORD = Deno.env.get("CLICKSEND_PASSWORD") ?? "";
const CLICKSEND_FROM_NUMBER = Deno.env.get("CLICKSEND_FROM_NUMBER") ?? "";
const COOLDOWN_MINUTES = 15;
const BATCH_SIZE = 500;
const MAX_MESSAGE_LENGTH = 480;
const MESSAGE_PREVIEW_LENGTH = 80;

function toE164(phone: string | null | undefined): string | null {
  const raw = (phone ?? "").trim().replace(/\D/g, "");
  if (!raw || raw.length < 10) return null;
  return raw.startsWith("1") && raw.length === 11 ? `+${raw}` : `+1${raw}`;
}

/** Strip non-GSM-7 characters so segment count stays predictable (160 chars/segment). */
function toGsm7(body: string): string {
  return body.replace(/[^\x20-\x7E\n\r]/g, " ").replace(/\s+/g, " ").trim();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Missing authorization header" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: appUser, error: appErr } = await svc
      .from("app_users")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (appErr || !appUser || appUser.role !== "admin") {
      return json({ success: false, error: "Forbidden: Admin access required" }, 403);
    }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const MAX_SELECTED_USERS = 500;

    let body: { dryRun?: boolean; message?: string; user_ids?: string[] } = {};
    try {
      body = (await req.json()) as { dryRun?: boolean; message?: string; user_ids?: string[] };
    } catch {
      return json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const dryRun = body.dryRun !== false;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const rawUserIds = Array.isArray(body.user_ids) ? body.user_ids : undefined;
    const filtered = rawUserIds
      ? rawUserIds.filter((id) => typeof id === "string" && UUID_REGEX.test(id)).slice(0, MAX_SELECTED_USERS)
      : [];
    const userIds = rawUserIds === undefined ? undefined : filtered;
    if (rawUserIds?.length && filtered.length === 0) {
      return json({ success: false, error: "user_ids must be an array of valid UUIDs" }, 400);
    }

    const baseRecipientFilter = () => {
      let q = svc
        .from("app_users")
        .select("user_id, phone_number, sms_marketing_opt_out")
        .not("phone_number", "is", null)
        .limit(10000);
      if (userIds?.length) {
        q = q.in("user_id", userIds);
      }
      return q;
    };

    if (dryRun) {
      const { count: totalUsers } = await svc.from("app_users").select("*", { count: "exact", head: true });
      const { data: phoneRows } = await baseRecipientFilter();
      const countWithPhone = (phoneRows ?? []).filter(
        (r: { phone_number?: string | null; sms_marketing_opt_out?: boolean | null }) => {
          const phone = r.phone_number != null ? String(r.phone_number).trim() : "";
          const optedOut = r.sms_marketing_opt_out === true;
          return phone !== "" && !optedOut;
        }
      ).length;
      return json({
        countWithPhone,
        totalUsers: totalUsers ?? 0,
        fromNumber: CLICKSEND_FROM_NUMBER || null,
      });
    }

    if (!message) {
      return json({ success: false, error: "message is required when sending" }, 400);
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return json({ success: false, error: `message must be at most ${MAX_MESSAGE_LENGTH} characters` }, 400);
    }

    const isSendToAll = !userIds?.length;
    if (isSendToAll) {
      const cooldownSince = new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
      const { data: recentCompleted } = await svc
        .from("mass_sms_log")
        .select("id")
        .eq("status", "completed")
        .gte("created_at", cooldownSince)
        .limit(1);
      if (recentCompleted?.length) {
        return json(
          { success: false, error: "Mass SMS cooldown: wait 15 minutes between blasts." },
          429
        );
      }
    }

    const { data: rows } = await baseRecipientFilter();
    const recipients: { to: string }[] = [];
    for (const r of rows ?? []) {
      if (r.sms_marketing_opt_out === true) continue;
      const phone = r.phone_number != null ? String(r.phone_number).trim() : "";
      if (!phone) continue;
      const e164 = toE164(phone);
      if (e164) recipients.push({ to: e164 });
    }

    if (recipients.length === 0) {
      return json({ success: false, error: "No recipients with valid phone numbers" }, 400);
    }

    const bodyText = toGsm7(message);
    const batches: { index: number; sent: number; failed: number; error?: string }[] = [];
    let totalSent = 0;
    let totalFailed = 0;
    let totalPrice = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);
      const messages = chunk.map((r) => ({ to: r.to, body: bodyText }));
      const result = await sendSMS(messages, {
        username: CLICKSEND_USERNAME,
        password: CLICKSEND_PASSWORD,
        from: CLICKSEND_FROM_NUMBER || undefined,
      });
      const batchIndex = Math.floor(i / BATCH_SIZE);
      const sent = result.results?.filter((r) => r.status === "SUCCESS" || r.status === "THROTTLED").length ?? 0;
      const failed = (result.results?.length ?? 0) - sent;
      totalSent += sent;
      totalFailed += failed;
      totalPrice += result.totalPrice ?? 0;
      batches.push({
        index: batchIndex,
        sent,
        failed,
        error: result.error ?? undefined,
      });
      if (!result.success && result.error) {
        const remaining = recipients.length - (i + chunk.length);
        if (remaining > 0) {
          batches.push({
            index: batchIndex + 1,
            sent: 0,
            failed: remaining,
            error: "Not sent due to previous batch failure",
          });
          totalFailed += remaining;
        }
        break;
      }
    }

    const allSuccess = totalFailed === 0;
    const anySuccess = totalSent > 0;
    const status = allSuccess ? "completed" : anySuccess ? "partial" : "failed";
    const messagePreview = bodyText.slice(0, MESSAGE_PREVIEW_LENGTH);

    await svc.from("mass_sms_log").insert({
      admin_user_id: user.id,
      message_preview: messagePreview,
      sent_count: totalSent,
      failed_count: totalFailed,
      total_price: totalPrice,
      status,
      batch_details: batches,
    });

    return json({
      success: allSuccess,
      sent: totalSent,
      failed: totalFailed,
      totalPrice,
      batches,
      error: allSuccess ? undefined : "Some batches failed. Check batches array.",
    });
  } catch (e) {
    console.error("[send-mass-sms]", e);
    return json(
      { success: false, error: "Internal server error", details: (e as Error).message },
      500
    );
  }
});
