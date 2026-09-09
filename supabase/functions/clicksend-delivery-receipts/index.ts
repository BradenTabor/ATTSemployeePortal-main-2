// @ts-nocheck
/**
 * clicksend-delivery-receipts — INTERNAL ONLY
 *
 * Pulls carrier delivery outcomes from ClickSend (GET /v3/sms/history) and records
 * them next to — never over — the submission response we captured at send time.
 *
 * Pull, not push: /v3/sms/history needs no dashboard rule, is re-readable (so the
 * same window can be ingested twice with no effect), and cannot be silently broken
 * by a misconfigured callback on an account we share with an external app.
 *
 * Default is diff-only. Writes require body {"apply": true} AND
 * app_settings.sms_delivery_receipts_config.enabled = true.
 *
 * Deploy with --no-verify-jwt. Cron job is created DISABLED in the migration.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildDeliveryReceipts,
  matchReceiptsToLogRows,
  summariseReceipts,
  type ClickSendHistoryRow,
  type DeliveryReceipt,
} from "../_shared/smsDeliveryReceipts.ts";

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
/** Overridable so local end-to-end runs can serve fixture receipts. Production never sets it. */
const CLICKSEND_API_BASE = Deno.env.get("CLICKSEND_API_BASE") ?? "https://rest.clicksend.com/v3";

const HISTORY_PAGE_LIMIT = 100;
const MAX_PAGES = 100;
const LOOKUP_BATCH = 200;

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

/** GET only. This function never sends and never mutates anything at ClickSend. */
async function fetchClickSendHistory(
  dateFrom: number,
  dateTo: number,
  maxPages: number
): Promise<ClickSendHistoryRow[]> {
  const auth = base64Encode(`${CLICKSEND_USERNAME}:${CLICKSEND_PASSWORD}`);
  const headers = { Accept: "application/json", Authorization: `Basic ${auth}` };

  const rows: ClickSendHistoryRow[] = [];
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage && page <= maxPages) {
    const url =
      `${CLICKSEND_API_BASE}/sms/history?date_from=${dateFrom}&date_to=${dateTo}` +
      `&page=${page}&limit=${HISTORY_PAGE_LIMIT}&order_by=date:desc`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`ClickSend history HTTP ${res.status}`);
    }
    const payload = await res.json();
    const data = payload?.data ?? {};
    lastPage = Number(data?.last_page ?? 1) || 1;
    const pageRows: ClickSendHistoryRow[] = data?.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length === 0) break;
    page += 1;
  }

  return rows;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function handleDeliveryReceipts(
  req: Request,
  deps?: {
    supabase?: ReturnType<typeof createClient>;
    fetchHistory?: (dateFrom: number, dateTo: number, maxPages: number) => Promise<ClickSendHistoryRow[]>;
  }
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json({ ok: true, name: "clicksend-delivery-receipts", mode: "diff-only-by-default" });
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

  let body: {
    apply?: boolean;
    lookback_days?: number;
    date_from?: string;
    date_to?: string;
    max_pages?: number;
  } = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }

  const { data: settingsRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "sms_delivery_receipts_config")
    .maybeSingle();
  const cfg = (settingsRow?.value ?? {}) as Record<string, unknown>;
  const enabled = cfg.enabled !== false;
  const configuredLookback = Number(cfg.lookback_days ?? 7) || 7;

  if (!enabled) {
    return json({ skipped: true, reason: "kill_switch", enabled: false });
  }

  const applyRequested = body.apply === true;
  const lookbackDays = Number(body.lookback_days ?? configuredLookback) || configuredLookback;
  const maxPages = Math.min(Number(body.max_pages ?? MAX_PAGES) || MAX_PAGES, MAX_PAGES);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const dateTo = body.date_to
    ? Math.floor(new Date(`${body.date_to}T23:59:59Z`).getTime() / 1000)
    : nowSeconds;
  const dateFrom = body.date_from
    ? Math.floor(new Date(`${body.date_from}T00:00:00Z`).getTime() / 1000)
    : nowSeconds - lookbackDays * 86400;

  if (!CLICKSEND_USERNAME || !CLICKSEND_PASSWORD) {
    return json({
      skipped: true,
      reason: "credentials_unavailable",
      apply_requested: applyRequested,
    });
  }

  let historyRows: ClickSendHistoryRow[];
  try {
    historyRows = deps?.fetchHistory
      ? await deps.fetchHistory(dateFrom, dateTo, maxPages)
      : await fetchClickSendHistory(dateFrom, dateTo, maxPages);
  } catch (err) {
    console.error("[clicksend-delivery-receipts] ClickSend history fetch failed", err);
    return json({ error: "Failed to fetch ClickSend history" }, 500);
  }

  const receipts = buildDeliveryReceipts(historyRows);
  const messageIds = receipts.map((r) => r.provider_message_id);

  // "Ours" includes legacy rows surfaced by the compat view — those cannot be updated
  // in place (their source tables are immutable) but they are still portal sends.
  const ourMessageIds = new Set<string>();
  for (const batch of chunk(messageIds, LOOKUP_BATCH)) {
    const { data, error } = await supabase
      .from("sms_message_log_compat")
      .select("provider_message_id")
      .in("provider_message_id", batch);
    if (error) {
      console.error("[clicksend-delivery-receipts] compat lookup failed", error.message);
      return json({ error: "Failed to load SMS log" }, 500);
    }
    for (const row of data ?? []) {
      if (row.provider_message_id) ourMessageIds.add(row.provider_message_id);
    }
  }

  const nativeRows: Array<{ id: string; provider_message_id: string | null; delivery_status: string | null }> = [];
  for (const batch of chunk(messageIds, LOOKUP_BATCH)) {
    const { data, error } = await supabase
      .from("sms_message_log")
      .select("id, provider_message_id, delivery_status")
      .in("provider_message_id", batch);
    if (error) {
      console.error("[clicksend-delivery-receipts] native lookup failed", error.message);
      return json({ error: "Failed to load sms_message_log" }, 500);
    }
    nativeRows.push(...(data ?? []));
  }

  const match = matchReceiptsToLogRows(receipts, nativeRows);
  const nativeLogIdByMessageId = new Map<string, string>();
  for (const row of nativeRows) {
    if (row.provider_message_id) nativeLogIdByMessageId.set(row.provider_message_id, row.id);
  }

  const unmatchedToPortal = receipts.filter((r) => !ourMessageIds.has(r.provider_message_id));
  const summary = {
    window: { date_from: dateFrom, date_to: dateTo, lookback_days: lookbackDays },
    history_rows: historyRows.length,
    receipts: receipts.length,
    receipts_by_status: summariseReceipts(receipts),
    portal_matched: receipts.length - unmatchedToPortal.length,
    portal_unmatched: unmatchedToPortal.length,
    native_rows_to_update: match.matched.length,
    native_rows_unchanged: match.unchanged,
  };

  console.log("[clicksend-delivery-receipts] summary", JSON.stringify(summary));
  if (unmatchedToPortal.length > 0) {
    // Not an error: the ClickSend account is shared with an external purchase-order app.
    const senders = [...new Set(unmatchedToPortal.map((r) => r.from_number ?? "(none)"))];
    console.log(
      "[clicksend-delivery-receipts] receipts with no portal send",
      JSON.stringify({ count: unmatchedToPortal.length, senders })
    );
  }

  if (!applyRequested) {
    return json({ ok: true, mode: "diff-only", apply_requested: false, summary });
  }

  const ledgerRows = receipts.map((receipt: DeliveryReceipt) => ({
    provider_message_id: receipt.provider_message_id,
    delivery_status: receipt.delivery_status,
    delivery_status_at: receipt.delivery_status_at,
    provider_status_code: receipt.provider_status_code,
    provider_status_text: receipt.provider_status_text,
    delivery_error_code: receipt.delivery_error_code,
    delivery_error_text: receipt.delivery_error_text,
    to_number: receipt.to_number,
    from_number: receipt.from_number,
    matched_log_id: nativeLogIdByMessageId.get(receipt.provider_message_id) ?? null,
    is_matched: ourMessageIds.has(receipt.provider_message_id),
    source: "history_pull",
    raw: receipt.raw,
    // updated_at is owned by the sms_delivery_receipt_touch trigger, which cancels
    // the write outright when nothing about the receipt changed.
  }));

  let ledgerWritten = 0;
  for (const batch of chunk(ledgerRows, LOOKUP_BATCH)) {
    const { error } = await supabase
      .from("sms_delivery_receipt")
      .upsert(batch, { onConflict: "provider_message_id" });
    if (error) {
      console.error("[clicksend-delivery-receipts] ledger upsert failed", error.message);
      return json({ error: "Failed to write delivery receipts", summary }, 500);
    }
    ledgerWritten += batch.length;
  }

  // Only the four delivery_* columns are touched. provider_status, body, phone_e164
  // and sent_at are the record of what was submitted and stay exactly as they are.
  let nativeUpdated = 0;
  for (const { log_id, receipt } of match.matched) {
    const { error } = await supabase
      .from("sms_message_log")
      .update({
        delivery_status: receipt.delivery_status,
        delivery_status_at: receipt.delivery_status_at,
        delivery_error_code: receipt.delivery_error_code,
        delivery_raw: receipt.raw,
      })
      .eq("id", log_id);
    if (error) {
      console.error("[clicksend-delivery-receipts] row update failed", log_id, error.message);
      continue;
    }
    nativeUpdated += 1;
  }

  return json({
    ok: true,
    mode: "apply",
    summary,
    ledger_upserted: ledgerWritten,
    native_rows_updated: nativeUpdated,
  });
}

Deno.serve((req) => handleDeliveryReceipts(req));
