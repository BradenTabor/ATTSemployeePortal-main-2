#!/usr/bin/env bash
# End-to-end: POST simulated ClickSend STOP to clicksend-inbound-webhook on local stack.
# Requires: supabase start (API + DB), functions served, migrations applied.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "SKIP: supabase CLI not installed"
  exit 0
fi

if ! supabase status >/dev/null 2>&1; then
  echo "SKIP: local supabase stack is not running (supabase start)"
  exit 0
fi

STATUS_JSON=$(supabase status -o json 2>/dev/null || true)
API_URL=$(echo "$STATUS_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("API_URL",""))' 2>/dev/null || true)
SERVICE_KEY=$(echo "$STATUS_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("SERVICE_ROLE_KEY",""))' 2>/dev/null || true)
DB_URL=$(echo "$STATUS_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("DB_URL",""))' 2>/dev/null || true)

# Runtime key inside edge container may differ from `supabase status` on some CLI versions.
EDGE_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep 'supabase_edge_runtime' | head -1 || true)
if [[ -n "$EDGE_CONTAINER" ]]; then
  RUNTIME_KEY=$(docker exec "$EDGE_CONTAINER" printenv SUPABASE_SERVICE_ROLE_KEY 2>/dev/null || true)
  if [[ -n "$RUNTIME_KEY" ]]; then
    SERVICE_KEY="$RUNTIME_KEY"
  fi
fi

if [[ -z "$API_URL" || -z "$SERVICE_KEY" || -z "$DB_URL" ]]; then
  echo "SKIP: could not read local supabase status"
  exit 0
fi

FUNCTIONS_URL="${API_URL}/functions/v1/clicksend-inbound-webhook"
USER_ID="11111111-1111-1111-1111-111111111111"
PROVIDER_MSG_ID="local-e2e-stop-$(date +%s)"
PHONE="+15551234001"
SERVE_PID=""
cleanup() {
  if [[ -n "$SERVE_PID" ]]; then
    kill "$SERVE_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

PROBE=$(curl -sS -o /dev/null -w "%{http_code}" "$FUNCTIONS_URL" 2>/dev/null || echo "000")
if [[ "$PROBE" == "404" || "$PROBE" == "000" ]]; then
  echo "=== Starting supabase functions serve (clicksend-inbound-webhook) ==="
  supabase functions serve clicksend-inbound-webhook --no-verify-jwt >/tmp/atts-inbound-serve.log 2>&1 &
  SERVE_PID=$!
  for _ in $(seq 1 30); do
    PROBE=$(curl -sS -o /dev/null -w "%{http_code}" "$FUNCTIONS_URL" 2>/dev/null || echo "000")
    if [[ "$PROBE" == "200" ]]; then
      break
    fi
    sleep 0.5
  done
fi

PROBE=$(curl -sS -o /dev/null -w "%{http_code}" "$FUNCTIONS_URL" 2>/dev/null || echo "000")
if [[ "$PROBE" != "200" ]]; then
  echo "SKIP: clicksend-inbound-webhook not reachable (HTTP $PROBE). Run: supabase functions serve clicksend-inbound-webhook --no-verify-jwt"
  exit 0
fi

echo "=== Ensuring sms_opt_out_events migration is applied ==="
if ! psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -c \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sms_opt_out_events';" \
  | grep -q 1; then
  echo "Applying 20260909110000_sms_opt_out_events.sql ..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260909110000_sms_opt_out_events.sql
fi

echo "=== Resetting test app_users opt-out flags ==="
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
UPDATE public.app_users
SET phone_number = '$PHONE',
    sms_operational_opt_out = false,
    sms_marketing_opt_out = false
WHERE user_id = '$USER_ID';

DELETE FROM public.sms_opt_out_events WHERE provider_message_id = '$PROVIDER_MSG_ID';
SQL

PAYLOAD=$(cat <<EOF
{
  "message_id": "$PROVIDER_MSG_ID",
  "from": "$PHONE",
  "to": "+18443781444",
  "body": "STOP",
  "timestamp": $(date +%s)
}
EOF
)

echo "=== POST #1 STOP payload ==="
RESP1=$(curl -sS -w "\n%{http_code}" -X POST "$FUNCTIONS_URL" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
HTTP1=$(echo "$RESP1" | tail -n1)
BODY1=$(echo "$RESP1" | sed '$d')
echo "http=$HTTP1 body=$BODY1"

if [[ "$HTTP1" != "200" ]]; then
  echo "FAIL: first POST expected HTTP 200, got $HTTP1"
  exit 1
fi

FLAGS=$(psql "$DB_URL" -t -A -c \
  "SELECT sms_operational_opt_out::text || '|' || sms_marketing_opt_out::text FROM public.app_users WHERE user_id = '$USER_ID';")
if [[ "$FLAGS" != "true|true" ]]; then
  echo "FAIL: expected both opt-out flags true after STOP, got $FLAGS"
  exit 1
fi

EVENT_COUNT=$(psql "$DB_URL" -t -A -c \
  "SELECT count(*)::text FROM public.sms_opt_out_events WHERE provider_message_id = '$PROVIDER_MSG_ID';")
if [[ "$EVENT_COUNT" != "1" ]]; then
  echo "FAIL: expected 1 sms_opt_out_events row, got $EVENT_COUNT"
  exit 1
fi

echo "=== POST #2 duplicate payload (idempotency) ==="
RESP2=$(curl -sS -w "\n%{http_code}" -X POST "$FUNCTIONS_URL" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")
HTTP2=$(echo "$RESP2" | tail -n1)
BODY2=$(echo "$RESP2" | sed '$d')
echo "http=$HTTP2 body=$BODY2"

if [[ "$HTTP2" != "200" ]]; then
  echo "FAIL: duplicate POST expected HTTP 200, got $HTTP2"
  exit 1
fi
if ! echo "$BODY2" | grep -q '"reason":"duplicate"'; then
  echo "FAIL: duplicate POST should return skipped duplicate, got $BODY2"
  exit 1
fi

EVENT_COUNT2=$(psql "$DB_URL" -t -A -c \
  "SELECT count(*)::text FROM public.sms_opt_out_events WHERE provider_message_id = '$PROVIDER_MSG_ID';")
if [[ "$EVENT_COUNT2" != "1" ]]; then
  echo "FAIL: duplicate POST should not insert another event, count=$EVENT_COUNT2"
  exit 1
fi

echo ""
echo "PASS: STOP flipped both flags; duplicate POST was a no-op."
