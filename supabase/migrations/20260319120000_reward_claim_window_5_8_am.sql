-- Change safety reward claim window from 6:00–8:00 to 5:00–8:00 AM America/Chicago.
-- Deploy together with app change (REWARD_CLAIM_START_HOUR = 5 in complianceHelpers.ts).
-- Frontend catch in useAnnouncementRewards.ts is coupled to the exception message;
-- prefer matching on error code 42501 or substring 'Safety rewards can only be claimed'.
-- Rollback: see docs/rollback-safety-5am.md.

-- Function: true when current Chicago time is within [05:00, 08:00)
CREATE OR REPLACE FUNCTION public.is_reward_claim_window()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    (NOW() AT TIME ZONE 'America/Chicago')::time >= '05:00'::time
    AND (NOW() AT TIME ZONE 'America/Chicago')::time < '08:00'::time
  );
$$;

COMMENT ON FUNCTION public.is_reward_claim_window() IS
  'Returns true only between 5:00 and 8:00 AM America/Chicago; used to restrict announcement_rewards INSERTs.';

-- Trigger: raise friendly error when insert attempted outside window
CREATE OR REPLACE FUNCTION public.check_reward_claim_window()
RETURNS trigger
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
