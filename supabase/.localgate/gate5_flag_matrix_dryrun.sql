-- Gate 5: three-flag-combo matrix dry-run (localgate atts_gate only — NOT prod)
-- Run: psql -d atts_gate -v ON_ERROR_STOP=1 -f supabase/.localgate/gate5_flag_matrix_dryrun.sql
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_season_key text;
  v_challenge record;
BEGIN
  RAISE NOTICE '=== Gate 5 flag matrix dry-run (localgate) ===';

  -- Ensure flags dark at start
  UPDATE public.gamification_settings SET value = 'false'::jsonb
  WHERE key IN ('phase2_enabled', 'seasons_enabled', 'challenges_enabled');

  -- Combo 1: master off → all gated
  IF public.is_phase2_master_enabled() OR public.are_seasons_enabled() OR public.are_challenges_enabled() THEN
    RAISE EXCEPTION 'COMBO 1 FAIL: flags should be dark at start';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_active_season()) THEN
    RAISE EXCEPTION 'COMBO 1 FAIL: get_active_season should be empty when master off';
  END IF;
  SELECT * INTO v_challenge FROM public.get_active_challenge_for_activity(now());
  IF v_challenge.challenge_key IS NOT NULL THEN
    RAISE EXCEPTION 'COMBO 1 FAIL: active challenge should be null when master off';
  END IF;
  RAISE NOTICE 'COMBO 1 PASS: master off → seasons/challenges inactive';

  -- Combo 2: master on, seasons off, challenges off
  UPDATE public.gamification_settings SET value = 'true'::jsonb WHERE key = 'phase2_enabled';
  UPDATE public.gamification_settings SET value = 'false'::jsonb
  WHERE key IN ('seasons_enabled', 'challenges_enabled');

  IF NOT public.is_phase2_master_enabled() THEN
    RAISE EXCEPTION 'COMBO 2 FAIL: phase2_enabled should be true';
  END IF;
  IF public.are_seasons_enabled() OR public.are_challenges_enabled() THEN
    RAISE EXCEPTION 'COMBO 2 FAIL: sub-flags should be false';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_active_season()) THEN
    RAISE EXCEPTION 'COMBO 2 FAIL: seasons sub-flag off → no active season surface';
  END IF;
  SELECT * INTO v_challenge FROM public.get_active_challenge_for_activity(now());
  IF v_challenge.challenge_key IS NOT NULL THEN
    RAISE EXCEPTION 'COMBO 2 FAIL: challenges sub-flag off → no active challenge surface';
  END IF;
  RAISE NOTICE 'COMBO 2 PASS: master on + both sub-flags off → null surfaces';

  -- Combo 3: master on, seasons on, challenges off
  UPDATE public.gamification_settings SET value = 'true'::jsonb WHERE key = 'seasons_enabled';
  UPDATE public.gamification_settings SET value = 'false'::jsonb WHERE key = 'challenges_enabled';

  IF NOT public.are_seasons_enabled() THEN
    RAISE EXCEPTION 'COMBO 3 FAIL: seasons_enabled should be true';
  END IF;
  IF public.are_challenges_enabled() THEN
    RAISE EXCEPTION 'COMBO 3 FAIL: challenges_enabled should be false';
  END IF;
  SELECT * INTO v_challenge FROM public.get_active_challenge_for_activity(now());
  IF v_challenge.challenge_key IS NOT NULL THEN
    RAISE EXCEPTION 'COMBO 3 FAIL: challenges sub-flag off → challenge null';
  END IF;
  RAISE NOTICE 'COMBO 3 PASS: seasons on, challenges off → season path only (challenge null)';

  -- Combo 4: master on, seasons off, challenges on
  UPDATE public.gamification_settings SET value = 'false'::jsonb WHERE key = 'seasons_enabled';
  UPDATE public.gamification_settings SET value = 'true'::jsonb WHERE key = 'challenges_enabled';

  IF public.are_seasons_enabled() THEN
    RAISE EXCEPTION 'COMBO 4 FAIL: seasons_enabled should be false';
  END IF;
  IF NOT public.are_challenges_enabled() THEN
    RAISE EXCEPTION 'COMBO 4 FAIL: challenges_enabled should be true';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_active_season()) THEN
    RAISE EXCEPTION 'COMBO 4 FAIL: seasons sub-flag off → season null';
  END IF;
  RAISE NOTICE 'COMBO 4 PASS: challenges on, seasons off → challenge path only (season null)';

  -- Combo 5: all on — activate placeholder season + staged campaign
  UPDATE public.gamification_settings SET value = 'true'::jsonb
  WHERE key IN ('phase2_enabled', 'seasons_enabled', 'challenges_enabled');

  UPDATE public.seasons
  SET
    status = 'active',
    is_active = true,
    start_at = now() - interval '14 days',
    end_at = now() + interval '75 days',
    theme = 'ember'
  WHERE season_key = 'season_1_placeholder';

  INSERT INTO public.campaigns (
    campaign_key, challenge_key, title, starts_at, ends_at, multiplier, is_active
  ) VALUES (
    'gate5_dryrun_campaign',
    'compliance_sprint',
    'Founding Sprint Boost',
    now() - interval '2 days',
    now() + interval '12 days',
    1.50,
    true
  ) ON CONFLICT (campaign_key) DO UPDATE SET
    is_active = true,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    multiplier = EXCLUDED.multiplier;

  PERFORM public.rotate_weekly_auto_challenge(now());

  IF NOT public.are_seasons_enabled() OR NOT public.are_challenges_enabled() THEN
    RAISE EXCEPTION 'COMBO 5 FAIL: all flags should be on';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_active_season()) THEN
    RAISE EXCEPTION 'COMBO 5 FAIL: active season expected when all on + season active';
  END IF;
  SELECT * INTO v_challenge FROM public.get_active_challenge_for_activity(now());
  IF v_challenge.challenge_key IS NULL THEN
    RAISE EXCEPTION 'COMBO 5 FAIL: active challenge expected when all on + campaign active';
  END IF;
  SELECT season_key INTO v_season_key FROM public.get_active_season() LIMIT 1;
  RAISE NOTICE 'COMBO 5 PASS: all on → season_key=%, challenge_key=%, campaign_key=%',
    v_season_key,
    v_challenge.challenge_key,
    v_challenge.campaign_key;

  -- Restore dark flags + deactivate dry-run fixtures (do not commit flag-on to prod snapshot)
  UPDATE public.gamification_settings SET value = 'false'::jsonb
  WHERE key IN ('phase2_enabled', 'seasons_enabled', 'challenges_enabled');

  UPDATE public.seasons
  SET status = 'draft', theme = 'generic',
      start_at = '2099-01-01 06:00:00+00'::timestamptz,
      end_at = '2099-04-01 05:00:00+00'::timestamptz
  WHERE season_key = 'season_1_placeholder';

  UPDATE public.campaigns SET is_active = false WHERE campaign_key = 'gate5_dryrun_campaign';

  IF public.is_phase2_master_enabled() THEN
    RAISE EXCEPTION 'RESTORE FAIL: phase2_enabled still true';
  END IF;
  RAISE NOTICE 'RESTORE PASS: flags flipped back to dark; season/campaign fixtures inert';
  RAISE NOTICE '=== Gate 5 flag matrix dry-run COMPLETE ===';
END $$;
