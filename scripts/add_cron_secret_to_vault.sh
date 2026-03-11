#!/usr/bin/env bash
# Add CRON_SERVICE_ROLE_KEY to Supabase Vault so the 5 AM safety announcement cron can authenticate.
# Loads SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL from .env. Requires psql and Vault extension enabled.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f .env ]; then
  while IFS= read -r line; do
    case "$line" in
      SUPABASE_SERVICE_ROLE_KEY=*) export SUPABASE_SERVICE_ROLE_KEY="${line#SUPABASE_SERVICE_ROLE_KEY=}" ;;
      SUPABASE_DB_URL=*)         export SUPABASE_DB_URL="${line#SUPABASE_DB_URL=}" ;;
    esac
  done < <(grep -E '^(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL)=' .env 2>/dev/null || true)
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY not set. Add it to .env or export it."
  exit 1
fi
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "SUPABASE_DB_URL not set. Add it to .env or export it (Dashboard → Database → Connection string)."
  exit 1
fi

# Escape single quotes in the key for use inside PostgreSQL single-quoted string: ' -> ''
KEY_ESCAPED="${SUPABASE_SERVICE_ROLE_KEY//\'/\'\'\'}"

psql "$SUPABASE_DB_URL" -c "SELECT vault.create_secret('${KEY_ESCAPED}', 'CRON_SERVICE_ROLE_KEY', 'Service role key for 5 AM safety announcement cron');"
echo "Done. CRON_SERVICE_ROLE_KEY is now in Vault; the 5 AM safety announcement cron will use it."
