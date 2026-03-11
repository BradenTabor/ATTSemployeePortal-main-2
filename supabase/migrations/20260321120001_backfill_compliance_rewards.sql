-- =============================================================================
-- Backfill compliance_rewards for past weekdays.
-- Process weekdays in chronological order so streak calculation works against
-- already-inserted prior days.
--
-- Backfilled rows use config at backfill time: point values and snapshots
-- reflect app_settings.reward_points_config as of when this migration runs.
-- Historical point values may not reflect any prior intent.
-- Run once after deploying the compliance reward awarding logic.
-- =============================================================================

DO $$
DECLARE
  v_start_date date := '2026-01-01';
  v_end_date date := (CURRENT_DATE AT TIME ZONE 'America/Chicago')::date - 1;
  v_d date;
  v_cutoff_ts timestamptz;
  v_day_start_ts timestamptz;
  v_full_pts int := 5;
  v_partial_pts int := 2;
  v_streak_pts int := 10;
  v_streak_min int := 5;
  v_config jsonb;
  v_full_ids uuid[];
BEGIN
  SELECT value INTO v_config FROM public.app_settings WHERE key = 'reward_points_config';
  IF v_config IS NOT NULL THEN
    v_full_pts := COALESCE((v_config->>'full_compliance_points')::int, 5);
    v_partial_pts := COALESCE((v_config->>'partial_compliance_points')::int, 2);
    v_streak_pts := COALESCE((v_config->>'streak_bonus_points')::int, 10);
    v_streak_min := GREATEST(1, COALESCE((v_config->>'streak_min_days')::int, 5));
  END IF;

  FOR v_d IN
    SELECT d::date FROM generate_series(v_start_date, v_end_date, '1 day'::interval) AS g(d)
    WHERE EXTRACT(DOW FROM g.d) NOT IN (0, 6)
  LOOP
    v_cutoff_ts := (v_d + time '09:00') AT TIME ZONE 'America/Chicago';
    v_day_start_ts := v_d::timestamp AT TIME ZONE 'America/Chicago';

    -- Insert/update base rewards for all required users (0, partial, or full points; no streak yet).
    INSERT INTO public.compliance_rewards (user_id, date_for, forms_completed, points_awarded, points_config)
    SELECT
      r.user_id,
      v_d,
      COALESCE(
        array_remove(ARRAY[
          CASE WHEN dv.user_id IS NOT NULL THEN 'dvir' END,
          CASE WHEN eq.user_id IS NOT NULL THEN 'equipment' END,
          CASE WHEN js.user_id IS NOT NULL THEN 'jsa' END
        ], NULL),
        '{}'
      ),
      CASE
        WHEN (dv.user_id IS NOT NULL AND eq.user_id IS NOT NULL AND js.user_id IS NOT NULL) THEN v_full_pts
        WHEN (dv.user_id IS NOT NULL OR eq.user_id IS NOT NULL OR js.user_id IS NOT NULL) THEN v_partial_pts
        ELSE 0
      END,
      jsonb_build_object('full_compliance', v_full_pts, 'partial_compliance', v_partial_pts, 'streak_bonus', v_streak_pts)
    FROM (SELECT user_id FROM public.app_users WHERE role IN ('employee','foreman') AND email IS NOT NULL AND email NOT ILIKE '%@atts.test') r
    LEFT JOIN (SELECT user_id FROM public.dvir_reports WHERE report_date = v_d AND created_at < v_cutoff_ts GROUP BY user_id) dv ON dv.user_id = r.user_id
    LEFT JOIN (SELECT user_id FROM public.daily_equipment_inspections WHERE inspection_date = v_d AND created_at < v_cutoff_ts GROUP BY user_id) eq ON eq.user_id = r.user_id
    LEFT JOIN (SELECT user_id FROM public.daily_jsa WHERE created_at >= v_day_start_ts AND created_at < v_cutoff_ts GROUP BY user_id) js ON js.user_id = r.user_id
    ON CONFLICT (user_id, date_for) DO UPDATE SET
      forms_completed = EXCLUDED.forms_completed,
      points_awarded = EXCLUDED.points_awarded,
      points_config = EXCLUDED.points_config;

    -- Apply streak bonus for full-compliance users (uses already-inserted prior days).
    SELECT ARRAY_AGG(r.user_id) INTO v_full_ids
    FROM (SELECT user_id FROM public.app_users WHERE role IN ('employee','foreman') AND email IS NOT NULL AND email NOT ILIKE '%@atts.test') r
    LEFT JOIN (SELECT user_id FROM public.dvir_reports WHERE report_date = v_d AND created_at < v_cutoff_ts) dv ON dv.user_id = r.user_id
    LEFT JOIN (SELECT user_id FROM public.daily_equipment_inspections WHERE inspection_date = v_d AND created_at < v_cutoff_ts) eq ON eq.user_id = r.user_id
    LEFT JOIN (SELECT user_id FROM public.daily_jsa WHERE created_at >= v_day_start_ts AND created_at < v_cutoff_ts) js ON js.user_id = r.user_id
    WHERE dv.user_id IS NOT NULL AND eq.user_id IS NOT NULL AND js.user_id IS NOT NULL;

    IF v_full_ids IS NOT NULL AND array_length(v_full_ids, 1) > 0 THEN
      UPDATE public.compliance_rewards cr
      SET
        points_awarded = cr.points_awarded + v_streak_pts,
        points_config = cr.points_config || jsonb_build_object('streak_days', str.streak_days)
      FROM (SELECT * FROM public.get_compliance_streaks(v_full_ids, v_d) WHERE streak_days >= v_streak_min) str
      WHERE cr.user_id = str.user_id AND cr.date_for = v_d;
    END IF;
  END LOOP;
END;
$$;
