#!/usr/bin/env bash
# =============================================================================
# ATTS local validation gate.
#
# Baselines from PROD's REAL schema (schema-only, no PII), applies only the
# local migrations that are NEWER than prod HEAD, then runs verification
# assertions. This is the gate to run BEFORE any remote apply.
#
# We do NOT replay the historical migration chain from zero (it is known-broken
# due to pre-existing ordering/dependency bugs). We baseline from prod instead.
#
# Requirements (no Docker, no supabase local stack):
#   - Local PostgreSQL 17 (matches prod major 17) running on $PGHOST:$PGPORT
#   - Dump artifacts in this directory (regenerate with ./refresh.sh):
#       prod_roles.sql, prod_schema.sql, prod_applied_versions.txt
#
# Usage:
#   bash supabase/.localgate/run.sh
#   PG_BIN=/path/to/pg17/bin GATE_DB=atts_gate bash supabase/.localgate/run.sh
# =============================================================================
set -euo pipefail

GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$GATE_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
GATE_DB="${GATE_DB:-atts_gate}"
PSQL="$PG_BIN/psql"
export PGHOST PGPORT

ROLES_SQL="$GATE_DIR/prod_roles.sql"
SCHEMA_SQL="$GATE_DIR/prod_schema.sql"
STUBS_SQL="$GATE_DIR/stubs.sql"
APPLIED="$GATE_DIR/prod_applied_versions.txt"
VERIFY_SQL="$GATE_DIR/verify.sql"
ASSERTIONS_SQL="$GATE_DIR/assertions.sql"

for f in "$PSQL"; do
  [ -x "$f" ] || { echo "FATAL: psql not found/executable at $f (set PG_BIN)"; exit 1; }
done
for f in "$ROLES_SQL" "$SCHEMA_SQL" "$STUBS_SQL" "$APPLIED" "$VERIFY_SQL" "$ASSERTIONS_SQL"; do
  [ -f "$f" ] || { echo "FATAL: missing gate artifact $f (run ./refresh.sh first)"; exit 1; }
done

echo "==> [1/5] (Re)creating throwaway gate database '$GATE_DB' on $PGHOST:$PGPORT"
"$PSQL" -d postgres -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS $GATE_DB WITH (FORCE);" \
  -c "CREATE DATABASE $GATE_DB;"

echo "==> [2/5] Loading prod roles (idempotent; grantor clauses stripped for local cluster)"
# CREATE ROLE -> guarded so re-runs don't fail; strip 'GRANTED BY <role>' so a
# vanilla superuser cluster can replay membership grants.
sed -E 's/ GRANTED BY [A-Za-z_][A-Za-z0-9_]*//g' "$ROLES_SQL" \
  | sed -E 's/^CREATE ROLE ([A-Za-z_][A-Za-z0-9_]*);/DO \$gate\$ BEGIN CREATE ROLE \1; EXCEPTION WHEN duplicate_object THEN NULL; END \$gate\$;/' \
  | "$PSQL" -d postgres -v ON_ERROR_STOP=1 -q -f -

echo "==> [3/5] Loading managed-schema stubs, then prod baseline schema (auth + public)"
# Keep the DB's default 'public' schema (so contrib extensions can live there);
# load inert shims for cron/net/supabase_functions + pg_trgm first so validated
# views/indexes/triggers in the dump resolve.
"$PSQL" -d "$GATE_DB" -v ON_ERROR_STOP=1 -q -f "$STUBS_SQL"
# Strip the dump's 'CREATE SCHEMA public;' (public already exists); everything
# else (ownership, grants, objects) loads as-is.
sed '/^CREATE SCHEMA public;$/d' "$SCHEMA_SQL" \
  | "$PSQL" -d "$GATE_DB" -v ON_ERROR_STOP=1 -q -f -

echo "==> [4/5] Applying local migrations newer than prod HEAD"
HEAD="$(sort "$APPLIED" | tail -1)"
echo "    prod HEAD = $HEAD"
applied_count=0
while IFS= read -r file; do
  base="$(basename "$file")"
  ver="$(echo "$base" | sed -E 's/^([0-9]+)_.*/\1/')"
  if [[ "$ver" > "$HEAD" ]]; then
    echo "    applying $base"
    "$PSQL" -d "$GATE_DB" -v ON_ERROR_STOP=1 -q -f "$file"
    applied_count=$((applied_count + 1))
  fi
done < <(ls -1 "$MIGRATIONS_DIR"/*.sql | sort)
echo "    applied $applied_count new migration(s)"

echo "==> [5/5] Running verification assertions"
"$PSQL" -d "$GATE_DB" -v ON_ERROR_STOP=1 -f "$VERIFY_SQL"

echo ""
echo "GATE PASSED ✓  (baseline=prod schema, +$applied_count new migration(s), verify OK)"
