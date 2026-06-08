-- Gate 5: EXPLAIN refresh_user_streak hot-path lookups on streak_week_activity
-- Run against local or remote after Gate 3 migrations applied.
-- Replace :user_id and :week_start with real values from your test cohort.

-- 1) week_has_meaningful_streak_activity pattern (called every loop iteration)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT EXISTS (
  SELECT 1
  FROM public.streak_week_activity swa
  WHERE swa.user_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND swa.week_start = public.chicago_iso_week_start(now())
    AND swa.activity_source NOT IN ('manual_freeze', 'rto_auto_protect')
);

-- 2) manual_freeze week lookup inside refresh_user_streak WHILE loop
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT 1
FROM public.streak_week_activity swa
WHERE swa.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND swa.week_start = public.chicago_iso_week_start(now()) - 7
  AND swa.activity_source = 'manual_freeze';

-- 3) last_active_week aggregate
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT max(swa.week_start)
FROM public.streak_week_activity swa
WHERE swa.user_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND swa.activity_source NOT IN ('manual_freeze', 'rto_auto_protect');

-- Expected at ~26 users: Index Scan on idx_streak_week_activity_user_week (user_id, week_start DESC)
