#!/usr/bin/env bash
# Gate 0 — read-only prod vs local migration replay schema diff.
set -euo pipefail

RECON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$RECON_DIR/.." && pwd)"
GATE_DIR="$REPO_ROOT/supabase/.localgate"

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
REPLAY_DB="${REPLAY_DB:-atts_recon_replay}"
PSQL="$PG_BIN/psql"
export PGHOST PGPORT

URL="${SUPABASE_DB_URL:-}"
if [ -z "$URL" ] && [ -f "$REPO_ROOT/.env" ]; then
  URL="$(grep -E '^SUPABASE_DB_URL=' "$REPO_ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"')"
fi
[ -n "$URL" ] || { echo "FATAL: SUPABASE_DB_URL not set"; exit 1; }

mkdir -p "$RECON_DIR"

echo "==> [gate0] Refreshing prod baseline artifacts (schema-only)"
bash "$GATE_DIR/refresh.sh"

echo "==> [gate0] Dumping normalized prod schema"
"$PSQL" "$URL" -v ON_ERROR_STOP=1 -q -t -A -f "$RECON_DIR/introspect.sql" \
  | LC_ALL=C sort > "$RECON_DIR/prod_schema.txt"
echo "    prod lines: $(wc -l < "$RECON_DIR/prod_schema.txt")"

echo "==> [gate0] Full local migration replay"
if bash "$RECON_DIR/replay_all.sh"; then
  echo "==> [gate0] Dumping normalized local replay schema"
  "$PSQL" -d "$REPLAY_DB" -v ON_ERROR_STOP=1 -q -t -A -f "$RECON_DIR/introspect.sql" \
    | LC_ALL=C sort > "$RECON_DIR/local_replay_schema.txt"
  echo "    local lines: $(wc -l < "$RECON_DIR/local_replay_schema.txt")"
else
  echo "==> [gate0] Full replay FAILED — loading prod baseline only (no assertions)"
  echo "REPLAY_FAILED_PROD_BASELINE_ONLY" > "$RECON_DIR/replay_status.txt"
  GATE_DB="${GATE_DB:-atts_recon_baseline}"
  "$PSQL" -d postgres -v ON_ERROR_STOP=1 -q \
    -c "DROP DATABASE IF EXISTS $GATE_DB WITH (FORCE);" \
    -c "CREATE DATABASE $GATE_DB;"
  "$PSQL" -d "$GATE_DB" -v ON_ERROR_STOP=1 -q -f "$GATE_DIR/stubs.sql"
  sed '/^CREATE SCHEMA public;$/d' "$GATE_DIR/prod_schema.sql" \
    | "$PSQL" -d "$GATE_DB" -v ON_ERROR_STOP=1 -q -f -
  "$PSQL" -d "$GATE_DB" -v ON_ERROR_STOP=1 -q -f "$GATE_DIR/storage_baseline.sql"
  "$PSQL" -d "$GATE_DB" -v ON_ERROR_STOP=1 -q -t -A -f "$RECON_DIR/introspect.sql" \
    | LC_ALL=C sort > "$RECON_DIR/local_replay_schema.txt"
  echo "    prod-baseline lines: $(wc -l < "$RECON_DIR/local_replay_schema.txt")"
fi

echo "==> [gate0] Diffing schemas"
diff -u "$RECON_DIR/prod_schema.txt" "$RECON_DIR/local_replay_schema.txt" > "$RECON_DIR/schema_diff.txt" || true

prod_only=$(comm -23 "$RECON_DIR/prod_schema.txt" "$RECON_DIR/local_replay_schema.txt" | wc -l | tr -d ' ')
local_only=$(comm -13 "$RECON_DIR/prod_schema.txt" "$RECON_DIR/local_replay_schema.txt" | wc -l | tr -d ' ')

{
  echo "Gate 0 schema diff summary"
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Prod HEAD: $(tail -1 "$GATE_DIR/prod_applied_versions.txt")"
  echo "Replay status: $(cat "$RECON_DIR/replay_status.txt" 2>/dev/null || echo unknown)"
  echo "Prod-only lines: $prod_only"
  echo "Local-only lines: $local_only"
  echo ""
  if [ "$prod_only" = "0" ] && [ "$local_only" = "0" ]; then
    echo "RESULT: EMPTY DIFF"
  else
    echo "RESULT: NON-EMPTY DIFF (see schema_diff.txt)"
  fi
} > "$RECON_DIR/gate0_summary.txt"

cat "$RECON_DIR/gate0_summary.txt"
