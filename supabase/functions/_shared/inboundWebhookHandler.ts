/**
 * clicksend-inbound-webhook handler — Deno-free for Vitest.
 * index.ts wires env + Deno.serve and calls this.
 */

import { toE164 } from "./phoneE164.ts";
import {
  optOutFlagsForKeyword,
  parseInboundKeyword,
} from "./smsOptOut.ts";
import {
  isAuthorized,
  parseInboundBody,
  receivedAtFromPayload,
  redactUrl,
  resolveInboundMessageText,
  type WebhookAuthSecrets,
} from "./inboundWebhookHelpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-internal-key",
};

type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

/** Minimal thenable query builder — matches the chains this handler uses. */
export type InboundWebhookQuery = PromiseLike<QueryResult> & {
  select: (cols: string) => InboundWebhookQuery;
  eq: (col: string, val: unknown) => InboundWebhookQuery;
  not: (col: string, op: string, val: unknown) => InboundWebhookQuery;
  maybeSingle: () => PromiseLike<QueryResult>;
  update: (values: Record<string, unknown>) => InboundWebhookQuery;
  insert: (values: Record<string, unknown>) => PromiseLike<QueryResult>;
};

export type InboundWebhookSupabase = {
  from: (table: string) => InboundWebhookQuery;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleInboundWebhook(
  req: Request,
  deps: {
    supabase: InboundWebhookSupabase;
    secrets: WebhookAuthSecrets;
    now?: () => Date;
  },
): Promise<Response> {
  const safeUrl = redactUrl(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json({ ok: true, name: "clicksend-inbound-webhook" });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!isAuthorized(req, deps.secrets)) {
    console.error(`[clicksend-inbound-webhook] Unauthorized url=${safeUrl}`);
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = deps.supabase;
  const now = deps.now ?? (() => new Date());

  try {
    const { data: settingsRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "sms_inbound_webhook_config")
      .maybeSingle();
    const cfg = (settingsRow as { value?: Record<string, unknown> } | null)?.value ?? null;
    if (cfg?.enabled === false) {
      return json({ skipped: true, reason: "disabled" });
    }

    const contentType = req.headers.get("content-type");
    const text = await req.text();
    const parsed = parseInboundBody(contentType, text);
    if (!parsed.ok) {
      console.warn(
        `[clicksend-inbound-webhook] unparseable body url=${safeUrl} content-type=${contentType ?? "(missing)"}`,
      );
      return json({ skipped: true, reason: "unparseable_body" });
    }

    const payload = parsed.payload;
    const providerMessageId = payload.message_id?.trim() || null;
    // Explicit helper — do NOT use ?? here; empty/whitespace body must fall through.
    const rawMessage = resolveInboundMessageText(
      payload.body,
      payload.original_body,
    );
    const keyword = parseInboundKeyword(rawMessage);
    const phoneE164 = toE164(payload.from);

    if (payload.timestamp_send != null) {
      console.warn(
        `[clicksend-inbound-webhook] non-authoritative timestamp_send=${String(payload.timestamp_send)} (not used for received_at)`,
      );
    }

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

    // Both body and original_body empty/whitespace → still audit the row, distinct reason.
    if (!rawMessage) {
      const { data: emptyMatchedUsers } = await supabase
        .from("app_users")
        .select("user_id, phone_number, sms_operational_opt_out, sms_marketing_opt_out, email")
        .not("email", "ilike", "%@atts.test%");
      const emptyUsers = (emptyMatchedUsers as Array<{
        user_id: string;
        phone_number: string | null;
      }> | null) ?? [];
      const emptyUser =
        emptyUsers.find((u) => toE164(u.phone_number) === phoneE164) ?? null;

      const emptyInsert = await supabase.from("sms_opt_out_events").insert({
        phone_e164: phoneE164,
        user_id: emptyUser?.user_id ?? null,
        keyword: "OTHER",
        raw_message: "",
        provider_message_id: providerMessageId,
        source: "webhook",
        applied_operational: false,
        applied_marketing: false,
        received_at: receivedAtFromPayload(payload, now),
      });
      if (emptyInsert.error) {
        if (emptyInsert.error.code === "23505" && providerMessageId) {
          return json({ skipped: true, reason: "duplicate" });
        }
        console.error(
          `[clicksend-inbound-webhook] empty_body insert failed url=${safeUrl}`,
          emptyInsert.error.message,
        );
        return json({ error: "Failed to log opt-out event" }, 500);
      }
      console.warn(
        `[clicksend-inbound-webhook] empty_body url=${safeUrl} provider_message_id=${providerMessageId ?? "(none)"}`,
      );
      return json({ skipped: true, reason: "empty_body" });
    }

    const { data: matchedUsers } = await supabase
      .from("app_users")
      .select("user_id, phone_number, sms_operational_opt_out, sms_marketing_opt_out, email")
      .not("email", "ilike", "%@atts.test%");

    const users = (matchedUsers as Array<{
      user_id: string;
      phone_number: string | null;
      sms_operational_opt_out: boolean;
      sms_marketing_opt_out: boolean;
      email: string | null;
    }> | null) ?? [];

    const user = users.find((u) => toE164(u.phone_number) === phoneE164) ?? null;

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
          console.error(
            `[clicksend-inbound-webhook] app_users update failed url=${safeUrl}`,
            (updateError as { message?: string }).message,
          );
          return json({ error: "Failed to update opt-out flags" }, 500);
        }
        appliedOperational = needsOperational;
        appliedMarketing = needsMarketing;
        user.sms_operational_opt_out = flagUpdate.operational;
        user.sms_marketing_opt_out = flagUpdate.marketing;
      }
    }

    const insertResult = await supabase.from("sms_opt_out_events").insert({
      phone_e164: phoneE164,
      user_id: user?.user_id ?? null,
      keyword,
      raw_message: rawMessage,
      provider_message_id: providerMessageId,
      source: "webhook",
      applied_operational: appliedOperational,
      applied_marketing: appliedMarketing,
      received_at: receivedAtFromPayload(payload, now),
    });

    const insertError = insertResult.error;
    if (insertError) {
      if (insertError.code === "23505" && providerMessageId) {
        return json({ skipped: true, reason: "duplicate" });
      }
      console.error(
        `[clicksend-inbound-webhook] insert failed url=${safeUrl}`,
        insertError.message,
      );
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
    console.error(`[clicksend-inbound-webhook] unexpected error url=${safeUrl}`, err);
    return json({ error: "Internal server error" }, 500);
  }
}
