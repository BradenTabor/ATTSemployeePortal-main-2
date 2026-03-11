#!/usr/bin/env bash
# =============================================================================
# One-time manual run of safety announcement + briefing reminder crons
# Use when crons didn't fire (e.g. auth placeholder). Loads key from .env.
# Usage: ./scripts/run-safety-crons-manual.sh
# =============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f .env ]; then
  while IFS= read -r line; do
    case "$line" in
      SUPABASE_SERVICE_ROLE_KEY=*) export SUPABASE_SERVICE_ROLE_KEY="${line#SUPABASE_SERVICE_ROLE_KEY=}" ;;
      SUPABASE_URL=*)             export SUPABASE_URL="${line#SUPABASE_URL=}" ;;
    esac
  done < <(grep -E '^(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL)=' .env 2>/dev/null || true)
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY not set. Add to .env or export it."
  exit 1
fi

URL="${SUPABASE_URL:-https://emqqxfzahmwnehxcpxzp.supabase.co}"
BASE="${URL}/functions/v1"

echo "1. generate-safety-announcement (creates today's announcement)..."
curl -sS -X POST "$BASE/generate-safety-announcement" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{"windowHours": 48, "skipWeekendCheck": true}' | head -c 500
echo ""
echo ""

echo "2. safety-briefing-reminder-push..."
curl -sS -X POST "$BASE/safety-briefing-reminder-push" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{}' | head -c 500
echo ""
echo ""

echo "3. safety-briefing-reminder-sms..."
curl -sS -X POST "$BASE/safety-briefing-reminder-sms" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -d '{}' | head -c 500
echo ""
echo "Done."
