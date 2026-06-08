#!/usr/bin/env bash
# Rebuild auth+public schema from committed baseline + forward migrations.
# Sets LOCALGATE_FORWARD_APPLIED_COUNT on success.
set -euo pipefail

rebuild_from_baseline() {
  local gate_dir repo_root migrations_dir
  gate_dir="${GATE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
  repo_root="${REPO_ROOT:-$(cd "$gate_dir/../.." && pwd)}"
  migrations_dir="$repo_root/supabase/migrations"

  local pg_bin pghost pgport gate_db psql
  pg_bin="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
  pghost="${PGHOST:-127.0.0.1}"
  pgport="${PGPORT:-5432}"
  gate_db="${GATE_DB:-atts_gate}"
  psql="$pg_bin/psql"
  export PGHOST="$pghost" PGPORT="$pgport"

  local roles_sql schema_sql config_data_sql stubs_sql storage_baseline_sql baseline_anchor
  roles_sql="$gate_dir/prod_roles.sql"
  schema_sql="$gate_dir/prod_schema.sql"
  config_data_sql="$gate_dir/prod_config_data.sql"
  stubs_sql="$gate_dir/stubs.sql"
  storage_baseline_sql="$gate_dir/storage_baseline.sql"
  baseline_anchor="$gate_dir/baseline_anchor.txt"

  for f in "$psql" "$roles_sql" "$schema_sql" "$config_data_sql" "$stubs_sql" "$storage_baseline_sql" "$baseline_anchor"; do
    [ -f "$f" ] || { echo "FATAL: missing gate artifact $f (run ./refresh.sh for prod_roles.sql)"; exit 1; }
  done

  local anchor
  anchor="$(grep -E '^[0-9]{14}$' "$baseline_anchor" | tail -1)"
  [ -n "$anchor" ] || { echo "FATAL: no version in $baseline_anchor"; exit 1; }

  echo "==> Rebuilding '$gate_db' from committed baseline (anchor=$anchor)"
  "$psql" -d postgres -v ON_ERROR_STOP=1 -q \
    -c "DROP DATABASE IF EXISTS $gate_db WITH (FORCE);" \
    -c "CREATE DATABASE $gate_db;"

  sed -E 's/ GRANTED BY [A-Za-z_][A-Za-z0-9_]*//g' "$roles_sql" \
    | sed -E 's/^CREATE ROLE ([A-Za-z_][A-Za-z0-9_]*);/DO \$gate\$ BEGIN CREATE ROLE \1; EXCEPTION WHEN duplicate_object THEN NULL; END \$gate\$;/' \
    | "$psql" -d postgres -v ON_ERROR_STOP=1 -q -f -

  "$psql" -d "$gate_db" -v ON_ERROR_STOP=1 -q -f "$stubs_sql"
  sed '/^CREATE SCHEMA public;$/d' "$schema_sql" \
    | "$psql" -d "$gate_db" -v ON_ERROR_STOP=1 -q -f -

  if [ -s "$config_data_sql" ]; then
    "$psql" -d "$gate_db" -v ON_ERROR_STOP=1 -q -f "$config_data_sql"
  fi

  "$psql" -d "$gate_db" -v ON_ERROR_STOP=1 -q -f "$storage_baseline_sql"

  LOCALGATE_FORWARD_APPLIED_COUNT=0
  while IFS= read -r file; do
    local base ver
    base="$(basename "$file")"
    ver="$(echo "$base" | sed -E 's/^([0-9]+)_.*/\1/')"
    if [[ "$ver" > "$anchor" ]]; then
      echo "    applying forward migration $base"
      "$psql" -d "$gate_db" -v ON_ERROR_STOP=1 -q -f "$file"
      LOCALGATE_FORWARD_APPLIED_COUNT=$((LOCALGATE_FORWARD_APPLIED_COUNT + 1))
    fi
  done < <(ls -1 "$migrations_dir"/*.sql | sort)

  echo "    forward migrations applied: $LOCALGATE_FORWARD_APPLIED_COUNT"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  rebuild_from_baseline
fi
