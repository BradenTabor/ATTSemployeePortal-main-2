-- =============================================================================
-- App Settings: key-value config table for Safety Announcement, Briefing, and
-- Rewards features. Admin-editable at runtime (no redeploy needed).
-- Includes audit trail and atomic cron-schedule update RPC.
-- =============================================================================

-- 1. Main settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read" ON public.app_settings;
CREATE POLICY "authenticated_read" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert" ON public.app_settings;
CREATE POLICY "admin_insert" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update" ON public.app_settings;
CREATE POLICY "admin_update" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete" ON public.app_settings;
CREATE POLICY "admin_delete" ON public.app_settings
  FOR DELETE TO authenticated USING (public.is_admin());

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION public.app_settings_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.app_settings_touch_updated_at();

-- 2. Audit trail
CREATE TABLE IF NOT EXISTS public.app_settings_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  key text NOT NULL,
  old_value jsonb NOT NULL,
  new_value jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.app_settings_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit" ON public.app_settings_audit;
CREATE POLICY "admin_read_audit" ON public.app_settings_audit
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.audit_app_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.app_settings_audit (key, old_value, new_value, changed_by)
  VALUES (OLD.key, OLD.value, NEW.value, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_settings_audit ON public.app_settings;
CREATE TRIGGER trg_app_settings_audit
  AFTER UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_app_settings();

-- 3. Seed with current hardcoded defaults (idempotent)
INSERT INTO public.app_settings (key, value) VALUES
(
  'safety_announcement_config',
  '{
    "enabled": true,
    "schedule_utc_hour": 10,
    "schedule_utc_minute": 0,
    "schedule_days": ["mon","tue","wed","thu","fri"],
    "window_hours": 48,
    "min_submissions": 3,
    "body_max_chars": 283,
    "body_target_chars": 238,
    "summary_max_chars": 240,
    "custom_prompt_instructions": ""
  }'::jsonb
),
(
  'safety_briefing_config',
  '{
    "enabled": true,
    "required_roles": ["employee","foreman","general_foreman","mechanic"],
    "reminder_push_utc": {"hour": 10, "minute": 20},
    "reminder_sms_utc": {"hour": 10, "minute": 40},
    "escalation_sms_utc": {"hour": 16, "minute": 0},
    "tree_service_standard_text": "ANSI Z133 and OSHA 29 CFR 1910.266 apply to arboricultural operations. Key points:\n• Maintain minimum approach distances near electrical conductors.\n• Use appropriate PPE: hard hat, eye and hearing protection, leg protection, gloves, and footwear.\n• Pre-job hazard assessment and escape routes before making the first cut.\n• Only qualified personnel may work within minimum approach distance of energized lines.\n• Inspect equipment and rigging before use. Communicate with your crew and lookouts.",
    "personalized_fallback_text": "Are you staying hydrated? Did you get at least 7 hours of sleep? Take a moment to check in with yourself before starting work.",
    "safety_tips": [
      "Before the first cut, identify escape routes and clear the drop zone.",
      "Maintain minimum approach distance near energized lines—only qualified personnel inside MAD.",
      "Hard hat, eye and hearing protection, leg protection, gloves, and boots are required for chainsaw work per ANSI Z133.",
      "Inspect rigging and equipment before use; communicate with your crew and lookouts.",
      "Stay hydrated and take breaks in the heat; watch for signs of heat stress in yourself and others.",
      "Three points of contact when climbing; secure your tie-in before advancing.",
      "Pre-trip inspection: tires, lights, brakes, and secure loads before driving.",
      "If you see something that could hurt someone, say something—everyone is responsible for safety.",
      "Cold weather: dress in layers and keep extremities warm; watch for ice on surfaces.",
      "Chipper: never reach into the feed area; use a push stick and keep hands clear.",
      "Know where your first-aid kit and eyewash are on every job site.",
      "Report near-misses so we can prevent real incidents; no blame."
    ],
    "questions": {
      "tree_safety": [
        {"id":"ts-1","category":"tree_safety","text":"Before starting any cut, what is the most important factor to assess?","options":[{"id":"ts-1-a","text":"Lean direction and weight distribution of the tree"},{"id":"ts-1-b","text":"Distance to the nearest road"},{"id":"ts-1-c","text":"Time of day"},{"id":"ts-1-d","text":"Number of crew members present"}]},
        {"id":"ts-2","category":"tree_safety","text":"When working near power lines, what is the minimum approach distance for unqualified personnel?","options":[{"id":"ts-2-a","text":"10 feet"},{"id":"ts-2-b","text":"Minimum approach distance per voltage (e.g. 10–20+ ft)"},{"id":"ts-2-c","text":"No minimum if the line is insulated"},{"id":"ts-2-d","text":"Same as for qualified personnel"}]},
        {"id":"ts-3","category":"tree_safety","text":"What should you do before making the first cut on a tree?","options":[{"id":"ts-3-a","text":"Identify escape routes and clear the drop zone"},{"id":"ts-3-b","text":"Check the weather only"},{"id":"ts-3-c","text":"Ensure the chipper is running"},{"id":"ts-3-d","text":"Call the foreman"}]},
        {"id":"ts-4","category":"tree_safety","text":"Which PPE is required for chainsaw operation per ANSI Z133?","options":[{"id":"ts-4-a","text":"Hard hat, eye protection, hearing protection, leg protection, gloves, boots"},{"id":"ts-4-b","text":"Hard hat and gloves only"},{"id":"ts-4-c","text":"Eye protection only when cutting overhead"},{"id":"ts-4-d","text":"Leg protection only when on the ground"}]}
      ],
      "personal_health": [
        {"id":"ph-1","category":"personal_health","text":"How well-rested do you feel starting your shift today?","options":[{"id":"ph-1-a","text":"Well-rested (7+ hours of sleep)"},{"id":"ph-1-b","text":"Adequate (5–7 hours)"},{"id":"ph-1-c","text":"Tired (under 5 hours)"},{"id":"ph-1-d","text":"Prefer not to say"}]},
        {"id":"ph-2","category":"personal_health","text":"Are you staying hydrated today?","options":[{"id":"ph-2-a","text":"Yes, I have water and will drink regularly"},{"id":"ph-2-b","text":"I have water but sometimes forget"},{"id":"ph-2-c","text":"I need to refill / get water"},{"id":"ph-2-d","text":"Prefer not to say"}]},
        {"id":"ph-3","category":"personal_health","text":"Do you have any physical limitations today that could affect your safety?","options":[{"id":"ph-3-a","text":"No, I am good to go"},{"id":"ph-3-b","text":"Minor (e.g. stiff back); I will pace myself"},{"id":"ph-3-c","text":"Yes; I will discuss with my supervisor"},{"id":"ph-3-d","text":"Prefer not to say"}]},
        {"id":"ph-4","category":"personal_health","text":"Did you get at least 7 hours of sleep last night?","options":[{"id":"ph-4-a","text":"Yes"},{"id":"ph-4-b","text":"Between 5 and 7 hours"},{"id":"ph-4-c","text":"Less than 5 hours"},{"id":"ph-4-d","text":"Prefer not to say"}]}
      ],
      "announcement": [
        {"id":"ann-1","category":"announcement","text":"After reading today''s safety announcement, which area will you pay extra attention to?","options":[{"id":"ann-1-a","text":"PPE compliance"},{"id":"ann-1-b","text":"Equipment pre-trip inspection"},{"id":"ann-1-c","text":"Weather-related hazards"},{"id":"ann-1-d","text":"Communication with my crew"},{"id":"ann-1-e","text":"All of the above"}]},
        {"id":"ann-2","category":"announcement","text":"What from today''s safety message will you apply on the job today?","options":[{"id":"ann-2-a","text":"The main hazard or condition mentioned"},{"id":"ann-2-b","text":"PPE and pre-trip reminders"},{"id":"ann-2-c","text":"Crew communication and lookout"},{"id":"ann-2-d","text":"All of the above"}]},
        {"id":"ann-3","category":"announcement","text":"Today''s announcement reminded us to:","options":[{"id":"ann-3-a","text":"Stay alert and watch out for each other"},{"id":"ann-3-b","text":"Complete inspections before starting"},{"id":"ann-3-c","text":"Dress for the conditions and wear required PPE"},{"id":"ann-3-d","text":"Any of the above (message may vary by day)"}]},
        {"id":"ann-4","category":"announcement","text":"I have read and understood today''s safety announcement.","options":[{"id":"ann-4-a","text":"Yes"},{"id":"ann-4-b","text":"Yes, and I will share key points with my crew"},{"id":"ann-4-c","text":"I need to re-read it"},{"id":"ann-4-d","text":"Prefer not to say"}]}
      ]
    }
  }'::jsonb
),
(
  'reward_points_config',
  '{
    "enabled": true,
    "claim_window_start_hour_central": 5,
    "claim_window_end_hour_central": 8,
    "announcement_points": 1,
    "full_compliance_points": 5,
    "partial_compliance_points": 2,
    "streak_bonus_points": 10,
    "streak_min_days": 5,
    "override_dates": ["2026-03-10"]
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 4. Rewrite is_reward_claim_window() to read from app_settings at call time.
--    COALESCE to false when the row is missing.
CREATE OR REPLACE FUNCTION public.is_reward_claim_window()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT (
        (NOW() AT TIME ZONE 'America/Chicago')::time
          >= make_time((s.value->>'claim_window_start_hour_central')::int, 0, 0)
        AND (NOW() AT TIME ZONE 'America/Chicago')::time
          < make_time((s.value->>'claim_window_end_hour_central')::int, 0, 0)
      )
      FROM public.app_settings s
      WHERE s.key = 'reward_points_config'
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.is_reward_claim_window() IS
  'Returns true between claim_window_start_hour_central and claim_window_end_hour_central from app_settings. Falls back to false if row is missing.';

-- 5. Atomic RPC: save settings + update cron schedule in one transaction.
--    Validates job name against allowlist. Accepts the new cron expression and
--    the setting key + value to write atomically.
CREATE OR REPLACE FUNCTION public.save_setting_and_update_cron(
  p_setting_key text,
  p_setting_value jsonb,
  p_expected_updated_at timestamptz,
  p_cron_updates jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.save_setting_and_update_cron IS
  'Atomically saves an app_settings value (with optimistic lock) and optionally updates pg_cron schedules. Admin-only.';
