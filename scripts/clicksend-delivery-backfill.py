#!/usr/bin/env python3
"""
One-off backfill of carrier delivery outcomes into sms_delivery_receipt.

The nightly Edge Function only walks a short lookback window. ClickSend retains
roughly four months of history, so this script seeds the ledger from a full
history pull (scripts/clicksend-history-pull.py) before the cron is enabled.

Additive only. It writes to sms_delivery_receipt, and fills the four delivery_*
columns on sms_message_log rows that are still null. provider_status, body,
phone_e164, sent_at and every legacy table are left exactly as they are.

Status mapping is kept identical to supabase/functions/_shared/smsDeliveryReceipts.ts;
if one changes the other must change with it.

Usage:
    python3 scripts/clicksend-delivery-backfill.py .tmp/clicksend-history.jsonl out.csv
"""

import csv
import json
import sys
from datetime import datetime, timezone

STATUS_BY_CODE = {"201": "delivered", "200": "sent_to_network", "301": "failed"}
STATUS_BY_TEXT = {
    "completed": "delivered",
    "sent": "sent_to_network",
    "failed": "failed",
    "cancelled": "cancelled",
    "cancelledafterreview": "cancelled",
    "queued": "queued",
    "scheduled": "queued",
    "waitapproval": "queued",
}


def map_delivery_status(row):
    code = (row.get("status_code") or "").strip()
    if code in STATUS_BY_CODE:
        return STATUS_BY_CODE[code]
    return STATUS_BY_TEXT.get((row.get("status") or "").strip().lower(), "unknown")


def null_if_blank(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def unix_to_iso(seconds):
    if not isinstance(seconds, (int, float)) or seconds <= 0:
        return None
    return datetime.fromtimestamp(seconds, tz=timezone.utc).isoformat()


def build_receipts(path):
    """Later rows for the same message_id win, matching buildDeliveryReceipts()."""
    by_message_id = {}
    observed_at = datetime.now(tz=timezone.utc).isoformat()

    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        message_id = null_if_blank(row.get("message_id"))
        if not message_id:
            continue
        if (row.get("direction") or "out").strip().lower() == "in":
            continue

        by_message_id[message_id] = {
            "provider_message_id": message_id,
            "delivery_status": map_delivery_status(row),
            "delivery_status_at": unix_to_iso(row.get("date")) or observed_at,
            "provider_status_code": null_if_blank(row.get("status_code")),
            "provider_status_text": null_if_blank(row.get("status_text")),
            "delivery_error_code": null_if_blank(row.get("error_code")),
            "delivery_error_text": null_if_blank(row.get("error_text")),
            "to_number": null_if_blank(row.get("to")),
            "from_number": null_if_blank(row.get("from")),
            "raw": json.dumps(row, separators=(",", ":")),
        }

    return list(by_message_id.values())


FIELDS = [
    "provider_message_id",
    "delivery_status",
    "delivery_status_at",
    "provider_status_code",
    "provider_status_text",
    "delivery_error_code",
    "delivery_error_text",
    "to_number",
    "from_number",
    "raw",
]


def main():
    if len(sys.argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    source, dest = sys.argv[1], sys.argv[2]
    receipts = build_receipts(source)

    with open(dest, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        for receipt in receipts:
            writer.writerow(receipt)

    counts = {}
    for receipt in receipts:
        counts[receipt["delivery_status"]] = counts.get(receipt["delivery_status"], 0) + 1
    print(f"{len(receipts)} receipts -> {dest}")
    for status in sorted(counts):
        print(f"  {status}: {counts[status]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
