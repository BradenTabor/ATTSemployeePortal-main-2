// WARNING: Do not include URLs in SMS body unless ClickSend account is approved for URL messaging.

// @ts-nocheck
/**
 * Shared ClickSend SMS helper for Edge Functions.
 * Single place for Basic auth, request construction (source), POST, and per-message status handling.
 */

const CLICKSEND_SMS_URL = "https://rest.clicksend.com/v3/sms/send";
const DEFAULT_SOURCE = "atts-safety";

export interface ClickSendMessage {
  to: string; // E.164
  body: string; // max 160 chars for single-part
  source?: string; // default: 'atts-safety'
  from?: string; // E.164 sender number (e.g. +18443781444); overrides config.from
}

export interface ClickSendResult {
  to: string;
  status: string;
  messageId?: string;
  price?: string;
}

export interface SendSMSResult {
  success: boolean;
  results: ClickSendResult[];
  totalPrice: number;
  httpStatus?: number;
  error?: string;
}

function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Send SMS via ClickSend API. Iterates response data.messages for per-message status.
 * SUCCESS and THROTTLED are treated as success (THROTTLED = already delivered / deduped).
 */
export async function sendSMS(
  messages: ClickSendMessage[],
  config: { username: string; password: string; from?: string }
): Promise<SendSMSResult> {
  const { username, password, from: configFrom } = config;
  if (!username || !password) {
    return {
      success: false,
      results: [],
      totalPrice: 0,
      error: "CLICKSEND_USERNAME and CLICKSEND_PASSWORD required",
    };
  }
  if (messages.length === 0) {
    return { success: true, results: [], totalPrice: 0 };
  }

  const body = {
    messages: messages.map((m) => {
      const msg: { source: string; body: string; to: string; from?: string } = {
        source: m.source ?? DEFAULT_SOURCE,
        body: m.body,
        to: m.to,
      };
      const fromNumber = m.from ?? configFrom;
      if (fromNumber) msg.from = fromNumber;
      return msg;
    }),
  };

  const auth = base64Encode(`${username}:${password}`);
  const res = await fetch(CLICKSEND_SMS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: { data?: { messages?: Array<{ to?: string; status?: string; message_id?: string; message_price?: string }>; total_price?: number }; http_code?: number } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    return {
      success: false,
      results: [],
      totalPrice: 0,
      httpStatus: res.status,
      error: `Invalid JSON: ${text.slice(0, 200)}`,
    };
  }

  if (res.status === 401) {
    return {
      success: false,
      results: [],
      totalPrice: 0,
      httpStatus: 401,
      error: "Invalid ClickSend credentials",
    };
  }
  if (res.status === 429) {
    return {
      success: false,
      results: [],
      totalPrice: 0,
      httpStatus: 429,
      error: "ClickSend rate limit exceeded",
    };
  }
  if (res.status >= 500) {
    return {
      success: false,
      results: [],
      totalPrice: 0,
      httpStatus: res.status,
      error: data?.message ?? text?.slice(0, 200) ?? "Server error",
    };
  }

  const rawMessages = data?.data?.messages ?? [];
  const totalPrice = typeof data?.data?.total_price === "number" ? data.data.total_price : 0;
  const results: ClickSendResult[] = rawMessages.map((m: { to?: string; status?: string; message_id?: string; message_price?: string }) => ({
    to: m.to ?? "",
    status: m.status ?? "UNKNOWN",
    messageId: m.message_id,
    price: m.message_price,
  }));

  const allSuccess = results.every(
    (r) => r.status === "SUCCESS" || r.status === "THROTTLED"
  );

  return {
    success: allSuccess,
    results,
    totalPrice,
    httpStatus: res.status,
    error: allSuccess ? undefined : results.map((r) => `${r.to}: ${r.status}`).join("; "),
  };
}
