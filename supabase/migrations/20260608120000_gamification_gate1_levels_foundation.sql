-- =============================================================================
-- Gamification Phase 1 — Gate 1: schema spine + levels foundation
-- - level_tiers (seeded §4 ladder), gamification_settings
-- - badges, user_badges, streak_state, streak_week_activity, recognition_feed
--   (structure only — wiring in Gates 2–4)
-- - get_user_lifetime_earned(), get_user_level()
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: level_tiers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.level_tiers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key         text NOT NULL,
  tier_name        text NOT NULL,
  tier_order       int NOT NULL,
  sub_level        int NOT NULL CHECK (sub_level BETWEEN 1 AND 3),
  sub_level_label  text NOT NULL,
  entry_threshold  int NOT NULL CHECK (entry_threshold >= 0),
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT level_tiers_tier_sub_unique UNIQUE (tier_key, sub_level),
  CONSTRAINT level_tiers_threshold_unique UNIQUE (entry_threshold)
);

CREATE INDEX IF NOT EXISTS idx_level_tiers_active_order
  ON public.level_tiers (entry_threshold)
  WHERE is_active;

COMMENT ON TABLE public.level_tiers IS
  'Gamification tier ladder — thresholds on lifetime earned points (tunable without deploy).';

ALTER TABLE public.level_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read level tiers" ON public.level_tiers;
CREATE POLICY "Authenticated read level tiers"
  ON public.level_tiers FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage level tiers" ON public.level_tiers;
CREATE POLICY "Admins manage level tiers"
  ON public.level_tiers TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role full access level tiers" ON public.level_tiers;
CREATE POLICY "Service role full access level tiers"
  ON public.level_tiers TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- TABLE: gamification_settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gamification_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id)
);

COMMENT ON TABLE public.gamification_settings IS
  'Admin-tunable gamification program configuration (badges, streaks, eligibility).';

ALTER TABLE public.gamification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read gamification settings" ON public.gamification_settings;
CREATE POLICY "Authenticated read gamification settings"
  ON public.gamification_settings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin and safety officer manage gamification settings" ON public.gamification_settings;
CREATE POLICY "Admin and safety officer manage gamification settings"
  ON public.gamification_settings TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = auth.uid() AND au.role = 'safety_officer'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = auth.uid() AND au.role = 'safety_officer'
    )
  );

DROP POLICY IF EXISTS "Service role full access gamification settings" ON public.gamification_settings;
CREATE POLICY "Service role full access gamification settings"
  ON public.gamification_settings TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_gamification_settings_updated_at
  BEFORE UPDATE ON public.gamification_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- TABLE: badges (structure — seed in Gate 2)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badges (
  badge_key        text PRIMARY KEY,
  category         text NOT NULL,
  title            text NOT NULL,
  description      text NOT NULL,
  condition_spec   jsonb NOT NULL DEFAULT '{}'::jsonb,
  prestige_max     int NOT NULL DEFAULT 1 CHECK (prestige_max BETWEEN 1 AND 3),
  is_feed_worthy   boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.badges IS 'Badge definitions for the gamification program.';

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read badges" ON public.badges;
CREATE POLICY "Authenticated read badges"
  ON public.badges FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin and safety officer manage badges" ON public.badges;
CREATE POLICY "Admin and safety officer manage badges"
  ON public.badges TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = auth.uid() AND au.role = 'safety_officer'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.app_users au
      WHERE au.user_id = auth.uid() AND au.role = 'safety_officer'
    )
  );

DROP POLICY IF EXISTS "Service role full access badges" ON public.badges;
CREATE POLICY "Service role full access badges"
  ON public.badges TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- TABLE: user_badges (structure — award engine in Gate 2)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_badges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key       text NOT NULL REFERENCES public.badges(badge_key),
  prestige_tier   int NOT NULL DEFAULT 1 CHECK (prestige_tier BETWEEN 1 AND 3),
  awarded_at      timestamptz NOT NULL DEFAULT now(),
  reference_id    uuid,
  reference_table text,
  CONSTRAINT user_badges_unique UNIQUE (user_id, badge_key, prestige_tier)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user
  ON public.user_badges (user_id, awarded_at DESC);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own badges" ON public.user_badges;
CREATE POLICY "Users read own badges"
  ON public.user_badges FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all user badges" ON public.user_badges;
CREATE POLICY "Admins read all user badges"
  ON public.user_badges FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access user badges" ON public.user_badges;
CREATE POLICY "Service role full access user badges"
  ON public.user_badges TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- TABLE: streak_state + streak_week_activity (structure — engine in Gate 3)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.streak_state (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak_weeks int NOT NULL DEFAULT 0,
  longest_streak       int NOT NULL DEFAULT 0,
  last_active_week     date,
  freezes_remaining    int NOT NULL DEFAULT 1,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_streak_state_updated_at
  BEFORE UPDATE ON public.streak_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.streak_week_activity (
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start        date NOT NULL,
  activity_source   text NOT NULL,
  reference_id      uuid,
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start, activity_source, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_streak_week_activity_user_week
  ON public.streak_week_activity (user_id, week_start DESC);

ALTER TABLE public.streak_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_week_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own streak state" ON public.streak_state;
CREATE POLICY "Users read own streak state"
  ON public.streak_state FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all streak state" ON public.streak_state;
CREATE POLICY "Admins read all streak state"
  ON public.streak_state FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access streak state" ON public.streak_state;
CREATE POLICY "Service role full access streak state"
  ON public.streak_state TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users read own streak week activity" ON public.streak_week_activity;
CREATE POLICY "Users read own streak week activity"
  ON public.streak_week_activity FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all streak week activity" ON public.streak_week_activity;
CREATE POLICY "Admins read all streak week activity"
  ON public.streak_week_activity FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access streak week activity" ON public.streak_week_activity;
CREATE POLICY "Service role full access streak week activity"
  ON public.streak_week_activity TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- TABLE: recognition_feed (structure — emitter in Gate 4)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.recognition_event_type AS ENUM (
    'tier_promotion',
    'badge_awarded',
    'tenure_milestone',
    'streak_milestone'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.recognition_feed (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      public.recognition_event_type NOT NULL,
  subject_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  dedupe_key      text NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_recognition_feed_created
  ON public.recognition_feed (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_recognition_feed_subject
  ON public.recognition_feed (subject_user_id, created_at DESC);

ALTER TABLE public.recognition_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read recognition feed" ON public.recognition_feed;
CREATE POLICY "Authenticated read recognition feed"
  ON public.recognition_feed FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role full access recognition feed" ON public.recognition_feed;
CREATE POLICY "Service role full access recognition feed"
  ON public.recognition_feed TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- SEED: level_tiers (§4 ladder — lifetime earned thresholds)
-- -----------------------------------------------------------------------------
INSERT INTO public.level_tiers
  (tier_key, tier_name, tier_order, sub_level, sub_level_label, entry_threshold)
VALUES
  ('seedling',   'Seedling',   1, 1, 'I',      0),
  ('seedling',   'Seedling',   1, 2, 'II',    20),
  ('seedling',   'Seedling',   1, 3, 'III',   35),
  ('sapling',    'Sapling',    2, 1, 'I',     50),
  ('sapling',    'Sapling',    2, 2, 'II',    85),
  ('sapling',    'Sapling',    2, 3, 'III',  120),
  ('rooted',     'Rooted',     3, 1, 'I',    150),
  ('rooted',     'Rooted',     3, 2, 'II',   230),
  ('rooted',     'Rooted',     3, 3, 'III',  310),
  ('mature',     'Mature',     4, 1, 'I',    400),
  ('mature',     'Mature',     4, 2, 'II',   565),
  ('mature',     'Mature',     4, 3, 'III',  730),
  ('towering',   'Towering',   5, 1, 'I',    900),
  ('towering',   'Towering',   5, 2, 'II',  1200),
  ('towering',   'Towering',   5, 3, 'III', 1500),
  ('canopy',     'Canopy',     6, 1, 'I',   1800),
  ('canopy',     'Canopy',     6, 2, 'II',  2350),
  ('canopy',     'Canopy',     6, 3, 'III', 2900),
  ('old_growth', 'Old Growth', 7, 1, 'I',   3500),
  ('old_growth', 'Old Growth', 7, 2, 'II',  4650),
  ('old_growth', 'Old Growth', 7, 3, 'III', 5800),
  ('redwood',    'Redwood',    8, 1, 'I',   7000),
  ('redwood',    'Redwood',    8, 2, 'II',  9000),
  ('redwood',    'Redwood',    8, 3, 'III',11000)
ON CONFLICT (entry_threshold) DO NOTHING;

-- -----------------------------------------------------------------------------
-- SEED: gamification_settings (§6 thresholds confirmed at Gate 0 review)
-- -----------------------------------------------------------------------------
INSERT INTO public.gamification_settings (key, value, description) VALUES
  ('program_owner_user_id', 'null'::jsonb,
   'Primary gamification program owner (stub Phase 1)'),
  ('program_backup_user_id', 'null'::jsonb,
   'Backup owner (stub Phase 1)'),
  ('streak_freezes_per_user', '1'::jsonb,
   'Manual streak freezes granted per user'),
  ('streak_milestone_weeks', '[4, 12, 26]'::jsonb,
   'Lit badge week thresholds (B/S/G)'),
  ('sharp_eye_prestige_counts', '[3, 10, 25]'::jsonb,
   'Sharp Eye B/S/G — actionable near-miss counts (corrective_bonus signal)'),
  ('cert_stacked_prestige_counts', '[3, 5, 10]'::jsonb,
   'Stacked badge B/S/G — distinct active certification types'),
  ('competition_eligible_roles', '["employee","foreman","general_foreman","mechanic"]'::jsonb,
   'Field roles eligible for standings (matches FIELD_ROLES)'),
  ('feed_worthy_tier_promotions', '["major_tier_only"]'::jsonb,
   'Recognition feed emits major tier promotions only, not sub-levels')
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- FUNCTIONS: lifetime earned + level mapping (Gate 1 spine)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_lifetime_earned(
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM public.point_transactions
  WHERE user_id = target_user_id
    AND amount > 0
    AND source IN (
      'announcement_claim',
      'compliance_form',
      'streak_bonus',
      'near_miss_report',
      'certification',
      'manual_award'
    );
$$;

COMMENT ON FUNCTION public.get_user_lifetime_earned(uuid) IS
  'Lifetime earned points for level progression. Includes streak_bonus; excludes redemption and adjustment.';

CREATE OR REPLACE FUNCTION public.get_user_level(
  target_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  tier_key          text,
  tier_name         text,
  tier_order        int,
  sub_level         int,
  sub_level_label   text,
  lifetime_earned   int,
  current_threshold int,
  next_threshold    int,
  progress_pct      numeric(5,2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earned int;
  v_current record;
  v_next_threshold int;
BEGIN
  v_earned := public.get_user_lifetime_earned(target_user_id);

  SELECT
    lt.tier_key,
    lt.tier_name,
    lt.tier_order,
    lt.sub_level,
    lt.sub_level_label,
    lt.entry_threshold
  INTO v_current
  FROM public.level_tiers lt
  WHERE lt.is_active
    AND lt.entry_threshold <= v_earned
  ORDER BY lt.entry_threshold DESC
  LIMIT 1;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'get_user_level: no active level_tiers row for earned=%', v_earned;
  END IF;

  SELECT lt.entry_threshold
  INTO v_next_threshold
  FROM public.level_tiers lt
  WHERE lt.is_active
    AND lt.entry_threshold > v_current.entry_threshold
  ORDER BY lt.entry_threshold ASC
  LIMIT 1;

  tier_key          := v_current.tier_key;
  tier_name         := v_current.tier_name;
  tier_order        := v_current.tier_order;
  sub_level         := v_current.sub_level;
  sub_level_label   := v_current.sub_level_label;
  lifetime_earned   := v_earned;
  current_threshold := v_current.entry_threshold;
  next_threshold    := v_next_threshold;

  IF v_next_threshold IS NULL THEN
    progress_pct := 100.00;
  ELSE
    progress_pct := round(
      ((v_earned - v_current.entry_threshold)::numeric
        / (v_next_threshold - v_current.entry_threshold)::numeric) * 100,
      2
    );
  END IF;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.get_user_level(uuid) IS
  'Maps lifetime earned to tier/sub-level and progress toward the next threshold (reads level_tiers).';

GRANT EXECUTE ON FUNCTION public.get_user_lifetime_earned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_level(uuid) TO authenticated;
