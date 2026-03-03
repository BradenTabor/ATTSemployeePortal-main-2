/*
  # Safety Rewards Raffle System

  Creates the data model for the monthly safety reward raffle:
  - monthly_safety_rewards: admin-managed reward definitions per month
  - monthly_reward_drawings: drawing results with winner references
  - get_monthly_raffle_stats RPC: aggregate participant/claim counts
  - Storage bucket: safety-rewards for prize images

  ## Prerequisites
  - public.is_admin() function must exist
  - public.update_updated_at_column() trigger function must exist
*/

-- =============================================================================
-- TABLE: monthly_safety_rewards
-- Admin-managed monthly safety reward items for the raffle drawing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.monthly_safety_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 2024 AND 2100),

  grand_prize_name text NOT NULL,
  grand_prize_description text,
  grand_prize_image_url text,

  runner_up_1_name text,
  runner_up_1_description text,
  runner_up_1_image_url text,

  runner_up_2_name text,
  runner_up_2_description text,
  runner_up_2_image_url text,

  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_reward_per_month UNIQUE (year, month)
);

COMMENT ON TABLE public.monthly_safety_rewards IS
  'Admin-managed monthly safety reward items for the raffle drawing.';

CREATE INDEX IF NOT EXISTS idx_rewards_year_month
  ON public.monthly_safety_rewards(year, month DESC);

DROP TRIGGER IF EXISTS set_monthly_safety_rewards_updated_at ON public.monthly_safety_rewards;
CREATE TRIGGER set_monthly_safety_rewards_updated_at
  BEFORE UPDATE ON public.monthly_safety_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.monthly_safety_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view rewards" ON public.monthly_safety_rewards;
CREATE POLICY "Authenticated users can view rewards"
  ON public.monthly_safety_rewards FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert rewards" ON public.monthly_safety_rewards;
CREATE POLICY "Admins can insert rewards"
  ON public.monthly_safety_rewards FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update rewards" ON public.monthly_safety_rewards;
CREATE POLICY "Admins can update rewards"
  ON public.monthly_safety_rewards FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete rewards" ON public.monthly_safety_rewards;
CREATE POLICY "Admins can delete rewards"
  ON public.monthly_safety_rewards FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access rewards" ON public.monthly_safety_rewards;
CREATE POLICY "Service role full access rewards"
  ON public.monthly_safety_rewards FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- TABLE: monthly_reward_drawings
-- Results of monthly safety reward raffle drawings.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.monthly_reward_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.monthly_safety_rewards(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL CHECK (year BETWEEN 2024 AND 2100),

  grand_prize_winner_id uuid REFERENCES auth.users(id),
  runner_up_1_winner_id uuid REFERENCES auth.users(id),
  runner_up_2_winner_id uuid REFERENCES auth.users(id),

  total_entries integer NOT NULL DEFAULT 0,
  total_participants integer NOT NULL DEFAULT 0,
  drawn_at timestamptz NOT NULL DEFAULT now(),
  drawn_by uuid REFERENCES auth.users(id),  -- null = cron, user_id = manual admin draw

  CONSTRAINT unique_drawing_per_month UNIQUE (year, month)
);

COMMENT ON TABLE public.monthly_reward_drawings IS
  'Results of monthly safety reward raffle drawings.';

CREATE INDEX IF NOT EXISTS idx_drawings_year_month
  ON public.monthly_reward_drawings(year, month DESC);

ALTER TABLE public.monthly_reward_drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view drawings" ON public.monthly_reward_drawings;
CREATE POLICY "Authenticated users can view drawings"
  ON public.monthly_reward_drawings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert drawings" ON public.monthly_reward_drawings;
CREATE POLICY "Admins can insert drawings"
  ON public.monthly_reward_drawings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update drawings" ON public.monthly_reward_drawings;
CREATE POLICY "Admins can update drawings"
  ON public.monthly_reward_drawings FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete drawings" ON public.monthly_reward_drawings;
CREATE POLICY "Admins can delete drawings"
  ON public.monthly_reward_drawings FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Service role full access drawings" ON public.monthly_reward_drawings;
CREATE POLICY "Service role full access drawings"
  ON public.monthly_reward_drawings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- RPC: get_monthly_raffle_stats
-- Returns aggregate participant and claim counts for a given month.
-- SECURITY DEFINER: bypasses RLS to aggregate across all users for participant count
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_monthly_raffle_stats(p_year int, p_month int)
RETURNS TABLE(total_participants bigint, total_claim_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT ar.user_id),
    COUNT(ar.id)
  FROM public.announcement_rewards ar
  WHERE EXTRACT(MONTH FROM (ar.claimed_at AT TIME ZONE 'America/Chicago')::date) = p_month
    AND EXTRACT(YEAR FROM (ar.claimed_at AT TIME ZONE 'America/Chicago')::date) = p_year;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_raffle_stats(int, int) TO authenticated;

-- =============================================================================
-- STORAGE: safety-rewards bucket
-- Public-read bucket for prize images, admin-write only.
-- Fallback: if INSERT fails, create manually in Supabase dashboard:
--   Storage > New Bucket > name: safety-rewards, public: true
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-rewards', 'safety-rewards', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins can upload reward images" ON storage.objects;
CREATE POLICY "Admins can upload reward images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'safety-rewards'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Public read for reward images" ON storage.objects;
CREATE POLICY "Public read for reward images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'safety-rewards');

DROP POLICY IF EXISTS "Admins can update reward images" ON storage.objects;
CREATE POLICY "Admins can update reward images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'safety-rewards' AND public.is_admin())
  WITH CHECK (bucket_id = 'safety-rewards' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete reward images" ON storage.objects;
CREATE POLICY "Admins can delete reward images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'safety-rewards' AND public.is_admin());
