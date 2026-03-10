#!/bin/bash
# =============================================================================
# Deploy Cron Jobs with Service Role Authentication
# =============================================================================
#
# This script deploys all scheduled cron jobs with proper authentication:
#   - safety-announcement-5am (Mon-Fri 5 AM Central, 10:00 UTC)
#   - admin-compliance-9am (Mon-Fri 9 AM CST) - daily compliance summary email
#   - admin-safety-forecast (Mon-Fri 6:30 AM CST) - writes to risk_score_history
#   - auto-tune-risk-algorithm (Sunday 2 AM UTC) - weekly tuning
#   - check-algorithm-performance (Daily 3 AM UTC) - rollback checker
#   - safety-briefing-reminder-push (Mon-Fri 10:20 UTC = 5:20 AM CDT) - Pre–Tier 0 push
#   - safety-briefing-reminder-sms (Mon-Fri 10:40 UTC = 5:40 AM CDT) - Tier 0 employee reminder
#   - safety-briefing-escalation-sms (Mon-Fri 16:00 UTC = 10 AM CST) - SMS escalation for overdue briefing
#   - monthly-compliance-summary (1st of every month, 14:00 UTC = 8 AM CST) - executive compliance email
#   - weekly-attendance-summary (Monday 12:00 UTC = 7 AM CDT / 6 AM CST) - weekly attendance email
#
# It avoids committing the service role key to the repository.
#
# Usage:
#   SUPABASE_SERVICE_ROLE_KEY="your-key" ./scripts/deploy-cron-auth.sh
#
# Or set the key interactively:
#   ./scripts/deploy-cron-auth.sh
#
# Prerequisites:
#   - Supabase CLI installed and logged in
#   - psql available (for direct database access)
#   - SUPABASE_DB_URL environment variable set, OR
#   - Run from a directory with supabase/.env containing DATABASE_URL
#
# =============================================================================

set -e

# Load .env if present (SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL)
# Parse line-by-line to avoid source .env failing on special characters in values
if [ -f .env ]; then
  while IFS= read -r line; do
    case "$line" in
      SUPABASE_SERVICE_ROLE_KEY=*) export SUPABASE_SERVICE_ROLE_KEY="${line#SUPABASE_SERVICE_ROLE_KEY=}" ;;
      SUPABASE_DB_URL=*)         export SUPABASE_DB_URL="${line#SUPABASE_DB_URL=}" ;;
    esac
  done < <(grep -E '^(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL)=' .env 2>/dev/null || true)
fi

echo "🔐 Deploying cron jobs with service role authentication..."
echo ""

# Get service role key from environment or prompt
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "SUPABASE_SERVICE_ROLE_KEY not set in environment."
  echo ""
  echo "You can find it in:"
  echo "  Supabase Dashboard → Settings → API → Project API keys → service_role (secret)"
  echo ""
  read -sp "Enter your service role key: " SUPABASE_SERVICE_ROLE_KEY
  echo ""
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: Service role key is required"
  exit 1
fi

# Validate key format (should start with eyJ)
if [[ ! "$SUPABASE_SERVICE_ROLE_KEY" =~ ^eyJ ]]; then
  echo "⚠️  Warning: Service role key doesn't look like a JWT (should start with 'eyJ')"
  read -p "Continue anyway? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Get database URL (required for psql to update cron jobs)
if [ -z "$SUPABASE_DB_URL" ]; then
  echo ""
  echo "SUPABASE_DB_URL not set. Add it to .env or enter now."
  echo "  Supabase Dashboard → Project Settings → Database → Connection string → URI"
  echo "  (Use the 'Session mode' or 'Transaction' URI, e.g. postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres)"
  echo ""
  read -sp "Enter your database URL: " SUPABASE_DB_URL
  echo ""
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ Error: Database URL is required"
  exit 1
fi

echo ""
echo "📋 Configuration:"
echo "   Key prefix: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo "   DB URL: ${SUPABASE_DB_URL:0:50}..."
echo ""

# Confirm before proceeding
read -p "Proceed with deployment? (y/N) " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "🔄 Updating cron jobs..."

# Execute SQL to update all cron jobs
psql "$SUPABASE_DB_URL" <<SQL
-- =============================================================================
-- 1. Safety Announcement (5 AM Central Mon-Fri, 10:00 UTC) – matches reward claim 5–8 AM
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('safety-announcement-7am');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-announcement-7am did not exist';
END \$\$;

DO \$\$
BEGIN
  PERFORM cron.unschedule('safety-announcement-5am');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-announcement-5am did not exist';
END \$\$;

SELECT cron.schedule(
  'safety-announcement-5am',
  '0 10 * * 1-5',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{"windowHours": 48}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- 2. Admin Compliance Summary (9 AM CST Mon-Fri) - daily compliance email
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('admin-compliance-9am');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'admin-compliance-9am did not exist';
END \$\$;

SELECT cron.schedule(
  'admin-compliance-9am',
  '0 15 * * 1-5',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-compliance-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- 3. Admin Safety Forecast (6:30 AM CST Mon-Fri) - writes to risk_score_history
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('admin-safety-forecast');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'admin-safety-forecast did not exist';
END \$\$;

SELECT cron.schedule(
  'admin-safety-forecast',
  '30 12 * * 1-5',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-safety-forecast-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- 4. Auto-Tune Risk Algorithm (Sunday 2 AM UTC)
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('auto-tune-risk-algorithm');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'auto-tune-risk-algorithm did not exist';
END \$\$;

SELECT cron.schedule(
  'auto-tune-risk-algorithm',
  '0 2 * * 0',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/auto-tune-risk-algorithm',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- 5. Check Algorithm Performance (Daily 3 AM UTC)
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('check-algorithm-performance');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'check-algorithm-performance did not exist';
END \$\$;

SELECT cron.schedule(
  'check-algorithm-performance',
  '0 3 * * *',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/check-algorithm-performance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- 6. Safety Briefing Reminder Push - Pre–Tier 0 (Mon-Fri 10:20 UTC = 5:20 AM CDT)
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('safety-briefing-reminder-push');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-briefing-reminder-push did not exist';
END \$\$;

SELECT cron.schedule(
  'safety-briefing-reminder-push',
  '20 10 * * 1-5',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-reminder-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- 7. Safety Briefing Reminder SMS - Tier 0 (Mon-Fri 10:40 UTC = 5:40 AM CDT)
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('safety-briefing-reminder-sms');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-briefing-reminder-sms did not exist';
END \$\$;

SELECT cron.schedule(
  'safety-briefing-reminder-sms',
  '40 10 * * 1-5',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-reminder-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- 8. Safety Briefing Escalation SMS (Mon-Fri 16:00 UTC = 10 AM CST / 11 AM CDT)
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('safety-briefing-escalation-sms');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-briefing-escalation-sms did not exist';
END \$\$;

SELECT cron.schedule(
  'safety-briefing-escalation-sms',
  '0 16 * * 1-5',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/safety-briefing-escalation-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- 9. Monthly Compliance Summary (1st of every month, 14:00 UTC = 8 AM CST)
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('monthly-compliance-summary');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'monthly-compliance-summary did not exist';
END \$\$;

SELECT cron.schedule(
  'monthly-compliance-summary',
  '0 14 1 * *',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/monthly-compliance-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- 10. Weekly Attendance Summary (Monday 12:00 UTC = 7 AM CDT / 6 AM CST)
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('weekly-attendance-summary');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'weekly-attendance-summary did not exist';
END \$\$;

SELECT cron.schedule(
  'weekly-attendance-summary',
  '0 12 * * 1',
  \$cron\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/weekly-attendance-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  \$cron\$
);

-- =============================================================================
-- Verify all jobs
-- =============================================================================
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname IN (
  'safety-announcement-5am',
  'admin-compliance-9am',
  'admin-safety-forecast',
  'auto-tune-risk-algorithm',
  'check-algorithm-performance',
  'safety-briefing-reminder-push',
  'safety-briefing-reminder-sms',
  'safety-briefing-escalation-sms',
  'monthly-compliance-summary',
  'weekly-attendance-summary'
)
ORDER BY jobname;
SQL

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All cron jobs deployed successfully!"
  echo ""
  echo "📋 Jobs scheduled:"
  echo "   • safety-announcement-5am     - Mon-Fri 5:00 AM Central (10:00 UTC)"
  echo "   • admin-compliance-9am       - Mon-Fri 9:00 AM CST (15:00 UTC)"
  echo "   • admin-safety-forecast       - Mon-Fri 6:30 AM CST (12:30 UTC)"
  echo "   • auto-tune-risk-algorithm    - Sunday 2:00 AM UTC"
  echo "   • check-algorithm-performance - Daily 3:00 AM UTC"
  echo "   • safety-briefing-reminder-push    - Mon-Fri 5:20 AM CDT (10:20 UTC)"
  echo "   • safety-briefing-reminder-sms     - Mon-Fri 5:40 AM CDT (10:40 UTC)"
  echo "   • safety-briefing-escalation-sms   - Mon-Fri 10:00 AM CST (16:00 UTC)"
  echo "   • monthly-compliance-summary       - 1st of each month 8:00 AM CST (14:00 UTC)"
  echo "   • weekly-attendance-summary         - Monday 7:00 AM CDT / 6:00 AM CST (12:00 UTC)"
  echo ""
  echo "📊 To verify execution history:"
  echo "   SELECT * FROM public.cron_job_runs ORDER BY start_time DESC LIMIT 10;"
  echo ""
  echo "🧪 To test the safety forecast manually:"
  echo "   curl -X POST https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/admin-safety-forecast-cron \\"
  echo "     -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" \\"
  echo "     -H \"Content-Type: application/json\" \\"
  echo "     -d '{\"dryRun\": true}'"
else
  echo ""
  echo "❌ Failed to deploy cron jobs"
  exit 1
fi


