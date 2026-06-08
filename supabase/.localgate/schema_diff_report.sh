#!/usr/bin/env bash
# Classify normalized schema diff with actionable failure modes.
# Usage: schema_diff_report.sh <prod_normalized.txt> <rebuild_normalized.txt> [unified_diff_out]

schema_diff_report() {
  local prod_file="$1"
  local rebuild_file="$2"
  local diff_out="${3:-}"

  local prod_only_file rebuild_only_file
  prod_only_file="$(mktemp)"
  rebuild_only_file="$(mktemp)"
  trap 'rm -f "$prod_only_file" "$rebuild_only_file"' RETURN

  comm -23 "$prod_file" "$rebuild_file" > "$prod_only_file" || true
  comm -13 "$prod_file" "$rebuild_file" > "$rebuild_only_file" || true

  local prod_only_count rebuild_only_count
  prod_only_count="$(grep -c . "$prod_only_file" 2>/dev/null || true)"
  rebuild_only_count="$(grep -c . "$rebuild_only_file" 2>/dev/null || true)"

  if [ -n "$diff_out" ]; then
    diff -u "$prod_file" "$rebuild_file" > "$diff_out" || true
  fi

  if [ "$prod_only_count" = "0" ] && [ "$rebuild_only_count" = "0" ]; then
    echo "RESULT: CLEAN (baseline+forward matches live prod after cosmetic normalization)"
    return 0
  fi

  echo "RESULT: DRIFT DETECTED"
  echo ""

  if [ "$prod_only_count" != "0" ]; then
    echo "MODE: PROD-AHEAD ($prod_only_count line(s) in live prod, not in baseline+forward rebuild)"
    echo "REMEDIATION: Someone applied SQL to prod out-of-band. Capture the change as a committed"
    echo "             forward migration (apply via MCP), then re-run the gate — do NOT edit the baseline."
    echo "OBJECTS:"
    cat "$prod_only_file"
    echo ""
  fi

  if [ "$rebuild_only_count" != "0" ]; then
    echo "MODE: REPO-AHEAD ($rebuild_only_count line(s) in baseline+forward rebuild, not in live prod)"
    echo "REMEDIATION: A committed forward migration was never applied to prod. Apply pending"
    echo "             migration(s) via MCP, then re-run this check."
    echo "OBJECTS:"
    cat "$rebuild_only_file"
    echo ""
  fi

  if [ -n "$diff_out" ] && [ -s "$diff_out" ]; then
    echo "Unified diff written to: $diff_out"
  fi

  return 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  set -euo pipefail
  [ "$#" -ge 2 ] || { echo "Usage: $0 <prod.txt> <rebuild.txt> [diff.out]"; exit 2; }
  schema_diff_report "$1" "$2" "${3:-}"
fi
