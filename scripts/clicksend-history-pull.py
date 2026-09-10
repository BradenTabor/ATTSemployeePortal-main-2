#!/usr/bin/env python3
"""
Read-only pull of ClickSend SMS history into JSONL.

GET only — this script never sends, never marks receipts read, and never writes
to ClickSend. It exists because /v3/sms/history is the delivery-state source of
truth for a message after submission (status_code / status_text / error_code),
whereas the response we store at send time is only ClickSend's acceptance.

Usage:
  scripts/clicksend-history-pull.py --from 2026-05-01 [--to 2026-09-09] \
      [--out .tmp/clicksend-history.jsonl]

Credentials: CLICKSEND_USERNAME + CLICKSEND_PASSWORD (or CLICKSEND_API_KEY),
read from the environment or from .env in the repo root.
"""

import argparse
import base64
import datetime as dt
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

BASE = "https://rest.clicksend.com/v3"
PAGE_LIMIT = 100


def load_dotenv(path: pathlib.Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def to_unix(day: str, end_of_day: bool = False) -> int:
    d = dt.datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
    if end_of_day:
        d = d + dt.timedelta(days=1) - dt.timedelta(seconds=1)
    return int(d.timestamp())


def get(path: str, auth: str) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        headers={"Accept": "application/json", "Authorization": f"Basic {auth}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="date_from", required=True, help="YYYY-MM-DD (UTC)")
    parser.add_argument("--to", dest="date_to", default=None, help="YYYY-MM-DD (UTC), inclusive")
    parser.add_argument("--out", default=".tmp/clicksend-history.jsonl")
    args = parser.parse_args()

    repo_root = pathlib.Path(__file__).resolve().parent.parent
    load_dotenv(repo_root / ".env")

    username = os.environ.get("CLICKSEND_USERNAME", "")
    password = os.environ.get("CLICKSEND_PASSWORD") or os.environ.get("CLICKSEND_API_KEY", "")
    if not username or not password:
        print("CLICKSEND_USERNAME and CLICKSEND_PASSWORD (or CLICKSEND_API_KEY) not set", file=sys.stderr)
        return 2
    auth = base64.b64encode(f"{username}:{password}".encode()).decode()

    date_from = to_unix(args.date_from)
    date_to = to_unix(args.date_to, end_of_day=True) if args.date_to else int(time.time())

    out_path = pathlib.Path(args.out)
    if not out_path.is_absolute():
        out_path = repo_root / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)

    written = 0
    page = 1
    last_page = 1
    with out_path.open("w", encoding="utf-8") as fh:
        while page <= last_page:
            query = (
                f"/sms/history?date_from={date_from}&date_to={date_to}"
                f"&page={page}&limit={PAGE_LIMIT}&order_by=date:desc"
            )
            try:
                payload = get(query, auth)
            except urllib.error.HTTPError as err:
                print(f"HTTP {err.code} on page {page}", file=sys.stderr)
                return 1
            data = payload.get("data") or {}
            last_page = int(data.get("last_page") or 1)
            rows = data.get("data") or []
            for row in rows:
                fh.write(json.dumps(row, separators=(",", ":")) + "\n")
                written += 1
            print(f"page {page}/{last_page} -> {len(rows)} rows", file=sys.stderr)
            if not rows:
                break
            page += 1
            time.sleep(0.2)

    print(json.dumps({"written": written, "out": str(out_path), "pages": last_page}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
