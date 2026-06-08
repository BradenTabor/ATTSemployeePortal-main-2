-- =============================================================================
-- Gamification Phase 2 — Gate 3: program-admin tooling (dark / inert)
-- - Campaign + season CRUD/scheduling RPCs (is_gamification_program_admin)
-- - Staged campaigns default is_active=false; payouts still gated by phase2 flags
-- - Owner nudge when scheduled/active season lacks overlapping campaign
-- Depends on: 20260608230200_gamification_phase2_gate2_challenge_engine.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- RLS: program admins (admin + safety_officer) manage seasons/campaigns
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins manage seasons" ON public.seasons;
CREATE POLICY "Program admins manage seasons"
  ON public.seasons TO authenticated
  USING (public.is_gamification_program_admin())
  WITH CHECK (public.is_gamification_program_admin());

DROP POLICY IF EXISTS "Admins manage campaigns" ON public.campaigns;
CREATE POLICY "Program admins manage campaigns"
  ON public.campaigns TO authenticated
  USING (public.is_gamification_program_admin())
  WITH CHECK (public.is_gamification_program_admin());

ALTER TABLE public.campaigns
  ALTER COLUMN is_active SET DEFAULT false;

COMMENT ON COLUMN public.campaigns.is_active IS
  'Staged campaigns stay false until program admin activates after kickoff prep. Payout writers also require phase2 flags.';

-- -----------------------------------------------------------------------------
-- Helper: read program_owner_user_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_gamification_program_owner_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value jsonb;
  v_text  text;
BEGIN
  SELECT gs.value
  INTO v_value
  FROM public.gamification_settings gs
  WHERE gs.key = 'program_owner_user_id';

  IF v_value IS NULL OR v_value = 'null'::jsonb THEN
    RETURN NULL;
  END IF;

  IF jsonb_typeof(v_value) = 'string' THEN
    v_text := trim(both '"' from v_value::text);
  ELSE
    v_text := v_value #>> '{}';
  END IF;

  IF v_text IS NULL OR v_text = '' OR lower(v_text) = 'null' THEN
    RETURN NULL;
  END IF;

  RETURN v_text::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_gamification_program_owner_user_id() IS
  'Configured gamification program owner UUID from gamification_settings.';

GRANT EXECUTE ON FUNCTION public.get_gamification_program_owner_user_id() TO authenticated;

-- -----------------------------------------------------------------------------
-- List helpers (program admin only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_gamification_program_seasons()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'season_key', s.season_key,
          'name', s.name,
          'theme', s.theme,
          'start_at', s.start_at,
          'end_at', s.end_at,
          'status', s.status,
          'most_improved_enabled', s.most_improved_enabled,
          'finalized_at', s.finalized_at,
          'sort_order', s.sort_order,
          'is_active', s.is_active,
          'created_at', s.created_at
        )
        ORDER BY s.sort_order ASC, s.start_at ASC, s.season_key ASC
      )
      FROM public.seasons s
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.list_gamification_program_seasons() IS
  'Program-admin season list for setup UI. Readable while Phase 2 is dark.';

GRANT EXECUTE ON FUNCTION public.list_gamification_program_seasons() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_gamification_program_challenges()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'challenge_key', c.challenge_key,
          'title', c.title,
          'description', c.description,
          'cadence', c.cadence,
          'challenge_type', c.challenge_type,
          'is_active', c.is_active,
          'sort_order', c.sort_order
        )
        ORDER BY c.sort_order ASC, c.challenge_key ASC
      )
      FROM public.challenges c
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.list_gamification_program_challenges() IS
  'Challenge catalog for campaign FK picker.';

GRANT EXECUTE ON FUNCTION public.list_gamification_program_challenges() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_gamification_program_campaigns()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'campaign_key', cam.campaign_key,
          'challenge_key', cam.challenge_key,
          'title', cam.title,
          'starts_at', cam.starts_at,
          'ends_at', cam.ends_at,
          'multiplier', cam.multiplier,
          'is_active', cam.is_active,
          'created_by', cam.created_by,
          'created_at', cam.created_at
        )
        ORDER BY cam.starts_at ASC, cam.campaign_key ASC
      )
      FROM public.campaigns cam
    ),
    '[]'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.list_gamification_program_campaigns() IS
  'Program-admin campaign list including staged (is_active=false) rows.';

GRANT EXECUTE ON FUNCTION public.list_gamification_program_campaigns() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_gamification_phase2_admin_flags()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'phase2_enabled', public.is_phase2_master_enabled(),
    'seasons_enabled', public.are_seasons_enabled(),
    'challenges_enabled', public.are_challenges_enabled(),
    'is_program_admin', public.is_gamification_program_admin()
  );
$$;

COMMENT ON FUNCTION public.get_gamification_phase2_admin_flags() IS
  'Phase 2 flag snapshot for program-admin UI badges.';

GRANT EXECUTE ON FUNCTION public.get_gamification_phase2_admin_flags() TO authenticated;

-- -----------------------------------------------------------------------------
-- Season upsert + status controls (lifecycle cron still drives scheduled→active)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_gamification_season(
  p_season_key             text,
  p_name                   text,
  p_start_at               timestamptz,
  p_end_at                 timestamptz,
  p_theme                  text DEFAULT NULL,
  p_most_improved_enabled  boolean DEFAULT false,
  p_sort_order             int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.season_status;
  v_status   public.season_status := 'draft';
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  IF p_season_key IS NULL OR btrim(p_season_key) = '' THEN
    RAISE EXCEPTION 'season_key is required';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'name is required';
  END IF;
  IF p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'end_at must be after start_at';
  END IF;

  SELECT s.status
  INTO v_existing
  FROM public.seasons s
  WHERE s.season_key = p_season_key;

  IF v_existing IS NOT NULL THEN
    v_status := v_existing;
    IF v_status IN ('active', 'closed') THEN
      RAISE EXCEPTION 'Cannot edit season % while status is %', p_season_key, v_status;
    END IF;
  END IF;

  INSERT INTO public.seasons (
    season_key, name, theme, start_at, end_at, status,
    most_improved_enabled, sort_order, is_active
  ) VALUES (
    p_season_key, p_name, p_theme, p_start_at, p_end_at, v_status,
    COALESCE(p_most_improved_enabled, false), COALESCE(p_sort_order, 0), true
  )
  ON CONFLICT (season_key) DO UPDATE SET
    name = EXCLUDED.name,
    theme = EXCLUDED.theme,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    most_improved_enabled = EXCLUDED.most_improved_enabled,
    sort_order = EXCLUDED.sort_order;

  RETURN jsonb_build_object(
    'status', 'ok',
    'season_key', p_season_key,
    'season_status', v_status
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_gamification_season(text, text, timestamptz, timestamptz, text, boolean, int) IS
  'Create/update draft or scheduled seasons. Active/closed seasons are immutable.';

GRANT EXECUTE ON FUNCTION public.upsert_gamification_season(text, text, timestamptz, timestamptz, text, boolean, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_gamification_season_status(
  p_season_key text,
  p_status     public.season_status
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.seasons;
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  SELECT * INTO v_row
  FROM public.seasons s
  WHERE s.season_key = p_season_key
  FOR UPDATE;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Unknown season_key=%', p_season_key;
  END IF;

  IF p_status = 'scheduled' THEN
    IF v_row.status NOT IN ('draft', 'scheduled') THEN
      RAISE EXCEPTION 'Cannot schedule season % from status %', p_season_key, v_row.status;
    END IF;
  ELSIF p_status = 'closed' THEN
    IF v_row.status NOT IN ('draft', 'scheduled', 'active') THEN
      RAISE EXCEPTION 'Cannot close season % from status %', p_season_key, v_row.status;
    END IF;
  ELSIF p_status = 'draft' THEN
    IF v_row.status NOT IN ('draft', 'scheduled') THEN
      RAISE EXCEPTION 'Cannot revert season % to draft from status %', p_season_key, v_row.status;
    END IF;
  ELSIF p_status = 'active' THEN
    RAISE EXCEPTION 'Manual active transition is not supported; lifecycle cron promotes scheduled seasons';
  END IF;

  UPDATE public.seasons
  SET status = p_status
  WHERE season_key = p_season_key;

  RETURN jsonb_build_object(
    'status', 'ok',
    'season_key', p_season_key,
    'season_status', p_status
  );
END;
$$;

COMMENT ON FUNCTION public.set_gamification_season_status(text, public.season_status) IS
  'Program-admin open (schedule) / close controls. Cron still drives scheduled→active and active→closed.';

GRANT EXECUTE ON FUNCTION public.set_gamification_season_status(text, public.season_status) TO authenticated;

-- -----------------------------------------------------------------------------
-- Campaign upsert + activate (staged until admin activates)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_gamification_campaign(
  p_campaign_key  text,
  p_challenge_key text,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_title         text DEFAULT NULL,
  p_multiplier    numeric DEFAULT 1.00
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  IF p_campaign_key IS NULL OR btrim(p_campaign_key) = '' THEN
    RAISE EXCEPTION 'campaign_key is required';
  END IF;
  IF p_challenge_key IS NULL OR btrim(p_challenge_key) = '' THEN
    RAISE EXCEPTION 'challenge_key is required';
  END IF;
  IF p_multiplier IS NULL OR p_multiplier < 1.00 THEN
    RAISE EXCEPTION 'multiplier must be >= 1.00';
  END IF;
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'ends_at must be after starts_at';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.challenges c WHERE c.challenge_key = p_challenge_key
  ) THEN
    RAISE EXCEPTION 'Unknown challenge_key=%', p_challenge_key;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.campaigns cam WHERE cam.campaign_key = p_campaign_key
  ) INTO v_exists;

  IF v_exists THEN
    UPDATE public.campaigns cam
    SET
      challenge_key = p_challenge_key,
      title = p_title,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      multiplier = p_multiplier
    WHERE cam.campaign_key = p_campaign_key;
  ELSE
    INSERT INTO public.campaigns (
      campaign_key, challenge_key, title, starts_at, ends_at,
      multiplier, is_active, created_by
    ) VALUES (
      p_campaign_key, p_challenge_key, p_title, p_starts_at, p_ends_at,
      p_multiplier, false, auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'campaign_key', p_campaign_key,
    'is_active', COALESCE((SELECT cam.is_active FROM public.campaigns cam WHERE cam.campaign_key = p_campaign_key), false),
    'staged', NOT COALESCE((SELECT cam.is_active FROM public.campaigns cam WHERE cam.campaign_key = p_campaign_key), false)
  );
END;
$$;

COMMENT ON FUNCTION public.upsert_gamification_campaign(text, text, timestamptz, timestamptz, text, numeric) IS
  'Create/update campaigns. New rows are staged (is_active=false) until explicitly activated.';

GRANT EXECUTE ON FUNCTION public.upsert_gamification_campaign(text, text, timestamptz, timestamptz, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_gamification_campaign_active(
  p_campaign_key text,
  p_is_active    boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_gamification_program_admin() THEN
    RAISE EXCEPTION 'Gamification program admin access required';
  END IF;

  UPDATE public.campaigns cam
  SET is_active = COALESCE(p_is_active, false)
  WHERE cam.campaign_key = p_campaign_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown campaign_key=%', p_campaign_key;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'campaign_key', p_campaign_key,
    'is_active', p_is_active
  );
END;
$$;

COMMENT ON FUNCTION public.set_gamification_campaign_active(text, boolean) IS
  'Activate/deactivate a staged campaign. Payout writers still require phase2_enabled + challenges_enabled.';

GRANT EXECUTE ON FUNCTION public.set_gamification_campaign_active(text, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- Owner nudge: active/scheduled season without overlapping active campaign
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.season_has_active_campaign(p_season_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.seasons s
    INNER JOIN public.campaigns cam ON cam.is_active
      AND cam.starts_at < s.end_at
      AND cam.ends_at > s.start_at
    WHERE s.season_key = p_season_key
  );
$$;

COMMENT ON FUNCTION public.season_has_active_campaign(text) IS
  'True when an activated campaign window overlaps the season window.';

CREATE OR REPLACE FUNCTION public.nudge_program_owner_season_needs_campaign(
  p_season_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner       uuid;
  v_season      record;
  v_event_id    uuid;
  v_dedupe_id   uuid;
  v_title       text;
  v_body        text;
BEGIN
  IF NOT public.is_phase2_master_enabled() THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'phase2_dark');
  END IF;

  v_owner := public.get_gamification_program_owner_user_id();
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'owner_not_configured');
  END IF;

  SELECT s.season_key, s.name, s.start_at, s.end_at, s.status
  INTO v_season
  FROM public.seasons s
  WHERE s.is_active
    AND s.status IN ('scheduled', 'active')
    AND (p_season_key IS NULL OR s.season_key = p_season_key)
    AND NOT public.season_has_active_campaign(s.season_key)
  ORDER BY s.start_at ASC
  LIMIT 1;

  IF v_season.season_key IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'no_season_needs_campaign');
  END IF;

  v_dedupe_id := (
    substr(md5('gamification_season_nudge:' || v_season.season_key), 1, 8) || '-' ||
    substr(md5('gamification_season_nudge:' || v_season.season_key), 9, 4) || '-' ||
    '4' || substr(md5('gamification_season_nudge:' || v_season.season_key), 13, 3) || '-' ||
    substr(md5('gamification_season_nudge:' || v_season.season_key), 16, 4) || '-' ||
    substr(md5('gamification_season_nudge:' || v_season.season_key), 20, 12)
  )::uuid;

  SELECT ne.id
  INTO v_event_id
  FROM public.notification_events ne
  WHERE ne.entity_type = 'gamification_season_nudge'
    AND ne.entity_id = v_dedupe_id;

  IF v_event_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'reason', 'already_nudged',
      'season_key', v_season.season_key,
      'owner_user_id', v_owner
    );
  END IF;

  v_title := format('Season needs campaign: %s', v_season.name);
  v_body := format(
    'Season "%s" (%s) is %s but has no activated campaign overlapping %s – %s. Stage a campaign in Program Admin before kickoff.',
    v_season.name,
    v_season.season_key,
    v_season.status,
    to_char(v_season.start_at AT TIME ZONE 'America/Chicago', 'Mon DD, YYYY'),
    to_char(v_season.end_at AT TIME ZONE 'America/Chicago', 'Mon DD, YYYY')
  );

  INSERT INTO public.notification_events (
    category,
    severity,
    target_type,
    target_ref,
    title,
    body,
    url,
    actor_user_id,
    entity_type,
    entity_id
  ) VALUES (
    'admin_notice',
    'medium',
    'user',
    v_owner::text,
    v_title,
    v_body,
    '/admin/telemetry',
    NULL,
    'gamification_season_nudge',
    v_dedupe_id
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'status', 'sent',
    'season_key', v_season.season_key,
    'owner_user_id', v_owner,
    'notification_event_id', v_event_id
  );
END;
$$;

COMMENT ON FUNCTION public.nudge_program_owner_season_needs_campaign(text) IS
  'Notify program_owner_user_id when a scheduled/active season lacks an activated campaign. No-ops while phase2_enabled is false.';

REVOKE ALL ON FUNCTION public.nudge_program_owner_season_needs_campaign(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nudge_program_owner_season_needs_campaign(text) TO service_role;

CREATE OR REPLACE FUNCTION public.process_gamification_program_owner_nudges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_phase2_master_enabled() THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'phase2_dark');
  END IF;

  v_result := public.nudge_program_owner_season_needs_campaign(NULL);
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.process_gamification_program_owner_nudges() IS
  'Cron entrypoint for season-needs-campaign owner nudge. No-ops while Phase 2 master flag is off.';

REVOKE ALL ON FUNCTION public.process_gamification_program_owner_nudges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_gamification_program_owner_nudges() TO service_role;

-- Weekly nudge check (Mon 6 AM Central ≈ dual UTC slots)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamification-owner-nudge-utc12') THEN
      PERFORM cron.schedule(
        'gamification-owner-nudge-utc12',
        '0 12 * * 1',
        $cron$SELECT public.process_gamification_program_owner_nudges();$cron$
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gamification-owner-nudge-utc11') THEN
      PERFORM cron.schedule(
        'gamification-owner-nudge-utc11',
        '0 11 * * 1',
        $cron$SELECT public.process_gamification_program_owner_nudges();$cron$
      );
    END IF;
  END IF;
END $$;
