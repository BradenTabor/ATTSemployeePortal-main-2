#!/usr/bin/env bash
# Re-drift guard: live prod must match committed baseline + forward migrations.
#
# Uses the same normalization path as prove_rebuild.sh (schema_normalize.sh +
# schema_diff_report.sh). Non-empty diff beyond known cosmetic normalization = alarm.
#
# Intended invocation:
#   - Manual / pre-re-baseline ritual:  bash supabase/.localgate/verify_no_drift.sh
#   - Optional scheduled CI (workflow_dispatch + SUPABASE_DB_URL secret) — see README
#
# Usage:
#   bash supabase/.localgate/verify_no_drift.sh
#   OUT_DIR=.tmp/drift-check bash supabase/.localgate/verify_no_drift.sh
set -euo pipefail

GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$GATE_DIR/../.." && pwd)"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/.tmp/drift-check}"

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
SUMMARY_OUT="$OUT_DIR/drift_summary.txt"

GATE_DB="${GATE_DB:-atts_drift_check}"
export GATE_DIR GATE_DB

ANCHOR="$(grep -E '^[0-9]{14}$' "$GATE_DIR/baseline_anchor.txt" | tail -1)"

{
  echo "Drift check summary"
  echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Baseline anchor: $ANCHOR"
  echo ""
} > "$SUMMARY_OUT"

echo "==> Rebuilding committed baseline + forward migrations"
rebuild_from_baseline
echo "    forward migrations applied: ${LOCALGATE_FORWARD_APPLIED_COUNT:-0}"

echo "==> Normalizing live prod schema"
localgate_dump_normalized_schema "$URL" "$PROD_NORM"

echo "==> Normalizing baseline+forward rebuild schema"
localgate_dump_normalized_schema "$GATE_DB" "$REBUILD_NORM"

echo "==> Comparing (prod vs baseline+forward)"
if schema_diff_report "$PROD_NORM" "$REBUILD_NORM" "$DIFF_OUT" | tee -a "$SUMMARY_OUT"; then
  echo "NO DRIFT ✓" | tee -a "$SUMMARY_OUT"
  exit 0
fi

echo "DRIFT DETECTED ✗  (see $OUT_DIR)" | tee -a "$SUMMARY_OUT"
exit 1
