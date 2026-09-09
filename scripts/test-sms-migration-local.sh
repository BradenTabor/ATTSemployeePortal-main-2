#!/usr/bin/env bash
# Replay 20260902200000_sms_message_log.sql against throwaway Postgres 16.
# Asserts sms_compat_uuid + sms_message_log_compat work (catches bit→uuid cast bugs).
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER="${SMS_MIGRATION_TEST_CONTAINER:-atts-sms-migration-pg16}"
PORT="${SMS_MIGRATION_TEST_PORT:-5499}"
PGPASSWORD=postgres
export PGPASSWORD
PSQL=(psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
MIGRATION="supabase/migrations/20260902200000_sms_message_log.sql"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "SKIP: docker not installed — SMS migration local replay requires Docker."
  exit 0
fi
if ! docker info >/dev/null 2>&1; then
  echo "SKIP: Docker daemon is not running — SMS migration local replay skipped."
  exit 0
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "FAIL: psql is required"
  exit 1
fi
if [[ ! -f "$MIGRATION" ]]; then
  echo "FAIL: missing $MIGRATION"
  exit 1
fi

echo "=== Starting throwaway Postgres 16 on :$PORT ==="
cleanup
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=postgres \
  -p "${PORT}:5432" \
  postgres:16 >/dev/null

echo "=== Waiting for readiness ==="
for i in $(seq 1 40); do
  if "${PSQL[@]}" -c "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  if [[ "$i" -eq 40 ]]; then
    echo "FAIL: Postgres did not become ready"
    exit 1
  fi
  sleep 0.5
done

echo "=== Creating stubs (roles, helpers, legacy tables) ==="
"${PSQL[@]}" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$ SELECT true $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.sms_escalation_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier integer NOT NULL,
  date_checked date NOT NULL,
  overdue_count integer NOT NULL DEFAULT 0,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT true,
  error_message text,
  total_price numeric(10, 4),
  results jsonb
);

CREATE TABLE public.payroll_reminder_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier integer NOT NULL,
  date_checked date NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT true,
  error_message text,
  total_price numeric(10, 4),
  employee_user_ids uuid[] NOT NULL DEFAULT '{}',
  results jsonb
);

CREATE TABLE public.mass_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid,
  message_preview text,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  total_price numeric(12, 6) NOT NULL DEFAULT 0,
  status text NOT NULL,
  batch_details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
SQL

echo "=== Seeding one row per legacy table ==="
"${PSQL[@]}" <<'SQL'
INSERT INTO public.sms_escalation_send_log (
  id, tier, date_checked, overdue_count, recipient_count, success, total_price, results
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  1,
  '2026-09-01',
  1,
  1,
  true,
  0.0075,
  '[{"to":"+15551230001","status":"SUCCESS","messageId":"esc-msg-1","price":"0.0075"}]'::jsonb
);

INSERT INTO public.payroll_reminder_sms_log (
  id, tier, date_checked, recipient_count, success, total_price, results
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  1,
  '2026-09-01',
  1,
  true,
  0.0075,
  '{"clicksend_results":[{"to":"+15551230002","status":"SUCCESS","messageId":"pay-msg-1","price":"0.0075"}]}'::jsonb
);

INSERT INTO public.mass_sms_log (
  id, admin_user_id, message_preview, sent_count, failed_count, total_price, status, batch_details
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'Team reminder: toolbox talk at 7.',
  1,
  0,
  0.0075,
  'completed',
  '[{"index":0,"sent":1,"failed":0}]'::jsonb
);
SQL

echo "=== Applying $MIGRATION ==="
"${PSQL[@]}" -f "$MIGRATION"

echo "=== Asserting sms_message_log_compat ==="
RESULT=$("${PSQL[@]}" -t -A <<'SQL'
SELECT count(*)::text || '|' || string_agg(source_table, ',' ORDER BY source_table)
FROM public.sms_message_log_compat;
SQL
)

COUNT="${RESULT%%|*}"
SOURCES="${RESULT#*|}"

echo "compat_row_count=$COUNT"
echo "source_tables=$SOURCES"

if [[ "$COUNT" != "3" ]]; then
  echo "FAIL: expected 3 compat rows, got $COUNT"
  exit 1
fi

EXPECTED="mass_sms_log,payroll_reminder_sms_log,sms_escalation_send_log"
if [[ "$SOURCES" != "$EXPECTED" ]]; then
  echo "FAIL: expected source_tables=$EXPECTED, got $SOURCES"
  exit 1
fi

# Each source_table appears exactly once
DUP=$("${PSQL[@]}" -t -A -c "
  SELECT count(*) FROM (
    SELECT source_table FROM public.sms_message_log_compat GROUP BY source_table HAVING count(*) <> 1
  ) d;
")
if [[ "$DUP" != "0" ]]; then
  echo "FAIL: one or more source_table values appear more/less than once"
  exit 1
fi

# Smoke the uuid helper that previously failed on PG16
"${PSQL[@]}" -c "SELECT public.sms_compat_uuid('seed-check');" >/dev/null

echo ""
echo "PASS: migration applied; sms_message_log_compat returned 3 rows (one per legacy source_table)."
