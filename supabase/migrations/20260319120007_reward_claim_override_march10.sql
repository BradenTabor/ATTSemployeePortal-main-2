-- =============================================================================
-- One-day reward claim window override for 2026-03-10
-- Runs after 20260319120000 so this version of is_reward_claim_window() is kept.
-- REVERT on March 11: 1) DELETE FROM reward_claim_override_dates WHERE date_override = '2026-03-10';
-- 2) Restore is_reward_claim_window() to 5–8 AM only (content from 20260319120000).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.reward_claim_override_dates (
  date_override date PRIMARY KEY
);

COMMENT ON TABLE public.reward_claim_override_dates IS
  'Dates on which the reward claim window is open all day (one-off overrides). Remove rows after the override day.';

INSERT INTO public.reward_claim_override_dates (date_override)
VALUES ('2026-03-10'::date)
ON CONFLICT (date_override) DO NOTHING;

-- Function: true when (1) current Chicago time is in [05:00, 08:00) OR (2) current Chicago date is in override table
CREATE OR REPLACE FUNCTION public.is_reward_claim_window()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    (NOW() AT TIME ZONE 'America/Chicago')::time >= '05:00'::time
    AND (NOW() AT TIME ZONE 'America/Chicago')::time < '08:00'::time
  )
  OR EXISTS (
    SELECT 1 FROM public.reward_claim_override_dates
    WHERE date_override = (NOW() AT TIME ZONE 'America/Chicago')::date
  );
$$;

COMMENT ON FUNCTION public.is_reward_claim_window() IS
  'Returns true between 5:00–8:00 AM America/Chicago OR when current Chicago date is in reward_claim_override_dates.';
