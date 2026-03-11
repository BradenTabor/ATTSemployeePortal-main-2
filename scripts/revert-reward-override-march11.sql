-- =============================================================================
-- REVERT: Reward claim override for 2026-03-10
-- Run this in Supabase SQL Editor on or after March 11.
--
-- After running this SQL:
-- 1. In src/lib/complianceHelpers.ts remove the constant REWARD_CLAIM_OVERRIDE_DATE
--    and the override-day branches in isWithinRewardClaimWindow() and
--    getTimeUntilClaimWindowOpens() (the "if (todayStr === REWARD_CLAIM_OVERRIDE_DATE)"
--    checks). Deploy the frontend.
-- =============================================================================

DELETE FROM public.reward_claim_override_dates WHERE date_override = '2026-03-10';

-- Restore 5–8 AM only (no override table)
CREATE OR REPLACE FUNCTION public.is_reward_claim_window()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (
    (NOW() AT TIME ZONE 'America/Chicago')::time >= '05:00'::time
    AND (NOW() AT TIME ZONE 'America/Chicago')::time < '08:00'::time
  );
$$;

COMMENT ON FUNCTION public.is_reward_claim_window() IS
  'Returns true only between 5:00 and 8:00 AM America/Chicago; used to restrict announcement_rewards INSERTs.';
