#!/usr/bin/env bash
# =============================================================================
# Refresh the local gate's prod baseline artifacts from the linked remote DB.
#
# Produces:
#   prod_roles.sql              cluster roles, no passwords
#   prod_schema.sql             auth + public schema (DDL only)
#   prod_config_data.sql        config/reference rows (tables in config_tables.txt)
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

PROD_HEAD="$("$PG_BIN/psql" "$URL" -tAc \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1;")"
CAPTURE_DATE="$(date -u +%Y-%m-%d)"

prepend_baseline_header() {
  local target="$1"
  {
    echo "-- Source: prod HEAD ${PROD_HEAD}"
    echo "-- Capture date: ${CAPTURE_DATE}"
    echo "-- Regenerated only at a deliberate re-baseline — see docs/CONVENTIONS.md (re-baseline runbook)."
    cat "$target"
  } > "${target}.tmp" && mv "${target}.tmp" "$target"
}

echo "==> Dumping prod roles (no passwords)"
"$PG_BIN/pg_dumpall" --roles-only --no-role-passwords -d "$URL" -f "$GATE_DIR/prod_roles.sql"

echo "==> Dumping prod schema (auth + public, schema-only)"
"$PG_BIN/pg_dump" --schema-only -n auth -n public -d "$URL" -f "$GATE_DIR/prod_schema.sql"
prepend_baseline_header "$GATE_DIR/prod_schema.sql"

CONFIG_MANIFEST="$GATE_DIR/config_tables.txt"
CONFIG_ARGS=()
if [ -f "$CONFIG_MANIFEST" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%%#*}"
    line="$(printf '%s' "$line" | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    [ -n "$line" ] || continue
    CONFIG_ARGS+=(-t "public.${line}")
  done < "$CONFIG_MANIFEST"
fi

if [ "${#CONFIG_ARGS[@]}" -gt 0 ]; then
  config_table_count="$(grep -v '^[[:space:]]*#' "$CONFIG_MANIFEST" | grep -v '^[[:space:]]*$' | wc -l | tr -d ' ')"
  echo "==> Dumping prod config/reference data (${config_table_count} table(s))"
  "$PG_BIN/pg_dump" --data-only --no-owner --no-privileges -d "$URL" \
    "${CONFIG_ARGS[@]}" -f "$GATE_DIR/prod_config_data.sql"
  prepend_baseline_header "$GATE_DIR/prod_config_data.sql"
else
  echo "==> No config tables listed; skipping prod_config_data.sql"
  : > "$GATE_DIR/prod_config_data.sql"
fi

echo "==> Capturing recorded migration versions (prod HEAD source)"
"$PG_BIN/psql" "$URL" -tAc \
  "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;" \
  > "$GATE_DIR/prod_applied_versions.txt"

echo "Done. prod HEAD = $(tail -1 "$GATE_DIR/prod_applied_versions.txt")"
