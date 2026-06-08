#!/usr/bin/env bash
# =============================================================================
# ATTS local validation gate.
#
# Baselines from PROD's REAL schema + config/reference rows (see config_tables.txt),
# applies forward migrations (version > baseline_anchor.txt), then runs verification
# assertions. This is the gate to run BEFORE any remote apply.
#
# We do NOT replay the historical migration chain from zero (it is known-broken
# due to pre-existing ordering/dependency bugs). We baseline from prod instead.
#
# Requirements (no Docker, no supabase local stack):
#   - Local PostgreSQL 17 (matches prod major 17) running on $PGHOST:$PGPORT
#   - Dump artifacts in this directory:
#       prod_roles.sql (local refresh), prod_schema.sql + prod_config_data.sql (committed baseline),
#       baseline_anchor.txt (committed prod HEAD at last re-baseline)
#
# Usage:
#   bash supabase/.localgate/run.sh
#   PG_BIN=/path/to/pg17/bin GATE_DB=atts_gate bash supabase/.localgate/run.sh
# =============================================================================
set -euo pipefail

GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$GATE_DIR/../.." && pwd)"

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
GATE_DB="${GATE_DB:-atts_gate}"
PSQL="$PG_BIN/psql"
export PGHOST PGPORT REPO_ROOT GATE_DIR GATE_DB

VERIFY_SQL="$GATE_DIR/verify.sql"

for f in "$PSQL"; do
  [ -x "$f" ] || { echo "FATAL: psql not found/executable at $f (set PG_BIN)"; exit 1; }
done
[ -f "$VERIFY_SQL" ] || { echo "FATAL: missing $VERIFY_SQL"; exit 1; }

source "$GATE_DIR/rebuild_from_baseline.sh"

echo "==> [1/2] Rebuilding from committed baseline + forward migrations"
rebuild_from_baseline

echo "==> [2/2] Running verification assertions"
"$PSQL" -d "$GATE_DB" -v ON_ERROR_STOP=1 -f "$VERIFY_SQL"

echo ""
echo "GATE PASSED ✓  (baseline=prod schema+config, +${LOCALGATE_FORWARD_APPLIED_COUNT:-0} forward migration(s), verify OK)"
