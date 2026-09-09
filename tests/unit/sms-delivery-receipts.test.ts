import { describe, expect, it } from "vitest";
import {
  buildDeliveryReceipts,
  mapDeliveryStatus,
  matchReceiptsToLogRows,
  summariseReceipts,
  type ClickSendHistoryRow,
  type LogRowRef,
} from "../../supabase/functions/_shared/smsDeliveryReceipts";

/** Shapes taken from real GET /v3/sms/history rows on the ATTS account. */
function historyRow(overrides: Partial<ClickSendHistoryRow> = {}): ClickSendHistoryRow {
  return {
    direction: "out",
    date: 1_788_976_047,
    to: "+15551234001",
    from: "+18443781444",
    status: "Sent",
    status_code: "201",
    status_text: "Message delivered to the handset",
    error_code: "4",
    error_text: "Message delivered to the handset",
    message_id: "1F1AC768-5F3C-62DA-8190-7720B6D97FFE",
    ...overrides,
  };
}

describe("mapDeliveryStatus", () => {
  it("separates delivered from merely handed to the network", () => {
    // ClickSend reports both as status "Sent" — only status_code distinguishes them.
    expect(mapDeliveryStatus(historyRow({ status: "Sent", status_code: "201" }))).toBe("delivered");
    expect(mapDeliveryStatus(historyRow({ status: "Sent", status_code: "200" }))).toBe("sent_to_network");
  });

  it("maps carrier rejection and absent subscriber to failed", () => {
    expect(
      mapDeliveryStatus(
        historyRow({ status: "Failed", status_code: "301", status_text: "Rejected by the recipient network." })
      )
    ).toBe("failed");
    expect(
      mapDeliveryStatus(
        historyRow({ status: "Failed", status_code: "301", status_text: "Absent Subscriber." })
      )
    ).toBe("failed");
  });

  it("falls back to the coarse status when no status_code is present", () => {
    expect(mapDeliveryStatus(historyRow({ status: "Queued", status_code: null }))).toBe("queued");
    expect(mapDeliveryStatus(historyRow({ status: "Cancelled", status_code: null }))).toBe("cancelled");
    expect(mapDeliveryStatus(historyRow({ status: null, status_code: null }))).toBe("unknown");
  });
});

describe("buildDeliveryReceipts", () => {
  it("normalises a history row into a receipt", () => {
    const [receipt] = buildDeliveryReceipts([historyRow()]);
    expect(receipt).toMatchObject({
      provider_message_id: "1F1AC768-5F3C-62DA-8190-7720B6D97FFE",
      delivery_status: "delivered",
      provider_status_code: "201",
      delivery_error_code: "4",
      to_number: "+15551234001",
      from_number: "+18443781444",
    });
    expect(receipt.delivery_status_at).toBe(new Date(1_788_976_047 * 1000).toISOString());
  });

  it("drops inbound messages and rows with no message id", () => {
    const rows = [
      historyRow({ direction: "in", message_id: "IN-1" }),
      historyRow({ message_id: "" }),
      historyRow({ message_id: null }),
      historyRow({ message_id: "KEEP-1" }),
    ];
    expect(buildDeliveryReceipts(rows).map((r) => r.provider_message_id)).toEqual(["KEEP-1"]);
  });

  it("is idempotent: the same window twice yields the same receipts", () => {
    const rows = [historyRow({ message_id: "A" }), historyRow({ message_id: "B", status_code: "301", status: "Failed" })];
    const first = buildDeliveryReceipts(rows, "2026-09-09T00:00:00.000Z");
    const second = buildDeliveryReceipts([...rows, ...rows], "2026-09-09T00:00:00.000Z");
    expect(second).toEqual(first);
  });

  it("lets a later row for the same message id win", () => {
    const receipts = buildDeliveryReceipts([
      historyRow({ message_id: "A", status_code: "200", status: "Sent" }),
      historyRow({ message_id: "A", status_code: "201", status: "Sent" }),
    ]);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.delivery_status).toBe("delivered");
  });
});

describe("matchReceiptsToLogRows", () => {
  const receipts = buildDeliveryReceipts([
    historyRow({ message_id: "OURS-DELIVERED" }),
    historyRow({ message_id: "OURS-FAILED", status: "Failed", status_code: "301", error_code: "12" }),
    historyRow({ message_id: "THEIRS", from: "+18338612650" }),
  ]);

  it("matches on provider_message_id and keeps the rest", () => {
    const logRows: LogRowRef[] = [
      { id: "log-1", provider_message_id: "OURS-DELIVERED", delivery_status: null },
      { id: "log-2", provider_message_id: "OURS-FAILED", delivery_status: null },
    ];
    const result = matchReceiptsToLogRows(receipts, logRows);
    expect(result.matched.map((m) => m.log_id)).toEqual(["log-1", "log-2"]);
    expect(result.unmatched.map((r) => r.provider_message_id)).toEqual(["THEIRS"]);
    expect(result.unchanged).toBe(0);
  });

  it("re-ingesting the same receipt changes nothing", () => {
    const alreadyIngested: LogRowRef[] = [
      { id: "log-1", provider_message_id: "OURS-DELIVERED", delivery_status: "delivered" },
      { id: "log-2", provider_message_id: "OURS-FAILED", delivery_status: "failed" },
    ];
    const result = matchReceiptsToLogRows(receipts, alreadyIngested);
    expect(result.matched).toEqual([]);
    expect(result.unchanged).toBe(2);
    expect(result.unmatched).toHaveLength(1);
  });

  it("updates a row whose delivery state moved on", () => {
    const pending: LogRowRef[] = [
      { id: "log-1", provider_message_id: "OURS-DELIVERED", delivery_status: "sent_to_network" },
    ];
    const result = matchReceiptsToLogRows(receipts, pending);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]?.receipt.delivery_status).toBe("delivered");
  });

  it("ignores log rows that never got a provider message id", () => {
    const logRows: LogRowRef[] = [{ id: "log-x", provider_message_id: null, delivery_status: null }];
    const result = matchReceiptsToLogRows(receipts, logRows);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toHaveLength(3);
  });
});

describe("summariseReceipts", () => {
  it("counts each delivery state", () => {
    const receipts = buildDeliveryReceipts([
      historyRow({ message_id: "A" }),
      historyRow({ message_id: "B" }),
      historyRow({ message_id: "C", status: "Failed", status_code: "301" }),
      historyRow({ message_id: "D", status_code: "200" }),
    ]);
    expect(summariseReceipts(receipts)).toEqual({
      delivered: 2,
      sent_to_network: 1,
      failed: 1,
      cancelled: 0,
      queued: 0,
      unknown: 0,
    });
  });
});
