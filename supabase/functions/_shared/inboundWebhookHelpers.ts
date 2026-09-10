/**
 * Pure helpers for clicksend-inbound-webhook.
 * Kept free of Deno/npm imports so Vitest can cover auth, body parse, and log scrubbing.
 *
 * ClickSend inbound field names are taken from the documented inbound SMS object
 * (View Inbound SMS / Create Test Inbound SMS / View a specific inbound SMS message):
 *   message_id, from, to, body, original_body, original_message_id,
 *   timestamp, timestamp_send, custom_string, _keyword
 * Help article https://help.clicksend.com/en/articles/42270-inbound-messaging-rules
 * confirms application/x-www-form-urlencoded POSTs but does not enumerate parameter names;
 * we map the documented inbound object keys, and keep the same names as JSON aliases.
 */

export interface NormalizedInboundPayload {
  message_id: string | null;
  from: string | null;
  to: string | null;
  body: string;
  original_body: string | null;
  timestamp: number | string | null;
}

export interface WebhookAuthSecrets {
  internalSecret: string | null | undefined;
  serviceRoleKey: string | null | undefined;
  /** Dedicated query-param secret. Query path disabled when unset/empty. */
  webhookSecret: string | null | undefined;
}

const MIN_RECEIVED_MS = Date.UTC(2020, 0, 1);
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

/** Constant-time equality on UTF-8 bytes. Length mismatch returns false immediately. */
export function timingSafeEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (a == null || b == null) return false;
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i]! ^ bBytes[i]!;
  }
  return diff === 0;
}

/** Scrub credential-bearing query param `k` before any console/log of a URL. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("k")) {
      parsed.searchParams.set("k", "[REDACTED]");
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&]k=)([^&]*)/gi, "$1[REDACTED]");
  }
}

export function isAuthorized(req: Request, secrets: WebhookAuthSecrets): boolean {
  const internalKey = req.headers.get("x-internal-key");
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  // Header paths first (existing behavior).
  if (
    timingSafeEqual(internalKey, secrets.internalSecret) ||
    timingSafeEqual(bearerToken, secrets.internalSecret) ||
    timingSafeEqual(bearerToken, secrets.serviceRoleKey)
  ) {
    return true;
  }

  // Query-param fallback: only when CLICKSEND_WEBHOOK_SECRET is set. Never open.
  const webhookSecret = secrets.webhookSecret;
  if (webhookSecret == null || webhookSecret === "") {
    return false;
  }

  let querySecret: string | null = null;
  try {
    querySecret = new URL(req.url).searchParams.get("k");
  } catch {
    return false;
  }
  return timingSafeEqual(querySecret, webhookSecret);
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/**
 * Map raw ClickSend (or legacy JSON) fields into one internal shape.
 * Documented names preferred; existing JSON names are the same set (aliases).
 */
export function normalizeInboundPayload(
  raw: Record<string, unknown>,
): NormalizedInboundPayload {
  const body =
    firstString(raw, ["body"]) ??
    firstString(raw, ["original_body"]) ??
    "";
  const timestampRaw = raw.timestamp ?? raw.timestamp_send ?? null;
  let timestamp: number | string | null = null;
  if (typeof timestampRaw === "number" || typeof timestampRaw === "string") {
    timestamp = timestampRaw;
  }

  return {
    message_id: firstString(raw, ["message_id"]),
    from: firstString(raw, ["from"]),
    to: firstString(raw, ["to"]),
    body,
    original_body: firstString(raw, ["original_body"]),
    timestamp,
  };
}

function recordFromUrlSearchParams(params: URLSearchParams): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    record[key] = value;
  }
  return record;
}

function tryParseForm(text: string): Record<string, unknown> | null {
  try {
    const params = new URLSearchParams(text);
    // Empty body → empty params; treat as unparseable for our purposes unless it has keys.
    if ([...params.keys()].length === 0 && text.trim() !== "") {
      // e.g. "not=form&&" still has keys; truly garbage with no '=' yields empty.
      // If text has content but no keys, fail.
      if (!text.includes("=")) return null;
    }
    if ([...params.keys()].length === 0) return null;
    return recordFromUrlSearchParams(params);
  } catch {
    return null;
  }
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export type ParseBodyResult =
  | { ok: true; payload: NormalizedInboundPayload }
  | { ok: false; reason: "unparseable_body" };

/**
 * Branch on Content-Type; normalize both shapes before business logic.
 * Missing/unknown Content-Type: try form-encoded first, then JSON.
 */
export function parseInboundBody(
  contentType: string | null,
  text: string,
): ParseBodyResult {
  const ct = (contentType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";

  let raw: Record<string, unknown> | null = null;

  if (ct === "application/x-www-form-urlencoded") {
    raw = tryParseForm(text);
  } else if (ct === "application/json") {
    raw = tryParseJson(text);
  } else {
    raw = tryParseForm(text) ?? tryParseJson(text);
  }

  if (!raw) {
    return { ok: false, reason: "unparseable_body" };
  }
  return { ok: true, payload: normalizeInboundPayload(raw) };
}

/**
 * Coerce string or number unix timestamps (sec or ms). Reject implausible values
 * (before 2020-01-01 UTC, or more than 24h in the future) by falling back to now.
 */
export function receivedAtFromPayload(
  payload: Pick<NormalizedInboundPayload, "timestamp">,
  now: () => Date = () => new Date(),
): string {
  const nowDate = now();
  const nowMs = nowDate.getTime();
  const raw = payload.timestamp;

  let ms: number | null = null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    ms = raw > 1_000_000_000_000 ? raw : raw * 1000;
  } else if (typeof raw === "string" && raw.trim() !== "") {
    const trimmed = raw.trim();
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && asNum > 0) {
      ms = asNum > 1_000_000_000_000 ? asNum : asNum * 1000;
    } else {
      const parsed = Date.parse(trimmed);
      if (Number.isFinite(parsed)) ms = parsed;
    }
  }

  if (ms == null || ms < MIN_RECEIVED_MS || ms > nowMs + MAX_FUTURE_MS) {
    return nowDate.toISOString();
  }
  return new Date(ms).toISOString();
}
