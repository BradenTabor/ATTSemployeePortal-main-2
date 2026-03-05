#!/usr/bin/env bash
# =============================================================================
# Send a one-off Tier 2 escalation SMS test (e.g. to Braden Tabor only)
# =============================================================================
#
# Prerequisites:
#   1. Run the SQL in "Step 1" below in Supabase SQL Editor (one-time per test):
#      - Deactivate other Tier 2 recipients so only the test recipient gets the SMS.
#      - Delete today's Tier 2 send log so idempotency doesn't block.
#   2. Set SUPABASE_SERVICE_ROLE_KEY and optionally SUPABASE_URL in .env or env.
#
# Step 1 — Run in Supabase Dashboard → SQL Editor:
#   -- List Tier 2 recipients (find Braden by label or phone)
#   SELECT id, phone_e164, label, is_active FROM sms_escalation_recipients WHERE tier = 2;
#
#   -- Deactivate all Tier 2, then activate only Braden (replace PHONE with his E.164)
#   UPDATE sms_escalation_recipients SET is_active = false WHERE tier = 2;
#   UPDATE sms_escalation_recipients SET is_active = true WHERE tier = 2 AND (phone_e164 = '+1XXXXXXXXXX' OR label ILIKE '%braden%');
#
#   -- Allow one more Tier 2 send today (remove idempotency block)
#   DELETE FROM sms_escalation_send_log
#   WHERE tier = 2 AND (sent_at AT TIME ZONE 'America/Chicago')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date;
#
# Step 2 — Run this script from repo root:
#   ./scripts/send-escalation-sms-test.sh
#
# Step 3 — After you receive the SMS, restore other recipients in SQL Editor:
#   UPDATE sms_escalation_recipients SET is_active = true WHERE tier = 2;
#
# =============================================================================

set -e

PROJECT_REF="${SUPABASE_PROJECT_REF:-emqqxfzahmwnehxcpxzp}"
URL="https://${PROJECT_REF}.supabase.co/functions/v1/safety-briefing-escalation-sms"

# Load .env if present
if [ -f .env ]; then
  while IFS= read -r line; do
    case "$line" in
      SUPABASE_SERVICE_ROLE_KEY=*) export SUPABASE_SERVICE_ROLE_KEY="${line#SUPABASE_SERVICE_ROLE_KEY=}" ;;
      SUPABASE_URL=*)              export SUPABASE_URL="${line#SUPABASE_URL=}" ;;
    esac
  done < <(grep -E '^(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL)=' .env 2>/dev/null || true)
fi

# Allow override URL from SUPABASE_URL (e.g. https://emqqxfzahmwnehxcpxzp.supabase.co)
if [ -n "$SUPABASE_URL" ]; then
  URL="${SUPABASE_URL}/functions/v1/safety-briefing-escalation-sms"
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "Missing SUPABASE_SERVICE_ROLE_KEY. Set it in .env or:"
  echo "  SUPABASE_SERVICE_ROLE_KEY='your-key' $0"
  echo ""
  echo "Or run the curl manually (after Step 1 SQL):"
  echo "  curl -X POST '$URL' \\"
  echo "    -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{}'"
  exit 1
fi

echo "Invoking safety-briefing-escalation-sms (live send, not dry-run)..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}')
HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""
if [ "$HTTP_CODE" != "200" ]; then
  echo "HTTP $HTTP_CODE"
  exit 1
fi
echo "Done. Check the phone for the Tier 2 SMS. Restore other recipients (Step 3 in script comments) when finished."
