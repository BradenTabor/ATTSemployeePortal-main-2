#!/usr/bin/env bash
# Shared normalized schema dump + cosmetic filtering for reconcile/drift checks.
# Source this file from prove_rebuild.sh, verify_no_drift.sh, etc.

localgate_schema_normalize_init() {
  LOCALGATE_SCHEMA_NORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  INTROSPECT_SQL="$LOCALGATE_SCHEMA_NORM_DIR/introspect.sql"
  PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
  PGHOST="${PGHOST:-127.0.0.1}"
  PGPORT="${PGPORT:-5432}"
  PSQL="$PG_BIN/psql"
  export PGHOST PGPORT

  [ -x "$PSQL" ] || { echo "FATAL: psql not found at $PSQL (set PG_BIN)"; exit 1; }
  [ -f "$INTROSPECT_SQL" ] || { echo "FATAL: missing $INTROSPECT_SQL"; exit 1; }
}

# Canonicalize known pg_get_constraintdef / pg function-body formatting variants (same semantics).
localgate_apply_cosmetic_filters() {
  sed -E \
    -e "s/(CONSTRAINT\\|public\\.user_signatures\\.user_signatures_signature_type_check\\|c\\|CHECK \\(signature_type::text = ANY \\(ARRAY\\[)'canvas'::character varying(::text)?, 'typed'::character varying(::text)?(\\](::text\\[\\])?|\\]::text\\[\\]))\\)/\\1'canvas'::text,'typed'::text]))/" \
    -e 's/\( +/\(/g' \
    -e 's/, +/,/g'
}

localgate_dump_normalized_schema() {
  local target="$1"
  local out_file="$2"
  local conn_args=()

  if [[ "$target" == postgres://* || "$target" == postgresql://* ]]; then
    conn_args=("$target")
  else
    conn_args=(-d "$target")
  fi

  "$PSQL" "${conn_args[@]}" -v ON_ERROR_STOP=1 -q -t -A -f "$INTROSPECT_SQL" \
    | LC_ALL=C sort \
    | localgate_apply_cosmetic_filters \
    | grep -v '^$' \
    > "$out_file"
}
