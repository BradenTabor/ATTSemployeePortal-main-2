-- Change safety reward claim window from 7:00–9:00 to 6:00–8:00 AM America/Chicago.
-- Rollback: apply a migration that restores 07:00/09:00 and message '7 AM and 9 AM'.

-- Function: true when current Chicago time is within [06:00, 08:00)
CREATE OR REPLACE FUNCTION public.is_reward_claim_window()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    (NOW() AT TIME ZONE 'America/Chicago')::time >= '06:00'::time
    AND (NOW() AT TIME ZONE 'America/Chicago')::time < '08:00'::time
  );
$$;

COMMENT ON FUNCTION public.is_reward_claim_window() IS
  'Returns true only between 6:00 and 8:00 AM America/Chicago; used to restrict announcement_rewards INSERTs.';

-- Trigger: raise friendly error when insert attempted outside window
CREATE OR REPLACE FUNCTION public.check_reward_claim_window()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.is_reward_claim_window() THEN
    RAISE EXCEPTION 'Safety rewards can only be claimed between 6 AM and 8 AM Central time.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
