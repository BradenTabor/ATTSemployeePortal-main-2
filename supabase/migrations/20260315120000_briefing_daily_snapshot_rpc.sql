-- RPC: get_briefing_daily_snapshot
-- Returns aggregate counts for the briefing page "Today in the field" (positive framing only).
-- SECURITY DEFINER so we can count without exposing individual rows; no PII returned.

CREATE OR REPLACE FUNCTION public.get_briefing_daily_snapshot(p_briefing_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

COMMENT ON FUNCTION public.get_briefing_daily_snapshot(date) IS
  'Returns aggregate briefing completion count for a date. Used by Safety Briefing page for positive "Today in the field" snapshot. No PII.';

-- Allow authenticated users to call (they only get a number)
GRANT EXECUTE ON FUNCTION public.get_briefing_daily_snapshot(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_briefing_daily_snapshot(date) TO service_role;
