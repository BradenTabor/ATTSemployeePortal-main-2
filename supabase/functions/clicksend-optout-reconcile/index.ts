// @ts-nocheck
/**
 * clicksend-optout-reconcile — INTERNAL ONLY
 *
 * Nightly diff of ClickSend opt-out contact list vs app_users opt-out flags.
 * Default: diff-only (no writes). Apply requires body {"apply": true} AND
 * app_settings.sms_optout_reconcile_config.apply_enabled = true.
 *
 * Deploy with --no-verify-jwt. Cron job is created DISABLED in migration.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  computeOptOutReconcileDiff,
  type AppUserOptOutRow,
} from "../_shared/smsOptOut.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-internal-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET")!;
const CLICKSEND_USERNAME = Deno.env.get("CLICKSEND_USERNAME") ?? "";
const CLICKSEND_PASSWORD = Deno.env.get("CLICKSEND_PASSWORD") ?? "";

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

function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

interface ClickSendListRow {
  list_id?: number;
  list_name?: string;
}

interface ClickSendContactRow {
  phone_number?: string;
}

async function fetchClickSendOptOutPhones(): Promise<string[]> {
  const auth = base64Encode(`${CLICKSEND_USERNAME}:${CLICKSEND_PASSWORD}`);
  const headers = {
    Accept: "application/json",
    Authorization: `Basic ${auth}`,
  };

  const listsRes = await fetch("https://rest.clicksend.com/v3/lists?page=1&limit=100", {
    headers,
  });
  if (!listsRes.ok) {
    throw new Error(`ClickSend lists HTTP ${listsRes.status}`);
  }
  const listsJson = await listsRes.json();
  const lists: ClickSendListRow[] = listsJson?.data?.data ?? [];
  const optOutListIds = lists
    .filter((l) => {
      const name = (l.list_name ?? "").toLowerCase();
      return name.includes("opt") && name.includes("out");
    })
    .map((l) => l.list_id)
    .filter((id): id is number => typeof id === "number");

  const phones: string[] = [];
  for (const listId of optOutListIds) {
    const contactsRes = await fetch(
      `https://rest.clicksend.com/v3/lists/${listId}/contacts?page=1&limit=1000`,
      { headers }
    );
    if (!contactsRes.ok) continue;
    const contactsJson = await contactsRes.json();
    const contacts: ClickSendContactRow[] = contactsJson?.data?.data ?? [];
    for (const c of contacts) {
      if (c.phone_number) phones.push(c.phone_number);
    }
  }
  return phones;
}

export async function handleOptOutReconcile(
  req: Request,
  deps?: {
    supabase?: ReturnType<typeof createClient>;
    fetchOptOutPhones?: () => Promise<string[]>;
  }
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json({ ok: true, name: "clicksend-optout-reconcile", mode: "diff-only-by-default" });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!isAuthorized(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase =
    deps?.supabase ??
    createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

  let body: { apply?: boolean } = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  const applyRequested = body.apply === true;

  const { data: settingsRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "sms_optout_reconcile_config")
    .maybeSingle();
  const cfg = settingsRow?.value as Record<string, unknown> | null;
  const applyEnabled = cfg?.apply_enabled === true;

  const { data: appUsersRaw, error: usersError } = await supabase
    .from("app_users")
    .select("user_id, phone_number, sms_operational_opt_out, sms_marketing_opt_out, email")
    .not("email", "ilike", "%@atts.test%");

  if (usersError) {
    console.error("[clicksend-optout-reconcile] app_users query failed", usersError.message);
    return json({ error: "Failed to load app_users" }, 500);
  }

  const appUsers = (appUsersRaw ?? []) as AppUserOptOutRow[];

  if (!CLICKSEND_USERNAME || !CLICKSEND_PASSWORD) {
    const fixtureDiff = computeOptOutReconcileDiff([], appUsers);
    return json({
      skipped: true,
      reason: "credentials_unavailable",
      apply_requested: applyRequested,
      apply_enabled: applyEnabled,
      diff: fixtureDiff,
      message:
        "CLICKSEND_USERNAME and CLICKSEND_PASSWORD not set — diff computed against empty ClickSend list only.",
    });
  }

  let clicksendPhones: string[];
  try {
    clicksendPhones = deps?.fetchOptOutPhones
      ? await deps.fetchOptOutPhones()
      : await fetchClickSendOptOutPhones();
  } catch (err) {
    console.error("[clicksend-optout-reconcile] ClickSend fetch failed", err);
    return json({ error: "Failed to fetch ClickSend opt-out list" }, 500);
  }

  const diff = computeOptOutReconcileDiff(clicksendPhones, appUsers);

  console.log(
    "[clicksend-optout-reconcile] diff summary",
    JSON.stringify(diff.summary)
  );
  if (diff.clicksend_only.length > 0) {
    console.log(
      "[clicksend-optout-reconcile] clicksend_only last4",
      diff.clicksend_only.map((e) => e.phone_last4).join(",")
    );
  }
  if (diff.app_only.length > 0) {
    console.log(
      "[clicksend-optout-reconcile] app_only last4",
      diff.app_only.map((e) => e.phone_last4).join(",")
    );
  }

  if (!applyRequested || !applyEnabled) {
    return json({
      ok: true,
      mode: "diff-only",
      apply_requested: applyRequested,
      apply_enabled: applyEnabled,
      diff,
    });
  }

  let applied = 0;
  for (const entry of diff.clicksend_only) {
    if (!entry.user_id) continue;
    const { error } = await supabase
      .from("app_users")
      .update({
        sms_operational_opt_out: true,
        sms_marketing_opt_out: true,
      })
      .eq("user_id", entry.user_id);
    if (error) {
      console.error("[clicksend-optout-reconcile] apply failed", entry.phone_last4, error.message);
      continue;
    }
    await supabase.from("sms_opt_out_events").insert({
      phone_e164: entry.phone_e164,
      user_id: entry.user_id,
      keyword: "STOP",
      raw_message: null,
      provider_message_id: null,
      source: "reconciliation",
      applied_operational: true,
      applied_marketing: true,
      received_at: new Date().toISOString(),
    });
    applied += 1;
  }

  return json({
    ok: true,
    mode: "apply",
    applied_count: applied,
    diff,
  });
}

Deno.serve((req) => handleOptOutReconcile(req));
