#!/usr/bin/env bash
# Gate 3 rebuild proof: baseline+forward rebuild must match live prod (schema-only).
#
# Fresh PG17 → committed prod_schema + prod_config → forward apply → normalized
# introspection → diff vs live prod dump (same normalization as verify_no_drift.sh).
#
# Usage:
#   bash supabase/.localgate/prove_rebuild.sh
#   OUT_DIR=.tmp/gate3-rebuild bash supabase/.localgate/prove_rebuild.sh
set -euo pipefail

GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$GATE_DIR/../.." && pwd)"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/.tmp/gate3-rebuild}"

source "$GATE_DIR/schema_normalize.sh"
source "$GATE_DIR/schema_diff_report.sh"
source "$GATE_DIR/rebuild_from_baseline.sh"

localgate_schema_normalize_init

URL="${SUPABASE_DB_URL:-}"
if [ -z "$URL" ] && [ -f "$REPO_ROOT/.env" ]; then
  URL="$(grep -E '^SUPABASE_DB_URL=' "$REPO_ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"')"
fi
[ -n "$URL" ] || { echo "FATAL: SUPABASE_DB_URL not set and not found in .env"; exit 1; }

mkdir -p "$OUT_DIR"
PROD_NORM="$OUT_DIR/prod_normalized.txt"
REBUILD_NORM="$OUT_DIR/rebuild_normalized.txt"
DIFF_OUT="$OUT_DIR/schema_diff.txt"

GATE_DB="${GATE_DB:-atts_gate3_rebuild}"
export GATE_DIR GATE_DB

echo "==> [1/4] Rebuilding from committed baseline + forward migrations"
rebuild_from_baseline

echo "==> [2/4] Normalized introspection: baseline+forward rebuild"
localgate_dump_normalized_schema "$GATE_DB" "$REBUILD_NORM"
echo "    rebuild lines: $(wc -l < "$REBUILD_NORM" | tr -d ' ')"

echo "==> [3/4] Normalized introspection: live prod"
localgate_dump_normalized_schema "$URL" "$PROD_NORM"
echo "    prod lines: $(wc -l < "$PROD_NORM" | tr -d ' ')"

echo "==> [4/4] Diff report (shared path with verify_no_drift.sh)"
if schema_diff_report "$PROD_NORM" "$REBUILD_NORM" "$DIFF_OUT"; then
  echo ""
  echo "REBUILD PROOF PASSED ✓"
  exit 0
fi

echo ""
echo "REBUILD PROOF FAILED ✗  (artifacts in $OUT_DIR)"
exit 1
