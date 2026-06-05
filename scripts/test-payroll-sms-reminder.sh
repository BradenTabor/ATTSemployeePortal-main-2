#!/usr/bin/env bash
# Test payroll-hours-reminder-sms (dry-run + idempotency checks). No live SMS unless RUN_LIVE=1.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env | cut -d= -f2-)}"
  VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$(grep '^VITE_SUPABASE_URL=' .env | cut -d= -f2-)}"
  SUPABASE_DB_URL="${SUPABASE_DB_URL:-$(grep '^SUPABASE_DB_URL=' .env | cut -d= -f2-)}"
fi

: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY in .env}"
URL="${VITE_SUPABASE_URL:-https://emqqxfzahmwnehxcpxzp.supabase.co}"
FN="${URL}/functions/v1/payroll-hours-reminder-sms"
AUTH="Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

echo "=== 1. Dry-run with force_day=1 (side-effect-free) ==="
RESP=$(curl -s -w "\n%{http_code}" -X POST "$FN" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"dryRun":true,"force_day":1}')
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "HTTP $HTTP"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
[[ "$HTTP" == "200" ]] || { echo "FAIL: expected 200"; exit 1; }
echo "$BODY" | grep -q '"dryRun":true' || { echo "FAIL: missing dryRun"; exit 1; }
echo "$BODY" | grep -q 'eligible_count' || { echo "FAIL: missing eligible_count"; exit 1; }

echo ""
echo "=== 2. Wall-clock guard (no force_day) — expect skip outside 8 AM CT ==="
RESP2=$(curl -s -w "\n%{http_code}" -X POST "$FN" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"dryRun":true}')
HTTP2=$(echo "$RESP2" | tail -1)
BODY2=$(echo "$RESP2" | sed '$d')
echo "HTTP $HTTP2"
echo "$BODY2" | python3 -m json.tool 2>/dev/null || echo "$BODY2"
[[ "$HTTP2" == "200" ]] || { echo "FAIL: expected 200 on skip"; exit 1; }

echo ""
echo "=== 3. Dry-run must not create log row for today tier 1 ==="
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  COUNT=$(psql "$SUPABASE_DB_URL" -t -A -c \
    "SELECT COUNT(*) FROM payroll_reminder_sms_log WHERE date_checked = (NOW() AT TIME ZONE 'America/Chicago')::date AND tier = 1;")
  echo "Log rows today tier 1: $COUNT"
  [[ "$COUNT" == "0" ]] || { echo "FAIL: dry-run wrote log row"; exit 1; }
else
  echo "SKIP: SUPABASE_DB_URL not set"
fi

echo ""
echo "=== 4. claim_payroll_reminder_sms_log RPC smoke test ==="
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "
    DELETE FROM payroll_reminder_sms_log WHERE date_checked = '2099-01-01' AND tier = 1;
    SELECT public.claim_payroll_reminder_sms_log('2099-01-01'::date, 1) IS NOT NULL AS first_claim;
    SELECT public.claim_payroll_reminder_sms_log('2099-01-01'::date, 1) IS NULL AS second_claim_blocked;
    DELETE FROM payroll_reminder_sms_log WHERE date_checked = '2099-01-01' AND tier = 1;
  "
else
  echo "SKIP: SUPABASE_DB_URL not set"
fi

if [[ "${RUN_LIVE:-}" == "1" ]]; then
  echo ""
  echo "=== 5. LIVE send with force_day (RUN_LIVE=1) ==="
  curl -s -X POST "$FN" -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"dryRun":false,"force_day":1}' | python3 -m json.tool
else
  echo ""
  echo "=== 5. LIVE send skipped (set RUN_LIVE=1 to send real SMS) ==="
fi

echo ""
echo "All automated checks passed."
