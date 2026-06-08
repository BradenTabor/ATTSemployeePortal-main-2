#!/usr/bin/env bash
# Full migration replay from zero into a throwaway local PG17 database (Gate 0).
set -euo pipefail

RECON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$RECON_DIR/.." && pwd)"
GATE_DIR="$REPO_ROOT/supabase/.localgate"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
REPLAY_DB="${REPLAY_DB:-atts_recon_replay}"
PSQL="$PG_BIN/psql"
export PGHOST PGPORT

LOG="$RECON_DIR/replay_all.log"
: > "$LOG"

echo "==> [replay] Recreating database '$REPLAY_DB'"
"$PSQL" -d postgres -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS $REPLAY_DB WITH (FORCE);" \
  -c "CREATE DATABASE $REPLAY_DB;"

echo "==> [replay] Loading Supabase roles (idempotent)"
if [ -f "$GATE_DIR/prod_roles.sql" ]; then
  sed -E 's/ GRANTED BY [A-Za-z_][A-Za-z0-9_]*//g' "$GATE_DIR/prod_roles.sql" \
    | sed -E 's/^CREATE ROLE ([A-Za-z_][A-Za-z0-9_]*);/DO \$gate\$ BEGIN CREATE ROLE \1; EXCEPTION WHEN duplicate_object THEN NULL; END \$gate\$;/' \
    | "$PSQL" -d postgres -v ON_ERROR_STOP=1 -q -f - 2>&1 | tee -a "$LOG" || true
fi

echo "==> [replay] Bootstrap extensions + auth"
"$PSQL" -d "$REPLAY_DB" -v ON_ERROR_STOP=1 -q -f "$RECON_DIR/bootstrap.sql" 2>&1 | tee -a "$LOG"

echo "==> [replay] Loading localgate stubs (cron/net/storage/supabase_functions)"
"$PSQL" -d "$REPLAY_DB" -v ON_ERROR_STOP=1 -q -f "$GATE_DIR/stubs.sql" 2>&1 | tee -a "$LOG"

echo "==> [replay] Applying all migrations in order"
failed=0
while IFS= read -r file; do
  base="$(basename "$file")"
  echo "    applying $base" | tee -a "$LOG"
  if ! "$PSQL" -d "$REPLAY_DB" -v ON_ERROR_STOP=1 -q -f "$file" >>"$LOG" 2>&1; then
    echo "FATAL: migration failed: $base (see $LOG)" >&2
    failed=1
    break
  fi
done < <(ls -1 "$MIGRATIONS_DIR"/*.sql | sort)

if [ "$failed" -ne 0 ]; then
  echo "REPLAY_FAILED" > "$RECON_DIR/replay_status.txt"
  exit 1
fi

echo "==> [replay] Loading storage baseline (post-migration policies)"
"$PSQL" -d "$REPLAY_DB" -v ON_ERROR_STOP=1 -q -f "$GATE_DIR/storage_baseline.sql" 2>&1 | tee -a "$LOG"

echo "REPLAY_OK" > "$RECON_DIR/replay_status.txt"
echo "==> [replay] Done. Database: $REPLAY_DB"
