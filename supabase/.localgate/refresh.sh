#!/usr/bin/env bash
# =============================================================================
# Refresh the local gate's prod baseline artifacts from the linked remote DB.
#
# Produces (schema-only, NO data/PII):
#   prod_roles.sql              cluster roles, no passwords
#   prod_schema.sql             auth + public schema (DDL only)
#   prod_applied_versions.txt   recorded migration versions (prod HEAD source)
#
# Connection: reads SUPABASE_DB_URL from the environment, else from repo .env.
# Uses host pg_dump/pg_dumpall v17 directly (the direct DB host is IPv6-only;
# the supabase CLI's containerized pg_dump cannot reach it).
#
# Usage:  bash supabase/.localgate/refresh.sh
# =============================================================================
set -euo pipefail

GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$GATE_DIR/../.." && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"

URL="${SUPABASE_DB_URL:-}"
if [ -z "$URL" ] && [ -f "$REPO_ROOT/.env" ]; then
  URL="$(grep -E '^SUPABASE_DB_URL=' "$REPO_ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"')"
fi
[ -n "$URL" ] || { echo "FATAL: SUPABASE_DB_URL not set and not found in .env"; exit 1; }

echo "==> Dumping prod roles (no passwords)"
"$PG_BIN/pg_dumpall" --roles-only --no-role-passwords -d "$URL" -f "$GATE_DIR/prod_roles.sql"

echo "==> Dumping prod schema (auth + public, schema-only)"
"$PG_BIN/pg_dump" --schema-only -n auth -n public -d "$URL" -f "$GATE_DIR/prod_schema.sql"

echo "==> Capturing recorded migration versions (prod HEAD source)"
"$PG_BIN/psql" "$URL" -tAc \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;" \
  > "$GATE_DIR/prod_applied_versions.txt"

echo "Done. prod HEAD = $(tail -1 "$GATE_DIR/prod_applied_versions.txt")"
