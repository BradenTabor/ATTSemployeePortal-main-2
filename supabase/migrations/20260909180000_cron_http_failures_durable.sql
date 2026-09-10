-- Durable capture of cron-invoked non-2xx HTTP responses.
--
-- Why this exists:
--   20260909173000 taught get_recent_cron_failures() to read net._http_response, which is
--   where Edge Function 401/5xx responses actually land (pg_cron uses async net.http_post, so
--   cron.job_run_details.status stays 'succeeded' when only the HTTP call failed).
--   But pg_net.ttl is 6 hours. A detector that can only see 6 hours cannot feed a weekly or
--   monthly report — the evidence expires long before anyone reads it.
--
--   This migration adds a durable table plus a pg_cron sweep that runs more often than the
--   retention window, so failures survive to be reported on.
--
-- Additive only: new table, new function, new SQL-only cron job. No existing table is altered.

CREATE TABLE IF NOT EXISTS public.cron_http_failures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id bigint NOT NULL,
  jobname text,
  function_name text,
  cron_runid bigint,
  status_code integer,
  timed_out boolean NOT NULL DEFAULT false,
  error_msg text,
  response_excerpt text,
  occurred_at timestamptz NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cron_http_failures IS
  'Durable record of non-2xx / timed-out HTTP responses from pg_cron-invoked Edge Functions. Populated by sweep_cron_http_failures() every 2h because net._http_response only retains ~6h.';

COMMENT ON COLUMN public.cron_http_failures.response_id IS
  'net._http_response.id at sweep time. Unique together with occurred_at: the pair is stable per response, and including the timestamp keeps the sweep correct if pg_net''s id sequence is ever reset by an extension upgrade.';

-- Idempotency key for the sweep. See column comment for why it is a pair, not just response_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cron_http_failures_response
  ON public.cron_http_failures (response_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_cron_http_failures_occurred_at
  ON public.cron_http_failures (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_http_failures_jobname_occurred_at
  ON public.cron_http_failures (jobname, occurred_at DESC);

ALTER TABLE public.cron_http_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cron_http_failures_admin_select" ON public.cron_http_failures;
CREATE POLICY "cron_http_failures_admin_select"
  ON public.cron_http_failures FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.cron_http_failures TO authenticated;
GRANT ALL ON public.cron_http_failures TO service_role;

-- =============================================================================
-- Sweep
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sweep_cron_http_failures(lookback_hours integer DEFAULT 8)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, cron, pg_temp
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  -- lookback_hours must exceed pg_net.ttl (6h) so a skipped sweep cannot open a gap,
  -- and the unique index makes re-scanning the overlap free.
  INSERT INTO public.cron_http_failures (
    response_id, jobname, function_name, cron_runid,
    status_code, timed_out, error_msg, response_excerpt, occurred_at
  )
  SELECT
    h.id,
    attr.jobname,
    attr.function_name,
    attr.runid,
    h.status_code,
    COALESCE(h.timed_out, false),
    h.error_msg,
    left(h.content, 500),
    h.created
  FROM net._http_response h
  LEFT JOIN LATERAL (
    -- Responses carry no URL once the request queue drains, so attribute by timestamp to the
    -- most recent preceding cron run that looks like a net.http_post ('N rows' return message).
    -- When a job was recreated via unschedule+schedule its old cron.job row is gone, so fall
    -- back to the fixed UTC slot the job runs in rather than storing an unactionable jobid.
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
      substring(j.command from '/functions/v1/([A-Za-z0-9_-]+)') AS function_name,
      r.runid
    FROM cron.job_run_details r
    LEFT JOIN cron.job j ON j.jobid = r.jobid
    WHERE r.start_time <= h.created
      AND r.start_time > h.created - interval '2 minutes'
      AND r.return_message ~ '^[0-9]+ rows?$'
    ORDER BY r.start_time DESC
    LIMIT 1
  ) attr ON TRUE
  WHERE h.created > now() - make_interval(hours => GREATEST(lookback_hours, 7))
    AND (
      h.timed_out IS TRUE
      OR h.status_code IS NULL
      OR h.status_code < 200
      OR h.status_code >= 300
    )
  ON CONFLICT (response_id, occurred_at) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.sweep_cron_http_failures(integer) IS
  'Copies non-2xx / timed-out net._http_response rows into cron_http_failures before pg_net''s 6h TTL discards them. Idempotent via unique (response_id, occurred_at).';

REVOKE ALL ON FUNCTION public.sweep_cron_http_failures(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_cron_http_failures(integer) TO service_role;

-- Every 2 hours at :07, off the top-of-hour slots the HTTP cron jobs use.
-- Pure SQL job: no Edge Function call, so it needs no service-role Bearer.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'cron-http-failure-sweep';
    IF v_job_id IS NULL THEN
      PERFORM cron.schedule(
        'cron-http-failure-sweep',
        '7 */2 * * *',
        $cron$SELECT public.sweep_cron_http_failures();$cron$
      );
      RAISE NOTICE 'Scheduled cron-http-failure-sweep every 2h.';
    ELSE
      PERFORM cron.alter_job(
        v_job_id,
        schedule := '7 */2 * * *',
        command := $cron$SELECT public.sweep_cron_http_failures();$cron$,
        active := true
      );
      RAISE NOTICE 'Updated existing cron-http-failure-sweep.';
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'pg_cron not available; skipping cron-http-failure-sweep schedule.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule cron-http-failure-sweep: %', SQLERRM;
END;
$$;

-- =============================================================================
-- Point the reader at the durable table
-- =============================================================================

-- Add the sweep job itself to the monitored set: a silent sweep failure would re-blind the
-- monitor, which is the exact class of bug this whole line of work exists to close.
CREATE OR REPLACE VIEW public.cron_job_runs
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
    'clicksend-optout-reconcile',
    'cron-http-failure-sweep'
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
    'clicksend-optout-reconcile',
    'cron-http-failure-sweep'
  )
  OR (
    j.jobid IS NULL
    AND r.return_message ~ '^[0-9]+ rows?$'
    AND r.start_time > NOW() - interval '7 days'
  )
ORDER BY r.start_time DESC;

GRANT SELECT ON public.cron_job_runs TO authenticated;

COMMENT ON VIEW public.cron_job_runs IS
  'Live HTTP cron monitoring (last ~6h of HTTP detail, bounded by pg_net.ttl). For history beyond that read public.cron_http_failures or get_recent_cron_failures().';

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
      'clicksend-optout-reconcile',
      'cron-http-failure-sweep'
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
  -- Primary source: durable, answers for weeks.
  durable_http_failures AS (
    SELECT
      COALESCE(f.jobname, 'unattributed-http-cron') AS jobname,
      f.occurred_at AS failed_at,
      format(
        'HTTP %s%s: %s',
        COALESCE(f.status_code::text, 'null'),
        CASE WHEN f.timed_out THEN ' (timed_out)' ELSE '' END,
        left(COALESCE(f.error_msg, f.response_excerpt, 'no body'), 180)
      ) AS error_message
    FROM public.cron_http_failures f
    WHERE f.occurred_at > NOW() - (days_back || ' days')::INTERVAL
  ),
  -- Tail source: failures newer than the last sweep (< 2h old) are not in the table yet.
  unswept_http_failures AS (
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
        OR h.status_code IS NULL
        OR h.status_code < 200
        OR h.status_code >= 300
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.cron_http_failures f
        WHERE f.response_id = h.id AND f.occurred_at = h.created
      )
  )
  SELECT s.jobname, s.failed_at, s.error_message FROM sql_failures s
  UNION ALL
  SELECT d.jobname, d.failed_at, d.error_message FROM durable_http_failures d
  UNION ALL
  SELECT u.jobname, u.failed_at, u.error_message FROM unswept_http_failures u
  ORDER BY 2 DESC;
$$;

COMMENT ON FUNCTION public.get_recent_cron_failures(INTEGER) IS
  'Cron failures: SQL status=failed, plus HTTP non-2xx from the durable cron_http_failures table (weeks of history), plus any not-yet-swept rows still in net._http_response.';

GRANT EXECUTE ON FUNCTION public.get_recent_cron_failures(INTEGER) TO authenticated;
