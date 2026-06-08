-- Source: prod HEAD 20260608021312
-- Capture date: 2026-06-08
-- Regenerated only at a deliberate re-baseline — see docs/CONVENTIONS.md (re-baseline runbook).
--
-- PostgreSQL database dump
--

\restrict 3qs4Ao4SPmTg4RurpbXmspPfVCaVV8PN5AfY1cRb315ro4SElp4jK3sf2anP7ae

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: email_list_key; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.email_list_key AS ENUM (
    'compliance_summary',
    'safety_forecast',
    'manager_compliance',
    'weekly_safety_audit',
    'certification_expiry_digest',
    'safety_rewards_winners',
    'weekly_attendance_summary'
);


ALTER TYPE public.email_list_key OWNER TO postgres;

--
-- Name: point_source; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.point_source AS ENUM (
    'announcement_claim',
    'compliance_form',
    'streak_bonus',
    'near_miss_report',
    'certification',
    'manual_award',
    'redemption',
    'adjustment'
);


ALTER TYPE public.point_source OWNER TO postgres;

--
-- Name: redemption_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.redemption_status AS ENUM (
    'pending',
    'approved',
    'fulfilled',
    'denied',
    'canceled'
);


ALTER TYPE public.redemption_status OWNER TO postgres;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: _notify_redemption_denied(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._notify_redemption_denied(p_redemption_id uuid, p_actor uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_redemption public.redemptions; v_item_name text; v_title text; v_body text; v_event_id uuid;
BEGIN
  IF p_redemption_id IS NULL THEN RETURN NULL; END IF;
  SELECT ne.id INTO v_event_id FROM public.notification_events ne
  WHERE ne.entity_type = 'redemption_denied' AND ne.entity_id = p_redemption_id;
  IF v_event_id IS NOT NULL THEN RETURN v_event_id; END IF;
  SELECT r.* INTO v_redemption FROM public.redemptions r WHERE r.id = p_redemption_id;
  IF NOT FOUND OR v_redemption.status <> 'denied' THEN RETURN NULL; END IF;
  SELECT rc.name INTO v_item_name FROM public.reward_catalog rc WHERE rc.id = v_redemption.item_id;
  v_title := format('Your %s redemption was denied', COALESCE(v_item_name, 'reward'));
  v_body := format('Your %s redemption was denied — your %s points have been refunded.', COALESCE(v_item_name, 'item'), v_redemption.point_cost);
  INSERT INTO public.notification_events (category, severity, target_type, target_ref, title, body, url, actor_user_id, entity_type, entity_id)
  VALUES ('admin_notice', 'medium', 'user', v_redemption.user_id::text, v_title, v_body, '/my-points', p_actor, 'redemption_denied', p_redemption_id)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;


ALTER FUNCTION public._notify_redemption_denied(p_redemption_id uuid, p_actor uuid) OWNER TO postgres;

--
-- Name: _notify_redemption_fulfilled(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._notify_redemption_fulfilled(p_redemption_id uuid, p_actor uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_redemption public.redemptions; v_item_name text; v_title text; v_body text; v_event_id uuid;
BEGIN
  IF p_redemption_id IS NULL THEN RETURN NULL; END IF;
  SELECT ne.id INTO v_event_id FROM public.notification_events ne
  WHERE ne.entity_type = 'redemption_fulfilled' AND ne.entity_id = p_redemption_id;
  IF v_event_id IS NOT NULL THEN RETURN v_event_id; END IF;
  SELECT r.* INTO v_redemption FROM public.redemptions r WHERE r.id = p_redemption_id;
  IF NOT FOUND OR v_redemption.status <> 'fulfilled' THEN RETURN NULL; END IF;
  SELECT rc.name INTO v_item_name FROM public.reward_catalog rc WHERE rc.id = v_redemption.item_id;
  v_title := format('Your %s is ready', COALESCE(v_item_name, 'reward'));
  v_body := format('Your %s redemption has been fulfilled and is ready to be handed over.', COALESCE(v_item_name, 'item'));
  INSERT INTO public.notification_events (category, severity, target_type, target_ref, title, body, url, actor_user_id, entity_type, entity_id)
  VALUES ('admin_notice', 'medium', 'user', v_redemption.user_id::text, v_title, v_body, '/my-points', p_actor, 'redemption_fulfilled', p_redemption_id)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;


ALTER FUNCTION public._notify_redemption_fulfilled(p_redemption_id uuid, p_actor uuid) OWNER TO postgres;

--
-- Name: _notify_redemption_pending_admins(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._notify_redemption_pending_admins(p_redemption_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_redemption public.redemptions;
  v_item_name  text;
  v_requester  text;
  v_title      text;
  v_event_id   uuid;
  v_actor      uuid := auth.uid();
BEGIN
  IF p_redemption_id IS NULL THEN RETURN NULL; END IF;
  SELECT ne.id INTO v_event_id FROM public.notification_events ne
  WHERE ne.entity_type = 'redemption_pending' AND ne.entity_id = p_redemption_id;
  IF v_event_id IS NOT NULL THEN RETURN v_event_id; END IF;
  SELECT r.* INTO v_redemption FROM public.redemptions r WHERE r.id = p_redemption_id;
  IF NOT FOUND OR v_redemption.status <> 'pending' THEN RETURN NULL; END IF;
  SELECT rc.name INTO v_item_name FROM public.reward_catalog rc WHERE rc.id = v_redemption.item_id;
  SELECT COALESCE(NULLIF(btrim(au.full_name), ''), NULLIF(btrim(au.email), '')) INTO v_requester
  FROM public.app_users au WHERE au.user_id = v_redemption.user_id;
  v_title := format('%s redeemed %s (%s pts) — pending fulfillment.',
    COALESCE(v_requester, 'An employee'), COALESCE(v_item_name, 'an item'), v_redemption.point_cost);
  INSERT INTO public.notification_events (category, severity, target_type, target_ref, title, body, url, actor_user_id, entity_type, entity_id)
  VALUES ('admin_notice', 'medium', 'role', 'admin', v_title, v_title, '/admin/redemption-fulfillment', v_actor, 'redemption_pending', p_redemption_id)
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;


ALTER FUNCTION public._notify_redemption_pending_admins(p_redemption_id uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: redemptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.redemptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_id uuid NOT NULL,
    point_cost integer NOT NULL,
    status public.redemption_status DEFAULT 'pending'::public.redemption_status NOT NULL,
    request_id uuid NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone,
    fulfillment_note text,
    CONSTRAINT redemptions_point_cost_positive CHECK ((point_cost > 0))
);


ALTER TABLE public.redemptions OWNER TO postgres;

--
-- Name: TABLE redemptions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.redemptions IS 'Redemption requests. Points are held on request (pending). Status transitions via SECURITY DEFINER RPCs only — no direct user INSERT/UPDATE.';


--
-- Name: _refund_redemption_hold(public.redemptions, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public._refund_redemption_hold(p_redemption public.redemptions, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_refund_id uuid;
BEGIN
  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, reason)
  VALUES
    (p_redemption.user_id, p_redemption.point_cost, 'adjustment',
     p_redemption.id, 'redemptions', false, p_reason)
  ON CONFLICT (reference_id)
    WHERE source = 'adjustment' AND reference_table = 'redemptions'
  DO NOTHING
  RETURNING id INTO v_refund_id;

  IF v_refund_id IS NOT NULL THEN
    UPDATE public.reward_catalog rc
    SET stock_qty = rc.stock_qty + 1,
        updated_at = now()
    WHERE rc.id = p_redemption.item_id
      AND rc.stock_qty IS NOT NULL;
  END IF;
END;
$$;


ALTER FUNCTION public._refund_redemption_hold(p_redemption public.redemptions, p_reason text) OWNER TO postgres;

--
-- Name: abandon_certification_attempt(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.abandon_certification_attempt(p_attempt_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.certification_attempts
  SET status = 'abandoned'
  WHERE id = p_attempt_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Attempt not found, already abandoned, or not owned by you';
  END IF;
END;
$$;


ALTER FUNCTION public.abandon_certification_attempt(p_attempt_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION abandon_certification_attempt(p_attempt_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.abandon_certification_attempt(p_attempt_id uuid) IS 'Abandon own in-progress attempt. Used by Start fresh flow.';


--
-- Name: admin_grade_short_answers(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.admin_grade_short_answers(p_attempt_id uuid, p_grades jsonb) RETURNS TABLE(passed boolean, score_percentage numeric, correct_answers integer, total_questions integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_attempt RECORD;
  v_answers JSONB;
  v_pass_threshold INTEGER;
  v_has_practical BOOLEAN;
  v_validity INTERVAL;
  v_idx INT;
  v_grade JSONB;
  v_qid TEXT;
  v_is_correct BOOLEAN;
  v_total_pts INTEGER := 0;
  v_earned INTEGER := 0;
  v_correct INTEGER := 0;
  v_score NUMERIC;
  v_answer JSONB;
  v_new_answers JSONB := '[]'::jsonb;
  v_old_json jsonb;
  v_new_json jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'general_foreman')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin or General Foreman role required';
  END IF;

  SELECT * INTO v_attempt
  FROM public.certification_attempts
  WHERE id = p_attempt_id
    AND status = 'submitted';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found or not in submitted status';
  END IF;

  SELECT ct.passing_score, ct.has_practical_eval,
         (ct.validity_months || ' months')::interval
  INTO v_pass_threshold, v_has_practical, v_validity
  FROM public.certification_types ct
  WHERE ct.id = v_attempt.certification_type_id;

  v_answers := v_attempt.answers;

  FOR v_idx IN 0 .. jsonb_array_length(v_answers) - 1 LOOP
    v_answer := v_answers->v_idx;
    SELECT g INTO v_grade
    FROM jsonb_array_elements(p_grades) g
    WHERE g->>'question_id' = v_answer->>'question_id';

    IF v_grade IS NOT NULL AND (v_answer->>'pending_review')::boolean = true THEN
      v_is_correct := (v_grade->>'is_correct')::boolean;
      v_answer := v_answer || jsonb_build_object(
        'is_correct', v_is_correct,
        'pending_review', false,
        'graded_by_admin', true,
        'admin_notes', COALESCE(v_grade->>'admin_notes', '')
      );
    END IF;

    v_total_pts := v_total_pts + COALESCE((v_answer->>'points')::int, 1);
    IF (v_answer->>'is_correct')::boolean = true THEN
      v_correct := v_correct + 1;
      v_earned := v_earned + COALESCE((v_answer->>'points')::int, 1);
    END IF;

    v_new_answers := v_new_answers || v_answer;
  END LOOP;

  IF v_total_pts = 0 THEN
    v_score := 0;
  ELSE
    v_score := (v_earned::numeric / v_total_pts::numeric) * 100;
  END IF;

  v_old_json := jsonb_build_object(
    'attempt_id', v_attempt.id,
    'user_id', v_attempt.user_id,
    'certification_type_id', v_attempt.certification_type_id,
    'status', v_attempt.status,
    'submitted_at', v_attempt.submitted_at
  );

  UPDATE public.certification_attempts
  SET
    status = 'graded',
    completed_at = now(),
    answers = v_new_answers,
    correct_answers = v_correct,
    earned_points = v_earned,
    score_percentage = v_score,
    passed = (v_score >= v_pass_threshold),
    graded_by = auth.uid(),
    graded_at = now(),
    grading_started_at = null,
    grading_started_by = null
  WHERE id = p_attempt_id;

  IF v_score >= v_pass_threshold THEN
    INSERT INTO public.certification_records (
      user_id,
      certification_type_id,
      written_attempt_id,
      written_passed_at,
      written_score,
      status,
      expires_at,
      reviewed_by,
      reviewed_at
    ) VALUES (
      v_attempt.user_id,
      v_attempt.certification_type_id,
      p_attempt_id,
      now(),
      v_score,
      CASE WHEN v_has_practical THEN 'written_passed'::text ELSE 'active'::text END,
      now() + v_validity,
      auth.uid(),
      now()
    )
    ON CONFLICT (user_id, certification_type_id) WHERE (status IN ('pending', 'written_passed', 'active'))
    DO UPDATE SET
      written_attempt_id = EXCLUDED.written_attempt_id,
      written_passed_at = EXCLUDED.written_passed_at,
      written_score = EXCLUDED.written_score,
      status = EXCLUDED.status,
      expires_at = EXCLUDED.expires_at,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now();
  END IF;

  v_new_json := jsonb_build_object(
    'attempt_id', p_attempt_id,
    'score_percentage', v_score,
    'passed', (v_score >= v_pass_threshold),
    'correct_answers', v_correct,
    'total_questions', jsonb_array_length(v_new_answers)
  );
  PERFORM public.insert_certification_audit_log(
    auth.uid(),
    'grade_submission',
    p_attempt_id,
    v_old_json,
    v_new_json
  );

  passed := (v_score >= v_pass_threshold);
  score_percentage := v_score;
  correct_answers := v_correct;
  total_questions := jsonb_array_length(v_new_answers);
  RETURN NEXT;
END;
$$;


ALTER FUNCTION public.admin_grade_short_answers(p_attempt_id uuid, p_grades jsonb) OWNER TO postgres;

--
-- Name: FUNCTION admin_grade_short_answers(p_attempt_id uuid, p_grades jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.admin_grade_short_answers(p_attempt_id uuid, p_grades jsonb) IS 'Admin/General Foreman grade short_answer questions and finalize attempt. Writes to certification_audit_log.';


--
-- Name: anonymize_user_telemetry(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.anonymize_user_telemetry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.telemetry_events 
  SET user_id = NULL 
  WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.anonymize_user_telemetry() OWNER TO postgres;

--
-- Name: app_settings_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.app_settings_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.app_settings_touch_updated_at() OWNER TO postgres;

--
-- Name: audit_app_settings(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_app_settings() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.app_settings_audit (key, old_value, new_value, changed_by)
  VALUES (OLD.key, OLD.value, NEW.value, auth.uid());
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.audit_app_settings() OWNER TO postgres;

--
-- Name: award_certification_points(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.award_certification_points() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_amount        integer;
  v_category      text;
  v_completing_id uuid;
  v_has_practical boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT has_practical_eval INTO v_has_practical
  FROM public.certification_types
  WHERE id = NEW.certification_type_id;

  IF COALESCE(v_has_practical, false) AND NEW.practical_evaluation_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_completing_id := COALESCE(NEW.practical_evaluation_id, NEW.written_attempt_id);
  IF v_completing_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND OLD.expires_at > now() THEN
    v_category := 'early_renewal';
    v_amount := public.get_point_rule('certification', 'early_renewal_amount');
  ELSIF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active') THEN
    v_category := 'pass';
    v_amount := public.get_point_rule('certification', 'pass_amount');
  ELSE
    RETURN NEW;
  END IF;

  IF v_amount IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.insert_point_transaction(
    NEW.user_id,
    v_amount,
    'certification',
    v_completing_id,
    'certification_records',
    v_category,
    true
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.award_certification_points() OWNER TO postgres;

--
-- Name: award_near_miss_base_points(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.award_near_miss_base_points() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_amount   integer;
  v_cap      integer;
  v_today    integer;
BEGIN
  IF NEW.severity IS DISTINCT FROM 'near_miss' THEN
    RETURN NEW;
  END IF;

  IF NEW.reported_by IS NULL THEN
    RAISE NOTICE 'near_miss base award skipped: incident % has NULL reported_by', NEW.id;
    RETURN NEW;
  END IF;

  v_amount := public.get_point_rule('near_miss_report', 'base_amount');
  IF v_amount IS NULL THEN
    RETURN NEW;
  END IF;

  v_cap := public.get_point_rule('near_miss_report', 'base_daily_cap');
  IF v_cap IS NOT NULL THEN
    SELECT count(*)::integer INTO v_today
    FROM public.point_transactions
    WHERE user_id = NEW.reported_by
      AND source = 'near_miss_report'
      AND category = 'base'
      AND EXTRACT(YEAR  FROM (created_at AT TIME ZONE 'America/Chicago')) =
          EXTRACT(YEAR  FROM (now() AT TIME ZONE 'America/Chicago'))
      AND EXTRACT(MONTH FROM (created_at AT TIME ZONE 'America/Chicago')) =
          EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Chicago'))
      AND EXTRACT(DAY   FROM (created_at AT TIME ZONE 'America/Chicago')) =
          EXTRACT(DAY   FROM (now() AT TIME ZONE 'America/Chicago'));

    IF v_today >= v_cap THEN
      RAISE NOTICE 'near_miss base award suppressed for user %: daily cap % reached (% today)',
        NEW.reported_by, v_cap, v_today;
      RETURN NEW;
    END IF;
  END IF;

  PERFORM public.insert_point_transaction(
    NEW.reported_by,
    v_amount,
    'near_miss_report',
    NEW.id,
    'safety_incidents',
    'base',
    true
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.award_near_miss_base_points() OWNER TO postgres;

--
-- Name: award_near_miss_corrective_bonus(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.award_near_miss_corrective_bonus() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_amount    integer;
  v_incident  record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;

  IF NEW.incident_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, severity, reported_by
  INTO v_incident
  FROM public.safety_incidents
  WHERE id = NEW.incident_id;

  IF NOT FOUND OR v_incident.severity IS DISTINCT FROM 'near_miss' THEN
    RETURN NEW;
  END IF;

  IF v_incident.reported_by IS NULL THEN
    RAISE NOTICE 'near_miss corrective bonus skipped: incident % has NULL reported_by', v_incident.id;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.point_transactions pt
    JOIN public.corrective_actions ca ON ca.id = pt.reference_id
    WHERE pt.source = 'near_miss_report'
      AND pt.category = 'corrective_bonus'
      AND ca.incident_id = NEW.incident_id
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := public.get_point_rule('near_miss_report', 'corrective_bonus_amount');
  IF v_amount IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.insert_point_transaction(
    v_incident.reported_by,
    v_amount,
    'near_miss_report',
    NEW.id,
    'corrective_actions',
    'corrective_bonus',
    true
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.award_near_miss_corrective_bonus() OWNER TO postgres;

--
-- Name: award_points(uuid, integer, text, text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.award_points(p_recipient uuid, p_amount integer, p_category text, p_reason text, p_request_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor       uuid := auth.uid();
  v_reason      text := btrim(coalesce(p_reason, ''));
  v_grant       public.point_awarder_grants;
  v_month_total integer;
  v_tx_id       uuid;
  v_categories  text[] := ARRAY[
    'maintenance', 'good_performance', 'safety_catch',
    'attendance', 'peer_recognition', 'other'
  ];
BEGIN
  IF NOT public.can_award_points(v_actor) THEN
    RAISE EXCEPTION 'Not permitted to award points';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.app_users au WHERE au.user_id = p_recipient) THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;

  IF p_recipient = v_actor THEN
    RAISE EXCEPTION 'Cannot award points to yourself';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF v_reason = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;

  IF p_category IS NULL OR NOT (p_category = ANY (v_categories)) THEN
    RAISE EXCEPTION 'Invalid category';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required';
  END IF;

  SELECT pt.id INTO v_tx_id
  FROM public.point_transactions pt
  WHERE pt.source = 'manual_award'
    AND pt.request_id = p_request_id;
  IF v_tx_id IS NOT NULL THEN
    RETURN v_tx_id;
  END IF;

  IF NOT public.is_admin() THEN
    SELECT * INTO v_grant
    FROM public.point_awarder_grants g
    WHERE g.user_id = v_actor
      AND g.revoked_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Not permitted to award points';
    END IF;

    IF p_amount > v_grant.per_award_cap THEN
      RAISE EXCEPTION 'Exceeds per-award cap of %', v_grant.per_award_cap;
    END IF;

    SELECT COALESCE(SUM(pt.amount), 0)::integer INTO v_month_total
    FROM public.point_transactions pt
    WHERE pt.source = 'manual_award'
      AND pt.awarded_by = v_actor
      AND EXTRACT(YEAR FROM (pt.created_at AT TIME ZONE 'America/Chicago'))
            = EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/Chicago'))
      AND EXTRACT(MONTH FROM (pt.created_at AT TIME ZONE 'America/Chicago'))
            = EXTRACT(MONTH FROM (now() AT TIME ZONE 'America/Chicago'));

    IF v_month_total + p_amount > v_grant.monthly_budget THEN
      RAISE EXCEPTION 'Exceeds monthly budget of %', v_grant.monthly_budget;
    END IF;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, source, counts_toward_raffle, category, reason, awarded_by, request_id)
  VALUES
    (p_recipient, p_amount, 'manual_award', true, p_category, v_reason, v_actor, p_request_id)
  ON CONFLICT (request_id) WHERE source = 'manual_award' AND request_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NULL THEN
    SELECT pt.id INTO v_tx_id
    FROM public.point_transactions pt
    WHERE pt.source = 'manual_award'
      AND pt.request_id = p_request_id;
  END IF;

  RETURN v_tx_id;
END;
$$;


ALTER FUNCTION public.award_points(p_recipient uuid, p_amount integer, p_category text, p_reason text, p_request_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION award_points(p_recipient uuid, p_amount integer, p_category text, p_reason text, p_request_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.award_points(p_recipient uuid, p_amount integer, p_category text, p_reason text, p_request_id uuid) IS 'Manual point award entry point. Self-gating (permission, recipient, self, amount, reason, category, cap/budget for non-admins) and idempotent on p_request_id. Writes a manual_award ledger row (counts_toward_raffle = true) and returns its tx id.';


--
-- Name: calculate_factor_performance(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_factor_performance(p_start_date date, p_end_date date) RETURNS TABLE(factor_name text, times_triggered integer, incidents_when_triggered integer, false_positive_rate numeric, recommendation text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH factor_analysis AS (
    SELECT 
      unnest(rsh.top_drivers) as driver_text,
      rsh.date_for,
      rsh.work_site_id,
      CASE WHEN si.id IS NOT NULL THEN true ELSE false END as had_incident
    FROM risk_score_history rsh
    LEFT JOIN safety_incidents si 
      ON rsh.date_for = si.incident_date 
      AND (rsh.work_site_id = si.work_site_id OR (rsh.work_site_id IS NULL AND si.work_site_id IS NULL))
      AND si.severity IN ('recordable', 'lost_time', 'fatality')
    WHERE rsh.date_for BETWEEN p_start_date AND p_end_date
      AND rsh.risk_level IN ('HIGH', 'CRITICAL', 'ELEVATED')
  )
  SELECT 
    fa.driver_text as factor_name,
    COUNT(*)::INTEGER as times_triggered,
    COUNT(*) FILTER (WHERE fa.had_incident)::INTEGER as incidents_when_triggered,
    CASE 
      WHEN COUNT(*) = 0 THEN 0.00
      ELSE (COUNT(*) FILTER (WHERE NOT fa.had_incident)::DECIMAL / COUNT(*) * 100)
    END as false_positive_rate,
    CASE
      -- If FP rate > 70%, factor is crying wolf too often -> decrease multiplier
      WHEN COUNT(*) FILTER (WHERE NOT fa.had_incident)::DECIMAL / NULLIF(COUNT(*), 0) > 0.70 THEN 'decrease'
      -- If usually correct when triggered -> maintain
      WHEN COUNT(*) FILTER (WHERE fa.had_incident)::DECIMAL / NULLIF(COUNT(*), 0) > 0.30 THEN 'maintain'
      -- Default maintain
      ELSE 'maintain'
    END as recommendation
  FROM factor_analysis fa
  GROUP BY fa.driver_text
  HAVING COUNT(*) >= 3 -- Only factors triggered 3+ times
  ORDER BY COUNT(*) DESC;
END;
$$;


ALTER FUNCTION public.calculate_factor_performance(p_start_date date, p_end_date date) OWNER TO postgres;

--
-- Name: FUNCTION calculate_factor_performance(p_start_date date, p_end_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.calculate_factor_performance(p_start_date date, p_end_date date) IS 'Analyze which risk factors are over/under-predicting';


--
-- Name: calculate_prediction_accuracy(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_prediction_accuracy(p_start_date date, p_end_date date) RETURNS TABLE(total_days integer, high_risk_predicted integer, incidents_occurred integer, true_positives integer, false_positives integer, false_negatives integer, true_negatives integer, accuracy_rate numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH risk_days AS (
    SELECT 
      rsh.date_for,
      CASE WHEN rsh.risk_level IN ('HIGH', 'CRITICAL', 'ELEVATED') 
        THEN true ELSE false 
      END as was_high_risk
    FROM risk_score_history rsh
    WHERE rsh.date_for BETWEEN p_start_date AND p_end_date
  ),
  incident_days AS (
    SELECT DISTINCT si.incident_date, true as had_incident
    FROM safety_incidents si
    WHERE si.incident_date BETWEEN p_start_date AND p_end_date
      AND si.severity IN ('recordable', 'lost_time', 'fatality')
  ),
  day_analysis AS (
    SELECT 
      rd.date_for,
      rd.was_high_risk,
      COALESCE(id.had_incident, false) as had_incident
    FROM risk_days rd
    LEFT JOIN incident_days id ON rd.date_for = id.incident_date
  )
  SELECT 
    COUNT(DISTINCT da.date_for)::INTEGER as total_days,
    COUNT(DISTINCT CASE WHEN da.was_high_risk THEN da.date_for END)::INTEGER as high_risk_predicted,
    COUNT(DISTINCT CASE WHEN da.had_incident THEN da.date_for END)::INTEGER as incidents_occurred,
    COUNT(DISTINCT CASE WHEN da.was_high_risk AND da.had_incident THEN da.date_for END)::INTEGER as true_positives,
    COUNT(DISTINCT CASE WHEN da.was_high_risk AND NOT da.had_incident THEN da.date_for END)::INTEGER as false_positives,
    COUNT(DISTINCT CASE WHEN NOT da.was_high_risk AND da.had_incident THEN da.date_for END)::INTEGER as false_negatives,
    COUNT(DISTINCT CASE WHEN NOT da.was_high_risk AND NOT da.had_incident THEN da.date_for END)::INTEGER as true_negatives,
    CASE 
      WHEN COUNT(DISTINCT da.date_for) = 0 THEN 0.00
      ELSE (
        (COUNT(DISTINCT CASE WHEN da.was_high_risk AND da.had_incident THEN da.date_for END)::DECIMAL +
         COUNT(DISTINCT CASE WHEN NOT da.was_high_risk AND NOT da.had_incident THEN da.date_for END)::DECIMAL) /
        COUNT(DISTINCT da.date_for)::DECIMAL * 100
      )
    END as accuracy_rate
  FROM day_analysis da;
END;
$$;


ALTER FUNCTION public.calculate_prediction_accuracy(p_start_date date, p_end_date date) OWNER TO postgres;

--
-- Name: FUNCTION calculate_prediction_accuracy(p_start_date date, p_end_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.calculate_prediction_accuracy(p_start_date date, p_end_date date) IS 'Calculate prediction accuracy metrics for a date range';


--
-- Name: can_award_points(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_award_points(actor uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF actor IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_admin() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.point_awarder_grants g
    WHERE g.user_id = actor
      AND g.revoked_at IS NULL
  );
END;
$$;


ALTER FUNCTION public.can_award_points(actor uuid) OWNER TO postgres;

--
-- Name: FUNCTION can_award_points(actor uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.can_award_points(actor uuid) IS 'Returns true if the caller is an admin OR the actor holds an active point-awarder grant.';


--
-- Name: can_evaluate_user(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_evaluate_user(p_evaluator_id uuid, p_evaluatee_id uuid, p_cert_type_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_evaluator_id IS NULL OR p_evaluatee_id IS NULL OR p_cert_type_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
  FROM public.app_users
  WHERE app_users.user_id = p_evaluator_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_role = 'admin' THEN
    RETURN true;
  END IF;

  IF v_role = 'general_foreman' THEN
    IF p_evaluator_id = p_evaluatee_id THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION public.can_evaluate_user(p_evaluator_id uuid, p_evaluatee_id uuid, p_cert_type_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION can_evaluate_user(p_evaluator_id uuid, p_evaluatee_id uuid, p_cert_type_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.can_evaluate_user(p_evaluator_id uuid, p_evaluatee_id uuid, p_cert_type_id uuid) IS 'Whether evaluator can evaluate evaluatee for given cert. Admin: anyone. GF: anyone except self.';


--
-- Name: can_log_incidents(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_log_incidents() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN COALESCE((
    SELECT role IN ('admin', 'general_foreman', 'safety_officer', 'foreman')
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;


ALTER FUNCTION public.can_log_incidents() OWNER TO postgres;

--
-- Name: FUNCTION can_log_incidents(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.can_log_incidents() IS 'Returns true for roles that can log safety incidents';


--
-- Name: can_report_near_miss(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_report_near_miss() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL;
$$;


ALTER FUNCTION public.can_report_near_miss() OWNER TO postgres;

--
-- Name: FUNCTION can_report_near_miss(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.can_report_near_miss() IS 'Returns true for any authenticated user. Used for near-miss RLS policy.';


--
-- Name: can_start_certification_attempt(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.can_start_certification_attempt(p_cert_type_id uuid, p_check_user_id uuid DEFAULT auth.uid()) RETURNS TABLE(can_start boolean, reason text, next_available_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  last_attempt RECORD;
  cooldown_ends TIMESTAMPTZ;
BEGIN
  IF p_check_user_id IS NULL THEN
    can_start := false;
    reason := 'Not authenticated';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF NOT public.user_has_certification_access(p_check_user_id, p_cert_type_id) THEN
    can_start := false;
    reason := 'You do not have access to this certification. Contact an administrator.';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Admins bypass the 24-hour cooldown and can retake at any time
  IF EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = p_check_user_id AND role = 'admin'
  ) THEN
    can_start := true;
    reason := 'Admin: cooldown does not apply';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT ca.*
  INTO last_attempt
  FROM public.certification_attempts ca
  WHERE ca.user_id = p_check_user_id
    AND ca.certification_type_id = p_cert_type_id
    AND ca.status = 'graded'
  ORDER BY ca.completed_at DESC NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    can_start := true;
    reason := 'No previous attempts';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF last_attempt.passed THEN
    can_start := true;
    reason := 'Previous attempt passed';
    next_available_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  cooldown_ends := last_attempt.completed_at + INTERVAL '24 hours';
  IF now() < cooldown_ends THEN
    can_start := false;
    reason := 'Must wait 24 hours after failed attempt';
    next_available_at := cooldown_ends;
    RETURN NEXT;
    RETURN;
  END IF;

  can_start := true;
  reason := 'Cooldown period passed';
  next_available_at := NULL;
  RETURN NEXT;
  RETURN;
END;
$$;


ALTER FUNCTION public.can_start_certification_attempt(p_cert_type_id uuid, p_check_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION can_start_certification_attempt(p_cert_type_id uuid, p_check_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.can_start_certification_attempt(p_cert_type_id uuid, p_check_user_id uuid) IS 'Check if user can start a new attempt. 24h cooldown after failure; admins bypass cooldown.';


--
-- Name: cancel_redemption(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cancel_redemption(p_redemption_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_redemption public.redemptions;
  v_reason     text := 'Redemption canceled';
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_redemption
  FROM public.redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;

  IF v_redemption.user_id <> v_actor AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not permitted to cancel this redemption';
  END IF;

  IF v_redemption.status = 'pending' THEN
    UPDATE public.redemptions
    SET status = 'canceled',
        decided_by = v_actor,
        decided_at = now()
    WHERE id = p_redemption_id;

    PERFORM public._refund_redemption_hold(v_redemption, v_reason);

  ELSE
    RAISE EXCEPTION 'Invalid transition: cannot cancel % redemption', v_redemption.status;
  END IF;

  RETURN p_redemption_id;
END;
$$;


ALTER FUNCTION public.cancel_redemption(p_redemption_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION cancel_redemption(p_redemption_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.cancel_redemption(p_redemption_id uuid) IS 'User (own pending) or admin: pending -> canceled with idempotent refund + stock restore.';


--
-- Name: certification_audit_log_on_qualification_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.certification_audit_log_on_qualification_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.electrical_qualification_level IS DISTINCT FROM NEW.electrical_qualification_level THEN
    PERFORM public.insert_certification_audit_log(
      auth.uid(),
      'qualification_level_change',
      NEW.user_id,
      to_jsonb(COALESCE(OLD.electrical_qualification_level, 'unqualified')),
      to_jsonb(COALESCE(NEW.electrical_qualification_level, 'unqualified'))
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.certification_audit_log_on_qualification_change() OWNER TO postgres;

--
-- Name: certification_audit_log_on_revoke(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.certification_audit_log_on_revoke() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.insert_certification_audit_log(
    auth.uid(),
    'cert_access_revoke',
    OLD.id,
    jsonb_build_object(
      'user_id', OLD.user_id,
      'certification_type_id', OLD.certification_type_id,
      'granted_by', OLD.granted_by,
      'granted_at', OLD.granted_at
    ),
    NULL
  );
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.certification_audit_log_on_revoke() OWNER TO postgres;

--
-- Name: check_latest_announcement_claim(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_latest_announcement_claim() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  latest_announcement_id UUID;
BEGIN
  SELECT id INTO latest_announcement_id
  FROM public.announcements
  ORDER BY created_at DESC
  LIMIT 1;

  IF NEW.announcement_id IS DISTINCT FROM latest_announcement_id THEN
    RAISE EXCEPTION 'Only the latest announcement can be claimed (ID: %)', COALESCE(latest_announcement_id::text, 'none');
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_latest_announcement_claim() OWNER TO postgres;

--
-- Name: check_min_recipients(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_min_recipients() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF (SELECT COUNT(*) FROM public.email_recipient_lists WHERE list_key = OLD.list_key) <= 1 THEN
      RAISE EXCEPTION 'Cannot delete last recipient from list: %', OLD.list_key;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.check_min_recipients() OWNER TO postgres;

--
-- Name: check_reward_claim_window(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_reward_claim_window() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT public.is_reward_claim_window() THEN
    RAISE EXCEPTION 'Safety rewards can only be claimed between 5 AM and 8 AM Central time.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_reward_claim_window() OWNER TO postgres;

--
-- Name: claim_payroll_reminder_sms_log(date, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.claim_payroll_reminder_sms_log(p_date_checked date, p_tier integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_tier NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Invalid tier %', p_tier;
  END IF;

  INSERT INTO public.payroll_reminder_sms_log (
    date_checked,
    tier,
    recipient_count,
    success,
    employee_user_ids,
    results
  )
  VALUES (
    p_date_checked,
    p_tier,
    0,
    false,
    '{}',
    '{"status":"in_progress"}'::jsonb
  )
  ON CONFLICT (date_checked, tier) DO UPDATE
    SET sent_at = now()
    WHERE payroll_reminder_sms_log.success = false
      AND payroll_reminder_sms_log.sent_at < now() - interval '15 minutes'
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


ALTER FUNCTION public.claim_payroll_reminder_sms_log(p_date_checked date, p_tier integer) OWNER TO postgres;

--
-- Name: FUNCTION claim_payroll_reminder_sms_log(p_date_checked date, p_tier integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.claim_payroll_reminder_sms_log(p_date_checked date, p_tier integer) IS 'Claims idempotent payroll SMS send slot for date+tier. Returns NULL if already completed or in-progress (<15 min).';


--
-- Name: claim_pending_notifications(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.claim_pending_notifications(batch_size integer DEFAULT 100) RETURNS TABLE(id uuid, event_id uuid, user_id uuid, title text, body text, url text, category text, severity text, attempts integer, max_attempts integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  UPDATE public.notification_outbox
  SET status = 'processing'
  WHERE notification_outbox.id IN (
    SELECT outbox.id FROM public.notification_outbox outbox
    WHERE outbox.status IN ('pending', 'failed')
      AND outbox.scheduled_for <= NOW()
      AND outbox.attempts < outbox.max_attempts
    ORDER BY outbox.created_at
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    notification_outbox.id,
    notification_outbox.event_id,
    notification_outbox.user_id,
    notification_outbox.title,
    notification_outbox.body,
    notification_outbox.url,
    notification_outbox.category,
    notification_outbox.severity,
    notification_outbox.attempts,
    notification_outbox.max_attempts;
END;
$$;


ALTER FUNCTION public.claim_pending_notifications(batch_size integer) OWNER TO postgres;

--
-- Name: cleanup_jsa_photos(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_jsa_photos() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.jsa_photo_paths IS NOT NULL AND array_length(OLD.jsa_photo_paths, 1) > 0 THEN
    INSERT INTO public.storage_cleanup_queue (bucket_id, paths, source_table, source_id)
    VALUES ('jsa-photos', OLD.jsa_photo_paths, 'daily_jsa', OLD.id);
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION public.cleanup_jsa_photos() OWNER TO postgres;

--
-- Name: FUNCTION cleanup_jsa_photos(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.cleanup_jsa_photos() IS 'Queues JSA photo storage paths for async deletion when a daily_jsa record is deleted.';


--
-- Name: cleanup_stale_sessions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_stale_sessions() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.user_activity_sessions
  SET 
    status = 'offline',
    ended_at = last_seen_at
  WHERE 
    status IN ('active', 'idle')
    AND last_seen_at < NOW() - INTERVAL '5 minutes';
END;
$$;


ALTER FUNCTION public.cleanup_stale_sessions() OWNER TO postgres;

--
-- Name: clear_certification_grading_started(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.clear_certification_grading_started(p_attempt_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.certification_attempts
  SET
    grading_started_at = null,
    grading_started_by = null
  WHERE id = p_attempt_id
    AND grading_started_by = auth.uid();
END;
$$;


ALTER FUNCTION public.clear_certification_grading_started(p_attempt_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION clear_certification_grading_started(p_attempt_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.clear_certification_grading_started(p_attempt_id uuid) IS 'Release grading lock when closing card or after submit (only if caller claimed it).';


--
-- Name: compute_streak_bonus_total(date[], date[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.compute_streak_bonus_total(p_claimed_dates date[], p_announcement_dates date[]) RETURNS integer
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(SUM(m.bonus_amount), 0)::integer
  FROM public.compute_streak_milestones(p_claimed_dates, p_announcement_dates) AS m;
$$;


ALTER FUNCTION public.compute_streak_bonus_total(p_claimed_dates date[], p_announcement_dates date[]) OWNER TO postgres;

--
-- Name: compute_streak_milestones(date[], date[]); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.compute_streak_milestones(p_claimed_dates date[], p_announcement_dates date[]) RETURNS TABLE(milestone_key text, bonus_amount integer, completion_date date)
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ann date;
  v_current_streak int := 0;
  v_milestones_hit int[] := ARRAY[]::int[];
  v_all_claimed boolean;
  v_last_ann date;
BEGIN
  IF p_announcement_dates IS NULL OR array_length(p_announcement_dates, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_ann IN ARRAY p_announcement_dates
  LOOP
    IF p_claimed_dates IS NOT NULL AND v_ann = ANY(p_claimed_dates) THEN
      v_current_streak := v_current_streak + 1;

      IF v_current_streak = 5 AND NOT (5 = ANY(v_milestones_hit)) THEN
        milestone_key := 'consecutive_5';
        bonus_amount := public.streak_bonus_amount('consecutive_5');
        completion_date := v_ann;
        RETURN NEXT;
        v_milestones_hit := array_append(v_milestones_hit, 5);
      END IF;

      IF v_current_streak = 10 AND NOT (10 = ANY(v_milestones_hit)) THEN
        milestone_key := 'consecutive_10';
        bonus_amount := public.streak_bonus_amount('consecutive_10');
        completion_date := v_ann;
        RETURN NEXT;
        v_milestones_hit := array_append(v_milestones_hit, 10);
      END IF;
    ELSE
      v_current_streak := 0;
    END IF;
  END LOOP;

  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(p_announcement_dates) AS ad(d)
    WHERE p_claimed_dates IS NULL OR NOT (ad.d = ANY(p_claimed_dates))
  ) INTO v_all_claimed;

  IF v_all_claimed THEN
    v_last_ann := p_announcement_dates[array_length(p_announcement_dates, 1)];
    milestone_key := 'full_month';
    bonus_amount := public.streak_bonus_amount('full_month');
    completion_date := v_last_ann;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;


ALTER FUNCTION public.compute_streak_milestones(p_claimed_dates date[], p_announcement_dates date[]) OWNER TO postgres;

--
-- Name: FUNCTION compute_streak_milestones(p_claimed_dates date[], p_announcement_dates date[]); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.compute_streak_milestones(p_claimed_dates date[], p_announcement_dates date[]) IS 'KEEP IN SYNC: calculateStreakBonuses in src/lib/streakCalculation.ts and supabase/functions/_shared/streakCalculation.ts';


--
-- Name: create_certification_attempt(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_certification_attempt(p_cert_type_slug text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cert_id UUID;
  v_can_start BOOLEAN;
  v_reason TEXT;
  v_next_attempt INTEGER;
  v_new_id UUID;
BEGIN
  SELECT id INTO v_cert_id
  FROM public.certification_types
  WHERE slug = p_cert_type_slug AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certification type not found';
  END IF;

  IF NOT public.user_has_certification_access(auth.uid(), v_cert_id) THEN
    RAISE EXCEPTION 'CERTIFICATION_ACCESS_DENIED: You do not have access to this certification. Contact an administrator.';
  END IF;

  SELECT cs.can_start, cs.reason INTO v_can_start, v_reason
  FROM public.can_start_certification_attempt(v_cert_id, auth.uid()) cs;

  IF NOT v_can_start THEN
    RAISE EXCEPTION '%', v_reason;
  END IF;

  SELECT COALESCE(MAX(attempt_number), 0) + 1 INTO v_next_attempt
  FROM public.certification_attempts
  WHERE user_id = auth.uid() AND certification_type_id = v_cert_id;

  INSERT INTO public.certification_attempts (
    user_id,
    certification_type_id,
    attempt_number,
    status,
    started_at
  ) VALUES (
    auth.uid(),
    v_cert_id,
    v_next_attempt,
    'in_progress',
    now()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;


ALTER FUNCTION public.create_certification_attempt(p_cert_type_slug text) OWNER TO postgres;

--
-- Name: FUNCTION create_certification_attempt(p_cert_type_slug text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.create_certification_attempt(p_cert_type_slug text) IS 'Create in-progress attempt after cooldown check. Returns attempt id.';


--
-- Name: create_default_notification_preferences(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_default_notification_preferences() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  cats TEXT[] := ARRAY[
    'schedule', 'announcement', 'safety_alert', 'job_update',
    'rto_decision', 'admin_notice', 'certification_expiry', 'certification_expiry_digest', 'certification_granted'
  ];
  cat TEXT;
BEGIN
  FOREACH cat IN ARRAY cats LOOP
    INSERT INTO public.notification_preferences (user_id, category)
    VALUES (NEW.id, cat)
    ON CONFLICT (user_id, category) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_default_notification_preferences() OWNER TO postgres;

--
-- Name: debug_auth_context(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.debug_auth_context() RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
BEGIN
    RETURN json_build_object(
        'uid', auth.uid(),
        'role', auth.role(),
        'jwt', auth.jwt()
    );
END;
$$;


ALTER FUNCTION public.debug_auth_context() OWNER TO postgres;

--
-- Name: FUNCTION debug_auth_context(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.debug_auth_context() IS 'Debug function to inspect current auth context. Fixed search_path for security.';


--
-- Name: deny_redemption(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.deny_redemption(p_redemption_id uuid, p_note text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_actor uuid := auth.uid(); v_redemption public.redemptions; v_reason text := coalesce(nullif(btrim(p_note), ''), 'Redemption denied');
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not permitted to deny redemptions'; END IF;
  SELECT * INTO v_redemption FROM public.redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;
  IF v_redemption.status = 'pending' THEN
    UPDATE public.redemptions SET status = 'denied', decided_by = v_actor, decided_at = now(), fulfillment_note = p_note WHERE id = p_redemption_id;
    PERFORM public._refund_redemption_hold(v_redemption, v_reason);
    BEGIN PERFORM public._notify_redemption_denied(p_redemption_id, v_actor);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'redemption denied notify failed: %', SQLERRM; END;
  ELSIF v_redemption.status IN ('denied', 'canceled') THEN NULL;
  ELSE RAISE EXCEPTION 'Invalid transition: cannot deny % redemption', v_redemption.status; END IF;
  RETURN p_redemption_id;
END;
$$;


ALTER FUNCTION public.deny_redemption(p_redemption_id uuid, p_note text) OWNER TO postgres;

--
-- Name: FUNCTION deny_redemption(p_redemption_id uuid, p_note text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.deny_redemption(p_redemption_id uuid, p_note text) IS 'Admin: pending -> denied with idempotent wallet refund + stock restore.';


--
-- Name: ensure_single_default_contact_template(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ensure_single_default_contact_template() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_contact_templates
    SET is_default = false
    WHERE user_id = NEW.user_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.ensure_single_default_contact_template() OWNER TO postgres;

--
-- Name: fulfill_redemption(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fulfill_redemption(p_redemption_id uuid, p_note text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_actor uuid := auth.uid(); v_redemption public.redemptions;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not permitted to fulfill redemptions'; END IF;
  SELECT * INTO v_redemption FROM public.redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;
  IF v_redemption.status <> 'pending' THEN RAISE EXCEPTION 'Invalid transition: cannot fulfill % redemption', v_redemption.status; END IF;
  UPDATE public.redemptions SET status = 'fulfilled', decided_by = v_actor, decided_at = now(), fulfillment_note = p_note WHERE id = p_redemption_id;
  BEGIN PERFORM public._notify_redemption_fulfilled(p_redemption_id, v_actor);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'redemption fulfilled notify failed: %', SQLERRM; END;
  RETURN p_redemption_id;
END;
$$;


ALTER FUNCTION public.fulfill_redemption(p_redemption_id uuid, p_note text) OWNER TO postgres;

--
-- Name: FUNCTION fulfill_redemption(p_redemption_id uuid, p_note text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.fulfill_redemption(p_redemption_id uuid, p_note text) IS 'Admin: pending -> fulfilled. Hold becomes final spend; no refund.';


--
-- Name: generate_certification_verification_code(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_certification_verification_code() RETURNS text
    LANGUAGE sql
    AS $$
  SELECT string_agg(
    substr('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', (random() * 62)::int + 1, 1),
    ''
  )
  FROM generate_series(1, 8);
$$;


ALTER FUNCTION public.generate_certification_verification_code() OWNER TO postgres;

--
-- Name: FUNCTION generate_certification_verification_code(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.generate_certification_verification_code() IS 'Returns an 8-character random alphanumeric string for certification_records.verification_code.';


--
-- Name: get_briefing_compliance_summary(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_briefing_compliance_summary(p_start_date date, p_end_date date) RETURNS TABLE(user_id uuid, full_name text, role text, crew_name text, supervisor_name text, briefing_date date, completed boolean, reward_claimed boolean, suppressed boolean, suppression_reason text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH dates AS (
    SELECT d::date AS briefing_date
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) AS d
  ),
  ann_by_date AS (
    SELECT DISTINCT ON (a.date) a.id AS announcement_id, a.date AS briefing_date
    FROM public.announcements a
    WHERE a.date >= p_start_date AND a.date <= p_end_date
    ORDER BY a.date, a.id
  ),
  field_users AS (
    SELECT au.user_id, au.full_name, au.role, au.manager_id
    FROM public.app_users au
    WHERE au.role IN ('employee', 'foreman', 'general_foreman', 'mechanic')
      AND au.status = 'active'
  ),
  grid AS (
    SELECT fu.user_id, fu.full_name, fu.role, fu.manager_id, ab.briefing_date, ab.announcement_id
    FROM field_users fu
    CROSS JOIN ann_by_date ab
  ),
  crew_one AS (
    SELECT DISTINCT ON (cm.user_id) cm.user_id, c.name AS crew_name
    FROM public.crew_members cm
    JOIN public.crews c ON c.id = cm.crew_id AND c.is_active = true
    ORDER BY cm.user_id, c.name
  ),
  sup_names AS (
    SELECT sup.id, sup.full_name AS supervisor_name
    FROM public.app_users sup
  )
  SELECT
    g.user_id,
    g.full_name::text,
    g.role::text,
    co.crew_name::text,
    sn.supervisor_name::text,
    g.briefing_date,
    EXISTS (
      SELECT 1 FROM public.safety_briefing_answers sba
      WHERE sba.user_id = g.user_id AND sba.briefing_date = g.briefing_date
    ) AS completed,
    EXISTS (
      SELECT 1 FROM public.announcement_rewards ar
      WHERE ar.user_id = g.user_id AND ar.announcement_id = g.announcement_id
    ) AS reward_claimed,
    (
      EXISTS (SELECT 1 FROM public.company_calendar cc WHERE cc.date = g.briefing_date)
      OR EXISTS (SELECT 1 FROM public.user_absences ua WHERE ua.user_id = g.user_id AND ua.date = g.briefing_date)
    ) AS suppressed,
    CASE
      WHEN EXISTS (SELECT 1 FROM public.company_calendar cc WHERE cc.date = g.briefing_date) THEN 'company_off'::text
      WHEN EXISTS (SELECT 1 FROM public.user_absences ua WHERE ua.user_id = g.user_id AND ua.date = g.briefing_date) THEN 'user_absence'::text
      ELSE NULL::text
    END AS suppression_reason
  FROM grid g
  LEFT JOIN crew_one co ON co.user_id = g.user_id
  LEFT JOIN sup_names sn ON sn.id = g.manager_id
  ORDER BY g.briefing_date DESC, g.full_name;
$$;


ALTER FUNCTION public.get_briefing_compliance_summary(p_start_date date, p_end_date date) OWNER TO postgres;

--
-- Name: FUNCTION get_briefing_compliance_summary(p_start_date date, p_end_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_briefing_compliance_summary(p_start_date date, p_end_date date) IS 'Briefing compliance rows for dashboard: one per (field user, date) when an announcement exists. Includes completed, reward_claimed, suppressed, crew, supervisor.';


--
-- Name: get_briefing_daily_snapshot(date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_briefing_daily_snapshot(p_briefing_date date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  completions_today bigint;
BEGIN
  SELECT COUNT(*) INTO completions_today
  FROM public.safety_briefing_answers
  WHERE briefing_date = p_briefing_date;

  RETURN jsonb_build_object(
    'completions_today', completions_today
  );
END;
$$;


ALTER FUNCTION public.get_briefing_daily_snapshot(p_briefing_date date) OWNER TO postgres;

--
-- Name: FUNCTION get_briefing_daily_snapshot(p_briefing_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_briefing_daily_snapshot(p_briefing_date date) IS 'Returns aggregate briefing completion count for a date. Used by Safety Briefing page for positive "Today in the field" snapshot. No PII.';


--
-- Name: get_certificate_by_verification_code(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_certificate_by_verification_code(p_code text) RETURNS TABLE(full_name text, certification_name text, certified_at timestamp with time zone, expires_at timestamp with time zone, status text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    au.full_name,
    ct.name,
    cr.certified_at,
    cr.expires_at,
    cr.status
  FROM public.certification_records cr
  JOIN public.app_users au ON au.user_id = cr.user_id
  JOIN public.certification_types ct ON ct.id = cr.certification_type_id
  WHERE cr.verification_code = p_code
  LIMIT 1;
$$;


ALTER FUNCTION public.get_certificate_by_verification_code(p_code text) OWNER TO postgres;

--
-- Name: FUNCTION get_certificate_by_verification_code(p_code text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_certificate_by_verification_code(p_code text) IS 'Public lookup for /verify/:code. Returns worker name, cert name, dates, status. No auth required.';


--
-- Name: get_certification_completion_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_certification_completion_stats() RETURNS TABLE(certification_type_id uuid, certification_name text, total_attempts bigint, passed_users bigint, avg_passing_score numeric, avg_attempts_to_pass numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    ct.id,
    ct.name,
    COUNT(ca.id) FILTER (WHERE ca.status = 'graded') AS total_attempts,
    COUNT(ca.id) FILTER (WHERE ca.status = 'graded' AND ca.passed = true) AS passed_users,
    ROUND(AVG(ca.score_percentage) FILTER (WHERE ca.status = 'graded' AND ca.passed = true)::numeric, 2) AS avg_passing_score,
    ROUND(AVG(ca.attempt_number) FILTER (WHERE ca.status = 'graded' AND ca.passed = true)::numeric, 2) AS avg_attempts_to_pass
  FROM public.certification_types ct
  LEFT JOIN public.certification_attempts ca ON ct.id = ca.certification_type_id
  WHERE ct.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.app_users
      WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
    )
  GROUP BY ct.id, ct.name;
$$;


ALTER FUNCTION public.get_certification_completion_stats() OWNER TO postgres;

--
-- Name: FUNCTION get_certification_completion_stats(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_certification_completion_stats() IS 'Live per-cert completion stats for admin. Replaces read from materialized view so stats update immediately after tests are graded.';


--
-- Name: get_certification_test_questions(text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_certification_test_questions(p_cert_type_slug text, p_test_attempt_id uuid) RETURNS TABLE(question_id uuid, question_number integer, question_text text, question_type text, options jsonb, points integer, category text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_cert RECORD;
  v_attempt_cert_id UUID;
  v_q TEXT;
  v_cat_key TEXT;
  v_cat_prop NUMERIC;
  v_limit_per_cat INTEGER;
BEGIN
  SELECT certification_type_id INTO v_attempt_cert_id
  FROM public.certification_attempts
  WHERE id = p_test_attempt_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  IF v_attempt_cert_id IS NULL THEN
    RAISE EXCEPTION 'Invalid attempt or attempt not in progress';
  END IF;

  IF NOT public.user_has_certification_access(auth.uid(), v_attempt_cert_id) THEN
    RAISE EXCEPTION 'CERTIFICATION_ACCESS_DENIED: You do not have access to this certification. Contact an administrator.';
  END IF;

  SELECT * INTO v_cert
  FROM public.certification_types
  WHERE slug = p_cert_type_slug AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certification type not found';
  END IF;

  IF v_cert.id IS DISTINCT FROM v_attempt_cert_id THEN
    RAISE EXCEPTION 'Attempt does not match certification';
  END IF;

  IF v_cert.question_count IS NULL OR v_cert.question_count < 1 THEN
    RAISE EXCEPTION 'Certification has no question_count configured';
  END IF;

  IF v_cert.question_categories IS NULL OR v_cert.question_categories = '{}'::jsonb THEN
    RETURN QUERY
    SELECT
      q.id AS question_id,
      q.question_number,
      q.question_text,
      q.question_type,
      q.options,
      q.points,
      q.category
    FROM public.certification_questions q
    WHERE q.certification_type_id = v_cert.id AND q.is_active = true
    ORDER BY random()
    LIMIT v_cert.question_count;
    RETURN;
  END IF;

  v_q := '';
  FOR v_cat_key, v_cat_prop IN
    SELECT t.k, (t.v::text)::numeric
    FROM jsonb_each_text(v_cert.question_categories) AS t(k, v)
  LOOP
    v_limit_per_cat := GREATEST(1, CEIL(v_cert.question_count * v_cat_prop));
    IF v_q <> '' THEN
      v_q := v_q || ' UNION ALL ';
    END IF;
    v_q := v_q || format(
      $f$(
        SELECT q.id AS question_id, q.question_number, q.question_text, q.question_type, q.options, q.points, q.category
        FROM public.certification_questions q
        WHERE q.certification_type_id = %L AND q.is_active = true AND q.category = %L
        ORDER BY random()
        LIMIT %s
      )$f$,
      v_cert.id,
      v_cat_key,
      v_limit_per_cat
    );
  END LOOP;

  IF v_q = '' THEN
    RETURN QUERY
    SELECT
      q.id AS question_id,
      q.question_number,
      q.question_text,
      q.question_type,
      q.options,
      q.points,
      q.category
    FROM public.certification_questions q
    WHERE q.certification_type_id = v_cert.id AND q.is_active = true
    ORDER BY random()
    LIMIT v_cert.question_count;
    RETURN;
  END IF;

  RETURN QUERY
  EXECUTE format(
    'SELECT sq.question_id, sq.question_number, sq.question_text, sq.question_type, sq.options, sq.points, sq.category FROM (%s) sq ORDER BY random() LIMIT %s',
    v_q,
    v_cert.question_count
  );
END;
$_$;


ALTER FUNCTION public.get_certification_test_questions(p_cert_type_slug text, p_test_attempt_id uuid) OWNER TO postgres;

--
-- Name: get_compliance_leaderboard(date, date, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_compliance_leaderboard(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 10) RETURNS TABLE(user_id uuid, full_name text, role text, total_points bigint, total_days integer, full_compliance_days integer, rank integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH user_points AS (
    SELECT
      cr.user_id,
      au.full_name,
      au.role,
      SUM(cr.points_awarded) as total_points,
      COUNT(*) as total_days,
      COUNT(*) FILTER (WHERE array_length(cr.forms_completed, 1) = 3) as full_compliance_days
    FROM public.compliance_rewards cr
    JOIN public.app_users au ON cr.user_id = au.user_id
    WHERE (p_start_date IS NULL OR cr.date_for >= p_start_date)
      AND (p_end_date IS NULL OR cr.date_for <= p_end_date)
    GROUP BY cr.user_id, au.full_name, au.role
  )
  SELECT
    up.user_id,
    up.full_name,
    up.role,
    up.total_points::BIGINT,
    up.total_days::INTEGER,
    up.full_compliance_days::INTEGER,
    ROW_NUMBER() OVER (ORDER BY up.total_points DESC)::INTEGER as rank
  FROM user_points up
  ORDER BY up.total_points DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION public.get_compliance_leaderboard(p_start_date date, p_end_date date, p_limit integer) OWNER TO postgres;

--
-- Name: FUNCTION get_compliance_leaderboard(p_start_date date, p_end_date date, p_limit integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_compliance_leaderboard(p_start_date date, p_end_date date, p_limit integer) IS 'Returns top users by compliance points for leaderboard display';


--
-- Name: get_compliance_streaks(uuid[], date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_compliance_streaks(p_user_ids uuid[], p_before_date date) RETURNS TABLE(user_id uuid, streak_days bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH cr AS (
    SELECT cr2.user_id, cr2.date_for
    FROM public.compliance_rewards cr2
    WHERE cr2.user_id = ANY(p_user_ids)
      AND cr2.date_for < p_before_date
      AND array_length(cr2.forms_completed, 1) = 3
  ),
  ranked AS (
    SELECT
      user_id,
      date_for,
      (date_for + (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date_for DESC))::int) AS grp
    FROM cr
  ),
  streak AS (
    SELECT user_id, grp, COUNT(*)::bigint AS streak_days
    FROM ranked
    GROUP BY user_id, grp
  ),
  current_streak AS (
    SELECT s.user_id, s.streak_days
    FROM streak s
    JOIN ranked r ON r.user_id = s.user_id AND r.grp = s.grp
    WHERE r.date_for = p_before_date - 1
  )
  SELECT cs.user_id, cs.streak_days FROM current_streak cs;
$$;


ALTER FUNCTION public.get_compliance_streaks(p_user_ids uuid[], p_before_date date) OWNER TO postgres;

--
-- Name: FUNCTION get_compliance_streaks(p_user_ids uuid[], p_before_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_compliance_streaks(p_user_ids uuid[], p_before_date date) IS 'Returns consecutive full-compliance streak (days) ending the day before p_before_date, for each user in p_user_ids. Used by admin-compliance-cron for batch streak bonus.';


--
-- Name: get_compliance_summary_by_day(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_compliance_summary_by_day(p_date_from date, p_date_to date) RETURNS TABLE(date date, dvir_count bigint, dvir_users bigint, equipment_count bigint, equipment_users bigint, jsa_count bigint, jsa_users bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  d date;
  v_dvir_count bigint;
  v_dvir_users bigint;
  v_equipment_count bigint;
  v_equipment_users bigint;
  v_jsa_count bigint;
  v_jsa_users bigint;
  mv_min date := CURRENT_DATE - INTERVAL '90 days';
BEGIN
  IF p_date_to < p_date_from THEN
    RAISE EXCEPTION 'date_to must be >= date_from';
  END IF;
  IF p_date_to - p_date_from > 366 THEN
    RAISE EXCEPTION 'Date range must not exceed 366 days';
  END IF;

  -- Fast path: requested range is entirely within the MV window (last 90 days)
  IF p_date_from >= mv_min AND p_date_to <= CURRENT_DATE AND (p_date_to - p_date_from + 1) <= 91 THEN
    RETURN QUERY
    SELECT
      m.date,
      m.dvir_count,
      m.dvir_users,
      m.equipment_count,
      m.equipment_users,
      m.jsa_count,
      m.jsa_users
    FROM public.compliance_summary_90d m
    WHERE m.date >= p_date_from AND m.date <= p_date_to
    ORDER BY m.date;
    RETURN;
  END IF;

  -- Slow path: loop (e.g. range > 90 days or dates older than 90 days)
  FOR d IN
    SELECT generate_series(p_date_from, p_date_to, '1 day'::interval)::date
  LOOP
    SELECT count(*), count(DISTINCT user_id)
      INTO v_dvir_count, v_dvir_users
      FROM dvir_reports
      WHERE report_date = d;

    SELECT count(*), count(DISTINCT user_id)
      INTO v_equipment_count, v_equipment_users
      FROM daily_equipment_inspections
      WHERE inspection_date = d;

    SELECT count(*), count(DISTINCT user_id)
      INTO v_jsa_count, v_jsa_users
      FROM daily_jsa
      WHERE job_date = d;

    date := d;
    dvir_count := coalesce(v_dvir_count, 0);
    dvir_users := coalesce(v_dvir_users, 0);
    equipment_count := coalesce(v_equipment_count, 0);
    equipment_users := coalesce(v_equipment_users, 0);
    jsa_count := coalesce(v_jsa_count, 0);
    jsa_users := coalesce(v_jsa_users, 0);
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;


ALTER FUNCTION public.get_compliance_summary_by_day(p_date_from date, p_date_to date) OWNER TO postgres;

--
-- Name: FUNCTION get_compliance_summary_by_day(p_date_from date, p_date_to date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_compliance_summary_by_day(p_date_from date, p_date_to date) IS 'Returns daily submission counts for DVIR, Equipment, and JSA. Uses compliance_summary_90d when range within last 90 days.';


--
-- Name: get_incident_log_osha_300_301(date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_incident_log_osha_300_301(p_date_from date, p_date_to date) RETURNS TABLE(case_number text, incident_date date, incident_time time without time zone, employee_name text, employee_job_title text, work_site_name text, description text, what_doing_before text, object_substance_harmed text, body_parts_affected text, injury_illness_type text, severity text, days_away_from_work integer, days_restricted_duty integer, emergency_room_treatment boolean, hospitalized_overnight boolean, physician_name text, treatment_facility text, time_began_work time without time zone, employee_hire_date date, osha_reportable boolean, osha_reported boolean, osha_report_date date, job_name text, crew_name text, supervisor_name text, corrective_actions_taken text, corrective_actions_at timestamp with time zone, reported_at timestamp with time zone, employee_street_address text, employee_city text, employee_state text, employee_zip text, employee_date_of_birth date, employee_sex text, date_of_death date, privacy_case boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_date_to < p_date_from THEN
    RAISE EXCEPTION 'date_to must be >= date_from';
  END IF;
  IF p_date_to - p_date_from > 366 THEN
    RAISE EXCEPTION 'Date range must not exceed 366 days';
  END IF;

  RETURN QUERY
  SELECT
    si.case_number::text,
    si.incident_date::date,
    si.incident_time::time,
    (
      SELECT app.full_name::text
      FROM public.app_users app
      WHERE app.user_id = (si.involved_user_ids)[1]
      LIMIT 1
    ),
    si.employee_job_title::text,
    si.work_site_name::text,
    si.description::text,
    si.what_doing_before::text,
    si.object_substance_harmed::text,
    (CASE
      WHEN si.body_parts_affected IS NOT NULL AND array_length(si.body_parts_affected, 1) > 0
      THEN array_to_string(si.body_parts_affected, ', ')
      ELSE NULL
    END)::text,
    si.injury_illness_type::text,
    si.severity::text,
    si.days_away_from_work::integer,
    si.days_restricted_duty::integer,
    COALESCE(si.emergency_room_treatment, false)::boolean,
    COALESCE(si.hospitalized_overnight, false)::boolean,
    si.physician_name::text,
    si.treatment_facility::text,
    si.time_began_work::time,
    si.employee_hire_date::date,
    COALESCE(si.osha_reportable, false)::boolean,
    COALESCE(si.osha_reported, false)::boolean,
    si.osha_report_date::date,
    jpt.job_name::text,
    c.name::text,
    sup.full_name::text,
    si.corrective_actions_taken::text,
    si.corrective_actions_at::timestamptz,
    si.reported_at::timestamptz,
    si.employee_street_address::text,
    si.employee_city::text,
    si.employee_state::text,
    si.employee_zip::text,
    si.employee_date_of_birth::date,
    si.employee_sex::text,
    si.date_of_death::date,
    COALESCE(si.privacy_case, false)::boolean
  FROM public.safety_incidents si
  LEFT JOIN public.job_progress_trackers jpt ON jpt.id = si.job_id
  LEFT JOIN public.crews c ON c.id = si.crew_id
  LEFT JOIN public.app_users sup ON sup.user_id = si.supervisor_id
  WHERE si.incident_date >= p_date_from
    AND si.incident_date <= p_date_to
  ORDER BY si.incident_date DESC, si.case_number NULLS LAST, si.reported_at DESC;
END;
$$;


ALTER FUNCTION public.get_incident_log_osha_300_301(p_date_from date, p_date_to date) OWNER TO postgres;

--
-- Name: FUNCTION get_incident_log_osha_300_301(p_date_from date, p_date_to date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_incident_log_osha_300_301(p_date_from date, p_date_to date) IS 'Returns incident log with OSHA 300/301 fields including Form 301 demographics and job/crew/supervisor traceability.';


--
-- Name: get_job_progress(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_job_progress(p_job_id uuid) RETURNS json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_today DATE := CURRENT_DATE;
  v_total_days INTEGER;
  v_elapsed_days INTEGER;
  v_percentage INTEGER;
  v_status TEXT;
  v_days_exceeded INTEGER;
  v_days_remaining INTEGER;
BEGIN
  SELECT start_date, end_date INTO v_start_date, v_end_date
  FROM public.job_progress_trackers
  WHERE id = p_job_id;
  
  IF v_start_date IS NULL THEN
    RETURN json_build_object(
      'percentage', 0,
      'status', 'not_found',
      'daysExceeded', 0,
      'daysRemaining', 0,
      'totalDays', 0,
      'elapsedDays', 0
    );
  END IF;
  
  v_total_days := GREATEST(1, (v_end_date - v_start_date) + 1);
  
  IF v_today < v_start_date THEN
    RETURN json_build_object(
      'percentage', 0,
      'status', 'not_started',
      'daysExceeded', 0,
      'daysRemaining', (v_start_date - v_today),
      'totalDays', v_total_days,
      'elapsedDays', 0
    );
  END IF;
  
  IF v_today > v_end_date THEN
    v_days_exceeded := (v_today - v_end_date);
    RETURN json_build_object(
      'percentage', 100,
      'status', 'exceeded',
      'daysExceeded', v_days_exceeded,
      'daysRemaining', 0,
      'totalDays', v_total_days,
      'elapsedDays', v_total_days + v_days_exceeded
    );
  END IF;
  
  IF v_today = v_end_date THEN
    RETURN json_build_object(
      'percentage', 100,
      'status', 'completed',
      'daysExceeded', 0,
      'daysRemaining', 0,
      'totalDays', v_total_days,
      'elapsedDays', v_total_days
    );
  END IF;
  
  v_elapsed_days := (v_today - v_start_date) + 1;
  v_days_remaining := (v_end_date - v_today);
  v_percentage := LEAST(100, GREATEST(0, ROUND((v_elapsed_days::FLOAT / v_total_days::FLOAT) * 100)));
  
  RETURN json_build_object(
    'percentage', v_percentage,
    'status', 'in_progress',
    'daysExceeded', 0,
    'daysRemaining', v_days_remaining,
    'totalDays', v_total_days,
    'elapsedDays', v_elapsed_days
  );
END;
$$;


ALTER FUNCTION public.get_job_progress(p_job_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_job_progress(p_job_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_job_progress(p_job_id uuid) IS 'Calculates job progress based on dates. Returns JSON with percentage, status, and day counts.';


--
-- Name: get_jsa_shared_users(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_jsa_shared_users(jsa_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT shared_with_users FROM public.daily_jsa WHERE id = jsa_id;
$$;


ALTER FUNCTION public.get_jsa_shared_users(jsa_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_jsa_shared_users(jsa_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_jsa_shared_users(jsa_id uuid) IS 'Get shared_with_users for a JSA without triggering RLS recursion. Used in UPDATE policies.';


--
-- Name: get_jsa_user_id(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_jsa_user_id(jsa_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT user_id FROM public.daily_jsa WHERE id = jsa_id;
$$;


ALTER FUNCTION public.get_jsa_user_id(jsa_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_jsa_user_id(jsa_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_jsa_user_id(jsa_id uuid) IS 'Get user_id for a JSA without triggering RLS recursion. Used in UPDATE policies.';


--
-- Name: get_monthly_raffle_stats(integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_monthly_raffle_stats(p_year integer, p_month integer) RETURNS TABLE(total_participants bigint, total_claim_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    COUNT(DISTINCT user_id)::bigint,
    COALESCE(SUM(amount), 0)::bigint
  FROM public.point_transactions
  WHERE public.point_tx_matches_raffle_month(
    counts_toward_raffle, amount, created_at, p_year, p_month
  );
$$;


ALTER FUNCTION public.get_monthly_raffle_stats(p_year integer, p_month integer) OWNER TO postgres;

--
-- Name: FUNCTION get_monthly_raffle_stats(p_year integer, p_month integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_monthly_raffle_stats(p_year integer, p_month integer) IS 'Ledger-native monthly raffle pool: distinct users + SUM(entries). total_claim_count is pool entry sum (not raw claim count). Predicate: point_tx_matches_raffle_month — keep in sync with get_user_raffle_entries.';


--
-- Name: get_next_algorithm_version(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_next_algorithm_version() RETURNS character varying
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_max_version INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(version FROM 2) AS INTEGER)), 
    0
  ) INTO v_max_version
  FROM risk_algorithm_config
  WHERE version ~ '^v[0-9]+$';
  
  RETURN 'v' || (v_max_version + 1)::TEXT;
END;
$_$;


ALTER FUNCTION public.get_next_algorithm_version() OWNER TO postgres;

--
-- Name: FUNCTION get_next_algorithm_version(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_next_algorithm_version() IS 'Generates sequential version numbers (v1, v2, v3...)';


--
-- Name: get_osha_300a_summary(integer, numeric, numeric); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_osha_300a_summary(p_year integer, p_total_employees_avg numeric DEFAULT NULL::numeric, p_total_hours_worked numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'year', p_year,
    'total_recordable_cases', COUNT(*) FILTER (WHERE COALESCE(osha_reportable, false) = true),
    'cases_days_away', COUNT(*) FILTER (WHERE severity IN ('lost_time', 'fatality') AND COALESCE(days_away_from_work, 0) > 0),
    'cases_job_transfer', COUNT(*) FILTER (WHERE COALESCE(days_restricted_duty, 0) > 0),
    'other_recordable', COUNT(*) FILTER (WHERE COALESCE(osha_reportable, false) = true AND severity = 'recordable'),
    'total_days_away', COALESCE(SUM(days_away_from_work) FILTER (WHERE COALESCE(osha_reportable, false) = true), 0),
    'total_days_restricted', COALESCE(SUM(days_restricted_duty) FILTER (WHERE COALESCE(osha_reportable, false) = true), 0),
    'total_injuries', COUNT(*) FILTER (WHERE COALESCE(osha_reportable, false) = true AND injury_illness_type = 'injury'),
    'total_illnesses', COUNT(*) FILTER (WHERE COALESCE(osha_reportable, false) = true AND injury_illness_type IS NOT NULL AND injury_illness_type != 'injury'),
    'death_count', COUNT(*) FILTER (WHERE severity = 'fatality'),
    'total_employees_avg', p_total_employees_avg,
    'total_hours_worked', p_total_hours_worked
  ) INTO result
  FROM public.safety_incidents
  WHERE EXTRACT(YEAR FROM incident_date) = p_year;

  RETURN result;
END;
$$;


ALTER FUNCTION public.get_osha_300a_summary(p_year integer, p_total_employees_avg numeric, p_total_hours_worked numeric) OWNER TO postgres;

--
-- Name: FUNCTION get_osha_300a_summary(p_year integer, p_total_employees_avg numeric, p_total_hours_worked numeric); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_osha_300a_summary(p_year integer, p_total_employees_avg numeric, p_total_hours_worked numeric) IS 'Returns OSHA 300A annual summary aggregate counts for a given year.';


--
-- Name: get_point_rule(public.point_source, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_point_rule(p_source public.point_source, p_rule_key text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT points
  FROM public.point_rules
  WHERE source = p_source
    AND rule_key = p_rule_key
    AND is_active = true;
$$;


ALTER FUNCTION public.get_point_rule(p_source public.point_source, p_rule_key text) OWNER TO postgres;

--
-- Name: FUNCTION get_point_rule(p_source public.point_source, p_rule_key text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_point_rule(p_source public.point_source, p_rule_key text) IS 'Returns configured points/cap for an active rule, or NULL if missing/inactive (caller skips award).';


--
-- Name: get_recent_cron_failures(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_recent_cron_failures(days_back integer DEFAULT 7) RETURNS TABLE(jobname text, failed_at timestamp with time zone, error_message text)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    j.jobname,
    r.start_time AS failed_at,
    r.return_message AS error_message
  FROM cron.job j
  JOIN cron.job_run_details r ON j.jobid = r.jobid
  WHERE r.status = 'failed'
    AND r.start_time > NOW() - (days_back || ' days')::INTERVAL
    AND j.jobname IN (
      'safety-announcement-5am',
      'admin-compliance-9am',
      'admin-safety-forecast',
      'auto-tune-risk-algorithm',
      'check-algorithm-performance',
      'safety-briefing-reminder-push',
      'safety-briefing-reminder-sms',
      'safety-briefing-escalation-sms',
      'monthly-compliance-summary',
      'weekly-attendance-summary',
      'weekly-safety-audit-report',
      'payroll-hours-reminder-sms-utc13',
      'payroll-hours-reminder-sms-utc14'
    )
  ORDER BY r.start_time DESC;
$$;


ALTER FUNCTION public.get_recent_cron_failures(days_back integer) OWNER TO postgres;

--
-- Name: FUNCTION get_recent_cron_failures(days_back integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_recent_cron_failures(days_back integer) IS 'Returns recent cron job failures within the specified number of days (default: 7).';


--
-- Name: get_telemetry_dashboard_stats(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_telemetry_dashboard_stats(date_from timestamp with time zone DEFAULT (now() - '14 days'::interval), date_to timestamp with time zone DEFAULT now()) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;

  SELECT json_build_object(
    'period', json_build_object(
      'from', date_from,
      'to', date_to
    ),
    'summary', json_build_object(
      'total_events', (SELECT COUNT(*) FROM telemetry_events WHERE created_at BETWEEN date_from AND date_to),
      'unique_sessions', (SELECT COUNT(DISTINCT session_id) FROM telemetry_events WHERE created_at BETWEEN date_from AND date_to),
      'unique_users', (SELECT COUNT(DISTINCT user_id) FROM telemetry_events WHERE created_at BETWEEN date_from AND date_to AND user_id IS NOT NULL)
    ),
    'forms', json_build_object(
      'total_started', (SELECT COUNT(*) FROM telemetry_events WHERE event_name = 'form_started' AND created_at BETWEEN date_from AND date_to),
      'total_submitted', (SELECT COUNT(*) FROM telemetry_events WHERE event_name = 'form_submitted' AND created_at BETWEEN date_from AND date_to),
      'total_errors', (SELECT COUNT(*) FROM telemetry_events WHERE event_name = 'form_submit_error' AND created_at BETWEEN date_from AND date_to),
      'by_type', (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
        FROM (
          SELECT 
            form_type,
            COUNT(*) FILTER (WHERE event_name = 'form_started') AS started,
            COUNT(*) FILTER (WHERE event_name = 'form_submitted') AS submitted,
            COUNT(*) FILTER (WHERE event_name = 'form_submit_error') AS errors
          FROM telemetry_events
          WHERE created_at BETWEEN date_from AND date_to AND form_type IS NOT NULL
          GROUP BY form_type ORDER BY form_type
        ) t
      ),
      'completion_times', (
        SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
        FROM (
          SELECT 
            form_type,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY (properties->>'duration_seconds')::numeric)::numeric, 1) AS p50_seconds,
            ROUND(percentile_cont(0.9) WITHIN GROUP (ORDER BY (properties->>'duration_seconds')::numeric)::numeric, 1) AS p90_seconds,
            COUNT(*) AS sample_size
          FROM telemetry_events
          WHERE event_name = 'form_submitted' AND created_at BETWEEN date_from AND date_to
          AND form_type IS NOT NULL AND properties->>'duration_seconds' IS NOT NULL
          GROUP BY form_type ORDER BY form_type
        ) t
      )
    ),
    'announcements', json_build_object(
      'total_views', (SELECT COUNT(*) FROM telemetry_events WHERE event_name = 'announcement_viewed' AND created_at BETWEEN date_from AND date_to),
      'unique_sessions', (SELECT COUNT(DISTINCT session_id) FROM telemetry_events WHERE event_name = 'announcement_viewed' AND created_at BETWEEN date_from AND date_to),
      'ai_generated_views', (SELECT COUNT(*) FROM telemetry_events WHERE event_name = 'announcement_viewed' AND created_at BETWEEN date_from AND date_to AND (properties->>'is_ai_generated')::boolean = true)
    ),
    'duplicates', json_build_object(
      'detected', (SELECT COUNT(*) FROM telemetry_events WHERE event_name = 'form_duplicate_detected' AND created_at BETWEEN date_from AND date_to),
      'prevented', (SELECT COUNT(*) FROM telemetry_events WHERE event_name = 'form_duplicate_prevented' AND created_at BETWEEN date_from AND date_to),
      'overridden', (SELECT COUNT(*) FROM telemetry_events WHERE event_name = 'form_duplicate_overridden' AND created_at BETWEEN date_from AND date_to)
    ),
    'timeline', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.day), '[]'::json)
      FROM (
        SELECT 
          date_trunc('day', created_at)::date AS day,
          COUNT(*) FILTER (WHERE event_name = 'form_submitted') AS form_submissions,
          COUNT(*) FILTER (WHERE event_name = 'form_submit_error') AS form_errors,
          COUNT(*) FILTER (WHERE event_name = 'announcement_viewed') AS announcement_views
        FROM telemetry_events
        WHERE created_at BETWEEN date_from AND date_to
        GROUP BY date_trunc('day', created_at) ORDER BY day
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;


ALTER FUNCTION public.get_telemetry_dashboard_stats(date_from timestamp with time zone, date_to timestamp with time zone) OWNER TO postgres;

--
-- Name: app_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'employee'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    full_name text,
    drivers_license_number text,
    drivers_license_class text,
    drivers_license_expiration text,
    updated_at timestamp with time zone DEFAULT now(),
    avatar_url text,
    hire_date date,
    experience_level text,
    status text DEFAULT 'active'::text NOT NULL,
    blocked_at timestamp with time zone,
    blocked_reason text,
    preferred_language text DEFAULT 'en'::text NOT NULL,
    manager_id uuid,
    electrical_qualification_level text DEFAULT 'unqualified'::text,
    electrical_qualification_date date,
    electrical_qualification_verified_by uuid,
    phone_number text,
    sms_marketing_opt_out boolean DEFAULT false NOT NULL,
    sms_operational_opt_out boolean DEFAULT false NOT NULL,
    CONSTRAINT app_users_electrical_qualification_level_check CHECK ((electrical_qualification_level = ANY (ARRAY['unqualified'::text, 'line_clearance_tree_trimmer'::text, 'qualified_269'::text]))),
    CONSTRAINT app_users_experience_level_check CHECK ((experience_level = ANY (ARRAY['apprentice'::text, 'journeyman'::text, 'expert'::text]))),
    CONSTRAINT app_users_preferred_language_check CHECK ((preferred_language = ANY (ARRAY['en'::text, 'es'::text]))),
    CONSTRAINT app_users_role_check CHECK ((role = ANY (ARRAY['employee'::text, 'admin'::text, 'manager'::text, 'mechanic'::text, 'general_foreman'::text, 'safety_officer'::text, 'foreman'::text]))),
    CONSTRAINT app_users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'blocked'::text, 'deleted'::text]))),
    CONSTRAINT check_experience_data_quality CHECK ((((hire_date IS NULL) AND (experience_level IS NULL)) OR (hire_date IS NOT NULL)))
);


ALTER TABLE public.app_users OWNER TO postgres;

--
-- Name: COLUMN app_users.avatar_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.avatar_url IS 'Path to user avatar in Supabase Storage (avatars bucket). Format: {user_id}/{timestamp}.jpeg';


--
-- Name: COLUMN app_users.hire_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.hire_date IS 'Employee start date, used for tenure calculation and new hire risk scoring';


--
-- Name: COLUMN app_users.experience_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.experience_level IS 'Skill level: apprentice (<1yr), journeyman (1-5yr), expert (5+yr). Used for crew composition risk scoring.';


--
-- Name: COLUMN app_users.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.status IS 'active: normal; blocked: login disabled, data preserved; deleted: removed (audit only)';


--
-- Name: COLUMN app_users.blocked_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.blocked_at IS 'When user was blocked (null if not blocked)';


--
-- Name: COLUMN app_users.blocked_reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.blocked_reason IS 'Optional reason for block (admin-provided)';


--
-- Name: COLUMN app_users.preferred_language; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.preferred_language IS 'User language preference (en/es) for announcements and future form localization';


--
-- Name: COLUMN app_users.manager_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.manager_id IS 'Direct manager for compliance reporting and manager-specific notifications';


--
-- Name: COLUMN app_users.electrical_qualification_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.electrical_qualification_level IS 'OSHA 1910.269(r) 3-tier: unqualified, line-clearance tree trimmer, 269-qualified';


--
-- Name: COLUMN app_users.electrical_qualification_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.electrical_qualification_date IS 'Date when qualification was last assigned/verified';


--
-- Name: COLUMN app_users.electrical_qualification_verified_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.electrical_qualification_verified_by IS 'app_users.id of admin/SO who verified the qualification';


--
-- Name: COLUMN app_users.phone_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.phone_number IS 'User phone from sign-up; E.164 format preferred (e.g. +18702809951). Source: auth.users.raw_user_meta_data->>''phone_number''.';


--
-- Name: COLUMN app_users.sms_marketing_opt_out; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.sms_marketing_opt_out IS 'When true, user is excluded from mass SMS (admin broadcast). Safety/operational SMS may still be sent.';


--
-- Name: COLUMN app_users.sms_operational_opt_out; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_users.sms_operational_opt_out IS 'When true, exclude from operational SMS (payroll reminders, etc.). Distinct from sms_marketing_opt_out.';


--
-- Name: certification_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.certification_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    certification_type_id uuid NOT NULL,
    written_attempt_id uuid,
    written_passed_at timestamp with time zone,
    written_score numeric(5,2),
    practical_evaluation_id uuid,
    practical_passed_at timestamp with time zone,
    certified_at timestamp with time zone,
    certified_by uuid,
    expires_at timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    renewal_of uuid,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoked_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_escalated_at timestamp with time zone,
    verification_code text DEFAULT public.generate_certification_verification_code() NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    previous_electrical_level text,
    new_electrical_level text,
    CONSTRAINT certification_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'written_passed'::text, 'active'::text, 'expired'::text, 'revoked'::text, 'renewed'::text])))
);


ALTER TABLE public.certification_records OWNER TO postgres;

--
-- Name: TABLE certification_records; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.certification_records IS 'One active/pending per user per type. State: pending -> written_passed -> active -> expired|revoked|renewed.';


--
-- Name: COLUMN certification_records.last_escalated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_records.last_escalated_at IS 'When this record was last included in an admin escalation. Only re-escalate if null or older than 24h.';


--
-- Name: COLUMN certification_records.verification_code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_records.verification_code IS 'Public 8-char code for verification at /verify/:code. Unique, generated at insert.';


--
-- Name: COLUMN certification_records.reviewed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_records.reviewed_by IS 'Admin (auth.users.id) who graded the written test for this record.';


--
-- Name: COLUMN certification_records.reviewed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_records.reviewed_at IS 'When the written test was graded (admin_grade_short_answers).';


--
-- Name: COLUMN certification_records.previous_electrical_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_records.previous_electrical_level IS 'Electrical qualification level before this change (electrical-qualification cert type only).';


--
-- Name: COLUMN certification_records.new_electrical_level; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_records.new_electrical_level IS 'Electrical qualification level after this change (electrical-qualification cert type only).';


--
-- Name: certification_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.certification_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    category text,
    passing_score integer DEFAULT 80 NOT NULL,
    validity_months integer DEFAULT 12 NOT NULL,
    has_written_test boolean DEFAULT true,
    has_practical_eval boolean DEFAULT false,
    question_count integer,
    question_categories jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    allow_all_users boolean DEFAULT false NOT NULL,
    reminder_days integer[] DEFAULT '{}'::integer[],
    escalation_hours integer DEFAULT 48 NOT NULL,
    CONSTRAINT certification_types_category_check CHECK ((category = ANY (ARRAY['equipment'::text, 'safety'::text, 'skill'::text])))
);


ALTER TABLE public.certification_types OWNER TO postgres;

--
-- Name: TABLE certification_types; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.certification_types IS 'Master list of certification types (e.g. Bucket Trimmer, Geo-Boy).';


--
-- Name: COLUMN certification_types.question_categories; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_types.question_categories IS 'Proportions per category for stratified sampling, e.g. {"hardware": 0.4, "knots": 0.3, "observation": 0.3}.';


--
-- Name: COLUMN certification_types.allow_all_users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_types.allow_all_users IS 'When true, all authenticated users can access this certification and its study guide. When false, only admins and individually granted users can access.';


--
-- Name: COLUMN certification_types.reminder_days; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_types.reminder_days IS 'Days before expiry to send reminder (e.g. [30, 14, 7]). Empty or null = no reminders.';


--
-- Name: COLUMN certification_types.escalation_hours; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_types.escalation_hours IS 'Hours after a test is submitted before escalating to admins (awaiting review). Default 48.';


--
-- Name: user_certification_matrix; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.user_certification_matrix AS
 SELECT u.user_id,
    u.full_name,
    u.role,
    ct.id AS certification_type_id,
    ct.name AS certification_name,
    cr.status,
    cr.expires_at,
    cr.reviewed_by,
    cr.reviewed_at,
    reviewer_au.full_name AS reviewed_by_name,
        CASE
            WHEN ((cr.status = 'active'::text) AND (cr.expires_at > now())) THEN 'compliant'::text
            WHEN ((cr.status = 'active'::text) AND (cr.expires_at <= (now() + '30 days'::interval))) THEN 'expiring_soon'::text
            ELSE 'non_compliant'::text
        END AS compliance_status
   FROM (((public.app_users u
     CROSS JOIN public.certification_types ct)
     LEFT JOIN public.certification_records cr ON (((cr.user_id = u.user_id) AND (cr.certification_type_id = ct.id))))
     LEFT JOIN public.app_users reviewer_au ON ((reviewer_au.user_id = cr.reviewed_by)))
  WHERE ((ct.is_active = true) AND (u.role = ANY (ARRAY['employee'::text, 'foreman'::text, 'mechanic'::text, 'general_foreman'::text, 'safety_officer'::text, 'manager'::text])))
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.user_certification_matrix OWNER TO postgres;

--
-- Name: MATERIALIZED VIEW user_certification_matrix; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON MATERIALIZED VIEW public.user_certification_matrix IS 'User × cert compliance. Refresh daily. Includes reviewed_by/reviewed_at for admin UI.';


--
-- Name: get_user_certification_matrix(uuid, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_certification_matrix(p_cert_type_id uuid DEFAULT NULL::uuid, p_compliance_status text DEFAULT NULL::text) RETURNS SETOF public.user_certification_matrix
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT * FROM public.user_certification_matrix m
  WHERE EXISTS (
    SELECT 1 FROM public.app_users
    WHERE app_users.user_id = auth.uid() AND app_users.role = 'admin'
  )
  AND (p_cert_type_id IS NULL OR m.certification_type_id = p_cert_type_id)
  AND (p_compliance_status IS NULL OR m.compliance_status = p_compliance_status);
$$;


ALTER FUNCTION public.get_user_certification_matrix(p_cert_type_id uuid, p_compliance_status text) OWNER TO postgres;

--
-- Name: get_user_compliance_points(uuid, date, date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_compliance_points(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date) RETURNS TABLE(total_points bigint, total_days integer, full_compliance_days integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(points_awarded), 0)::BIGINT as total_points,
    COUNT(*)::INTEGER as total_days,
    COUNT(*) FILTER (WHERE array_length(forms_completed, 1) = 3)::INTEGER as full_compliance_days
  FROM public.compliance_rewards
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR date_for >= p_start_date)
    AND (p_end_date IS NULL OR date_for <= p_end_date);
END;
$$;


ALTER FUNCTION public.get_user_compliance_points(p_user_id uuid, p_start_date date, p_end_date date) OWNER TO postgres;

--
-- Name: FUNCTION get_user_compliance_points(p_user_id uuid, p_start_date date, p_end_date date); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_compliance_points(p_user_id uuid, p_start_date date, p_end_date date) IS 'Returns total compliance points for a user within optional date range';


--
-- Name: get_user_last_activity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_last_activity() RETURNS TABLE(user_id uuid, last_activity_at timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT u.user_id, MAX(u.ts) AS last_activity_at
  FROM (
    SELECT dr.user_id, dr.created_at AS ts FROM public.dvir_reports dr WHERE dr.user_id IS NOT NULL
    UNION ALL
    SELECT dj.user_id, dj.created_at FROM public.daily_jsa dj WHERE dj.user_id IS NOT NULL
    UNION ALL
    SELECT de.user_id, de.created_at FROM public.daily_equipment_inspections de WHERE de.user_id IS NOT NULL
    UNION ALL
    SELECT si.reported_by AS user_id, si.reported_at AS ts
    FROM public.safety_incidents si WHERE si.reported_by IS NOT NULL AND si.reported_at IS NOT NULL
    UNION ALL
    SELECT te.user_id, te.created_at FROM public.telemetry_events te WHERE te.user_id IS NOT NULL
  ) u
  GROUP BY u.user_id;
$$;


ALTER FUNCTION public.get_user_last_activity() OWNER TO postgres;

--
-- Name: FUNCTION get_user_last_activity(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_last_activity() IS 'Returns most recent activity timestamp per user from DVIR, JSA, equipment, safety incidents, telemetry. Admin User Activity uses this for offline users last_seen. SECURITY INVOKER.';


--
-- Name: get_user_point_balance(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_point_balance(target_user_id uuid DEFAULT auth.uid()) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.point_transactions
  WHERE user_id = target_user_id
    AND source <> 'streak_bonus';
$$;


ALTER FUNCTION public.get_user_point_balance(target_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_user_point_balance(target_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_point_balance(target_user_id uuid) IS 'Spendable wallet balance (SUM of ledger amounts excluding streak_bonus raffle-only rows).';


--
-- Name: get_user_points_by_source(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_points_by_source(target_user_id uuid DEFAULT auth.uid()) RETURNS TABLE(source public.point_source, category text, total integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_effective_user uuid;
BEGIN
  IF target_user_id IS NULL THEN
    v_effective_user := auth.uid();
  ELSIF public.is_admin() OR target_user_id = auth.uid() THEN
    v_effective_user := target_user_id;
  ELSE
    RAISE EXCEPTION 'Not permitted to view points for another user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pt.source,
    pt.category,
    COALESCE(SUM(pt.amount), 0)::integer AS total
  FROM public.point_transactions pt
  WHERE pt.user_id = v_effective_user
    AND pt.source <> 'streak_bonus'
  GROUP BY pt.source, pt.category
  ORDER BY pt.source, pt.category NULLS FIRST;
END;
$$;


ALTER FUNCTION public.get_user_points_by_source(target_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_user_points_by_source(target_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_points_by_source(target_user_id uuid) IS 'Wallet breakdown grouped by source/category (excludes streak_bonus raffle-only rows). SUM(total) reconciles to get_user_point_balance.';


--
-- Name: get_user_profiles(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_profiles() RETURNS TABLE(id uuid, user_id uuid, email text, full_name text, role text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM app_users au
    WHERE au.user_id = auth.uid() 
    AND au.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  -- Return all users from the view
  RETURN QUERY
  SELECT 
    up.id,
    up.user_id,
    up.email,
    up.full_name,
    up.role,
    up.created_at
  FROM user_profiles up
  ORDER BY up.created_at DESC;
END;
$$;


ALTER FUNCTION public.get_user_profiles() OWNER TO postgres;

--
-- Name: get_user_raffle_entries(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_raffle_entries(target_user_id uuid, p_year integer, p_month integer) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.point_transactions
  WHERE user_id = target_user_id
    AND public.point_tx_matches_raffle_month(
      counts_toward_raffle, amount, created_at, p_year, p_month
    );
$$;


ALTER FUNCTION public.get_user_raffle_entries(target_user_id uuid, p_year integer, p_month integer) OWNER TO postgres;

--
-- Name: FUNCTION get_user_raffle_entries(target_user_id uuid, p_year integer, p_month integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_raffle_entries(target_user_id uuid, p_year integer, p_month integer) IS 'Raffle-eligible positive ledger sum for a user in a Chicago calendar month. Predicate: point_tx_matches_raffle_month — keep in sync with get_monthly_raffle_stats.';


--
-- Name: get_user_raffle_entries_by_source(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_raffle_entries_by_source(target_user_id uuid, p_year integer, p_month integer) RETURNS TABLE(source public.point_source, category text, total integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_effective_user uuid;
BEGIN
  IF target_user_id IS NULL THEN
    v_effective_user := auth.uid();
  ELSIF public.is_admin() OR target_user_id = auth.uid() THEN
    v_effective_user := target_user_id;
  ELSE
    RAISE EXCEPTION 'Not permitted to view raffle entries for another user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pt.source,
    pt.category,
    COALESCE(SUM(pt.amount), 0)::integer AS total
  FROM public.point_transactions pt
  WHERE pt.user_id = v_effective_user
    AND public.point_tx_matches_raffle_month(
      pt.counts_toward_raffle, pt.amount, pt.created_at, p_year, p_month
    )
  GROUP BY pt.source, pt.category
  ORDER BY pt.source, pt.category NULLS FIRST;
END;
$$;


ALTER FUNCTION public.get_user_raffle_entries_by_source(target_user_id uuid, p_year integer, p_month integer) OWNER TO postgres;

--
-- Name: FUNCTION get_user_raffle_entries_by_source(target_user_id uuid, p_year integer, p_month integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_raffle_entries_by_source(target_user_id uuid, p_year integer, p_month integer) IS 'Raffle-eligible ledger breakdown for a Chicago month (includes streak_bonus). SUM(total) reconciles to get_user_raffle_entries.';


--
-- Name: get_user_total_points(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_user_total_points(target_user_id uuid DEFAULT auth.uid()) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- DEPRECATED alias: delegates to the ledger balance (single source of truth).
  SELECT public.get_user_point_balance(target_user_id);
$$;


ALTER FUNCTION public.get_user_total_points(target_user_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION get_user_total_points(target_user_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.get_user_total_points(target_user_id uuid) IS 'DEPRECATED (remove in a later increment): thin alias for get_user_point_balance(). Originally summed announcement_rewards only; now delegates to the points ledger so every caller sees the same total. Do not add new callers.';


--
-- Name: grant_certification_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.grant_certification_access(p_user_id uuid, p_certification_type_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_grant_id uuid;
  v_row jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can grant certification access';
  END IF;

  INSERT INTO public.certification_access_grants (
    user_id,
    certification_type_id,
    granted_by,
    granted_at
  ) VALUES (
    p_user_id,
    p_certification_type_id,
    auth.uid(),
    now()
  )
  ON CONFLICT (user_id, certification_type_id) DO NOTHING
  RETURNING id INTO v_grant_id;

  IF v_grant_id IS NOT NULL THEN
    v_row := jsonb_build_object(
      'id', v_grant_id,
      'user_id', p_user_id,
      'certification_type_id', p_certification_type_id,
      'granted_by', auth.uid(),
      'granted_at', now()
    );
    PERFORM public.insert_certification_audit_log(
      auth.uid(),
      'cert_access_grant',
      v_grant_id,
      NULL,
      v_row
    );
  END IF;
END;
$$;


ALTER FUNCTION public.grant_certification_access(p_user_id uuid, p_certification_type_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION grant_certification_access(p_user_id uuid, p_certification_type_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.grant_certification_access(p_user_id uuid, p_certification_type_id uuid) IS 'Admin only: grant a user access to a certification test and study guide. Writes to certification_audit_log.';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_full_name text;
  v_dl_number text;
  v_dl_class text;
  v_dl_exp text;
  v_phone text;
BEGIN
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', '');
  v_dl_number := new.raw_user_meta_data->>'drivers_license_number';
  v_dl_class  := new.raw_user_meta_data->>'drivers_license_class';
  v_dl_exp    := new.raw_user_meta_data->>'drivers_license_expiration';
  v_phone     := new.raw_user_meta_data->>'phone_number';

  INSERT INTO public.app_users (
    user_id,
    email,
    full_name,
    drivers_license_number,
    drivers_license_class,
    drivers_license_expiration,
    phone_number,
    role
  )
  VALUES (
    new.id,
    new.email,
    v_full_name,
    v_dl_number,
    v_dl_class,
    v_dl_exp,
    v_phone,
    'employee'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.app_users.full_name),
    drivers_license_number = COALESCE(EXCLUDED.drivers_license_number, public.app_users.drivers_license_number),
    drivers_license_class = COALESCE(EXCLUDED.drivers_license_class, public.app_users.drivers_license_class),
    drivers_license_expiration = COALESCE(EXCLUDED.drivers_license_expiration, public.app_users.drivers_license_expiration),
    phone_number = COALESCE(EXCLUDED.phone_number, public.app_users.phone_number);

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN new;
END;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: FUNCTION handle_new_user(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function that creates/updates app_users record when a new auth.users record is created. Uses user_id column correctly. Syncs phone_number from raw_user_meta_data.';


--
-- Name: increment_contact_template_usage(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_contact_template_usage(template_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.user_contact_templates
  SET
    use_count = COALESCE(use_count, 0) + 1,
    last_used_at = now(),
    updated_at = now()
  WHERE id = template_id
    AND user_id = auth.uid();
END;
$$;


ALTER FUNCTION public.increment_contact_template_usage(template_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION increment_contact_template_usage(template_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.increment_contact_template_usage(template_id uuid) IS 'Increments use_count and last_used_at for a contact template; only affects rows owned by the caller.';


--
-- Name: insert_certification_audit_log(uuid, text, uuid, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.insert_certification_audit_log(p_actor_id uuid, p_action text, p_record_id uuid, p_old_value jsonb, p_new_value jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.certification_audit_log (actor_id, action, record_id, old_value, new_value)
  VALUES (p_actor_id, p_action, p_record_id, p_old_value, p_new_value);
END;
$$;


ALTER FUNCTION public.insert_certification_audit_log(p_actor_id uuid, p_action text, p_record_id uuid, p_old_value jsonb, p_new_value jsonb) OWNER TO postgres;

--
-- Name: FUNCTION insert_certification_audit_log(p_actor_id uuid, p_action text, p_record_id uuid, p_old_value jsonb, p_new_value jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.insert_certification_audit_log(p_actor_id uuid, p_action text, p_record_id uuid, p_old_value jsonb, p_new_value jsonb) IS 'Append one row to certification_audit_log. Call from triggers/RPCs only; bypasses RLS.';


--
-- Name: insert_point_transaction(uuid, integer, public.point_source, uuid, text, text, boolean); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.insert_point_transaction(p_user_id uuid, p_amount integer, p_source public.point_source, p_reference_id uuid, p_reference_table text, p_category text DEFAULT NULL::text, p_counts_toward_raffle boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, category, counts_toward_raffle)
  VALUES
    (p_user_id, p_amount, p_source, p_reference_id, p_reference_table, p_category, p_counts_toward_raffle)
  ON CONFLICT (source, reference_id, category)
    WHERE reference_id IS NOT NULL
      AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
  DO NOTHING;
END;
$$;


ALTER FUNCTION public.insert_point_transaction(p_user_id uuid, p_amount integer, p_source public.point_source, p_reference_id uuid, p_reference_table text, p_category text, p_counts_toward_raffle boolean) OWNER TO postgres;

--
-- Name: FUNCTION insert_point_transaction(p_user_id uuid, p_amount integer, p_source public.point_source, p_reference_id uuid, p_reference_table text, p_category text, p_counts_toward_raffle boolean); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.insert_point_transaction(p_user_id uuid, p_amount integer, p_source public.point_source, p_reference_id uuid, p_reference_table text, p_category text, p_counts_toward_raffle boolean) IS 'Idempotent ledger insert for automatic earning sources; ON CONFLICT matches uq_point_tx_source_ref.';


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN COALESCE((
    SELECT role = 'admin' 
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;


ALTER FUNCTION public.is_admin() OWNER TO postgres;

--
-- Name: FUNCTION is_admin(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_admin() IS 'Returns true if the current authenticated user has the admin role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';


--
-- Name: is_admin_or_manager(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin_or_manager() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN COALESCE((
    SELECT role IN ('admin', 'manager')
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;


ALTER FUNCTION public.is_admin_or_manager() OWNER TO postgres;

--
-- Name: FUNCTION is_admin_or_manager(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_admin_or_manager() IS 'Returns true if the current authenticated user has the admin or manager role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';


--
-- Name: is_admin_or_mechanic(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin_or_mechanic() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN COALESCE((
    SELECT role IN ('admin', 'mechanic')
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;


ALTER FUNCTION public.is_admin_or_mechanic() OWNER TO postgres;

--
-- Name: FUNCTION is_admin_or_mechanic(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_admin_or_mechanic() IS 'Returns true if the current authenticated user has the admin or mechanic role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';


--
-- Name: is_admin_or_safety_or_gf(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_admin_or_safety_or_gf() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((
    SELECT role IN ('admin', 'safety_officer', 'general_foreman')
    FROM public.app_users
    WHERE user_id = auth.uid()
  ), false);
$$;


ALTER FUNCTION public.is_admin_or_safety_or_gf() OWNER TO postgres;

--
-- Name: is_mechanic(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_mechanic() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN COALESCE((
    SELECT role = 'mechanic'
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;


ALTER FUNCTION public.is_mechanic() OWNER TO postgres;

--
-- Name: FUNCTION is_mechanic(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_mechanic() IS 'Returns true if the current authenticated user has the mechanic role. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';


--
-- Name: is_reward_claim_window(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_reward_claim_window() RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (
      SELECT (
        -- Override: today's date (Chicago) in override_dates array => window open
        (s.value->'override_dates') ? ((NOW() AT TIME ZONE 'America/Chicago')::date::text)
        OR (
          -- Otherwise: within configured start/end hour
          (NOW() AT TIME ZONE 'America/Chicago')::time
            >= make_time((s.value->>'claim_window_start_hour_central')::int, 0, 0)
          AND (NOW() AT TIME ZONE 'America/Chicago')::time
            < make_time((s.value->>'claim_window_end_hour_central')::int, 0, 0)
        )
      )
      FROM public.app_settings s
      WHERE s.key = 'reward_points_config'
      LIMIT 1
    ),
    false
  );
$$;


ALTER FUNCTION public.is_reward_claim_window() OWNER TO postgres;

--
-- Name: FUNCTION is_reward_claim_window(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_reward_claim_window() IS 'Returns true when (1) current Chicago date is in reward_points_config.override_dates, or (2) current Chicago time is within claim_window_start/end_hour_central from app_settings. Falls back to false if row is missing.';


--
-- Name: is_supervisor(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_supervisor() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN COALESCE((
    SELECT role IN ('admin', 'general_foreman', 'foreman', 'safety_officer')
    FROM public.app_users 
    WHERE user_id = auth.uid()
  ), false);
END;
$$;


ALTER FUNCTION public.is_supervisor() OWNER TO postgres;

--
-- Name: FUNCTION is_supervisor(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.is_supervisor() IS 'Returns true if the current authenticated user has a supervisory role (admin, general_foreman, foreman, or safety_officer). Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';


--
-- Name: mark_idle_sessions(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_idle_sessions() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.user_activity_sessions
  SET status = 'idle'
  WHERE 
    status = 'active'
    AND last_seen_at < NOW() - INTERVAL '2 minutes';
END;
$$;


ALTER FUNCTION public.mark_idle_sessions() OWNER TO postgres;

--
-- Name: normalize_truck_number(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.normalize_truck_number() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.truck_number := UPPER(TRIM(NEW.truck_number));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.normalize_truck_number() OWNER TO postgres;

--
-- Name: notification_events_dispatch_webhook(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notification_events_dispatch_webhook() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  dispatch_url text := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/notifications-dispatch';
  internal_secret text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtcXF4ZnphaG13bmVoeGNweHpwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjAxOTM2OSwiZXhwIjoyMDc3NTk1MzY5fQ.nQNrR0AMVmNAkIit9AbuJsKErFAgRf81gFx1Zh9DhTU';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtcXF4ZnphaG13bmVoeGNweHpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMTkzNjksImV4cCI6MjA3NzU5NTM2OX0.XOrzyAD1Dr2YzwQbYXI6uHD9byz9xQlLia9Q9dBTHWE';
  request_id bigint;
BEGIN
  SELECT net.http_post(
    url := dispatch_url,
    body := jsonb_build_object('event_id', NEW.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-internal-key', internal_secret
    ),
    timeout_milliseconds := 10000
  ) INTO request_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notification_events_dispatch_webhook() OWNER TO postgres;

--
-- Name: FUNCTION notification_events_dispatch_webhook(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notification_events_dispatch_webhook() IS 'Trigger: POST to notifications-dispatch on notification_events INSERT so trigger-created events (e.g. cert grant/revocation) are delivered.';


--
-- Name: notify_admins_new_signup_webhook(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_admins_new_signup_webhook() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  webhook_url text := 'https://emqqxfzahmwnehxcpxzp.supabase.co/functions/v1/notify-admins-new-signup';
  internal_secret text := '31a4fc12b98e200827d9d686aae243181d978e5Зbас61304388039cc33695534';  -- REPLACE: Edge Functions → Secrets
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtcXF4ZnphaG13bmVoeGNweHpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMTkzNjksImV4cCI6MjA3NzU5NTM2OX0.XOrzyAD1Dr2YzwQbYXI6uHD9byz9xQlLia9Q9dBTHWE';                -- REPLACE: Project Settings → API → anon public
  payload jsonb;
  request_id bigint;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'app_users',
    'schema', 'public',
    'record', to_jsonb(NEW),
    'old_record', null
  );

  SELECT net.http_post(
    url := webhook_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'x-internal-key', internal_secret
    ),
    timeout_milliseconds := 5000
  ) INTO request_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_admins_new_signup_webhook() OWNER TO postgres;

--
-- Name: FUNCTION notify_admins_new_signup_webhook(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_admins_new_signup_webhook() IS 'Trigger: POST to notify-admins-new-signup Edge Function on app_users INSERT. Created via SQL to avoid Dashboard reverting to Edge Function type.';


--
-- Name: notify_external_cert_grant_or_revoke(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_external_cert_grant_or_revoke() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  cert_name TEXT;
  ev_title TEXT;
  ev_body TEXT;
  ev_severity TEXT;
BEGIN
  -- Grant: INSERT with status = 'active', or UPDATE to status = 'active'
  IF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active') THEN
    SELECT name INTO cert_name
    FROM public.external_certification_types
    WHERE id = NEW.external_certification_type_id;
    cert_name := COALESCE(NULLIF(TRIM(cert_name), ''), 'A certification');

    ev_title := 'New Certification Added';
    ev_body := 'You''ve been awarded ' || cert_name || '. View it on your profile.';
    ev_severity := 'low';

    INSERT INTO public.notification_events (category, severity, target_type, target_ref, title, body, url, entity_type, entity_id)
    VALUES (
      'certification_granted',
      ev_severity,
      'user',
      NEW.user_id::TEXT,
      ev_title,
      ev_body,
      '/profile',
      'worker_external_certification',
      NEW.id
    );
    RETURN NEW;
  END IF;

  -- Revocation: UPDATE to status = 'revoked'
  IF TG_OP = 'UPDATE' AND NEW.status = 'revoked' AND (OLD.status IS NULL OR OLD.status <> 'revoked') THEN
    SELECT name INTO cert_name
    FROM public.external_certification_types
    WHERE id = NEW.external_certification_type_id;
    cert_name := COALESCE(NULLIF(TRIM(cert_name), ''), 'A certification');

    ev_title := 'Certification Revoked';
    ev_body := cert_name || ' has been revoked. Contact your supervisor for details.';
    ev_severity := 'high';

    INSERT INTO public.notification_events (category, severity, target_type, target_ref, title, body, url, entity_type, entity_id)
    VALUES (
      'certification_granted',
      ev_severity,
      'user',
      NEW.user_id::TEXT,
      ev_title,
      ev_body,
      '/profile',
      'worker_external_certification',
      NEW.id
    );
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.notify_external_cert_grant_or_revoke() OWNER TO postgres;

--
-- Name: FUNCTION notify_external_cert_grant_or_revoke(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_external_cert_grant_or_revoke() IS 'Creates notification_events for external cert grant (status=active) and revocation. Delivery respects user certification_granted preference. Ensure notifications-dispatch is invoked for new events (e.g. Supabase Database Webhook on notification_events INSERT).';


--
-- Name: notify_manual_award_recipient(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.notify_manual_award_recipient(p_request_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_tx           public.point_transactions;
  v_event_id     uuid;
  v_awarder_name text;
  v_category_lbl text;
  v_title        text;
  v_body         text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_award_points(v_actor) THEN
    RAISE EXCEPTION 'Not permitted to notify for manual award';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Request id is required';
  END IF;

  SELECT * INTO v_tx
  FROM public.point_transactions pt
  WHERE pt.source = 'manual_award'
    AND pt.request_id = p_request_id
    AND pt.awarded_by = v_actor;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manual award not found or not awarded by you';
  END IF;

  SELECT ne.id INTO v_event_id
  FROM public.notification_events ne
  WHERE ne.entity_type = 'manual_award'
    AND ne.entity_id = v_tx.id;

  IF v_event_id IS NOT NULL THEN
    RETURN v_event_id;
  END IF;

  SELECT COALESCE(
    NULLIF(btrim(au.full_name), ''),
    NULLIF(btrim(au.email), '')
  ) INTO v_awarder_name
  FROM public.app_users au
  WHERE au.user_id = v_actor;

  v_category_lbl := CASE v_tx.category
    WHEN 'maintenance'       THEN 'Maintenance'
    WHEN 'good_performance'  THEN 'Good Performance'
    WHEN 'safety_catch'      THEN 'Safety Catch'
    WHEN 'attendance'        THEN 'Attendance'
    WHEN 'peer_recognition'  THEN 'Peer Recognition'
    WHEN 'other'             THEN 'Other'
    ELSE COALESCE(v_tx.category, 'Other')
  END;

  v_title := format(
    'You received %s safety reward point%s!',
    v_tx.amount,
    CASE WHEN v_tx.amount = 1 THEN '' ELSE 's' END
  );

  v_body := concat_ws(
    ' ',
    CASE
      WHEN v_awarder_name IS NOT NULL THEN
        format('%s awarded you %s points.', v_awarder_name, v_tx.amount)
      ELSE
        format('You were awarded %s points.', v_tx.amount)
    END,
    format('Category: %s.', v_category_lbl),
    CASE
      WHEN NULLIF(btrim(v_tx.reason), '') IS NOT NULL THEN
        format('Reason: %s', btrim(v_tx.reason))
      ELSE NULL
    END
  );

  INSERT INTO public.notification_events (
    category, severity, target_type, target_ref, title, body, url,
    actor_user_id, entity_type, entity_id
  ) VALUES (
    'admin_notice', 'medium', 'user', v_tx.user_id::text,
    v_title, v_body, '/safety-rewards', v_actor, 'manual_award', v_tx.id
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;


ALTER FUNCTION public.notify_manual_award_recipient(p_request_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION notify_manual_award_recipient(p_request_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.notify_manual_award_recipient(p_request_id uuid) IS 'Creates a server-built notification_event for a manual_award the caller awarded. Idempotent on entity_id (point_transactions.id). Delivery is handled by notification_events_dispatch_on_insert.';


--
-- Name: point_tx_matches_raffle_month(boolean, integer, timestamp with time zone, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.point_tx_matches_raffle_month(p_counts_toward_raffle boolean, p_amount integer, p_created_at timestamp with time zone, p_year integer, p_month integer) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public'
    AS $$
  SELECT p_counts_toward_raffle
     AND p_amount > 0
     AND EXTRACT(YEAR FROM (p_created_at AT TIME ZONE 'America/Chicago')) = p_year
     AND EXTRACT(MONTH FROM (p_created_at AT TIME ZONE 'America/Chicago')) = p_month;
$$;


ALTER FUNCTION public.point_tx_matches_raffle_month(p_counts_toward_raffle boolean, p_amount integer, p_created_at timestamp with time zone, p_year integer, p_month integer) OWNER TO postgres;

--
-- Name: FUNCTION point_tx_matches_raffle_month(p_counts_toward_raffle boolean, p_amount integer, p_created_at timestamp with time zone, p_year integer, p_month integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.point_tx_matches_raffle_month(p_counts_toward_raffle boolean, p_amount integer, p_created_at timestamp with time zone, p_year integer, p_month integer) IS 'Shared raffle eligibility + America/Chicago month filter. Must stay identical across get_user_raffle_entries and get_monthly_raffle_stats.';


--
-- Name: prevent_dvir_user_id_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_dvir_user_id_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot reassign user_id on submitted DVIR records (audit trail protection)';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_dvir_user_id_change() OWNER TO postgres;

--
-- Name: prevent_equipment_user_id_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_equipment_user_id_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot reassign user_id on submitted inspection records (audit trail protection)';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_equipment_user_id_change() OWNER TO postgres;

--
-- Name: prevent_jsa_user_id_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_jsa_user_id_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND NEW.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot reassign user_id on submitted JSA records (audit trail protection)';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_jsa_user_id_change() OWNER TO postgres;

--
-- Name: queue_asset_cost_refresh(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.queue_asset_cost_refresh() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Just mark that a refresh is needed (actual refresh via cron/background job)
  -- This avoids expensive refreshes on every insert
  PERFORM pg_notify('asset_cost_refresh_needed', '');
  RETURN NULL;
END;
$$;


ALTER FUNCTION public.queue_asset_cost_refresh() OWNER TO postgres;

--
-- Name: redeem_reward(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.redeem_reward(p_item_id uuid, p_request_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user uuid := auth.uid(); v_existing uuid; v_item public.reward_catalog; v_balance integer; v_redemption_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Request id is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_users au WHERE au.user_id = v_user) THEN RAISE EXCEPTION 'User not found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('redeem_reward:' || v_user::text));
  SELECT r.id INTO v_existing FROM public.redemptions r WHERE r.user_id = v_user AND r.request_id = p_request_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  SELECT * INTO v_item FROM public.reward_catalog WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF NOT v_item.is_active THEN RAISE EXCEPTION 'Item is not available'; END IF;
  IF v_item.stock_qty IS NOT NULL THEN
    UPDATE public.reward_catalog SET stock_qty = stock_qty - 1, updated_at = now() WHERE id = p_item_id AND stock_qty > 0;
    IF NOT FOUND THEN RAISE EXCEPTION 'Out of stock'; END IF;
  END IF;
  v_balance := public.get_user_point_balance(v_user);
  IF v_balance < v_item.point_cost THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  INSERT INTO public.redemptions (user_id, item_id, point_cost, status, request_id)
  VALUES (v_user, p_item_id, v_item.point_cost, 'pending', p_request_id) RETURNING id INTO v_redemption_id;
  INSERT INTO public.point_transactions (user_id, amount, source, reference_id, reference_table, counts_toward_raffle)
  VALUES (v_user, -v_item.point_cost, 'redemption', v_redemption_id, 'redemptions', false);
  BEGIN PERFORM public._notify_redemption_pending_admins(v_redemption_id);
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'redemption pending admin notify failed: %', SQLERRM; END;
  RETURN v_redemption_id;
EXCEPTION WHEN unique_violation THEN
  SELECT r.id INTO v_existing FROM public.redemptions r WHERE r.user_id = v_user AND r.request_id = p_request_id;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF; RAISE;
END;
$$;


ALTER FUNCTION public.redeem_reward(p_item_id uuid, p_request_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION redeem_reward(p_item_id uuid, p_request_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.redeem_reward(p_item_id uuid, p_request_id uuid) IS 'Redeem a catalog item. Idempotent on p_request_id. Deducts wallet immediately (negative redemption hold, counts_toward_raffle=false). Race-safe stock + balance.';


--
-- Name: refresh_asset_cost_summary(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_asset_cost_summary() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.asset_cost_summary;
END;
$$;


ALTER FUNCTION public.refresh_asset_cost_summary() OWNER TO postgres;

--
-- Name: FUNCTION refresh_asset_cost_summary(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.refresh_asset_cost_summary() IS 'Refreshes the asset_cost_summary materialized view. Call after bulk data changes.';


--
-- Name: refresh_certification_completion_stats(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_certification_completion_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.certification_completion_stats;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.refresh_certification_completion_stats() OWNER TO postgres;

--
-- Name: FUNCTION refresh_certification_completion_stats(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.refresh_certification_completion_stats() IS 'Trigger function: refreshes certification_completion_stats MV so Supabase Table Editor shows current counts.';


--
-- Name: run_data_retention(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.run_data_retention() RETURNS TABLE(table_name text, deleted_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  pol record;
  cutoff date;
  sql text;
  cnt bigint;
  oldest_record_date date;
  newest_deleted_date date;
  archive_sql text;
BEGIN
  FOR pol IN
    SELECT p.table_name, p.date_column, p.retention_days, p.archive_table_name
    FROM public.data_retention_policies p
    WHERE p.enabled
      AND EXISTS (
        SELECT 1 FROM information_schema.tables t
        WHERE t.table_schema = 'public' AND t.table_name = p.table_name
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = p.table_name AND c.column_name = p.date_column
      )
  LOOP
    cutoff := (current_date AT TIME ZONE 'America/Chicago')::date - (pol.retention_days || ' days')::interval;

    -- Get count and date range of rows that will be deleted
    EXECUTE format(
      'SELECT count(*)::bigint, min(%I)::date, max(%I)::date FROM public.%I WHERE %I < $1',
      pol.date_column, pol.date_column, pol.table_name, pol.date_column
    ) INTO cnt, oldest_record_date, newest_deleted_date USING cutoff;

    IF cnt IS NULL OR cnt = 0 THEN
      table_name := pol.table_name;
      deleted_count := 0;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Log to safety_audit_log BEFORE deleting
    INSERT INTO public.safety_audit_log (event_type, table_name, payload_snapshot)
    VALUES (
      'data_retention_delete',
      pol.table_name,
      jsonb_build_object(
        'records_deleted', cnt,
        'date_range_start', oldest_record_date,
        'date_range_end', newest_deleted_date,
        'retention_policy_days', pol.retention_days,
        'executed_at', now()
      )
    );

    IF pol.archive_table_name IS NOT NULL AND pol.archive_table_name <> '' THEN
      -- Create archive table if not exists (same structure, no data)
      archive_sql := format(
        'CREATE TABLE IF NOT EXISTS public.%I (LIKE public.%I INCLUDING DEFAULTS)',
        pol.archive_table_name,
        pol.table_name
      );
      EXECUTE archive_sql;
      -- Copy rows into archive before delete
      sql := format(
        'INSERT INTO public.%I SELECT * FROM public.%I WHERE %I < $1',
        pol.archive_table_name,
        pol.table_name,
        pol.date_column
      );
      EXECUTE sql USING cutoff;
      -- Delete from source
      sql := format(
        'DELETE FROM public.%I WHERE %I < $1',
        pol.table_name,
        pol.date_column
      );
      EXECUTE sql USING cutoff;
    ELSE
      sql := format(
        'DELETE FROM public.%I WHERE %I < $1',
        pol.table_name,
        pol.date_column
      );
      EXECUTE sql USING cutoff;
    END IF;

    GET DIAGNOSTICS cnt = ROW_COUNT;
    table_name := pol.table_name;
    deleted_count := cnt;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$_$;


ALTER FUNCTION public.run_data_retention() OWNER TO postgres;

--
-- Name: FUNCTION run_data_retention(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.run_data_retention() IS 'Deletes compliance records older than retention_days. Logs each batch to safety_audit_log before delete. If archive_table_name is set, copies rows to archive table first.';


--
-- Name: safety_audit_log_insert(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.safety_audit_log_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_event_type text;
  v_user_id uuid;
  v_payload jsonb;
BEGIN
  IF TG_TABLE_NAME = 'dvir_reports' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'dvir_submitted' ELSE 'dvir_updated' END;
  ELSIF TG_TABLE_NAME = 'daily_jsa' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'jsa_submitted' ELSE 'jsa_updated' END;
  ELSIF TG_TABLE_NAME = 'daily_equipment_inspections' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'equipment_submitted' ELSE 'equipment_updated' END;
  ELSIF TG_TABLE_NAME = 'safety_incidents' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'incident_created' ELSE 'incident_updated' END;
  ELSIF TG_TABLE_NAME = 'safety_flags' THEN
    v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'safety_flag_created' ELSE 'safety_flag_updated' END;
  ELSE
    v_event_type := TG_TABLE_NAME || '_' || LOWER(TG_OP);
  END IF;
  IF TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'safety_incidents' THEN
    v_user_id := COALESCE((NEW).reported_by, (NEW).user_id, auth.uid());
  ELSIF TG_TABLE_NAME = 'safety_flags' THEN
    v_user_id := COALESCE((NEW).flagged_by, auth.uid());
  ELSE
    v_user_id := COALESCE((NEW).user_id, auth.uid());
  END IF;

  v_payload := jsonb_build_object('id', (NEW).id, 'op', TG_OP);
  IF TG_TABLE_NAME = 'dvir_reports' THEN
    v_payload := v_payload || jsonb_build_object('report_date', (NEW).report_date, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'daily_jsa' THEN
    v_payload := v_payload || jsonb_build_object('job_date', (NEW).job_date, 'status', (NEW).status, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'daily_equipment_inspections' THEN
    v_payload := v_payload || jsonb_build_object('inspection_date', (NEW).inspection_date, 'created_at', (NEW).created_at);
  ELSIF TG_TABLE_NAME = 'safety_incidents' THEN
    v_payload := v_payload || jsonb_build_object('incident_date', (NEW).incident_date, 'case_number', (NEW).case_number, 'reported_at', (NEW).reported_at);
  ELSIF TG_TABLE_NAME = 'safety_flags' THEN
    v_payload := v_payload || jsonb_build_object('form_type', (NEW).form_type, 'form_id', (NEW).form_id, 'status', (NEW).status, 'created_at', (NEW).created_at);
  END IF;

  INSERT INTO public.safety_audit_log (event_type, table_name, record_id, user_id, occurred_at, payload_snapshot)
  VALUES (v_event_type, TG_TABLE_NAME, (NEW).id, v_user_id, now(), v_payload);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.safety_audit_log_insert() OWNER TO postgres;

--
-- Name: FUNCTION safety_audit_log_insert(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.safety_audit_log_insert() IS 'Trigger function: append one row to safety_audit_log on INSERT/UPDATE. SECURITY DEFINER. Includes certification_records.';


--
-- Name: safety_audit_log_osha_300a(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.safety_audit_log_osha_300a() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_event_type text;
  v_payload jsonb;
BEGIN
  v_event_type := CASE TG_OP WHEN 'INSERT' THEN 'osha_300a_certified' ELSE 'osha_300a_updated' END;
  v_payload := jsonb_build_object(
    'id', (NEW).id,
    'op', TG_OP,
    'year', (NEW).year,
    'certified_at', (NEW).certified_at,
    'posted_date', (NEW).posted_date
  );
  INSERT INTO public.safety_audit_log (event_type, table_name, record_id, user_id, occurred_at, payload_snapshot)
  VALUES (v_event_type, 'osha_300a_certifications', (NEW).id, auth.uid(), now(), v_payload);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.safety_audit_log_osha_300a() OWNER TO postgres;

--
-- Name: save_setting_and_update_cron(text, jsonb, timestamp with time zone, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.save_setting_and_update_cron(p_setting_key text, p_setting_value jsonb, p_expected_updated_at timestamp with time zone, p_cron_updates jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_allowed_jobs text[] := ARRAY[
    'safety-announcement-5am',
    'safety-briefing-reminder-push',
    'safety-briefing-reminder-sms',
    'safety-briefing-escalation-sms',
    'admin-compliance-9am'
  ];
  v_row_count int;
  v_cron_entry jsonb;
  v_job_name text;
  v_schedule text;
  v_job_id bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  -- Optimistic lock: only update if updated_at matches what the client last fetched
  UPDATE public.app_settings
  SET value = p_setting_value,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE key = p_setting_key
    AND updated_at = p_expected_updated_at;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;

  IF v_row_count = 0 THEN
    -- Either row doesn't exist or was changed by another admin
    IF EXISTS (SELECT 1 FROM public.app_settings WHERE key = p_setting_key) THEN
      RETURN jsonb_build_object('success', false, 'error', 'conflict',
        'message', 'Settings were changed by another admin. Please refresh and try again.');
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'not_found',
        'message', 'Setting key not found: ' || p_setting_key);
    END IF;
  END IF;

  -- Apply cron schedule changes atomically
  FOR v_cron_entry IN SELECT * FROM jsonb_array_elements(p_cron_updates)
  LOOP
    v_job_name := v_cron_entry->>'job_name';
    v_schedule := v_cron_entry->>'schedule';

    IF v_job_name IS NULL OR v_schedule IS NULL THEN
      RAISE EXCEPTION 'Invalid cron update entry: job_name and schedule are required';
    END IF;

    IF NOT v_job_name = ANY(v_allowed_jobs) THEN
      RAISE EXCEPTION 'Cron job name not in allowlist: %', v_job_name;
    END IF;

    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = v_job_name;
    IF v_job_id IS NOT NULL THEN
      PERFORM cron.alter_job(v_job_id, schedule := v_schedule);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;


ALTER FUNCTION public.save_setting_and_update_cron(p_setting_key text, p_setting_value jsonb, p_expected_updated_at timestamp with time zone, p_cron_updates jsonb) OWNER TO postgres;

--
-- Name: FUNCTION save_setting_and_update_cron(p_setting_key text, p_setting_value jsonb, p_expected_updated_at timestamp with time zone, p_cron_updates jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.save_setting_and_update_cron(p_setting_key text, p_setting_value jsonb, p_expected_updated_at timestamp with time zone, p_cron_updates jsonb) IS 'Atomically saves an app_settings value (with optimistic lock) and optionally updates pg_cron schedules. Admin-only.';


--
-- Name: set_certification_grading_started(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_certification_grading_started(p_attempt_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can claim grading.';
  END IF;

  UPDATE public.certification_attempts
  SET
    grading_started_at = now(),
    grading_started_by = auth.uid()
  WHERE id = p_attempt_id
    AND status = 'submitted';
END;
$$;


ALTER FUNCTION public.set_certification_grading_started(p_attempt_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION set_certification_grading_started(p_attempt_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.set_certification_grading_started(p_attempt_id uuid) IS 'Claim grading lock for an attempt (call when opening pending review card).';


--
-- Name: set_daily_attendance_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_daily_attendance_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_daily_attendance_updated_at() OWNER TO postgres;

--
-- Name: set_dvir_report_date(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_dvir_report_date() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.report_date IS NULL THEN
    NEW.report_date := (NEW.created_at AT TIME ZONE 'America/Chicago')::date;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_dvir_report_date() OWNER TO postgres;

--
-- Name: FUNCTION set_dvir_report_date(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.set_dvir_report_date() IS 'Auto-sets report_date from created_at in America/Chicago timezone if not provided.';


--
-- Name: set_safety_announcements_published_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_safety_announcements_published_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
    BEGIN
      IF NEW.status = 'published' AND OLD.status != 'published' THEN
        NEW.published_at = now();
      END IF;
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION public.set_safety_announcements_published_at() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: FUNCTION set_updated_at(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.set_updated_at() IS 'Generic updated_at trigger function. Fixed search_path for security.';


--
-- Name: sms_escalation_recipients_trim_phone(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sms_escalation_recipients_trim_phone() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  digits_only text;
  normalized text;
  extracted text;
BEGIN
  IF NEW.phone_e164 IS NOT NULL THEN
    NEW.phone_e164 := trim(NEW.phone_e164);
    -- Strip all non-digits so '+1 870-280-9951' or '870-280-9951' can be normalized
    digits_only := regexp_replace(NEW.phone_e164, '\D', '', 'g');
    IF length(digits_only) = 10 THEN
      normalized := '+1' || digits_only;
    ELSIF length(digits_only) = 11 AND left(digits_only, 1) = '1' THEN
      normalized := '+' || digits_only;
    ELSIF length(digits_only) BETWEEN 7 AND 15 THEN
      normalized := '+' || digits_only;
    ELSE
      normalized := NULL;
    END IF;
    IF normalized IS NOT NULL AND normalized ~ '^\+[1-9]\d{6,14}$' THEN
      NEW.phone_e164 := normalized;
    ELSE
      -- Fallback: extract first E.164 substring (e.g. pasted CSV "+18702809951, Steve Curtis")
      extracted := (regexp_match(NEW.phone_e164, '\+[1-9]\d{6,14}'))[1];
      IF extracted IS NOT NULL THEN
        NEW.phone_e164 := extracted;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$_$;


ALTER FUNCTION public.sms_escalation_recipients_trim_phone() OWNER TO postgres;

--
-- Name: FUNCTION sms_escalation_recipients_trim_phone(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.sms_escalation_recipients_trim_phone() IS 'Normalizes phone_e164: strips non-digits and builds E.164 (+1 for 10-digit US), or extracts first E.164 from pasted CSV. Accepts "+1 870-280-9951", "870-280-9951", "+18702809951".';


--
-- Name: streak_bonus_amount(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.streak_bonus_amount(p_milestone_key text) RETURNS integer
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public'
    AS $$
  SELECT CASE p_milestone_key
    WHEN 'consecutive_5'  THEN 2
    WHEN 'consecutive_10' THEN 5
    WHEN 'full_month'     THEN 15
    ELSE NULL
  END;
$$;


ALTER FUNCTION public.streak_bonus_amount(p_milestone_key text) OWNER TO postgres;

--
-- Name: submit_certification_test(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.submit_certification_test(p_test_attempt_id uuid, p_user_answers jsonb) RETURNS TABLE(passed boolean, score_percentage numeric, correct_answers integer, total_questions integer, pending_review_count integer, result_status text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_attempt RECORD;
  v_pass_threshold INTEGER;
  v_graded JSONB := '[]'::jsonb;
  v_correct INTEGER := 0;
  v_total_pts INTEGER := 0;
  v_earned INTEGER := 0;
  v_score NUMERIC;
  v_idx INT;
  v_ans JSONB;
  v_qid UUID;
  v_user_ans TEXT;
  v_correct_ans TEXT;
  v_question_text TEXT;  -- NEW: Store question text
  v_pts INT;
  v_ok BOOLEAN;
  v_has_practical BOOLEAN;
  v_validity INTERVAL;
  v_question_type TEXT;
  v_pending_count INTEGER := 0;
  v_auto_graded_count INTEGER := 0;
  v_auto_graded_pts INTEGER := 0;
  v_final_status TEXT;
BEGIN
  -- Validate input
  IF p_user_answers IS NULL OR jsonb_array_length(p_user_answers) = 0 THEN
    RAISE EXCEPTION 'No answers provided';
  END IF;

  SELECT ca.* INTO v_attempt
  FROM public.certification_attempts ca
  WHERE ca.id = p_test_attempt_id
    AND ca.user_id = auth.uid()
    AND ca.status = 'in_progress';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid attempt or attempt not in progress. You may have already submitted this test.';
  END IF;

  SELECT ct.passing_score, ct.has_practical_eval,
         (ct.validity_months || ' months')::interval
  INTO v_pass_threshold, v_has_practical, v_validity
  FROM public.certification_types ct
  WHERE ct.id = v_attempt.certification_type_id;

  IF v_pass_threshold IS NULL THEN
    RAISE EXCEPTION 'Certification configuration error: no passing score set';
  END IF;

  FOR v_idx IN 0 .. jsonb_array_length(p_user_answers) - 1 LOOP
    v_ans := p_user_answers->v_idx;
    v_qid := (v_ans->>'question_id')::uuid;
    v_user_ans := COALESCE(v_ans->>'answer', '');

    -- Include question_text in the SELECT
    SELECT q.correct_answer, q.points, q.question_type, q.question_text
    INTO v_correct_ans, v_pts, v_question_type, v_question_text
    FROM public.certification_questions q
    WHERE q.id = v_qid;

    IF NOT FOUND THEN
      RAISE NOTICE 'Question % not found, skipping', v_qid;
      CONTINUE;
    END IF;

    -- Handle short_answer questions differently
    IF v_question_type = 'short_answer' THEN
      v_pending_count := v_pending_count + 1;
      v_total_pts := v_total_pts + COALESCE(v_pts, 1);
      
      v_graded := v_graded || jsonb_build_object(
        'question_id', v_qid,
        'question_text', v_question_text,  -- NEW: Include question text
        'user_answer', v_user_ans,
        'correct_answer', v_correct_ans,
        'is_correct', NULL,
        'points', COALESCE(v_pts, 1),
        'pending_review', true,
        'question_type', v_question_type
      );
    ELSE
      -- Auto-grade MC/TF questions
      v_auto_graded_count := v_auto_graded_count + 1;
      v_auto_graded_pts := v_auto_graded_pts + COALESCE(v_pts, 1);
      v_ok := (v_user_ans = v_correct_ans);
      IF v_ok THEN
        v_correct := v_correct + 1;
        v_earned := v_earned + COALESCE(v_pts, 1);
      END IF;
      v_total_pts := v_total_pts + COALESCE(v_pts, 1);

      v_graded := v_graded || jsonb_build_object(
        'question_id', v_qid,
        'question_text', v_question_text,  -- NEW: Include question text
        'user_answer', v_user_ans,
        'correct_answer', v_correct_ans,
        'is_correct', v_ok,
        'points', COALESCE(v_pts, 1),
        'pending_review', false,
        'question_type', v_question_type
      );
    END IF;
  END LOOP;

  -- Calculate score based on auto-graded questions only
  IF v_auto_graded_pts = 0 THEN
    v_score := 0;
  ELSE
    v_score := (v_earned::numeric / v_auto_graded_pts::numeric) * 100;
  END IF;

  -- Determine status
  IF v_pending_count > 0 THEN
    v_final_status := 'submitted';
  ELSE
    v_final_status := 'graded';
  END IF;

  UPDATE public.certification_attempts ca
  SET
    status = v_final_status,
    submitted_at = now(),
    completed_at = CASE WHEN v_pending_count = 0 THEN now() ELSE NULL END,
    answers = v_graded,
    total_questions = jsonb_array_length(p_user_answers),
    correct_answers = v_correct,
    total_points = v_total_pts,
    earned_points = v_earned,
    score_percentage = v_score,
    passed = CASE WHEN v_pending_count = 0 THEN (v_score >= v_pass_threshold) ELSE NULL END
  WHERE ca.id = p_test_attempt_id;

  -- Only create certification record if fully graded and passed
  IF v_pending_count = 0 AND v_score >= v_pass_threshold THEN
    INSERT INTO public.certification_records (
      user_id,
      certification_type_id,
      written_attempt_id,
      written_passed_at,
      written_score,
      status,
      expires_at
    ) VALUES (
      auth.uid(),
      v_attempt.certification_type_id,
      p_test_attempt_id,
      now(),
      v_score,
      CASE WHEN v_has_practical THEN 'written_passed'::text ELSE 'active'::text END,
      now() + v_validity
    )
    ON CONFLICT (user_id, certification_type_id) 
    WHERE (certification_records.status IN ('pending', 'written_passed', 'active'))
    DO UPDATE SET
      written_attempt_id = EXCLUDED.written_attempt_id,
      written_passed_at = EXCLUDED.written_passed_at,
      written_score = EXCLUDED.written_score,
      status = EXCLUDED.status,
      expires_at = EXCLUDED.expires_at,
      updated_at = now();
  END IF;

  -- Return results
  passed := CASE WHEN v_pending_count = 0 THEN (v_score >= v_pass_threshold) ELSE NULL END;
  score_percentage := v_score;
  correct_answers := v_correct;
  total_questions := jsonb_array_length(p_user_answers);
  pending_review_count := v_pending_count;
  result_status := v_final_status;
  RETURN NEXT;
END;
$$;


ALTER FUNCTION public.submit_certification_test(p_test_attempt_id uuid, p_user_answers jsonb) OWNER TO postgres;

--
-- Name: FUNCTION submit_certification_test(p_test_attempt_id uuid, p_user_answers jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.submit_certification_test(p_test_attempt_id uuid, p_user_answers jsonb) IS 'Grade MC/TF auto, mark short_answer for review. Now includes question_text in stored answers.';


--
-- Name: submit_practical_evaluation(uuid, uuid, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.submit_practical_evaluation(p_user_id uuid, p_certification_type_id uuid, p_checklist_items jsonb, p_evaluator_notes text DEFAULT NULL::text, p_evaluator_signature text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_evaluator_id UUID := auth.uid();
  v_items_total INT := 0;
  v_items_passed INT := 0;
  v_passed BOOLEAN;
  v_ev_id UUID;
  v_cert_id UUID;
  v_validity_months INT;
  v_rec RECORD;
  v_cat TEXT;
  v_arr JSONB;
  v_item JSONB;
  v_item_passed BOOLEAN;
BEGIN
  IF v_evaluator_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.can_evaluate_user(v_evaluator_id, p_user_id, p_certification_type_id) THEN
    RAISE EXCEPTION 'Not authorized to evaluate this user for this certification';
  END IF;

  FOR v_cat, v_arr IN SELECT * FROM jsonb_each(p_checklist_items)
  LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_arr)
    LOOP
      v_items_total := v_items_total + 1;
      v_item_passed := (v_item->>'passed')::boolean;
      IF v_item_passed THEN
        v_items_passed := v_items_passed + 1;
      END IF;
    END LOOP;
  END LOOP;

  IF v_items_total = 0 THEN
    RAISE EXCEPTION 'Checklist must have at least one item';
  END IF;

  v_passed := (v_items_passed::float / v_items_total::float) >= 0.8;

  INSERT INTO public.practical_evaluations (
    user_id,
    certification_type_id,
    evaluator_id,
    evaluation_date,
    checklist_items,
    items_total,
    items_passed,
    passed,
    evaluator_notes,
    evaluator_signature
  ) VALUES (
    p_user_id,
    p_certification_type_id,
    v_evaluator_id,
    now(),
    p_checklist_items,
    v_items_total,
    v_items_passed,
    v_passed,
    p_evaluator_notes,
    p_evaluator_signature
  )
  RETURNING id INTO v_ev_id;

  IF v_passed THEN
    SELECT validity_months INTO v_validity_months
    FROM public.certification_types
    WHERE id = p_certification_type_id;

    v_validity_months := COALESCE(v_validity_months, 12);

    UPDATE public.certification_records
    SET
      practical_evaluation_id = v_ev_id,
      practical_passed_at = now(),
      status = 'active',
      certified_at = now(),
      certified_by = v_evaluator_id,
      expires_at = now() + (v_validity_months * INTERVAL '1 month'),
      updated_at = now()
    WHERE user_id = p_user_id
      AND certification_type_id = p_certification_type_id
      AND status = 'written_passed';
  END IF;

  RETURN v_ev_id;
END;
$$;


ALTER FUNCTION public.submit_practical_evaluation(p_user_id uuid, p_certification_type_id uuid, p_checklist_items jsonb, p_evaluator_notes text, p_evaluator_signature text) OWNER TO postgres;

--
-- Name: FUNCTION submit_practical_evaluation(p_user_id uuid, p_certification_type_id uuid, p_checklist_items jsonb, p_evaluator_notes text, p_evaluator_signature text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.submit_practical_evaluation(p_user_id uuid, p_certification_type_id uuid, p_checklist_items jsonb, p_evaluator_notes text, p_evaluator_signature text) IS 'Evaluator submits practical checklist. Updates cert record when passed.';


--
-- Name: sync_announcement_reward_to_ledger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_announcement_reward_to_ledger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.points_awarded = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, created_at)
  VALUES
    (NEW.user_id, NEW.points_awarded, 'announcement_claim', NEW.id, 'announcement_rewards', true, NEW.claimed_at)
  ON CONFLICT (source, reference_id, category)
    WHERE reference_id IS NOT NULL
      AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
  DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_announcement_reward_to_ledger() OWNER TO postgres;

--
-- Name: sync_attendance_to_absences(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_attendance_to_absences() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  absence_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_absences
    WHERE user_id = OLD.user_id AND date = OLD.date;
    RETURN OLD;
  END IF;

  CASE NEW.status
    WHEN 'absent' THEN absence_type := 'sick';
    WHEN 'ncns'   THEN absence_type := 'leave';
    WHEN 'rto'    THEN absence_type := 'pto';
    WHEN 'present' THEN
      DELETE FROM public.user_absences
      WHERE user_id = NEW.user_id AND date = NEW.date;
      RETURN NEW;
  END CASE;

  INSERT INTO public.user_absences (user_id, date, type, created_by)
  VALUES (NEW.user_id, NEW.date, absence_type, NEW.marked_by)
  ON CONFLICT (user_id, date)
  DO UPDATE SET type = EXCLUDED.type;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_attendance_to_absences() OWNER TO postgres;

--
-- Name: sync_compliance_reward_to_ledger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_compliance_reward_to_ledger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.points_awarded = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.point_transactions
    (user_id, amount, source, reference_id, reference_table, counts_toward_raffle, created_at)
  VALUES
    (NEW.user_id, NEW.points_awarded, 'compliance_form', NEW.id, 'compliance_rewards', true, NEW.awarded_at)
  ON CONFLICT (source, reference_id, category)
    WHERE reference_id IS NOT NULL
      AND source IN ('announcement_claim', 'compliance_form', 'certification', 'near_miss_report')
  DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_compliance_reward_to_ledger() OWNER TO postgres;

--
-- Name: sync_electrical_qualification_level(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_electrical_qualification_level() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cert_slug TEXT;
BEGIN
  SELECT slug INTO v_cert_slug
  FROM public.certification_types
  WHERE id = NEW.certification_type_id;

  IF v_cert_slug = 'electrical-qualification' AND NEW.status = 'active' THEN
    UPDATE public.app_users
    SET
      electrical_qualification_level = 'qualified_269',
      electrical_qualification_date = CURRENT_DATE,
      electrical_qualification_verified_by = (
        SELECT id FROM public.app_users WHERE user_id = NEW.certified_by LIMIT 1
      )
    WHERE user_id = NEW.user_id;
  END IF;

  IF v_cert_slug = 'electrical-qualification' AND NEW.status IN ('expired', 'revoked') THEN
    UPDATE public.app_users
    SET electrical_qualification_level = 'unqualified'
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_electrical_qualification_level() OWNER TO postgres;

--
-- Name: FUNCTION sync_electrical_qualification_level(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.sync_electrical_qualification_level() IS 'Keeps app_users.electrical_qualification_level in sync when electrical-qualification cert becomes active/expired/revoked.';


--
-- Name: sync_rto_approval_to_attendance(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_rto_approval_to_attendance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  curr date;
  approver uuid;
  day_span int;
  SYSTEM_USER_ID constant uuid := '00000000-0000-0000-0000-000000000000';
  MAX_RTO_DAYS constant int := 90;
BEGIN
  approver := COALESCE(NEW.approved_by, auth.uid(), SYSTEM_USER_ID);

  IF NEW.status = 'Approved' AND (OLD.status IS DISTINCT FROM 'Approved') THEN
    day_span := (NEW.end_date - NEW.start_date) + 1;

    IF day_span > MAX_RTO_DAYS THEN
      RAISE WARNING '[sync_rto_approval] RTO #% spans % days (max %), skipping auto-sync',
        NEW.id, day_span, MAX_RTO_DAYS;
      RETURN NEW;
    END IF;

    curr := NEW.start_date;
    WHILE curr <= NEW.end_date LOOP
      IF EXTRACT(DOW FROM curr) BETWEEN 1 AND 5 THEN
        INSERT INTO public.daily_attendance (user_id, date, status, marked_by, notes)
        VALUES (NEW.user_id, curr, 'rto', approver,
                'Auto-synced from RTO #' || NEW.id)
        ON CONFLICT (user_id, date)
        DO UPDATE SET status = 'rto',
                      marked_by = EXCLUDED.marked_by,
                      notes = EXCLUDED.notes;
      END IF;
      curr := curr + 1;
    END LOOP;
  END IF;

  IF OLD.status = 'Approved' AND NEW.status IS DISTINCT FROM 'Approved' THEN
    DELETE FROM public.daily_attendance
    WHERE user_id = OLD.user_id
      AND date BETWEEN OLD.start_date AND OLD.end_date
      AND status = 'rto'
      AND notes LIKE 'Auto-synced from RTO #%';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_rto_approval_to_attendance() OWNER TO postgres;

--
-- Name: sync_streak_bonuses_for_user(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_streak_bonuses_for_user(p_user_id uuid, p_anchor_claimed_at timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_year int;
  v_month int;
  v_month_key text;
  v_start date;
  v_end date;
  v_ann_dates date[];
  v_claimed_dates date[];
  v_m record;
  v_created_at timestamptz;
  v_category text;
BEGIN
  v_year := EXTRACT(YEAR FROM (p_anchor_claimed_at AT TIME ZONE 'America/Chicago'))::int;
  v_month := EXTRACT(MONTH FROM (p_anchor_claimed_at AT TIME ZONE 'America/Chicago'))::int;
  v_month_key := v_year::text || '-' || lpad(v_month::text, 2, '0');
  v_start := make_date(v_year, v_month, 1);
  v_end := (v_start + interval '1 month')::date;

  SELECT COALESCE(array_agg(sub.d ORDER BY sub.d), ARRAY[]::date[])
  INTO v_ann_dates
  FROM (
    SELECT DISTINCT a.date AS d
    FROM public.announcements a
    WHERE a.date >= v_start AND a.date < v_end
  ) sub;

  SELECT COALESCE(array_agg(sub.d ORDER BY sub.d), ARRAY[]::date[])
  INTO v_claimed_dates
  FROM (
    SELECT DISTINCT (ar.claimed_at AT TIME ZONE 'America/Chicago')::date AS d
    FROM public.announcement_rewards ar
    WHERE ar.user_id = p_user_id
      AND (ar.claimed_at AT TIME ZONE 'America/Chicago')::date >= v_start
      AND (ar.claimed_at AT TIME ZONE 'America/Chicago')::date < v_end
  ) sub;

  FOR v_m IN
    SELECT * FROM public.compute_streak_milestones(v_claimed_dates, v_ann_dates)
  LOOP
    v_category := v_m.milestone_key || ':' || v_month_key;

    SELECT ar.claimed_at
    INTO v_created_at
    FROM public.announcement_rewards ar
    WHERE ar.user_id = p_user_id
      AND (ar.claimed_at AT TIME ZONE 'America/Chicago')::date = v_m.completion_date
    ORDER BY ar.claimed_at DESC
    LIMIT 1;

    IF v_created_at IS NULL THEN
      RAISE EXCEPTION 'sync_streak_bonuses_for_user: no claim_at for completion_date %', v_m.completion_date;
    END IF;

    INSERT INTO public.point_transactions (
      user_id, amount, source, reference_table, counts_toward_raffle, category, created_at
    )
    VALUES (
      p_user_id,
      v_m.bonus_amount,
      'streak_bonus',
      'announcement_streak',
      true,
      v_category,
      v_created_at
    )
    ON CONFLICT (user_id, source, category)
      WHERE source = 'streak_bonus'
    DO NOTHING;
  END LOOP;
END;
$$;


ALTER FUNCTION public.sync_streak_bonuses_for_user(p_user_id uuid, p_anchor_claimed_at timestamp with time zone) OWNER TO postgres;

--
-- Name: trg_sync_streak_bonus_to_ledger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trg_sync_streak_bonus_to_ledger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.sync_streak_bonuses_for_user(NEW.user_id, NEW.claimed_at);
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trg_sync_streak_bonus_to_ledger() OWNER TO postgres;

--
-- Name: trigger_safety_announcement(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_safety_announcement() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION public.trigger_safety_announcement() OWNER TO postgres;

--
-- Name: update_crews_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_crews_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_crews_updated_at() OWNER TO postgres;

--
-- Name: update_expired_certifications(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_expired_certifications() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.certification_records
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < now();
END;
$$;


ALTER FUNCTION public.update_expired_certifications() OWNER TO postgres;

--
-- Name: FUNCTION update_expired_certifications(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_expired_certifications() IS 'Marks active certs past expires_at as expired. Run daily via pg_cron.';


--
-- Name: update_job_progress_trackers_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_job_progress_trackers_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_job_progress_trackers_updated_at() OWNER TO postgres;

--
-- Name: FUNCTION update_job_progress_trackers_updated_at(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_job_progress_trackers_updated_at() IS 'Auto-updates updated_at column on job_progress_trackers table. Uses SET search_path for security.';


--
-- Name: update_maintenance_schedule_on_log(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_maintenance_schedule_on_log() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Upsert the schedule for this truck
  INSERT INTO public.maintenance_schedules (truck_number)
  VALUES (NEW.truck_number)
  ON CONFLICT (truck_number) DO NOTHING;
  
  -- Update the appropriate last service fields based on maintenance type
  IF NEW.maintenance_type = 'oil_change' THEN
    UPDATE public.maintenance_schedules
    SET 
      last_oil_change_mileage = NEW.mileage_at_service,
      last_oil_change_date = NEW.service_date,
      current_mileage = GREATEST(COALESCE(current_mileage, 0), NEW.mileage_at_service),
      current_mileage_date = now(),
      ai_summary = NULL, -- Invalidate cached summary
      updated_at = now()
    WHERE truck_number = NEW.truck_number;
    
  ELSIF NEW.maintenance_type = 'tire_rotation' THEN
    UPDATE public.maintenance_schedules
    SET 
      last_tire_rotation_mileage = NEW.mileage_at_service,
      last_tire_rotation_date = NEW.service_date,
      current_mileage = GREATEST(COALESCE(current_mileage, 0), NEW.mileage_at_service),
      current_mileage_date = now(),
      ai_summary = NULL,
      updated_at = now()
    WHERE truck_number = NEW.truck_number;
    
  ELSIF NEW.maintenance_type = 'tire_replacement' THEN
    UPDATE public.maintenance_schedules
    SET 
      last_tire_replacement_mileage = NEW.mileage_at_service,
      last_tire_replacement_date = NEW.service_date,
      current_mileage = GREATEST(COALESCE(current_mileage, 0), NEW.mileage_at_service),
      current_mileage_date = now(),
      ai_summary = NULL,
      updated_at = now()
    WHERE truck_number = NEW.truck_number;
    
  ELSE
    -- For other maintenance types, just update current mileage
    UPDATE public.maintenance_schedules
    SET 
      current_mileage = GREATEST(COALESCE(current_mileage, 0), NEW.mileage_at_service),
      current_mileage_date = now(),
      ai_summary = NULL,
      updated_at = now()
    WHERE truck_number = NEW.truck_number;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_maintenance_schedule_on_log() OWNER TO postgres;

--
-- Name: update_my_avatar_url(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_my_avatar_url(p_path text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  update public.app_users
  set avatar_url = p_path
  where user_id = auth.uid();
$$;


ALTER FUNCTION public.update_my_avatar_url(p_path text) OWNER TO postgres;

--
-- Name: FUNCTION update_my_avatar_url(p_path text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_my_avatar_url(p_path text) IS 'Allows authenticated users to set or clear their own avatar_url. Used by profile avatar upload/remove.';


--
-- Name: update_my_preferred_language(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_my_preferred_language(p_lang text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.app_users
  SET preferred_language = p_lang
  WHERE user_id = auth.uid()
  AND p_lang IN ('en', 'es');
$$;


ALTER FUNCTION public.update_my_preferred_language(p_lang text) OWNER TO postgres;

--
-- Name: FUNCTION update_my_preferred_language(p_lang text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_my_preferred_language(p_lang text) IS 'Allows authenticated users to set their preferred language (en or es).';


--
-- Name: update_notification_preferences_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_notification_preferences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_notification_preferences_updated_at() OWNER TO postgres;

--
-- Name: update_safety_announcements_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_safety_announcements_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_safety_announcements_updated_at() OWNER TO postgres;

--
-- Name: update_schedule_mileage_from_dvir(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_schedule_mileage_from_dvir() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only proceed if truck_number and mileage are set
  IF NEW.truck_number IS NOT NULL AND NEW.mileage IS NOT NULL THEN
    -- Upsert the schedule for this truck
    INSERT INTO public.maintenance_schedules (
      truck_number, 
      current_mileage, 
      current_mileage_date
    )
    VALUES (
      UPPER(TRIM(NEW.truck_number)), 
      NEW.mileage, 
      now()
    )
    ON CONFLICT (truck_number) DO UPDATE SET
      current_mileage = CASE 
        WHEN NEW.mileage > COALESCE(maintenance_schedules.current_mileage, 0) 
        THEN NEW.mileage 
        ELSE maintenance_schedules.current_mileage 
      END,
      current_mileage_date = CASE 
        WHEN NEW.mileage > COALESCE(maintenance_schedules.current_mileage, 0) 
        THEN now() 
        ELSE maintenance_schedules.current_mileage_date 
      END,
      ai_summary = CASE 
        WHEN NEW.mileage > COALESCE(maintenance_schedules.current_mileage, 0) 
        THEN NULL -- Invalidate cache on mileage update
        ELSE maintenance_schedules.ai_summary 
      END,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_schedule_mileage_from_dvir() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: FUNCTION update_updated_at_column(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.update_updated_at_column() IS 'Generic trigger function to auto-update the updated_at column on row modification. Reusable across all tables.';


--
-- Name: update_user_activity_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_user_activity_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_user_activity_updated_at() OWNER TO postgres;

--
-- Name: update_work_sites_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_work_sites_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_work_sites_updated_at() OWNER TO postgres;

--
-- Name: user_has_certification_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.user_has_certification_access(p_user_id uuid, p_certification_type_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_allow_all BOOLEAN;
  v_has_user_grant BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_certification_type_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  SELECT COALESCE(ct.allow_all_users, false) INTO v_allow_all
  FROM public.certification_types ct
  WHERE ct.id = p_certification_type_id AND ct.is_active = true;

  IF v_allow_all THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.certification_access_grants
    WHERE certification_type_id = p_certification_type_id
      AND user_id = p_user_id
  ) INTO v_has_user_grant;

  RETURN v_has_user_grant;
END;
$$;


ALTER FUNCTION public.user_has_certification_access(p_user_id uuid, p_certification_type_id uuid) OWNER TO postgres;

--
-- Name: FUNCTION user_has_certification_access(p_user_id uuid, p_certification_type_id uuid); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.user_has_certification_access(p_user_id uuid, p_certification_type_id uuid) IS 'True if user may access this certification (test + study guide). Admins always; others only if allow_all_users or has a grant.';


--
-- Name: validate_recordable_incident(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_recordable_incident() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.severity IN ('recordable', 'lost_time', 'fatality') THEN
    IF NEW.body_parts_affected IS NULL OR array_length(NEW.body_parts_affected, 1) IS NULL OR array_length(NEW.body_parts_affected, 1) < 1 THEN
      RAISE EXCEPTION 'OSHA 300: At least one body part affected is required for recordable incidents.'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.what_doing_before IS NULL OR trim(NEW.what_doing_before) = '' THEN
      RAISE EXCEPTION 'OSHA 301: "What was employee doing before incident" is required for recordable incidents.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_recordable_incident() OWNER TO postgres;

--
-- Name: FUNCTION validate_recordable_incident(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.validate_recordable_incident() IS 'Enforces OSHA 300/301: recordable incidents must have body_parts_affected and what_doing_before.';


--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


ALTER TABLE auth.custom_oauth_providers OWNER TO supabase_auth_admin;

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


ALTER TABLE auth.webauthn_challenges OWNER TO supabase_auth_admin;

--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


ALTER TABLE auth.webauthn_credentials OWNER TO supabase_auth_admin;

--
-- Name: algorithm_tuning_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.algorithm_tuning_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_version character varying(10) NOT NULL,
    previous_version character varying(10),
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    days_elapsed integer DEFAULT 0,
    total_predictions integer DEFAULT 0,
    true_positives integer DEFAULT 0,
    false_positives integer DEFAULT 0,
    false_negatives integer DEFAULT 0,
    true_negatives integer DEFAULT 0,
    current_accuracy numeric(5,2),
    baseline_accuracy numeric(5,2),
    improvement_delta numeric(5,2),
    status text DEFAULT 'running'::text,
    decision_reason text,
    auto_approved boolean DEFAULT false,
    triggered_by text DEFAULT 'scheduled'::text,
    CONSTRAINT algorithm_tuning_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text, 'rolled_back'::text, 'failed'::text]))),
    CONSTRAINT algorithm_tuning_runs_triggered_by_check CHECK ((triggered_by = ANY (ARRAY['auto'::text, 'manual'::text, 'scheduled'::text])))
);


ALTER TABLE public.algorithm_tuning_runs OWNER TO postgres;

--
-- Name: TABLE algorithm_tuning_runs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.algorithm_tuning_runs IS 'Audit trail for each auto-tuning execution cycle';


--
-- Name: announcement_metadata; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcement_metadata (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    last_sync timestamp with time zone DEFAULT now(),
    total_count integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.announcement_metadata OWNER TO postgres;

--
-- Name: TABLE announcement_metadata; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.announcement_metadata IS 'Tracks sync status for external announcement sources (e.g., Make.com webhooks).';


--
-- Name: announcement_rewards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcement_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    announcement_id uuid NOT NULL,
    points_awarded integer DEFAULT 1 NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.announcement_rewards OWNER TO postgres;

--
-- Name: TABLE announcement_rewards; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.announcement_rewards IS 'Tracks user reward claims for Safety AI-generated announcements';


--
-- Name: COLUMN announcement_rewards.points_awarded; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.announcement_rewards.points_awarded IS 'Points awarded for this claim (default 1)';


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    author text,
    date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    synced_at timestamp with time zone DEFAULT now(),
    content text DEFAULT ''::text NOT NULL,
    raw_data jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    title_es text,
    message_es text
);


ALTER TABLE public.announcements OWNER TO postgres;

--
-- Name: TABLE announcements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.announcements IS 'Company announcements synced from external sources and displayed on the dashboard. Contains both content (long) and message (short) fields for flexibility.';


--
-- Name: COLUMN announcements.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.announcements.updated_at IS 'Timestamp of last update, automatically maintained by trigger';


--
-- Name: COLUMN announcements.title_es; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.announcements.title_es IS 'Spanish title for announcements; used when user preferred_language is es';


--
-- Name: COLUMN announcements.message_es; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.announcements.message_es IS 'Spanish message body; used when user preferred_language is es';


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: app_settings_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings_audit (
    id bigint NOT NULL,
    key text NOT NULL,
    old_value jsonb NOT NULL,
    new_value jsonb NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    changed_by uuid
);


ALTER TABLE public.app_settings_audit OWNER TO postgres;

--
-- Name: app_settings_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.app_settings_audit ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.app_settings_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: daily_equipment_inspections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_equipment_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    equipment_type text NOT NULL,
    equipment_number text NOT NULL,
    inspection_date date NOT NULL,
    template text,
    notes text,
    general_checklist jsonb,
    specific_checklist jsonb,
    overview_photo_path text,
    damage_photo_path text,
    attachments_photo_path text,
    hydraulic_photo_path text NOT NULL,
    submitted_by text,
    mechanic_fixes text,
    last_mechanic_updated_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    mechanic_cost numeric,
    mechanic_parts_used jsonb DEFAULT '[]'::jsonb,
    additional_photo_paths text[],
    loto_required boolean DEFAULT false,
    loto_data jsonb,
    CONSTRAINT equipment_mechanic_cost_positive CHECK (((mechanic_cost IS NULL) OR (mechanic_cost >= (0)::numeric))),
    CONSTRAINT equipment_parts_used_is_array CHECK (((mechanic_parts_used IS NULL) OR (jsonb_typeof(mechanic_parts_used) = 'array'::text))),
    CONSTRAINT general_checklist_is_object CHECK (((general_checklist IS NULL) OR (jsonb_typeof(general_checklist) = 'object'::text))),
    CONSTRAINT specific_checklist_is_object CHECK (((specific_checklist IS NULL) OR (jsonb_typeof(specific_checklist) = 'object'::text)))
);


ALTER TABLE public.daily_equipment_inspections OWNER TO postgres;

--
-- Name: TABLE daily_equipment_inspections; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.daily_equipment_inspections IS 'Stores daily equipment inspection submissions, including checklist payloads and Supabase Storage paths.';


--
-- Name: COLUMN daily_equipment_inspections.mechanic_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_equipment_inspections.mechanic_cost IS 'Cost of repairs/parts used to fix issues in this inspection';


--
-- Name: COLUMN daily_equipment_inspections.mechanic_parts_used; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_equipment_inspections.mechanic_parts_used IS 'Array of parts used: [{part_name, quantity, part_number, cost}]';


--
-- Name: COLUMN daily_equipment_inspections.additional_photo_paths; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_equipment_inspections.additional_photo_paths IS 'Optional array of storage paths for extra photos (Phase 2 batch upload).';


--
-- Name: COLUMN daily_equipment_inspections.loto_required; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_equipment_inspections.loto_required IS 'True when any checklist item is Fail and equipment type requires LOTO.';


--
-- Name: COLUMN daily_equipment_inspections.loto_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_equipment_inspections.loto_data IS 'LOTO procedure data (who, when, locks applied, etc.).';


--
-- Name: dvir_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dvir_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    truck_number text NOT NULL,
    mileage numeric NOT NULL,
    chipper_number text,
    trailer_number text,
    truck_gvwr text,
    trailer_chipper_gvwr text,
    medical_card_required text,
    drivers_name text NOT NULL,
    drivers_license_number text,
    drivers_license_class text,
    drivers_license_exp text,
    drivers_license_required text,
    has_medical_card text,
    medical_card_exp text,
    copy_of_registration text,
    copy_of_insurance text,
    vehicle_trailer_checklist jsonb,
    notes text,
    aerial_checklist jsonb,
    aerial_notes text,
    final_driver_signature text,
    general_foreman_signature text,
    mechanic_truck_number text,
    mechanic_date text,
    deficiency_corrected text,
    mechanic_remarks text,
    mechanic_signature text,
    driver_approval_signature text,
    oil_dipstick_path text NOT NULL,
    tire_photo_path text,
    coolant_photo_path text,
    damage_photo_path text,
    detail_clean_truck_photo_path text,
    updated_at timestamp with time zone DEFAULT now(),
    report_date date,
    mechanic_cost numeric,
    mechanic_parts_used jsonb DEFAULT '[]'::jsonb,
    inspection_type text DEFAULT 'pre_trip'::text,
    defect_corrections jsonb,
    CONSTRAINT dvir_mechanic_cost_positive CHECK (((mechanic_cost IS NULL) OR (mechanic_cost >= (0)::numeric))),
    CONSTRAINT dvir_parts_used_is_array CHECK (((mechanic_parts_used IS NULL) OR (jsonb_typeof(mechanic_parts_used) = 'array'::text))),
    CONSTRAINT dvir_reports_inspection_type_check CHECK ((inspection_type = ANY (ARRAY['pre_trip'::text, 'post_trip'::text])))
);


ALTER TABLE public.dvir_reports OWNER TO postgres;

--
-- Name: COLUMN dvir_reports.report_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dvir_reports.report_date IS 'The date of the DVIR report in America/Chicago timezone. Used for compliance queries.';


--
-- Name: COLUMN dvir_reports.mechanic_cost; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dvir_reports.mechanic_cost IS 'Cost of repairs/parts used to fix deficiencies in this DVIR';


--
-- Name: COLUMN dvir_reports.mechanic_parts_used; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dvir_reports.mechanic_parts_used IS 'Array of parts used: [{part_name, quantity, part_number, cost}]';


--
-- Name: COLUMN dvir_reports.inspection_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dvir_reports.inspection_type IS 'Pre-trip (default) or post-trip vehicle inspection.';


--
-- Name: COLUMN dvir_reports.defect_corrections; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dvir_reports.defect_corrections IS 'Map of checklist item id to corrected | need_not_be_corrected.';


--
-- Name: vehicle_maintenance_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicle_maintenance_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    truck_number text NOT NULL,
    maintenance_type text NOT NULL,
    description text NOT NULL,
    parts_used jsonb DEFAULT '[]'::jsonb,
    mileage_at_service numeric NOT NULL,
    next_service_due_mileage numeric,
    cost numeric,
    performed_by_user_id uuid,
    performed_by_name text NOT NULL,
    approved_by text,
    service_date date DEFAULT CURRENT_DATE NOT NULL,
    notes text,
    attachments jsonb DEFAULT '[]'::jsonb,
    warranty_info jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attachments_is_array CHECK (((attachments IS NULL) OR (jsonb_typeof(attachments) = 'array'::text))),
    CONSTRAINT cost_positive CHECK (((cost IS NULL) OR (cost >= (0)::numeric))),
    CONSTRAINT mileage_positive CHECK ((mileage_at_service >= (0)::numeric)),
    CONSTRAINT parts_used_is_array CHECK (((parts_used IS NULL) OR (jsonb_typeof(parts_used) = 'array'::text))),
    CONSTRAINT vehicle_maintenance_log_maintenance_type_check CHECK ((maintenance_type = ANY (ARRAY['oil_change'::text, 'tire_rotation'::text, 'tire_replacement'::text, 'repair'::text, 'upgrade'::text, 'part_replacement'::text, 'inspection'::text, 'other'::text])))
);


ALTER TABLE public.vehicle_maintenance_log OWNER TO postgres;

--
-- Name: TABLE vehicle_maintenance_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.vehicle_maintenance_log IS 'Tracks all maintenance activities including repairs, parts replacements, and upgrades per vehicle.';


--
-- Name: unified_fix_costs; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.unified_fix_costs WITH (security_invoker='true') AS
 SELECT 'repairs_log'::text AS source,
    vehicle_maintenance_log.id AS source_id,
    vehicle_maintenance_log.truck_number AS asset_number,
    'truck'::text AS asset_type,
    vehicle_maintenance_log.maintenance_type AS fix_type,
    vehicle_maintenance_log.description,
    vehicle_maintenance_log.cost AS recorded_cost,
    vehicle_maintenance_log.parts_used,
    vehicle_maintenance_log.service_date AS fix_date,
    vehicle_maintenance_log.performed_by_name AS performed_by,
    vehicle_maintenance_log.mileage_at_service AS mileage,
    vehicle_maintenance_log.created_at
   FROM public.vehicle_maintenance_log
UNION ALL
 SELECT 'dvir'::text AS source,
    dvir_reports.id AS source_id,
    COALESCE(dvir_reports.truck_number, dvir_reports.mechanic_truck_number) AS asset_number,
    'truck'::text AS asset_type,
    'dvir_fix'::text AS fix_type,
    dvir_reports.deficiency_corrected AS description,
    dvir_reports.mechanic_cost AS recorded_cost,
    dvir_reports.mechanic_parts_used AS parts_used,
    COALESCE((dvir_reports.mechanic_date)::date, (dvir_reports.created_at)::date) AS fix_date,
    NULL::text AS performed_by,
    dvir_reports.mileage,
    dvir_reports.created_at
   FROM public.dvir_reports
  WHERE ((dvir_reports.deficiency_corrected IS NOT NULL) AND (dvir_reports.deficiency_corrected <> ''::text))
UNION ALL
 SELECT 'equipment'::text AS source,
    daily_equipment_inspections.id AS source_id,
    daily_equipment_inspections.equipment_number AS asset_number,
        CASE
            WHEN (lower(daily_equipment_inspections.equipment_type) ~~ '%chipper%'::text) THEN 'chipper'::text
            WHEN (lower(daily_equipment_inspections.equipment_type) ~~ '%trailer%'::text) THEN 'trailer'::text
            ELSE 'equipment'::text
        END AS asset_type,
    'equipment_fix'::text AS fix_type,
    daily_equipment_inspections.mechanic_fixes AS description,
    daily_equipment_inspections.mechanic_cost AS recorded_cost,
    daily_equipment_inspections.mechanic_parts_used AS parts_used,
    COALESCE((daily_equipment_inspections.last_mechanic_updated_at)::date, daily_equipment_inspections.inspection_date) AS fix_date,
    NULL::text AS performed_by,
    NULL::numeric AS mileage,
    daily_equipment_inspections.created_at
   FROM public.daily_equipment_inspections
  WHERE ((daily_equipment_inspections.mechanic_fixes IS NOT NULL) AND (daily_equipment_inspections.mechanic_fixes <> ''::text));


ALTER VIEW public.unified_fix_costs OWNER TO postgres;

--
-- Name: VIEW unified_fix_costs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.unified_fix_costs IS 'Unified view of fixes with costs. SECURITY INVOKER.';


--
-- Name: asset_cost_summary; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.asset_cost_summary AS
 SELECT asset_number,
    asset_type,
    count(*) AS total_fixes,
    sum(COALESCE(recorded_cost, (100)::numeric)) AS total_estimated_cost,
    sum(recorded_cost) AS total_recorded_cost,
    max(fix_date) AS last_fix_date,
    min(fix_date) AS first_fix_date,
    jsonb_agg(DISTINCT fix_type) AS fix_types
   FROM public.unified_fix_costs
  WHERE ((asset_number IS NOT NULL) AND (asset_number <> ''::text))
  GROUP BY asset_number, asset_type
  ORDER BY (sum(COALESCE(recorded_cost, (100)::numeric))) DESC NULLS LAST
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.asset_cost_summary OWNER TO postgres;

--
-- Name: attendance_summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    summary text NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.attendance_summaries OWNER TO postgres;

--
-- Name: TABLE attendance_summaries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.attendance_summaries IS 'Cache for AI-generated attendance summaries. Keyed by date range, 24h TTL enforced by Edge Function.';


--
-- Name: auto_tuning_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auto_tuning_config (
    id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    enabled boolean DEFAULT true,
    min_accuracy_threshold numeric(5,2) DEFAULT 75.00,
    rollback_threshold numeric(5,2) DEFAULT 10.00,
    max_multiplier_increase numeric(3,2) DEFAULT 0.30,
    max_multiplier_decrease numeric(3,2) DEFAULT 0.30,
    max_adjustments_per_run integer DEFAULT 3,
    evaluation_period_days integer DEFAULT 30,
    min_sample_size integer DEFAULT 20,
    rollback_evaluation_days integer DEFAULT 7,
    last_updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enforce_singleton CHECK ((id = '00000000-0000-0000-0000-000000000001'::uuid))
);


ALTER TABLE public.auto_tuning_config OWNER TO postgres;

--
-- Name: TABLE auto_tuning_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.auto_tuning_config IS 'Singleton configuration for the auto-tuning system';


--
-- Name: certification_access_grants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.certification_access_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    certification_type_id uuid NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.certification_access_grants OWNER TO postgres;

--
-- Name: TABLE certification_access_grants; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.certification_access_grants IS 'Grants access to a certification test and study guide. No rows for a cert = open to all; any row = restricted to grantees and admins.';


--
-- Name: certification_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.certification_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    certification_type_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    submitted_at timestamp with time zone,
    status text DEFAULT 'in_progress'::text NOT NULL,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_questions integer,
    correct_answers integer,
    total_points integer,
    earned_points integer,
    score_percentage numeric(5,2),
    passed boolean,
    time_spent_seconds integer,
    graded_by uuid,
    graded_at timestamp with time zone,
    grading_started_at timestamp with time zone,
    grading_started_by uuid,
    last_escalated_at timestamp with time zone,
    CONSTRAINT certification_attempts_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'graded'::text, 'abandoned'::text])))
);


ALTER TABLE public.certification_attempts OWNER TO postgres;

--
-- Name: TABLE certification_attempts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.certification_attempts IS 'One row per test attempt. Grading only via submit_certification_test RPC.';


--
-- Name: COLUMN certification_attempts.answers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_attempts.answers IS 'Graded shape: [{question_id, user_answer, correct_answer, is_correct, points}]. Filled on submit.';


--
-- Name: COLUMN certification_attempts.grading_started_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_attempts.grading_started_at IS 'When an admin opened this attempt for grading; cleared on submit or unmount.';


--
-- Name: COLUMN certification_attempts.grading_started_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_attempts.grading_started_by IS 'Admin (auth.users.id) who opened this attempt for grading.';


--
-- Name: COLUMN certification_attempts.last_escalated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_attempts.last_escalated_at IS 'When this attempt was last included in an admin escalation. Only re-escalate if null or older than 24h.';


--
-- Name: certification_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.certification_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    record_id uuid,
    old_value jsonb,
    new_value jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.certification_audit_log OWNER TO postgres;

--
-- Name: TABLE certification_audit_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.certification_audit_log IS 'Audit trail for certification grading, qualification level changes, and cert type access grant/revoke.';


--
-- Name: COLUMN certification_audit_log.actor_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_audit_log.actor_id IS 'User (auth.users.id) who performed the action.';


--
-- Name: COLUMN certification_audit_log.action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_audit_log.action IS 'Action type: grade_submission, qualification_level_change, cert_access_grant, cert_access_revoke.';


--
-- Name: COLUMN certification_audit_log.record_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_audit_log.record_id IS 'Target record (e.g. attempt id, grant id, user_id for qualification).';


--
-- Name: certification_completion_stats; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.certification_completion_stats AS
 SELECT ct.id AS certification_type_id,
    ct.name AS certification_name,
    count(DISTINCT ca.user_id) FILTER (WHERE (ca.status = 'graded'::text)) AS total_attempts,
    count(DISTINCT ca.user_id) FILTER (WHERE ((ca.status = 'graded'::text) AND ca.passed)) AS passed_users,
    round(avg(ca.score_percentage) FILTER (WHERE ((ca.status = 'graded'::text) AND ca.passed)), 2) AS avg_passing_score,
    round(avg(ca.attempt_number) FILTER (WHERE ((ca.status = 'graded'::text) AND ca.passed)), 2) AS avg_attempts_to_pass
   FROM (public.certification_types ct
     LEFT JOIN public.certification_attempts ca ON ((ct.id = ca.certification_type_id)))
  WHERE (ct.is_active = true)
  GROUP BY ct.id, ct.name
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.certification_completion_stats OWNER TO postgres;

--
-- Name: MATERIALIZED VIEW certification_completion_stats; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON MATERIALIZED VIEW public.certification_completion_stats IS 'Per-cert completion stats. Refresh daily for admin dashboard.';


--
-- Name: certification_expiration_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.certification_expiration_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    certification_record_id uuid,
    notification_type text NOT NULL,
    scheduled_for timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    external_certification_id uuid,
    CONSTRAINT certification_expiration_notifications_notification_type_check CHECK (((notification_type = 'expired'::text) OR (notification_type ~ '^\d+_day$'::text))),
    CONSTRAINT chk_exactly_one_cert_ref CHECK ((((certification_record_id IS NOT NULL) AND (external_certification_id IS NULL)) OR ((certification_record_id IS NULL) AND (external_certification_id IS NOT NULL))))
);


ALTER TABLE public.certification_expiration_notifications OWNER TO postgres;

--
-- Name: TABLE certification_expiration_notifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.certification_expiration_notifications IS 'Idempotent log of expiration reminders. Cron creates notification_events and marks sent here.';


--
-- Name: COLUMN certification_expiration_notifications.external_certification_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.certification_expiration_notifications.external_certification_id IS 'Set for external cert expiry reminders; certification_record_id set for built-in certs. Exactly one must be set.';


--
-- Name: certification_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.certification_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    certification_type_id uuid NOT NULL,
    question_number integer NOT NULL,
    question_text text NOT NULL,
    question_type text NOT NULL,
    options jsonb,
    correct_answer text NOT NULL,
    points integer DEFAULT 1,
    category text,
    difficulty text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT certification_questions_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]))),
    CONSTRAINT certification_questions_question_type_check CHECK ((question_type = ANY (ARRAY['multiple_choice'::text, 'true_false'::text, 'short_answer'::text])))
);


ALTER TABLE public.certification_questions OWNER TO postgres;

--
-- Name: TABLE certification_questions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.certification_questions IS 'Question bank per certification. Access only via RPCs (no direct SELECT) to avoid answer leakage.';


--
-- Name: company_calendar; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.company_calendar (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    type text NOT NULL,
    label text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT company_calendar_type_check CHECK ((type = ANY (ARRAY['holiday'::text, 'weather_day'::text, 'company_day_off'::text])))
);


ALTER TABLE public.company_calendar OWNER TO postgres;

--
-- Name: TABLE company_calendar; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.company_calendar IS 'Company-wide days off; suppresses safety briefing reminders and escalation for that date.';


--
-- Name: compliance_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date_for date NOT NULL,
    user_id uuid NOT NULL,
    notification_type text NOT NULL,
    sent_to text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    webhook_response jsonb,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_notifications_notification_type_check CHECK ((notification_type = ANY (ARRAY['missing_dvir'::text, 'missing_equipment'::text, 'missing_both'::text]))),
    CONSTRAINT compliance_notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


ALTER TABLE public.compliance_notifications OWNER TO postgres;

--
-- Name: TABLE compliance_notifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.compliance_notifications IS 'Log of compliance notifications sent to users. Unique constraint prevents duplicates.';


--
-- Name: compliance_rewards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date_for date NOT NULL,
    forms_completed text[] NOT NULL,
    points_awarded integer DEFAULT 5 NOT NULL,
    points_config jsonb DEFAULT '{"partial": 2, "streak_bonus": 10, "full_compliance": 5}'::jsonb,
    awarded_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.compliance_rewards OWNER TO postgres;

--
-- Name: TABLE compliance_rewards; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.compliance_rewards IS 'Gamified compliance points awarded for daily form completion. Part of the Safety Points system.';


--
-- Name: COLUMN compliance_rewards.forms_completed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.compliance_rewards.forms_completed IS 'Array of form types completed: dvir, equipment, jsa';


--
-- Name: COLUMN compliance_rewards.points_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.compliance_rewards.points_config IS 'Configurable point values for A/B testing: full_compliance (5), partial (2), streak_bonus (10)';


--
-- Name: compliance_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.compliance_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_type text DEFAULT 'dvir_equipment_9am'::text NOT NULL,
    date_for date NOT NULL,
    cutoff_time timestamp with time zone NOT NULL,
    timezone text DEFAULT 'America/Chicago'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    required_user_count integer,
    missing_dvir_count integer,
    missing_equipment_count integer,
    missing_both_count integer,
    webhooks_sent integer DEFAULT 0 NOT NULL,
    webhooks_skipped integer DEFAULT 0 NOT NULL,
    dry_run boolean DEFAULT false NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT compliance_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'failed'::text])))
);


ALTER TABLE public.compliance_runs OWNER TO postgres;

--
-- Name: TABLE compliance_runs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.compliance_runs IS 'Audit log of compliance check executions. One row per scheduled or manual run.';


--
-- Name: daily_jsa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_jsa (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    job_date date NOT NULL,
    call_in_time text,
    call_out_time text,
    work_location text NOT NULL,
    circuit_number text,
    nearest_hospital text,
    nearest_clinic text,
    oc_contact text,
    doc_contact text,
    gf_contact text,
    safety_contact text,
    jobs_performed jsonb DEFAULT '[]'::jsonb NOT NULL,
    ppe jsonb DEFAULT '{}'::jsonb NOT NULL,
    weather_conditions jsonb DEFAULT '{}'::jsonb NOT NULL,
    weather_hazards text,
    hazards_present jsonb DEFAULT '{}'::jsonb NOT NULL,
    traffic_hazards jsonb DEFAULT '{}'::jsonb NOT NULL,
    traffic_setup jsonb DEFAULT '{}'::jsonb NOT NULL,
    spans jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    employee_signature text,
    status text DEFAULT 'draft'::text NOT NULL,
    status_changed_at timestamp with time zone,
    completed_at timestamp with time zone,
    status_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    observer_signatures jsonb DEFAULT '[]'::jsonb,
    shared_with_users jsonb DEFAULT '[]'::jsonb,
    jsa_type text DEFAULT 'daily'::text NOT NULL,
    tree_felling_data jsonb,
    employee_signature_path text,
    jsa_photo_paths text[] DEFAULT '{}'::text[],
    submission_type text DEFAULT 'digital'::text NOT NULL,
    electrical_hazard_data jsonb,
    CONSTRAINT check_jsa_type CHECK ((jsa_type = ANY (ARRAY['daily'::text, 'tree_felling'::text]))),
    CONSTRAINT daily_jsa_submission_type_check CHECK ((submission_type = ANY (ARRAY['digital'::text, 'paper'::text])))
);


ALTER TABLE public.daily_jsa OWNER TO postgres;

--
-- Name: COLUMN daily_jsa.observer_signatures; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_jsa.observer_signatures IS 'Array of observer signatures: [{name: string, signature_data: string, timestamp: string, role?: string}]. Used for crew leads, foremen, and safety officers to co-sign JSAs for compliance tracking and multi-level approval workflows.';


--
-- Name: COLUMN daily_jsa.shared_with_users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_jsa.shared_with_users IS 'Array of user objects who have delegated access to view/edit this JSA: [{id: uuid, email: string, full_name: string, role: string, added_at: timestamp, added_by: uuid}]. Only the original creator (user_id) can modify this field.';


--
-- Name: COLUMN daily_jsa.jsa_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_jsa.jsa_type IS 'Type of JSA: daily (standard) or tree_felling (specialized tree work).';


--
-- Name: COLUMN daily_jsa.tree_felling_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_jsa.tree_felling_data IS 'Tree felling-specific data (JSONB). Only populated when jsa_type = tree_felling.';


--
-- Name: COLUMN daily_jsa.employee_signature_path; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_jsa.employee_signature_path IS 'Storage path for canvas signature image (signatures/{userId}/jsa/{timestamp}.png). When set, display image; else use employee_signature text.';


--
-- Name: COLUMN daily_jsa.jsa_photo_paths; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_jsa.jsa_photo_paths IS 'Storage paths for uploaded paper JSA form images in the jsa-photos bucket. Path format: {userId}/{timestamp}-page{n}.jpg. Supports up to 5 images per JSA.';


--
-- Name: COLUMN daily_jsa.submission_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_jsa.submission_type IS 'How the JSA was submitted: digital (full form) or paper (photo upload only).';


--
-- Name: COLUMN daily_jsa.electrical_hazard_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.daily_jsa.electrical_hazard_data IS 'OSHA 1910.269 electrical safety data. Required when electrical hazards identified.';


--
-- Name: compliance_summary_90d; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.compliance_summary_90d AS
 SELECT (d)::date AS date,
    ( SELECT count(*) AS count
           FROM public.dvir_reports
          WHERE (dvir_reports.report_date = (d.d)::date)) AS dvir_count,
    ( SELECT count(DISTINCT dvir_reports.user_id) AS count
           FROM public.dvir_reports
          WHERE (dvir_reports.report_date = (d.d)::date)) AS dvir_users,
    ( SELECT count(*) AS count
           FROM public.daily_equipment_inspections
          WHERE (daily_equipment_inspections.inspection_date = (d.d)::date)) AS equipment_count,
    ( SELECT count(DISTINCT daily_equipment_inspections.user_id) AS count
           FROM public.daily_equipment_inspections
          WHERE (daily_equipment_inspections.inspection_date = (d.d)::date)) AS equipment_users,
    ( SELECT count(*) AS count
           FROM public.daily_jsa
          WHERE (daily_jsa.job_date = (d.d)::date)) AS jsa_count,
    ( SELECT count(DISTINCT daily_jsa.user_id) AS count
           FROM public.daily_jsa
          WHERE (daily_jsa.job_date = (d.d)::date)) AS jsa_users
   FROM generate_series((CURRENT_DATE - '90 days'::interval), (CURRENT_DATE)::timestamp without time zone, '1 day'::interval) d(d)
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.compliance_summary_90d OWNER TO postgres;

--
-- Name: MATERIALIZED VIEW compliance_summary_90d; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON MATERIALIZED VIEW public.compliance_summary_90d IS 'Precomputed daily DVIR/Equipment/JSA counts for last 90 days. Refresh nightly for fast report.';


--
-- Name: contact_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    email text NOT NULL,
    topic text NOT NULL,
    message text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.contact_requests OWNER TO postgres;

--
-- Name: TABLE contact_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.contact_requests IS 'Inbound messages submitted through the Contact page.';


--
-- Name: corrective_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.corrective_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incident_id uuid,
    description text NOT NULL,
    action_type text NOT NULL,
    assigned_to uuid,
    assigned_by uuid,
    due_date date NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    completed_at timestamp with time zone,
    completion_notes text,
    verified_by uuid,
    verified_at timestamp with time zone,
    verification_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT corrective_actions_action_type_check CHECK ((action_type = ANY (ARRAY['immediate'::text, 'short_term'::text, 'long_term'::text, 'systemic'::text]))),
    CONSTRAINT corrective_actions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'completed'::text, 'verified'::text, 'overdue'::text])))
);


ALTER TABLE public.corrective_actions OWNER TO postgres;

--
-- Name: TABLE corrective_actions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.corrective_actions IS 'CAPA: Corrective and preventive actions linked to safety incidents.';


--
-- Name: crew_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crew_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    crew_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now(),
    added_by uuid
);


ALTER TABLE public.crew_members OWNER TO postgres;

--
-- Name: TABLE crew_members; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.crew_members IS 'Maps users to crews they belong to';


--
-- Name: crews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid
);


ALTER TABLE public.crews OWNER TO postgres;

--
-- Name: TABLE crews; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.crews IS 'Named persistent crews for team management';


--
-- Name: COLUMN crews.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.crews.name IS 'Unique crew name (e.g., Crew A, North Team)';


--
-- Name: COLUMN crews.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.crews.is_active IS 'Soft delete flag - inactive crews are hidden but preserved';


--
-- Name: crew_with_member_count; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.crew_with_member_count WITH (security_invoker='true') AS
 SELECT c.id,
    c.name,
    c.description,
    c.is_active,
    c.created_at,
    c.updated_at,
    c.created_by,
    count(cm.id) AS member_count
   FROM (public.crews c
     LEFT JOIN public.crew_members cm ON ((c.id = cm.crew_id)))
  GROUP BY c.id, c.name, c.description, c.is_active, c.created_at, c.updated_at, c.created_by;


ALTER VIEW public.crew_with_member_count OWNER TO postgres;

--
-- Name: VIEW crew_with_member_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.crew_with_member_count IS 'Crews with member count. SECURITY INVOKER.';


--
-- Name: cron_job_runs; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.cron_job_runs WITH (security_invoker='true') AS
 SELECT j.jobname,
    r.runid,
    r.job_pid,
    r.status,
    r.start_time,
    r.end_time,
    (r.end_time - r.start_time) AS duration,
    r.return_message
   FROM (cron.job j
     JOIN cron.job_run_details r ON ((j.jobid = r.jobid)))
  WHERE (j.jobname = ANY (ARRAY['safety-announcement-5am'::text, 'admin-compliance-9am'::text, 'admin-safety-forecast'::text, 'auto-tune-risk-algorithm'::text, 'check-algorithm-performance'::text, 'safety-briefing-reminder-push'::text, 'safety-briefing-reminder-sms'::text, 'safety-briefing-escalation-sms'::text, 'monthly-compliance-summary'::text, 'weekly-attendance-summary'::text, 'weekly-safety-audit-report'::text, 'payroll-hours-reminder-sms-utc13'::text, 'payroll-hours-reminder-sms-utc14'::text]))
  ORDER BY r.start_time DESC;


ALTER VIEW public.cron_job_runs OWNER TO postgres;

--
-- Name: VIEW cron_job_runs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.cron_job_runs IS 'Monitoring view for HTTP cron jobs (Edge Function invocations). Includes payroll-hours-reminder-sms UTC slots.';


--
-- Name: daily_attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    status text NOT NULL,
    marked_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'ncns'::text, 'rto'::text])))
);


ALTER TABLE public.daily_attendance OWNER TO postgres;

--
-- Name: TABLE daily_attendance; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.daily_attendance IS 'Per-user daily attendance tracked by General Foreman. Syncs non-present statuses to user_absences for SMS suppression.';


--
-- Name: data_retention_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.data_retention_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    date_column text NOT NULL,
    retention_days integer NOT NULL,
    archive_table_name text,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.data_retention_policies OWNER TO postgres;

--
-- Name: TABLE data_retention_policies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.data_retention_policies IS 'Per-table retention rules. safety_incidents: 5 years per OSHA 1904.33.';


--
-- Name: email_recipient_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_recipient_lists (
    list_key public.email_list_key NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_user_id uuid,
    CONSTRAINT email_lowercase CHECK ((email = lower(email))),
    CONSTRAINT valid_email CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text))
);


ALTER TABLE public.email_recipient_lists OWNER TO postgres;

--
-- Name: TABLE email_recipient_lists; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.email_recipient_lists IS 'Admin-managed recipients per automated email list. Used by compliance and safety-forecast crons.';


--
-- Name: email_send_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_send_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_key public.email_list_key NOT NULL,
    recipients text[] NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    error_message text
);


ALTER TABLE public.email_send_log OWNER TO postgres;

--
-- Name: TABLE email_send_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.email_send_log IS 'Audit log of email send attempts (crons).';


--
-- Name: external_certification_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.external_certification_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    category text NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    validity_months integer,
    reminder_days integer[] DEFAULT '{30,14,7}'::integer[],
    created_by uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT external_certification_types_category_check CHECK ((category = ANY (ARRAY['external'::text, 'regulatory'::text, 'industry'::text, 'safety'::text])))
);


ALTER TABLE public.external_certification_types OWNER TO postgres;

--
-- Name: job_crew_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_crew_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    user_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid
);


ALTER TABLE public.job_crew_assignments OWNER TO postgres;

--
-- Name: TABLE job_crew_assignments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_crew_assignments IS 'Maps users to jobs they are assigned to work on';


--
-- Name: job_milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    description text,
    target_date date,
    sort_order integer DEFAULT 0 NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    completed_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.job_milestones OWNER TO postgres;

--
-- Name: TABLE job_milestones; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_milestones IS 'Milestones/checkpoints within a job';


--
-- Name: job_progress_trackers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_progress_trackers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    job_name text NOT NULL,
    job_location text,
    job_description text,
    job_specs text,
    start_date date,
    end_date date,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    tracking_type text DEFAULT 'timeline'::text NOT NULL,
    circuit text,
    estimated_total_spans integer,
    estimated_total_feet numeric(12,2),
    span_progress_metric text DEFAULT 'spans'::text,
    job_group_id uuid,
    work_site_id uuid,
    crew_id uuid,
    CONSTRAINT job_progress_dates_required CHECK (((tracking_type = 'job_progress'::text) OR ((start_date IS NOT NULL) AND (end_date IS NOT NULL)))),
    CONSTRAINT job_progress_trackers_span_progress_metric_check CHECK ((span_progress_metric = ANY (ARRAY['spans'::text, 'feet'::text]))),
    CONSTRAINT job_progress_trackers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text, 'cancelled'::text]))),
    CONSTRAINT job_progress_trackers_tracking_type_check CHECK ((tracking_type = ANY (ARRAY['timeline'::text, 'job_progress'::text])))
);


ALTER TABLE public.job_progress_trackers OWNER TO postgres;

--
-- Name: TABLE job_progress_trackers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_progress_trackers IS 'Tracks job progress with timelines for the employee portal';


--
-- Name: COLUMN job_progress_trackers.job_location; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_progress_trackers.job_location IS 'DEPRECATED: Use circuit column instead';


--
-- Name: COLUMN job_progress_trackers.circuit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_progress_trackers.circuit IS 'Circuit identifier for the job';


--
-- Name: COLUMN job_progress_trackers.estimated_total_spans; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_progress_trackers.estimated_total_spans IS 'Estimated total number of spans for span-based job tracking';


--
-- Name: COLUMN job_progress_trackers.estimated_total_feet; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_progress_trackers.estimated_total_feet IS 'Estimated total feet for span-based job tracking';


--
-- Name: COLUMN job_progress_trackers.span_progress_metric; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_progress_trackers.span_progress_metric IS 'Which metric to use for progress calculation: spans or feet';


--
-- Name: COLUMN job_progress_trackers.job_group_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_progress_trackers.job_group_id IS 'UUID linking related jobs for visual stacking in the UI. Jobs with the same group_id display as stacked cards.';


--
-- Name: COLUMN job_progress_trackers.work_site_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_progress_trackers.work_site_id IS 'Link to work_sites for GPS-based weather forecasting; cleared when site is deleted';


--
-- Name: COLUMN job_progress_trackers.crew_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.job_progress_trackers.crew_id IS 'Crew assigned to this job';


--
-- Name: job_progress_updates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_progress_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    circuit text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    spans_completed integer NOT NULL,
    span_length_feet numeric(10,2) NOT NULL,
    span_length_category text DEFAULT 'general'::text NOT NULL,
    equipment text NOT NULL,
    job_title text NOT NULL,
    total_feet_completed numeric(12,2) GENERATED ALWAYS AS (((spans_completed)::numeric * span_length_feet)) STORED,
    notes text,
    CONSTRAINT job_progress_updates_equipment_check CHECK ((equipment = ANY (ARRAY['jerraff'::text, 'bucket'::text, 'mulcher'::text]))),
    CONSTRAINT job_progress_updates_span_length_category_check CHECK ((span_length_category = 'general'::text)),
    CONSTRAINT job_progress_updates_span_length_feet_check CHECK ((span_length_feet > (0)::numeric)),
    CONSTRAINT job_progress_updates_spans_completed_check CHECK ((spans_completed > 0))
);


ALTER TABLE public.job_progress_updates OWNER TO postgres;

--
-- Name: jsa_sharing_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jsa_sharing_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jsa_id uuid NOT NULL,
    action text NOT NULL,
    shared_user_id uuid NOT NULL,
    shared_user_email text,
    shared_user_name text,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT jsa_sharing_audit_action_check CHECK ((action = ANY (ARRAY['added'::text, 'removed'::text])))
);


ALTER TABLE public.jsa_sharing_audit OWNER TO postgres;

--
-- Name: TABLE jsa_sharing_audit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.jsa_sharing_audit IS 'Audit trail for JSA user delegation changes. Tracks who added/removed users, when, and which JSA. Admin-only access.';


--
-- Name: COLUMN jsa_sharing_audit.jsa_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.jsa_sharing_audit.jsa_id IS 'Reference to the JSA that was modified.';


--
-- Name: COLUMN jsa_sharing_audit.action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.jsa_sharing_audit.action IS 'Action taken: "added" or "removed" a user from delegation.';


--
-- Name: COLUMN jsa_sharing_audit.shared_user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.jsa_sharing_audit.shared_user_id IS 'UUID of the user who was added or removed from delegation.';


--
-- Name: COLUMN jsa_sharing_audit.shared_user_email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.jsa_sharing_audit.shared_user_email IS 'Email of the user at time of change (preserved for audit even if user deleted).';


--
-- Name: COLUMN jsa_sharing_audit.shared_user_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.jsa_sharing_audit.shared_user_name IS 'Full name of the user at time of change (preserved for audit even if user deleted).';


--
-- Name: COLUMN jsa_sharing_audit.changed_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.jsa_sharing_audit.changed_by IS 'UUID of the user who made the change (typically the JSA owner).';


--
-- Name: maintenance_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.maintenance_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    truck_number text NOT NULL,
    last_oil_change_mileage numeric DEFAULT 0,
    last_oil_change_date date,
    last_tire_rotation_mileage numeric DEFAULT 0,
    last_tire_rotation_date date,
    last_tire_replacement_mileage numeric DEFAULT 0,
    last_tire_replacement_date date,
    oil_change_interval_miles numeric DEFAULT 5000 NOT NULL,
    tire_rotation_interval_miles numeric DEFAULT 6000 NOT NULL,
    tire_replacement_interval_miles numeric DEFAULT 50000 NOT NULL,
    current_mileage numeric,
    current_mileage_date timestamp with time zone,
    ai_summary text,
    ai_summary_generated_at timestamp with time zone,
    custom_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.maintenance_schedules OWNER TO postgres;

--
-- Name: TABLE maintenance_schedules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.maintenance_schedules IS 'Stores maintenance intervals and last service tracking per vehicle. Includes AI summary caching.';


--
-- Name: mass_sms_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mass_sms_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id uuid,
    message_preview text,
    sent_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    total_price numeric(12,6) DEFAULT 0 NOT NULL,
    status text NOT NULL,
    batch_details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mass_sms_log_status_check CHECK ((status = ANY (ARRAY['completed'::text, 'partial'::text, 'failed'::text])))
);


ALTER TABLE public.mass_sms_log OWNER TO postgres;

--
-- Name: TABLE mass_sms_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.mass_sms_log IS 'Audit log for admin mass SMS. One row per run. Cooldown (15 min) uses status = completed only.';


--
-- Name: COLUMN mass_sms_log.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.mass_sms_log.status IS 'completed = all batches sent; partial = some batches failed; failed = send aborted or all batches failed.';


--
-- Name: COLUMN mass_sms_log.batch_details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.mass_sms_log.batch_details IS 'Per-batch results: [{ "index": 0, "sent": 500, "failed": 0 }, ...].';


--
-- Name: mileage_anomalies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mileage_anomalies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    truck_number text NOT NULL,
    dvir_id uuid,
    reported_mileage numeric NOT NULL,
    previous_mileage numeric,
    expected_range_low numeric,
    expected_range_high numeric,
    anomaly_type text NOT NULL,
    severity text DEFAULT 'warning'::text NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    resolved_by_user_id uuid,
    resolution_notes text,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mileage_anomalies_anomaly_type_check CHECK ((anomaly_type = ANY (ARRAY['decrease'::text, 'large_jump'::text, 'impossible_reading'::text, 'stale_data'::text]))),
    CONSTRAINT mileage_anomalies_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'warning'::text, 'info'::text])))
);


ALTER TABLE public.mileage_anomalies OWNER TO postgres;

--
-- Name: TABLE mileage_anomalies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.mileage_anomalies IS 'Tracks flagged odometer reading anomalies for mechanic review and resolution.';


--
-- Name: monthly_reward_drawings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_reward_drawings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reward_id uuid NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    grand_prize_winner_id uuid,
    runner_up_1_winner_id uuid,
    runner_up_2_winner_id uuid,
    total_entries integer DEFAULT 0 NOT NULL,
    total_participants integer DEFAULT 0 NOT NULL,
    drawn_at timestamp with time zone DEFAULT now() NOT NULL,
    drawn_by uuid,
    grand_prize_winner_name text,
    runner_up_1_winner_name text,
    runner_up_2_winner_name text,
    CONSTRAINT monthly_reward_drawings_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT monthly_reward_drawings_year_check CHECK (((year >= 2024) AND (year <= 2100)))
);


ALTER TABLE public.monthly_reward_drawings OWNER TO postgres;

--
-- Name: TABLE monthly_reward_drawings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.monthly_reward_drawings IS 'Results of monthly safety reward raffle drawings.';


--
-- Name: COLUMN monthly_reward_drawings.grand_prize_winner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.monthly_reward_drawings.grand_prize_winner_name IS 'Denormalized winner name — preserved after user deletion';


--
-- Name: COLUMN monthly_reward_drawings.runner_up_1_winner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.monthly_reward_drawings.runner_up_1_winner_name IS 'Denormalized winner name — preserved after user deletion';


--
-- Name: COLUMN monthly_reward_drawings.runner_up_2_winner_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.monthly_reward_drawings.runner_up_2_winner_name IS 'Denormalized winner name — preserved after user deletion';


--
-- Name: monthly_safety_rewards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_safety_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    grand_prize_name text NOT NULL,
    grand_prize_description text,
    grand_prize_image_url text,
    runner_up_1_name text,
    runner_up_1_description text,
    runner_up_1_image_url text,
    runner_up_2_name text,
    runner_up_2_description text,
    runner_up_2_image_url text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT monthly_safety_rewards_month_check CHECK (((month >= 1) AND (month <= 12))),
    CONSTRAINT monthly_safety_rewards_year_check CHECK (((year >= 2024) AND (year <= 2100)))
);


ALTER TABLE public.monthly_safety_rewards OWNER TO postgres;

--
-- Name: TABLE monthly_safety_rewards; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.monthly_safety_rewards IS 'Admin-managed monthly safety reward items for the raffle drawing.';


--
-- Name: monthly_summary_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_summary_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.monthly_summary_recipients OWNER TO postgres;

--
-- Name: TABLE monthly_summary_recipients; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.monthly_summary_recipients IS 'Email recipients for the monthly safety compliance executive summary. Admin-only RLS. Only add authorized HR, safety directors, and executive management.';


--
-- Name: monthly_summary_send_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_summary_send_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    month_label text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    recipient_count integer,
    overall_compliance_rate numeric(5,2),
    total_sms_sent integer,
    total_sms_cost numeric(10,2),
    report_html text,
    success boolean DEFAULT true NOT NULL,
    error_message text
);


ALTER TABLE public.monthly_summary_send_log OWNER TO postgres;

--
-- Name: TABLE monthly_summary_send_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.monthly_summary_send_log IS 'Audit log for monthly compliance summary emails. Unique on month_label WHERE success = true prevents duplicate sends.';


--
-- Name: COLUMN monthly_summary_send_log.report_html; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.monthly_summary_send_log.report_html IS 'Generated HTML body; stored even on failure so manual retry with ?month= can optionally skip recomputation.';


--
-- Name: notification_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text NOT NULL,
    severity text NOT NULL,
    target_type text NOT NULL,
    target_ref text,
    title text NOT NULL,
    body text,
    url text,
    actor_user_id uuid,
    org_id uuid,
    entity_type text,
    entity_id uuid,
    title_es text,
    body_es text,
    CONSTRAINT notification_events_category_check CHECK ((category = ANY (ARRAY['schedule'::text, 'announcement'::text, 'safety_alert'::text, 'job_update'::text, 'rto_decision'::text, 'admin_notice'::text, 'certification_expiry'::text, 'certification_expiry_digest'::text, 'certification_granted'::text]))),
    CONSTRAINT notification_events_severity_check CHECK ((severity = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT notification_events_target_type_check CHECK ((target_type = ANY (ARRAY['all'::text, 'role'::text, 'crew'::text, 'user'::text])))
);


ALTER TABLE public.notification_events OWNER TO postgres;

--
-- Name: COLUMN notification_events.title_es; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notification_events.title_es IS 'Spanish title; used when recipient preferred_language is es';


--
-- Name: COLUMN notification_events.body_es; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.notification_events.body_es IS 'Spanish body; used when recipient preferred_language is es';


--
-- Name: notification_outbox; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text NOT NULL,
    severity text NOT NULL,
    push_enabled boolean DEFAULT true NOT NULL,
    sms_enabled boolean DEFAULT false NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    last_error text,
    title text NOT NULL,
    body text,
    url text,
    dedupe_key text NOT NULL,
    scheduled_for timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT notification_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


ALTER TABLE public.notification_outbox OWNER TO postgres;

--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    push_enabled boolean DEFAULT true NOT NULL,
    sms_enabled boolean DEFAULT false NOT NULL,
    quiet_hours jsonb DEFAULT '{"end": "08:00", "start": "22:00", "enabled": false, "timezone": "America/New_York"}'::jsonb
);


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- Name: osha_300a_certifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.osha_300a_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    year integer NOT NULL,
    certified_by_name text NOT NULL,
    certified_by_title text NOT NULL,
    certified_at timestamp with time zone DEFAULT now() NOT NULL,
    signature text NOT NULL,
    total_employees_avg numeric,
    total_hours_worked numeric,
    summary_data jsonb NOT NULL,
    posted_date date,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.osha_300a_certifications OWNER TO postgres;

--
-- Name: TABLE osha_300a_certifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.osha_300a_certifications IS 'OSHA 300A annual summary certifications. Post Feb 1–Apr 30 per 29 CFR 1904.32.';


--
-- Name: osha_compliance_mapping; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.osha_compliance_mapping (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    osha_regulation text NOT NULL,
    requirement_description text NOT NULL,
    data_source text NOT NULL,
    validation_rule text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.osha_compliance_mapping OWNER TO postgres;

--
-- Name: TABLE osha_compliance_mapping; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.osha_compliance_mapping IS 'Maps OSHA regulations to app data sources for compliance evidence. Expanded per OSHA Recordkeeping Guide (29 CFR 1904) and additional construction/general industry standards.';


--
-- Name: payroll_reminder_sms_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_reminder_sms_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier integer NOT NULL,
    date_checked date NOT NULL,
    recipient_count integer DEFAULT 0 NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    success boolean DEFAULT false NOT NULL,
    error_message text,
    total_price numeric(10,4),
    employee_user_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    results jsonb,
    CONSTRAINT payroll_reminder_sms_log_tier_check CHECK ((tier = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE public.payroll_reminder_sms_log OWNER TO postgres;

--
-- Name: TABLE payroll_reminder_sms_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.payroll_reminder_sms_log IS 'Audit log for payroll hours reminder SMS (Thu=1, Fri=2, Sat=3).';


--
-- Name: pending_certification_reviews; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.pending_certification_reviews WITH (security_invoker='true') AS
 SELECT ca.id AS attempt_id,
    ca.user_id,
    au.full_name AS user_name,
    ct.id AS certification_type_id,
    ct.name AS certification_name,
    ct.slug AS certification_slug,
    ca.submitted_at,
    ca.total_questions,
    ca.correct_answers,
    ca.score_percentage,
    ca.answers,
    ca.grading_started_at,
    ca.grading_started_by,
    grader_au.full_name AS grading_started_by_name,
    ( SELECT (count(*))::integer AS count
           FROM jsonb_array_elements(ca.answers) a(value)
          WHERE (((a.value ->> 'pending_review'::text))::boolean = true)) AS pending_count
   FROM (((public.certification_attempts ca
     JOIN public.certification_types ct ON ((ct.id = ca.certification_type_id)))
     LEFT JOIN public.app_users au ON ((au.user_id = ca.user_id)))
     LEFT JOIN public.app_users grader_au ON ((grader_au.user_id = ca.grading_started_by)))
  WHERE (ca.status = 'submitted'::text);


ALTER VIEW public.pending_certification_reviews OWNER TO postgres;

--
-- Name: VIEW pending_certification_reviews; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.pending_certification_reviews IS 'Certification attempts pending admin review. SECURITY INVOKER.';


--
-- Name: point_awarder_grants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.point_awarder_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    per_award_cap integer DEFAULT 25 NOT NULL,
    monthly_budget integer DEFAULT 500 NOT NULL,
    note text,
    CONSTRAINT point_awarder_grants_caps_positive CHECK (((per_award_cap > 0) AND (monthly_budget > 0)))
);


ALTER TABLE public.point_awarder_grants OWNER TO postgres;

--
-- Name: TABLE point_awarder_grants; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.point_awarder_grants IS 'Authority to manually award points. One ACTIVE grant per user (revoked_at IS NULL). Admins do not need a grant and bypass cap/budget.';


--
-- Name: point_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.point_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source public.point_source NOT NULL,
    rule_key text NOT NULL,
    points integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.point_rules OWNER TO postgres;

--
-- Name: TABLE point_rules; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.point_rules IS 'Configurable point amounts and caps per earning source. points column holds award amounts; rule_key ending in _cap stores a daily/count limit (not wallet points).';


--
-- Name: COLUMN point_rules.points; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.point_rules.points IS 'Award amount for *_amount rules; limit value for *_cap rules (semantic overload, v1).';


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.point_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    source public.point_source NOT NULL,
    reference_id uuid,
    reference_table text,
    counts_toward_raffle boolean DEFAULT true NOT NULL,
    category text,
    reason text,
    awarded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id uuid,
    CONSTRAINT manual_award_requires_reason CHECK (((source <> 'manual_award'::public.point_source) OR ((reason IS NOT NULL) AND (awarded_by IS NOT NULL)))),
    CONSTRAINT redemption_is_negative CHECK (((source <> 'redemption'::public.point_source) OR (amount < 0)))
);


ALTER TABLE public.point_transactions OWNER TO postgres;

--
-- Name: TABLE point_transactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.point_transactions IS 'Append-only points ledger — single source of truth for wallet balance and raffle entries.';


--
-- Name: COLUMN point_transactions.request_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.point_transactions.request_id IS 'Client-supplied idempotency key for manual_award rows. A duplicate award_points call with the same request_id is a no-op that returns the original tx id.';


--
-- Name: practical_evaluation_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.practical_evaluation_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    certification_type_id uuid NOT NULL,
    category_name text NOT NULL,
    category_order integer NOT NULL,
    items jsonb NOT NULL,
    items_count integer NOT NULL
);


ALTER TABLE public.practical_evaluation_templates OWNER TO postgres;

--
-- Name: TABLE practical_evaluation_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.practical_evaluation_templates IS 'Checklist template per cert (e.g. hardware_identification, knots_and_rigging). items: [{"item_id","item_name"}].';


--
-- Name: practical_evaluations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.practical_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    certification_type_id uuid NOT NULL,
    evaluator_id uuid,
    evaluation_date timestamp with time zone DEFAULT now(),
    checklist_items jsonb NOT NULL,
    items_total integer NOT NULL,
    items_passed integer NOT NULL,
    passed boolean NOT NULL,
    evaluator_notes text,
    evaluator_signature text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.practical_evaluations OWNER TO postgres;

--
-- Name: COLUMN practical_evaluations.checklist_items; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.practical_evaluations.checklist_items IS '{"<category_name>": [{"item_id","item_name","passed","notes"}], ...}';


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    revoked_at timestamp with time zone
);


ALTER TABLE public.push_subscriptions OWNER TO postgres;

--
-- Name: reward_catalog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    point_cost integer NOT NULL,
    stock_qty integer,
    category text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reward_catalog_point_cost_positive CHECK ((point_cost > 0)),
    CONSTRAINT reward_catalog_stock_qty_nonnegative CHECK (((stock_qty IS NULL) OR (stock_qty >= 0)))
);


ALTER TABLE public.reward_catalog OWNER TO postgres;

--
-- Name: TABLE reward_catalog; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.reward_catalog IS 'Redemption store catalog. stock_qty NULL = unlimited. Writes admin-only via RLS.';


--
-- Name: reward_claim_override_dates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reward_claim_override_dates (
    date_override date NOT NULL
);


ALTER TABLE public.reward_claim_override_dates OWNER TO postgres;

--
-- Name: TABLE reward_claim_override_dates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.reward_claim_override_dates IS 'Dates on which the reward claim window is open all day (one-off overrides). Remove rows after the override day.';


--
-- Name: risk_algorithm_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.risk_algorithm_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    version character varying(10) NOT NULL,
    is_active boolean DEFAULT false,
    wind_threshold_mph integer DEFAULT 25,
    wind_multiplier_per_mph numeric(4,3) DEFAULT 0.020,
    heat_index_moderate_threshold integer DEFAULT 90,
    heat_index_extreme_threshold integer DEFAULT 95,
    heat_moderate_multiplier numeric(3,2) DEFAULT 1.15,
    heat_extreme_multiplier numeric(3,2) DEFAULT 1.30,
    precipitation_moderate_multiplier numeric(3,2) DEFAULT 1.10,
    precipitation_high_multiplier numeric(3,2) DEFAULT 1.15,
    weather_alert_multiplier numeric(3,2) DEFAULT 1.50,
    new_hire_ratio_high_threshold numeric(3,2) DEFAULT 0.50,
    new_hire_ratio_moderate_threshold numeric(3,2) DEFAULT 0.30,
    new_hire_ratio_low_threshold numeric(3,2) DEFAULT 0.15,
    new_hire_high_multiplier numeric(3,2) DEFAULT 2.50,
    new_hire_moderate_multiplier numeric(3,2) DEFAULT 1.80,
    new_hire_low_multiplier numeric(3,2) DEFAULT 1.30,
    no_expert_multiplier numeric(3,2) DEFAULT 1.30,
    solo_no_expert_multiplier numeric(3,2) DEFAULT 1.20,
    critical_defect_base_multiplier numeric(3,2) DEFAULT 1.00,
    critical_defect_increment numeric(3,2) DEFAULT 0.20,
    warning_defect_increment numeric(3,2) DEFAULT 0.05,
    monday_multiplier numeric(3,2) DEFAULT 1.10,
    post_holiday_multiplier numeric(3,2) DEFAULT 1.15,
    threshold_low_moderate numeric(3,2) DEFAULT 1.50,
    threshold_moderate_elevated numeric(3,2) DEFAULT 2.00,
    threshold_elevated_high numeric(3,2) DEFAULT 2.50,
    threshold_high_critical numeric(3,2) DEFAULT 3.50,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    notes text
);


ALTER TABLE public.risk_algorithm_config OWNER TO postgres;

--
-- Name: TABLE risk_algorithm_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.risk_algorithm_config IS 'Versioned configuration for risk calculation multipliers';


--
-- Name: COLUMN risk_algorithm_config.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.risk_algorithm_config.is_active IS 'Only one config should be active at a time';


--
-- Name: risk_score_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.risk_score_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date_for date NOT NULL,
    work_site_id uuid,
    work_site_name character varying(100),
    total_score numeric(3,2) NOT NULL,
    risk_level text NOT NULL,
    weather_factors jsonb DEFAULT '{}'::jsonb NOT NULL,
    crew_factors jsonb DEFAULT '{}'::jsonb NOT NULL,
    equipment_factors jsonb DEFAULT '{}'::jsonb NOT NULL,
    temporal_factors jsonb DEFAULT '{}'::jsonb NOT NULL,
    top_drivers text[] DEFAULT '{}'::text[] NOT NULL,
    recommendations text[] DEFAULT '{}'::text[] NOT NULL,
    forecast_run_id uuid,
    algorithm_version character varying(10) DEFAULT 'v1'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT risk_score_history_risk_level_check CHECK ((risk_level = ANY (ARRAY['LOW'::text, 'MODERATE'::text, 'ELEVATED'::text, 'HIGH'::text, 'CRITICAL'::text]))),
    CONSTRAINT risk_score_history_total_score_check CHECK (((total_score >= 1.0) AND (total_score <= 5.0)))
);


ALTER TABLE public.risk_score_history OWNER TO postgres;

--
-- Name: TABLE risk_score_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.risk_score_history IS 'Historical risk scores for algorithm calibration and accuracy tracking';


--
-- Name: COLUMN risk_score_history.top_drivers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.risk_score_history.top_drivers IS 'Top 3 risk contributors (text descriptions)';


--
-- Name: COLUMN risk_score_history.algorithm_version; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.risk_score_history.algorithm_version IS 'Version of risk_algorithm_config used for this calculation';


--
-- Name: rto_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rto_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    notes text,
    status text DEFAULT 'Pending'::text,
    submitted_at timestamp with time zone DEFAULT now(),
    start_time text,
    end_time text,
    total_duration text,
    user_id uuid,
    updated_at timestamp with time zone DEFAULT now(),
    phone_number text,
    admin_notes text,
    approved_by uuid,
    CONSTRAINT rto_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Denied'::text])))
);


ALTER TABLE public.rto_requests OWNER TO postgres;

--
-- Name: COLUMN rto_requests.start_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rto_requests.start_time IS 'Time coverage begins, stored as HH:MM text';


--
-- Name: COLUMN rto_requests.end_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rto_requests.end_time IS 'Time coverage ends, stored as HH:MM text';


--
-- Name: COLUMN rto_requests.total_duration; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rto_requests.total_duration IS 'Calculated duration string (e.g., "2 days · 16h 0m")';


--
-- Name: COLUMN rto_requests.phone_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rto_requests.phone_number IS 'Employee contact phone number for RTO requests';


--
-- Name: COLUMN rto_requests.admin_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rto_requests.admin_notes IS 'Admin-only notes. Populated on approval/denial with reason. Visible to admin role only (RLS).';


--
-- Name: COLUMN rto_requests.approved_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.rto_requests.approved_by IS 'User who approved the request. NULL for rows approved before this column existed. Trigger uses COALESCE(approved_by, auth.uid(), sentinel).';


--
-- Name: safety_announcements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.safety_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    summary text,
    status text DEFAULT 'draft'::text NOT NULL,
    published_at timestamp with time zone,
    created_by uuid,
    published_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT safety_announcements_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])))
);


ALTER TABLE public.safety_announcements OWNER TO postgres;

--
-- Name: safety_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.safety_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_type text NOT NULL,
    table_name text NOT NULL,
    record_id uuid,
    user_id uuid,
    role text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    payload_snapshot jsonb,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.safety_audit_log OWNER TO postgres;

--
-- Name: TABLE safety_audit_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.safety_audit_log IS 'Append-only audit log for safety forms. No UPDATE/DELETE. Triggers + app (report_exported) write here.';


--
-- Name: safety_briefing_answer_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.safety_briefing_answer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    briefing_answer_id uuid NOT NULL,
    question_id text NOT NULL,
    selected_option_id text NOT NULL,
    category text NOT NULL,
    CONSTRAINT safety_briefing_answer_items_category_check CHECK ((category = ANY (ARRAY['tree_safety'::text, 'personal_health'::text, 'announcement'::text])))
);


ALTER TABLE public.safety_briefing_answer_items OWNER TO postgres;

--
-- Name: TABLE safety_briefing_answer_items; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.safety_briefing_answer_items IS 'Individual question responses for a daily safety briefing completion.';


--
-- Name: safety_briefing_answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.safety_briefing_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    announcement_id uuid NOT NULL,
    briefing_date date DEFAULT ((CURRENT_DATE AT TIME ZONE 'America/Chicago'::text))::date NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    open_ended_response text
);


ALTER TABLE public.safety_briefing_answers OWNER TO postgres;

--
-- Name: TABLE safety_briefing_answers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.safety_briefing_answers IS 'Tracks daily safety briefing completions. One row per user per day (Chicago TZ).';


--
-- Name: COLUMN safety_briefing_answers.open_ended_response; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_briefing_answers.open_ended_response IS 'Optional free-text response to open-ended prompt (e.g. what worker will watch for today). Max length enforced in app; moderation before next-day surfacing.';


--
-- Name: safety_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.safety_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    flagged_by uuid NOT NULL,
    form_type text NOT NULL,
    form_id uuid NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT safety_flags_form_type_check CHECK ((form_type = ANY (ARRAY['jsa'::text, 'dvir'::text, 'equipment'::text, 'incident'::text, 'near_miss'::text]))),
    CONSTRAINT safety_flags_status_check CHECK ((status = ANY (ARRAY['open'::text, 'reviewed'::text, 'resolved'::text])))
);


ALTER TABLE public.safety_flags OWNER TO postgres;

--
-- Name: TABLE safety_flags; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.safety_flags IS 'Flags for safety officer / general foreman review of specific form submissions.';


--
-- Name: safety_incidents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.safety_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incident_date date NOT NULL,
    work_site_id uuid,
    work_site_name character varying(100),
    severity text NOT NULL,
    incident_type text NOT NULL,
    description text NOT NULL,
    involved_user_ids uuid[] DEFAULT '{}'::uuid[],
    experience_levels text[],
    weather_conditions jsonb,
    contributing_factors text[] DEFAULT '{}'::text[],
    preventable boolean DEFAULT true,
    predicted_risk_score_id uuid,
    was_forecasted_high_risk boolean DEFAULT false,
    reported_by uuid,
    reported_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    job_id uuid,
    crew_id uuid,
    supervisor_id uuid,
    corrective_actions_taken text,
    corrective_actions_by uuid,
    corrective_actions_at timestamp with time zone,
    case_number character varying(20),
    incident_time time without time zone,
    employee_job_title text,
    what_doing_before text,
    object_substance_harmed text,
    body_parts_affected text[] DEFAULT '{}'::text[],
    injury_illness_type text,
    days_away_from_work integer,
    days_restricted_duty integer,
    emergency_room_treatment boolean DEFAULT false,
    hospitalized_overnight boolean DEFAULT false,
    physician_name text,
    treatment_facility text,
    time_began_work time without time zone,
    employee_hire_date date,
    osha_reportable boolean DEFAULT false,
    osha_reported boolean DEFAULT false,
    osha_report_date date,
    employee_street_address text,
    employee_city text,
    employee_state text,
    employee_zip text,
    employee_date_of_birth date,
    employee_sex text,
    date_of_death date,
    privacy_case boolean DEFAULT false,
    near_miss_data jsonb,
    CONSTRAINT safety_incidents_employee_sex_check CHECK ((employee_sex = ANY (ARRAY['male'::text, 'female'::text, 'non_binary'::text, 'prefer_not_to_say'::text]))),
    CONSTRAINT safety_incidents_incident_type_check CHECK ((incident_type = ANY (ARRAY['fall'::text, 'electrical'::text, 'vehicle'::text, 'equipment'::text, 'environmental'::text, 'struck_by'::text, 'caught_in'::text, 'other'::text, 'near_miss'::text]))),
    CONSTRAINT safety_incidents_severity_check CHECK ((severity = ANY (ARRAY['near_miss'::text, 'first_aid'::text, 'recordable'::text, 'lost_time'::text, 'fatality'::text])))
);


ALTER TABLE public.safety_incidents OWNER TO postgres;

--
-- Name: TABLE safety_incidents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.safety_incidents IS 'OSHA 5-year retention required (29 CFR 1904.33). DELETE intentionally blocked at RLS level.';


--
-- Name: COLUMN safety_incidents.predicted_risk_score_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.predicted_risk_score_id IS 'Auto-linked to matching risk prediction for accuracy tracking';


--
-- Name: COLUMN safety_incidents.was_forecasted_high_risk; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.was_forecasted_high_risk IS 'True if the risk level was HIGH/CRITICAL/ELEVATED on incident date';


--
-- Name: COLUMN safety_incidents.job_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.job_id IS 'Job (job_progress_trackers) where incident occurred; for incident-to-job traceability.';


--
-- Name: COLUMN safety_incidents.crew_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.crew_id IS 'Crew where incident occurred; for incident-to-crew traceability.';


--
-- Name: COLUMN safety_incidents.supervisor_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.supervisor_id IS 'Supervisor responsible for job/crew at time of incident; for defensibility.';


--
-- Name: COLUMN safety_incidents.corrective_actions_taken; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.corrective_actions_taken IS 'Description of corrective actions taken; for insurer loss control.';


--
-- Name: COLUMN safety_incidents.corrective_actions_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.corrective_actions_by IS 'User who recorded corrective actions.';


--
-- Name: COLUMN safety_incidents.corrective_actions_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.corrective_actions_at IS 'When corrective actions were recorded.';


--
-- Name: COLUMN safety_incidents.case_number; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.case_number IS 'OSHA 300: Unique case identifier (format: YYYY-###)';


--
-- Name: COLUMN safety_incidents.employee_street_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.employee_street_address IS 'OSHA 301: Employee street address';


--
-- Name: COLUMN safety_incidents.employee_city; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.employee_city IS 'OSHA 301: Employee city';


--
-- Name: COLUMN safety_incidents.employee_state; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.employee_state IS 'OSHA 301: Employee state (US abbreviation)';


--
-- Name: COLUMN safety_incidents.employee_zip; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.employee_zip IS 'OSHA 301: Employee ZIP code';


--
-- Name: COLUMN safety_incidents.employee_date_of_birth; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.employee_date_of_birth IS 'OSHA 301: Employee date of birth';


--
-- Name: COLUMN safety_incidents.employee_sex; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.employee_sex IS 'OSHA 301: Employee sex (male, female, non_binary, prefer_not_to_say)';


--
-- Name: COLUMN safety_incidents.date_of_death; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.date_of_death IS 'OSHA 301: Date of death (for fatality severity)';


--
-- Name: COLUMN safety_incidents.privacy_case; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.privacy_case IS 'OSHA 1904.12: Privacy concern case - do not enter employee name on log';


--
-- Name: COLUMN safety_incidents.near_miss_data; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.safety_incidents.near_miss_data IS 'Near-miss specific: category, latitude, longitude, suggested_corrective_action, photo_paths';


--
-- Name: scheduled_cron_jobs; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.scheduled_cron_jobs WITH (security_invoker='true') AS
 SELECT jobname,
    schedule,
    active,
    jobid,
    database,
    command
   FROM cron.job
  WHERE ((jobname = ANY (ARRAY['safety-announcement-7am'::text, 'admin-compliance-9am'::text, 'auto-tune-risk-algorithm'::text, 'check-algorithm-performance'::text, 'admin-safety-forecast'::text, 'monthly-safety-drawing'::text])) OR (jobname ~~ 'weekly-safety-audit%'::text) OR (jobname ~~ 'data-retention%'::text));


ALTER VIEW public.scheduled_cron_jobs OWNER TO postgres;

--
-- Name: VIEW scheduled_cron_jobs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.scheduled_cron_jobs IS 'View of scheduled cron jobs for monitoring and debugging';


--
-- Name: sms_escalation_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_escalation_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier integer NOT NULL,
    phone_e164 text NOT NULL,
    label text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sms_escalation_recipients_phone_e164_check CHECK ((phone_e164 ~ '^\+[1-9]\d{6,14}$'::text)),
    CONSTRAINT sms_escalation_recipients_tier_check CHECK ((tier = ANY (ARRAY[0, 1, 2])))
);


ALTER TABLE public.sms_escalation_recipients OWNER TO postgres;

--
-- Name: TABLE sms_escalation_recipients; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.sms_escalation_recipients IS 'Admin-managed SMS recipients for safety briefing overdue escalation. Tier 1 = 1-day overdue; tier 2 = 2-day. Code sends to all active recipients in each tier.';


--
-- Name: COLUMN sms_escalation_recipients.tier; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sms_escalation_recipients.tier IS '1 = 1 business day overdue escalation; 2 = 2 business days overdue.';


--
-- Name: COLUMN sms_escalation_recipients.phone_e164; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sms_escalation_recipients.phone_e164 IS 'E.164 format for ClickSend (e.g. +15551234567).';


--
-- Name: COLUMN sms_escalation_recipients.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sms_escalation_recipients.is_active IS 'When false, exclude from sends (e.g. vacation); do not delete.';


--
-- Name: sms_escalation_send_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_escalation_send_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier integer NOT NULL,
    date_checked date NOT NULL,
    overdue_count integer NOT NULL,
    recipient_count integer NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    error_message text,
    total_price numeric(10,4),
    results jsonb,
    employee_user_ids uuid[] DEFAULT '{}'::uuid[],
    orphaned_user_ids jsonb DEFAULT '[]'::jsonb,
    suppression_log jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT sms_escalation_send_log_tier_check CHECK ((tier = ANY (ARRAY[0, 1, 2])))
);


ALTER TABLE public.sms_escalation_send_log OWNER TO postgres;

--
-- Name: TABLE sms_escalation_send_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.sms_escalation_send_log IS 'Audit log of SMS escalation sends. Used for idempotency (skip if already sent for tier+date_checked today), cost visibility (total_price), and per-recipient status (results).';


--
-- Name: COLUMN sms_escalation_send_log.total_price; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sms_escalation_send_log.total_price IS 'From ClickSend response; cost visibility without dashboard.';


--
-- Name: COLUMN sms_escalation_send_log.results; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sms_escalation_send_log.results IS 'Per-message results array: { to, status, messageId } per recipient.';


--
-- Name: COLUMN sms_escalation_send_log.employee_user_ids; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sms_escalation_send_log.employee_user_ids IS 'For tier 0: array of user_ids who were sent reminders. Empty for tier 1/2. Phase 3 may deprecate once sms_escalation_send_recipients is populated at send time.';


--
-- Name: COLUMN sms_escalation_send_log.orphaned_user_ids; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sms_escalation_send_log.orphaned_user_ids IS 'Tier 1: array of { user_id, reason } for users routed to tier 2 (no manager or manager has no phone). Empty for tier 0/2.';


--
-- Name: COLUMN sms_escalation_send_log.suppression_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.sms_escalation_send_log.suppression_log IS 'Verbose log: { dates_skipped_calendar: string[], users_excluded_absences: number|string[], overdue_before: number, overdue_after: number }. Used to verify calendar/absence exclusions.';


--
-- Name: storage_cleanup_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.storage_cleanup_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text NOT NULL,
    paths text[] NOT NULL,
    source_table text NOT NULL,
    source_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


ALTER TABLE public.storage_cleanup_queue OWNER TO postgres;

--
-- Name: TABLE storage_cleanup_queue; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.storage_cleanup_queue IS 'Queue for async storage file deletion when parent records are deleted. Processed by edge function/cron. Rows with processed_at IS NULL are pending.';


--
-- Name: telemetry_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telemetry_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    session_id text NOT NULL,
    event_name text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    route text,
    form_type text,
    CONSTRAINT telemetry_events_event_name_check CHECK ((event_name = ANY (ARRAY['form_started'::text, 'form_submitted'::text, 'form_submit_error'::text, 'announcement_viewed'::text, 'form_duplicate_detected'::text, 'form_duplicate_prevented'::text, 'form_duplicate_overridden'::text, 'avatar_uploaded'::text, 'avatar_removed'::text, 'avatar_upload_failed'::text, 'dashboard_action'::text]))),
    CONSTRAINT telemetry_events_form_type_check CHECK (((form_type IS NULL) OR (form_type = ANY (ARRAY['dvir'::text, 'equipment'::text, 'rto'::text, 'jsa'::text]))))
);


ALTER TABLE public.telemetry_events OWNER TO postgres;

--
-- Name: COLUMN telemetry_events.event_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.telemetry_events.event_name IS 'Event type. dashboard_action uses properties.action: view | section_expand | form_link_click | job_card_click | pull_refresh | view_all_jobs.';


--
-- Name: tuning_decisions_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tuning_decisions_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tuning_run_id uuid,
    decision_type text NOT NULL,
    decision_maker text NOT NULL,
    factor_adjusted text,
    old_value numeric(5,3),
    new_value numeric(5,3),
    adjustment_reason text,
    supporting_metrics jsonb,
    confidence_score numeric(3,2),
    decision_at timestamp with time zone DEFAULT now(),
    admin_user_id uuid,
    CONSTRAINT tuning_decisions_log_decision_maker_check CHECK ((decision_maker = ANY (ARRAY['auto_tuner'::text, 'admin'::text, 'rollback_checker'::text]))),
    CONSTRAINT tuning_decisions_log_decision_type_check CHECK ((decision_type = ANY (ARRAY['adjustment'::text, 'activation'::text, 'rollback'::text, 'no_action'::text, 'disabled'::text])))
);


ALTER TABLE public.tuning_decisions_log OWNER TO postgres;

--
-- Name: TABLE tuning_decisions_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.tuning_decisions_log IS 'Complete audit trail of all algorithm tuning decisions';


--
-- Name: user_absences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_absences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    type text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_absences_type_check CHECK ((type = ANY (ARRAY['pto'::text, 'sick'::text, 'leave'::text])))
);


ALTER TABLE public.user_absences OWNER TO postgres;

--
-- Name: TABLE user_absences; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_absences IS 'Per-user absence by date; excludes user from safety briefing reminder and escalation for that date.';


--
-- Name: user_activity_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_activity_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_id text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    current_page text,
    device_info jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_activity_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'idle'::text, 'offline'::text])))
);


ALTER TABLE public.user_activity_sessions OWNER TO postgres;

--
-- Name: TABLE user_activity_sessions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_activity_sessions IS 'Tracks user presence and activity sessions for admin monitoring';


--
-- Name: user_activity_feed; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.user_activity_feed WITH (security_invoker='true') AS
 SELECT uas.id,
    uas.user_id,
    uas.session_id,
    uas.status,
    uas.last_seen_at,
    uas.started_at,
    uas.ended_at,
    uas.current_page,
    uas.device_info,
    au.email,
    au.full_name,
    au.role,
    au.avatar_url,
        CASE
            WHEN (uas.ended_at IS NOT NULL) THEN (uas.ended_at - uas.started_at)
            ELSE (now() - uas.started_at)
        END AS session_duration,
    (now() - uas.last_seen_at) AS time_since_last_seen
   FROM (public.user_activity_sessions uas
     LEFT JOIN public.app_users au ON ((au.user_id = uas.user_id)))
  ORDER BY uas.last_seen_at DESC;


ALTER VIEW public.user_activity_feed OWNER TO postgres;

--
-- Name: VIEW user_activity_feed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.user_activity_feed IS 'Activity sessions with user profile. SECURITY INVOKER so caller RLS applies.';


--
-- Name: user_contact_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_contact_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    is_default boolean DEFAULT false,
    oc_contact character varying(255),
    doc_contact character varying(255),
    gf_contact character varying(255),
    safety_contact character varying(255),
    use_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_contact_templates OWNER TO postgres;

--
-- Name: user_management_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_management_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_type text NOT NULL,
    target_user_id uuid NOT NULL,
    target_user_email text NOT NULL,
    performed_by_user_id uuid,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_management_log_action_type_check CHECK ((action_type = ANY (ARRAY['block'::text, 'unblock'::text, 'delete'::text])))
);


ALTER TABLE public.user_management_log OWNER TO postgres;

--
-- Name: TABLE user_management_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_management_log IS 'Audit log for block, unblock, delete actions. performed_by_user_id is admin app_users.id.';


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    smart_defaults_expanded boolean DEFAULT true,
    auto_detect_location boolean DEFAULT true,
    auto_detect_weather boolean DEFAULT true,
    auto_save_enabled boolean DEFAULT true,
    auto_save_interval_seconds integer DEFAULT 30,
    show_completion_celebrations boolean DEFAULT true,
    large_touch_targets boolean DEFAULT false,
    high_contrast_mode boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_preferences OWNER TO postgres;

--
-- Name: user_profiles; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.user_profiles AS
 SELECT app.id,
    app.user_id,
    au.email,
    app.full_name,
    app.role,
    app.avatar_url,
    app.hire_date,
    app.experience_level,
    app.status,
    app.blocked_at,
    app.blocked_reason,
    app.preferred_language,
    app.manager_id,
    app.created_at
   FROM (public.app_users app
     LEFT JOIN auth.users au ON ((app.user_id = au.id)));


ALTER VIEW public.user_profiles OWNER TO postgres;

--
-- Name: VIEW user_profiles; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON VIEW public.user_profiles IS 'Joined view of app_users and auth.users. Includes status, preferred_language, manager_id for admin user management and Phase 2.';


--
-- Name: user_saved_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_saved_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    address character varying(500) NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    nearest_hospital character varying(255),
    nearest_clinic character varying(255),
    circuit_number character varying(100),
    use_count integer DEFAULT 0,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_saved_locations OWNER TO postgres;

--
-- Name: user_signatures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    signature_data text NOT NULL,
    signature_type character varying(20) DEFAULT 'canvas'::character varying,
    typed_name character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_signatures_signature_type_check CHECK (((signature_type)::text = ANY ((ARRAY['canvas'::character varying, 'typed'::character varying])::text[])))
);


ALTER TABLE public.user_signatures OWNER TO postgres;

--
-- Name: weekly_safety_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.weekly_safety_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    week_start_date date NOT NULL,
    week_end_date date NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    report_data jsonb NOT NULL,
    email_sent boolean DEFAULT false NOT NULL,
    email_sent_at timestamp with time zone,
    sheets_updated boolean DEFAULT false NOT NULL,
    sheets_updated_at timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.weekly_safety_reports OWNER TO postgres;

--
-- Name: TABLE weekly_safety_reports; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.weekly_safety_reports IS 'Audit log of weekly safety audit report runs. One row per Friday 5 PM CST execution.';


--
-- Name: work_sites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    address character varying(500),
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    region character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    crew_id uuid
);


ALTER TABLE public.work_sites OWNER TO postgres;

--
-- Name: TABLE work_sites; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.work_sites IS 'GPS-enabled work sites for weather forecasting and crew assignment tracking';


--
-- Name: COLUMN work_sites.region; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.work_sites.region IS 'Geographic region for grouping sites (e.g., North Dallas, Fort Worth)';


--
-- Name: COLUMN work_sites.is_active; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.work_sites.is_active IS 'Soft delete flag - inactive sites are hidden but preserved';


--
-- Name: COLUMN work_sites.crew_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.work_sites.crew_id IS 'Default crew assigned to this work site';


--
-- Name: worker_external_certifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.worker_external_certifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    external_certification_type_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    issued_date date,
    expiration_date date,
    issuing_authority text,
    credential_number text,
    document_url text,
    notes text,
    verified_by uuid,
    verified_at timestamp with time zone,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_by uuid,
    revoked_at timestamp with time zone,
    revoked_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT worker_external_certifications_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'pending_verification'::text])))
);


ALTER TABLE public.worker_external_certifications OWNER TO postgres;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: algorithm_tuning_runs algorithm_tuning_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.algorithm_tuning_runs
    ADD CONSTRAINT algorithm_tuning_runs_pkey PRIMARY KEY (id);


--
-- Name: announcement_metadata announcement_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcement_metadata
    ADD CONSTRAINT announcement_metadata_pkey PRIMARY KEY (id);


--
-- Name: announcement_rewards announcement_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcement_rewards
    ADD CONSTRAINT announcement_rewards_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_title_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_title_unique UNIQUE (title);


--
-- Name: app_settings_audit app_settings_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings_audit
    ADD CONSTRAINT app_settings_audit_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_user_id_key UNIQUE (user_id);


--
-- Name: attendance_summaries attendance_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_summaries
    ADD CONSTRAINT attendance_summaries_pkey PRIMARY KEY (id);


--
-- Name: attendance_summaries attendance_summaries_start_date_end_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_summaries
    ADD CONSTRAINT attendance_summaries_start_date_end_date_key UNIQUE (start_date, end_date);


--
-- Name: auto_tuning_config auto_tuning_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_tuning_config
    ADD CONSTRAINT auto_tuning_config_pkey PRIMARY KEY (id);


--
-- Name: certification_access_grants certification_access_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_access_grants
    ADD CONSTRAINT certification_access_grants_pkey PRIMARY KEY (id);


--
-- Name: certification_access_grants certification_access_grants_user_id_certification_type_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_access_grants
    ADD CONSTRAINT certification_access_grants_user_id_certification_type_id_key UNIQUE (user_id, certification_type_id);


--
-- Name: certification_attempts certification_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_pkey PRIMARY KEY (id);


--
-- Name: certification_attempts certification_attempts_user_id_certification_type_id_attemp_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_user_id_certification_type_id_attemp_key UNIQUE (user_id, certification_type_id, attempt_number);


--
-- Name: certification_audit_log certification_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_audit_log
    ADD CONSTRAINT certification_audit_log_pkey PRIMARY KEY (id);


--
-- Name: certification_expiration_notifications certification_expiration_noti_certification_record_id_notif_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_expiration_notifications
    ADD CONSTRAINT certification_expiration_noti_certification_record_id_notif_key UNIQUE (certification_record_id, notification_type);


--
-- Name: certification_expiration_notifications certification_expiration_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_expiration_notifications
    ADD CONSTRAINT certification_expiration_notifications_pkey PRIMARY KEY (id);


--
-- Name: certification_questions certification_questions_certification_type_id_question_numb_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_questions
    ADD CONSTRAINT certification_questions_certification_type_id_question_numb_key UNIQUE (certification_type_id, question_number);


--
-- Name: certification_questions certification_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_questions
    ADD CONSTRAINT certification_questions_pkey PRIMARY KEY (id);


--
-- Name: certification_records certification_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_records
    ADD CONSTRAINT certification_records_pkey PRIMARY KEY (id);


--
-- Name: certification_types certification_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_types
    ADD CONSTRAINT certification_types_name_key UNIQUE (name);


--
-- Name: certification_types certification_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_types
    ADD CONSTRAINT certification_types_pkey PRIMARY KEY (id);


--
-- Name: certification_types certification_types_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_types
    ADD CONSTRAINT certification_types_slug_key UNIQUE (slug);


--
-- Name: company_calendar company_calendar_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_calendar
    ADD CONSTRAINT company_calendar_date_key UNIQUE (date);


--
-- Name: company_calendar company_calendar_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_calendar
    ADD CONSTRAINT company_calendar_pkey PRIMARY KEY (id);


--
-- Name: compliance_notifications compliance_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_notifications
    ADD CONSTRAINT compliance_notifications_pkey PRIMARY KEY (id);


--
-- Name: compliance_rewards compliance_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_rewards
    ADD CONSTRAINT compliance_rewards_pkey PRIMARY KEY (id);


--
-- Name: compliance_rewards compliance_rewards_user_id_date_for_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_rewards
    ADD CONSTRAINT compliance_rewards_user_id_date_for_key UNIQUE (user_id, date_for);


--
-- Name: compliance_runs compliance_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_runs
    ADD CONSTRAINT compliance_runs_pkey PRIMARY KEY (id);


--
-- Name: contact_requests contact_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_requests
    ADD CONSTRAINT contact_requests_pkey PRIMARY KEY (id);


--
-- Name: corrective_actions corrective_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corrective_actions
    ADD CONSTRAINT corrective_actions_pkey PRIMARY KEY (id);


--
-- Name: crew_members crew_members_crew_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_crew_id_user_id_key UNIQUE (crew_id, user_id);


--
-- Name: crew_members crew_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_pkey PRIMARY KEY (id);


--
-- Name: crews crews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crews
    ADD CONSTRAINT crews_pkey PRIMARY KEY (id);


--
-- Name: daily_attendance daily_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_attendance
    ADD CONSTRAINT daily_attendance_pkey PRIMARY KEY (id);


--
-- Name: daily_attendance daily_attendance_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_attendance
    ADD CONSTRAINT daily_attendance_user_id_date_key UNIQUE (user_id, date);


--
-- Name: daily_equipment_inspections daily_equipment_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_equipment_inspections
    ADD CONSTRAINT daily_equipment_inspections_pkey PRIMARY KEY (id);


--
-- Name: daily_jsa daily_jsa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_jsa
    ADD CONSTRAINT daily_jsa_pkey PRIMARY KEY (id);


--
-- Name: data_retention_policies data_retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_pkey PRIMARY KEY (id);


--
-- Name: data_retention_policies data_retention_policies_table_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.data_retention_policies
    ADD CONSTRAINT data_retention_policies_table_name_key UNIQUE (table_name);


--
-- Name: dvir_reports dvir_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dvir_reports
    ADD CONSTRAINT dvir_reports_pkey PRIMARY KEY (id);


--
-- Name: email_recipient_lists email_recipient_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_recipient_lists
    ADD CONSTRAINT email_recipient_lists_pkey PRIMARY KEY (list_key, email);


--
-- Name: email_send_log email_send_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_pkey PRIMARY KEY (id);


--
-- Name: external_certification_types external_certification_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_certification_types
    ADD CONSTRAINT external_certification_types_pkey PRIMARY KEY (id);


--
-- Name: external_certification_types external_certification_types_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_certification_types
    ADD CONSTRAINT external_certification_types_slug_key UNIQUE (slug);


--
-- Name: job_crew_assignments job_crew_assignments_job_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_crew_assignments
    ADD CONSTRAINT job_crew_assignments_job_id_user_id_key UNIQUE (job_id, user_id);


--
-- Name: job_crew_assignments job_crew_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_crew_assignments
    ADD CONSTRAINT job_crew_assignments_pkey PRIMARY KEY (id);


--
-- Name: job_milestones job_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_milestones
    ADD CONSTRAINT job_milestones_pkey PRIMARY KEY (id);


--
-- Name: job_progress_trackers job_progress_trackers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_progress_trackers
    ADD CONSTRAINT job_progress_trackers_pkey PRIMARY KEY (id);


--
-- Name: job_progress_updates job_progress_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_progress_updates
    ADD CONSTRAINT job_progress_updates_pkey PRIMARY KEY (id);


--
-- Name: jsa_sharing_audit jsa_sharing_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jsa_sharing_audit
    ADD CONSTRAINT jsa_sharing_audit_pkey PRIMARY KEY (id);


--
-- Name: maintenance_schedules maintenance_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_pkey PRIMARY KEY (id);


--
-- Name: maintenance_schedules maintenance_schedules_truck_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_truck_number_key UNIQUE (truck_number);


--
-- Name: mass_sms_log mass_sms_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mass_sms_log
    ADD CONSTRAINT mass_sms_log_pkey PRIMARY KEY (id);


--
-- Name: mileage_anomalies mileage_anomalies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mileage_anomalies
    ADD CONSTRAINT mileage_anomalies_pkey PRIMARY KEY (id);


--
-- Name: monthly_reward_drawings monthly_reward_drawings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_reward_drawings
    ADD CONSTRAINT monthly_reward_drawings_pkey PRIMARY KEY (id);


--
-- Name: monthly_safety_rewards monthly_safety_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_safety_rewards
    ADD CONSTRAINT monthly_safety_rewards_pkey PRIMARY KEY (id);


--
-- Name: monthly_summary_recipients monthly_summary_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_summary_recipients
    ADD CONSTRAINT monthly_summary_recipients_pkey PRIMARY KEY (id);


--
-- Name: monthly_summary_send_log monthly_summary_send_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_summary_send_log
    ADD CONSTRAINT monthly_summary_send_log_pkey PRIMARY KEY (id);


--
-- Name: notification_events notification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_events
    ADD CONSTRAINT notification_events_pkey PRIMARY KEY (id);


--
-- Name: notification_outbox notification_outbox_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: notification_outbox notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_category_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_category_key UNIQUE (user_id, category);


--
-- Name: osha_300a_certifications osha_300a_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.osha_300a_certifications
    ADD CONSTRAINT osha_300a_certifications_pkey PRIMARY KEY (id);


--
-- Name: osha_300a_certifications osha_300a_certifications_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.osha_300a_certifications
    ADD CONSTRAINT osha_300a_certifications_year_key UNIQUE (year);


--
-- Name: osha_compliance_mapping osha_compliance_mapping_osha_regulation_requirement_descrip_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.osha_compliance_mapping
    ADD CONSTRAINT osha_compliance_mapping_osha_regulation_requirement_descrip_key UNIQUE (osha_regulation, requirement_description);


--
-- Name: osha_compliance_mapping osha_compliance_mapping_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.osha_compliance_mapping
    ADD CONSTRAINT osha_compliance_mapping_pkey PRIMARY KEY (id);


--
-- Name: payroll_reminder_sms_log payroll_reminder_sms_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_reminder_sms_log
    ADD CONSTRAINT payroll_reminder_sms_log_pkey PRIMARY KEY (id);


--
-- Name: point_awarder_grants point_awarder_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_awarder_grants
    ADD CONSTRAINT point_awarder_grants_pkey PRIMARY KEY (id);


--
-- Name: point_rules point_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_rules
    ADD CONSTRAINT point_rules_pkey PRIMARY KEY (id);


--
-- Name: point_rules point_rules_source_rule_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_rules
    ADD CONSTRAINT point_rules_source_rule_key_unique UNIQUE (source, rule_key);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: practical_evaluation_templates practical_evaluation_template_certification_type_id_categor_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_evaluation_templates
    ADD CONSTRAINT practical_evaluation_template_certification_type_id_categor_key UNIQUE (certification_type_id, category_name);


--
-- Name: practical_evaluation_templates practical_evaluation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_evaluation_templates
    ADD CONSTRAINT practical_evaluation_templates_pkey PRIMARY KEY (id);


--
-- Name: practical_evaluations practical_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_evaluations
    ADD CONSTRAINT practical_evaluations_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_user_id_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);


--
-- Name: redemptions redemptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_pkey PRIMARY KEY (id);


--
-- Name: reward_catalog reward_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_catalog
    ADD CONSTRAINT reward_catalog_pkey PRIMARY KEY (id);


--
-- Name: reward_claim_override_dates reward_claim_override_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_claim_override_dates
    ADD CONSTRAINT reward_claim_override_dates_pkey PRIMARY KEY (date_override);


--
-- Name: risk_algorithm_config risk_algorithm_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_algorithm_config
    ADD CONSTRAINT risk_algorithm_config_pkey PRIMARY KEY (id);


--
-- Name: risk_algorithm_config risk_algorithm_config_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_algorithm_config
    ADD CONSTRAINT risk_algorithm_config_version_key UNIQUE (version);


--
-- Name: risk_score_history risk_score_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_score_history
    ADD CONSTRAINT risk_score_history_pkey PRIMARY KEY (id);


--
-- Name: rto_requests rto_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rto_requests
    ADD CONSTRAINT rto_requests_pkey PRIMARY KEY (id);


--
-- Name: safety_announcements safety_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_announcements
    ADD CONSTRAINT safety_announcements_pkey PRIMARY KEY (id);


--
-- Name: safety_audit_log safety_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_audit_log
    ADD CONSTRAINT safety_audit_log_pkey PRIMARY KEY (id);


--
-- Name: safety_briefing_answer_items safety_briefing_answer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_briefing_answer_items
    ADD CONSTRAINT safety_briefing_answer_items_pkey PRIMARY KEY (id);


--
-- Name: safety_briefing_answers safety_briefing_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_briefing_answers
    ADD CONSTRAINT safety_briefing_answers_pkey PRIMARY KEY (id);


--
-- Name: safety_flags safety_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_flags
    ADD CONSTRAINT safety_flags_pkey PRIMARY KEY (id);


--
-- Name: safety_incidents safety_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_incidents
    ADD CONSTRAINT safety_incidents_pkey PRIMARY KEY (id);


--
-- Name: sms_escalation_recipients sms_escalation_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_escalation_recipients
    ADD CONSTRAINT sms_escalation_recipients_pkey PRIMARY KEY (id);


--
-- Name: sms_escalation_send_log sms_escalation_send_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_escalation_send_log
    ADD CONSTRAINT sms_escalation_send_log_pkey PRIMARY KEY (id);


--
-- Name: storage_cleanup_queue storage_cleanup_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.storage_cleanup_queue
    ADD CONSTRAINT storage_cleanup_queue_pkey PRIMARY KEY (id);


--
-- Name: telemetry_events telemetry_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telemetry_events
    ADD CONSTRAINT telemetry_events_pkey PRIMARY KEY (id);


--
-- Name: tuning_decisions_log tuning_decisions_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tuning_decisions_log
    ADD CONSTRAINT tuning_decisions_log_pkey PRIMARY KEY (id);


--
-- Name: monthly_reward_drawings unique_drawing_per_month; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_reward_drawings
    ADD CONSTRAINT unique_drawing_per_month UNIQUE (year, month);


--
-- Name: compliance_notifications unique_notification_per_user_day_type; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_notifications
    ADD CONSTRAINT unique_notification_per_user_day_type UNIQUE (date_for, user_id, notification_type);


--
-- Name: CONSTRAINT unique_notification_per_user_day_type ON compliance_notifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON CONSTRAINT unique_notification_per_user_day_type ON public.compliance_notifications IS 'Ensures only one notification per user per day per type. Key to idempotency.';


--
-- Name: monthly_safety_rewards unique_reward_per_month; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_safety_rewards
    ADD CONSTRAINT unique_reward_per_month UNIQUE (year, month);


--
-- Name: risk_score_history unique_risk_score_per_date_site; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_score_history
    ADD CONSTRAINT unique_risk_score_per_date_site UNIQUE (date_for, work_site_id);


--
-- Name: announcement_rewards unique_user_announcement_claim; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcement_rewards
    ADD CONSTRAINT unique_user_announcement_claim UNIQUE (user_id, announcement_id);


--
-- Name: safety_briefing_answers unique_user_briefing_per_day; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_briefing_answers
    ADD CONSTRAINT unique_user_briefing_per_day UNIQUE (user_id, briefing_date);


--
-- Name: user_activity_sessions unique_user_session; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activity_sessions
    ADD CONSTRAINT unique_user_session UNIQUE (user_id, session_id);


--
-- Name: user_absences user_absences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_absences
    ADD CONSTRAINT user_absences_pkey PRIMARY KEY (id);


--
-- Name: user_absences user_absences_user_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_absences
    ADD CONSTRAINT user_absences_user_id_date_key UNIQUE (user_id, date);


--
-- Name: user_activity_sessions user_activity_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activity_sessions
    ADD CONSTRAINT user_activity_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_contact_templates user_contact_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_contact_templates
    ADD CONSTRAINT user_contact_templates_pkey PRIMARY KEY (id);


--
-- Name: user_contact_templates user_contact_templates_user_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_contact_templates
    ADD CONSTRAINT user_contact_templates_user_id_name_key UNIQUE (user_id, name);


--
-- Name: user_management_log user_management_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_management_log
    ADD CONSTRAINT user_management_log_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);


--
-- Name: user_saved_locations user_saved_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_locations
    ADD CONSTRAINT user_saved_locations_pkey PRIMARY KEY (id);


--
-- Name: user_saved_locations user_saved_locations_user_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_locations
    ADD CONSTRAINT user_saved_locations_user_id_name_key UNIQUE (user_id, name);


--
-- Name: user_signatures user_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_signatures
    ADD CONSTRAINT user_signatures_pkey PRIMARY KEY (id);


--
-- Name: user_signatures user_signatures_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_signatures
    ADD CONSTRAINT user_signatures_user_id_key UNIQUE (user_id);


--
-- Name: vehicle_maintenance_log vehicle_maintenance_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_maintenance_log
    ADD CONSTRAINT vehicle_maintenance_log_pkey PRIMARY KEY (id);


--
-- Name: weekly_safety_reports weekly_safety_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_safety_reports
    ADD CONSTRAINT weekly_safety_reports_pkey PRIMARY KEY (id);


--
-- Name: work_sites work_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_sites
    ADD CONSTRAINT work_sites_pkey PRIMARY KEY (id);


--
-- Name: worker_external_certifications worker_external_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.worker_external_certifications
    ADD CONSTRAINT worker_external_certifications_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: certification_completion_stats_certification_type_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX certification_completion_stats_certification_type_id_idx ON public.certification_completion_stats USING btree (certification_type_id);


--
-- Name: contact_requests_submitted_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_requests_submitted_at_idx ON public.contact_requests USING btree (submitted_at DESC);


--
-- Name: contact_requests_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_requests_user_idx ON public.contact_requests USING btree (user_id);


--
-- Name: idx_announcement_rewards_announcement_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcement_rewards_announcement_id ON public.announcement_rewards USING btree (announcement_id);


--
-- Name: idx_announcement_rewards_claimed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcement_rewards_claimed_at ON public.announcement_rewards USING btree (claimed_at DESC);


--
-- Name: idx_announcement_rewards_user_announcement; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcement_rewards_user_announcement ON public.announcement_rewards USING btree (user_id, announcement_id);


--
-- Name: idx_announcement_rewards_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcement_rewards_user_id ON public.announcement_rewards USING btree (user_id);


--
-- Name: idx_announcements_author; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcements_author ON public.announcements USING btree (author);


--
-- Name: idx_announcements_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcements_created_at ON public.announcements USING btree (created_at DESC);


--
-- Name: idx_announcements_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcements_date ON public.announcements USING btree (date);


--
-- Name: idx_announcements_date_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_announcements_date_desc ON public.announcements USING btree (date DESC);


--
-- Name: idx_anomalies_dvir; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anomalies_dvir ON public.mileage_anomalies USING btree (dvir_id);


--
-- Name: idx_anomalies_truck_resolved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anomalies_truck_resolved ON public.mileage_anomalies USING btree (truck_number, resolved);


--
-- Name: idx_anomalies_unresolved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_anomalies_unresolved ON public.mileage_anomalies USING btree (resolved) WHERE (resolved = false);


--
-- Name: idx_app_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_email ON public.app_users USING btree (email);


--
-- Name: idx_app_users_experience_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_experience_level ON public.app_users USING btree (experience_level);


--
-- Name: idx_app_users_has_avatar; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_has_avatar ON public.app_users USING btree (((avatar_url IS NOT NULL)));


--
-- Name: idx_app_users_hire_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_hire_date ON public.app_users USING btree (hire_date);


--
-- Name: idx_app_users_manager_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_manager_id ON public.app_users USING btree (manager_id);


--
-- Name: idx_app_users_preferred_language; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_preferred_language ON public.app_users USING btree (preferred_language);


--
-- Name: idx_app_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_role ON public.app_users USING btree (role);


--
-- Name: idx_app_users_role_hire_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_role_hire_date ON public.app_users USING btree (role, hire_date) WHERE (hire_date IS NOT NULL);


--
-- Name: idx_app_users_sms_marketing_opt_out; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_sms_marketing_opt_out ON public.app_users USING btree (sms_marketing_opt_out) WHERE (sms_marketing_opt_out = false);


--
-- Name: idx_app_users_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_app_users_user_id ON public.app_users USING btree (user_id);


--
-- Name: idx_asset_cost_summary_pk; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_asset_cost_summary_pk ON public.asset_cost_summary USING btree (asset_type, asset_number);


--
-- Name: idx_attendance_summaries_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_summaries_dates ON public.attendance_summaries USING btree (start_date, end_date);


--
-- Name: idx_briefing_answers_announcement; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_briefing_answers_announcement ON public.safety_briefing_answers USING btree (announcement_id);


--
-- Name: idx_briefing_answers_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_briefing_answers_user_date ON public.safety_briefing_answers USING btree (user_id, briefing_date DESC);


--
-- Name: idx_briefing_items_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_briefing_items_parent ON public.safety_briefing_answer_items USING btree (briefing_answer_id);


--
-- Name: idx_briefing_items_question; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_briefing_items_question ON public.safety_briefing_answer_items USING btree (question_id, selected_option_id);


--
-- Name: idx_cert_access_grants_cert_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cert_access_grants_cert_id ON public.certification_access_grants USING btree (certification_type_id);


--
-- Name: idx_cert_access_grants_user_cert; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cert_access_grants_user_cert ON public.certification_access_grants USING btree (user_id, certification_type_id);


--
-- Name: idx_cert_exp_notif_external_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_cert_exp_notif_external_uniq ON public.certification_expiration_notifications USING btree (external_certification_id, notification_type) WHERE (external_certification_id IS NOT NULL);


--
-- Name: idx_cert_expiration_notif_scheduled; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cert_expiration_notif_scheduled ON public.certification_expiration_notifications USING btree (scheduled_for) WHERE (sent_at IS NULL);


--
-- Name: idx_certification_access_grants_granted_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_access_grants_granted_by ON public.certification_access_grants USING btree (granted_by);


--
-- Name: idx_certification_attempts_graded_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_attempts_graded_by ON public.certification_attempts USING btree (graded_by);


--
-- Name: idx_certification_attempts_grading_started_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_attempts_grading_started_by ON public.certification_attempts USING btree (grading_started_by);


--
-- Name: idx_certification_attempts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_attempts_status ON public.certification_attempts USING btree (status);


--
-- Name: idx_certification_attempts_user_cert; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_attempts_user_cert ON public.certification_attempts USING btree (user_id, certification_type_id);


--
-- Name: idx_certification_audit_log_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_audit_log_action ON public.certification_audit_log USING btree (action);


--
-- Name: idx_certification_audit_log_actor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_audit_log_actor_id ON public.certification_audit_log USING btree (actor_id);


--
-- Name: idx_certification_audit_log_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_audit_log_created_at ON public.certification_audit_log USING btree (created_at DESC);


--
-- Name: idx_certification_questions_type_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_questions_type_active ON public.certification_questions USING btree (certification_type_id, is_active) WHERE (is_active = true);


--
-- Name: idx_certification_records_active_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_certification_records_active_unique ON public.certification_records USING btree (user_id, certification_type_id) WHERE (status = ANY (ARRAY['pending'::text, 'written_passed'::text, 'active'::text]));


--
-- Name: idx_certification_records_certified_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_records_certified_by ON public.certification_records USING btree (certified_by);


--
-- Name: idx_certification_records_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_records_expires ON public.certification_records USING btree (expires_at);


--
-- Name: idx_certification_records_practical_evaluation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_records_practical_evaluation_id ON public.certification_records USING btree (practical_evaluation_id);


--
-- Name: idx_certification_records_renewal_of; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_records_renewal_of ON public.certification_records USING btree (renewal_of);


--
-- Name: idx_certification_records_reviewed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_records_reviewed_by ON public.certification_records USING btree (reviewed_by);


--
-- Name: idx_certification_records_revoked_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_records_revoked_by ON public.certification_records USING btree (revoked_by);


--
-- Name: idx_certification_records_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_records_status ON public.certification_records USING btree (status);


--
-- Name: idx_certification_records_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_records_user ON public.certification_records USING btree (user_id);


--
-- Name: idx_certification_records_verification_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_certification_records_verification_code ON public.certification_records USING btree (verification_code) WHERE (verification_code IS NOT NULL);


--
-- Name: idx_certification_records_written_attempt_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_certification_records_written_attempt_id ON public.certification_records USING btree (written_attempt_id);


--
-- Name: idx_company_calendar_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_company_calendar_date ON public.company_calendar USING btree (date);


--
-- Name: idx_compliance_notifications_date_for; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_notifications_date_for ON public.compliance_notifications USING btree (date_for DESC);


--
-- Name: idx_compliance_notifications_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_notifications_status ON public.compliance_notifications USING btree (status);


--
-- Name: idx_compliance_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_notifications_user_id ON public.compliance_notifications USING btree (user_id);


--
-- Name: idx_compliance_rewards_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_rewards_date ON public.compliance_rewards USING btree (date_for);


--
-- Name: idx_compliance_rewards_points; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_rewards_points ON public.compliance_rewards USING btree (user_id, points_awarded);


--
-- Name: idx_compliance_rewards_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_rewards_user_date ON public.compliance_rewards USING btree (user_id, date_for);


--
-- Name: idx_compliance_rewards_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_rewards_user_id ON public.compliance_rewards USING btree (user_id);


--
-- Name: idx_compliance_runs_date_for; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_runs_date_for ON public.compliance_runs USING btree (date_for DESC);


--
-- Name: idx_compliance_runs_run_type_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_runs_run_type_date ON public.compliance_runs USING btree (run_type, date_for DESC);


--
-- Name: idx_compliance_runs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_compliance_runs_status ON public.compliance_runs USING btree (status);


--
-- Name: idx_compliance_summary_90d_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_compliance_summary_90d_date ON public.compliance_summary_90d USING btree (date);


--
-- Name: idx_contact_requests_topic; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_requests_topic ON public.contact_requests USING btree (topic);


--
-- Name: idx_contact_requests_topic_submitted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_requests_topic_submitted ON public.contact_requests USING btree (topic, submitted_at DESC);


--
-- Name: idx_corrective_actions_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_corrective_actions_assigned_to ON public.corrective_actions USING btree (assigned_to);


--
-- Name: idx_corrective_actions_due_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_corrective_actions_due_date ON public.corrective_actions USING btree (due_date);


--
-- Name: idx_corrective_actions_incident; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_corrective_actions_incident ON public.corrective_actions USING btree (incident_id);


--
-- Name: idx_corrective_actions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_corrective_actions_status ON public.corrective_actions USING btree (status);


--
-- Name: idx_crew_members_added_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crew_members_added_by ON public.crew_members USING btree (added_by);


--
-- Name: idx_crew_members_crew_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crew_members_crew_id ON public.crew_members USING btree (crew_id);


--
-- Name: idx_crew_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crew_members_user_id ON public.crew_members USING btree (user_id);


--
-- Name: idx_crews_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crews_active ON public.crews USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_crews_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crews_created_by ON public.crews USING btree (created_by);


--
-- Name: idx_crews_name_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_crews_name_unique ON public.crews USING btree (lower((name)::text));


--
-- Name: idx_daily_attendance_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_attendance_date ON public.daily_attendance USING btree (date);


--
-- Name: idx_daily_attendance_date_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_attendance_date_status ON public.daily_attendance USING btree (date, status);


--
-- Name: idx_daily_attendance_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_attendance_user_date ON public.daily_attendance USING btree (user_id, date);


--
-- Name: idx_daily_equipment_inspections_created_at_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_equipment_inspections_created_at_desc ON public.daily_equipment_inspections USING btree (created_at DESC);


--
-- Name: idx_daily_equipment_inspections_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_equipment_inspections_date ON public.daily_equipment_inspections USING btree (inspection_date DESC);


--
-- Name: idx_daily_equipment_inspections_equipment_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_equipment_inspections_equipment_type ON public.daily_equipment_inspections USING btree (equipment_type);


--
-- Name: idx_daily_equipment_inspections_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_equipment_inspections_user_created ON public.daily_equipment_inspections USING btree (user_id, created_at DESC);


--
-- Name: idx_daily_equipment_inspections_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_equipment_inspections_user_date ON public.daily_equipment_inspections USING btree (user_id, inspection_date DESC);


--
-- Name: idx_daily_equipment_inspections_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_equipment_inspections_user_id ON public.daily_equipment_inspections USING btree (user_id);


--
-- Name: idx_daily_jsa_circuit_number_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_circuit_number_trgm ON public.daily_jsa USING gin (circuit_number public.gin_trgm_ops);


--
-- Name: idx_daily_jsa_employee_signature_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_employee_signature_trgm ON public.daily_jsa USING gin (employee_signature public.gin_trgm_ops);


--
-- Name: idx_daily_jsa_job_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_job_date ON public.daily_jsa USING btree (job_date DESC);


--
-- Name: idx_daily_jsa_jsa_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_jsa_type ON public.daily_jsa USING btree (jsa_type);


--
-- Name: idx_daily_jsa_shared_with_users; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_shared_with_users ON public.daily_jsa USING gin (shared_with_users);


--
-- Name: idx_daily_jsa_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_status ON public.daily_jsa USING btree (status);


--
-- Name: idx_daily_jsa_status_updated; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_status_updated ON public.daily_jsa USING btree (status, updated_at DESC);


--
-- Name: idx_daily_jsa_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_updated_at ON public.daily_jsa USING btree (updated_at DESC);


--
-- Name: idx_daily_jsa_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_user_id ON public.daily_jsa USING btree (user_id);


--
-- Name: idx_daily_jsa_work_location_trgm; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_daily_jsa_work_location_trgm ON public.daily_jsa USING gin (work_location public.gin_trgm_ops);


--
-- Name: idx_decisions_log_decision_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_decisions_log_decision_at ON public.tuning_decisions_log USING btree (decision_at DESC);


--
-- Name: idx_decisions_log_run_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_decisions_log_run_id ON public.tuning_decisions_log USING btree (tuning_run_id);


--
-- Name: idx_drawings_year_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drawings_year_month ON public.monthly_reward_drawings USING btree (year, month DESC);


--
-- Name: idx_dvir_mechanic_cost; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvir_mechanic_cost ON public.dvir_reports USING btree (mechanic_cost) WHERE (mechanic_cost IS NOT NULL);


--
-- Name: idx_dvir_reports_created_at_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvir_reports_created_at_desc ON public.dvir_reports USING btree (created_at DESC);


--
-- Name: idx_dvir_reports_report_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvir_reports_report_date ON public.dvir_reports USING btree (report_date DESC);


--
-- Name: idx_dvir_reports_report_date_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvir_reports_report_date_created_at ON public.dvir_reports USING btree (report_date, created_at);


--
-- Name: idx_dvir_reports_truck_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvir_reports_truck_number ON public.dvir_reports USING btree (truck_number);


--
-- Name: idx_dvir_reports_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvir_reports_user_created ON public.dvir_reports USING btree (user_id, created_at DESC);


--
-- Name: idx_dvir_reports_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvir_reports_user_id ON public.dvir_reports USING btree (user_id);


--
-- Name: idx_dvir_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dvir_user_created ON public.dvir_reports USING btree (user_id, created_at DESC);


--
-- Name: INDEX idx_dvir_user_created; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_dvir_user_created IS 'Smart defaults: fast user DVIR history lookup (user_id + created_at DESC)';


--
-- Name: idx_ect_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ect_active ON public.external_certification_types USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_email_recipient_lists_created_by_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_recipient_lists_created_by_user_id ON public.email_recipient_lists USING btree (created_by_user_id);


--
-- Name: idx_email_recipients_list_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_recipients_list_key ON public.email_recipient_lists USING btree (list_key);


--
-- Name: idx_email_send_log_sent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_send_log_sent_at ON public.email_send_log USING btree (sent_at DESC);


--
-- Name: idx_equipment_mechanic_cost; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_equipment_mechanic_cost ON public.daily_equipment_inspections USING btree (mechanic_cost) WHERE (mechanic_cost IS NOT NULL);


--
-- Name: idx_job_crew_assignments_assigned_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_crew_assignments_assigned_by ON public.job_crew_assignments USING btree (assigned_by);


--
-- Name: idx_job_crew_assignments_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_crew_assignments_job_id ON public.job_crew_assignments USING btree (job_id);


--
-- Name: idx_job_crew_assignments_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_crew_assignments_user_id ON public.job_crew_assignments USING btree (user_id);


--
-- Name: idx_job_crew_assignments_user_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_crew_assignments_user_job ON public.job_crew_assignments USING btree (user_id, job_id);


--
-- Name: idx_job_milestones_completed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_milestones_completed_by ON public.job_milestones USING btree (completed_by);


--
-- Name: idx_job_milestones_completion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_milestones_completion ON public.job_milestones USING btree (is_completed, completed_at);


--
-- Name: idx_job_milestones_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_milestones_job_id ON public.job_milestones USING btree (job_id);


--
-- Name: idx_job_milestones_job_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_milestones_job_sort ON public.job_milestones USING btree (job_id, sort_order);


--
-- Name: INDEX idx_job_milestones_job_sort; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_job_milestones_job_sort IS 'Index for job milestone sorting. Duplicate idx_job_milestones_sort_order was removed.';


--
-- Name: idx_job_progress_trackers_circuit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_trackers_circuit ON public.job_progress_trackers USING btree (circuit);


--
-- Name: idx_job_progress_trackers_created_at_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_trackers_created_at_desc ON public.job_progress_trackers USING btree (created_at DESC);


--
-- Name: idx_job_progress_trackers_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_trackers_created_by ON public.job_progress_trackers USING btree (created_by);


--
-- Name: idx_job_progress_trackers_crew_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_trackers_crew_id ON public.job_progress_trackers USING btree (crew_id) WHERE (crew_id IS NOT NULL);


--
-- Name: idx_job_progress_trackers_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_trackers_dates ON public.job_progress_trackers USING btree (start_date, end_date);


--
-- Name: idx_job_progress_trackers_group; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_trackers_group ON public.job_progress_trackers USING btree (job_group_id) WHERE (job_group_id IS NOT NULL);


--
-- Name: idx_job_progress_trackers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_trackers_status ON public.job_progress_trackers USING btree (status);


--
-- Name: idx_job_progress_trackers_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_trackers_status_created ON public.job_progress_trackers USING btree (status, created_at DESC);


--
-- Name: idx_job_progress_trackers_tracking_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_trackers_tracking_type ON public.job_progress_trackers USING btree (tracking_type);


--
-- Name: idx_job_progress_updates_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_updates_date ON public.job_progress_updates USING btree (date);


--
-- Name: idx_job_progress_updates_job_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_updates_job_date ON public.job_progress_updates USING btree (job_id, date DESC, created_at DESC);


--
-- Name: idx_job_progress_updates_job_date_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_updates_job_date_desc ON public.job_progress_updates USING btree (job_id, date DESC);


--
-- Name: idx_job_progress_updates_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_updates_job_id ON public.job_progress_updates USING btree (job_id);


--
-- Name: idx_job_progress_updates_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_updates_user_id ON public.job_progress_updates USING btree (user_id);


--
-- Name: idx_job_progress_work_site; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_progress_work_site ON public.job_progress_trackers USING btree (work_site_id) WHERE (work_site_id IS NOT NULL);


--
-- Name: idx_jsa_sharing_audit_changed_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jsa_sharing_audit_changed_at ON public.jsa_sharing_audit USING btree (changed_at DESC);


--
-- Name: idx_jsa_sharing_audit_changed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jsa_sharing_audit_changed_by ON public.jsa_sharing_audit USING btree (changed_by);


--
-- Name: idx_jsa_sharing_audit_jsa_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jsa_sharing_audit_jsa_id ON public.jsa_sharing_audit USING btree (jsa_id);


--
-- Name: idx_jsa_sharing_audit_shared_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jsa_sharing_audit_shared_user_id ON public.jsa_sharing_audit USING btree (shared_user_id);


--
-- Name: idx_jsa_user_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jsa_user_created ON public.daily_jsa USING btree (user_id, created_at DESC);


--
-- Name: INDEX idx_jsa_user_created; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX public.idx_jsa_user_created IS 'Smart defaults: fast user JSA history lookup (user_id + created_at DESC)';


--
-- Name: idx_maintenance_log_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_log_created ON public.vehicle_maintenance_log USING btree (created_at DESC);


--
-- Name: idx_maintenance_log_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_log_date ON public.vehicle_maintenance_log USING btree (service_date DESC);


--
-- Name: idx_maintenance_log_truck; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_log_truck ON public.vehicle_maintenance_log USING btree (truck_number);


--
-- Name: idx_maintenance_log_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_log_type ON public.vehicle_maintenance_log USING btree (maintenance_type);


--
-- Name: idx_maintenance_log_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_log_user ON public.vehicle_maintenance_log USING btree (performed_by_user_id);


--
-- Name: idx_mass_sms_log_created_at_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mass_sms_log_created_at_status ON public.mass_sms_log USING btree (created_at DESC) WHERE (status = 'completed'::text);


--
-- Name: idx_mileage_anomalies_resolved_by_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mileage_anomalies_resolved_by_user_id ON public.mileage_anomalies USING btree (resolved_by_user_id);


--
-- Name: idx_monthly_summary_send_log_month_success; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_monthly_summary_send_log_month_success ON public.monthly_summary_send_log USING btree (month_label) WHERE (success = true);


--
-- Name: idx_monthly_summary_send_log_sent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_monthly_summary_send_log_sent_at ON public.monthly_summary_send_log USING btree (sent_at DESC);


--
-- Name: idx_notification_events_actor_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_events_actor_user_id ON public.notification_events USING btree (actor_user_id);


--
-- Name: idx_notification_events_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_events_category ON public.notification_events USING btree (category, created_at);


--
-- Name: idx_notification_events_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_events_created ON public.notification_events USING btree (created_at DESC);


--
-- Name: idx_notification_events_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_events_target ON public.notification_events USING btree (target_type, target_ref);


--
-- Name: idx_notification_outbox_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_outbox_event ON public.notification_outbox USING btree (event_id);


--
-- Name: idx_notification_outbox_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_outbox_pending ON public.notification_outbox USING btree (status, scheduled_for) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: idx_notification_outbox_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_outbox_user ON public.notification_outbox USING btree (user_id, created_at);


--
-- Name: idx_notification_preferences_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notification_preferences_user ON public.notification_preferences USING btree (user_id);


--
-- Name: idx_osha_compliance_mapping_regulation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_osha_compliance_mapping_regulation ON public.osha_compliance_mapping USING btree (osha_regulation);


--
-- Name: idx_payroll_reminder_sms_log_date_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_payroll_reminder_sms_log_date_tier ON public.payroll_reminder_sms_log USING btree (date_checked, tier);


--
-- Name: idx_payroll_reminder_sms_log_sent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payroll_reminder_sms_log_sent_at ON public.payroll_reminder_sms_log USING btree (sent_at DESC);


--
-- Name: idx_point_awarder_grants_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_point_awarder_grants_user ON public.point_awarder_grants USING btree (user_id);


--
-- Name: idx_point_tx_raffle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_point_tx_raffle ON public.point_transactions USING btree (user_id, created_at) WHERE counts_toward_raffle;


--
-- Name: idx_point_tx_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_point_tx_source ON public.point_transactions USING btree (source);


--
-- Name: idx_point_tx_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_point_tx_user ON public.point_transactions USING btree (user_id);


--
-- Name: idx_point_tx_user_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_point_tx_user_time ON public.point_transactions USING btree (user_id, created_at DESC);


--
-- Name: idx_practical_evaluations_evaluator; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_practical_evaluations_evaluator ON public.practical_evaluations USING btree (evaluator_id);


--
-- Name: idx_practical_evaluations_user_cert; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_practical_evaluations_user_cert ON public.practical_evaluations USING btree (user_id, certification_type_id);


--
-- Name: idx_push_subscriptions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_push_subscriptions_active ON public.push_subscriptions USING btree (revoked_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_push_subscriptions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id) WHERE (revoked_at IS NULL);


--
-- Name: idx_redemptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_redemptions_status ON public.redemptions USING btree (status, requested_at DESC);


--
-- Name: idx_redemptions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_redemptions_user ON public.redemptions USING btree (user_id, requested_at DESC);


--
-- Name: idx_reward_catalog_active_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reward_catalog_active_sort ON public.reward_catalog USING btree (is_active, sort_order) WHERE is_active;


--
-- Name: idx_rewards_year_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rewards_year_month ON public.monthly_safety_rewards USING btree (year, month DESC);


--
-- Name: idx_risk_algorithm_config_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_risk_algorithm_config_created_by ON public.risk_algorithm_config USING btree (created_by);


--
-- Name: idx_risk_score_history_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_risk_score_history_date ON public.risk_score_history USING btree (date_for DESC);


--
-- Name: idx_risk_score_history_date_site; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_risk_score_history_date_site ON public.risk_score_history USING btree (date_for DESC, work_site_id);


--
-- Name: idx_risk_score_history_forecast_run_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_risk_score_history_forecast_run_id ON public.risk_score_history USING btree (forecast_run_id);


--
-- Name: idx_risk_score_history_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_risk_score_history_level ON public.risk_score_history USING btree (risk_level);


--
-- Name: idx_risk_score_history_version; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_risk_score_history_version ON public.risk_score_history USING btree (algorithm_version);


--
-- Name: idx_rto_requests_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rto_requests_email ON public.rto_requests USING btree (email);


--
-- Name: idx_rto_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rto_requests_status ON public.rto_requests USING btree (status);


--
-- Name: idx_rto_requests_status_submitted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rto_requests_status_submitted ON public.rto_requests USING btree (status, submitted_at DESC);


--
-- Name: idx_rto_requests_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rto_requests_submitted_at ON public.rto_requests USING btree (submitted_at);


--
-- Name: idx_rto_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rto_requests_user_id ON public.rto_requests USING btree (user_id);


--
-- Name: idx_rto_submitted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rto_submitted_at ON public.rto_requests USING btree (submitted_at DESC);


--
-- Name: idx_safety_announcements_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_announcements_created_at ON public.safety_announcements USING btree (created_at DESC);


--
-- Name: idx_safety_announcements_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_announcements_created_by ON public.safety_announcements USING btree (created_by);


--
-- Name: idx_safety_announcements_published_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_announcements_published_at ON public.safety_announcements USING btree (published_at DESC);


--
-- Name: idx_safety_announcements_published_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_announcements_published_by ON public.safety_announcements USING btree (published_by);


--
-- Name: idx_safety_announcements_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_announcements_status ON public.safety_announcements USING btree (status);


--
-- Name: idx_safety_audit_log_event_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_audit_log_event_type ON public.safety_audit_log USING btree (event_type);


--
-- Name: idx_safety_audit_log_occurred_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_audit_log_occurred_at ON public.safety_audit_log USING btree (occurred_at DESC);


--
-- Name: idx_safety_audit_log_table_record; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_audit_log_table_record ON public.safety_audit_log USING btree (table_name, record_id);


--
-- Name: idx_safety_audit_log_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_audit_log_user_id ON public.safety_audit_log USING btree (user_id);


--
-- Name: idx_safety_flags_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_flags_created_at ON public.safety_flags USING btree (created_at DESC);


--
-- Name: idx_safety_flags_form; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_flags_form ON public.safety_flags USING btree (form_type, form_id);


--
-- Name: idx_safety_flags_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_flags_status ON public.safety_flags USING btree (status);


--
-- Name: idx_safety_incidents_corrective_actions_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_incidents_corrective_actions_by ON public.safety_incidents USING btree (corrective_actions_by);


--
-- Name: idx_safety_incidents_crew_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_incidents_crew_id ON public.safety_incidents USING btree (crew_id) WHERE (crew_id IS NOT NULL);


--
-- Name: idx_safety_incidents_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_incidents_date ON public.safety_incidents USING btree (incident_date DESC);


--
-- Name: idx_safety_incidents_job_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_incidents_job_id ON public.safety_incidents USING btree (job_id) WHERE (job_id IS NOT NULL);


--
-- Name: idx_safety_incidents_predicted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_incidents_predicted ON public.safety_incidents USING btree (predicted_risk_score_id);


--
-- Name: idx_safety_incidents_reported_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_incidents_reported_by ON public.safety_incidents USING btree (reported_by);


--
-- Name: idx_safety_incidents_severity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_incidents_severity ON public.safety_incidents USING btree (severity);


--
-- Name: idx_safety_incidents_site; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_incidents_site ON public.safety_incidents USING btree (work_site_id);


--
-- Name: idx_safety_incidents_supervisor_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_safety_incidents_supervisor_id ON public.safety_incidents USING btree (supervisor_id) WHERE (supervisor_id IS NOT NULL);


--
-- Name: idx_schedules_mileage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_schedules_mileage ON public.maintenance_schedules USING btree (current_mileage);


--
-- Name: idx_schedules_truck; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_schedules_truck ON public.maintenance_schedules USING btree (truck_number);


--
-- Name: idx_sms_escalation_recipients_tier_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sms_escalation_recipients_tier_active ON public.sms_escalation_recipients USING btree (tier, is_active) WHERE (is_active = true);


--
-- Name: idx_sms_escalation_send_log_sent_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sms_escalation_send_log_sent_at ON public.sms_escalation_send_log USING btree (sent_at DESC);


--
-- Name: idx_sms_escalation_send_log_tier_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sms_escalation_send_log_tier_date ON public.sms_escalation_send_log USING btree (tier, date_checked);


--
-- Name: idx_storage_cleanup_unprocessed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_storage_cleanup_unprocessed ON public.storage_cleanup_queue USING btree (created_at) WHERE (processed_at IS NULL);


--
-- Name: idx_telemetry_events_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telemetry_events_created_at ON public.telemetry_events USING btree (created_at DESC);


--
-- Name: idx_telemetry_events_dashboard; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telemetry_events_dashboard ON public.telemetry_events USING btree (created_at DESC, event_name, form_type);


--
-- Name: idx_telemetry_events_event_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telemetry_events_event_name ON public.telemetry_events USING btree (event_name);


--
-- Name: idx_telemetry_events_form_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telemetry_events_form_type ON public.telemetry_events USING btree (form_type) WHERE (form_type IS NOT NULL);


--
-- Name: idx_telemetry_events_session_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telemetry_events_session_id ON public.telemetry_events USING btree (session_id);


--
-- Name: idx_telemetry_events_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telemetry_events_user_id ON public.telemetry_events USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_tuning_decisions_log_admin_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tuning_decisions_log_admin_user_id ON public.tuning_decisions_log USING btree (admin_user_id);


--
-- Name: idx_tuning_runs_status_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tuning_runs_status_started ON public.algorithm_tuning_runs USING btree (status, started_at DESC);


--
-- Name: idx_user_absences_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_absences_date ON public.user_absences USING btree (date);


--
-- Name: idx_user_absences_user_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_absences_user_date ON public.user_absences USING btree (user_id, date);


--
-- Name: idx_user_activity_sessions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_activity_sessions_active ON public.user_activity_sessions USING btree (status, last_seen_at DESC) WHERE (status = 'active'::text);


--
-- Name: idx_user_activity_sessions_last_seen; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_activity_sessions_last_seen ON public.user_activity_sessions USING btree (last_seen_at DESC);


--
-- Name: idx_user_activity_sessions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_activity_sessions_status ON public.user_activity_sessions USING btree (status);


--
-- Name: idx_user_activity_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_activity_sessions_user_id ON public.user_activity_sessions USING btree (user_id);


--
-- Name: idx_user_contact_templates_default; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_contact_templates_default ON public.user_contact_templates USING btree (user_id, is_default) WHERE (is_default = true);


--
-- Name: idx_user_contact_templates_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_contact_templates_user_id ON public.user_contact_templates USING btree (user_id);


--
-- Name: idx_user_mgmt_log_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_mgmt_log_created_at ON public.user_management_log USING btree (created_at DESC);


--
-- Name: idx_user_mgmt_log_performed_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_mgmt_log_performed_by ON public.user_management_log USING btree (performed_by_user_id);


--
-- Name: idx_user_mgmt_log_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_mgmt_log_target ON public.user_management_log USING btree (target_user_id);


--
-- Name: idx_user_saved_locations_usage; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_saved_locations_usage ON public.user_saved_locations USING btree (user_id, use_count DESC);


--
-- Name: idx_user_saved_locations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_saved_locations_user_id ON public.user_saved_locations USING btree (user_id);


--
-- Name: idx_wec_expiration; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wec_expiration ON public.worker_external_certifications USING btree (expiration_date) WHERE (status = 'active'::text);


--
-- Name: idx_wec_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wec_type_id ON public.worker_external_certifications USING btree (external_certification_type_id);


--
-- Name: idx_wec_unique_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_wec_unique_active ON public.worker_external_certifications USING btree (user_id, external_certification_type_id) WHERE (status = ANY (ARRAY['active'::text, 'pending_verification'::text]));


--
-- Name: idx_wec_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wec_user_id ON public.worker_external_certifications USING btree (user_id);


--
-- Name: idx_weekly_safety_reports_week_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_weekly_safety_reports_week_start ON public.weekly_safety_reports USING btree (week_start_date DESC);


--
-- Name: idx_work_sites_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_sites_active ON public.work_sites USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_work_sites_coords; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_sites_coords ON public.work_sites USING btree (latitude, longitude);


--
-- Name: idx_work_sites_crew_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_sites_crew_id ON public.work_sites USING btree (crew_id) WHERE (crew_id IS NOT NULL);


--
-- Name: idx_work_sites_region; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_work_sites_region ON public.work_sites USING btree (region) WHERE (region IS NOT NULL);


--
-- Name: idx_work_sites_unique_coords; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_work_sites_unique_coords ON public.work_sites USING btree (round((latitude)::numeric, 4), round((longitude)::numeric, 4));


--
-- Name: uq_active_grant_per_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_active_grant_per_user ON public.point_awarder_grants USING btree (user_id) WHERE (revoked_at IS NULL);


--
-- Name: uq_point_tx_manual_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_point_tx_manual_request ON public.point_transactions USING btree (request_id) WHERE ((source = 'manual_award'::public.point_source) AND (request_id IS NOT NULL));


--
-- Name: uq_point_tx_redemption_hold; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_point_tx_redemption_hold ON public.point_transactions USING btree (reference_id) WHERE ((source = 'redemption'::public.point_source) AND (reference_table = 'redemptions'::text));


--
-- Name: uq_point_tx_redemption_refund; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_point_tx_redemption_refund ON public.point_transactions USING btree (reference_id) WHERE ((source = 'adjustment'::public.point_source) AND (reference_table = 'redemptions'::text));


--
-- Name: uq_point_tx_source_ref; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_point_tx_source_ref ON public.point_transactions USING btree (source, reference_id, category) NULLS NOT DISTINCT WHERE ((reference_id IS NOT NULL) AND (source = ANY (ARRAY['announcement_claim'::public.point_source, 'compliance_form'::public.point_source, 'certification'::public.point_source, 'near_miss_report'::public.point_source])));


--
-- Name: uq_point_tx_streak_bonus; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_point_tx_streak_bonus ON public.point_transactions USING btree (user_id, source, category) WHERE (source = 'streak_bonus'::public.point_source);


--
-- Name: uq_redemptions_user_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_redemptions_user_request ON public.redemptions USING btree (user_id, request_id);


--
-- Name: user_certification_matrix_certification_type_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_certification_matrix_certification_type_id_idx ON public.user_certification_matrix USING btree (certification_type_id);


--
-- Name: user_certification_matrix_compliance_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_certification_matrix_compliance_status_idx ON public.user_certification_matrix USING btree (compliance_status);


--
-- Name: user_certification_matrix_user_id_certification_type_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_certification_matrix_user_id_certification_type_id_idx ON public.user_certification_matrix USING btree (user_id, certification_type_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: users on_user_created_create_notification_prefs; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER on_user_created_create_notification_prefs AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_preferences();


--
-- Name: users trigger_anonymize_telemetry_on_user_delete; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER trigger_anonymize_telemetry_on_user_delete BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.anonymize_user_telemetry();


--
-- Name: daily_jsa Daily JSA webhook; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER "Daily JSA webhook" AFTER INSERT OR DELETE OR UPDATE ON public.daily_jsa FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://hook.us2.make.com/tuqihhxv43dca1i7m8i7ogwlsdineytp', 'POST', '{"Content-type":"application/json"}', '{}', '5000');


--
-- Name: dvir_reports enforce_dvir_user_id_immutability; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_dvir_user_id_immutability BEFORE UPDATE ON public.dvir_reports FOR EACH ROW EXECUTE FUNCTION public.prevent_dvir_user_id_change();


--
-- Name: daily_equipment_inspections enforce_equipment_user_id_immutability; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_equipment_user_id_immutability BEFORE UPDATE ON public.daily_equipment_inspections FOR EACH ROW EXECUTE FUNCTION public.prevent_equipment_user_id_change();


--
-- Name: daily_jsa enforce_jsa_user_id_immutability; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_jsa_user_id_immutability BEFORE UPDATE ON public.daily_jsa FOR EACH ROW EXECUTE FUNCTION public.prevent_jsa_user_id_change();


--
-- Name: announcement_rewards enforce_latest_announcement_claim; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER enforce_latest_announcement_claim BEFORE INSERT ON public.announcement_rewards FOR EACH ROW EXECUTE FUNCTION public.check_latest_announcement_claim();


--
-- Name: user_contact_templates ensure_single_default_contact; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER ensure_single_default_contact BEFORE INSERT OR UPDATE ON public.user_contact_templates FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_contact_template();


--
-- Name: notification_events notification_events_dispatch_on_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER notification_events_dispatch_on_insert AFTER INSERT ON public.notification_events FOR EACH ROW EXECUTE FUNCTION public.notification_events_dispatch_webhook();


--
-- Name: notification_preferences notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_notification_preferences_updated_at();


--
-- Name: app_users notify_admins_on_new_signup; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER notify_admins_on_new_signup AFTER INSERT ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_signup_webhook();


--
-- Name: email_recipient_lists prevent_empty_recipient_list; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER prevent_empty_recipient_list BEFORE DELETE ON public.email_recipient_lists FOR EACH ROW EXECUTE FUNCTION public.check_min_recipients();


--
-- Name: daily_jsa set_daily_jsa_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_daily_jsa_updated_at BEFORE UPDATE ON public.daily_jsa FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: monthly_safety_rewards set_monthly_safety_rewards_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_monthly_safety_rewards_updated_at BEFORE UPDATE ON public.monthly_safety_rewards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: external_certification_types set_updated_at_external_cert_types; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_external_cert_types BEFORE UPDATE ON public.external_certification_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: worker_external_certifications set_updated_at_worker_ext_certs; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_updated_at_worker_ext_certs BEFORE UPDATE ON public.worker_external_certifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: sms_escalation_recipients sms_escalation_recipients_trim_phone_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER sms_escalation_recipients_trim_phone_trigger BEFORE INSERT OR UPDATE OF phone_e164 ON public.sms_escalation_recipients FOR EACH ROW EXECUTE FUNCTION public.sms_escalation_recipients_trim_phone();


--
-- Name: app_settings trg_app_settings_audit; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_app_settings_audit AFTER UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.audit_app_settings();


--
-- Name: app_settings trg_app_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.app_settings_touch_updated_at();


--
-- Name: attendance_summaries trg_attendance_summaries_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_attendance_summaries_updated_at BEFORE UPDATE ON public.attendance_summaries FOR EACH ROW EXECUTE FUNCTION public.set_daily_attendance_updated_at();


--
-- Name: TRIGGER trg_attendance_summaries_updated_at ON attendance_summaries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TRIGGER trg_attendance_summaries_updated_at ON public.attendance_summaries IS 'Reuses set_daily_attendance_updated_at() for NEW.updated_at = now(); function name is legacy, logic is generic.';


--
-- Name: certification_records trg_award_certification_points; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_award_certification_points AFTER INSERT OR UPDATE OF status, practical_evaluation_id, written_attempt_id, expires_at ON public.certification_records FOR EACH ROW EXECUTE FUNCTION public.award_certification_points();


--
-- Name: safety_incidents trg_award_near_miss_base_points; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_award_near_miss_base_points AFTER INSERT ON public.safety_incidents FOR EACH ROW EXECUTE FUNCTION public.award_near_miss_base_points();


--
-- Name: corrective_actions trg_award_near_miss_corrective_bonus; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_award_near_miss_corrective_bonus AFTER UPDATE ON public.corrective_actions FOR EACH ROW EXECUTE FUNCTION public.award_near_miss_corrective_bonus();


--
-- Name: daily_jsa trg_cleanup_jsa_photos; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_cleanup_jsa_photos AFTER DELETE ON public.daily_jsa FOR EACH ROW EXECUTE FUNCTION public.cleanup_jsa_photos();


--
-- Name: daily_attendance trg_daily_attendance_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_daily_attendance_updated_at BEFORE UPDATE ON public.daily_attendance FOR EACH ROW EXECUTE FUNCTION public.set_daily_attendance_updated_at();


--
-- Name: mileage_anomalies trg_normalize_anomaly_truck_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_normalize_anomaly_truck_number BEFORE INSERT OR UPDATE ON public.mileage_anomalies FOR EACH ROW EXECUTE FUNCTION public.normalize_truck_number();


--
-- Name: vehicle_maintenance_log trg_normalize_maintenance_truck_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_normalize_maintenance_truck_number BEFORE INSERT OR UPDATE ON public.vehicle_maintenance_log FOR EACH ROW EXECUTE FUNCTION public.normalize_truck_number();


--
-- Name: maintenance_schedules trg_normalize_schedule_truck_number; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_normalize_schedule_truck_number BEFORE INSERT OR UPDATE ON public.maintenance_schedules FOR EACH ROW EXECUTE FUNCTION public.normalize_truck_number();


--
-- Name: rto_requests trg_rto_approved_sync; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_rto_approved_sync AFTER UPDATE ON public.rto_requests FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION public.sync_rto_approval_to_attendance();


--
-- Name: announcement_rewards trg_sync_announcement_reward_to_ledger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_announcement_reward_to_ledger AFTER INSERT ON public.announcement_rewards FOR EACH ROW EXECUTE FUNCTION public.sync_announcement_reward_to_ledger();


--
-- Name: daily_attendance trg_sync_attendance_to_absences; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_attendance_to_absences AFTER INSERT OR DELETE OR UPDATE ON public.daily_attendance FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_to_absences();


--
-- Name: compliance_rewards trg_sync_compliance_reward_to_ledger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_compliance_reward_to_ledger AFTER INSERT ON public.compliance_rewards FOR EACH ROW EXECUTE FUNCTION public.sync_compliance_reward_to_ledger();


--
-- Name: certification_records trg_sync_electrical_level; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_electrical_level AFTER INSERT OR UPDATE OF status ON public.certification_records FOR EACH ROW EXECUTE FUNCTION public.sync_electrical_qualification_level();


--
-- Name: announcement_rewards trg_sync_streak_bonus_to_ledger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_sync_streak_bonus_to_ledger AFTER INSERT ON public.announcement_rewards FOR EACH ROW EXECUTE FUNCTION public.trg_sync_streak_bonus_to_ledger();


--
-- Name: dvir_reports trg_update_schedule_from_dvir; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_schedule_from_dvir AFTER INSERT ON public.dvir_reports FOR EACH ROW EXECUTE FUNCTION public.update_schedule_mileage_from_dvir();


--
-- Name: vehicle_maintenance_log trg_update_schedule_on_maintenance_log; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_schedule_on_maintenance_log AFTER INSERT ON public.vehicle_maintenance_log FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_schedule_on_log();


--
-- Name: worker_external_certifications trg_worker_external_cert_notify; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_worker_external_cert_notify AFTER INSERT OR UPDATE OF status ON public.worker_external_certifications FOR EACH ROW EXECUTE FUNCTION public.notify_external_cert_grant_or_revoke();


--
-- Name: certification_access_grants trigger_certification_audit_log_access_revoke; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_certification_audit_log_access_revoke AFTER DELETE ON public.certification_access_grants FOR EACH ROW EXECUTE FUNCTION public.certification_audit_log_on_revoke();


--
-- Name: app_users trigger_certification_audit_log_qualification_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_certification_audit_log_qualification_change AFTER UPDATE ON public.app_users FOR EACH ROW WHEN ((old.electrical_qualification_level IS DISTINCT FROM new.electrical_qualification_level)) EXECUTE FUNCTION public.certification_audit_log_on_qualification_change();


--
-- Name: compliance_runs trigger_compliance_runs_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_compliance_runs_updated_at BEFORE UPDATE ON public.compliance_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: certification_attempts trigger_refresh_completion_stats_on_attempt_graded; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_refresh_completion_stats_on_attempt_graded AFTER UPDATE OF status, passed ON public.certification_attempts FOR EACH ROW WHEN (((old.status IS DISTINCT FROM 'graded'::text) AND (new.status = 'graded'::text))) EXECUTE FUNCTION public.refresh_certification_completion_stats();


--
-- Name: certification_records trigger_refresh_completion_stats_on_record_insert; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_refresh_completion_stats_on_record_insert AFTER INSERT ON public.certification_records FOR EACH ROW EXECUTE FUNCTION public.refresh_certification_completion_stats();


--
-- Name: announcement_rewards trigger_reward_claim_window; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_reward_claim_window BEFORE INSERT ON public.announcement_rewards FOR EACH ROW EXECUTE FUNCTION public.check_reward_claim_window();


--
-- Name: safety_announcements trigger_safety_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_announcements_updated_at BEFORE UPDATE ON public.safety_announcements FOR EACH ROW EXECUTE FUNCTION public.update_safety_announcements_updated_at();


--
-- Name: certification_records trigger_safety_audit_cert_records; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_audit_cert_records AFTER INSERT OR UPDATE ON public.certification_records FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();


--
-- Name: corrective_actions trigger_safety_audit_corrective_actions; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_audit_corrective_actions AFTER INSERT OR UPDATE ON public.corrective_actions FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();


--
-- Name: dvir_reports trigger_safety_audit_dvir; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_audit_dvir AFTER INSERT OR UPDATE ON public.dvir_reports FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();


--
-- Name: daily_equipment_inspections trigger_safety_audit_equipment; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_audit_equipment AFTER INSERT OR UPDATE ON public.daily_equipment_inspections FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();


--
-- Name: safety_incidents trigger_safety_audit_incident; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_audit_incident AFTER INSERT OR UPDATE ON public.safety_incidents FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();


--
-- Name: daily_jsa trigger_safety_audit_jsa; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_audit_jsa AFTER INSERT OR UPDATE ON public.daily_jsa FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();


--
-- Name: osha_300a_certifications trigger_safety_audit_osha_300a; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_audit_osha_300a AFTER INSERT OR UPDATE ON public.osha_300a_certifications FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_osha_300a();


--
-- Name: safety_flags trigger_safety_audit_safety_flags; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_audit_safety_flags AFTER INSERT OR UPDATE ON public.safety_flags FOR EACH ROW EXECUTE FUNCTION public.safety_audit_log_insert();


--
-- Name: safety_incidents trigger_safety_incidents_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_safety_incidents_updated_at BEFORE UPDATE ON public.safety_incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: dvir_reports trigger_set_dvir_report_date; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_set_dvir_report_date BEFORE INSERT ON public.dvir_reports FOR EACH ROW EXECUTE FUNCTION public.set_dvir_report_date();


--
-- Name: announcement_metadata trigger_update_announcement_metadata_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_announcement_metadata_updated_at BEFORE UPDATE ON public.announcement_metadata FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: announcements trigger_update_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: app_users trigger_update_app_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_app_users_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: certification_records trigger_update_certification_records_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_certification_records_updated_at BEFORE UPDATE ON public.certification_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: certification_types trigger_update_certification_types_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_certification_types_updated_at BEFORE UPDATE ON public.certification_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contact_requests trigger_update_contact_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_contact_requests_updated_at BEFORE UPDATE ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: daily_equipment_inspections trigger_update_daily_equipment_inspections_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_daily_equipment_inspections_updated_at BEFORE UPDATE ON public.daily_equipment_inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: dvir_reports trigger_update_dvir_reports_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_dvir_reports_updated_at BEFORE UPDATE ON public.dvir_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: job_milestones trigger_update_job_milestones_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_job_milestones_updated_at BEFORE UPDATE ON public.job_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: job_progress_trackers trigger_update_job_progress_trackers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_job_progress_trackers_updated_at BEFORE UPDATE ON public.job_progress_trackers FOR EACH ROW EXECUTE FUNCTION public.update_job_progress_trackers_updated_at();


--
-- Name: rto_requests trigger_update_rto_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_rto_requests_updated_at BEFORE UPDATE ON public.rto_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: safety_incidents trigger_validate_recordable_incident; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_validate_recordable_incident BEFORE INSERT OR UPDATE ON public.safety_incidents FOR EACH ROW EXECUTE FUNCTION public.validate_recordable_incident();


--
-- Name: corrective_actions update_corrective_actions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_corrective_actions_updated_at BEFORE UPDATE ON public.corrective_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: crews update_crews_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_crews_updated_at BEFORE UPDATE ON public.crews FOR EACH ROW EXECUTE FUNCTION public.update_crews_updated_at();


--
-- Name: user_activity_sessions update_user_activity_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_activity_sessions_updated_at BEFORE UPDATE ON public.user_activity_sessions FOR EACH ROW EXECUTE FUNCTION public.update_user_activity_updated_at();


--
-- Name: user_contact_templates update_user_contact_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_contact_templates_updated_at BEFORE UPDATE ON public.user_contact_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_preferences update_user_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_signatures update_user_signatures_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_signatures_updated_at BEFORE UPDATE ON public.user_signatures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: work_sites update_work_sites_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_work_sites_updated_at BEFORE UPDATE ON public.work_sites FOR EACH ROW EXECUTE FUNCTION public.update_work_sites_updated_at();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: announcement_rewards announcement_rewards_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcement_rewards
    ADD CONSTRAINT announcement_rewards_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_rewards announcement_rewards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcement_rewards
    ADD CONSTRAINT announcement_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: app_settings_audit app_settings_audit_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings_audit
    ADD CONSTRAINT app_settings_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: app_settings app_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: app_users app_users_electrical_qualification_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_electrical_qualification_verified_by_fkey FOREIGN KEY (electrical_qualification_verified_by) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: app_users app_users_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: app_users app_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: attendance_summaries attendance_summaries_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_summaries
    ADD CONSTRAINT attendance_summaries_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certification_access_grants certification_access_grants_certification_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_access_grants
    ADD CONSTRAINT certification_access_grants_certification_type_id_fkey FOREIGN KEY (certification_type_id) REFERENCES public.certification_types(id) ON DELETE CASCADE;


--
-- Name: certification_access_grants certification_access_grants_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_access_grants
    ADD CONSTRAINT certification_access_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certification_access_grants certification_access_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_access_grants
    ADD CONSTRAINT certification_access_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: certification_attempts certification_attempts_certification_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_certification_type_id_fkey FOREIGN KEY (certification_type_id) REFERENCES public.certification_types(id);


--
-- Name: certification_attempts certification_attempts_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certification_attempts certification_attempts_grading_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_grading_started_by_fkey FOREIGN KEY (grading_started_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certification_attempts certification_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_attempts
    ADD CONSTRAINT certification_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: certification_audit_log certification_audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_audit_log
    ADD CONSTRAINT certification_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certification_expiration_notifications certification_expiration_notific_external_certification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_expiration_notifications
    ADD CONSTRAINT certification_expiration_notific_external_certification_id_fkey FOREIGN KEY (external_certification_id) REFERENCES public.worker_external_certifications(id) ON DELETE CASCADE;


--
-- Name: certification_expiration_notifications certification_expiration_notificat_certification_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_expiration_notifications
    ADD CONSTRAINT certification_expiration_notificat_certification_record_id_fkey FOREIGN KEY (certification_record_id) REFERENCES public.certification_records(id) ON DELETE CASCADE;


--
-- Name: certification_questions certification_questions_certification_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_questions
    ADD CONSTRAINT certification_questions_certification_type_id_fkey FOREIGN KEY (certification_type_id) REFERENCES public.certification_types(id) ON DELETE CASCADE;


--
-- Name: certification_records certification_records_certification_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_records
    ADD CONSTRAINT certification_records_certification_type_id_fkey FOREIGN KEY (certification_type_id) REFERENCES public.certification_types(id);


--
-- Name: certification_records certification_records_certified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_records
    ADD CONSTRAINT certification_records_certified_by_fkey FOREIGN KEY (certified_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certification_records certification_records_practical_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_records
    ADD CONSTRAINT certification_records_practical_evaluation_id_fkey FOREIGN KEY (practical_evaluation_id) REFERENCES public.practical_evaluations(id);


--
-- Name: certification_records certification_records_renewal_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_records
    ADD CONSTRAINT certification_records_renewal_of_fkey FOREIGN KEY (renewal_of) REFERENCES public.certification_records(id);


--
-- Name: certification_records certification_records_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_records
    ADD CONSTRAINT certification_records_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certification_records certification_records_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_records
    ADD CONSTRAINT certification_records_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: certification_records certification_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_records
    ADD CONSTRAINT certification_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: certification_records certification_records_written_attempt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.certification_records
    ADD CONSTRAINT certification_records_written_attempt_id_fkey FOREIGN KEY (written_attempt_id) REFERENCES public.certification_attempts(id);


--
-- Name: company_calendar company_calendar_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.company_calendar
    ADD CONSTRAINT company_calendar_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: compliance_notifications compliance_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_notifications
    ADD CONSTRAINT compliance_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(user_id) ON DELETE CASCADE;


--
-- Name: compliance_rewards compliance_rewards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.compliance_rewards
    ADD CONSTRAINT compliance_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contact_requests contact_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_requests
    ADD CONSTRAINT contact_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: corrective_actions corrective_actions_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corrective_actions
    ADD CONSTRAINT corrective_actions_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: corrective_actions corrective_actions_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corrective_actions
    ADD CONSTRAINT corrective_actions_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: corrective_actions corrective_actions_incident_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corrective_actions
    ADD CONSTRAINT corrective_actions_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES public.safety_incidents(id) ON DELETE CASCADE;


--
-- Name: corrective_actions corrective_actions_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corrective_actions
    ADD CONSTRAINT corrective_actions_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: crew_members crew_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: crew_members crew_members_crew_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES public.crews(id) ON DELETE CASCADE;


--
-- Name: crew_members crew_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crew_members
    ADD CONSTRAINT crew_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: crews crews_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crews
    ADD CONSTRAINT crews_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: daily_attendance daily_attendance_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_attendance
    ADD CONSTRAINT daily_attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: daily_attendance daily_attendance_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_attendance
    ADD CONSTRAINT daily_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: daily_equipment_inspections daily_equipment_inspections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_equipment_inspections
    ADD CONSTRAINT daily_equipment_inspections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: daily_jsa daily_jsa_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_jsa
    ADD CONSTRAINT daily_jsa_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: dvir_reports dvir_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dvir_reports
    ADD CONSTRAINT dvir_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: email_recipient_lists email_recipient_lists_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_recipient_lists
    ADD CONSTRAINT email_recipient_lists_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: external_certification_types external_certification_types_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.external_certification_types
    ADD CONSTRAINT external_certification_types_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: job_crew_assignments job_crew_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_crew_assignments
    ADD CONSTRAINT job_crew_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: job_crew_assignments job_crew_assignments_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_crew_assignments
    ADD CONSTRAINT job_crew_assignments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_progress_trackers(id) ON DELETE CASCADE;


--
-- Name: job_crew_assignments job_crew_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_crew_assignments
    ADD CONSTRAINT job_crew_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: job_milestones job_milestones_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_milestones
    ADD CONSTRAINT job_milestones_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: job_milestones job_milestones_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_milestones
    ADD CONSTRAINT job_milestones_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_progress_trackers(id) ON DELETE CASCADE;


--
-- Name: job_progress_trackers job_progress_trackers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_progress_trackers
    ADD CONSTRAINT job_progress_trackers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: job_progress_trackers job_progress_trackers_crew_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_progress_trackers
    ADD CONSTRAINT job_progress_trackers_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES public.crews(id) ON DELETE SET NULL;


--
-- Name: job_progress_trackers job_progress_trackers_work_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_progress_trackers
    ADD CONSTRAINT job_progress_trackers_work_site_id_fkey FOREIGN KEY (work_site_id) REFERENCES public.work_sites(id) ON DELETE SET NULL;


--
-- Name: job_progress_updates job_progress_updates_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_progress_updates
    ADD CONSTRAINT job_progress_updates_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_progress_trackers(id) ON DELETE CASCADE;


--
-- Name: job_progress_updates job_progress_updates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_progress_updates
    ADD CONSTRAINT job_progress_updates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: jsa_sharing_audit jsa_sharing_audit_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jsa_sharing_audit
    ADD CONSTRAINT jsa_sharing_audit_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: jsa_sharing_audit jsa_sharing_audit_jsa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jsa_sharing_audit
    ADD CONSTRAINT jsa_sharing_audit_jsa_id_fkey FOREIGN KEY (jsa_id) REFERENCES public.daily_jsa(id) ON DELETE CASCADE;


--
-- Name: mass_sms_log mass_sms_log_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mass_sms_log
    ADD CONSTRAINT mass_sms_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: mileage_anomalies mileage_anomalies_dvir_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mileage_anomalies
    ADD CONSTRAINT mileage_anomalies_dvir_id_fkey FOREIGN KEY (dvir_id) REFERENCES public.dvir_reports(id) ON DELETE CASCADE;


--
-- Name: mileage_anomalies mileage_anomalies_resolved_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mileage_anomalies
    ADD CONSTRAINT mileage_anomalies_resolved_by_user_id_fkey FOREIGN KEY (resolved_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: monthly_reward_drawings monthly_reward_drawings_drawn_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_reward_drawings
    ADD CONSTRAINT monthly_reward_drawings_drawn_by_fkey FOREIGN KEY (drawn_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: monthly_reward_drawings monthly_reward_drawings_grand_prize_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_reward_drawings
    ADD CONSTRAINT monthly_reward_drawings_grand_prize_winner_id_fkey FOREIGN KEY (grand_prize_winner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: monthly_reward_drawings monthly_reward_drawings_reward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_reward_drawings
    ADD CONSTRAINT monthly_reward_drawings_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.monthly_safety_rewards(id) ON DELETE CASCADE;


--
-- Name: monthly_reward_drawings monthly_reward_drawings_runner_up_1_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_reward_drawings
    ADD CONSTRAINT monthly_reward_drawings_runner_up_1_winner_id_fkey FOREIGN KEY (runner_up_1_winner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: monthly_reward_drawings monthly_reward_drawings_runner_up_2_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_reward_drawings
    ADD CONSTRAINT monthly_reward_drawings_runner_up_2_winner_id_fkey FOREIGN KEY (runner_up_2_winner_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: monthly_safety_rewards monthly_safety_rewards_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_safety_rewards
    ADD CONSTRAINT monthly_safety_rewards_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: notification_events notification_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_events
    ADD CONSTRAINT notification_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: notification_outbox notification_outbox_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.notification_events(id) ON DELETE CASCADE;


--
-- Name: notification_outbox notification_outbox_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: point_awarder_grants point_awarder_grants_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_awarder_grants
    ADD CONSTRAINT point_awarder_grants_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id);


--
-- Name: point_awarder_grants point_awarder_grants_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_awarder_grants
    ADD CONSTRAINT point_awarder_grants_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id);


--
-- Name: point_awarder_grants point_awarder_grants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_awarder_grants
    ADD CONSTRAINT point_awarder_grants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: point_transactions point_transactions_awarded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_awarded_by_fkey FOREIGN KEY (awarded_by) REFERENCES auth.users(id);


--
-- Name: point_transactions point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: practical_evaluation_templates practical_evaluation_templates_certification_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_evaluation_templates
    ADD CONSTRAINT practical_evaluation_templates_certification_type_id_fkey FOREIGN KEY (certification_type_id) REFERENCES public.certification_types(id) ON DELETE CASCADE;


--
-- Name: practical_evaluations practical_evaluations_certification_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_evaluations
    ADD CONSTRAINT practical_evaluations_certification_type_id_fkey FOREIGN KEY (certification_type_id) REFERENCES public.certification_types(id);


--
-- Name: practical_evaluations practical_evaluations_evaluator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_evaluations
    ADD CONSTRAINT practical_evaluations_evaluator_id_fkey FOREIGN KEY (evaluator_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: practical_evaluations practical_evaluations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.practical_evaluations
    ADD CONSTRAINT practical_evaluations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: redemptions redemptions_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id);


--
-- Name: redemptions redemptions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.reward_catalog(id) ON DELETE RESTRICT;


--
-- Name: CONSTRAINT redemptions_item_id_fkey ON redemptions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON CONSTRAINT redemptions_item_id_fkey ON public.redemptions IS 'Prevents hard-deleting catalog items referenced by redemption history. Admins should deactivate (is_active=false) instead.';


--
-- Name: redemptions redemptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.redemptions
    ADD CONSTRAINT redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: reward_catalog reward_catalog_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reward_catalog
    ADD CONSTRAINT reward_catalog_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: risk_algorithm_config risk_algorithm_config_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_algorithm_config
    ADD CONSTRAINT risk_algorithm_config_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: risk_score_history risk_score_history_forecast_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_score_history
    ADD CONSTRAINT risk_score_history_forecast_run_id_fkey FOREIGN KEY (forecast_run_id) REFERENCES public.compliance_runs(id) ON DELETE SET NULL;


--
-- Name: risk_score_history risk_score_history_work_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.risk_score_history
    ADD CONSTRAINT risk_score_history_work_site_id_fkey FOREIGN KEY (work_site_id) REFERENCES public.work_sites(id) ON DELETE SET NULL;


--
-- Name: rto_requests rto_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rto_requests
    ADD CONSTRAINT rto_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: rto_requests rto_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rto_requests
    ADD CONSTRAINT rto_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: safety_announcements safety_announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_announcements
    ADD CONSTRAINT safety_announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: safety_announcements safety_announcements_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_announcements
    ADD CONSTRAINT safety_announcements_published_by_fkey FOREIGN KEY (published_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: safety_audit_log safety_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_audit_log
    ADD CONSTRAINT safety_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: safety_briefing_answer_items safety_briefing_answer_items_briefing_answer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_briefing_answer_items
    ADD CONSTRAINT safety_briefing_answer_items_briefing_answer_id_fkey FOREIGN KEY (briefing_answer_id) REFERENCES public.safety_briefing_answers(id) ON DELETE CASCADE;


--
-- Name: safety_briefing_answers safety_briefing_answers_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_briefing_answers
    ADD CONSTRAINT safety_briefing_answers_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: safety_briefing_answers safety_briefing_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_briefing_answers
    ADD CONSTRAINT safety_briefing_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: safety_flags safety_flags_flagged_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_flags
    ADD CONSTRAINT safety_flags_flagged_by_fkey FOREIGN KEY (flagged_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: safety_flags safety_flags_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_flags
    ADD CONSTRAINT safety_flags_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: safety_incidents safety_incidents_corrective_actions_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_incidents
    ADD CONSTRAINT safety_incidents_corrective_actions_by_fkey FOREIGN KEY (corrective_actions_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: safety_incidents safety_incidents_crew_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_incidents
    ADD CONSTRAINT safety_incidents_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES public.crews(id) ON DELETE SET NULL;


--
-- Name: safety_incidents safety_incidents_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_incidents
    ADD CONSTRAINT safety_incidents_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.job_progress_trackers(id) ON DELETE SET NULL;


--
-- Name: safety_incidents safety_incidents_predicted_risk_score_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_incidents
    ADD CONSTRAINT safety_incidents_predicted_risk_score_id_fkey FOREIGN KEY (predicted_risk_score_id) REFERENCES public.risk_score_history(id) ON DELETE SET NULL;


--
-- Name: safety_incidents safety_incidents_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_incidents
    ADD CONSTRAINT safety_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: safety_incidents safety_incidents_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_incidents
    ADD CONSTRAINT safety_incidents_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: safety_incidents safety_incidents_work_site_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.safety_incidents
    ADD CONSTRAINT safety_incidents_work_site_id_fkey FOREIGN KEY (work_site_id) REFERENCES public.work_sites(id) ON DELETE SET NULL;


--
-- Name: telemetry_events telemetry_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telemetry_events
    ADD CONSTRAINT telemetry_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tuning_decisions_log tuning_decisions_log_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tuning_decisions_log
    ADD CONSTRAINT tuning_decisions_log_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: tuning_decisions_log tuning_decisions_log_tuning_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tuning_decisions_log
    ADD CONSTRAINT tuning_decisions_log_tuning_run_id_fkey FOREIGN KEY (tuning_run_id) REFERENCES public.algorithm_tuning_runs(id) ON DELETE SET NULL;


--
-- Name: user_absences user_absences_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_absences
    ADD CONSTRAINT user_absences_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: user_absences user_absences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_absences
    ADD CONSTRAINT user_absences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_activity_sessions user_activity_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_activity_sessions
    ADD CONSTRAINT user_activity_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_contact_templates user_contact_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_contact_templates
    ADD CONSTRAINT user_contact_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_management_log user_management_log_performed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_management_log
    ADD CONSTRAINT user_management_log_performed_by_user_id_fkey FOREIGN KEY (performed_by_user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_saved_locations user_saved_locations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_saved_locations
    ADD CONSTRAINT user_saved_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_signatures user_signatures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_signatures
    ADD CONSTRAINT user_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: vehicle_maintenance_log vehicle_maintenance_log_performed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicle_maintenance_log
    ADD CONSTRAINT vehicle_maintenance_log_performed_by_user_id_fkey FOREIGN KEY (performed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: work_sites work_sites_crew_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_sites
    ADD CONSTRAINT work_sites_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES public.crews(id) ON DELETE SET NULL;


--
-- Name: worker_external_certifications worker_external_certification_external_certification_type__fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.worker_external_certifications
    ADD CONSTRAINT worker_external_certification_external_certification_type__fkey FOREIGN KEY (external_certification_type_id) REFERENCES public.external_certification_types(id) ON DELETE RESTRICT;


--
-- Name: worker_external_certifications worker_external_certifications_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.worker_external_certifications
    ADD CONSTRAINT worker_external_certifications_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: worker_external_certifications worker_external_certifications_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.worker_external_certifications
    ADD CONSTRAINT worker_external_certifications_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: worker_external_certifications worker_external_certifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.worker_external_certifications
    ADD CONSTRAINT worker_external_certifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: worker_external_certifications worker_external_certifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.worker_external_certifications
    ADD CONSTRAINT worker_external_certifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_reward_drawings Admins can delete drawings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete drawings" ON public.monthly_reward_drawings FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: monthly_safety_rewards Admins can delete rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete rewards" ON public.monthly_safety_rewards FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: monthly_reward_drawings Admins can insert drawings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert drawings" ON public.monthly_reward_drawings FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: monthly_safety_rewards Admins can insert rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert rewards" ON public.monthly_safety_rewards FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: crew_members Admins can manage crew members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage crew members" ON public.crew_members USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: crews Admins can manage crews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage crews" ON public.crews USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: work_sites Admins can manage work sites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage work sites" ON public.work_sites USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: safety_briefing_answers Admins can read all briefing answers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can read all briefing answers" ON public.safety_briefing_answers FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: safety_briefing_answer_items Admins can read all briefing items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can read all briefing items" ON public.safety_briefing_answer_items FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: point_transactions Admins can read all point transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can read all point transactions" ON public.point_transactions FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: monthly_summary_send_log Admins can read send log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can read send log" ON public.monthly_summary_send_log FOR SELECT USING (public.is_admin());


--
-- Name: monthly_reward_drawings Admins can update drawings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update drawings" ON public.monthly_reward_drawings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: monthly_safety_rewards Admins can update rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update rewards" ON public.monthly_safety_rewards FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: compliance_rewards Admins can view all rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all rewards" ON public.compliance_rewards FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: user_activity_sessions Admins can view all sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all sessions" ON public.user_activity_sessions FOR SELECT USING (public.is_admin());


--
-- Name: point_awarder_grants Admins manage awarder grants insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage awarder grants insert" ON public.point_awarder_grants FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: point_awarder_grants Admins manage awarder grants update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage awarder grants update" ON public.point_awarder_grants FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: reward_catalog Admins manage catalog delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage catalog delete" ON public.reward_catalog FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: reward_catalog Admins manage catalog insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage catalog insert" ON public.reward_catalog FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: reward_catalog Admins manage catalog update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage catalog update" ON public.reward_catalog FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: point_rules Admins manage point rules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage point rules" ON public.point_rules TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: rto_requests Allow anon to update pending RTO requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow anon to update pending RTO requests" ON public.rto_requests FOR UPDATE TO anon USING ((status = 'Pending'::text)) WITH CHECK (true);


--
-- Name: reward_catalog Authenticated read active catalog items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read active catalog items" ON public.reward_catalog FOR SELECT TO authenticated USING ((is_active OR public.is_admin()));


--
-- Name: point_rules Authenticated read point rules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated read point rules" ON public.point_rules FOR SELECT TO authenticated USING (true);


--
-- Name: crews Authenticated users can view active crews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view active crews" ON public.crews FOR SELECT USING (((auth.role() = 'authenticated'::text) AND (is_active = true)));


--
-- Name: work_sites Authenticated users can view active work sites; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view active work sites" ON public.work_sites FOR SELECT USING (((auth.role() = 'authenticated'::text) AND (is_active = true)));


--
-- Name: crew_members Authenticated users can view crew members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view crew members" ON public.crew_members FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: monthly_reward_drawings Authenticated users can view drawings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view drawings" ON public.monthly_reward_drawings FOR SELECT TO authenticated USING (true);


--
-- Name: monthly_safety_rewards Authenticated users can view rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can view rewards" ON public.monthly_safety_rewards FOR SELECT TO authenticated USING (true);


--
-- Name: notification_events Events full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Events full access" ON public.notification_events TO authenticated, service_role USING (((( SELECT auth.role() AS role) = 'service_role'::text) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text))))));


--
-- Name: notification_outbox Outbox select own or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Outbox select own or admin" ON public.notification_outbox FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text))))));


--
-- Name: notification_outbox Outbox service role full access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Outbox service role full access" ON public.notification_outbox TO service_role USING (true);


--
-- Name: notification_preferences Preferences manage own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Preferences manage own" ON public.notification_preferences TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notification_preferences Preferences service role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Preferences service role" ON public.notification_preferences TO service_role USING (true);


--
-- Name: announcement_rewards Rewards insert own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Rewards insert own" ON public.announcement_rewards FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND public.is_reward_claim_window()));


--
-- Name: announcement_rewards Rewards read own or admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Rewards read own or admin" ON public.announcement_rewards FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text))))));


--
-- Name: announcement_rewards Rewards update own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Rewards update own" ON public.announcement_rewards FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: compliance_rewards Service role can manage rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role can manage rewards" ON public.compliance_rewards USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: point_awarder_grants Service role full access awarder grants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access awarder grants" ON public.point_awarder_grants TO service_role USING (true) WITH CHECK (true);


--
-- Name: safety_briefing_answers Service role full access briefing answers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access briefing answers" ON public.safety_briefing_answers TO service_role USING (true) WITH CHECK (true);


--
-- Name: safety_briefing_answer_items Service role full access briefing items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access briefing items" ON public.safety_briefing_answer_items TO service_role USING (true) WITH CHECK (true);


--
-- Name: monthly_reward_drawings Service role full access drawings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access drawings" ON public.monthly_reward_drawings TO service_role USING (true) WITH CHECK (true);


--
-- Name: point_rules Service role full access point rules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access point rules" ON public.point_rules TO service_role USING (true) WITH CHECK (true);


--
-- Name: point_transactions Service role full access point transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access point transactions" ON public.point_transactions TO service_role USING (true) WITH CHECK (true);


--
-- Name: redemptions Service role full access redemptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access redemptions" ON public.redemptions TO service_role USING (true) WITH CHECK (true);


--
-- Name: reward_catalog Service role full access reward catalog; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access reward catalog" ON public.reward_catalog TO service_role USING (true) WITH CHECK (true);


--
-- Name: monthly_safety_rewards Service role full access rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role full access rewards" ON public.monthly_safety_rewards TO service_role USING (true) WITH CHECK (true);


--
-- Name: announcement_rewards Service role has full access to rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role has full access to rewards" ON public.announcement_rewards TO service_role USING (true) WITH CHECK (true);


--
-- Name: push_subscriptions Subscriptions manage own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Subscriptions manage own" ON public.push_subscriptions TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_subscriptions Subscriptions service role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Subscriptions service role" ON public.push_subscriptions TO service_role USING (true);


--
-- Name: safety_briefing_answers Users can insert own briefing answers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own briefing answers" ON public.safety_briefing_answers FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: safety_briefing_answer_items Users can insert own briefing items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own briefing items" ON public.safety_briefing_answer_items FOR INSERT TO authenticated WITH CHECK ((briefing_answer_id IN ( SELECT safety_briefing_answers.id
   FROM public.safety_briefing_answers
  WHERE (safety_briefing_answers.user_id = auth.uid()))));


--
-- Name: user_activity_sessions Users can insert their own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own sessions" ON public.user_activity_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_contact_templates Users can manage own contact templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own contact templates" ON public.user_contact_templates USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_preferences Users can manage own preferences; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own preferences" ON public.user_preferences USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_saved_locations Users can manage own saved locations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own saved locations" ON public.user_saved_locations USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_signatures Users can manage own signatures; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage own signatures" ON public.user_signatures USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: safety_briefing_answers Users can read own briefing answers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own briefing answers" ON public.safety_briefing_answers FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: safety_briefing_answer_items Users can read own briefing items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own briefing items" ON public.safety_briefing_answer_items FOR SELECT TO authenticated USING ((briefing_answer_id IN ( SELECT safety_briefing_answers.id
   FROM public.safety_briefing_answers
  WHERE (safety_briefing_answers.user_id = auth.uid()))));


--
-- Name: point_transactions Users can read own point transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read own point transactions" ON public.point_transactions FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: user_activity_sessions Users can update their own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own sessions" ON public.user_activity_sessions FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: compliance_rewards Users can view own rewards; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own rewards" ON public.compliance_rewards FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_activity_sessions Users can view their own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own sessions" ON public.user_activity_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: point_awarder_grants Users read own awarder grant; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own awarder grant" ON public.point_awarder_grants FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: redemptions Users read own redemptions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own redemptions" ON public.redemptions FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));


--
-- Name: app_settings admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admin_delete ON public.app_settings FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: app_settings admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admin_insert ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: app_settings_audit admin_read_audit; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admin_read_audit ON public.app_settings_audit FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: app_settings admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY admin_update ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: algorithm_tuning_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.algorithm_tuning_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_metadata; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.announcement_metadata ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_rewards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.announcement_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements announcements_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_delete_admin ON public.announcements FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: announcements announcements_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_insert_admin ON public.announcements FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text)))));


--
-- Name: announcements announcements_insert_service_role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_insert_service_role ON public.announcements FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: announcements announcements_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_select ON public.announcements FOR SELECT USING (true);


--
-- Name: announcements announcements_service_role_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_service_role_all ON public.announcements TO service_role USING (true) WITH CHECK (true);


--
-- Name: announcements announcements_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY announcements_update_admin ON public.announcements FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: mileage_anomalies anomalies_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY anomalies_delete ON public.mileage_anomalies FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: mileage_anomalies anomalies_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY anomalies_insert ON public.mileage_anomalies FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_mechanic()));


--
-- Name: mileage_anomalies anomalies_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY anomalies_select ON public.mileage_anomalies FOR SELECT TO authenticated USING ((public.is_admin() OR public.is_mechanic()));


--
-- Name: mileage_anomalies anomalies_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY anomalies_update ON public.mileage_anomalies FOR UPDATE TO authenticated USING ((public.is_admin() OR public.is_mechanic()));


--
-- Name: app_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: app_settings_audit; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_settings_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

--
-- Name: app_users app_users_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_users_insert_own ON public.app_users FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND ((role = 'employee'::text) OR (role IS NULL))));


--
-- Name: app_users app_users_select_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_users_select_policy ON public.app_users FOR SELECT TO authenticated USING (true);


--
-- Name: app_users app_users_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY app_users_update_admin ON public.app_users FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: POLICY app_users_update_admin ON app_users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY app_users_update_admin ON public.app_users IS 'Allows admins to update any user record using is_admin() function';


--
-- Name: attendance_summaries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.attendance_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_summaries attendance_summaries_leadership_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attendance_summaries_leadership_all ON public.attendance_summaries TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['admin'::text, 'general_foreman'::text, 'manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['admin'::text, 'general_foreman'::text, 'manager'::text]))))));


--
-- Name: attendance_summaries attendance_summaries_service_role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY attendance_summaries_service_role ON public.attendance_summaries TO service_role USING (true) WITH CHECK (true);


--
-- Name: app_settings authenticated_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY authenticated_read ON public.app_settings FOR SELECT TO authenticated USING (true);


--
-- Name: auto_tuning_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.auto_tuning_config ENABLE ROW LEVEL SECURITY;

--
-- Name: auto_tuning_config auto_tuning_config_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auto_tuning_config_admin_select ON public.auto_tuning_config FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: auto_tuning_config auto_tuning_config_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auto_tuning_config_admin_update ON public.auto_tuning_config FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: auto_tuning_config auto_tuning_config_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auto_tuning_config_service_all ON public.auto_tuning_config TO service_role WITH CHECK (true);


--
-- Name: certification_access_grants cert_access_grants_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_access_grants_admin_delete ON public.certification_access_grants FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: certification_access_grants cert_access_grants_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_access_grants_admin_insert ON public.certification_access_grants FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: certification_access_grants cert_access_grants_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_access_grants_admin_select ON public.certification_access_grants FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: certification_attempts cert_attempts_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_attempts_insert_own ON public.certification_attempts FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: certification_attempts cert_attempts_select_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_attempts_select_admin ON public.certification_attempts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: POLICY cert_attempts_select_admin ON certification_attempts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY cert_attempts_select_admin ON public.certification_attempts IS 'Admins can read all attempts for certification reports (pass rate, time-to-grade).';


--
-- Name: certification_attempts cert_attempts_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_attempts_select_own ON public.certification_attempts FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: certification_attempts cert_attempts_update_in_progress_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_attempts_update_in_progress_only ON public.certification_attempts FOR UPDATE TO authenticated USING (((user_id = auth.uid()) AND (status = 'in_progress'::text))) WITH CHECK (((user_id = auth.uid()) AND (status = 'in_progress'::text)));


--
-- Name: certification_expiration_notifications cert_expiration_notif_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_expiration_notif_admin_select ON public.certification_expiration_notifications FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: certification_questions cert_questions_no_direct_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_questions_no_direct_select ON public.certification_questions FOR SELECT TO authenticated USING (false);


--
-- Name: certification_records cert_records_insert_admin_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_records_insert_admin_only ON public.certification_records FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: certification_records cert_records_select_own_or_admin_gf; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_records_select_own_or_admin_gf ON public.certification_records FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['admin'::text, 'general_foreman'::text])))))));


--
-- Name: certification_records cert_records_update_admin_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_records_update_admin_only ON public.certification_records FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: certification_types cert_types_admin_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_types_admin_all ON public.certification_types TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: certification_types cert_types_select_by_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cert_types_select_by_access ON public.certification_types FOR SELECT TO authenticated USING (((is_active = true) AND public.user_has_certification_access(auth.uid(), id)));


--
-- Name: certification_access_grants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.certification_access_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_attempts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.certification_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.certification_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_audit_log certification_audit_log_admin_safety_officer_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY certification_audit_log_admin_safety_officer_select ON public.certification_audit_log FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['admin'::text, 'safety_officer'::text]))))));


--
-- Name: certification_expiration_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.certification_expiration_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_questions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.certification_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.certification_records ENABLE ROW LEVEL SECURITY;

--
-- Name: certification_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.certification_types ENABLE ROW LEVEL SECURITY;

--
-- Name: company_calendar; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.company_calendar ENABLE ROW LEVEL SECURITY;

--
-- Name: company_calendar company_calendar_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY company_calendar_admin_select ON public.company_calendar FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: company_calendar company_calendar_manage_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY company_calendar_manage_roles ON public.company_calendar TO authenticated USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['manager'::text, 'safety_officer'::text, 'general_foreman'::text, 'foreman'::text]))))))) WITH CHECK ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['manager'::text, 'safety_officer'::text, 'general_foreman'::text, 'foreman'::text])))))));


--
-- Name: company_calendar company_calendar_service_role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY company_calendar_service_role ON public.company_calendar TO service_role USING (true) WITH CHECK (true);


--
-- Name: compliance_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.compliance_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_notifications compliance_notifications_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compliance_notifications_admin_select ON public.compliance_notifications FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: compliance_notifications compliance_notifications_so_gf_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compliance_notifications_so_gf_select ON public.compliance_notifications FOR SELECT TO authenticated USING (public.is_admin_or_safety_or_gf());


--
-- Name: compliance_notifications compliance_notifications_user_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compliance_notifications_user_select_own ON public.compliance_notifications FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: compliance_rewards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.compliance_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_runs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.compliance_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_runs compliance_runs_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compliance_runs_admin_select ON public.compliance_runs FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: compliance_runs compliance_runs_so_gf_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY compliance_runs_so_gf_select ON public.compliance_runs FOR SELECT TO authenticated USING (public.is_admin_or_safety_or_gf());


--
-- Name: contact_requests contact_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY contact_delete_admin ON public.contact_requests FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'admin'::text)))));


--
-- Name: contact_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_requests contact_requests_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY contact_requests_insert ON public.contact_requests FOR INSERT TO authenticated WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: contact_requests contact_requests_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY contact_requests_select ON public.contact_requests FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text))))));


--
-- Name: corrective_actions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.corrective_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: corrective_actions corrective_actions_assignee; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY corrective_actions_assignee ON public.corrective_actions FOR SELECT TO authenticated USING ((assigned_to = auth.uid()));


--
-- Name: corrective_actions corrective_actions_assignee_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY corrective_actions_assignee_update ON public.corrective_actions FOR UPDATE TO authenticated USING ((assigned_to = auth.uid())) WITH CHECK ((assigned_to = auth.uid()));


--
-- Name: corrective_actions corrective_actions_management; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY corrective_actions_management ON public.corrective_actions TO authenticated USING (public.is_admin_or_safety_or_gf()) WITH CHECK (public.is_admin_or_safety_or_gf());


--
-- Name: job_crew_assignments crew_assignments_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY crew_assignments_delete ON public.job_crew_assignments FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text)))));


--
-- Name: job_crew_assignments crew_assignments_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY crew_assignments_insert ON public.job_crew_assignments FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text)))));


--
-- Name: job_crew_assignments crew_assignments_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY crew_assignments_select ON public.job_crew_assignments FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'foreman'::text])))))));


--
-- Name: job_crew_assignments crew_assignments_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY crew_assignments_update ON public.job_crew_assignments FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text)))));


--
-- Name: crew_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

--
-- Name: crews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_attendance; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_attendance daily_attendance_employee_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daily_attendance_employee_select_own ON public.daily_attendance FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: daily_attendance daily_attendance_leadership_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daily_attendance_leadership_all ON public.daily_attendance TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['admin'::text, 'general_foreman'::text, 'manager'::text, 'foreman'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['admin'::text, 'general_foreman'::text, 'manager'::text, 'foreman'::text]))))));


--
-- Name: daily_attendance daily_attendance_service_role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY daily_attendance_service_role ON public.daily_attendance TO service_role USING (true) WITH CHECK (true);


--
-- Name: daily_equipment_inspections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_equipment_inspections ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_jsa; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_jsa ENABLE ROW LEVEL SECURITY;

--
-- Name: data_retention_policies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: data_retention_policies data_retention_policies_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY data_retention_policies_admin_select ON public.data_retention_policies FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: tuning_decisions_log decisions_log_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY decisions_log_admin_select ON public.tuning_decisions_log FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: tuning_decisions_log decisions_log_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY decisions_log_service_all ON public.tuning_decisions_log TO service_role WITH CHECK (true);


--
-- Name: dvir_reports dvir_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY dvir_delete_admin ON public.dvir_reports FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'admin'::text)))));


--
-- Name: dvir_reports dvir_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY dvir_insert_own ON public.dvir_reports FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IS NULL)));


--
-- Name: dvir_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.dvir_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: dvir_reports dvir_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY dvir_select ON public.dvir_reports FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'foreman'::text, 'mechanic'::text])))))));


--
-- Name: dvir_reports dvir_update_own_or_privileged; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY dvir_update_own_or_privileged ON public.dvir_reports FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = ANY (ARRAY['admin'::text, 'mechanic'::text]))))))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = ANY (ARRAY['admin'::text, 'mechanic'::text])))))));


--
-- Name: external_certification_types ect_admin_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ect_admin_all ON public.external_certification_types TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: external_certification_types ect_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ect_select_authenticated ON public.external_certification_types FOR SELECT TO authenticated USING ((is_active = true));


--
-- Name: email_recipient_lists; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_recipient_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: email_recipient_lists email_recipients_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY email_recipients_delete ON public.email_recipient_lists FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: email_recipient_lists email_recipients_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY email_recipients_insert ON public.email_recipient_lists FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: email_recipient_lists email_recipients_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY email_recipients_select ON public.email_recipient_lists FOR SELECT TO authenticated USING (true);


--
-- Name: email_send_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_log email_send_log_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY email_send_log_admin_select ON public.email_send_log FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: daily_equipment_inspections equipment_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY equipment_delete_admin ON public.daily_equipment_inspections FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users au
  WHERE ((au.user_id = ( SELECT auth.uid() AS uid)) AND (au.role = 'admin'::text)))));


--
-- Name: daily_equipment_inspections equipment_inspection_fix_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY equipment_inspection_fix_update ON public.daily_equipment_inspections FOR UPDATE TO authenticated USING (public.is_admin_or_mechanic()) WITH CHECK ((public.is_admin_or_mechanic() AND (( SELECT (to_jsonb(original.*) - '{mechanic_fixes,mechanic_cost,mechanic_parts_used,last_mechanic_updated_at}'::text)
   FROM public.daily_equipment_inspections original
  WHERE (original.id = daily_equipment_inspections.id)) = (to_jsonb(daily_equipment_inspections.*) - '{mechanic_fixes,mechanic_cost,mechanic_parts_used,last_mechanic_updated_at}'::text))));


--
-- Name: daily_equipment_inspections equipment_inspections_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY equipment_inspections_insert ON public.daily_equipment_inspections FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IS NULL)));


--
-- Name: daily_equipment_inspections equipment_inspections_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY equipment_inspections_select ON public.daily_equipment_inspections FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = ANY (ARRAY['admin'::text, 'mechanic'::text, 'supervisor'::text, 'foreman'::text])))))));


--
-- Name: external_certification_types; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.external_certification_types ENABLE ROW LEVEL SECURITY;

--
-- Name: job_crew_assignments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_crew_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: job_milestones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: job_progress_trackers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_progress_trackers ENABLE ROW LEVEL SECURITY;

--
-- Name: job_progress_updates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.job_progress_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: job_progress_trackers job_trackers_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY job_trackers_select ON public.job_progress_trackers FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.job_crew_assignments
  WHERE ((job_crew_assignments.job_id = job_progress_trackers.id) AND (job_crew_assignments.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'foreman'::text])))))));


--
-- Name: job_progress_trackers jobs_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jobs_delete_admin ON public.job_progress_trackers FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: job_progress_trackers jobs_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jobs_insert_admin ON public.job_progress_trackers FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: job_progress_trackers jobs_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jobs_update_admin ON public.job_progress_trackers FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: daily_jsa jsa_delete_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jsa_delete_own ON public.daily_jsa FOR DELETE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: daily_jsa jsa_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jsa_insert_own ON public.daily_jsa FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IS NULL)));


--
-- Name: daily_jsa jsa_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jsa_select ON public.daily_jsa FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ((shared_with_users IS NOT NULL) AND (shared_with_users @> jsonb_build_array(jsonb_build_object('id', (( SELECT auth.uid() AS uid))::text)))) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'foreman'::text, 'general_foreman'::text, 'safety_officer'::text])))))));


--
-- Name: POLICY jsa_select ON daily_jsa; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY jsa_select ON public.daily_jsa IS 'Users can view their own JSAs, JSAs shared with them, or all JSAs if they are supervisors.';


--
-- Name: jsa_sharing_audit; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.jsa_sharing_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: jsa_sharing_audit jsa_sharing_audit_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jsa_sharing_audit_insert ON public.jsa_sharing_audit FOR INSERT TO authenticated WITH CHECK ((auth.uid() = changed_by));


--
-- Name: POLICY jsa_sharing_audit_insert ON jsa_sharing_audit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY jsa_sharing_audit_insert ON public.jsa_sharing_audit IS 'Users can only insert audit rows where they are the one making the change.';


--
-- Name: jsa_sharing_audit jsa_sharing_audit_select_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jsa_sharing_audit_select_admin ON public.jsa_sharing_audit FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text)))));


--
-- Name: POLICY jsa_sharing_audit_select_admin ON jsa_sharing_audit; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY jsa_sharing_audit_select_admin ON public.jsa_sharing_audit IS 'Only admins can view JSA sharing audit logs for compliance purposes.';


--
-- Name: daily_jsa jsa_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jsa_update_admin ON public.daily_jsa FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = ANY (ARRAY['admin'::text, 'general_foreman'::text, 'safety_officer'::text])))))) WITH CHECK ((user_id = public.get_jsa_user_id(id)));


--
-- Name: POLICY jsa_update_admin ON daily_jsa; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY jsa_update_admin ON public.daily_jsa IS 'Admins and safety officers can update JSAs for compliance oversight. Preserves original user_id.';


--
-- Name: daily_jsa jsa_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jsa_update_own ON public.daily_jsa FOR UPDATE TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = public.get_jsa_user_id(id)));


--
-- Name: POLICY jsa_update_own ON daily_jsa; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY jsa_update_own ON public.daily_jsa IS 'Original creator can update all fields including shared_with_users. Prevents changing user_id.';


--
-- Name: daily_jsa jsa_update_shared; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY jsa_update_shared ON public.daily_jsa FOR UPDATE TO authenticated USING (((shared_with_users IS NOT NULL) AND (shared_with_users @> jsonb_build_array(jsonb_build_object('id', (( SELECT auth.uid() AS uid))::text))))) WITH CHECK (((user_id = public.get_jsa_user_id(id)) AND (shared_with_users = public.get_jsa_shared_users(id))));


--
-- Name: POLICY jsa_update_shared ON daily_jsa; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY jsa_update_shared ON public.daily_jsa IS 'Delegated users can update JSA content but cannot modify shared_with_users or user_id. Prevents privilege escalation.';


--
-- Name: vehicle_maintenance_log maintenance_log_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY maintenance_log_delete ON public.vehicle_maintenance_log FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: vehicle_maintenance_log maintenance_log_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY maintenance_log_insert ON public.vehicle_maintenance_log FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_mechanic()));


--
-- Name: vehicle_maintenance_log maintenance_log_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY maintenance_log_select ON public.vehicle_maintenance_log FOR SELECT TO authenticated USING ((public.is_admin() OR public.is_mechanic()));


--
-- Name: vehicle_maintenance_log maintenance_log_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY maintenance_log_update ON public.vehicle_maintenance_log FOR UPDATE TO authenticated USING ((public.is_admin() OR public.is_mechanic()));


--
-- Name: maintenance_schedules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: mass_sms_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.mass_sms_log ENABLE ROW LEVEL SECURITY;

--
-- Name: mass_sms_log mass_sms_log_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mass_sms_log_admin_select ON public.mass_sms_log FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: announcement_metadata metadata_select_anon; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metadata_select_anon ON public.announcement_metadata FOR SELECT TO anon USING (true);


--
-- Name: announcement_metadata metadata_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY metadata_select_authenticated ON public.announcement_metadata FOR SELECT TO authenticated USING (true);


--
-- Name: mileage_anomalies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.mileage_anomalies ENABLE ROW LEVEL SECURITY;

--
-- Name: job_milestones milestones_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY milestones_delete_admin ON public.job_milestones FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: job_milestones milestones_insert_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY milestones_insert_admin ON public.job_milestones FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: job_milestones milestones_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY milestones_select ON public.job_milestones FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.job_crew_assignments
  WHERE ((job_crew_assignments.job_id = job_milestones.job_id) AND (job_crew_assignments.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'foreman'::text])))))));


--
-- Name: job_milestones milestones_update_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY milestones_update_admin ON public.job_milestones FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: monthly_reward_drawings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.monthly_reward_drawings ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_safety_rewards; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.monthly_safety_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_summary_recipients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.monthly_summary_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_summary_recipients monthly_summary_recipients_admin_only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY monthly_summary_recipients_admin_only ON public.monthly_summary_recipients USING (public.is_admin());


--
-- Name: monthly_summary_send_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.monthly_summary_send_log ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_outbox; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: osha_300a_certifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.osha_300a_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: osha_300a_certifications osha_300a_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY osha_300a_insert ON public.osha_300a_certifications FOR INSERT WITH CHECK (public.is_admin_or_safety_or_gf());


--
-- Name: osha_300a_certifications osha_300a_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY osha_300a_select ON public.osha_300a_certifications FOR SELECT USING (public.is_admin_or_safety_or_gf());


--
-- Name: osha_300a_certifications osha_300a_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY osha_300a_update ON public.osha_300a_certifications FOR UPDATE USING (public.is_admin_or_safety_or_gf());


--
-- Name: osha_compliance_mapping; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.osha_compliance_mapping ENABLE ROW LEVEL SECURITY;

--
-- Name: osha_compliance_mapping osha_compliance_mapping_select_admin_safety; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY osha_compliance_mapping_select_admin_safety ON public.osha_compliance_mapping FOR SELECT TO authenticated USING ((public.is_admin() OR public.is_supervisor()));


--
-- Name: payroll_reminder_sms_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.payroll_reminder_sms_log ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_reminder_sms_log payroll_reminder_sms_log_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY payroll_reminder_sms_log_admin_select ON public.payroll_reminder_sms_log FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: point_awarder_grants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.point_awarder_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: point_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: point_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: practical_evaluations practical_eval_insert_evaluator; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY practical_eval_insert_evaluator ON public.practical_evaluations FOR INSERT TO authenticated WITH CHECK (((evaluator_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['admin'::text, 'general_foreman'::text])))))));


--
-- Name: practical_evaluations practical_eval_select_own_or_evaluator_or_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY practical_eval_select_own_or_evaluator_or_admin ON public.practical_evaluations FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (evaluator_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text))))));


--
-- Name: practical_evaluation_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.practical_evaluation_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: practical_evaluations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.practical_evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: practical_evaluation_templates practical_templates_admin_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY practical_templates_admin_all ON public.practical_evaluation_templates TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: practical_evaluation_templates practical_templates_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY practical_templates_select ON public.practical_evaluation_templates FOR SELECT TO authenticated USING (true);


--
-- Name: job_progress_updates progress_updates_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY progress_updates_delete ON public.job_progress_updates FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text))))));


--
-- Name: job_progress_updates progress_updates_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY progress_updates_insert ON public.job_progress_updates FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text))))));


--
-- Name: job_progress_updates progress_updates_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY progress_updates_select ON public.job_progress_updates FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'foreman'::text])))))));


--
-- Name: job_progress_updates progress_updates_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY progress_updates_update ON public.job_progress_updates FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text))))));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: redemptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_catalog; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.reward_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: risk_algorithm_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.risk_algorithm_config ENABLE ROW LEVEL SECURITY;

--
-- Name: risk_algorithm_config risk_algorithm_config_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY risk_algorithm_config_admin_select ON public.risk_algorithm_config FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: risk_algorithm_config risk_algorithm_config_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY risk_algorithm_config_service_all ON public.risk_algorithm_config TO service_role WITH CHECK (true);


--
-- Name: risk_score_history; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.risk_score_history ENABLE ROW LEVEL SECURITY;

--
-- Name: risk_score_history risk_score_history_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY risk_score_history_admin_select ON public.risk_score_history FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: risk_score_history risk_score_history_service_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY risk_score_history_service_insert ON public.risk_score_history FOR INSERT TO service_role WITH CHECK (true);


--
-- Name: rto_requests rto_delete_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rto_delete_admin ON public.rto_requests FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: rto_requests rto_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rto_insert_own ON public.rto_requests FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IS NULL)));


--
-- Name: rto_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rto_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: rto_requests rto_select_own_or_admin; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rto_select_own_or_admin ON public.rto_requests FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text))))));


--
-- Name: rto_requests rto_select_public_approval; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rto_select_public_approval ON public.rto_requests FOR SELECT TO anon USING (true);


--
-- Name: rto_requests rto_update_admin_or_manager; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rto_update_admin_or_manager ON public.rto_requests FOR UPDATE TO authenticated USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());


--
-- Name: POLICY rto_update_admin_or_manager ON rto_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY rto_update_admin_or_manager ON public.rto_requests IS 'Admins and managers can update RTO request status (e.g. approval). Replaces previous anon policy.';


--
-- Name: safety_announcements; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.safety_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: safety_announcements safety_announcements_admin_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_announcements_admin_all ON public.safety_announcements TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text)))));


--
-- Name: safety_announcements safety_announcements_service_role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_announcements_service_role ON public.safety_announcements TO service_role USING (true) WITH CHECK (true);


--
-- Name: safety_announcements safety_announcements_view; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_announcements_view ON public.safety_announcements FOR SELECT TO authenticated USING (((status = 'published'::text) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = ( SELECT auth.uid() AS uid)) AND (app_users.role = 'admin'::text))))));


--
-- Name: safety_audit_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.safety_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: safety_audit_log safety_audit_log_insert_report_exported; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_audit_log_insert_report_exported ON public.safety_audit_log FOR INSERT TO authenticated WITH CHECK (((event_type = 'report_exported'::text) AND (public.is_admin() OR public.is_supervisor())));


--
-- Name: safety_audit_log safety_audit_log_select_admin_safety; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_audit_log_select_admin_safety ON public.safety_audit_log FOR SELECT TO authenticated USING ((public.is_admin() OR public.is_supervisor()));


--
-- Name: safety_briefing_answer_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.safety_briefing_answer_items ENABLE ROW LEVEL SECURITY;

--
-- Name: safety_briefing_answers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.safety_briefing_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: safety_flags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.safety_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: safety_flags safety_flags_create; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_flags_create ON public.safety_flags FOR INSERT TO authenticated WITH CHECK (((auth.uid() IS NOT NULL) AND (flagged_by = auth.uid())));


--
-- Name: safety_flags safety_flags_management; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_flags_management ON public.safety_flags TO authenticated USING (public.is_admin_or_safety_or_gf()) WITH CHECK (public.is_admin_or_safety_or_gf());


--
-- Name: safety_incidents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: safety_incidents safety_incidents_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_incidents_admin_insert ON public.safety_incidents FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: safety_incidents safety_incidents_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_incidents_admin_select ON public.safety_incidents FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: safety_incidents safety_incidents_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_incidents_admin_update ON public.safety_incidents FOR UPDATE TO authenticated USING (public.is_admin());


--
-- Name: safety_incidents safety_incidents_near_miss_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_incidents_near_miss_insert ON public.safety_incidents FOR INSERT TO authenticated WITH CHECK ((public.can_report_near_miss() AND (severity = 'near_miss'::text)));


--
-- Name: safety_incidents safety_incidents_own_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_incidents_own_select ON public.safety_incidents FOR SELECT TO authenticated USING ((reported_by = auth.uid()));


--
-- Name: safety_incidents safety_incidents_reporters_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY safety_incidents_reporters_insert ON public.safety_incidents FOR INSERT TO authenticated WITH CHECK (public.can_log_incidents());


--
-- Name: maintenance_schedules schedules_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY schedules_delete ON public.maintenance_schedules FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: maintenance_schedules schedules_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY schedules_insert ON public.maintenance_schedules FOR INSERT TO authenticated WITH CHECK ((public.is_admin() OR public.is_mechanic()));


--
-- Name: maintenance_schedules schedules_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY schedules_select ON public.maintenance_schedules FOR SELECT TO authenticated USING ((public.is_admin() OR public.is_mechanic()));


--
-- Name: maintenance_schedules schedules_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY schedules_update ON public.maintenance_schedules FOR UPDATE TO authenticated USING ((public.is_admin() OR public.is_mechanic()));


--
-- Name: sms_escalation_recipients; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sms_escalation_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_escalation_recipients sms_escalation_recipients_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sms_escalation_recipients_admin_delete ON public.sms_escalation_recipients FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: sms_escalation_recipients sms_escalation_recipients_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sms_escalation_recipients_admin_insert ON public.sms_escalation_recipients FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: sms_escalation_recipients sms_escalation_recipients_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sms_escalation_recipients_admin_select ON public.sms_escalation_recipients FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: sms_escalation_recipients sms_escalation_recipients_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sms_escalation_recipients_admin_update ON public.sms_escalation_recipients FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: sms_escalation_send_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sms_escalation_send_log ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_escalation_send_log sms_escalation_send_log_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sms_escalation_send_log_admin_select ON public.sms_escalation_send_log FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: storage_cleanup_queue; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: storage_cleanup_queue storage_cleanup_queue_service_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY storage_cleanup_queue_service_access ON public.storage_cleanup_queue TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: telemetry_events telemetry_admin_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY telemetry_admin_read ON public.telemetry_events FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = 'admin'::text)))));


--
-- Name: telemetry_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

--
-- Name: telemetry_events telemetry_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY telemetry_insert_own ON public.telemetry_events FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR (user_id IS NULL)));


--
-- Name: telemetry_events telemetry_service_role_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY telemetry_service_role_all ON public.telemetry_events TO service_role USING (true) WITH CHECK (true);


--
-- Name: tuning_decisions_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tuning_decisions_log ENABLE ROW LEVEL SECURITY;

--
-- Name: algorithm_tuning_runs tuning_runs_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tuning_runs_admin_select ON public.algorithm_tuning_runs FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: algorithm_tuning_runs tuning_runs_service_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tuning_runs_service_all ON public.algorithm_tuning_runs TO service_role WITH CHECK (true);


--
-- Name: user_absences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_absences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_absences user_absences_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_absences_admin_select ON public.user_absences FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: user_absences user_absences_manage_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_absences_manage_roles ON public.user_absences TO authenticated USING ((public.is_admin() OR (user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['manager'::text, 'safety_officer'::text, 'general_foreman'::text, 'foreman'::text]))))))) WITH CHECK ((public.is_admin() OR (user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['manager'::text, 'safety_officer'::text, 'general_foreman'::text, 'foreman'::text])))))));


--
-- Name: user_absences user_absences_service_role; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_absences_service_role ON public.user_absences TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_activity_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_activity_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_contact_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_contact_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: user_management_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_management_log ENABLE ROW LEVEL SECURITY;

--
-- Name: user_management_log user_mgmt_log_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_mgmt_log_admin_insert ON public.user_management_log FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: user_management_log user_mgmt_log_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY user_mgmt_log_admin_select ON public.user_management_log FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: user_preferences; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_saved_locations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_saved_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: user_signatures; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: vehicle_maintenance_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.vehicle_maintenance_log ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_external_certifications wec_admin_safety_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY wec_admin_safety_all ON public.worker_external_certifications TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.app_users
  WHERE ((app_users.user_id = auth.uid()) AND (app_users.role = ANY (ARRAY['admin'::text, 'safety_officer'::text]))))));


--
-- Name: worker_external_certifications wec_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY wec_select_own ON public.worker_external_certifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: weekly_safety_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.weekly_safety_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_safety_reports weekly_safety_reports_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY weekly_safety_reports_admin_select ON public.weekly_safety_reports FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: work_sites; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.work_sites ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_external_certifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.worker_external_certifications ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION _notify_redemption_denied(p_redemption_id uuid, p_actor uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._notify_redemption_denied(p_redemption_id uuid, p_actor uuid) TO anon;
GRANT ALL ON FUNCTION public._notify_redemption_denied(p_redemption_id uuid, p_actor uuid) TO authenticated;
GRANT ALL ON FUNCTION public._notify_redemption_denied(p_redemption_id uuid, p_actor uuid) TO service_role;


--
-- Name: FUNCTION _notify_redemption_fulfilled(p_redemption_id uuid, p_actor uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._notify_redemption_fulfilled(p_redemption_id uuid, p_actor uuid) TO anon;
GRANT ALL ON FUNCTION public._notify_redemption_fulfilled(p_redemption_id uuid, p_actor uuid) TO authenticated;
GRANT ALL ON FUNCTION public._notify_redemption_fulfilled(p_redemption_id uuid, p_actor uuid) TO service_role;


--
-- Name: FUNCTION _notify_redemption_pending_admins(p_redemption_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._notify_redemption_pending_admins(p_redemption_id uuid) TO anon;
GRANT ALL ON FUNCTION public._notify_redemption_pending_admins(p_redemption_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public._notify_redemption_pending_admins(p_redemption_id uuid) TO service_role;


--
-- Name: TABLE redemptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.redemptions TO anon;
GRANT ALL ON TABLE public.redemptions TO authenticated;
GRANT ALL ON TABLE public.redemptions TO service_role;


--
-- Name: FUNCTION _refund_redemption_hold(p_redemption public.redemptions, p_reason text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public._refund_redemption_hold(p_redemption public.redemptions, p_reason text) TO anon;
GRANT ALL ON FUNCTION public._refund_redemption_hold(p_redemption public.redemptions, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public._refund_redemption_hold(p_redemption public.redemptions, p_reason text) TO service_role;


--
-- Name: FUNCTION abandon_certification_attempt(p_attempt_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.abandon_certification_attempt(p_attempt_id uuid) TO anon;
GRANT ALL ON FUNCTION public.abandon_certification_attempt(p_attempt_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.abandon_certification_attempt(p_attempt_id uuid) TO service_role;


--
-- Name: FUNCTION admin_grade_short_answers(p_attempt_id uuid, p_grades jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.admin_grade_short_answers(p_attempt_id uuid, p_grades jsonb) TO anon;
GRANT ALL ON FUNCTION public.admin_grade_short_answers(p_attempt_id uuid, p_grades jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.admin_grade_short_answers(p_attempt_id uuid, p_grades jsonb) TO service_role;


--
-- Name: FUNCTION anonymize_user_telemetry(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.anonymize_user_telemetry() TO anon;
GRANT ALL ON FUNCTION public.anonymize_user_telemetry() TO authenticated;
GRANT ALL ON FUNCTION public.anonymize_user_telemetry() TO service_role;


--
-- Name: FUNCTION app_settings_touch_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.app_settings_touch_updated_at() TO anon;
GRANT ALL ON FUNCTION public.app_settings_touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.app_settings_touch_updated_at() TO service_role;


--
-- Name: FUNCTION audit_app_settings(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.audit_app_settings() TO anon;
GRANT ALL ON FUNCTION public.audit_app_settings() TO authenticated;
GRANT ALL ON FUNCTION public.audit_app_settings() TO service_role;


--
-- Name: FUNCTION award_certification_points(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.award_certification_points() TO anon;
GRANT ALL ON FUNCTION public.award_certification_points() TO authenticated;
GRANT ALL ON FUNCTION public.award_certification_points() TO service_role;


--
-- Name: FUNCTION award_near_miss_base_points(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.award_near_miss_base_points() TO anon;
GRANT ALL ON FUNCTION public.award_near_miss_base_points() TO authenticated;
GRANT ALL ON FUNCTION public.award_near_miss_base_points() TO service_role;


--
-- Name: FUNCTION award_near_miss_corrective_bonus(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.award_near_miss_corrective_bonus() TO anon;
GRANT ALL ON FUNCTION public.award_near_miss_corrective_bonus() TO authenticated;
GRANT ALL ON FUNCTION public.award_near_miss_corrective_bonus() TO service_role;


--
-- Name: FUNCTION award_points(p_recipient uuid, p_amount integer, p_category text, p_reason text, p_request_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.award_points(p_recipient uuid, p_amount integer, p_category text, p_reason text, p_request_id uuid) TO anon;
GRANT ALL ON FUNCTION public.award_points(p_recipient uuid, p_amount integer, p_category text, p_reason text, p_request_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.award_points(p_recipient uuid, p_amount integer, p_category text, p_reason text, p_request_id uuid) TO service_role;


--
-- Name: FUNCTION calculate_factor_performance(p_start_date date, p_end_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_factor_performance(p_start_date date, p_end_date date) TO anon;
GRANT ALL ON FUNCTION public.calculate_factor_performance(p_start_date date, p_end_date date) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_factor_performance(p_start_date date, p_end_date date) TO service_role;


--
-- Name: FUNCTION calculate_prediction_accuracy(p_start_date date, p_end_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_prediction_accuracy(p_start_date date, p_end_date date) TO anon;
GRANT ALL ON FUNCTION public.calculate_prediction_accuracy(p_start_date date, p_end_date date) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_prediction_accuracy(p_start_date date, p_end_date date) TO service_role;


--
-- Name: FUNCTION can_award_points(actor uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.can_award_points(actor uuid) TO anon;
GRANT ALL ON FUNCTION public.can_award_points(actor uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_award_points(actor uuid) TO service_role;


--
-- Name: FUNCTION can_evaluate_user(p_evaluator_id uuid, p_evaluatee_id uuid, p_cert_type_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.can_evaluate_user(p_evaluator_id uuid, p_evaluatee_id uuid, p_cert_type_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_evaluate_user(p_evaluator_id uuid, p_evaluatee_id uuid, p_cert_type_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_evaluate_user(p_evaluator_id uuid, p_evaluatee_id uuid, p_cert_type_id uuid) TO service_role;


--
-- Name: FUNCTION can_log_incidents(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.can_log_incidents() TO anon;
GRANT ALL ON FUNCTION public.can_log_incidents() TO authenticated;
GRANT ALL ON FUNCTION public.can_log_incidents() TO service_role;


--
-- Name: FUNCTION can_report_near_miss(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.can_report_near_miss() TO anon;
GRANT ALL ON FUNCTION public.can_report_near_miss() TO authenticated;
GRANT ALL ON FUNCTION public.can_report_near_miss() TO service_role;


--
-- Name: FUNCTION can_start_certification_attempt(p_cert_type_id uuid, p_check_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.can_start_certification_attempt(p_cert_type_id uuid, p_check_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.can_start_certification_attempt(p_cert_type_id uuid, p_check_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.can_start_certification_attempt(p_cert_type_id uuid, p_check_user_id uuid) TO service_role;


--
-- Name: FUNCTION cancel_redemption(p_redemption_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cancel_redemption(p_redemption_id uuid) TO anon;
GRANT ALL ON FUNCTION public.cancel_redemption(p_redemption_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_redemption(p_redemption_id uuid) TO service_role;


--
-- Name: FUNCTION certification_audit_log_on_qualification_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.certification_audit_log_on_qualification_change() TO anon;
GRANT ALL ON FUNCTION public.certification_audit_log_on_qualification_change() TO authenticated;
GRANT ALL ON FUNCTION public.certification_audit_log_on_qualification_change() TO service_role;


--
-- Name: FUNCTION certification_audit_log_on_revoke(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.certification_audit_log_on_revoke() TO anon;
GRANT ALL ON FUNCTION public.certification_audit_log_on_revoke() TO authenticated;
GRANT ALL ON FUNCTION public.certification_audit_log_on_revoke() TO service_role;


--
-- Name: FUNCTION check_latest_announcement_claim(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_latest_announcement_claim() TO anon;
GRANT ALL ON FUNCTION public.check_latest_announcement_claim() TO authenticated;
GRANT ALL ON FUNCTION public.check_latest_announcement_claim() TO service_role;


--
-- Name: FUNCTION check_min_recipients(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_min_recipients() TO anon;
GRANT ALL ON FUNCTION public.check_min_recipients() TO authenticated;
GRANT ALL ON FUNCTION public.check_min_recipients() TO service_role;


--
-- Name: FUNCTION check_reward_claim_window(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.check_reward_claim_window() TO anon;
GRANT ALL ON FUNCTION public.check_reward_claim_window() TO authenticated;
GRANT ALL ON FUNCTION public.check_reward_claim_window() TO service_role;


--
-- Name: FUNCTION claim_payroll_reminder_sms_log(p_date_checked date, p_tier integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.claim_payroll_reminder_sms_log(p_date_checked date, p_tier integer) TO anon;
GRANT ALL ON FUNCTION public.claim_payroll_reminder_sms_log(p_date_checked date, p_tier integer) TO authenticated;
GRANT ALL ON FUNCTION public.claim_payroll_reminder_sms_log(p_date_checked date, p_tier integer) TO service_role;


--
-- Name: FUNCTION claim_pending_notifications(batch_size integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.claim_pending_notifications(batch_size integer) TO anon;
GRANT ALL ON FUNCTION public.claim_pending_notifications(batch_size integer) TO authenticated;
GRANT ALL ON FUNCTION public.claim_pending_notifications(batch_size integer) TO service_role;


--
-- Name: FUNCTION cleanup_jsa_photos(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_jsa_photos() TO anon;
GRANT ALL ON FUNCTION public.cleanup_jsa_photos() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_jsa_photos() TO service_role;


--
-- Name: FUNCTION cleanup_stale_sessions(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.cleanup_stale_sessions() TO anon;
GRANT ALL ON FUNCTION public.cleanup_stale_sessions() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_stale_sessions() TO service_role;


--
-- Name: FUNCTION clear_certification_grading_started(p_attempt_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.clear_certification_grading_started(p_attempt_id uuid) TO anon;
GRANT ALL ON FUNCTION public.clear_certification_grading_started(p_attempt_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.clear_certification_grading_started(p_attempt_id uuid) TO service_role;


--
-- Name: FUNCTION compute_streak_bonus_total(p_claimed_dates date[], p_announcement_dates date[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.compute_streak_bonus_total(p_claimed_dates date[], p_announcement_dates date[]) TO anon;
GRANT ALL ON FUNCTION public.compute_streak_bonus_total(p_claimed_dates date[], p_announcement_dates date[]) TO authenticated;
GRANT ALL ON FUNCTION public.compute_streak_bonus_total(p_claimed_dates date[], p_announcement_dates date[]) TO service_role;


--
-- Name: FUNCTION compute_streak_milestones(p_claimed_dates date[], p_announcement_dates date[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.compute_streak_milestones(p_claimed_dates date[], p_announcement_dates date[]) TO anon;
GRANT ALL ON FUNCTION public.compute_streak_milestones(p_claimed_dates date[], p_announcement_dates date[]) TO authenticated;
GRANT ALL ON FUNCTION public.compute_streak_milestones(p_claimed_dates date[], p_announcement_dates date[]) TO service_role;


--
-- Name: FUNCTION create_certification_attempt(p_cert_type_slug text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_certification_attempt(p_cert_type_slug text) TO anon;
GRANT ALL ON FUNCTION public.create_certification_attempt(p_cert_type_slug text) TO authenticated;
GRANT ALL ON FUNCTION public.create_certification_attempt(p_cert_type_slug text) TO service_role;


--
-- Name: FUNCTION create_default_notification_preferences(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.create_default_notification_preferences() TO anon;
GRANT ALL ON FUNCTION public.create_default_notification_preferences() TO authenticated;
GRANT ALL ON FUNCTION public.create_default_notification_preferences() TO service_role;


--
-- Name: FUNCTION debug_auth_context(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.debug_auth_context() FROM PUBLIC;
GRANT ALL ON FUNCTION public.debug_auth_context() TO anon;
GRANT ALL ON FUNCTION public.debug_auth_context() TO authenticated;
GRANT ALL ON FUNCTION public.debug_auth_context() TO service_role;


--
-- Name: FUNCTION deny_redemption(p_redemption_id uuid, p_note text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.deny_redemption(p_redemption_id uuid, p_note text) TO anon;
GRANT ALL ON FUNCTION public.deny_redemption(p_redemption_id uuid, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.deny_redemption(p_redemption_id uuid, p_note text) TO service_role;


--
-- Name: FUNCTION ensure_single_default_contact_template(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.ensure_single_default_contact_template() TO anon;
GRANT ALL ON FUNCTION public.ensure_single_default_contact_template() TO authenticated;
GRANT ALL ON FUNCTION public.ensure_single_default_contact_template() TO service_role;


--
-- Name: FUNCTION fulfill_redemption(p_redemption_id uuid, p_note text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fulfill_redemption(p_redemption_id uuid, p_note text) TO anon;
GRANT ALL ON FUNCTION public.fulfill_redemption(p_redemption_id uuid, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.fulfill_redemption(p_redemption_id uuid, p_note text) TO service_role;


--
-- Name: FUNCTION generate_certification_verification_code(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.generate_certification_verification_code() TO anon;
GRANT ALL ON FUNCTION public.generate_certification_verification_code() TO authenticated;
GRANT ALL ON FUNCTION public.generate_certification_verification_code() TO service_role;


--
-- Name: FUNCTION get_briefing_compliance_summary(p_start_date date, p_end_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_briefing_compliance_summary(p_start_date date, p_end_date date) TO anon;
GRANT ALL ON FUNCTION public.get_briefing_compliance_summary(p_start_date date, p_end_date date) TO authenticated;
GRANT ALL ON FUNCTION public.get_briefing_compliance_summary(p_start_date date, p_end_date date) TO service_role;


--
-- Name: FUNCTION get_briefing_daily_snapshot(p_briefing_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_briefing_daily_snapshot(p_briefing_date date) TO anon;
GRANT ALL ON FUNCTION public.get_briefing_daily_snapshot(p_briefing_date date) TO authenticated;
GRANT ALL ON FUNCTION public.get_briefing_daily_snapshot(p_briefing_date date) TO service_role;


--
-- Name: FUNCTION get_certificate_by_verification_code(p_code text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_certificate_by_verification_code(p_code text) TO anon;
GRANT ALL ON FUNCTION public.get_certificate_by_verification_code(p_code text) TO authenticated;
GRANT ALL ON FUNCTION public.get_certificate_by_verification_code(p_code text) TO service_role;


--
-- Name: FUNCTION get_certification_completion_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_certification_completion_stats() TO anon;
GRANT ALL ON FUNCTION public.get_certification_completion_stats() TO authenticated;
GRANT ALL ON FUNCTION public.get_certification_completion_stats() TO service_role;


--
-- Name: FUNCTION get_certification_test_questions(p_cert_type_slug text, p_test_attempt_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_certification_test_questions(p_cert_type_slug text, p_test_attempt_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_certification_test_questions(p_cert_type_slug text, p_test_attempt_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_certification_test_questions(p_cert_type_slug text, p_test_attempt_id uuid) TO service_role;


--
-- Name: FUNCTION get_compliance_leaderboard(p_start_date date, p_end_date date, p_limit integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_compliance_leaderboard(p_start_date date, p_end_date date, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.get_compliance_leaderboard(p_start_date date, p_end_date date, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_compliance_leaderboard(p_start_date date, p_end_date date, p_limit integer) TO service_role;


--
-- Name: FUNCTION get_compliance_streaks(p_user_ids uuid[], p_before_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_compliance_streaks(p_user_ids uuid[], p_before_date date) TO anon;
GRANT ALL ON FUNCTION public.get_compliance_streaks(p_user_ids uuid[], p_before_date date) TO authenticated;
GRANT ALL ON FUNCTION public.get_compliance_streaks(p_user_ids uuid[], p_before_date date) TO service_role;


--
-- Name: FUNCTION get_compliance_summary_by_day(p_date_from date, p_date_to date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_compliance_summary_by_day(p_date_from date, p_date_to date) TO anon;
GRANT ALL ON FUNCTION public.get_compliance_summary_by_day(p_date_from date, p_date_to date) TO authenticated;
GRANT ALL ON FUNCTION public.get_compliance_summary_by_day(p_date_from date, p_date_to date) TO service_role;


--
-- Name: FUNCTION get_incident_log_osha_300_301(p_date_from date, p_date_to date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_incident_log_osha_300_301(p_date_from date, p_date_to date) TO anon;
GRANT ALL ON FUNCTION public.get_incident_log_osha_300_301(p_date_from date, p_date_to date) TO authenticated;
GRANT ALL ON FUNCTION public.get_incident_log_osha_300_301(p_date_from date, p_date_to date) TO service_role;


--
-- Name: FUNCTION get_job_progress(p_job_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_job_progress(p_job_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_job_progress(p_job_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_job_progress(p_job_id uuid) TO service_role;


--
-- Name: FUNCTION get_jsa_shared_users(jsa_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_jsa_shared_users(jsa_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_jsa_shared_users(jsa_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_jsa_shared_users(jsa_id uuid) TO service_role;


--
-- Name: FUNCTION get_jsa_user_id(jsa_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_jsa_user_id(jsa_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_jsa_user_id(jsa_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_jsa_user_id(jsa_id uuid) TO service_role;


--
-- Name: FUNCTION get_monthly_raffle_stats(p_year integer, p_month integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_monthly_raffle_stats(p_year integer, p_month integer) TO anon;
GRANT ALL ON FUNCTION public.get_monthly_raffle_stats(p_year integer, p_month integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_monthly_raffle_stats(p_year integer, p_month integer) TO service_role;


--
-- Name: FUNCTION get_next_algorithm_version(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_next_algorithm_version() TO anon;
GRANT ALL ON FUNCTION public.get_next_algorithm_version() TO authenticated;
GRANT ALL ON FUNCTION public.get_next_algorithm_version() TO service_role;


--
-- Name: FUNCTION get_osha_300a_summary(p_year integer, p_total_employees_avg numeric, p_total_hours_worked numeric); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_osha_300a_summary(p_year integer, p_total_employees_avg numeric, p_total_hours_worked numeric) TO anon;
GRANT ALL ON FUNCTION public.get_osha_300a_summary(p_year integer, p_total_employees_avg numeric, p_total_hours_worked numeric) TO authenticated;
GRANT ALL ON FUNCTION public.get_osha_300a_summary(p_year integer, p_total_employees_avg numeric, p_total_hours_worked numeric) TO service_role;


--
-- Name: FUNCTION get_point_rule(p_source public.point_source, p_rule_key text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_point_rule(p_source public.point_source, p_rule_key text) TO anon;
GRANT ALL ON FUNCTION public.get_point_rule(p_source public.point_source, p_rule_key text) TO authenticated;
GRANT ALL ON FUNCTION public.get_point_rule(p_source public.point_source, p_rule_key text) TO service_role;


--
-- Name: FUNCTION get_recent_cron_failures(days_back integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_recent_cron_failures(days_back integer) TO anon;
GRANT ALL ON FUNCTION public.get_recent_cron_failures(days_back integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_recent_cron_failures(days_back integer) TO service_role;


--
-- Name: FUNCTION get_telemetry_dashboard_stats(date_from timestamp with time zone, date_to timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_telemetry_dashboard_stats(date_from timestamp with time zone, date_to timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.get_telemetry_dashboard_stats(date_from timestamp with time zone, date_to timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_telemetry_dashboard_stats(date_from timestamp with time zone, date_to timestamp with time zone) TO service_role;


--
-- Name: TABLE app_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.app_users TO anon;
GRANT ALL ON TABLE public.app_users TO authenticated;
GRANT ALL ON TABLE public.app_users TO service_role;


--
-- Name: TABLE certification_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.certification_records TO anon;
GRANT ALL ON TABLE public.certification_records TO authenticated;
GRANT ALL ON TABLE public.certification_records TO service_role;


--
-- Name: TABLE certification_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.certification_types TO anon;
GRANT ALL ON TABLE public.certification_types TO authenticated;
GRANT ALL ON TABLE public.certification_types TO service_role;


--
-- Name: TABLE user_certification_matrix; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_certification_matrix TO anon;
GRANT ALL ON TABLE public.user_certification_matrix TO authenticated;
GRANT ALL ON TABLE public.user_certification_matrix TO service_role;


--
-- Name: FUNCTION get_user_certification_matrix(p_cert_type_id uuid, p_compliance_status text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_certification_matrix(p_cert_type_id uuid, p_compliance_status text) TO anon;
GRANT ALL ON FUNCTION public.get_user_certification_matrix(p_cert_type_id uuid, p_compliance_status text) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_certification_matrix(p_cert_type_id uuid, p_compliance_status text) TO service_role;


--
-- Name: FUNCTION get_user_compliance_points(p_user_id uuid, p_start_date date, p_end_date date); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_compliance_points(p_user_id uuid, p_start_date date, p_end_date date) TO anon;
GRANT ALL ON FUNCTION public.get_user_compliance_points(p_user_id uuid, p_start_date date, p_end_date date) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_compliance_points(p_user_id uuid, p_start_date date, p_end_date date) TO service_role;


--
-- Name: FUNCTION get_user_last_activity(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_last_activity() TO anon;
GRANT ALL ON FUNCTION public.get_user_last_activity() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_last_activity() TO service_role;


--
-- Name: FUNCTION get_user_point_balance(target_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_point_balance(target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_point_balance(target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_point_balance(target_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_points_by_source(target_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_points_by_source(target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_points_by_source(target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_points_by_source(target_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_profiles(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_profiles() TO anon;
GRANT ALL ON FUNCTION public.get_user_profiles() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_profiles() TO service_role;


--
-- Name: FUNCTION get_user_raffle_entries(target_user_id uuid, p_year integer, p_month integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_raffle_entries(target_user_id uuid, p_year integer, p_month integer) TO anon;
GRANT ALL ON FUNCTION public.get_user_raffle_entries(target_user_id uuid, p_year integer, p_month integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_raffle_entries(target_user_id uuid, p_year integer, p_month integer) TO service_role;


--
-- Name: FUNCTION get_user_raffle_entries_by_source(target_user_id uuid, p_year integer, p_month integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_raffle_entries_by_source(target_user_id uuid, p_year integer, p_month integer) TO anon;
GRANT ALL ON FUNCTION public.get_user_raffle_entries_by_source(target_user_id uuid, p_year integer, p_month integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_raffle_entries_by_source(target_user_id uuid, p_year integer, p_month integer) TO service_role;


--
-- Name: FUNCTION get_user_total_points(target_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_user_total_points(target_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_user_total_points(target_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_total_points(target_user_id uuid) TO service_role;


--
-- Name: FUNCTION grant_certification_access(p_user_id uuid, p_certification_type_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.grant_certification_access(p_user_id uuid, p_certification_type_id uuid) TO anon;
GRANT ALL ON FUNCTION public.grant_certification_access(p_user_id uuid, p_certification_type_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.grant_certification_access(p_user_id uuid, p_certification_type_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION increment_contact_template_usage(template_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.increment_contact_template_usage(template_id uuid) TO anon;
GRANT ALL ON FUNCTION public.increment_contact_template_usage(template_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.increment_contact_template_usage(template_id uuid) TO service_role;


--
-- Name: FUNCTION insert_certification_audit_log(p_actor_id uuid, p_action text, p_record_id uuid, p_old_value jsonb, p_new_value jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.insert_certification_audit_log(p_actor_id uuid, p_action text, p_record_id uuid, p_old_value jsonb, p_new_value jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.insert_certification_audit_log(p_actor_id uuid, p_action text, p_record_id uuid, p_old_value jsonb, p_new_value jsonb) TO anon;
GRANT ALL ON FUNCTION public.insert_certification_audit_log(p_actor_id uuid, p_action text, p_record_id uuid, p_old_value jsonb, p_new_value jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.insert_certification_audit_log(p_actor_id uuid, p_action text, p_record_id uuid, p_old_value jsonb, p_new_value jsonb) TO service_role;


--
-- Name: FUNCTION insert_point_transaction(p_user_id uuid, p_amount integer, p_source public.point_source, p_reference_id uuid, p_reference_table text, p_category text, p_counts_toward_raffle boolean); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.insert_point_transaction(p_user_id uuid, p_amount integer, p_source public.point_source, p_reference_id uuid, p_reference_table text, p_category text, p_counts_toward_raffle boolean) TO anon;
GRANT ALL ON FUNCTION public.insert_point_transaction(p_user_id uuid, p_amount integer, p_source public.point_source, p_reference_id uuid, p_reference_table text, p_category text, p_counts_toward_raffle boolean) TO authenticated;
GRANT ALL ON FUNCTION public.insert_point_transaction(p_user_id uuid, p_amount integer, p_source public.point_source, p_reference_id uuid, p_reference_table text, p_category text, p_counts_toward_raffle boolean) TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_admin_or_manager(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin_or_manager() TO anon;
GRANT ALL ON FUNCTION public.is_admin_or_manager() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin_or_manager() TO service_role;


--
-- Name: FUNCTION is_admin_or_mechanic(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin_or_mechanic() TO anon;
GRANT ALL ON FUNCTION public.is_admin_or_mechanic() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin_or_mechanic() TO service_role;


--
-- Name: FUNCTION is_admin_or_safety_or_gf(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_admin_or_safety_or_gf() TO anon;
GRANT ALL ON FUNCTION public.is_admin_or_safety_or_gf() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin_or_safety_or_gf() TO service_role;


--
-- Name: FUNCTION is_mechanic(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_mechanic() TO anon;
GRANT ALL ON FUNCTION public.is_mechanic() TO authenticated;
GRANT ALL ON FUNCTION public.is_mechanic() TO service_role;


--
-- Name: FUNCTION is_reward_claim_window(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_reward_claim_window() TO anon;
GRANT ALL ON FUNCTION public.is_reward_claim_window() TO authenticated;
GRANT ALL ON FUNCTION public.is_reward_claim_window() TO service_role;


--
-- Name: FUNCTION is_supervisor(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.is_supervisor() TO anon;
GRANT ALL ON FUNCTION public.is_supervisor() TO authenticated;
GRANT ALL ON FUNCTION public.is_supervisor() TO service_role;


--
-- Name: FUNCTION mark_idle_sessions(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.mark_idle_sessions() TO anon;
GRANT ALL ON FUNCTION public.mark_idle_sessions() TO authenticated;
GRANT ALL ON FUNCTION public.mark_idle_sessions() TO service_role;


--
-- Name: FUNCTION normalize_truck_number(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.normalize_truck_number() TO anon;
GRANT ALL ON FUNCTION public.normalize_truck_number() TO authenticated;
GRANT ALL ON FUNCTION public.normalize_truck_number() TO service_role;


--
-- Name: FUNCTION notification_events_dispatch_webhook(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notification_events_dispatch_webhook() TO anon;
GRANT ALL ON FUNCTION public.notification_events_dispatch_webhook() TO authenticated;
GRANT ALL ON FUNCTION public.notification_events_dispatch_webhook() TO service_role;


--
-- Name: FUNCTION notify_admins_new_signup_webhook(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_admins_new_signup_webhook() TO anon;
GRANT ALL ON FUNCTION public.notify_admins_new_signup_webhook() TO authenticated;
GRANT ALL ON FUNCTION public.notify_admins_new_signup_webhook() TO service_role;


--
-- Name: FUNCTION notify_external_cert_grant_or_revoke(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_external_cert_grant_or_revoke() TO anon;
GRANT ALL ON FUNCTION public.notify_external_cert_grant_or_revoke() TO authenticated;
GRANT ALL ON FUNCTION public.notify_external_cert_grant_or_revoke() TO service_role;


--
-- Name: FUNCTION notify_manual_award_recipient(p_request_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.notify_manual_award_recipient(p_request_id uuid) TO anon;
GRANT ALL ON FUNCTION public.notify_manual_award_recipient(p_request_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.notify_manual_award_recipient(p_request_id uuid) TO service_role;


--
-- Name: FUNCTION point_tx_matches_raffle_month(p_counts_toward_raffle boolean, p_amount integer, p_created_at timestamp with time zone, p_year integer, p_month integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.point_tx_matches_raffle_month(p_counts_toward_raffle boolean, p_amount integer, p_created_at timestamp with time zone, p_year integer, p_month integer) TO anon;
GRANT ALL ON FUNCTION public.point_tx_matches_raffle_month(p_counts_toward_raffle boolean, p_amount integer, p_created_at timestamp with time zone, p_year integer, p_month integer) TO authenticated;
GRANT ALL ON FUNCTION public.point_tx_matches_raffle_month(p_counts_toward_raffle boolean, p_amount integer, p_created_at timestamp with time zone, p_year integer, p_month integer) TO service_role;


--
-- Name: FUNCTION prevent_dvir_user_id_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_dvir_user_id_change() TO anon;
GRANT ALL ON FUNCTION public.prevent_dvir_user_id_change() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_dvir_user_id_change() TO service_role;


--
-- Name: FUNCTION prevent_equipment_user_id_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_equipment_user_id_change() TO anon;
GRANT ALL ON FUNCTION public.prevent_equipment_user_id_change() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_equipment_user_id_change() TO service_role;


--
-- Name: FUNCTION prevent_jsa_user_id_change(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_jsa_user_id_change() TO anon;
GRANT ALL ON FUNCTION public.prevent_jsa_user_id_change() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_jsa_user_id_change() TO service_role;


--
-- Name: FUNCTION queue_asset_cost_refresh(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.queue_asset_cost_refresh() TO anon;
GRANT ALL ON FUNCTION public.queue_asset_cost_refresh() TO authenticated;
GRANT ALL ON FUNCTION public.queue_asset_cost_refresh() TO service_role;


--
-- Name: FUNCTION redeem_reward(p_item_id uuid, p_request_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.redeem_reward(p_item_id uuid, p_request_id uuid) TO anon;
GRANT ALL ON FUNCTION public.redeem_reward(p_item_id uuid, p_request_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.redeem_reward(p_item_id uuid, p_request_id uuid) TO service_role;


--
-- Name: FUNCTION refresh_asset_cost_summary(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.refresh_asset_cost_summary() TO anon;
GRANT ALL ON FUNCTION public.refresh_asset_cost_summary() TO authenticated;
GRANT ALL ON FUNCTION public.refresh_asset_cost_summary() TO service_role;


--
-- Name: FUNCTION refresh_certification_completion_stats(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.refresh_certification_completion_stats() TO anon;
GRANT ALL ON FUNCTION public.refresh_certification_completion_stats() TO authenticated;
GRANT ALL ON FUNCTION public.refresh_certification_completion_stats() TO service_role;


--
-- Name: FUNCTION run_data_retention(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.run_data_retention() TO anon;
GRANT ALL ON FUNCTION public.run_data_retention() TO authenticated;
GRANT ALL ON FUNCTION public.run_data_retention() TO service_role;


--
-- Name: FUNCTION safety_audit_log_insert(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.safety_audit_log_insert() TO anon;
GRANT ALL ON FUNCTION public.safety_audit_log_insert() TO authenticated;
GRANT ALL ON FUNCTION public.safety_audit_log_insert() TO service_role;


--
-- Name: FUNCTION safety_audit_log_osha_300a(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.safety_audit_log_osha_300a() TO anon;
GRANT ALL ON FUNCTION public.safety_audit_log_osha_300a() TO authenticated;
GRANT ALL ON FUNCTION public.safety_audit_log_osha_300a() TO service_role;


--
-- Name: FUNCTION save_setting_and_update_cron(p_setting_key text, p_setting_value jsonb, p_expected_updated_at timestamp with time zone, p_cron_updates jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.save_setting_and_update_cron(p_setting_key text, p_setting_value jsonb, p_expected_updated_at timestamp with time zone, p_cron_updates jsonb) TO anon;
GRANT ALL ON FUNCTION public.save_setting_and_update_cron(p_setting_key text, p_setting_value jsonb, p_expected_updated_at timestamp with time zone, p_cron_updates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_setting_and_update_cron(p_setting_key text, p_setting_value jsonb, p_expected_updated_at timestamp with time zone, p_cron_updates jsonb) TO service_role;


--
-- Name: FUNCTION set_certification_grading_started(p_attempt_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_certification_grading_started(p_attempt_id uuid) TO anon;
GRANT ALL ON FUNCTION public.set_certification_grading_started(p_attempt_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.set_certification_grading_started(p_attempt_id uuid) TO service_role;


--
-- Name: FUNCTION set_daily_attendance_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_daily_attendance_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_daily_attendance_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_daily_attendance_updated_at() TO service_role;


--
-- Name: FUNCTION set_dvir_report_date(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_dvir_report_date() TO anon;
GRANT ALL ON FUNCTION public.set_dvir_report_date() TO authenticated;
GRANT ALL ON FUNCTION public.set_dvir_report_date() TO service_role;


--
-- Name: FUNCTION set_safety_announcements_published_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_safety_announcements_published_at() TO anon;
GRANT ALL ON FUNCTION public.set_safety_announcements_published_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_safety_announcements_published_at() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION sms_escalation_recipients_trim_phone(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sms_escalation_recipients_trim_phone() TO anon;
GRANT ALL ON FUNCTION public.sms_escalation_recipients_trim_phone() TO authenticated;
GRANT ALL ON FUNCTION public.sms_escalation_recipients_trim_phone() TO service_role;


--
-- Name: FUNCTION streak_bonus_amount(p_milestone_key text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.streak_bonus_amount(p_milestone_key text) TO anon;
GRANT ALL ON FUNCTION public.streak_bonus_amount(p_milestone_key text) TO authenticated;
GRANT ALL ON FUNCTION public.streak_bonus_amount(p_milestone_key text) TO service_role;


--
-- Name: FUNCTION submit_certification_test(p_test_attempt_id uuid, p_user_answers jsonb); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.submit_certification_test(p_test_attempt_id uuid, p_user_answers jsonb) TO anon;
GRANT ALL ON FUNCTION public.submit_certification_test(p_test_attempt_id uuid, p_user_answers jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.submit_certification_test(p_test_attempt_id uuid, p_user_answers jsonb) TO service_role;


--
-- Name: FUNCTION submit_practical_evaluation(p_user_id uuid, p_certification_type_id uuid, p_checklist_items jsonb, p_evaluator_notes text, p_evaluator_signature text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.submit_practical_evaluation(p_user_id uuid, p_certification_type_id uuid, p_checklist_items jsonb, p_evaluator_notes text, p_evaluator_signature text) TO anon;
GRANT ALL ON FUNCTION public.submit_practical_evaluation(p_user_id uuid, p_certification_type_id uuid, p_checklist_items jsonb, p_evaluator_notes text, p_evaluator_signature text) TO authenticated;
GRANT ALL ON FUNCTION public.submit_practical_evaluation(p_user_id uuid, p_certification_type_id uuid, p_checklist_items jsonb, p_evaluator_notes text, p_evaluator_signature text) TO service_role;


--
-- Name: FUNCTION sync_announcement_reward_to_ledger(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_announcement_reward_to_ledger() TO anon;
GRANT ALL ON FUNCTION public.sync_announcement_reward_to_ledger() TO authenticated;
GRANT ALL ON FUNCTION public.sync_announcement_reward_to_ledger() TO service_role;


--
-- Name: FUNCTION sync_attendance_to_absences(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_attendance_to_absences() TO anon;
GRANT ALL ON FUNCTION public.sync_attendance_to_absences() TO authenticated;
GRANT ALL ON FUNCTION public.sync_attendance_to_absences() TO service_role;


--
-- Name: FUNCTION sync_compliance_reward_to_ledger(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_compliance_reward_to_ledger() TO anon;
GRANT ALL ON FUNCTION public.sync_compliance_reward_to_ledger() TO authenticated;
GRANT ALL ON FUNCTION public.sync_compliance_reward_to_ledger() TO service_role;


--
-- Name: FUNCTION sync_electrical_qualification_level(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_electrical_qualification_level() TO anon;
GRANT ALL ON FUNCTION public.sync_electrical_qualification_level() TO authenticated;
GRANT ALL ON FUNCTION public.sync_electrical_qualification_level() TO service_role;


--
-- Name: FUNCTION sync_rto_approval_to_attendance(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_rto_approval_to_attendance() TO anon;
GRANT ALL ON FUNCTION public.sync_rto_approval_to_attendance() TO authenticated;
GRANT ALL ON FUNCTION public.sync_rto_approval_to_attendance() TO service_role;


--
-- Name: FUNCTION sync_streak_bonuses_for_user(p_user_id uuid, p_anchor_claimed_at timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.sync_streak_bonuses_for_user(p_user_id uuid, p_anchor_claimed_at timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.sync_streak_bonuses_for_user(p_user_id uuid, p_anchor_claimed_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.sync_streak_bonuses_for_user(p_user_id uuid, p_anchor_claimed_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION trg_sync_streak_bonus_to_ledger(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trg_sync_streak_bonus_to_ledger() TO anon;
GRANT ALL ON FUNCTION public.trg_sync_streak_bonus_to_ledger() TO authenticated;
GRANT ALL ON FUNCTION public.trg_sync_streak_bonus_to_ledger() TO service_role;


--
-- Name: FUNCTION trigger_safety_announcement(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.trigger_safety_announcement() TO anon;
GRANT ALL ON FUNCTION public.trigger_safety_announcement() TO authenticated;
GRANT ALL ON FUNCTION public.trigger_safety_announcement() TO service_role;


--
-- Name: FUNCTION update_crews_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_crews_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_crews_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_crews_updated_at() TO service_role;


--
-- Name: FUNCTION update_expired_certifications(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_expired_certifications() TO anon;
GRANT ALL ON FUNCTION public.update_expired_certifications() TO authenticated;
GRANT ALL ON FUNCTION public.update_expired_certifications() TO service_role;


--
-- Name: FUNCTION update_job_progress_trackers_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_job_progress_trackers_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_job_progress_trackers_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_job_progress_trackers_updated_at() TO service_role;


--
-- Name: FUNCTION update_maintenance_schedule_on_log(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_maintenance_schedule_on_log() TO anon;
GRANT ALL ON FUNCTION public.update_maintenance_schedule_on_log() TO authenticated;
GRANT ALL ON FUNCTION public.update_maintenance_schedule_on_log() TO service_role;


--
-- Name: FUNCTION update_my_avatar_url(p_path text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_my_avatar_url(p_path text) TO anon;
GRANT ALL ON FUNCTION public.update_my_avatar_url(p_path text) TO authenticated;
GRANT ALL ON FUNCTION public.update_my_avatar_url(p_path text) TO service_role;


--
-- Name: FUNCTION update_my_preferred_language(p_lang text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_my_preferred_language(p_lang text) TO anon;
GRANT ALL ON FUNCTION public.update_my_preferred_language(p_lang text) TO authenticated;
GRANT ALL ON FUNCTION public.update_my_preferred_language(p_lang text) TO service_role;


--
-- Name: FUNCTION update_notification_preferences_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_notification_preferences_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_notification_preferences_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_notification_preferences_updated_at() TO service_role;


--
-- Name: FUNCTION update_safety_announcements_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_safety_announcements_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_safety_announcements_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_safety_announcements_updated_at() TO service_role;


--
-- Name: FUNCTION update_schedule_mileage_from_dvir(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_schedule_mileage_from_dvir() TO anon;
GRANT ALL ON FUNCTION public.update_schedule_mileage_from_dvir() TO authenticated;
GRANT ALL ON FUNCTION public.update_schedule_mileage_from_dvir() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION update_user_activity_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_user_activity_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_user_activity_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_user_activity_updated_at() TO service_role;


--
-- Name: FUNCTION update_work_sites_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_work_sites_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_work_sites_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_work_sites_updated_at() TO service_role;


--
-- Name: FUNCTION user_has_certification_access(p_user_id uuid, p_certification_type_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.user_has_certification_access(p_user_id uuid, p_certification_type_id uuid) TO anon;
GRANT ALL ON FUNCTION public.user_has_certification_access(p_user_id uuid, p_certification_type_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_has_certification_access(p_user_id uuid, p_certification_type_id uuid) TO service_role;


--
-- Name: FUNCTION validate_recordable_incident(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.validate_recordable_incident() TO anon;
GRANT ALL ON FUNCTION public.validate_recordable_incident() TO authenticated;
GRANT ALL ON FUNCTION public.validate_recordable_incident() TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE custom_oauth_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.custom_oauth_providers TO postgres;
GRANT ALL ON TABLE auth.custom_oauth_providers TO dashboard_user;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE webauthn_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_challenges TO postgres;
GRANT ALL ON TABLE auth.webauthn_challenges TO dashboard_user;


--
-- Name: TABLE webauthn_credentials; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_credentials TO postgres;
GRANT ALL ON TABLE auth.webauthn_credentials TO dashboard_user;


--
-- Name: TABLE algorithm_tuning_runs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.algorithm_tuning_runs TO anon;
GRANT ALL ON TABLE public.algorithm_tuning_runs TO authenticated;
GRANT ALL ON TABLE public.algorithm_tuning_runs TO service_role;


--
-- Name: TABLE announcement_metadata; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.announcement_metadata TO anon;
GRANT ALL ON TABLE public.announcement_metadata TO authenticated;
GRANT ALL ON TABLE public.announcement_metadata TO service_role;


--
-- Name: TABLE announcement_rewards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.announcement_rewards TO anon;
GRANT ALL ON TABLE public.announcement_rewards TO authenticated;
GRANT ALL ON TABLE public.announcement_rewards TO service_role;


--
-- Name: TABLE announcements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.announcements TO anon;
GRANT ALL ON TABLE public.announcements TO authenticated;
GRANT ALL ON TABLE public.announcements TO service_role;


--
-- Name: TABLE app_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.app_settings TO anon;
GRANT ALL ON TABLE public.app_settings TO authenticated;
GRANT ALL ON TABLE public.app_settings TO service_role;


--
-- Name: TABLE app_settings_audit; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.app_settings_audit TO anon;
GRANT ALL ON TABLE public.app_settings_audit TO authenticated;
GRANT ALL ON TABLE public.app_settings_audit TO service_role;


--
-- Name: SEQUENCE app_settings_audit_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.app_settings_audit_id_seq TO anon;
GRANT ALL ON SEQUENCE public.app_settings_audit_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.app_settings_audit_id_seq TO service_role;


--
-- Name: TABLE daily_equipment_inspections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_equipment_inspections TO anon;
GRANT ALL ON TABLE public.daily_equipment_inspections TO authenticated;
GRANT ALL ON TABLE public.daily_equipment_inspections TO service_role;


--
-- Name: TABLE dvir_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.dvir_reports TO anon;
GRANT ALL ON TABLE public.dvir_reports TO authenticated;
GRANT ALL ON TABLE public.dvir_reports TO service_role;


--
-- Name: TABLE vehicle_maintenance_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vehicle_maintenance_log TO anon;
GRANT ALL ON TABLE public.vehicle_maintenance_log TO authenticated;
GRANT ALL ON TABLE public.vehicle_maintenance_log TO service_role;


--
-- Name: TABLE unified_fix_costs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.unified_fix_costs TO anon;
GRANT ALL ON TABLE public.unified_fix_costs TO authenticated;
GRANT ALL ON TABLE public.unified_fix_costs TO service_role;


--
-- Name: TABLE asset_cost_summary; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.asset_cost_summary TO anon;
GRANT ALL ON TABLE public.asset_cost_summary TO authenticated;
GRANT ALL ON TABLE public.asset_cost_summary TO service_role;


--
-- Name: TABLE attendance_summaries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.attendance_summaries TO anon;
GRANT ALL ON TABLE public.attendance_summaries TO authenticated;
GRANT ALL ON TABLE public.attendance_summaries TO service_role;


--
-- Name: TABLE auto_tuning_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.auto_tuning_config TO anon;
GRANT ALL ON TABLE public.auto_tuning_config TO authenticated;
GRANT ALL ON TABLE public.auto_tuning_config TO service_role;


--
-- Name: TABLE certification_access_grants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.certification_access_grants TO anon;
GRANT ALL ON TABLE public.certification_access_grants TO authenticated;
GRANT ALL ON TABLE public.certification_access_grants TO service_role;


--
-- Name: TABLE certification_attempts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.certification_attempts TO anon;
GRANT ALL ON TABLE public.certification_attempts TO authenticated;
GRANT ALL ON TABLE public.certification_attempts TO service_role;


--
-- Name: TABLE certification_audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.certification_audit_log TO anon;
GRANT ALL ON TABLE public.certification_audit_log TO authenticated;
GRANT ALL ON TABLE public.certification_audit_log TO service_role;


--
-- Name: TABLE certification_completion_stats; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.certification_completion_stats TO anon;
GRANT ALL ON TABLE public.certification_completion_stats TO authenticated;
GRANT ALL ON TABLE public.certification_completion_stats TO service_role;


--
-- Name: TABLE certification_expiration_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.certification_expiration_notifications TO anon;
GRANT ALL ON TABLE public.certification_expiration_notifications TO authenticated;
GRANT ALL ON TABLE public.certification_expiration_notifications TO service_role;


--
-- Name: TABLE certification_questions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.certification_questions TO anon;
GRANT ALL ON TABLE public.certification_questions TO authenticated;
GRANT ALL ON TABLE public.certification_questions TO service_role;


--
-- Name: TABLE company_calendar; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.company_calendar TO anon;
GRANT ALL ON TABLE public.company_calendar TO authenticated;
GRANT ALL ON TABLE public.company_calendar TO service_role;


--
-- Name: TABLE compliance_notifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_notifications TO anon;
GRANT ALL ON TABLE public.compliance_notifications TO authenticated;
GRANT ALL ON TABLE public.compliance_notifications TO service_role;


--
-- Name: TABLE compliance_rewards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_rewards TO anon;
GRANT ALL ON TABLE public.compliance_rewards TO authenticated;
GRANT ALL ON TABLE public.compliance_rewards TO service_role;


--
-- Name: TABLE compliance_runs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.compliance_runs TO anon;
GRANT ALL ON TABLE public.compliance_runs TO authenticated;
GRANT ALL ON TABLE public.compliance_runs TO service_role;


--
-- Name: TABLE daily_jsa; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_jsa TO anon;
GRANT ALL ON TABLE public.daily_jsa TO authenticated;
GRANT ALL ON TABLE public.daily_jsa TO service_role;


--
-- Name: TABLE compliance_summary_90d; Type: ACL; Schema: public; Owner: postgres
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.compliance_summary_90d TO anon;
GRANT ALL ON TABLE public.compliance_summary_90d TO authenticated;
GRANT ALL ON TABLE public.compliance_summary_90d TO service_role;


--
-- Name: TABLE contact_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contact_requests TO anon;
GRANT ALL ON TABLE public.contact_requests TO authenticated;
GRANT ALL ON TABLE public.contact_requests TO service_role;


--
-- Name: TABLE corrective_actions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.corrective_actions TO anon;
GRANT ALL ON TABLE public.corrective_actions TO authenticated;
GRANT ALL ON TABLE public.corrective_actions TO service_role;


--
-- Name: TABLE crew_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.crew_members TO anon;
GRANT ALL ON TABLE public.crew_members TO authenticated;
GRANT ALL ON TABLE public.crew_members TO service_role;


--
-- Name: TABLE crews; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.crews TO anon;
GRANT ALL ON TABLE public.crews TO authenticated;
GRANT ALL ON TABLE public.crews TO service_role;


--
-- Name: TABLE crew_with_member_count; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.crew_with_member_count TO anon;
GRANT ALL ON TABLE public.crew_with_member_count TO authenticated;
GRANT ALL ON TABLE public.crew_with_member_count TO service_role;


--
-- Name: TABLE cron_job_runs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cron_job_runs TO anon;
GRANT ALL ON TABLE public.cron_job_runs TO authenticated;
GRANT ALL ON TABLE public.cron_job_runs TO service_role;


--
-- Name: TABLE daily_attendance; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_attendance TO anon;
GRANT ALL ON TABLE public.daily_attendance TO authenticated;
GRANT ALL ON TABLE public.daily_attendance TO service_role;


--
-- Name: TABLE data_retention_policies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.data_retention_policies TO anon;
GRANT ALL ON TABLE public.data_retention_policies TO authenticated;
GRANT ALL ON TABLE public.data_retention_policies TO service_role;


--
-- Name: TABLE email_recipient_lists; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_recipient_lists TO anon;
GRANT ALL ON TABLE public.email_recipient_lists TO authenticated;
GRANT ALL ON TABLE public.email_recipient_lists TO service_role;


--
-- Name: TABLE email_send_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.email_send_log TO anon;
GRANT ALL ON TABLE public.email_send_log TO authenticated;
GRANT ALL ON TABLE public.email_send_log TO service_role;


--
-- Name: TABLE external_certification_types; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.external_certification_types TO anon;
GRANT ALL ON TABLE public.external_certification_types TO authenticated;
GRANT ALL ON TABLE public.external_certification_types TO service_role;


--
-- Name: TABLE job_crew_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_crew_assignments TO anon;
GRANT ALL ON TABLE public.job_crew_assignments TO authenticated;
GRANT ALL ON TABLE public.job_crew_assignments TO service_role;


--
-- Name: TABLE job_milestones; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_milestones TO anon;
GRANT ALL ON TABLE public.job_milestones TO authenticated;
GRANT ALL ON TABLE public.job_milestones TO service_role;


--
-- Name: TABLE job_progress_trackers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_progress_trackers TO anon;
GRANT ALL ON TABLE public.job_progress_trackers TO authenticated;
GRANT ALL ON TABLE public.job_progress_trackers TO service_role;


--
-- Name: TABLE job_progress_updates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.job_progress_updates TO anon;
GRANT ALL ON TABLE public.job_progress_updates TO authenticated;
GRANT ALL ON TABLE public.job_progress_updates TO service_role;


--
-- Name: TABLE jsa_sharing_audit; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.jsa_sharing_audit TO anon;
GRANT ALL ON TABLE public.jsa_sharing_audit TO authenticated;
GRANT ALL ON TABLE public.jsa_sharing_audit TO service_role;


--
-- Name: TABLE maintenance_schedules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.maintenance_schedules TO anon;
GRANT ALL ON TABLE public.maintenance_schedules TO authenticated;
GRANT ALL ON TABLE public.maintenance_schedules TO service_role;


--
-- Name: TABLE mass_sms_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.mass_sms_log TO anon;
GRANT ALL ON TABLE public.mass_sms_log TO authenticated;
GRANT ALL ON TABLE public.mass_sms_log TO service_role;


--
-- Name: TABLE mileage_anomalies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.mileage_anomalies TO anon;
GRANT ALL ON TABLE public.mileage_anomalies TO authenticated;
GRANT ALL ON TABLE public.mileage_anomalies TO service_role;


--
-- Name: TABLE monthly_reward_drawings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.monthly_reward_drawings TO anon;
GRANT ALL ON TABLE public.monthly_reward_drawings TO authenticated;
GRANT ALL ON TABLE public.monthly_reward_drawings TO service_role;


--
-- Name: TABLE monthly_safety_rewards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.monthly_safety_rewards TO anon;
GRANT ALL ON TABLE public.monthly_safety_rewards TO authenticated;
GRANT ALL ON TABLE public.monthly_safety_rewards TO service_role;


--
-- Name: TABLE monthly_summary_recipients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.monthly_summary_recipients TO anon;
GRANT ALL ON TABLE public.monthly_summary_recipients TO authenticated;
GRANT ALL ON TABLE public.monthly_summary_recipients TO service_role;


--
-- Name: TABLE monthly_summary_send_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.monthly_summary_send_log TO anon;
GRANT ALL ON TABLE public.monthly_summary_send_log TO authenticated;
GRANT ALL ON TABLE public.monthly_summary_send_log TO service_role;


--
-- Name: TABLE notification_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_events TO anon;
GRANT ALL ON TABLE public.notification_events TO authenticated;
GRANT ALL ON TABLE public.notification_events TO service_role;


--
-- Name: TABLE notification_outbox; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_outbox TO anon;
GRANT ALL ON TABLE public.notification_outbox TO authenticated;
GRANT ALL ON TABLE public.notification_outbox TO service_role;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.notification_preferences TO anon;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;


--
-- Name: TABLE osha_300a_certifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.osha_300a_certifications TO anon;
GRANT ALL ON TABLE public.osha_300a_certifications TO authenticated;
GRANT ALL ON TABLE public.osha_300a_certifications TO service_role;


--
-- Name: TABLE osha_compliance_mapping; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.osha_compliance_mapping TO anon;
GRANT ALL ON TABLE public.osha_compliance_mapping TO authenticated;
GRANT ALL ON TABLE public.osha_compliance_mapping TO service_role;


--
-- Name: TABLE payroll_reminder_sms_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.payroll_reminder_sms_log TO anon;
GRANT ALL ON TABLE public.payroll_reminder_sms_log TO authenticated;
GRANT ALL ON TABLE public.payroll_reminder_sms_log TO service_role;


--
-- Name: TABLE pending_certification_reviews; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pending_certification_reviews TO anon;
GRANT ALL ON TABLE public.pending_certification_reviews TO authenticated;
GRANT ALL ON TABLE public.pending_certification_reviews TO service_role;


--
-- Name: TABLE point_awarder_grants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.point_awarder_grants TO anon;
GRANT ALL ON TABLE public.point_awarder_grants TO authenticated;
GRANT ALL ON TABLE public.point_awarder_grants TO service_role;


--
-- Name: TABLE point_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.point_rules TO anon;
GRANT ALL ON TABLE public.point_rules TO authenticated;
GRANT ALL ON TABLE public.point_rules TO service_role;


--
-- Name: TABLE point_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.point_transactions TO anon;
GRANT ALL ON TABLE public.point_transactions TO authenticated;
GRANT ALL ON TABLE public.point_transactions TO service_role;


--
-- Name: TABLE practical_evaluation_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.practical_evaluation_templates TO anon;
GRANT ALL ON TABLE public.practical_evaluation_templates TO authenticated;
GRANT ALL ON TABLE public.practical_evaluation_templates TO service_role;


--
-- Name: TABLE practical_evaluations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.practical_evaluations TO anon;
GRANT ALL ON TABLE public.practical_evaluations TO authenticated;
GRANT ALL ON TABLE public.practical_evaluations TO service_role;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


--
-- Name: TABLE reward_catalog; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reward_catalog TO anon;
GRANT ALL ON TABLE public.reward_catalog TO authenticated;
GRANT ALL ON TABLE public.reward_catalog TO service_role;


--
-- Name: TABLE reward_claim_override_dates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.reward_claim_override_dates TO anon;
GRANT ALL ON TABLE public.reward_claim_override_dates TO authenticated;
GRANT ALL ON TABLE public.reward_claim_override_dates TO service_role;


--
-- Name: TABLE risk_algorithm_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.risk_algorithm_config TO anon;
GRANT ALL ON TABLE public.risk_algorithm_config TO authenticated;
GRANT ALL ON TABLE public.risk_algorithm_config TO service_role;


--
-- Name: TABLE risk_score_history; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.risk_score_history TO anon;
GRANT ALL ON TABLE public.risk_score_history TO authenticated;
GRANT ALL ON TABLE public.risk_score_history TO service_role;


--
-- Name: TABLE rto_requests; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rto_requests TO anon;
GRANT ALL ON TABLE public.rto_requests TO authenticated;
GRANT ALL ON TABLE public.rto_requests TO service_role;


--
-- Name: TABLE safety_announcements; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.safety_announcements TO anon;
GRANT ALL ON TABLE public.safety_announcements TO authenticated;
GRANT ALL ON TABLE public.safety_announcements TO service_role;


--
-- Name: TABLE safety_audit_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.safety_audit_log TO anon;
GRANT ALL ON TABLE public.safety_audit_log TO authenticated;
GRANT ALL ON TABLE public.safety_audit_log TO service_role;


--
-- Name: TABLE safety_briefing_answer_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.safety_briefing_answer_items TO anon;
GRANT ALL ON TABLE public.safety_briefing_answer_items TO authenticated;
GRANT ALL ON TABLE public.safety_briefing_answer_items TO service_role;


--
-- Name: TABLE safety_briefing_answers; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.safety_briefing_answers TO anon;
GRANT ALL ON TABLE public.safety_briefing_answers TO authenticated;
GRANT ALL ON TABLE public.safety_briefing_answers TO service_role;


--
-- Name: TABLE safety_flags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.safety_flags TO anon;
GRANT ALL ON TABLE public.safety_flags TO authenticated;
GRANT ALL ON TABLE public.safety_flags TO service_role;


--
-- Name: TABLE safety_incidents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.safety_incidents TO anon;
GRANT ALL ON TABLE public.safety_incidents TO authenticated;
GRANT ALL ON TABLE public.safety_incidents TO service_role;


--
-- Name: TABLE scheduled_cron_jobs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scheduled_cron_jobs TO anon;
GRANT ALL ON TABLE public.scheduled_cron_jobs TO authenticated;
GRANT ALL ON TABLE public.scheduled_cron_jobs TO service_role;


--
-- Name: TABLE sms_escalation_recipients; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sms_escalation_recipients TO anon;
GRANT ALL ON TABLE public.sms_escalation_recipients TO authenticated;
GRANT ALL ON TABLE public.sms_escalation_recipients TO service_role;


--
-- Name: TABLE sms_escalation_send_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sms_escalation_send_log TO anon;
GRANT ALL ON TABLE public.sms_escalation_send_log TO authenticated;
GRANT ALL ON TABLE public.sms_escalation_send_log TO service_role;


--
-- Name: TABLE storage_cleanup_queue; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.storage_cleanup_queue TO anon;
GRANT ALL ON TABLE public.storage_cleanup_queue TO authenticated;
GRANT ALL ON TABLE public.storage_cleanup_queue TO service_role;


--
-- Name: TABLE telemetry_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.telemetry_events TO anon;
GRANT ALL ON TABLE public.telemetry_events TO authenticated;
GRANT ALL ON TABLE public.telemetry_events TO service_role;


--
-- Name: TABLE tuning_decisions_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tuning_decisions_log TO anon;
GRANT ALL ON TABLE public.tuning_decisions_log TO authenticated;
GRANT ALL ON TABLE public.tuning_decisions_log TO service_role;


--
-- Name: TABLE user_absences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_absences TO anon;
GRANT ALL ON TABLE public.user_absences TO authenticated;
GRANT ALL ON TABLE public.user_absences TO service_role;


--
-- Name: TABLE user_activity_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_activity_sessions TO anon;
GRANT ALL ON TABLE public.user_activity_sessions TO authenticated;
GRANT ALL ON TABLE public.user_activity_sessions TO service_role;


--
-- Name: TABLE user_activity_feed; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_activity_feed TO anon;
GRANT ALL ON TABLE public.user_activity_feed TO authenticated;
GRANT ALL ON TABLE public.user_activity_feed TO service_role;


--
-- Name: TABLE user_contact_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_contact_templates TO anon;
GRANT ALL ON TABLE public.user_contact_templates TO authenticated;
GRANT ALL ON TABLE public.user_contact_templates TO service_role;


--
-- Name: TABLE user_management_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_management_log TO anon;
GRANT ALL ON TABLE public.user_management_log TO authenticated;
GRANT ALL ON TABLE public.user_management_log TO service_role;


--
-- Name: TABLE user_preferences; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_preferences TO anon;
GRANT ALL ON TABLE public.user_preferences TO authenticated;
GRANT ALL ON TABLE public.user_preferences TO service_role;


--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;


--
-- Name: TABLE user_saved_locations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_saved_locations TO anon;
GRANT ALL ON TABLE public.user_saved_locations TO authenticated;
GRANT ALL ON TABLE public.user_saved_locations TO service_role;


--
-- Name: TABLE user_signatures; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_signatures TO anon;
GRANT ALL ON TABLE public.user_signatures TO authenticated;
GRANT ALL ON TABLE public.user_signatures TO service_role;


--
-- Name: TABLE weekly_safety_reports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.weekly_safety_reports TO anon;
GRANT ALL ON TABLE public.weekly_safety_reports TO authenticated;
GRANT ALL ON TABLE public.weekly_safety_reports TO service_role;


--
-- Name: TABLE work_sites; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.work_sites TO anon;
GRANT ALL ON TABLE public.work_sites TO authenticated;
GRANT ALL ON TABLE public.work_sites TO service_role;


--
-- Name: TABLE worker_external_certifications; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.worker_external_certifications TO anon;
GRANT ALL ON TABLE public.worker_external_certifications TO authenticated;
GRANT ALL ON TABLE public.worker_external_certifications TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 3qs4Ao4SPmTg4RurpbXmspPfVCaVV8PN5AfY1cRb315ro4SElp4jK3sf2anP7ae

