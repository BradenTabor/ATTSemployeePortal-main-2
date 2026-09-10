-- Detect HTTP-level cron failures (non-2xx Edge Function responses).
--
-- Root cause this fixes:
--   pg_cron jobs use net.http_post (async). Queuing the request succeeds, so
--   cron.job_run_details.status = 'succeeded' / return_message = '1 row' even when
--   the Edge Function returns 401/5xx. get_recent_cron_failures() previously only
--   filtered r.status = 'failed', so auth failures were invisible.
--
-- Limit: pg_net.ttl is 6 hours — net._http_response rows older than that are gone.
-- Attribution: responses have no URL after the request queue drains; we correlate
-- by timestamp to the nearest HTTP cron run (return_message matching row-count).

DROP VIEW IF EXISTS public.cron_job_runs;

CREATE VIEW public.cron_job_runs
WITH (security_invoker = true)
AS
SELECT
  COALESCE(j.jobname, 'orphaned-job-' || r.jobid::text) AS jobname,
  r.runid,
  r.job_pid,
  r.status AS cron_status,
  CASE
    WHEN r.status = 'failed' THEN 'failed'
    WHEN h.status_code IS NOT NULL
      AND (h.status_code < 200 OR h.status_code >= 300) THEN 'http_failed'
    WHEN h.timed_out IS TRUE THEN 'http_failed'
    WHEN h.error_msg IS NOT NULL AND h.status_code IS NULL THEN 'http_failed'
    ELSE r.status
  END AS effective_status,
  h.status_code AS http_status_code,
  h.timed_out AS http_timed_out,
  left(COALESCE(h.error_msg, h.content), 200) AS http_detail,
  r.start_time,
  r.end_time,
  (r.end_time - r.start_time) AS duration,
  r.return_message
FROM cron.job_run_details r
LEFT JOIN cron.job j ON j.jobid = r.jobid
LEFT JOIN LATERAL (
  -- Prefer the worst non-2xx in the response window; else the first response.
  SELECT hr.*
  FROM net._http_response hr
  WHERE hr.created >= r.start_time
    AND hr.created < r.start_time + interval '2 minutes'
  ORDER BY
    CASE
      WHEN hr.timed_out IS TRUE THEN 0
      WHEN hr.status_code IS NULL THEN 1
      WHEN hr.status_code < 200 OR hr.status_code >= 300 THEN 2
      ELSE 3
    END,
    hr.created ASC
  LIMIT 1
) h ON (
  -- Only attach HTTP metadata to runs that look like net.http_post invocations
  r.return_message ~ '^[0-9]+ rows?$'
  OR COALESCE(j.jobname, '') IN (
    'safety-announcement-5am',
    'admin-compliance-9am',
    'admin-safety-forecast',
    'safety-forecast-630am',
    'auto-tune-risk-algorithm',
    'check-algorithm-performance',
    'safety-briefing-reminder-push',
    'safety-briefing-reminder-sms',
    'safety-briefing-escalation-sms',
    'monthly-compliance-summary',
    'weekly-attendance-summary',
    'weekly-safety-audit-report',
    'payroll-hours-reminder-sms-utc13',
    'payroll-hours-reminder-sms-utc14',
    'monthly-safety-drawing',
    'clicksend-optout-reconcile'
  )
)
WHERE
  j.jobname IN (
    'safety-announcement-5am',
    'admin-compliance-9am',
    'admin-safety-forecast',
    'safety-forecast-630am',
    'auto-tune-risk-algorithm',
    'check-algorithm-performance',
    'safety-briefing-reminder-push',
    'safety-briefing-reminder-sms',
    'safety-briefing-escalation-sms',
    'monthly-compliance-summary',
    'weekly-attendance-summary',
    'weekly-safety-audit-report',
    'payroll-hours-reminder-sms-utc13',
    'payroll-hours-reminder-sms-utc14',
    'monthly-safety-drawing',
    'clicksend-optout-reconcile'
  )
  -- Keep orphaned HTTP runs (job recreated via unschedule+schedule) visible for a day
  OR (
    j.jobid IS NULL
    AND r.return_message ~ '^[0-9]+ rows?$'
    AND r.start_time > NOW() - interval '7 days'
  )
ORDER BY r.start_time DESC;

GRANT SELECT ON public.cron_job_runs TO authenticated;

COMMENT ON VIEW public.cron_job_runs IS
  'HTTP cron monitoring. effective_status=http_failed when net._http_response is non-2xx (pg_net.ttl ~6h). Includes orphaned runs after job recreate.';

CREATE OR REPLACE FUNCTION public.get_recent_cron_failures(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  jobname TEXT,
  failed_at TIMESTAMPTZ,
  error_message TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH monitored AS (
    SELECT unnest(ARRAY[
      'safety-announcement-5am',
      'admin-compliance-9am',
      'admin-safety-forecast',
      'safety-forecast-630am',
      'auto-tune-risk-algorithm',
      'check-algorithm-performance',
      'safety-briefing-reminder-push',
      'safety-briefing-reminder-sms',
      'safety-briefing-escalation-sms',
      'monthly-compliance-summary',
      'weekly-attendance-summary',
      'weekly-safety-audit-report',
      'payroll-hours-reminder-sms-utc13',
      'payroll-hours-reminder-sms-utc14',
      'monthly-safety-drawing',
      'clicksend-optout-reconcile'
    ]) AS jobname
  ),
  sql_failures AS (
    SELECT
      COALESCE(
        j.jobname,
        CASE to_char(r.start_time AT TIME ZONE 'UTC', 'HH24:MI')
          WHEN '10:00' THEN 'safety-announcement-5am'
          WHEN '10:20' THEN 'safety-briefing-reminder-push'
          WHEN '10:40' THEN 'safety-briefing-reminder-sms'
          WHEN '12:30' THEN 'admin-safety-forecast'
          WHEN '15:00' THEN 'admin-compliance-9am'
          WHEN '16:00' THEN 'safety-briefing-escalation-sms'
          ELSE 'orphaned-job-' || r.jobid::text
        END
      ) AS jobname,
      r.start_time AS failed_at,
      COALESCE(r.return_message, 'cron status=failed') AS error_message
    FROM cron.job_run_details r
    LEFT JOIN cron.job j ON j.jobid = r.jobid
    WHERE r.status = 'failed'
      AND r.start_time > NOW() - (days_back || ' days')::INTERVAL
      AND (
        j.jobname IN (SELECT m.jobname FROM monitored m)
        OR j.jobid IS NULL
      )
  ),
  http_failures AS (
    SELECT
      COALESCE(
        (
          SELECT COALESCE(
            j.jobname,
            CASE to_char(r.start_time AT TIME ZONE 'UTC', 'HH24:MI')
              WHEN '10:00' THEN 'safety-announcement-5am'
              WHEN '10:20' THEN 'safety-briefing-reminder-push'
              WHEN '10:40' THEN 'safety-briefing-reminder-sms'
              WHEN '12:30' THEN 'admin-safety-forecast'
              WHEN '15:00' THEN 'admin-compliance-9am'
              WHEN '16:00' THEN 'safety-briefing-escalation-sms'
              ELSE 'orphaned-job-' || r.jobid::text
            END
          )
          FROM cron.job_run_details r
          LEFT JOIN cron.job j ON j.jobid = r.jobid
          WHERE r.start_time <= h.created
            AND r.start_time > h.created - interval '2 minutes'
            AND r.return_message ~ '^[0-9]+ rows?$'
          ORDER BY r.start_time DESC
          LIMIT 1
        ),
        'unattributed-http-cron'
      ) AS jobname,
      h.created AS failed_at,
      format(
        'HTTP %s%s: %s',
        COALESCE(h.status_code::text, 'null'),
        CASE WHEN h.timed_out THEN ' (timed_out)' ELSE '' END,
        left(COALESCE(h.error_msg, h.content, 'no body'), 180)
      ) AS error_message
    FROM net._http_response h
    WHERE h.created > NOW() - (days_back || ' days')::INTERVAL
      AND (
        h.timed_out IS TRUE
        OR (h.error_msg IS NOT NULL AND (h.status_code IS NULL OR h.status_code < 200 OR h.status_code >= 300))
        OR h.status_code IS NULL
        OR h.status_code < 200
        OR h.status_code >= 300
      )
  )
  SELECT s.jobname, s.failed_at, s.error_message FROM sql_failures s
  UNION ALL
  SELECT h.jobname, h.failed_at, h.error_message FROM http_failures h
  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION public.get_recent_cron_failures(INTEGER) IS
  'Cron failures: SQL status=failed OR net._http_response non-2xx (pg_net retains ~6 hours).';

GRANT EXECUTE ON FUNCTION public.get_recent_cron_failures(INTEGER) TO authenticated;
