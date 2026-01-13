#!/bin/bash
# =============================================================================
# Deploy Cron Job with Service Role Authentication
# =============================================================================
#
# This script updates the safety-announcement cron job with proper authentication.
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

echo "🔐 Deploying cron job with service role authentication..."
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
echo "🔄 Updating cron job..."

# Execute SQL to update the cron job
psql "$SUPABASE_DB_URL" <<SQL
-- Remove existing job
SELECT cron.unschedule('safety-announcement-7am');

-- Create new job with authentication
SELECT cron.schedule(
  'safety-announcement-7am',
  '0 13 * * 1-5',
  \$\$
  SELECT net.http_post(
    url := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer $SUPABASE_SERVICE_ROLE_KEY'
    ),
    body := '{"windowHours": 48}'::jsonb
  );
  \$\$
);

-- Verify the job was created
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'safety-announcement-7am';
SQL

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Cron job updated successfully!"
  echo ""
  echo "📊 To verify, run:"
  echo "   SELECT * FROM public.cron_job_runs LIMIT 5;"
  echo ""
  echo "🧪 To test manually:"
  echo "   curl -X POST https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/generate-safety-announcement \\"
  echo "     -H \"Authorization: Bearer \$SUPABASE_SERVICE_ROLE_KEY\" \\"
  echo "     -H \"Content-Type: application/json\" \\"
  echo "     -d '{\"windowHours\": 48, \"dryRun\": true}'"
else
  echo ""
  echo "❌ Failed to update cron job"
  exit 1
fi

