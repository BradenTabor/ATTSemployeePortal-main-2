/**
 * Delivery-receipt ingestion helpers.
 *
 * What we store at send time is ClickSend's *submission* response (`provider_status`,
 * almost always SUCCESS). The carrier outcome arrives later. `/v3/sms/history` carries
 * that outcome per message as `status` + `status_code` + `status_text` + `error_code`,
 * so we pull it and record it as a separate fact. `provider_status` is never rewritten.
 *
 * Pure functions only — the Edge Function does the I/O, the tests exercise these.
 */

/** Delivery state vocabulary, derived from ClickSend but stable if their strings change. */
export type DeliveryStatus =
  | "delivered"
  | "sent_to_network"
  | "failed"
  | "cancelled"
  | "queued"
  | "unknown";

/** One row of GET /v3/sms/history. Only the fields we depend on are declared. */
export interface ClickSendHistoryRow {
  message_id?: string | null;
  direction?: string | null;
  date?: number | null;
  to?: string | null;
  from?: string | null;
  status?: string | null;
  status_code?: string | null;
  status_text?: string | null;
  error_code?: string | null;
  error_text?: string | null;
  subaccount_id?: number | null;
  [key: string]: unknown;
}

export interface DeliveryReceipt {
  provider_message_id: string;
  delivery_status: DeliveryStatus;
  delivery_status_at: string;
  provider_status_code: string | null;
  provider_status_text: string | null;
  delivery_error_code: string | null;
  delivery_error_text: string | null;
  to_number: string | null;
  from_number: string | null;
  raw: ClickSendHistoryRow;
}

/**
 * ClickSend's `status` is coarse — "Sent" covers both "delivered to the handset" (201)
 * and "handed to the network, no final receipt yet" (200). The status_code is the
 * delivery receipt, so it wins; `status` is only the fallback.
 */
export function mapDeliveryStatus(row: ClickSendHistoryRow): DeliveryStatus {
  const code = (row.status_code ?? "").trim();
  if (code === "201") return "delivered";
  if (code === "200") return "sent_to_network";
  if (code === "301") return "failed";

  switch ((row.status ?? "").trim().toLowerCase()) {
    case "completed":
      return "delivered";
    case "sent":
      return "sent_to_network";
    case "failed":
      return "failed";
    case "cancelled":
    case "cancelledafterreview":
      return "cancelled";
    case "queued":
    case "scheduled":
    case "waitapproval":
      return "queued";
    default:
      return "unknown";
  }
}

function unixToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function nullIfBlank(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalise history rows into receipts. Inbound messages carry no delivery state and
 * are dropped. Later rows for the same message_id win, so re-reading an overlapping
 * window is safe.
 */
export function buildDeliveryReceipts(
  rows: ClickSendHistoryRow[],
  fallbackObservedAt: string = new Date().toISOString()
): DeliveryReceipt[] {
  const byMessageId = new Map<string, DeliveryReceipt>();

  for (const row of rows) {
    const messageId = nullIfBlank(typeof row.message_id === "string" ? row.message_id : null);
    if (!messageId) continue;
    if ((row.direction ?? "out").trim().toLowerCase() === "in") continue;

    byMessageId.set(messageId, {
      provider_message_id: messageId,
      delivery_status: mapDeliveryStatus(row),
      delivery_status_at: unixToIso(row.date) ?? fallbackObservedAt,
      provider_status_code: nullIfBlank(row.status_code),
      provider_status_text: nullIfBlank(row.status_text),
      delivery_error_code: nullIfBlank(row.error_code),
      delivery_error_text: nullIfBlank(row.error_text),
      to_number: nullIfBlank(row.to),
      from_number: nullIfBlank(row.from),
      raw: row,
    });
  }

  return [...byMessageId.values()];
}

export interface LogRowRef {
  id: string;
  provider_message_id: string | null;
  delivery_status: string | null;
}

export interface ReceiptMatchResult {
  /** Receipts whose provider_message_id exists in sms_message_log. */
  matched: Array<{ log_id: string; receipt: DeliveryReceipt }>;
  /**
   * Receipts with no row in sms_message_log. Kept, never dropped: this account is
   * shared with the purchase-order app, and these are the evidence of that.
   */
  unmatched: DeliveryReceipt[];
  /** Matched receipts that would not change the row (same status already recorded). */
  unchanged: number;
}

/**
 * Match receipts to log rows by provider_message_id. Idempotent: a receipt whose status
 * already equals the row's recorded delivery_status is reported as unchanged, so
 * re-ingesting the same receipt is a no-op.
 */
export function matchReceiptsToLogRows(
  receipts: DeliveryReceipt[],
  logRows: LogRowRef[]
): ReceiptMatchResult {
  const logByMessageId = new Map<string, LogRowRef>();
  for (const row of logRows) {
    const id = nullIfBlank(row.provider_message_id);
    if (id) logByMessageId.set(id, row);
  }

  const matched: ReceiptMatchResult["matched"] = [];
  const unmatched: DeliveryReceipt[] = [];
  let unchanged = 0;

  for (const receipt of receipts) {
    const logRow = logByMessageId.get(receipt.provider_message_id);
    if (!logRow) {
      unmatched.push(receipt);
      continue;
    }
    if (logRow.delivery_status === receipt.delivery_status) {
      unchanged += 1;
      continue;
    }
    matched.push({ log_id: logRow.id, receipt });
  }

  return { matched, unmatched, unchanged };
}

/** Counts for the run summary, so a nightly log line says what changed and what did not. */
export function summariseReceipts(receipts: DeliveryReceipt[]): Record<DeliveryStatus, number> {
  const summary: Record<DeliveryStatus, number> = {
    delivered: 0,
    sent_to_network: 0,
    failed: 0,
    cancelled: 0,
    queued: 0,
    unknown: 0,
  };
  for (const receipt of receipts) summary[receipt.delivery_status] += 1;
  return summary;
}
