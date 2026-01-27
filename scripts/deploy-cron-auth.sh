#!/bin/bash
# =============================================================================
# Deploy Cron Jobs with Service Role Authentication
# =============================================================================
#
# This script deploys all scheduled cron jobs with proper authentication:
#   - safety-announcement-7am (Mon-Fri 7 AM CST)
#   - admin-safety-forecast (Mon-Fri 6:30 AM CST) - writes to risk_score_history
#   - auto-tune-risk-algorithm (Sunday 2 AM UTC) - weekly tuning
#   - check-algorithm-performance (Daily 3 AM UTC) - rollback checker
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

# Get database URL
if [ -z "$SUPABASE_DB_URL" ]; then
  # Try to get from supabase CLI
  if command -v supabase &> /dev/null; then
    echo "📡 Getting database URL from Supabase CLI..."
    SUPABASE_DB_URL=$(supabase db url 2>/dev/null || echo "")
  fi
fi

if [ -z "$SUPABASE_DB_URL" ]; then
  echo ""
  echo "SUPABASE_DB_URL not set. You can find it in:"
  echo "  Supabase Dashboard → Settings → Database → Connection string → URI"
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
-- 1. Safety Announcement (7 AM CST Mon-Fri)
-- =============================================================================
DO \$\$
BEGIN
  PERFORM cron.unschedule('safety-announcement-7am');
EXCEPTION WHEN others THEN
  RAISE NOTICE 'safety-announcement-7am did not exist';
END \$\$;

SELECT cron.schedule(
  'safety-announcement-7am',
  '0 13 * * 1-5',
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
-- 2. Admin Safety Forecast (6:30 AM CST Mon-Fri) - writes to risk_score_history
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
-- 3. Auto-Tune Risk Algorithm (Sunday 2 AM UTC)
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
-- 4. Check Algorithm Performance (Daily 3 AM UTC)
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
-- Verify all jobs
-- =============================================================================
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname IN (
  'safety-announcement-7am',
  'admin-safety-forecast',
  'auto-tune-risk-algorithm',
  'check-algorithm-performance'
)
ORDER BY jobname;
SQL

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All cron jobs deployed successfully!"
  echo ""
  echo "📋 Jobs scheduled:"
  echo "   • safety-announcement-7am     - Mon-Fri 7:00 AM CST (13:00 UTC)"
  echo "   • admin-safety-forecast       - Mon-Fri 6:30 AM CST (12:30 UTC)"
  echo "   • auto-tune-risk-algorithm    - Sunday 2:00 AM UTC"
  echo "   • check-algorithm-performance - Daily 3:00 AM UTC"
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


