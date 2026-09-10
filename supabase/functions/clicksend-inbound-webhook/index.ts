// @ts-nocheck
/**
 * clicksend-inbound-webhook — INTERNAL ONLY
 *
 * ClickSend POSTs inbound SMS (STOP/START/HELP) to this URL as
 * application/x-www-form-urlencoded (confirmed help article + support 2026-09-09).
 * JSON is still accepted for internal/synthetic tests.
 *
 * Auth (any one):
 *   1. x-internal-key / Authorization Bearer INTERNAL_SECRET or service role (headers first)
 *   2. ?k=<CLICKSEND_WEBHOOK_SECRET> (additive; disabled when secret unset)
 *
 * Deploy with --no-verify-jwt.
 * Policy (Braden): STOP sets both sms_operational_opt_out and sms_marketing_opt_out.
 * Never sends a reply SMS from this function.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleInboundWebhook as handleInboundWebhookCore } from "../_shared/inboundWebhookHandler.ts";
import type { WebhookAuthSecrets } from "../_shared/inboundWebhookHelpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET")!;
const CLICKSEND_WEBHOOK_SECRET = Deno.env.get("CLICKSEND_WEBHOOK_SECRET");

function defaultSecrets(): WebhookAuthSecrets {
  return {
    internalSecret: INTERNAL_SECRET,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    webhookSecret: CLICKSEND_WEBHOOK_SECRET,
  };
}

export async function handleInboundWebhook(
  req: Request,
  deps?: {
    supabase?: ReturnType<typeof createClient>;
    now?: () => Date;
    secrets?: WebhookAuthSecrets;
  },
): Promise<Response> {
  const supabase =
    deps?.supabase ??
    createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

  return handleInboundWebhookCore(req, {
    supabase,
    secrets: deps?.secrets ?? defaultSecrets(),
    now: deps?.now,
  });
}

Deno.serve((req) => handleInboundWebhook(req));
