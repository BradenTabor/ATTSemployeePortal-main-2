// @ts-nocheck
/**
 * clicksend-inbound-webhook — INTERNAL ONLY
 *
 * ClickSend POSTs inbound SMS (STOP/START/HELP) to this URL.
 * Auth: x-internal-key == INTERNAL_SECRET, or Bearer service role / INTERNAL_SECRET.
 * Deploy with --no-verify-jwt.
 *
 * Policy (Braden): STOP sets both sms_operational_opt_out and sms_marketing_opt_out.
 * Never sends a reply SMS from this function.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { toE164 } from "../_shared/phoneE164.ts";
import {
  optOutFlagsForKeyword,
  parseInboundKeyword,
  type OptOutKeyword,
} from "../_shared/smsOptOut.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-internal-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET")!;

interface ClickSendInboundPayload {
  message_id?: string;
  from?: string;
  to?: string;
  body?: string;
  timestamp?: number;
  original_body?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  const internalKey = req.headers.get("x-internal-key");
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return (
    (internalKey != null && internalKey === INTERNAL_SECRET) ||
    (bearerToken != null && bearerToken === INTERNAL_SECRET) ||
    (bearerToken != null && bearerToken === SUPABASE_SERVICE_ROLE_KEY)
  );
}

function receivedAtFromPayload(payload: ClickSendInboundPayload): string {
  if (typeof payload.timestamp === "number" && payload.timestamp > 0) {
    const ms = payload.timestamp > 1_000_000_000_000 ? payload.timestamp : payload.timestamp * 1000;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

export async function handleInboundWebhook(
  req: Request,
  deps?: {
    supabase?: ReturnType<typeof createClient>;
    now?: () => Date;
  }
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json({ ok: true, name: "clicksend-inbound-webhook" });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!isAuthorized(req)) {
    console.error("[clicksend-inbound-webhook] Unauthorized");
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase =
    deps?.supabase ??
    createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

  try {
    const { data: settingsRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "sms_inbound_webhook_config")
      .maybeSingle();
    const cfg = settingsRow?.value as Record<string, unknown> | null;
    if (cfg?.enabled === false) {
      return json({ skipped: true, reason: "disabled" });
    }

    const payload = (await req.json()) as ClickSendInboundPayload;
    const providerMessageId = payload.message_id?.trim() || null;
    const rawMessage = payload.body ?? payload.original_body ?? "";
    const keyword = parseInboundKeyword(rawMessage);
    const phoneE164 = toE164(payload.from);

    if (!phoneE164) {
      return json({ skipped: true, reason: "invalid_sender_phone" });
    }

    if (providerMessageId) {
      const { data: existing } = await supabase
        .from("sms_opt_out_events")
        .select("id")
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();
      if (existing) {
        return json({ skipped: true, reason: "duplicate" });
      }
    }

    const { data: matchedUsers } = await supabase
      .from("app_users")
      .select("user_id, phone_number, sms_operational_opt_out, sms_marketing_opt_out, email")
      .not("email", "ilike", "%@atts.test%");

    const user =
      (matchedUsers ?? []).find((u) => toE164(u.phone_number) === phoneE164) ?? null;

    const flagUpdate = optOutFlagsForKeyword(keyword);
    let appliedOperational = false;
    let appliedMarketing = false;

    if (flagUpdate && user) {
      const needsOperational = user.sms_operational_opt_out !== flagUpdate.operational;
      const needsMarketing = user.sms_marketing_opt_out !== flagUpdate.marketing;
      if (needsOperational || needsMarketing) {
        const { error: updateError } = await supabase
          .from("app_users")
          .update({
            sms_operational_opt_out: flagUpdate.operational,
            sms_marketing_opt_out: flagUpdate.marketing,
          })
          .eq("user_id", user.user_id);
        if (updateError) {
          console.error("[clicksend-inbound-webhook] app_users update failed", updateError.message);
          return json({ error: "Failed to update opt-out flags" }, 500);
        }
        appliedOperational = needsOperational;
        appliedMarketing = needsMarketing;
      }
    }

    const { error: insertError } = await supabase.from("sms_opt_out_events").insert({
      phone_e164: phoneE164,
      user_id: user?.user_id ?? null,
      keyword,
      raw_message: rawMessage,
      provider_message_id: providerMessageId,
      source: "webhook",
      applied_operational: appliedOperational,
      applied_marketing: appliedMarketing,
      received_at: receivedAtFromPayload(payload),
    });

    if (insertError) {
      if (insertError.code === "23505" && providerMessageId) {
        return json({ skipped: true, reason: "duplicate" });
      }
      console.error("[clicksend-inbound-webhook] insert failed", insertError.message);
      return json({ error: "Failed to log opt-out event" }, 500);
    }

    if (!flagUpdate) {
      return json({
        skipped: true,
        reason: keyword === "HELP" ? "help_logged" : "unknown_keyword",
        keyword,
      });
    }

    return json({
      ok: true,
      keyword,
      user_id: user?.user_id ?? null,
      applied_operational: appliedOperational,
      applied_marketing: appliedMarketing,
    });
  } catch (err) {
    console.error("[clicksend-inbound-webhook] unexpected error", err);
    return json({ error: "Internal server error" }, 500);
  }
}

Deno.serve((req) => handleInboundWebhook(req));
